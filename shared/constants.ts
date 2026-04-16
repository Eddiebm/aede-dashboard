/** Platform identifiers — single source for API + DB enums */
export const PLATFORMS = [
  "twitter",
  "linkedin",
  "bluesky",
  "mastodon",
  "threads",
  "telegram",
  "discord",
] as const;
export type PlatformId = (typeof PLATFORMS)[number];

/** Session cookie for opaque DB-backed dashboard + client sessions (never use req.cookies — parse `headers.cookie`). */
export const DASHBOARD_SESSION_COOKIE = "aede_dashboard_session";

/** Legacy JWT session cookie name (Manus OAuth) — kept for compatibility */
export const COOKIE_NAME = "app_session_id";

export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

/** Character limits per platform (text posts) */
export const PLATFORM_CHAR_LIMIT: Record<PlatformId, number> = {
  twitter: 280,
  linkedin: 3000,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
  telegram: 4096,
  discord: 2000,
};

export const BLUESKY_SERVICE_URL = "https://bsky.social";
export const TELEGRAM_API_BASE = "https://api.telegram.org";
export const LINKEDIN_UGC_POSTS_URL = "https://api.linkedin.com/v2/ugcPosts";
export const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

export const PUBLISHER_HTTP_TIMEOUT_MS = 30_000;
export const SCHEDULER_POLL_INTERVAL_MS = 60_000;
/** Max scheduled rows to process per scheduler tick */
export const SCHEDULER_BATCH_LIMIT = 25;

export const PLANS = ["free", "starter", "pro"] as const;
export type PlanId = (typeof PLANS)[number];

/** Brand / post limits per plan */
export const PLAN_BRAND_LIMIT: Record<PlanId, number> = {
  free: 2,
  starter: 10,
  pro: 100,
};

export const PLAN_MONTHLY_POST_LIMIT: Record<PlanId, number> = {
  free: 50,
  starter: 500,
  pro: 10000,
};

export const STRIPE_PRICE_STARTER_MONTHLY = process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "";
export const STRIPE_PRICE_PRO_MONTHLY = process.env.STRIPE_PRICE_PRO_MONTHLY ?? "";
