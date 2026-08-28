import type {
  BiotaTask,
  HistoryRevision,
  RecordDocument,
  SearchHit,
  VaultFile,
  VaultInfo,
} from "@/types";
import {
  extractTasks,
  inferRecordType,
  titleFromDocument,
} from "@/lib/records";

const now = "2026-07-27T15:42:00-05:00";

export const demoVault: VaultInfo = {
  id: "demo-vault",
  name: "Liminal Lab",
  path: "/Users/researcher/Documents/Liminal Lab",
  schema: 1,
  createdAt: "2026-07-14T09:30:00-05:00",
};

const records = new Map<string, RecordDocument>();
const textAssets = new Map<string, string>([
  [
    "Data/BX-17 dose response.csv",
    `concentration_nM,replicate,fluorescence
0.01,1,4.2
0.01,2,5.1
0.01,3,4.7
0.03,1,5.4
0.03,2,4.9
0.03,3,5.7
0.1,1,7.1
0.1,2,6.6
0.1,3,7.8
0.3,1,11.8
0.3,2,12.4
0.3,3,10.9
1,1,22.3
1,2,20.8
1,3,23.1
3,1,43.6
3,2,46.1
3,3,44.7
10,1,70.2
10,2,73.4
10,3,71.8
30,1,87.1
30,2,85.8
30,3,88.4
100,1,94.5
100,2,95.2
100,3,93.8
300,1,97.2
300,2,96.4
300,3,97.8
`,
  ],
  [
    "Data/Sheets/01K1VSR8KX2A42HYFW47677DJJ/Dose-response calculations.csv",
    `Dose (nM),Replicate 1,Replicate 2,Replicate 3,Mean
0.1,7.1,6.6,7.8,7.1667
1,22.3,20.8,23.1,22.0667
10,70.2,73.4,71.8,71.8
100,94.5,95.2,93.8,94.5
`,
  ],
  [
    "Data/Sheets/01K1VSR8KX2A42HYFW47677DJJ/Dose-response calculations.sheet.yaml",
    `biota_sheet_schema: 1
sheet_id: "01K1VSR8KX2A42HYFW47677DJJ"
title: "Dose-response calculations"
modified: "2026-07-28T10:00:00-05:00"
calculation:
  engine: "univer"
  engine_version: "0.25.1"
  mode: "automatic"
  locale: "en-US"
formulas:
  E2: "=AVERAGE(B2:D2)"
  E3: "=AVERAGE(B3:D3)"
  E4: "=AVERAGE(B4:D4)"
  E5: "=AVERAGE(B5:D5)"
workbook: {}
`,
  ],
]);
const textAssetHashes = new Map<string, string>();

function mockHash(content: string) {
  return `sha256:mock${Math.abs(
    Array.from(content).reduce(
      (value, character) => (value * 31 + character.charCodeAt(0)) | 0,
      7
    )
  ).toString(16)}`;
}

function seed(path: string, content: string, hash: string) {
  records.set(path, {
    path,
    content,
    hash,
    modifiedAt: now,
    biotaId: /biota_id:\s*(.+)/.exec(content)?.[1],
    recordType: inferRecordType(path, content),
    title: titleFromDocument(path, content),
    finalized: /status:\s*finalized/.test(content),
  });
}

seed(
  "Experiments/Dose-response pilot.md",
  `---
biota_id: 01K0EXPERIMENT42
biota_type: experiment
biota_schema: 1
title: Dose-response pilot
status: active
created: 2026-07-24T09:15:00-05:00
modified: 2026-07-27T15:42:00-05:00
project: "[[Projects/Receptor screen]]"
protocols:
  - "[[Protocols/Transient transfection]]"
entities:
  - "[[Entities/pLenti-CMV-GFP]]"
tags:
  - assay
  - receptor
---

# Dose-response pilot

> **Objective** — Establish a working concentration range for compound BX-17 before the full receptor screen.

## Plan

- [x] Seed HEK293T cells in 96-well plate
  <!-- biota-task id=01KSEEDCELLS state=done start=2026-07-25 due=2026-07-25 priority=high -->
- [x] Transfect with [[Entities/pLenti-CMV-GFP]]
  <!-- biota-task id=01KTRANSFECT state=done start=2026-07-26 due=2026-07-26 priority=high -->
- [ ] Prepare 10-point dilution series
  <!-- biota-task id=01KDILUTION state=scheduled start=2026-07-28 due=2026-07-28 priority=high -->
- [ ] Analyze fluorescence and fit 4PL curve
  <!-- biota-task id=01KANALYZE state=scheduled start=2026-07-29 due=2026-07-30 priority=normal -->

## Conditions

| Variable | Value |
| --- | --- |
| Cell line | HEK293T |
| Plate | 96-well, black wall |
| Replicates | 3 |
| Readout | GFP fluorescence |

## Plate calculations

\`\`\`biota-sheet
id: 01K1VSR8KX2A42HYFW47677DJJ
title: "Dose-response calculations"
data: Data/Sheets/01K1VSR8KX2A42HYFW47677DJJ/Dose-response calculations.csv
schema: Data/Sheets/01K1VSR8KX2A42HYFW47677DJJ/Dose-response calculations.sheet.yaml
\`\`\`

## Observations

Cells reached approximately 70% confluency at transfection. Edge wells were filled with PBS to limit evaporation. No visible toxicity at 18 hours.

## Results

Raw measurements will be stored in [[Data/BX-17 dose response.csv]] and analyzed in [[Analyses/BX-17 4PL fit]].
`,
  "sha256:8db4a0f62"
);

seed(
  "Protocols/Transient transfection.md",
  `---
biota_id: 01K0PROTOCOL77
biota_type: protocol
biota_schema: 1
title: Transient transfection
created: 2026-07-14T10:00:00-05:00
modified: 2026-07-23T16:20:00-05:00
tags:
  - cell-culture
  - transfection
---

# Transient transfection

## Materials

- HEK293T cells
- Opti-MEM
- Transfection reagent
- Purified plasmid DNA

## Procedure

1. Dilute **100 ng DNA** in 10 µL Opti-MEM per well.
2. Add transfection reagent at a 3:1 reagent:DNA ratio.
3. Incubate complexes for 15 minutes at room temperature.
4. Add dropwise to cells and return plate to 37 °C.

Used by [[Experiments/Dose-response pilot]].
`,
  "sha256:ab329fc12"
);

seed(
  "Projects/Receptor screen.md",
  `---
biota_id: 01K0PROJECT21
biota_type: project
biota_schema: 1
title: Receptor screen
created: 2026-07-15T08:00:00-05:00
modified: 2026-07-27T11:30:00-05:00
---

# Receptor screen

## Goal

Identify potent modulators of the orphan receptor panel.

## Active experiments

- [[Experiments/Dose-response pilot]]

## Next

- [ ] Review pilot curve with Maya
  <!-- biota-task id=01KREVIEWCURVE state=inbox due=2026-07-31 priority=normal -->
- [ ] Order follow-up compound plate
  <!-- biota-task id=01KORDERPLATE state=waiting priority=low -->
`,
  "sha256:50c9aa452"
);

seed(
  "Entities/pLenti-CMV-GFP.md",
  `---
biota_id: 01K0ENTITY19
biota_type: entity
biota_schema: 1
title: pLenti-CMV-GFP
created: 2026-07-17T14:30:00-05:00
modified: 2026-07-26T13:20:00-05:00
sequence: "[[Sequences/pLenti-CMV-GFP.gb]]"
aliases:
  - pLCG
---

# pLenti-CMV-GFP

Third-generation lentiviral transfer vector used in [[Experiments/Dose-response pilot]].

## Identity

- **Length:** 7,412 bp
- **Topology:** Circular
- **Resistance:** Ampicillin
`,
  "sha256:ff21bc778"
);

seed(
  "Daily Notes/2026-07-27.md",
  `---
biota_id: 01K0DAILY727
biota_type: daily
biota_schema: 1
title: 2026-07-27
created: 2026-07-27T08:12:00-05:00
modified: 2026-07-27T15:35:00-05:00
---

# Sunday, July 27

## Focus

- [ ] Check plate reader calibration
  <!-- biota-task id=01KCALIBRATE state=inbox due=2026-07-27 priority=high -->
- [ ] Update lab meeting slides
  <!-- biota-task id=01KSLIDES state=scheduled start=2026-07-27 due=2026-07-27 priority=normal -->

## Notes

Pilot plate looks clean. Continue with [[Experiments/Dose-response pilot]] tomorrow morning.
`,
  "sha256:ce38b201d"
);

seed(
  "Analyses/BX-17 4PL fit.md",
  `---
biota_id: 01K0ANALYSIS4
biota_type: analysis
biota_schema: 1
title: BX-17 4PL fit
created: 2026-07-27T14:10:00-05:00
modified: 2026-07-27T14:10:00-05:00
---

# BX-17 4PL fit

Input: [[Data/BX-17 dose response.csv]]

\`\`\`biota-analysis
model: four_parameter_logistic
inputs:
  - Data/BX-17 dose response.csv
x: concentration_nM
y: fluorescence
group: replicate
confidence: 0.95
\`\`\`
`,
  "sha256:1fba9001e"
);

export function mockFiles(): VaultFile[] {
  const recordFiles = Array.from(records.values()).map((record) => ({
    name: record.path.split("/").at(-1) ?? record.path,
    path: record.path,
    kind: "file" as const,
    recordType: record.recordType,
    modifiedAt: record.modifiedAt,
    size: record.content.length,
  }));
  const assetFiles = Array.from(textAssets.entries()).map(
    ([path, content]) => ({
      name: path.split("/").at(-1) ?? path,
      path,
      kind: "file" as const,
      modifiedAt: now,
      size: content.length,
    })
  );

  return [
    ...recordFiles,
    ...assetFiles,
    {
      name: "pLenti-CMV-GFP.gb",
      path: "Sequences/pLenti-CMV-GFP.gb",
      kind: "file",
      modifiedAt: now,
      size: 9_842,
    },
    {
      name: "microscopy",
      path: "Attachments/microscopy",
      kind: "directory",
    },
  ];
}

export function getMockRecord(path: string) {
  const record = records.get(path);
  if (!record) throw new Error(`Record not found: ${path}`);
  return structuredClone(record);
}

export function getMockTextAsset(path: string) {
  const record = records.get(path);
  if (record) return record.content;
  const content = textAssets.get(path);
  if (content === undefined) throw new Error(`Text file not found: ${path}`);
  return content;
}

export function getMockTextAssetSnapshot(path: string) {
  const content = getMockTextAsset(path);
  return {
    relativePath: path,
    content,
    contentHash: textAssetHashes.get(path) ?? mockHash(content),
  };
}

export function writeMockTextAsset(
  path: string,
  content: string,
  expectedHash?: string
) {
  const current = textAssets.get(path);
  const currentHash =
    current === undefined
      ? undefined
      : (textAssetHashes.get(path) ?? mockHash(current));
  if (expectedHash && currentHash && expectedHash !== currentHash) {
    throw new Error("CONFLICT: The file changed outside Biota.");
  }

  const hash = mockHash(content);
  textAssets.set(path, content);
  textAssetHashes.set(path, hash);
  return {
    path,
    hash,
    modifiedAt: new Date().toISOString(),
  };
}

export function writeMockRecord(
  path: string,
  content: string,
  expectedHash?: string
): RecordDocument {
  const current = records.get(path);
  if (current && expectedHash && current.hash !== expectedHash) {
    throw new Error("CONFLICT: The file changed outside Biota.");
  }

  const hash = mockHash(content);
  const next: RecordDocument = {
    path,
    content,
    hash,
    modifiedAt: new Date().toISOString(),
    biotaId: /biota_id:\s*(.+)/.exec(content)?.[1],
    recordType: inferRecordType(path, content),
    title: titleFromDocument(path, content),
    finalized: /status:\s*finalized/.test(content),
  };
  records.set(path, next);
  return structuredClone(next);
}

export function mockSearch(query: string) {
  const normalized = query.trim().toLowerCase();
  const hits: SearchHit[] = [];
  const tasks: BiotaTask[] = [];

  records.forEach((record) => {
    const title =
      record.title ?? titleFromDocument(record.path, record.content);
    if (
      !normalized ||
      title.toLowerCase().includes(normalized) ||
      record.content.toLowerCase().includes(normalized)
    ) {
      const matchIndex = normalized
        ? record.content.toLowerCase().indexOf(normalized)
        : 0;
      hits.push({
        id: record.biotaId ?? record.path,
        path: record.path,
        title,
        recordType:
          record.recordType ?? inferRecordType(record.path, record.content),
        excerpt: record.content
          .slice(
            Math.max(0, matchIndex - 45),
            Math.max(0, matchIndex - 45) + 140
          )
          .replace(/\n+/g, " "),
        score: title.toLowerCase().includes(normalized) ? 1 : 0.7,
      });
    }
    tasks.push(...extractTasks(record.content, record.path, title));
  });

  return { hits, tasks };
}

export function mockHistory(path: string): HistoryRevision[] {
  const document = records.get(path);
  return [
    {
      id: "revision-current",
      hash: document?.hash ?? "sha256:unknown",
      createdAt: document?.modifiedAt ?? now,
      label: "Current working revision",
      kind: "autosave",
      size: document?.content.length,
    },
    {
      id: "revision-checkpoint",
      hash: "sha256:792faabb1",
      createdAt: "2026-07-26T17:18:00-05:00",
      label: "After transfection",
      kind: "checkpoint",
      size: Math.max(0, (document?.content.length ?? 400) - 76),
    },
    {
      id: "revision-initial",
      hash: "sha256:146ce980f",
      createdAt: "2026-07-24T09:15:00-05:00",
      label: "Created",
      kind: "checkpoint",
      size: 282,
    },
  ];
}
