import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { migrateLegacyVault } from "./migrate-legacy-vault.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "biota-migration-"));
  const source = path.join(root, "source");
  const target = path.join(root, "vault");
  await mkdir(source, { recursive: true });
  await writeFile(
    path.join(source, "demo-notebook.json"),
    JSON.stringify({
      entries: [
        {
          id: "entry-1",
          title: "Assay entry",
          status: "DRAFT",
          updatedAt: "2026-07-27T00:00:00Z",
          blocks: [
            { id: "text", type: "text", text: "Observed a strong response." },
            { id: "protocol", type: "protocol", protocolId: "protocol-1" },
          ],
        },
      ],
      protocols: [
        {
          id: "protocol-1",
          title: "Cell assay",
          status: "ACTIVE",
          updatedAt: "2026-07-26T00:00:00Z",
          bodyText: "1. Plate cells.",
        },
      ],
      planningWhiteboards: [{ id: "discard-me" }],
    })
  );
  await writeFile(
    path.join(source, "demo-entities.json"),
    JSON.stringify({
      entities: [
        {
          id: "entity-1",
          name: "pTest",
          sequence: "ATGCGT",
          topology: "circular",
          status: "DRAFT",
          features: [
            {
              name: "CDS",
              type: "CDS",
              start: 1,
              end: 6,
              strand: 1,
            },
          ],
        },
      ],
    })
  );
  return { source, target };
}

test("dry run reports records without writing", async () => {
  const { source, target } = await fixture();
  const report = await migrateLegacyVault({ source, target });
  assert.equal(report.dryRun, true);
  assert.equal(report.candidates.length, 4);
  assert.equal(report.planningRecordsSkipped, 1);
});

test("write migration creates portable records and skips planning", async () => {
  const { source, target } = await fixture();
  const report = await migrateLegacyVault({
    source,
    target,
    write: true,
    now: "2026-07-27T00:00:00Z",
  });
  assert.equal(report.written.length, 4);
  const entry = await readFile(
    path.join(target, "Experiments", "Assay entry.md"),
    "utf8"
  );
  const entity = await readFile(
    path.join(target, "Entities", "pTest.md"),
    "utf8"
  );
  const sequence = await readFile(
    path.join(target, "Sequences", "pTest.gb"),
    "utf8"
  );
  const manifest = JSON.parse(
    await readFile(path.join(target, ".biota", "vault.json"), "utf8")
  );
  assert.match(entry, /biota_type: experiment/);
  assert.match(entry, /biota_id: "[0-7][0-9A-HJKMNP-TV-Z]{25}"/);
  assert.match(entry, /status: planned/);
  assert.match(entry, /\[\[Protocols\/Cell assay\]\]/);
  assert.match(entity, /sequence: "\[\[Sequences\/pTest.gb\]\]"/);
  assert.match(sequence, /LOCUS/);
  assert.match(sequence, /circular/);
  assert.equal(manifest.schema, 1);
  assert.equal(typeof manifest.vault_id, "string");
  assert.equal(manifest.id, undefined);
  assert.equal(entry.includes("discard-me"), false);
});
