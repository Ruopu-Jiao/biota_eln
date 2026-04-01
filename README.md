# Biota ELN

Biota ELN is a web-first molecular biology electronic lab notebook inspired by Benchling workflows and IDE-style interfaces.

## Workspace layout

- `apps/web`: Next.js application shell and product UI
- `packages/db`: Prisma schema and database access foundation
- `packages/ui`: shared UI building blocks
- `packages/editor`: editor-specific helpers and types
- `packages/bio`: bioinformatics utilities and sequence helpers
- `packages/shared`: shared domain types and utilities

## Getting started

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` in `apps/web` or export the required environment variables.
3. Start the app with `npm run dev`.
