# AEDE Dashboard TODO

- [x] Update index.css with dark navy theme and brand color tokens
- [x] Update index.html with Google Fonts (IBM Plex Mono + IBM Plex Sans)
- [x] Update App.tsx with dark theme and dashboard routes
- [x] Create drizzle schema for brands, posts, and pipeline runs
- [x] Push database schema
- [x] Create server/db.ts helpers for brands and posts
- [x] Create tRPC routers for brands, posts, pipeline status, and trigger
- [x] Build DashboardLayout customization with AEDE sidebar
- [x] Build BrandSidebar component with per-brand color chips
- [x] Build Overview page with global stats and brand grid
- [x] Build BrandDetail page with tabs (Posts / Pipeline / Info)
- [x] Build PostCard component with score display and variant expansion
- [x] Build PipelineStatus component with live status indicator
- [x] Build TriggerPipeline button with confirmation
- [x] Wire frontend to tRPC backend
- [x] Seed database with 7 brands via seed-brands.mjs script
- [x] Write vitest tests for key procedures (12/12 passing)
- [x] Save checkpoint and deliver to user

## New Brands — Phase 2

- [x] Research stillhere repo
- [x] Research PromptAngel repo
- [x] Research CodeMama repo
- [x] Research MFS-Autopilot repo
- [x] Research Marketing-For-SoloPreneurs repo
- [ ] Research rehab (clarify repo name)
- [x] Add 6 new brands to AEDE brands.ts config
- [x] Seed 6 new brands into dashboard database
- [x] Update seed-brands.mjs with new brands
- [ ] Push updated AEDE engine to GitHub
- [ ] Save checkpoint

## Scheduling Controls — Phase 3

- [x] Add frequency field to brands table (daily/weekly/monthly/off)
- [x] Add postTime and postDays fields to brands table
- [x] Build ScheduleEditor component — frequency selector, time picker, day-of-week picker
- [x] Wire ScheduleEditor to tRPC updateBrandSchedule mutation
- [ ] Update AEDE engine to read schedule from DB instead of hardcoded cron
- [x] Add 6 new brands (StillHere, PromptAngel, CodeMama, MFS-Autopilot, MarketingForSoloPreneurs)
- [x] Seed 6 new brands into dashboard database
