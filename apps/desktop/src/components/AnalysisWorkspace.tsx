import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  parseAnalysisCsv,
  type AnalysisDataRow,
  type ParsedAnalysisDataset,
} from "@/lib/csv";
import { desktopApi } from "@/lib/desktop-api";

type AnalysisView = "data" | "graph" | "results";
type DatasetStatus = "ready" | "loading" | "error";

type DatasetMetadata = {
  sourceName: string;
  sourcePath?: string;
  xHeader: string;
  valueHeaders: string[];
  sourceRowCount: number;
  columnCount: number;
  warnings: string[];
};

type AnalysisParameter = {
  estimate: number;
  standard_error?: number | null;
  confidence_interval_95?: [number, number] | null;
};

type AnalysisResult = {
  kind?: string;
  model?: string;
  parameters?: Record<string, AnalysisParameter | number>;
  r_squared?: number | null;
  warnings?: string[];
  diagnostics?: {
    engine?: string;
    engine_version?: string;
  };
};

type AnalysisEnvelope = {
  ok: boolean;
  engine_version?: string;
  result?: AnalysisResult;
  error?: {
    type?: string;
    message?: string;
  };
};

type DisplayFit = {
  bottom: number;
  top: number;
  ec50: number;
  hill: number;
  rSquared: number;
  predicted: (x: number) => number;
};

const initialRows: AnalysisDataRow[] = [
  { id: 1, x: 0.01, values: [4.2, 5.1, 4.7] },
  { id: 2, x: 0.03, values: [5.4, 4.9, 5.7] },
  { id: 3, x: 0.1, values: [7.1, 6.6, 7.8] },
  { id: 4, x: 0.3, values: [11.8, 12.4, 10.9] },
  { id: 5, x: 1, values: [22.3, 20.8, 23.1] },
  { id: 6, x: 3, values: [43.6, 46.1, 44.7] },
  { id: 7, x: 10, values: [70.2, 73.4, 71.8] },
  { id: 8, x: 30, values: [87.1, 85.8, 88.4] },
  { id: 9, x: 100, values: [94.5, 95.2, 93.8] },
  { id: 10, x: 300, values: [97.2, 96.4, 97.8] },
];

const initialMetadata: DatasetMetadata = {
  sourceName: "BX-17 dose response.csv",
  xHeader: "concentration_nM",
  valueHeaders: ["Replicate 1", "Replicate 2", "Replicate 3"],
  sourceRowCount: 10,
  columnCount: 4,
  warnings: [],
};

function mean(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      Math.max(1, values.length - 1)
  );
}

function fitFourParameter(rows: AnalysisDataRow[]): DisplayFit {
  const points = rows
    .filter((row) => row.x > 0 && row.values.length)
    .map((row) => ({
      x: row.x,
      y: mean(row.values),
    }));
  if (points.length < 2) {
    return {
      bottom: 0,
      top: 1,
      ec50: 1,
      hill: 1,
      rSquared: 0,
      predicted: () => 0,
    };
  }
  const bottom = Math.min(...points.map((point) => point.y));
  const top = Math.max(...points.map((point) => point.y));
  const midpoint = bottom + (top - bottom) / 2;
  const closest = points.reduce((best, point) =>
    Math.abs(point.y - midpoint) < Math.abs(best.y - midpoint) ? point : best
  );
  const ec50 = closest.x;
  const hill = 1.18;
  const predicted = (x: number) =>
    bottom + (top - bottom) / (1 + (ec50 / Math.max(x, 1e-9)) ** hill);
  const residualSum = points.reduce(
    (sum, point) => sum + (point.y - predicted(point.x)) ** 2,
    0
  );
  const totalSum = points.reduce(
    (sum, point) =>
      sum + (point.y - mean(points.map((candidate) => candidate.y))) ** 2,
    0
  );
  return {
    bottom,
    top,
    ec50,
    hill,
    rSquared: totalSum > 0 ? 1 - residualSum / totalSum : 0,
    predicted,
  };
}

function parameterEstimate(
  result: AnalysisResult | undefined,
  name: string,
  fallback: number
) {
  const parameter = result?.parameters?.[name];
  return typeof parameter === "number"
    ? parameter
    : typeof parameter?.estimate === "number"
      ? parameter.estimate
      : fallback;
}

function parameterDetail(result: AnalysisResult | undefined, name: string) {
  const parameter = result?.parameters?.[name];
  return typeof parameter === "object" ? parameter : undefined;
}

function resultDisplayFit(
  result: AnalysisResult | undefined,
  fallback: DisplayFit
): DisplayFit {
  if (!result) return fallback;
  if (result.kind === "linear_regression") {
    const slope = parameterEstimate(result, "slope", fallback.hill);
    const intercept = parameterEstimate(result, "intercept", fallback.bottom);
    return {
      bottom: intercept,
      top: intercept + slope * 300,
      ec50: 1,
      hill: slope,
      rSquared: result.r_squared ?? fallback.rSquared,
      predicted: (x) => intercept + slope * x,
    };
  }

  if (result.model === "exponential_association") {
    const baseline = parameterEstimate(result, "baseline", fallback.bottom);
    const plateau = parameterEstimate(result, "plateau", fallback.top);
    const rate = parameterEstimate(result, "rate", 1);
    return {
      bottom: baseline,
      top: plateau,
      ec50: rate > 0 ? Math.log(2) / rate : fallback.ec50,
      hill: rate,
      rSquared: result.r_squared ?? fallback.rSquared,
      predicted: (x) =>
        baseline + (plateau - baseline) * (1 - Math.exp(-rate * x)),
    };
  }

  const bottom = parameterEstimate(result, "bottom", fallback.bottom);
  const top = parameterEstimate(result, "top", fallback.top);
  const ec50 = parameterEstimate(result, "ec50", fallback.ec50);
  const hill = parameterEstimate(result, "hill_slope", fallback.hill);
  const asymmetry = parameterEstimate(result, "asymmetry", 1);
  return {
    bottom,
    top,
    ec50,
    hill,
    rSquared: result.r_squared ?? fallback.rSquared,
    predicted: (x) =>
      bottom +
      (top - bottom) /
        (1 + (ec50 / Math.max(x, Number.EPSILON)) ** hill) ** asymmetry,
  };
}

function DoseResponseChart({
  rows,
  fit,
  showPoints,
  showCurve,
  showError,
  xLabel,
  yLabel,
  logScale,
}: {
  rows: AnalysisDataRow[];
  fit: DisplayFit;
  showPoints: boolean;
  showCurve: boolean;
  showError: boolean;
  xLabel: string;
  yLabel: string;
  logScale: boolean;
}) {
  const width = 760;
  const height = 450;
  const margin = { left: 72, right: 28, top: 30, bottom: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const usableRows = rows.filter(
    (row) => row.values.length && (!logScale || row.x > 0)
  );
  const observedX = usableRows.map((row) => row.x);
  const transformedX = observedX.map((value) =>
    logScale ? Math.log10(value) : value
  );
  let xMin = Math.min(...transformedX, 0);
  let xMax = Math.max(...transformedX, 1);
  if (transformedX.length) {
    xMin = Math.min(...transformedX);
    xMax = Math.max(...transformedX);
  }
  if (xMin === xMax) {
    xMin -= 0.5;
    xMax += 0.5;
  }
  const xPadding = (xMax - xMin) * 0.04;
  xMin -= xPadding;
  xMax += xPadding;

  const xAtFraction = (fraction: number) => {
    const transformed = xMin + fraction * (xMax - xMin);
    return logScale ? 10 ** transformed : transformed;
  };
  const curvePoints = Array.from({ length: 121 }, (_, index) => {
    const x = xAtFraction(index / 120);
    return { x, y: fit.predicted(x) };
  }).filter((point) => Number.isFinite(point.y));
  const observedY = usableRows.flatMap((row) => {
    const average = mean(row.values);
    const error = standardDeviation(row.values);
    return [average - error, average + error];
  });
  const allY = [...observedY, ...curvePoints.map((point) => point.y)];
  let yMin = Math.min(...allY, 0);
  let yMax = Math.max(...allY, 1);
  if (allY.length) {
    yMin = Math.min(...allY);
    yMax = Math.max(...allY);
  }
  if (yMin === yMax) {
    yMin -= 0.5;
    yMax += 0.5;
  }
  const yPadding = (yMax - yMin) * 0.08;
  yMin -= yPadding;
  yMax += yPadding;

  const xScale = (x: number) => {
    const transformed = logScale ? Math.log10(x) : x;
    return margin.left + ((transformed - xMin) / (xMax - xMin)) * plotWidth;
  };
  const yScale = (y: number) =>
    margin.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;
  const curve = curvePoints
    .map(
      (point, index) =>
        `${index ? "L" : "M"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`
    )
    .join(" ");
  const xTicks = Array.from({ length: 6 }, (_, index) =>
    xAtFraction(index / 5)
  );
  const yTicks = Array.from(
    { length: 6 },
    (_, index) => yMin + (index / 5) * (yMax - yMin)
  );
  const formatTick = (value: number) => {
    const absolute = Math.abs(value);
    if (absolute && (absolute >= 10_000 || absolute < 0.001)) {
      return value.toExponential(1);
    }
    return Number(value.toPrecision(3)).toString();
  };

  return (
    <svg
      className="analysis-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Dose response plot"
    >
      <rect
        x={margin.left}
        y={margin.top}
        width={plotWidth}
        height={plotHeight}
        fill="#fff"
      />
      {yTicks.map((tick, index) => (
        <g key={`y-${index}`}>
          <line
            x1={margin.left}
            x2={margin.left + plotWidth}
            y1={yScale(tick)}
            y2={yScale(tick)}
            className="chart-grid"
          />
          <text x={margin.left - 14} y={yScale(tick) + 4} textAnchor="end">
            {formatTick(tick)}
          </text>
        </g>
      ))}
      {xTicks.map((tick, index) => (
        <g key={`x-${index}`}>
          <line
            x1={xScale(tick)}
            x2={xScale(tick)}
            y1={margin.top}
            y2={margin.top + plotHeight}
            className="chart-grid vertical"
          />
          <text
            x={xScale(tick)}
            y={margin.top + plotHeight + 26}
            textAnchor="middle"
          >
            {formatTick(tick)}
          </text>
        </g>
      ))}
      <line
        x1={margin.left}
        x2={margin.left}
        y1={margin.top}
        y2={margin.top + plotHeight}
        className="chart-axis"
      />
      <line
        x1={margin.left}
        x2={margin.left + plotWidth}
        y1={margin.top + plotHeight}
        y2={margin.top + plotHeight}
        className="chart-axis"
      />
      {showCurve && curve ? <path d={curve} className="fitted-curve" /> : null}
      {usableRows.map((row) => {
        const average = mean(row.values);
        const error = standardDeviation(row.values);
        return (
          <g key={row.id}>
            {showError && row.values.length > 1 ? (
              <>
                <line
                  x1={xScale(row.x)}
                  x2={xScale(row.x)}
                  y1={yScale(average - error)}
                  y2={yScale(average + error)}
                  className="error-bar"
                />
                <line
                  x1={xScale(row.x) - 5}
                  x2={xScale(row.x) + 5}
                  y1={yScale(average - error)}
                  y2={yScale(average - error)}
                  className="error-bar"
                />
                <line
                  x1={xScale(row.x) - 5}
                  x2={xScale(row.x) + 5}
                  y1={yScale(average + error)}
                  y2={yScale(average + error)}
                  className="error-bar"
                />
              </>
            ) : null}
            {showPoints ? (
              <circle
                cx={xScale(row.x)}
                cy={yScale(average)}
                r="5"
                className="data-point"
              />
            ) : null}
          </g>
        );
      })}
      <text
        x={margin.left + plotWidth / 2}
        y={height - 10}
        textAnchor="middle"
        className="axis-label"
      >
        {xLabel}
        {logScale ? " (log scale)" : ""}
      </text>
      <text
        x="18"
        y={margin.top + plotHeight / 2}
        textAnchor="middle"
        transform={`rotate(-90 18 ${margin.top + plotHeight / 2})`}
        className="axis-label"
      >
        {yLabel}
      </text>
    </svg>
  );
}

export function AnalysisWorkspace({ path }: { path?: string }) {
  const [rows, setRows] = useState(initialRows);
  const [metadata, setMetadata] = useState<DatasetMetadata>(initialMetadata);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatus>("ready");
  const [datasetError, setDatasetError] = useState<string>();
  const [view, setView] = useState<AnalysisView>("graph");
  const [model, setModel] = useState("4PL dose-response");
  const [showPoints, setShowPoints] = useState(true);
  const [showCurve, setShowCurve] = useState(true);
  const [showError, setShowError] = useState(true);
  const [runAt, setRunAt] = useState<string>();
  const [running, setRunning] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>();
  const [analysisError, setAnalysisError] = useState<string>();
  const [engineVersion, setEngineVersion] = useState("not run");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewFit = useMemo(() => fitFourParameter(rows), [rows]);
  const fit = useMemo(
    () => resultDisplayFit(analysisResult, previewFit),
    [analysisResult, previewFit]
  );
  const replicateCount = Math.max(1, ...rows.map((row) => row.values.length));
  const datasetTitle = metadata.sourceName.replace(/\.(csv|tsv)$/i, "");
  const responseLabel =
    metadata.valueHeaders.length === 1
      ? metadata.valueHeaders[0]!
      : "Observed response";
  const logScale =
    model.includes("dose-response") &&
    rows.length > 0 &&
    rows.every((row) => row.x > 0);
  const displayValueHeaders = Array.from(
    { length: replicateCount },
    (_, index) => {
      if (metadata.valueHeaders.length === replicateCount) {
        return metadata.valueHeaders[index]!;
      }
      if (metadata.valueHeaders.length === 1) {
        return `${metadata.valueHeaders[0]} ${index + 1}`;
      }
      return `Measurement ${index + 1}`;
    }
  );
  const currentError = datasetError ?? analysisError;
  const datasetSummary =
    datasetStatus === "loading"
      ? "Loading vault data…"
      : `${metadata.sourceRowCount} source rows · ${metadata.columnCount} columns`;

  const applyDataset = useCallback(
    (
      parsed: ParsedAnalysisDataset,
      sourceName: string,
      sourcePath?: string
    ) => {
      setRows(parsed.rows);
      setMetadata({
        sourceName,
        sourcePath,
        xHeader: parsed.xHeader,
        valueHeaders: parsed.valueHeaders,
        sourceRowCount: parsed.sourceRowCount,
        columnCount: parsed.columnCount,
        warnings: parsed.warnings,
      });
      setDatasetStatus("ready");
      setDatasetError(undefined);
      setAnalysisResult(undefined);
      setAnalysisError(undefined);
      setEngineVersion("not run");
      setRunAt(undefined);
      setView("graph");
    },
    []
  );

  useEffect(() => {
    if (!path || !/\.(csv|tsv)$/i.test(path)) return;
    let cancelled = false;
    setDatasetStatus("loading");
    setDatasetError(undefined);

    void desktopApi
      .readText(path)
      .then((text) => {
        if (cancelled) return;
        const parsed = parseAnalysisCsv(text);
        applyDataset(
          parsed,
          path.split("/").at(-1) ?? "Vault dataset.csv",
          path
        );
      })
      .catch((caught) => {
        if (cancelled) return;
        setRows([]);
        setDatasetStatus("error");
        setDatasetError(
          caught instanceof Error
            ? caught.message
            : "Biota could not read the selected data file."
        );
      });

    return () => {
      cancelled = true;
    };
  }, [applyDataset, path]);

  function updateX(id: number, value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, x: numeric } : row))
    );
  }

  function updateValue(id: number, index: number, value: string) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setRows((current) =>
      current.map((row) => {
        if (row.id !== id) return row;
        const values = [...row.values];
        values[index] = numeric;
        return { ...row, values };
      })
    );
  }

  function addRow() {
    setRows((current) => {
      const previous = current.at(-1);
      return [
        ...current,
        {
          id: Math.max(0, ...current.map((row) => row.id)) + 1,
          x: previous ? previous.x + 1 : 0,
          values: Array.from({ length: replicateCount }, () => 0),
        },
      ];
    });
  }

  async function runAnalysis() {
    setAnalysisError(undefined);
    const eligibleRows = model.includes("dose-response")
      ? rows.filter((row) => row.x > 0)
      : rows;
    const x = eligibleRows.flatMap((row) => row.values.map(() => row.x));
    const y = eligibleRows.flatMap((row) => row.values);
    if (x.length < 2 || y.length < 2) {
      setAnalysisError(
        model.includes("dose-response")
          ? "This model needs at least two measurements with positive X values."
          : "This model needs at least two numeric measurements."
      );
      return;
    }
    setRunning(true);
    const request: Record<string, unknown> =
      model === "Linear regression"
        ? {
            kind: "linear_regression",
            columns: { x, y },
          }
        : {
            kind: "curve_fit",
            model:
              model === "5PL dose-response"
                ? "five_pl"
                : model === "Exponential association"
                  ? "exponential_association"
                  : "four_pl",
            columns: { x, y },
          };

    try {
      const response = await desktopApi.runAnalysis<AnalysisEnvelope>(request);
      if (!response.ok) {
        throw new Error(
          response.error?.message || "The analysis engine rejected this fit."
        );
      }
      const result = response.result;
      if (result?.parameters) {
        setAnalysisResult(result);
      }
      setEngineVersion(
        response.engine_version ??
          result?.diagnostics?.engine_version ??
          "local preview"
      );
      setRunAt(
        new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date())
      );
      setView("results");
    } catch (caught) {
      setAnalysisError(
        caught instanceof Error
          ? caught.message
          : "The local analysis could not be completed."
      );
    } finally {
      setRunning(false);
    }
  }

  const ec50Detail = parameterDetail(analysisResult, "ec50");
  const hillDetail = parameterDetail(analysisResult, "hill_slope");
  const bottomDetail = parameterDetail(analysisResult, "bottom");
  const topDetail = parameterDetail(analysisResult, "top");

  function interval(detail?: AnalysisParameter) {
    const values = detail?.confidence_interval_95;
    return values
      ? `${values[0].toPrecision(4)} to ${values[1].toPrecision(4)}`
      : "Run the local engine for a confidence interval";
  }

  return (
    <div className="analysis-workspace">
      <aside className="analysis-library">
        <div className="specialized-sidebar-heading">
          <span>Data & analyses</span>
          <button>
            <Icon name="add" size={15} />
          </button>
        </div>
        <label className="specialized-search">
          <Icon name="search" size={13} />
          <input placeholder="Find a dataset…" />
        </label>
        <div className="analysis-tree">
          <div className="analysis-tree-group">
            <button className="tree-parent">
              <Icon name="chevron" size={11} className="is-expanded" />
              <Icon name="folder" size={14} />
              Dose-response pilot
            </button>
            <button className="is-active">
              <span className="analysis-item-icon csv-icon">CSV</span>
              <span>
                <strong>{datasetTitle}</strong>
                <small>{datasetSummary}</small>
              </span>
            </button>
            <button>
              <span className="analysis-item-icon graph-icon">
                <Icon name="analysis" size={13} />
              </span>
              <span>
                <strong>{datasetTitle} fit</strong>
                <small>{model}</small>
              </span>
            </button>
          </div>
          <div className="analysis-tree-group">
            <button className="tree-parent">
              <Icon name="chevron" size={11} className="is-expanded" />
              <Icon name="folder" size={14} />
              Calibration
            </button>
            <button>
              <span className="analysis-item-icon csv-icon">CSV</span>
              <span>
                <strong>Plate reader standard</strong>
                <small>8 rows · 3 columns</small>
              </span>
            </button>
          </div>
        </div>
        <div className="analysis-library-footer">
          <button onClick={() => fileInputRef.current?.click()}>
            <Icon name="external" size={14} /> Import CSV
          </button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              setDatasetStatus("loading");
              setDatasetError(undefined);
              void file
                .text()
                .then((text) => {
                  applyDataset(parseAnalysisCsv(text), file.name);
                })
                .catch((caught) => {
                  setRows([]);
                  setDatasetStatus("error");
                  setDatasetError(
                    caught instanceof Error
                      ? caught.message
                      : "Biota could not parse the selected data file."
                  );
                });
              event.currentTarget.value = "";
            }}
          />
        </div>
      </aside>

      <section className="analysis-main">
        <header className="analysis-document-header">
          <div>
            <span className="analysis-file-mark">ƒ</span>
            <div>
              <h1>{datasetTitle} fit</h1>
              <p>
                <strong>{metadata.sourcePath ?? metadata.sourceName}</strong> ·{" "}
                {datasetStatus === "loading"
                  ? "Loading from the vault"
                  : "Local vault data"}
              </p>
            </div>
          </div>
          <div>
            <span className={`fresh-badge ${currentError ? "is-error" : ""}`}>
              <Icon name={currentError ? "warning" : "check"} size={12} />{" "}
              {datasetStatus === "loading"
                ? "Loading data"
                : datasetError
                  ? "Dataset failed"
                  : analysisError
                    ? "Analysis failed"
                    : analysisResult
                      ? "Results current"
                      : "Preview — not yet run"}
            </span>
            <button
              className="button button-primary"
              onClick={runAnalysis}
              disabled={running || datasetStatus !== "ready" || rows.length < 2}
            >
              <Icon name="sparkle" size={14} />
              {running ? "Running…" : "Run analysis"}
            </button>
          </div>
        </header>
        <div className="analysis-view-tabs">
          <button
            className={view === "data" ? "is-active" : ""}
            onClick={() => setView("data")}
          >
            <Icon name="table" size={14} /> Data
          </button>
          <button
            className={view === "graph" ? "is-active" : ""}
            onClick={() => setView("graph")}
          >
            <Icon name="analysis" size={14} /> Graph
          </button>
          <button
            className={view === "results" ? "is-active" : ""}
            onClick={() => setView("results")}
          >
            <Icon name="document" size={14} /> Results
          </button>
        </div>

        {view === "data" ? (
          <div className="data-table-wrap">
            <div className="data-table-toolbar">
              <div>
                <strong>{metadata.sourceName}</strong>
                <span>
                  {datasetStatus === "loading"
                    ? "Reading the selected vault file…"
                    : (currentError ??
                      metadata.warnings[0] ??
                      "Editable source data")}
                </span>
              </div>
              <button className="button button-quiet" onClick={addRow}>
                <Icon name="add" size={13} /> Add row
              </button>
            </div>
            <table
              className="data-table"
              style={{ minWidth: Math.max(680, 280 + replicateCount * 150) }}
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>
                    <span>X</span> {metadata.xHeader}
                  </th>
                  {displayValueHeaders.map((header, index) => (
                    <th key={`${header}-${index}`}>
                      <span>Y{index + 1}</span> {header}
                    </th>
                  ))}
                  <th>Mean</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th>{row.id}</th>
                    <td>
                      <input
                        value={row.x}
                        aria-label={`${metadata.xHeader}, row ${row.id}`}
                        onChange={(event) =>
                          updateX(row.id, event.target.value)
                        }
                      />
                    </td>
                    {Array.from({ length: replicateCount }, (_, index) => (
                      <td key={index}>
                        <input
                          value={row.values[index] ?? ""}
                          aria-label={`${displayValueHeaders[index]}, row ${row.id}`}
                          onChange={(event) =>
                            updateValue(row.id, index, event.target.value)
                          }
                        />
                      </td>
                    ))}
                    <td className="calculated-cell">
                      {mean(row.values).toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {view === "graph" ? (
          <div className="graph-canvas">
            <div className="graph-paper">
              <div className="graph-title">
                <h2>{datasetTitle}</h2>
                <p>
                  {datasetStatus === "loading"
                    ? "Reading numeric columns from the vault…"
                    : (currentError ??
                      `${metadata.xHeader} vs ${responseLabel} · mean ± SD, up to n = ${replicateCount}`)}
                </p>
              </div>
              <DoseResponseChart
                rows={rows}
                fit={fit}
                showPoints={showPoints}
                showCurve={showCurve}
                showError={showError}
                xLabel={metadata.xHeader}
                yLabel={responseLabel}
                logScale={logScale}
              />
              <div className="chart-legend">
                <span>
                  <i className="legend-point" /> Observed mean ± SD
                </span>
                <span>
                  <i className="legend-line" /> {model}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {view === "results" ? (
          <div className="results-report">
            <div className="report-heading">
              <p className="eyebrow">{model.toUpperCase()}</p>
              <h1>{model} fit</h1>
              <p>
                Local fit of {responseLabel} against {metadata.xHeader}.
              </p>
            </div>
            <div className="metric-grid">
              <article>
                <span>EC50</span>
                <strong>{fit.ec50.toFixed(4)}</strong>
                <small>95% CI {interval(ec50Detail)}</small>
              </article>
              <article>
                <span>Hill slope</span>
                <strong>{fit.hill.toFixed(2)}</strong>
                <small>95% CI {interval(hillDetail)}</small>
              </article>
              <article>
                <span>Goodness of fit</span>
                <strong>R² {fit.rSquared.toFixed(4)}</strong>
                <small>
                  {analysisResult
                    ? "Calculated by the local float64 engine"
                    : "Preview estimate"}
                </small>
              </article>
            </div>
            <section className="parameter-table">
              <h3>Best-fit values</h3>
              <table>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Estimate</th>
                    <th>Std. error</th>
                    <th>95% confidence interval</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Bottom</td>
                    <td>{fit.bottom.toFixed(3)}</td>
                    <td>
                      {bottomDetail?.standard_error?.toPrecision(4) ?? "—"}
                    </td>
                    <td>{interval(bottomDetail)}</td>
                  </tr>
                  <tr>
                    <td>Top</td>
                    <td>{fit.top.toFixed(3)}</td>
                    <td>{topDetail?.standard_error?.toPrecision(4) ?? "—"}</td>
                    <td>{interval(topDetail)}</td>
                  </tr>
                  <tr>
                    <td>LogEC50</td>
                    <td>{Math.log10(fit.ec50).toFixed(3)}</td>
                    <td>{ec50Detail?.standard_error?.toPrecision(4) ?? "—"}</td>
                    <td>{interval(ec50Detail)}</td>
                  </tr>
                  <tr>
                    <td>Hill slope</td>
                    <td>{fit.hill.toFixed(3)}</td>
                    <td>{hillDetail?.standard_error?.toPrecision(4) ?? "—"}</td>
                    <td>{interval(hillDetail)}</td>
                  </tr>
                </tbody>
              </table>
            </section>
            <div className="report-callout">
              <Icon name={currentError ? "warning" : "check"} size={17} />
              <div>
                <strong>
                  {currentError
                    ? datasetError
                      ? "Dataset did not load"
                      : "Fit did not complete"
                    : analysisResult
                      ? "Fit converged normally"
                      : "Preview values only"}
                </strong>
                <span>
                  {currentError ??
                    (analysisResult
                      ? analysisResult.warnings?.join(" · ") ||
                        "The local engine returned finite parameters and diagnostics."
                      : "Run the analysis to calculate parameters and confidence intervals.")}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="analysis-statusbar">
          <span>
            <span className="status-dot status-dot-green" /> Local calculation
            only
          </span>
          <span>{runAt ? `Last run ${runAt}` : "Not yet run"}</span>
          <span className="statusbar-spacer" />
          <span>{metadata.sourceName}</span>
          <span>Engine: {engineVersion}</span>
        </footer>
      </section>

      <aside className="analysis-inspector">
        <div className="inspector-tabs">
          <button className="is-active">Analysis</button>
          <button>Style</button>
        </div>
        <div className="analysis-inspector-scroll">
          <section>
            <p className="inspector-label">MODEL</p>
            <label className="select-field">
              <span>Regression</span>
              <select
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setAnalysisResult(undefined);
                  setRunAt(undefined);
                }}
              >
                <option>4PL dose-response</option>
                <option>5PL dose-response</option>
                <option>Linear regression</option>
                <option>Exponential association</option>
              </select>
            </label>
            <div className="analysis-model-card">
              <span className="model-symbol">Y</span>
              <code>
                Bottom + (Top − Bottom)
                <br />
                ─────────────────
                <br />1 + (EC50 / X)<sup>Hill</sup>
              </code>
            </div>
          </section>
          <section>
            <p className="inspector-label">DATA MAPPING</p>
            <label className="select-field">
              <span>X values</span>
              <select>
                <option>{metadata.xHeader}</option>
              </select>
            </label>
            <label className="select-field">
              <span>Y values</span>
              <select>
                <option>
                  {metadata.valueHeaders.join(", ")} ({replicateCount} values
                  max)
                </option>
              </select>
            </label>
            <label className="select-field">
              <span>Error bars</span>
              <select>
                <option>Standard deviation</option>
                <option>Standard error</option>
                <option>95% confidence interval</option>
              </select>
            </label>
          </section>
          <section>
            <p className="inspector-label">DISPLAY</p>
            <label className="toggle-row">
              <span>
                <i className="point-preview" /> Data points
              </span>
              <input
                type="checkbox"
                checked={showPoints}
                onChange={(event) => setShowPoints(event.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <i className="line-preview" /> Fitted curve
              </span>
              <input
                type="checkbox"
                checked={showCurve}
                onChange={(event) => setShowCurve(event.target.checked)}
              />
            </label>
            <label className="toggle-row">
              <span>
                <i className="error-preview" /> Error bars
              </span>
              <input
                type="checkbox"
                checked={showError}
                onChange={(event) => setShowError(event.target.checked)}
              />
            </label>
          </section>
          <section className="fit-summary-card">
            <div>
              <span className="status-dot status-dot-green" />
              <strong>Fit converged</strong>
            </div>
            <dl>
              <div>
                <dt>EC50</dt>
                <dd>{fit.ec50.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Hill slope</dt>
                <dd>{fit.hill.toFixed(2)}</dd>
              </div>
              <div>
                <dt>R²</dt>
                <dd>{fit.rSquared.toFixed(4)}</dd>
              </div>
            </dl>
            <button onClick={() => setView("results")}>
              View full results
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}
