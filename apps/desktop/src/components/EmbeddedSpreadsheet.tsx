import {
  UniverSheetsCorePreset,
  type IUniverSheetsCorePresetConfig,
} from "@univerjs/preset-sheets-core";
import UniverSheetsCoreEnUS from "@univerjs/preset-sheets-core/locales/en-US";
import { UniverSheetsConditionalFormattingPreset } from "@univerjs/preset-sheets-conditional-formatting";
import UniverSheetsConditionalFormattingEnUS from "@univerjs/preset-sheets-conditional-formatting/locales/en-US";
import { UniverSheetsDataValidationPreset } from "@univerjs/preset-sheets-data-validation";
import UniverSheetsDataValidationEnUS from "@univerjs/preset-sheets-data-validation/locales/en-US";
import { UniverSheetsFilterPreset } from "@univerjs/preset-sheets-filter";
import UniverSheetsFilterEnUS from "@univerjs/preset-sheets-filter/locales/en-US";
import { UniverSheetsFindReplacePreset } from "@univerjs/preset-sheets-find-replace";
import UniverSheetsFindReplaceEnUS from "@univerjs/preset-sheets-find-replace/locales/en-US";
import { UniverSheetsSortPreset } from "@univerjs/preset-sheets-sort";
import UniverSheetsSortEnUS from "@univerjs/preset-sheets-sort/locales/en-US";
import { UniverSheetsTablePreset } from "@univerjs/preset-sheets-table";
import UniverSheetsTableEnUS from "@univerjs/preset-sheets-table/locales/en-US";
import {
  createUniver,
  LocaleType,
  mergeLocales,
  type FUniver,
} from "@univerjs/presets";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-conditional-formatting/lib/index.css";
import "@univerjs/preset-sheets-data-validation/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import "@univerjs/preset-sheets-sort/lib/index.css";
import "@univerjs/preset-sheets-table/lib/index.css";

import { desktopApi } from "@/lib/desktop-api";
import {
  createSpreadsheetArtifacts,
  loadSpreadsheetData,
  resolveSpreadsheetPath,
  type SpreadsheetCellValue,
  type SpreadsheetEmbedSpec,
  type SpreadsheetSchemaDocument,
} from "@/lib/spreadsheet-data";

export type { SpreadsheetEmbedSpec } from "@/lib/spreadsheet-data";

export interface EmbeddedSpreadsheetProps {
  spec: SpreadsheetEmbedSpec;
  ownerPath: string;
  readOnly: boolean;
}

type SaveState = "loading" | "ready" | "saving" | "saved" | "error";

interface CapturedWorkbook {
  workbook: Record<string, unknown>;
  values: SpreadsheetCellValue[][];
  formulas: string[][];
}

const shellStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  minWidth: 0,
  border: "1px solid var(--border-subtle, #dedbd3)",
  borderRadius: 8,
  overflow: "hidden",
  background: "var(--surface-primary, #fff)",
  boxShadow: "0 1px 2px rgb(0 0 0 / 4%)",
};

const gridStyle: CSSProperties = {
  width: "100%",
  height: 430,
  minWidth: 0,
  position: "relative",
};

function captureWorkbook(univerAPI: FUniver): CapturedWorkbook {
  const workbook = univerAPI.getActiveWorkbook();
  if (!workbook) throw new Error("The embedded spreadsheet is not available.");
  const worksheet = workbook.getActiveSheet();
  const range = worksheet.getDataRange();
  return {
    workbook: workbook.save() as unknown as Record<string, unknown>,
    values: range.getValues() as SpreadsheetCellValue[][],
    formulas: range.getFormulas(),
  };
}

function saveLabel(state: SaveState, readOnly: boolean) {
  if (readOnly) return "Read only";
  if (state === "loading") return "Loading…";
  if (state === "saving") return "Saving…";
  if (state === "saved") return "Saved locally";
  if (state === "error") return "Save failed";
  return "Local spreadsheet";
}

export function EmbeddedSpreadsheet({
  spec,
  ownerPath,
  readOnly,
}: EmbeddedSpreadsheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const saveNowRef = useRef<(() => void) | null>(null);
  const [state, setState] = useState<SaveState>("loading");
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let mounted = true;
    let timer: number | undefined;
    let saveChain = Promise.resolve();
    let disposeRuntime: (() => void) | undefined;

    setState("loading");
    setMessage(undefined);
    const runtimeHost = document.createElement("div");
    runtimeHost.className = "biota-spreadsheet-runtime";
    runtimeHost.style.width = "100%";
    runtimeHost.style.height = "100%";
    container.append(runtimeHost);

    const dataPath = resolveSpreadsheetPath(ownerPath, spec.data);
    const schemaPath = resolveSpreadsheetPath(ownerPath, spec.schema);

    void (async () => {
      try {
        const bundle = await desktopApi.readSheet(
          ownerPath,
          dataPath,
          schemaPath
        );
        const loaded = await loadSpreadsheetData(
          bundle.data.content,
          bundle.schema.content,
          spec
        );
        if (!mounted) return;

        let currentSchema: SpreadsheetSchemaDocument = loaded.schema;
        let lastDataHash = currentSchema.hashes.data_sha256;
        let lastMetadataHash = currentSchema.hashes.metadata_sha256;
        let expectedDataHash = bundle.data.hash;
        let expectedSchemaHash = bundle.schema.hash;

        const coreConfig: Partial<IUniverSheetsCorePresetConfig> = {
          container: runtimeHost,
          header: !readOnly,
          toolbar: !readOnly,
          ribbonType: "collapsed",
          formulaBar: true,
          footer: false,
          statusBarStatistic: false,
          contextMenu: !readOnly,
          disableAutoFocus: true,
        };
        const { univer, univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(
              UniverSheetsCoreEnUS,
              UniverSheetsConditionalFormattingEnUS,
              UniverSheetsDataValidationEnUS,
              UniverSheetsFilterEnUS,
              UniverSheetsFindReplaceEnUS,
              UniverSheetsSortEnUS,
              UniverSheetsTableEnUS
            ),
          },
          presets: [
            UniverSheetsCorePreset(coreConfig),
            UniverSheetsConditionalFormattingPreset(),
            UniverSheetsDataValidationPreset(),
            UniverSheetsFilterPreset(),
            UniverSheetsFindReplacePreset(),
            UniverSheetsSortPreset(),
            UniverSheetsTablePreset(),
          ],
        });
        const workbook = univerAPI.createWorkbook(loaded.workbook as never);

        if (readOnly) {
          await workbook.getWorkbookPermission().setReadOnly();
        }
        if (!mounted) {
          univer.dispose();
          return;
        }

        const persist = () => {
          let captured: CapturedWorkbook;
          try {
            captured = captureWorkbook(univerAPI);
          } catch (caught) {
            if (mounted) {
              setState("error");
              setMessage(
                caught instanceof Error
                  ? caught.message
                  : "Could not capture the spreadsheet."
              );
            }
            return;
          }

          saveChain = saveChain
            .catch(() => undefined)
            .then(async () => {
              const artifacts = await createSpreadsheetArtifacts({
                spec,
                workbook: captured.workbook,
                values: captured.values,
                formulas: captured.formulas,
                previousSchema: currentSchema,
              });
              if (
                artifacts.schema.hashes.data_sha256 === lastDataHash &&
                artifacts.schema.hashes.metadata_sha256 === lastMetadataHash
              ) {
                return;
              }

              if (mounted) setState("saving");
              const saved = await desktopApi.writeSheet({
                ownerPath,
                dataPath,
                schemaPath,
                dataContent: artifacts.csv,
                schemaContent: artifacts.schemaText,
                expectedDataHash,
                expectedSchemaHash,
              });
              currentSchema = artifacts.schema;
              lastDataHash = artifacts.schema.hashes.data_sha256;
              lastMetadataHash = artifacts.schema.hashes.metadata_sha256;
              expectedDataHash = saved.data.hash;
              expectedSchemaHash = saved.schema.hash;
              if (mounted) {
                setState("saved");
                setMessage(undefined);
              }
            })
            .catch((caught) => {
              if (!mounted) return;
              setState("error");
              setMessage(
                caught instanceof Error
                  ? caught.message
                  : "Could not save the spreadsheet sidecars."
              );
            });
        };

        const scheduleSave = () => {
          if (readOnly) return;
          if (timer !== undefined) window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            timer = undefined;
            persist();
          }, 700);
        };

        const commandSubscription = readOnly
          ? undefined
          : univerAPI.addEvent(
              univerAPI.Event.CommandExecuted,
              (event: { type: number }) => {
                // Univer mutation commands are the changes persisted in a
                // workbook snapshot. Operations such as selection and scroll
                // intentionally do not trigger vault writes.
                if (event.type === 2) scheduleSave();
              }
            );

        saveNowRef.current = () => {
          if (timer !== undefined) {
            window.clearTimeout(timer);
            timer = undefined;
          }
          if (!readOnly) persist();
        };
        disposeRuntime = () => {
          if (timer !== undefined) {
            window.clearTimeout(timer);
            timer = undefined;
            persist();
          }
          commandSubscription?.dispose();
          saveNowRef.current = null;
          // Univer owns an internal React root. Disposing it synchronously
          // while CodeMirror/React is removing this widget creates nested-root
          // unmount races in React 19, so let the current commit finish first.
          queueMicrotask(() => {
            univer.dispose();
            runtimeHost.remove();
          });
        };

        setState("ready");
        setMessage(loaded.integrityWarning);
      } catch (caught) {
        if (!mounted) return;
        runtimeHost.remove();
        setState("error");
        setMessage(
          caught instanceof Error
            ? caught.message
            : "Could not open the embedded spreadsheet."
        );
      }
    })();

    return () => {
      mounted = false;
      if (disposeRuntime) disposeRuntime();
      else runtimeHost.remove();
      saveNowRef.current = null;
    };
  }, [ownerPath, readOnly, spec.data, spec.id, spec.schema, spec.title]);

  return (
    <section
      aria-label={`${spec.title} spreadsheet`}
      data-biota-spreadsheet={spec.id}
      data-save-state={state}
      style={shellStyle}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === "s"
        ) {
          event.preventDefault();
          saveNowRef.current?.();
        }
      }}
    >
      <span
        aria-live="polite"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {saveLabel(state, readOnly)}
      </span>
      {message ? (
        <div
          role={state === "error" ? "alert" : "status"}
          style={{
            padding: "7px 10px",
            borderBottom: "1px solid var(--border-subtle, #e3e0d9)",
            background:
              state === "error"
                ? "var(--danger-surface, #fff0ed)"
                : "var(--warning-surface, #fff8df)",
            color:
              state === "error"
                ? "var(--danger-text, #8a2f20)"
                : "var(--warning-text, #705812)",
            font: "11px/1.4 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
          }}
        >
          {message}
        </div>
      ) : null}
      <div
        ref={containerRef}
        aria-busy={state === "loading" || state === "saving"}
        style={gridStyle}
      />
    </section>
  );
}

export default EmbeddedSpreadsheet;
