from __future__ import annotations

import json
import math
import subprocess
import sys
import unittest

import numpy as np

from biota_analysis import AnalysisError, run_analysis


class AnalysisEngineTests(unittest.TestCase):
    def test_descriptive_statistics_ignore_missing_values(self) -> None:
        result = run_analysis(
            {
                "kind": "descriptive",
                "columns": {"value": [1, 2, None, "", 3, 4]},
            }
        )
        self.assertEqual(result["n"], 4)
        self.assertAlmostEqual(result["mean"], 2.5)
        self.assertAlmostEqual(result["standard_deviation"], math.sqrt(5 / 3))

    def test_unpaired_t_test(self) -> None:
        result = run_analysis(
            {
                "kind": "t_test",
                "columns": {
                    "left": [10, 11, 12, 13, 14],
                    "right": [1, 2, 3, 4, 5],
                },
            }
        )
        self.assertLess(result["p_value"], 0.001)
        self.assertAlmostEqual(result["mean_difference"], 9)

    def test_one_way_anova_and_tukey(self) -> None:
        result = run_analysis(
            {
                "kind": "one_way_anova",
                "columns": {
                    "group": ["a"] * 4 + ["b"] * 4 + ["c"] * 4,
                    "value": [1, 1.1, 1.2, 1.3, 5, 5.1, 5.2, 5.3, 9, 9.1, 9.2, 9.3],
                },
            }
        )
        self.assertLess(result["p_value"], 1e-8)
        self.assertEqual(len(result["tukey_hsd"]), 3)
        self.assertIsInstance(result["tukey_hsd"][0]["reject"], bool)

    def test_two_way_anova_reports_main_and_interaction_effects(self) -> None:
        result = run_analysis(
            {
                "kind": "two_way_anova",
                "columns": {
                    "factor_a": ["a"] * 6 + ["b"] * 6,
                    "factor_b": ["x", "x", "x", "y", "y", "y"] * 2,
                    "value": [1, 2, 3, 3, 4, 5, 2, 3, 4, 8, 9, 10],
                },
            }
        )

        effects = {effect["effect"]: effect for effect in result["effects"]}
        self.assertEqual(result["n"], 12)
        self.assertEqual(
            set(effects),
            {
                "C(factor_a)",
                "C(factor_b)",
                "C(factor_a):C(factor_b)",
                "Residual",
            },
        )
        self.assertAlmostEqual(effects["C(factor_a)"]["sum_squares"], 27)
        self.assertAlmostEqual(effects["C(factor_b)"]["sum_squares"], 48)
        self.assertAlmostEqual(
            effects["C(factor_a):C(factor_b)"]["sum_squares"], 12
        )
        self.assertAlmostEqual(effects["Residual"]["sum_squares"], 8)
        self.assertAlmostEqual(effects["C(factor_a)"]["f_statistic"], 27)
        self.assertAlmostEqual(effects["C(factor_b)"]["f_statistic"], 48)
        self.assertAlmostEqual(
            effects["C(factor_a):C(factor_b)"]["f_statistic"], 12
        )

    def test_two_way_anova_rejects_an_unestimable_interaction(self) -> None:
        with self.assertRaisesRegex(AnalysisError, "every factor combination"):
            run_analysis(
                {
                    "kind": "two_way_anova",
                    "columns": {
                        "factor_a": ["a", "a", "a", "a", "b", "b"],
                        "factor_b": ["x", "x", "y", "y", "x", "x"],
                        "value": [1, 2, 3, 4, 5, 6],
                    },
                }
            )

    def test_linear_regression(self) -> None:
        result = run_analysis(
            {
                "kind": "linear_regression",
                "columns": {"x": [0, 1, 2, 3], "y": [1, 3, 5, 7]},
            }
        )
        self.assertAlmostEqual(result["parameters"]["slope"], 2)
        self.assertAlmostEqual(result["parameters"]["intercept"], 1)
        self.assertAlmostEqual(result["r_squared"], 1)

    def test_four_parameter_logistic_fit(self) -> None:
        x = np.geomspace(0.01, 100, 24)
        y = 0.5 + (9.5 / (1 + (2.0 / x) ** 1.3))
        result = run_analysis(
            {
                "kind": "curve_fit",
                "model": "four_pl",
                "columns": {"x": x.tolist(), "y": y.tolist()},
            }
        )
        self.assertAlmostEqual(result["parameters"]["bottom"]["estimate"], 0.5, places=3)
        self.assertAlmostEqual(result["parameters"]["top"]["estimate"], 10, places=3)
        self.assertAlmostEqual(result["parameters"]["ec50"]["estimate"], 2, places=3)
        self.assertAlmostEqual(
            result["parameters"]["hill_slope"]["estimate"], 1.3, places=3
        )

    def test_curve_fit_non_convergence_is_a_structured_analysis_error(self) -> None:
        with self.assertRaisesRegex(AnalysisError, "four_pl did not converge"):
            run_analysis(
                {
                    "kind": "curve_fit",
                    "model": "four_pl",
                    "max_evaluations": 1,
                    "columns": {
                        "x": [0.1, 0.3, 1, 3, 10, 30],
                        "y": [0.1, 0.4, 1.5, 4, 8, 9],
                    },
                }
            )

    def test_structured_error_for_unknown_analysis(self) -> None:
        with self.assertRaises(AnalysisError):
            run_analysis({"kind": "not-real", "columns": {}})

    def test_cli_emits_json_envelopes_for_success_and_failure(self) -> None:
        success = subprocess.run(
            [sys.executable, "-m", "biota_analysis"],
            input=json.dumps(
                {
                    "kind": "descriptive",
                    "columns": {"value": [1, 2, None, 3]},
                }
            ),
            text=True,
            capture_output=True,
            check=False,
        )
        success_payload = json.loads(success.stdout)
        self.assertEqual(success.returncode, 0)
        self.assertEqual(success.stderr, "")
        self.assertIs(success_payload["ok"], True)
        self.assertEqual(success_payload["result"]["n"], 3)
        self.assertNotIn("error", success_payload)

        failure = subprocess.run(
            [sys.executable, "-m", "biota_analysis"],
            input=json.dumps({"kind": "not-real", "columns": {}}),
            text=True,
            capture_output=True,
            check=False,
        )
        failure_payload = json.loads(failure.stdout)
        self.assertEqual(failure.returncode, 2)
        self.assertEqual(failure.stderr, "")
        self.assertIs(failure_payload["ok"], False)
        self.assertEqual(failure_payload["error"]["type"], "AnalysisError")
        self.assertNotIn("result", failure_payload)


if __name__ == "__main__":
    unittest.main()
