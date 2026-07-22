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

## Project Boundary

- Keep frontend UI, state management, routing, and API client code in this project.
- Treat the backend API as an external dependency of this project.
- Do not apply backend architecture, persistence, migration, or Go-specific rules to frontend code.
