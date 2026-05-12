import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
  real,
  json,
  boolean,
  uniqueIndex,
  serial,
} from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Columns use camelCase to match both database fields and generated types.
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const platformEnum = pgEnum("platform", [
  "twitter",
  "linkedin",
  "bluesky",
  "mastodon",
  "threads",
  "telegram",
  "discord",
  "zernio",
]);

export const publishStatusEnum = pgEnum("publish_status", [
  "success",
  "simulated",
  "failed",
]);

export const scheduledPostStatusEnum = pgEnum("scheduled_post_status", [
  "pending",
  "processing",
  "published",
  "cancelled",
  "failed",
]);

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const clientPlanEnum = pgEnum("client_plan", ["free", "starter", "pro"]);
export const mediaSourceEnum = pgEnum("media_source", ["generated", "uploaded", "edited"]);

// ─── Client accounts (multi-tenant) ───────────────────────────────────────────
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  plan: clientPlanEnum("plan").default("free").notNull(),
  planExpiresAt: timestamp("planExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Brands ──────────────────────────────────────────────────────────────────
export const frequencyEnum = pgEnum("frequency", ["daily", "weekly", "monthly", "off"]);

export const brands = pgTable("brands", {
  id: serial("id").primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  audience: text("audience"),
  tone: text("tone"),
  url: varchar("url", { length: 256 }),
  schedule: varchar("schedule", { length: 64 }),
  frequency: frequencyEnum("frequency").default("daily").notNull(),
  postTime: varchar("postTime", { length: 8 }).default("09:00").notNull(),
  postDays: json("postDays"),
  accentColor: varchar("accentColor", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  cta: text("cta"),
  clientId: integer("clientId"),
  requiresApproval: boolean("requiresApproval").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ─── Platform credentials (per brand) ───────────────────────────────────────
export const platformCredentials = pgTable(
  "platform_credentials",
  {
    id: serial("id").primaryKey(),
    brandId: varchar("brandId", { length: 64 }).notNull(),
    platform: platformEnum("platform").notNull(),
    credentials: json("credentials").$type<Record<string, string>>().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("platform_cred_brand_platform").on(table.brandId, table.platform)]
);

export type PlatformCredentialRow = typeof platformCredentials.$inferSelect;
export type InsertPlatformCredential = typeof platformCredentials.$inferInsert;

// ─── Dashboard sessions (opaque token → owner or client) ──────────────────────
export const dashboardSessions = pgTable("dashboard_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  clientId: integer("clientId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DashboardSession = typeof dashboardSessions.$inferSelect;
export type InsertDashboardSession = typeof dashboardSessions.$inferInsert;

// ─── Publish log ─────────────────────────────────────────────────────────────
export const publishLog = pgTable("publish_log", {
  id: serial("id").primaryKey(),
  postId: varchar("postId", { length: 64 }).notNull(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  platform: platformEnum("platform").notNull(),
  status: publishStatusEnum("status").notNull(),
  content: text("content"),
  postUrl: varchar("postUrl", { length: 1024 }),
  errorMessage: text("errorMessage"),
  simulated: boolean("simulated").default(false).notNull(),
  publishedAt: timestamp("publishedAt").defaultNow().notNull(),
  impressions: integer("impressions").default(0),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  clicks: integer("clicks").default(0),
});

export type PublishLogRow = typeof publishLog.$inferSelect;
export type InsertPublishLog = typeof publishLog.$inferInsert;

// ─── Media assets (video files) ───────────────────────────────────────────────
export const mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  source: mediaSourceEnum("source").notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

// ─── Scheduled posts ─────────────────────────────────────────────────────────
export const scheduledPosts = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  scheduledFor: timestamp("scheduledFor").notNull(),
  status: scheduledPostStatusEnum("status").default("pending").notNull(),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledPostRow = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;

// ─── Approval queue ──────────────────────────────────────────────────────────
export const approvalQueue = pgTable("approval_queue", {
  id: serial("id").primaryKey(),
  postId: varchar("postId", { length: 64 }).notNull(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  platforms: json("platforms").$type<string[]>().notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalQueueRow = typeof approvalQueue.$inferSelect;
export type InsertApprovalQueue = typeof approvalQueue.$inferInsert;

// ─── Posts (pipeline-generated drafts) ───────────────────────────────────────
export const variantTypeEnum = pgEnum("variantType", ["original", "hot_take", "thread", "hook"]);
export const postStatusEnum = pgEnum("post_status", ["pending", "approved", "rejected", "published"]);

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  variantType: variantTypeEnum("variantType").default("original").notNull(),
  score: real("score"),
  status: postStatusEnum("status").default("pending").notNull(),
  platforms: json("platforms"),
  publishedAt: timestamp("publishedAt"),
  impressions: integer("impressions").default(0),
  likes: integer("likes").default(0),
  reposts: integer("reposts").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// ─── Pipeline Runs ───────────────────────────────────────────────────────────
export const pipelineStatusEnum = pgEnum("pipeline_status", ["running", "completed", "failed"]);

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  status: pipelineStatusEnum("status").default("running").notNull(),
  postsGenerated: integer("postsGenerated").default(0),
  postsApproved: integer("postsApproved").default(0),
  postsPublished: integer("postsPublished").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type InsertPipelineRun = typeof pipelineRuns.$inferInsert;
