# Biota

Biota is a local-first scientific workspace for molecular biology. It combines
an electronic lab notebook, linked Markdown notes, experiment planning, DNA
design, and reproducible data analysis in one macOS desktop application.

## Local-first model

A Biota workspace is a folder chosen by the user. The folder is the source of
truth and remains readable without Biota:

- Markdown stores notes, experiments, protocols, projects, entities, and
  analyses.
- GenBank and FASTA store biological sequences.
- CSV stores tabular experimental data.
- Ordinary files store images and other attachments.
- `.biota/history` stores content-addressed local revisions and finalization
  manifests.

The desktop application maintains a rebuildable search and relationship index
in application data. Deleting the index never deletes scientific records.
There is no account, cloud database, telemetry, or automatic upload.

## Repository layout

- `apps/desktop`: Tauri 2, React, and Vite desktop application
- `apps/web`: legacy Next.js prototype retained during the desktop migration
- `packages/vault`: canonical Markdown record and task contracts
- `packages/bio`: sequence models, editing, restriction, PCR, and assembly tools
- `packages/analysis-engine`: bundled Python statistics and curve-fitting engine
- `packages/ui`, `packages/editor`, `packages/shared`: shared application code

## Development

Prerequisites:

- Node.js 22 or newer
- Rust stable
- Xcode command-line tools on macOS
- Python 3.12 for developing the analysis sidecar

Install JavaScript dependencies and start the desktop UI:

```bash
npm install
npm run desktop:dev
```

The notebook provides source, split, and live-preview modes. Live preview is
directly editable: prose changes update the same Markdown source, task
checkboxes update their Markdown metadata, and table cells write back to the
pipe table. YAML frontmatter and inactive markup are visually collapsed, never
removed or reserialized.

Run the validation suite:

```bash
npm run desktop:check
npm run test
```

Build the macOS application:

```bash
npm run desktop:build
```

The packaged analysis executable is built automatically. If no Apple
certificate is configured, the build uses a verifiable ad-hoc signature for
local testing; public distribution still requires a Developer ID signature
and notarization. On first analysis, the sidecar unpacks its version-pinned
scientific runtime into a content-addressed macOS user cache; later runs reuse
that local runtime.

The analysis engine has its own isolated environment:

```bash
cd packages/analysis-engine
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
.venv/bin/python -m unittest discover -s tests
```

## Legacy prototype import

The one-time importer reads the old demo entry, protocol, and entity JSON
without modifying it. It intentionally skips the disposable planning boards.
Preview the migration first:

```bash
node scripts/migrate-legacy-vault.mjs \
  --source /path/to/legacy/.local \
  --target /path/to/BiotaVault
```

Repeat with `--write` after reviewing the JSON report. Existing destination
files are skipped rather than overwritten.

## Current delivery boundary

The repository contains a functional local-first desktop foundation and
vertical slices for the notebook, planning, sequence studio, and local
analysis engine. SnapGene-level cloning breadth, AB1/alignment workflows,
Prism-level analysis artifact persistence and stale-result handling, and
signed/notarized distribution remain later release work. The legacy web
prototype stays in `apps/web` until desktop migration acceptance is complete.

## Record contract

Biota records use standard Markdown and YAML frontmatter:

```markdown
---
biota_id: 01K...
biota_type: experiment
biota_schema: 1
title: Dose-response pilot
status: planned
created: 2026-07-27T15:00:00-05:00
modified: 2026-07-27T15:00:00-05:00
project: "[[Projects/Receptor screen]]"
---

# Dose-response pilot

- [ ] Run transfection [[Entities/pReporter]]
<!-- biota-task id=01K... state=scheduled due=2026-08-02 -->
```

Unknown frontmatter fields and ordinary Markdown remain user-owned. Biota
indexes them without requiring a proprietary database representation.
