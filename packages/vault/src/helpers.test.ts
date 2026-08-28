import { describe, expect, test } from "vitest";
import {
  allowedExperimentTransitions,
  assertExperimentStatusTransition,
  canTransitionExperimentStatus,
  createBiotaId,
  createRecordFilename,
  defaultRecordPath,
  ensureMarkdownExtension,
  isBiotaId,
  sanitizeFilename,
} from "./index";

describe("stable IDs", () => {
  test("creates deterministic, sortable ULIDs with an injectable random source", () => {
    const first = createBiotaId({ timestamp: 1_000, random: () => 0 });
    const second = createBiotaId({ timestamp: 2_000, random: () => 0 });

    expect(first).toHaveLength(26);
    expect(isBiotaId(first)).toBe(true);
    expect(first < second).toBe(true);
    expect(createBiotaId({ timestamp: 1_000, random: () => 0 })).toBe(first);
    expect(isBiotaId("not-an-id")).toBe(false);
  });

  test("rejects invalid timestamps and random sources", () => {
    expect(() => createBiotaId({ timestamp: -1 })).toThrow(RangeError);
    expect(() => createBiotaId({ timestamp: 1_000, random: () => 1 })).toThrow(
      RangeError
    );
  });
});

describe("experiment status transitions", () => {
  test("allows editable workflow reversals but locks finalized experiments", () => {
    expect(allowedExperimentTransitions("planned")).toEqual([
      "active",
      "archived",
    ]);
    expect(canTransitionExperimentStatus("active", "planned")).toBe(true);
    expect(canTransitionExperimentStatus("complete", "finalized")).toBe(true);
    expect(canTransitionExperimentStatus("finalized", "complete")).toBe(false);
    expect(assertExperimentStatusTransition("finalized", "archived")).toBe(
      "archived"
    );
    expect(() =>
      assertExperimentStatusTransition("archived", "active")
    ).toThrow(/cannot transition/);
  });
});

describe("record filenames", () => {
  test("creates safe, readable, Unicode-preserving Markdown filenames", () => {
    expect(sanitizeFilename("  λ screen: pilot / 1?  ")).toBe(
      "λ screen pilot 1"
    );
    expect(sanitizeFilename("CON")).toBe("CON-record");
    expect(ensureMarkdownExtension("Protocol.MD")).toBe("Protocol.MD");
    expect(
      createRecordFilename("Dose response", {
        datePrefix: "2026-07-27",
        idSuffix: "01KABC",
      })
    ).toBe("2026-07-27 Dose response 01KABC.md");
    expect(defaultRecordPath("experiment", "Dose response")).toBe(
      "Experiments/Dose response.md"
    );
    expect(defaultRecordPath("note", "Free note")).toBe("Free note.md");
  });
});
