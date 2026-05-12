# aede-dashboard — AEDE Multi-Brand Dashboard

## What this is
Multi-brand content publishing and management dashboard. Handles scheduling, publishing jobs, Stripe webhooks, and brand-level analytics.

## Stack
- React + TypeScript (Vite, client in `client/`)
- Node.js server (`server/`)
- Drizzle ORM (SQL migrations in `drizzle/`)
- Stripe (billing/webhooks)
- Vitest (testing)
- pnpm

## Local path
`~/aede-dashboard`

## Key files
- `server/index.ts` — Express server entry
- `server/routers.ts` — API routes
- `server/storage.ts` — data access layer
- `server/db.ts` — DB connection
- `server/publishJob.ts` — content publishing logic
- `server/publishers.ts` — publisher integrations
- `server/scheduler.ts` — job scheduling
- `server/stripeWebhook.ts` — Stripe webhook handler
- `server/videoUtils.ts` — video processing utilities
- `shared/types.ts` — shared TypeScript types
- `shared/const.ts` + `shared/constants.ts` — shared constants
- `drizzle/schema.ts` — database schema
- `drizzle/relations.ts` — ORM relations
- `drizzle/*.sql` — migration files
- `scripts/seed-brands.mjs` — seed script
- `vite.config.ts` — Vite config
- `drizzle.config.ts` — Drizzle config

## Dev commands
```bash
pnpm dev           # start dev server
pnpm build         # production build
pnpm test          # run tests (Vitest)
pnpm db:migrate    # run Drizzle migrations
pnpm db:studio     # open Drizzle Studio
node scripts/seed-brands.mjs  # seed brand data
```

## Architecture notes
- Full-stack: Vite frontend + Express backend in one repo
- Drizzle migrations are sequential — never skip or reorder them
- Stripe webhooks require correct secret — check `.env`
- `wouter` is patched (see `patches/`) — do not upgrade without testing

## Do not
- Reorder or delete migration files in `drizzle/`
- Change `shared/types.ts` without updating both client and server
- Remove the wouter patch without verifying routing still works

## Current gaps (fill in)
- [ ] What brands are currently configured
- [ ] What's broken or in progress
- [ ] Deployment target
