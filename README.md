# LinkedIn Ads Buddy

An agency-grade **LinkedIn Ads management dashboard**: browse and report on campaigns, creatives, audiences and leads; run AI analyzers; bulk-edit ads; and publish client-facing weekly reports — plus an MCP server so Claude can query the same data.

- **Frontend** — React + Vite + TypeScript + Tailwind + shadcn/ui (auto-deploys via Lovable on push to `main`)
- **Backend** — Supabase (Postgres, Auth, Edge Functions); one monolithic `linkedin-api` edge function fronts all LinkedIn Marketing API access (67 actions)
- **MCP server** — Node + Express on Railway, exposes the edge actions to Claude via a `call_linkedin_action` passthrough tool
- **Package manager** — bun

## Documentation

The source of truth lives in three companion docs, kept current with the code:

- **[CLAUDE.md](CLAUDE.md)** — architecture, deployment matrix, token flow, known constraints, and pitfalls
- **[FEATURES.md](FEATURES.md)** — what exists and where: every route, nav group, component, hook, edge action, and the design system
- **[HISTORY.md](HISTORY.md)** — how it got built, chronologically

## Getting started

```sh
git clone https://github.com/geryslov/linkedin-ads-buddy
cd linkedin-ads-buddy
bun install        # or: npm install
bun run dev        # Vite dev server
```

Type-check before committing — **`vite build` alone does not type-check**:

```sh
npx tsc -p tsconfig.app.json --noEmit
```

## Deploying

| Piece | Deploys |
|---|---|
| Frontend (`src/`) | Automatically via **Lovable** on push to `main` |
| MCP server (`mcp-server/`) | Automatically via **Railway** on push to `main` |
| Edge functions (`supabase/functions/**`) | **Manual** — the CI workflow is currently failing (see [CLAUDE.md](CLAUDE.md)) |
| DB migrations (`supabase/migrations/`) | **Manual** via the Supabase SQL Editor |

Deploy the edge function manually after backend changes:

```sh
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy linkedin-api --project-ref bxoxefmenvlxiubynuay
```

## Working in Lovable

This repo is connected to Lovable — changes made there are committed automatically, and pushes here are reflected back. To edit visually, open the [Lovable project](https://lovable.dev); to publish the frontend, use **Share → Publish**. Custom domains: **Project → Settings → Domains**.
