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

## In Progress

- Preparing the next entry-focused development pass: richer markdown interactions, reliable protocol/table insertion automation coverage, and first entity-linked blocks now that the document-first entry shell is in place.

## Blocked

- Repository-wide TypeScript issues remain in `apps/web` settings and `packages/db`, so full typecheck/build still fail outside the entry/shell lane.

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

## Next

- Tighten the entry canvas interaction model so protocol and table insertion are both easier to operate manually and easier to cover with end-to-end automation.
- Add richer markdown conveniences such as split preview, slash-command insertion, and keyboard-first block creation.
- Begin entity primitives for plasmids, sgRNAs, primers, and sequence-backed records so entries can link to actual biological objects rather than free text alone.
- Expose folder management and repository organization controls in the UI so the navigator can evolve beyond the default root-folder structure.
- Add the next block types: entity reference blocks, callout/checklist blocks, and protocol-version snapshots instead of simple protocol references.
