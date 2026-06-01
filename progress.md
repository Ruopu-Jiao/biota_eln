# Progress

## Completed

- Confirmed the workspace started empty and was not yet a Git repository.
- Finalized the MVP kickoff plan for a web-first molecular biology ELN.
- Confirmed GitHub remote: `git@github.com:Ruopu-Jiao/biota_eln.git`.
- Created the root monorepo scaffold with `apps/web`, shared packages, root tooling, and environment scaffolding.
- Added an IDE-style Next.js application shell with placeholder routes for Entries, Entities, Protocols, Graph, and Settings.
- Added baseline CI, Playwright smoke testing, Prisma package scaffolding, shared package placeholders, and monorepo scripts.
- Verified the foundation with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Initialized the root Git repository on `main`, attached the GitHub remote, and created the initial scaffold commit: `0717fec`.
- Added a dedicated SSH key for this repo context, configured Git to use it, and successfully pushed `main` to GitHub.
- Completed the Wave 2 auth and tenancy foundation: NextAuth credentials auth, registration flow, protected/public route groups, Prisma auth tables, organizations, repositories, folders, and workspace helpers.
- Added authenticated workspace scaffolding to the Settings surface so the current personal workspace and repositories are visible in the UI.
- Re-verified the Wave 2 state with `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, and `npm run prisma:generate --workspace @biota/db`.
- Added a local demo-mode auth fallback so the app can be explored without a configured Postgres database.
- Fixed the sign-in loop by routing demo entry through a host-preserving `/api/demo-login` redirect, ensuring the demo session cookie survives the handoff into the workspace.
- Re-verified the updated auth flow with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Implemented the first entries/protocols feature slice: repository-scoped protocol drafts, notebook entry drafts, version-backed persistence helpers, and protocol linking inside entries.
- Added notebook detail views for entries and protocols, plus demo-mode persistence for these records through a local `.local/demo-notebook.json` store so the feature works without a database.
- Shifted the visual system toward a flatter IDE-like layout by replacing many rounded cards with dividers, rails, and typographic hierarchy across the shell, home view, and settings surface.
- Re-verified the notebook slice with `npm run prisma:generate --workspace @biota/db`, `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Added the first structured entry editor: ordered text/protocol blocks on the entry detail page, versioned saves, and protocol insertion directly inside the entry canvas.
- Entry versions now use `bodyJson` as the source of truth for block content, while `bodyText` is derived as a readable fallback snapshot for compatibility and later search/indexing.
- Mirrored the block editor flow into demo mode so entry editing, version bumps, and protocol-linked blocks all work without a configured database.
- Re-verified the structured editor flow with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Reworked the workspace shell around an Obsidian-style file-browser layout: icon-based primary tabs, a repository/folder/entry navigator tree, and flatter pane separators instead of card-heavy chrome.
- Replaced form-first entry creation with a blank-page flow: `Create new entry` now opens an untitled document immediately and redirects into the entry editor.
- Expanded the entry document model with markdown-oriented text blocks, table blocks, and derived summaries so entries read more like notebook pages while still saving as structured JSON versions.
- Added a client-side theme system with three variants inspired by public Obsidian themes: a default dark workspace, a warm light workspace, and a softer alternative dusk theme.
- Applied the new semantic theme tokens across the core workspace pages so Entries, Protocols, Entities, Graph, Home, Settings, and the shell stay visually consistent.
- Added notebook navigator helpers for both Prisma-backed and demo-mode data so the left rail can show folders and entries across the workspace.
- Re-verified this workspace/document pass with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Refactored the entry workspace shell into a collapsible navigator with persistent open-entry tabs, moved entry metadata into secondary subtabs, and made the theme switcher hydration-safe.
- Removed the always-on global inspector from entry routes, collapsed the entry detail view into document-first subtabs, and simplified the insert toolbar to icon-first controls so entries open more like blank writing pages.
- Added the first SnapGene-inspired DNA viewer foundation on the Entities route with synchronized map and sequence panes, circular and linear topology, reverse-complement/origin controls, feature filtering, motif search, and seams for alignments, traces, primer design, restriction analysis, and cloning history.
- Tightened the entry detail UX further by hiding the global inspector on entry routes, maximizing document space, and turning the page into a document-first surface with Document/Metadata/Protocols subtabs and a minimal icon-led editor toolbar.
- Introduced a shared sequence-backed entity catalog for plasmid, sgRNA, and primer records, with serializable server-friendly helpers and DNA-viewer consumption.
- Wired the entry detail route to consume entity options and linked-entity metadata so entity blocks can be edited alongside protocol blocks.
- Reworked the shell around a single Projects-style hub: `/` now lands on `/entries`, the primary rail emphasizes Projects plus Graph, and Settings moved to a top-right gear action instead of living as a separate primary workspace tab.
- Turned the entries landing page into a mixed Projects surface so entries, sequence-backed entities, and reusable protocols can all be browsed from one tab with explicit record typing.
- Added first-class entity reference blocks to entry documents, persisted those links through `EntryVersion.bodyJson`, mirrored them into demo mode, and surfaced linked entities back into entry metadata and the DNA viewer.
- Moved theme selection onto the Settings page, updated the general settings copy to match the flatter shell, and normalized button sizing across the shell, editor, theme controls, and project hub actions.
- Re-verified this projects/entity-linking pass with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Refined the shell UX further by moving the record overview into a dedicated Stats lane, relocating the navigator collapse control to the navigator edge, turning Settings into a full-screen overlay page, and making the light-theme entry canvas read as a white document surface.
- Hardened the entry table spreadsheet pass with more spreadsheet-like formulas, trailing-whitespace tolerant parsing, blank/text-aware range handling, `ABS` and `ROUND`, and clearer formula badges/tooltips in the table cells.
- Kept the default entry canvas document-first while preserving inserted tables, linked entities, and protocol blocks beneath it.
- Expanded the notebook e2e to cover table insertion plus `SUM` and `ROUND` evaluation, and to verify the computed values survive reload/persistence.
- Re-verified the spreadsheet/editor pass with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Reworked the entry editor again so tables, linked entities, and protocol embeds now live inline inside a single ordered document stream instead of rendering in a separate section beneath the main text area.
- Added inline-text insertion behavior around embeds by splitting the active writing region at the cursor, preserving a seamless Benchling-style document flow while still persisting the same ordered block model.
- Removed the heavy `/entries` dashboard feel in favor of a much thinner entry index, turned the header's `New entry` control into a real draft-creation action, and adjusted the collapsed navigator re-expand control so it no longer overlaps the left rail.
- Re-verified the inline-document pass with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Refined the shell interaction again so the Projects icon now re-opens the navigator when it is already the active section, removed the separate collapsed re-expand button, and moved creation into a navigator-scoped plus menu with `New entry` and `New entity`.
- Added immutable human-facing entry identifiers derived from the canonical entry ID so entries now surface a stable record code that does not depend on title edits.
- Reworked inline table embeds toward a more Benchling-like presentation: table controls now live in the table header, tables can be named, column labels are spreadsheet-style letters, row labels are numbered, and row/column deletion moved into header context menus instead of inline delete buttons.
- Added a temporary local sequence-entity draft store plus `/entities/new`, so the DNA viewer, entities page, stats page, and entry entity-linking options now read from `seed entities + locally created drafts` instead of only the hard-coded catalog.
- Re-verified this navigator/table/entity-draft pass with `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.
- Continued the shell/navigation cleanup: clicking the active Projects icon now collapses the navigator, clicking Projects from elsewhere re-opens it, and the navigator create menu now supports root or folder-scoped record creation.
- Simplified `/entries` so it resolves from the unified workspace navigator instead of acting like an entry-only landing page, and normalized stale entity links to `/entities/[entityId]` in shell-adjacent pages.
- Made `/entities/new` accept folder context from the navigator so newly created sequence entities can be placed into the folder they were launched from.
- Extended folder-aware creation to entry drafts as well, so the navigator `+` menu now consistently targets the active folder context for both entries and entities when that context is available.
- Promoted `/entities/[entityId]` into the main sequence workspace route and made the entity page sequence-first by default, with path-based view persistence during saves.
- Deepened the SnapGene-inspired DNA workspace substantially: sequence, map, features, primers, enzymes, and history views now share one flatter record workspace with split mode, a minimap, grouped base display, reverse-complement toggles, three-frame translation mode, jump-to-coordinate controls, and a collapsible info panel.
- Expanded the entity metadata pane so live edits to name, description, aliases, topology, purpose, motif, notes, and sequence immediately preview in the workspace before save.
- Re-verified this entity-workspace pass with `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test:e2e`.

## In Progress

- Preparing the next document-and-entity pass: richer markdown interactions on top of the new inline document stream, deeper entity annotation/editing tools inside the DNA workspace, and stronger sequence-aware relationships beyond the first linked-reference block.
- Evaluating the longer-term transition from the current local draft entity store to real Prisma-backed entity records so entities become fully first-class repository objects instead of a layered bridge.

## Blocked

- None currently.

## Decisions

- Platform: web-first application with a desktop-style interface.
- Stack: TypeScript full-stack with `Next.js`, `PostgreSQL`, `Prisma`, and `npm` workspaces.
- Hosting posture: managed cloud first.
- DNA scope for MVP: basic viewer and sequence-aware entities; advanced cloning/alignment deferred.
- First implementation wave focuses on foundation only.
- The repository uses a single root `package-lock.json` for workspace installs.
- Prisma is pinned to `6.19.0` for now to keep the schema/client workflow straightforward and avoid Prisma 7 driver-adapter overhead during early product development.
- Local development should stay usable before database setup, so demo-mode auth is a supported fallback for early UI validation.
- Demo auth redirects must preserve the incoming host to avoid losing session cookies across `127.0.0.1` and `localhost`.
- The visual language should prefer separators, rails, density, and typographic grouping over stacking features inside heavily rounded cards.
- Demo-mode feature work can use a local file-backed store when that keeps the no-database experience functional without contaminating the production data architecture.
- For entries, `EntryVersion.bodyJson` is now the canonical structured document payload and relation rows like `EntryProtocolReference` are derived from the saved block order.
- The entries surface should behave like a document editor first and a metadata form second; title remains editable, but summary is now derived from content when it is not explicitly provided.
- The workspace theme system should be semantic-token driven so dark/light/alternative variants can reuse the same layout language without duplicating component styles.
- The left navigator should behave like a persistent file browser, even before folder-management UI is exposed.
- The primary shell should center on one Projects hub for entries, entities, and protocols, with Graph as the only separate primary workspace destination for now.
- Settings should live behind a gear action in the top-right header, and theme selection belongs on the settings surface rather than in the always-visible shell header.
- Until database-backed entity tables exist, sequence-aware entities can ship from a shared typed catalog as long as entry documents persist stable entity IDs and the viewer/editor consume the same source.
- Entry embeds should feel native to the writing canvas itself, so the editor now prefers one ordered inline document stream over a split model with text above and structured blocks below.
- Until real Prisma-backed entity models land, the lightest clean bridge is a local draft entity store layered on top of the seed catalog so creation and linking can become real product interactions without blocking on a schema migration.
- Folder-aware record creation should live in the navigator itself, with contextual create menus rather than a top-bar action.
- The SnapGene-inspired DNA workspace should stay sequence-first: opening a DNA entity should land in Sequence view, with Map, Features, Primers, Enzymes, and History as peer workspace views rather than separate landing pages.

## Next

- Tighten the inline document stream further with better slash-style insertion, embed handles, and keyboard-first movement/editing around tables, entities, and protocols.
- Add richer markdown conveniences such as better preview ergonomics, slash-command insertion, and keyboard-first block creation.
- Promote the temporary local entity draft store into editable product primitives with richer metadata, sequence editing, and eventual Prisma-backed persistence for plasmids, sgRNAs, primers, and future sequence record types.
- Add richer entity annotation workflows such as create/edit/delete feature controls, enzyme-set customization, and more faithful selection/region synchronization between the sequence and map views.
- Expose folder management and repository organization controls in the UI so the navigator can evolve beyond the default root-folder structure.
- Add the next block types: entity reference blocks, callout/checklist blocks, and protocol-version snapshots instead of simple protocol references.
