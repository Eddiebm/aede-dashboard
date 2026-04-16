import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  float,
  json,
  boolean,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const platformEnum = mysqlEnum("platform", [
  "twitter",
  "linkedin",
  "bluesky",
  "mastodon",
  "threads",
  "telegram",
  "discord",
]);

export const publishStatusEnum = mysqlEnum("publish_status", [
  "success",
  "simulated",
  "failed",
]);

export const scheduledPostStatusEnum = mysqlEnum("scheduled_post_status", [
  "pending",
  "processing",
  "published",
  "cancelled",
  "failed",
]);

export const approvalStatusEnum = mysqlEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const clientPlanEnum = mysqlEnum("client_plan", ["free", "starter", "pro"]);
export const mediaSourceEnum = mysqlEnum("media_source", ["generated", "uploaded", "edited"]);

// ─── Client accounts (multi-tenant) ───────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  plan: clientPlanEnum.default("free").notNull(),
  planExpiresAt: timestamp("planExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Brands ──────────────────────────────────────────────────────────────────
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  audience: text("audience"),
  tone: text("tone"),
  url: varchar("url", { length: 256 }),
  schedule: varchar("schedule", { length: 64 }),
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "off"])
    .default("daily")
    .notNull(),
  postTime: varchar("postTime", { length: 8 }).default("09:00").notNull(),
  postDays: json("postDays"),
  accentColor: varchar("accentColor", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  cta: text("cta"),
  clientId: int("clientId"),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ─── Platform credentials (per brand) ───────────────────────────────────────
export const platformCredentials = mysqlTable(
  "platform_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    brandId: varchar("brandId", { length: 64 }).notNull(),
    platform: platformEnum.notNull(),
    credentials: json("credentials").$type<Record<string, string>>().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("platform_cred_brand_platform").on(table.brandId, table.platform)]
);

export type PlatformCredentialRow = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredential = typeof platformCredentials.$inferInsert;

// ─── Dashboard sessions (opaque token → owner or client) ──────────────────────
export const dashboardSessions = mysqlTable("dashboard_sessions", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  clientId: int("clientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DashboardSession = typeof dashboardSessions.$inferSelect;
export type InsertDashboardSession = typeof dashboardSessions.$inferInsert;

// ─── Publish log ─────────────────────────────────────────────────────────────
export const publishLog = mysqlTable("publish_log", {
  id: int("id").autoincrement().primaryKey(),
  postId: varchar("postId", { length: 64 }).notNull(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  platform: platformEnum.notNull(),
  status: publishStatusEnum.notNull(),
  content: text("content"),
  postUrl: varchar("postUrl", { length: 1024 }),
  errorMessage: text("errorMessage"),
  simulated: boolean("simulated").default(false).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  impressions: int("impressions").default(0),
  likes: int("likes").default(0),
  reposts: int("reposts").default(0),
  clicks: int("clicks").default(0),
});

export type PublishLogRow = typeof publishLog.$inferSelect;
export type InsertPublishLog = typeof publishLog.$inferInsert;

// ─── Media assets (video files) ───────────────────────────────────────────────
export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  source: mediaSourceEnum.notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

// ─── Scheduled posts ─────────────────────────────────────────────────────────
export const scheduledPosts = mysqlTable("scheduled_posts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  status: scheduledPostStatusEnum.default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledPostRow = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;

// ─── Approval queue ──────────────────────────────────────────────────────────
export const approvalQueue = mysqlTable("approval_queue", {
  id: int("id").autoincrement().primaryKey(),
  postId: varchar("postId", { length: 64 }).notNull(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  status: approvalStatusEnum.default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalQueueRow = typeof approvalQueue.$inferSelect;
export type InsertApprovalQueue = typeof approvalQueue.$inferInsert;

// ─── Posts (pipeline-generated drafts) ───────────────────────────────────────
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  variantType: mysqlEnum("variantType", ["original", "hot_take", "thread", "hook"])
    .default("original")
    .notNull(),
  score: float("score"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "published"])
    .default("pending")
    .notNull(),
  platforms: json("platforms"),
  publishedAt: timestamp("publishedAt"),
  impressions: int("impressions").default(0),
  likes: int("likes").default(0),
  reposts: int("reposts").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ─── Pipeline Runs ───────────────────────────────────────────────────────────
export const pipelineRuns = mysqlTable("pipeline_runs", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
  postsGenerated: int("postsGenerated").default(0),
  postsApproved: int("postsApproved").default(0),
  postsPublished: int("postsPublished").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type InsertPipelineRun = typeof pipelineRuns.$inferInsert;
