from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from biota_analysis.engine import ENGINE_VERSION, AnalysisError, run_analysis


def _read_request(path: str | None) -> dict[str, Any]:
    if path:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    return json.load(sys.stdin)


def _write_response(path: str | None, response: dict[str, Any]) -> None:
    payload = json.dumps(response, indent=2, allow_nan=False)
    if path:
        Path(path).write_text(f"{payload}\n", encoding="utf-8")
    else:
        sys.stdout.write(f"{payload}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Biota analysis request")
    parser.add_argument("--request", help="JSON request path; defaults to stdin")
    parser.add_argument("--output", help="JSON result path; defaults to stdout")
    args = parser.parse_args()

    try:
        request = _read_request(args.request)
        result = run_analysis(request)
        response = {
            "ok": True,
            "engine_version": ENGINE_VERSION,
            "result": result,
        }
        exit_code = 0
    except (AnalysisError, ValueError, TypeError, json.JSONDecodeError) as exc:
        response = {
            "ok": False,
            "engine_version": ENGINE_VERSION,
            "error": {
                "type": exc.__class__.__name__,
                "message": str(exc),
            },
        }
        exit_code = 2

    _write_response(args.output, response)
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
