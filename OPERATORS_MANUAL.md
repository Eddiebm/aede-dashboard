# AEDE Operator's Manual

## Purpose

AEDE is a multi-brand social operations system for:

- generating and composing content
- publishing or scheduling across platforms
- approval queue workflows
- analytics and engagement-driven prompt adaptation
- video generation, editing, and auto-posting

This guide is for operators running AEDE in production.

## 1) Preflight Checklist

Before operating AEDE, verify:

- database is reachable (`DATABASE_URL`)
- storage proxy is configured (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`)
- owner login is configured (`DASHBOARD_PASSWORD_HASH`, `OWNER_OPEN_ID`)
- Stripe (if billing enabled) is configured
- platform credentials exist per brand for intended targets

### Required Environment Variables

- `DATABASE_URL`
- `DASHBOARD_PASSWORD_HASH`
- `OWNER_OPEN_ID`
- `BUILT_IN_FORGE_API_URL`
- `BUILT_IN_FORGE_API_KEY`
- `SIMULATE_PUBLISH` (optional; `true`/`1` for dry run style behavior)

### Optional / Feature-Specific Variables

- Billing:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_STARTER_MONTHLY`
  - `STRIPE_PRICE_PRO_MONTHLY`
  - `OWNER_BILLING_EMAIL`
  - `PUBLIC_APP_URL`
- Video generation:
  - `VIDEO_GENERATION_API_URL`
  - `VIDEO_GENERATION_API_KEY`
- **Zernio** (optional cross-post, same API as AGE):
  - `ZERNIO_API_KEY` — or put the raw key in a file and set `ZERNIO_API_KEY_FILE`
  - `ZERNIO_API_BASE` — optional (default `https://zernio.com/api/v1`)

### Zernio per brand

After migration `0005_zernio_platform`, add a **`zernio`** row in `platform_credentials` for the brand with either:

- **`profileId`** — Zernio profile `_id` (queue from profile), or
- **`targetsJson`** — JSON array, e.g. `[{"platform":"twitter","accountId":"..."}]` per [Zernio docs](https://docs.zernio.com/).

Text posts only; video is not routed through Zernio in AEDE (use native platforms for video).

## 2) Startup and Deploy

### Local / server startup

- install deps: `npm install` (or `npx pnpm install`)
- run migrations: `npx pnpm db:push` (or `npm run db:push` if pnpm is available via npx)
- start app: `npm run dev`

### Production build

- `npm run build`
- `npm start`

### Verify healthy boot

- open `/login` (owner login)
- open `/compose` and confirm brand list loads
- confirm scheduler startup log appears with `[Scheduler]`

## 3) Core Operator Workflows

### A) Brand and credential setup

1. Create/verify brand in dashboard.
2. Add platform credentials for intended platforms.
3. For client isolation, assign brand to the correct client account.
4. Toggle `requiresApproval` where review-before-publish is needed.

### B) Daily publishing

1. Go to `/compose`.
2. Select brand and platforms.
3. Generate with AI or write manually.
4. Publish now, or schedule with date/time.
5. Validate outcomes in publish results and history table.

### C) Approval queue

1. Open `/review`.
2. Approve or reject pending posts per brand.
3. Monitor failure rows and correct credentials/content constraints.

### D) Engagement sync + learning loop

The adaptive generation loop is only as good as engagement data freshness.

Run engagement sync regularly (at least daily) with `posts.syncEngagement`:

- supports Twitter/X, Mastodon, Threads
- writes likes/reposts/clicks/impressions into `publish_log`

After sync, `posts.generate` uses top engagement-weighted historical posts to bias:

- length tendencies
- tone tendencies
- CTA keyword tendencies
- platform-specific guidance (when platforms are provided)

### E) Video operations

1. Open `/videos`.
2. Generate video (provider-backed) or upload.
3. Optionally edit (trim + caption overlay).
4. Auto-post to selected platforms.

Current video auto-post support:

- Twitter/X
- Mastodon
- Threads
- Telegram
- Discord

Unsupported platforms return explicit actionable errors.

## 4) Monitoring and Logs

Use log prefixes for quick triage:

- `[Publisher:<Platform>]`
- `[Scheduler]`
- `[Auth]`
- `[Stripe]`

Watch for:

- repeated credential errors (bad tokens, revoked keys)
- scheduler failures on due jobs
- Stripe webhook signature failures
- engagement sync failures per platform

## 5) Incident Playbooks

### Publish failures spike

1. Check platform credential freshness for affected brand/platform.
2. Confirm content constraints (char limits/platform support).
3. Retry publish on small sample.
4. If external outage, continue remaining platforms (system is fail-independent).

### Scheduler backlog

1. Confirm app process running and scheduler started.
2. Inspect `scheduled_posts` statuses.
3. Resolve repeated failures first, then replay pending items.

### Learning quality drops

1. Run engagement sync.
2. Confirm `publish_log` rows have non-zero metrics.
3. Check if historical lookback is sparse for that brand/platform.

### Billing issues

1. Validate webhook endpoint `/api/stripe/webhook`.
2. Verify `STRIPE_WEBHOOK_SECRET`.
3. Reconcile client `plan`/`stripeCustomerId` after failed events.

## 6) Weekly Maintenance

- run engagement sync across active brands
- review approval queue SLA and failure patterns
- prune/flag stale credentials
- verify top-performing pattern drift in analytics
- audit video asset growth and storage usage

## 7) Safety and Governance Rules

- never use `req.cookies`; cookie parsing must use header parse path
- validate at boundary only (router inputs)
- no silent catches; always return actionable error context
- avoid broad page blocking; preserve responsive dashboard behavior
- keep constants in `shared/constants.ts` (no magic numbers)

## 8) Decommission / Shutdown

1. Disable new operations:
   - set all brands inactive
   - pause scheduler process
   - revoke platform credentials
2. Export data:
   - `publish_log`, `scheduled_posts`, `approval_queue`, `media_assets`
3. Rotate and remove secrets.
4. Archive repository and infra once queues are drained.

---

For feature development changes, continue phase-style commits and keep tests passing (`npm test`, `npx tsc --noEmit`).

