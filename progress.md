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

## In Progress

- Waiting on GitHub authentication so the local scaffold commit can be pushed to `origin/main`.

## Blocked

- `git push -u origin main` failed with `Permission denied (publickey)`, so this machine cannot push to `git@github.com:Ruopu-Jiao/biota_eln.git` until SSH access is configured.

## Decisions

- Platform: web-first application with a desktop-style interface.
- Stack: TypeScript full-stack with `Next.js`, `PostgreSQL`, `Prisma`, and `npm` workspaces.
- Hosting posture: managed cloud first.
- DNA scope for MVP: basic viewer and sequence-aware entities; advanced cloning/alignment deferred.
- First implementation wave focuses on foundation only.
- The repository uses a single root `package-lock.json` for workspace installs.

## Next

- Configure GitHub SSH access on this machine, then rerun `git push -u origin main`.
- Start Wave 2: auth, user accounts, organizations, repositories, folders, and permissions.
