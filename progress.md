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

## In Progress

- Preparing the next development pass after the entries/protocols foundation, with richer entry editing and reusable block composition now the most valuable next step.

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

## Next

- Start the entry editor wave: replace plain-text entry bodies with modular blocks and add first-class protocol block insertion inside the editor canvas.
- Add real auth UX polish: error handling, sign-out state, and first-run account bootstrap validation against a live Postgres instance.
- Expose repository and organization creation/editing flows in the UI now that the data model is in place.
- Begin entity primitives for plasmids, sgRNAs, primers, and sequence-backed records so entries can link to actual biological objects rather than free text alone.
