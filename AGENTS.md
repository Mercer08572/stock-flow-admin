# Stock-Flow Admin — AGENTS.md

## Project Scope

This file applies only to the `stock-flow-admin/` frontend project. Backend-specific instructions belong in `../stock-flow/AGENTS.md` and do not apply here.

## Project Overview

Stock-Flow Admin is the frontend admin application for the Stock-Flow inventory management system.

## Frontend Tech Stack

- Vue 3
- TypeScript
- Naive UI
- AG Grid
- Pinia
- Vue Router

## Required Commands

Run commands from `stock-flow-admin/` and use pnpm.

```bash
pnpm install
pnpm dev
pnpm check
```

Before handing work back, run the narrowest relevant tests during iteration, then run `pnpm check`. For browser-visible changes, also run `pnpm test:e2e` when Playwright browsers are available and inspect desktop and mobile layouts.

## Source Layout

```text
src/api/           shared transport, errors, and endpoint wrappers
src/app/           root providers, theme, and application-level views
src/components/    reusable presentational and layout components
src/features/      business features; keep feature-specific state and views together
src/router/        route definitions and global guards
src/stores/        Pinia installation and truly cross-feature stores
src/styles/        global tokens and base styles
src/types/         shared API and domain types
tests/             Playwright end-to-end tests
tasks/             agent-ready implementation briefs
```

## Architecture Rules

- Views call feature API modules or stores, never `fetch` directly.
- `src/api/client.ts` is the only shared HTTP transport. Preserve the backend response envelope and trace ID in errors.
- Authentication uses the backend's HttpOnly session cookie. Never persist session tokens in browser storage.
- Keep route-specific state in the feature. Promote state to Pinia only when it is shared across routes or must survive navigation.
- Keep server data as server data. Do not duplicate API records in long-lived Pinia stores without an explicit cache invalidation design.
- Prefer typed request/response models. When the backend contract changes, run `pnpm api:generate` and reconcile intentionally used types.
- Keep business terms aligned with `../stock-flow/openapi/swagger.json` and the backend module names.
- Use Naive UI for application controls, Lucide for icons, and AG Grid for operational tables.
- Every async screen must include loading, empty, error, and retry behavior.
- Maintain keyboard access, visible focus states, semantic labels, and responsive behavior down to 320 px.

## Change Boundaries

- Do not edit `../stock-flow/` as part of a frontend task unless the task explicitly spans both projects.
- Generated API files belong in `src/api/generated/`; do not hand-edit them.
- Do not commit `.env`, build output, coverage, or Playwright reports.
- Avoid new dependencies unless the existing stack cannot solve the requirement cleanly.

## Definition Of Done

- Acceptance criteria in the relevant `tasks/` brief are met.
- No fake production data or silent API fallbacks were introduced.
- `pnpm check` passes.
- User-facing workflows have appropriate loading, empty, error, success, and permission/session states.
- UI changes have been checked at desktop and mobile widths.
- Documentation and `.env.example` are updated when commands, architecture, or configuration change.

## Project Boundary

- Keep frontend UI, state management, routing, and API client code in this project.
- Treat the backend API as an external dependency of this project.
- Do not apply backend architecture, persistence, migration, or Go-specific rules to frontend code.
