import { describe, expect, test } from "vitest";
import {
  derivePlanningDateRange,
  normalizePlanningDateInput,
  normalizePlanningDateRange,
} from "./index";

describe("planning date helpers", () => {
  test("normalizes day-level date input", () => {
    expect(normalizePlanningDateInput("2026-04-06")).toBe("2026-04-06");
    expect(normalizePlanningDateInput("2026-02-31")).toBeNull();
    expect(normalizePlanningDateInput("04/06/2026")).toBeNull();
    expect(normalizePlanningDateInput("")).toBeNull();
  });

  test("clamps inverted date ranges to a single start day", () => {
    expect(normalizePlanningDateRange("2026-04-10", "2026-04-06")).toEqual({
      startDate: "2026-04-10",
      endDate: "2026-04-10",
    });
  });

  test("uses explicit one-sided dates as single-day ranges", () => {
    expect(derivePlanningDateRange("2026-04-06", null, [])).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-06",
      source: "explicit",
    });
  });

  test("derives blank parent ranges from child ranges", () => {
    expect(
      derivePlanningDateRange(null, null, [
        { startDate: "2026-04-08", endDate: "2026-04-09" },
        { startDate: "2026-04-01", endDate: "2026-04-03" },
      ]),
    ).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-09",
      source: "derived",
    });
  });
});
