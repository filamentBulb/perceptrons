# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # dev server on :3000
pnpm build        # production build (Nitro server → dist/)
pnpm preview      # preview production build
pnpm test         # vitest run
pnpm check        # biome lint + format (run before committing)
pnpm lint         # biome lint only
pnpm format       # biome format only
```

Run a single test file: `pnpm vitest run src/path/to/file.test.ts`

Add Shadcn components: `pnpm dlx shadcn@latest add <component>`

## Architecture

**Stack:** TanStack Start (React 19 SSR framework) + TanStack Router (file-based routing) + TanStack Store (global state) + Tailwind CSS v4 + Nitro (server adapter) + Biome (lint/format).

**App:** "Runway AI CFO" — a startup financial survival dashboard. Connects mock cloud/revenue/banking sources, shows cash flow charts, and runs AI what-if forecast scenarios.

### Routing

File-based via TanStack Router. `src/routeTree.gen.ts` is auto-generated — never edit it manually.

- `src/routes/__root.tsx` — shell layout (Header, Footer, devtools, theme script)
- `src/routes/index.tsx` — main dashboard (integration connect flow + forecast scenarios)
- `src/routes/connect.tsx` — dedicated source connection page
- `src/routes/mcp.ts` — MCP API route (`POST /mcp`), server-only

### State

`src/lib/runway-store.ts` — single TanStack Store tracking `connectedSourceIds[]`. Persisted to `localStorage` under key `runway-ai-cfo-state`. Dashboard unlocks when at least one cloud source AND one banking source are connected (`hasRequiredForecastSources`).

### MCP Integration

`src/routes/mcp.ts` registers an MCP server with tools (currently `addTodo`). `src/utils/mcp-handler.ts` handles each POST by creating an in-memory transport pair, running the request through the MCP server, and returning the JSON-RPC response.

`src/mcp-todos.ts` holds the todo list state consumed by MCP tools.

### Styling conventions

Design tokens are CSS custom properties in `src/styles.css` (e.g. `--sea-ink`, `--lagoon-deep`, `--surface-strong`, `--line`). Use these rather than raw Tailwind colors for brand-consistent UI. Dark mode via `.dark` class on `<html>` (toggled by `src/components/ThemeToggle.tsx`, stored in `localStorage`).

### Path aliases

`#/*` maps to `src/*` (configured in `package.json` imports + `tsconfig.json`). Use `#/utils/...`, `#/lib/...` etc. in imports.

### Demo files

All files prefixed with `demo` (components, hooks, lib, data) are scaffolding examples — safe to delete.

## Env

```
ANTHROPIC_API_KEY=   # required for AI features
```
