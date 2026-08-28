# Biota implementation progress

## Current direction

Biota is now being developed as a single-user, Apple-silicon macOS desktop
application. The user-selected vault is authoritative; the old Next.js,
NextAuth, Prisma/PostgreSQL, demo-store, and planning implementations remain
only until the desktop migration acceptance tests pass.

## Implemented

### Desktop and vault boundary

- Independent Tauri 2 + React/Vite desktop application under `apps/desktop`.
- Vault create/open/close, persisted selected-vault state, default folders, and
  `.biota/vault.json`.
- Safe vault-relative path normalization, traversal and symlink-escape
  rejection, atomic replacement writes, and optimistic hash conflicts.
- Markdown, binary attachment/sequence, move, scan, watch, and external-change
  commands.
- Rebuildable application-data SQLite index with FTS5, WAL, metadata, tags,
  backlinks, tasks, diagnostics, and incremental external reindexing.
- Content-addressed revisions, checkpoints, restore, hash-chained events,
  finalization manifests, tamper verification, and explicit post-finalization
  revisions.
- One-time dry-run-first importer for legacy entry/protocol/entity JSON. Source
  files are untouched and old planning boards are intentionally skipped.

### ELN and linked notes

- Canonical record/task/wikilink/sidecar contracts in `packages/vault`.
- YAML frontmatter round-tripping that preserves unknown user fields and
  unchanged raw YAML.
- Physical vault navigator, tabs, quick switcher, templates, recent records,
  source Markdown, source-preserving CodeMirror live preview, sanitized split
  preview, clickable wikilinks, backlinks, search, and relationship graph.
- Live preview directly edits prose and tables, exposes interactive task
  checkboxes, collapses YAML behind a Properties control, and reveals exact
  Markdown syntax on the active line without reserializing the file.
- Clean external edits reload automatically; dirty edits open a base/local/
  external conflict comparison before either version may replace the other.
- Experiment lifecycle actions operate on the same Markdown file:
  `planned -> active -> complete -> finalized`, with an explicit active
  revision required after finalization.
- Finalization captures referenced data/sequence/attachment files plus linked
  protocol and entity revisions.

### Markdown-native planning

- Inbox, Today, Kanban, dynamic weekly calendar, and rolling 14-day timeline
  derived from tasks in any Markdown file.
- Checkbox toggles and drag/drop states atomically update the source Markdown.
- Start/due dates, priority, waiting/done states, record links, and task
  backlinks use the shared stable task syntax.

### DNA foundation

- DNA/RNA/protein records, topology, compound/origin-spanning locations,
  qualifiers, primers, translations, and immutable operation provenance.
- Zero-based half-open internal coordinates with tested GenBank conversion.
- TeselaGen-backed SnapGene `.dna`, GenBank, FASTA, and AB1 import adapter;
  GenBank/FASTA export; imported binary originals can be retained unchanged.
- Coordinate-safe insertion/deletion/reverse-complement/origin rotation,
  restriction search, PCR simulation, Gibson, and Golden Gate foundations.
- Desktop sequence workspace with synchronized circular map, sequence, feature,
  enzyme, selection, history, import, and GenBank save flows.

### Local analysis foundation

- Versioned Python sidecar with structured JSON input/output and no network
  dependency.
- Descriptive statistics, paired/unpaired t-tests, one/two-way ANOVA and
  multiple comparisons, linear regression, 4PL/5PL, exponential, and
  Michaelis-Menten fits with confidence intervals, residuals, convergence
  diagnostics, and structured failures.
- Ad-hoc-signed arm64 launcher containing a deterministic runtime that is
  extracted once to a hash-addressed user cache and reused by later
  calculations.
- CSV/TSV loading, robust numeric inference, real sidecar execution, parameter
  estimates, confidence intervals, diagnostics, and fitted-curve display in
  the desktop analysis workspace.

## Verified

- Consolidated desktop check: 79 automated tests pass across the vault,
  biology, frontend, Rust core, analysis engine, and legacy importer; TypeScript
  checks, the production Vite build, Rust clippy, Rust formatting, and source
  formatting checks also pass.
- Vault package: frontmatter, links, tasks, sidecars, search, IDs, statuses, and
  timestamp/URL sidecar-classification regression coverage.
- Rust core: Unicode paths/content, malformed YAML, duplicate IDs, repaired
  diagnostics, index rebuild deletion/recreation, external changes, symlink
  escapes, simulated interrupted writes, revisions, finalization, restores,
  tamper detection, and exact binary round trips.
- Biology package: origin-spanning GenBank features, import/export/import,
  coordinate edits, restriction/PCR/Gibson/Golden Gate behavior.
- Analysis engine: successful and failed statistical/model requests plus frozen
  launcher behavior.
- Desktop frontend: exact-source Markdown live editing, block-widget runtime
  coverage, stable pointer/caret geometry, rendering/sanitization, planning
  helpers, CSV parsing, production builds, and visual interaction checks at
  1440 x 900.
- Legacy migration: dry run, write mode, canonical vault manifest, ULIDs,
  statuses, sequence sidecars, and source preservation.
- Packaging: the final HFS+ DMG checksum verifies, both embedded executables
  are native arm64, the app's deep ad-hoc code signature verifies, and the
  packaged Tauri app remains healthy in a native smoke launch. Gatekeeper
  distribution still requires Developer ID signing and notarization.

## Remaining release work

- Complete feature/primer editing dialogs, enzyme sets, undo/redo UI, cloning
  command UI, derived construct/entity-note creation, and full fixture corpora.
- Add chromatograms, reference alignment, mutation calling, multi-sequence
  alignment, and verification reports.
- Persist human-readable analysis specifications, dataset schema sidecars,
  hashes, outputs, stale state, deterministic reruns, Vega-Lite export, and the
  rest of the Prism-style table/plot UI.
- Run the full 10,000-note, 1 MB note, 100 kb sequence, and 100,000-row dataset
  performance suite and optimize based on measured bottlenecks.
- Configure an Apple Developer identity and notarization credentials, then
  produce the signed/notarized release DMG.
- Execute desktop migration acceptance against real legacy data, then remove
  the web/auth/database/demo/planner paths without broad worktree restoration.

## Decisions

- Vault files, not SQLite, are the source of truth.
- Stable IDs determine record identity; paths may change.
- Markdown remains readable in Obsidian and ordinary editors.
- Finalization provides research-grade hashes and tamper evidence, not a
  regulated-compliance claim.
- No accounts, collaboration, telemetry, automatic transfer, or implicit
  network calls.
- Proprietary SnapGene assets, branding, text, and source code are excluded.
