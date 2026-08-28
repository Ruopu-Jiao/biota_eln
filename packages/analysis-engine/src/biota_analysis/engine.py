from __future__ import annotations

import warnings
from dataclasses import dataclass
from math import isfinite
from typing import Any, Callable, Iterable

import numpy as np
from scipy import stats

ENGINE_VERSION = "0.1.0"


class AnalysisError(ValueError):
    """Raised when an analysis request is invalid or cannot be calculated."""


def _finite(values: Iterable[Any], *, label: str) -> np.ndarray:
    parsed: list[float] = []
    for value in values:
        if value is None or value == "":
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError) as exc:
            raise AnalysisError(f"{label} contains a non-numeric value: {value!r}") from exc
        if isfinite(numeric):
            parsed.append(numeric)
    if not parsed:
        raise AnalysisError(f"{label} has no finite numeric observations")
    return np.asarray(parsed, dtype=np.float64)


def _paired(left: Iterable[Any], right: Iterable[Any]) -> tuple[np.ndarray, np.ndarray]:
    pairs: list[tuple[float, float]] = []
    for left_value, right_value in zip(left, right, strict=False):
        if left_value in (None, "") or right_value in (None, ""):
            continue
        try:
            pair = (float(left_value), float(right_value))
        except (TypeError, ValueError) as exc:
            raise AnalysisError("paired columns contain a non-numeric value") from exc
        if all(isfinite(value) for value in pair):
            pairs.append(pair)
    if len(pairs) < 2:
        raise AnalysisError("paired t-test requires at least two complete pairs")
    values = np.asarray(pairs, dtype=np.float64)
    return values[:, 0], values[:, 1]


def _serializable(value: Any) -> Any:
    if isinstance(value, np.ndarray):
        return [_serializable(item) for item in value.tolist()]
    if isinstance(value, (np.bool_, bool)):
        return bool(value)
    if isinstance(value, (np.floating, float)):
        numeric = float(value)
        return numeric if isfinite(numeric) else None
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, dict):
        return {str(key): _serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serializable(item) for item in value]
    return value


def _column(request: dict[str, Any], name: str) -> list[Any]:
    columns = request.get("columns")
    if not isinstance(columns, dict) or not isinstance(columns.get(name), list):
        raise AnalysisError(f"missing columns.{name}")
    return columns[name]


def _confidence_interval(values: np.ndarray, confidence: float = 0.95) -> list[float] | None:
    if values.size < 2:
        return None
    sem = stats.sem(values)
    mean = float(np.mean(values))
    if sem == 0:
        return [mean, mean]
    low, high = stats.t.interval(confidence, values.size - 1, loc=np.mean(values), scale=sem)
    return [float(low), float(high)]


def descriptive(request: dict[str, Any]) -> dict[str, Any]:
    values = _finite(_column(request, request.get("value_column", "value")), label="value")
    sample_sd = float(np.std(values, ddof=1)) if values.size > 1 else None
    return {
        "n": int(values.size),
        "mean": float(np.mean(values)),
        "median": float(np.median(values)),
        "standard_deviation": sample_sd,
        "standard_error": float(stats.sem(values)) if values.size > 1 else None,
        "minimum": float(np.min(values)),
        "maximum": float(np.max(values)),
        "confidence_interval_95": _confidence_interval(values),
    }


def t_test(request: dict[str, Any]) -> dict[str, Any]:
    paired = bool(request.get("paired", False))
    equal_variance = bool(request.get("equal_variance", False))
    alternative = request.get("alternative", "two-sided")
    if alternative not in {"two-sided", "less", "greater"}:
        raise AnalysisError("alternative must be two-sided, less, or greater")

    left_values = _column(request, request.get("left_column", "left"))
    right_values = _column(request, request.get("right_column", "right"))
    if paired:
        left, right = _paired(left_values, right_values)
        result = stats.ttest_rel(left, right, alternative=alternative)
    else:
        left = _finite(left_values, label="left")
        right = _finite(right_values, label="right")
        if left.size < 2 or right.size < 2:
            raise AnalysisError("unpaired t-test requires two observations per group")
        result = stats.ttest_ind(
            left,
            right,
            equal_var=equal_variance,
            alternative=alternative,
        )

    difference = float(np.mean(left) - np.mean(right))
    pooled_scale = np.sqrt(
        ((left.size - 1) * np.var(left, ddof=1) + (right.size - 1) * np.var(right, ddof=1))
        / max(1, left.size + right.size - 2)
    )
    effect_size = difference / pooled_scale if pooled_scale > 0 else None
    return {
        "paired": paired,
        "alternative": alternative,
        "equal_variance": equal_variance if not paired else None,
        "left": descriptive({"columns": {"value": left.tolist()}}),
        "right": descriptive({"columns": {"value": right.tolist()}}),
        "mean_difference": difference,
        "t_statistic": float(result.statistic),
        "p_value": float(result.pvalue),
        "degrees_of_freedom": float(result.df),
        "cohens_d": float(effect_size) if effect_size is not None else None,
    }


def one_way_anova(request: dict[str, Any]) -> dict[str, Any]:
    from statsmodels.stats.multicomp import pairwise_tukeyhsd

    group_names = _column(request, request.get("group_column", "group"))
    raw_values = _column(request, request.get("value_column", "value"))
    if len(group_names) != len(raw_values):
        raise AnalysisError("group and value columns must have equal length")

    grouped: dict[str, list[float]] = {}
    for group, value in zip(group_names, raw_values, strict=True):
        if group in (None, "") or value in (None, ""):
            continue
        try:
            numeric = float(value)
        except (TypeError, ValueError) as exc:
            raise AnalysisError("value contains a non-numeric observation") from exc
        if isfinite(numeric):
            grouped.setdefault(str(group), []).append(numeric)

    if len(grouped) < 2 or any(len(values) < 2 for values in grouped.values()):
        raise AnalysisError("one-way ANOVA requires at least two groups with two observations")

    arrays = [np.asarray(values, dtype=np.float64) for values in grouped.values()]
    omnibus = stats.f_oneway(*arrays)
    all_values = np.concatenate(arrays)
    all_groups = np.concatenate(
        [np.repeat(name, len(values)) for name, values in grouped.items()]
    )
    tukey = pairwise_tukeyhsd(all_values, all_groups)
    comparisons = []
    for row in tukey.summary().data[1:]:
        comparisons.append(
            {
                "group_a": str(row[0]),
                "group_b": str(row[1]),
                "mean_difference": float(row[2]),
                "adjusted_p_value": float(row[3]),
                "confidence_interval": [float(row[4]), float(row[5])],
                "reject": bool(row[6]),
            }
        )

    grand_mean = float(np.mean(all_values))
    ss_between = sum(
        len(values) * (float(np.mean(values)) - grand_mean) ** 2 for values in arrays
    )
    ss_total = float(np.sum((all_values - grand_mean) ** 2))
    return {
        "groups": {
            name: descriptive({"columns": {"value": values}})
            for name, values in grouped.items()
        },
        "f_statistic": float(omnibus.statistic),
        "p_value": float(omnibus.pvalue),
        "degrees_of_freedom": [len(grouped) - 1, len(all_values) - len(grouped)],
        "eta_squared": ss_between / ss_total if ss_total > 0 else None,
        "tukey_hsd": comparisons,
    }


def two_way_anova(request: dict[str, Any]) -> dict[str, Any]:
    factor_a = _column(request, request.get("factor_a_column", "factor_a"))
    factor_b = _column(request, request.get("factor_b_column", "factor_b"))
    raw_values = _column(request, request.get("value_column", "value"))
    if not (len(factor_a) == len(factor_b) == len(raw_values)):
        raise AnalysisError("factor and value columns must have equal length")

    rows = []
    for a_value, b_value, raw in zip(factor_a, factor_b, raw_values, strict=True):
        if a_value in (None, "") or b_value in (None, "") or raw in (None, ""):
            continue
        try:
            numeric = float(raw)
        except (TypeError, ValueError) as exc:
            raise AnalysisError("value contains a non-numeric observation") from exc
        if isfinite(numeric):
            rows.append((str(a_value), str(b_value), numeric))
    import pandas as pd
    from statsmodels.regression.linear_model import OLS
    from statsmodels.stats.anova import anova_lm

    frame = pd.DataFrame(rows, columns=["factor_a", "factor_b", "value"])
    if frame["factor_a"].nunique() < 2 or frame["factor_b"].nunique() < 2:
        raise AnalysisError("two-way ANOVA requires at least two levels per factor")

    cell_counts = frame.groupby(["factor_a", "factor_b"], observed=True).size()
    expected_cell_count = frame["factor_a"].nunique() * frame["factor_b"].nunique()
    if cell_counts.size != expected_cell_count:
        raise AnalysisError(
            "two-way ANOVA with interaction requires observations in every factor combination"
        )

    try:
        model = OLS.from_formula("value ~ C(factor_a) * C(factor_b)", data=frame).fit()
    except (ValueError, TypeError, np.linalg.LinAlgError) as exc:
        raise AnalysisError(f"two-way ANOVA model could not be fitted: {exc}") from exc

    design = model.model.exog
    if np.linalg.matrix_rank(design) < design.shape[1]:
        raise AnalysisError("two-way ANOVA design matrix is rank deficient")
    if model.df_resid < 1:
        raise AnalysisError(
            "two-way ANOVA requires replication to estimate residual variance"
        )

    try:
        table = anova_lm(model, typ=2)
    except (ValueError, TypeError, np.linalg.LinAlgError) as exc:
        raise AnalysisError(f"two-way ANOVA could not be calculated: {exc}") from exc

    required_effects = {
        "C(factor_a)",
        "C(factor_b)",
        "C(factor_a):C(factor_b)",
        "Residual",
    }
    if not required_effects.issubset(table.index):
        raise AnalysisError("two-way ANOVA did not produce all requested effects")

    effects = []
    for name, row in table.iterrows():
        sum_squares = float(row["sum_sq"])
        degrees_of_freedom = float(row["df"])
        if not isfinite(sum_squares) or not isfinite(degrees_of_freedom):
            raise AnalysisError("two-way ANOVA produced a non-finite result")

        is_residual = name == "Residual"
        f_statistic = None if is_residual else float(row["F"])
        p_value = None if is_residual else float(row["PR(>F)"])
        if not is_residual and (
            not isfinite(f_statistic) or not isfinite(p_value)
        ):
            raise AnalysisError("two-way ANOVA produced a non-finite result")

        effects.append(
            {
                "effect": str(name),
                "sum_squares": sum_squares,
                "degrees_of_freedom": degrees_of_freedom,
                "f_statistic": f_statistic,
                "p_value": p_value,
            }
        )
    return {
        "effects": effects,
        "r_squared": float(model.rsquared),
        "adjusted_r_squared": float(model.rsquared_adj),
        "n": int(frame.shape[0]),
    }


def linear_regression(request: dict[str, Any]) -> dict[str, Any]:
    x, y = _xy(request)
    if x.size < 3:
        raise AnalysisError("linear regression requires at least three observations")
    result = stats.linregress(x, y, alternative=request.get("alternative", "two-sided"))
    fitted = result.intercept + result.slope * x
    return {
        "parameters": {
            "slope": float(result.slope),
            "intercept": float(result.intercept),
        },
        "standard_errors": {
            "slope": float(result.stderr),
            "intercept": float(result.intercept_stderr),
        },
        "r_squared": float(result.rvalue**2),
        "p_value": float(result.pvalue),
        "fitted": fitted.tolist(),
        "residuals": (y - fitted).tolist(),
        "x": x.tolist(),
        "y": y.tolist(),
    }


def _xy(request: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
    raw_x = _column(request, request.get("x_column", "x"))
    raw_y = _column(request, request.get("y_column", "y"))
    if len(raw_x) != len(raw_y):
        raise AnalysisError("x and y columns must have equal length")
    pairs: list[tuple[float, float]] = []
    for x_value, y_value in zip(raw_x, raw_y, strict=True):
        if x_value in (None, "") or y_value in (None, ""):
            continue
        try:
            pair = (float(x_value), float(y_value))
        except (TypeError, ValueError) as exc:
            raise AnalysisError("x or y contains a non-numeric observation") from exc
        if all(isfinite(value) for value in pair):
            pairs.append(pair)
    if not pairs:
        raise AnalysisError("x and y have no complete finite observations")
    values = np.asarray(pairs, dtype=np.float64)
    return values[:, 0], values[:, 1]


@dataclass(frozen=True)
class CurveModel:
    function: Callable[..., np.ndarray]
    parameters: tuple[str, ...]
    initial: Callable[[np.ndarray, np.ndarray], list[float]]
    bounds: tuple[list[float], list[float]]


def _four_pl(x: np.ndarray, bottom: float, top: float, ec50: float, hill: float) -> np.ndarray:
    safe_x = np.maximum(x, np.finfo(float).tiny)
    safe_ec50 = max(ec50, np.finfo(float).tiny)
    return bottom + (top - bottom) / (1 + (safe_ec50 / safe_x) ** hill)


def _five_pl(
    x: np.ndarray,
    bottom: float,
    top: float,
    ec50: float,
    hill: float,
    asymmetry: float,
) -> np.ndarray:
    safe_x = np.maximum(x, np.finfo(float).tiny)
    safe_ec50 = max(ec50, np.finfo(float).tiny)
    return bottom + (top - bottom) / (
        (1 + (safe_ec50 / safe_x) ** hill) ** asymmetry
    )


def _exp_association(x: np.ndarray, baseline: float, plateau: float, rate: float) -> np.ndarray:
    return baseline + (plateau - baseline) * (1 - np.exp(-rate * x))


def _exp_decay(x: np.ndarray, plateau: float, span: float, rate: float) -> np.ndarray:
    return plateau + span * np.exp(-rate * x)


def _michaelis_menten(x: np.ndarray, vmax: float, km: float) -> np.ndarray:
    return vmax * x / (km + x)


def _range_guess(x: np.ndarray, y: np.ndarray) -> tuple[float, float, float]:
    low = float(np.min(y))
    high = float(np.max(y))
    midpoint = float(np.median(x[x > 0])) if np.any(x > 0) else float(np.median(x))
    return low, high, max(midpoint, np.finfo(float).eps)


CURVE_MODELS: dict[str, CurveModel] = {
    "four_pl": CurveModel(
        _four_pl,
        ("bottom", "top", "ec50", "hill_slope"),
        lambda x, y: [*_range_guess(x, y), 1.0],
        ([-np.inf, -np.inf, np.finfo(float).eps, -20], [np.inf, np.inf, np.inf, 20]),
    ),
    "five_pl": CurveModel(
        _five_pl,
        ("bottom", "top", "ec50", "hill_slope", "asymmetry"),
        lambda x, y: [*_range_guess(x, y), 1.0, 1.0],
        (
            [-np.inf, -np.inf, np.finfo(float).eps, -20, 0.01],
            [np.inf, np.inf, np.inf, 20, 100],
        ),
    ),
    "exponential_association": CurveModel(
        _exp_association,
        ("baseline", "plateau", "rate"),
        lambda x, y: [float(y[0]), float(np.max(y)), 1 / max(float(np.ptp(x)), 1)],
        ([-np.inf, -np.inf, 0], [np.inf, np.inf, np.inf]),
    ),
    "exponential_decay": CurveModel(
        _exp_decay,
        ("plateau", "span", "rate"),
        lambda x, y: [
            float(np.min(y)),
            float(np.max(y) - np.min(y)),
            1 / max(float(np.ptp(x)), 1),
        ],
        ([-np.inf, -np.inf, 0], [np.inf, np.inf, np.inf]),
    ),
    "michaelis_menten": CurveModel(
        _michaelis_menten,
        ("vmax", "km"),
        lambda x, y: [float(np.max(y)), max(float(np.median(x)), np.finfo(float).eps)],
        ([0, np.finfo(float).eps], [np.inf, np.inf]),
    ),
}


def curve_fit(request: dict[str, Any]) -> dict[str, Any]:
    from scipy import optimize
    from scipy.optimize import OptimizeWarning

    model_name = str(request.get("model", "four_pl"))
    model = CURVE_MODELS.get(model_name)
    if model is None:
        raise AnalysisError(f"unsupported curve model: {model_name}")
    x, y = _xy(request)
    if x.size <= len(model.parameters):
        raise AnalysisError(
            f"{model_name} requires more observations than fitted parameters"
        )

    initial = request.get("initial")
    if initial is not None and not isinstance(initial, dict):
        raise AnalysisError("initial must be an object keyed by parameter name")
    try:
        p0 = (
            [float(initial[name]) for name in model.parameters]
            if initial is not None
            else model.initial(x, y)
        )
    except KeyError as exc:
        raise AnalysisError(f"initial is missing parameter: {exc.args[0]}") from exc
    except (TypeError, ValueError, OverflowError) as exc:
        raise AnalysisError("initial contains a non-finite numeric value") from exc
    if not all(isfinite(value) for value in p0):
        raise AnalysisError("initial contains a non-finite numeric value")

    try:
        max_evaluations = int(request.get("max_evaluations", 50_000))
    except (TypeError, ValueError, OverflowError) as exc:
        raise AnalysisError("max_evaluations must be a positive integer") from exc
    if max_evaluations < 1:
        raise AnalysisError("max_evaluations must be a positive integer")

    fit_warnings: list[str] = []
    try:
        with warnings.catch_warnings(record=True) as caught_warnings:
            warnings.simplefilter("always", OptimizeWarning)
            parameters, covariance = optimize.curve_fit(
                model.function,
                x,
                y,
                p0=p0,
                bounds=model.bounds,
                method="trf",
                max_nfev=max_evaluations,
            )
        fit_warnings = list(dict.fromkeys(str(item.message) for item in caught_warnings))
    except (RuntimeError, ValueError, FloatingPointError, OverflowError) as exc:
        raise AnalysisError(f"{model_name} did not converge: {exc}") from exc

    fitted = model.function(x, *parameters)
    residuals = y - fitted
    ss_residual = float(np.sum(residuals**2))
    ss_total = float(np.sum((y - np.mean(y)) ** 2))
    standard_errors = np.sqrt(np.diag(covariance))
    parameter_results = {}
    degrees_of_freedom = max(1, x.size - len(parameters))
    critical = stats.t.ppf(0.975, degrees_of_freedom)
    for name, value, standard_error in zip(
        model.parameters, parameters, standard_errors, strict=True
    ):
        parameter_results[name] = {
            "estimate": float(value),
            "standard_error": float(standard_error),
            "confidence_interval_95": [
                float(value - critical * standard_error),
                float(value + critical * standard_error),
            ],
        }

    order = np.argsort(x)
    curve_x = np.linspace(float(np.min(x)), float(np.max(x)), 240)
    return {
        "warnings": fit_warnings,
        "model": model_name,
        "parameters": parameter_results,
        "degrees_of_freedom": degrees_of_freedom,
        "r_squared": 1 - ss_residual / ss_total if ss_total > 0 else None,
        "sum_squared_residuals": ss_residual,
        "root_mean_squared_error": float(np.sqrt(ss_residual / degrees_of_freedom)),
        "x": x[order].tolist(),
        "y": y[order].tolist(),
        "fitted": fitted[order].tolist(),
        "residuals": residuals[order].tolist(),
        "curve": {
            "x": curve_x.tolist(),
            "y": model.function(curve_x, *parameters).tolist(),
        },
    }


RUNNERS: dict[str, Callable[[dict[str, Any]], dict[str, Any]]] = {
    "descriptive": descriptive,
    "t_test": t_test,
    "one_way_anova": one_way_anova,
    "two_way_anova": two_way_anova,
    "linear_regression": linear_regression,
    "curve_fit": curve_fit,
}


def run_analysis(request: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(request, dict):
        raise AnalysisError("analysis request must be a JSON object")
    kind = request.get("kind")
    if not isinstance(kind, str) or kind not in RUNNERS:
        raise AnalysisError(f"unsupported analysis kind: {kind!r}")
    result = RUNNERS[kind](request)
    return _serializable(
        {
            "kind": kind,
            "diagnostics": {
                "engine": "biota-analysis-engine",
                "engine_version": ENGINE_VERSION,
                "numeric_precision": "float64",
            },
            "warnings": [],
            **result,
        }
    )
