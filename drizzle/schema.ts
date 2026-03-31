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
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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
  // Scheduling control fields
  frequency: mysqlEnum("frequency", ["daily", "weekly", "monthly", "off"]).default("daily").notNull(),
  postTime: varchar("postTime", { length: 8 }).default("09:00").notNull(), // HH:MM format
  postDays: json("postDays"), // For weekly: ["mon","wed","fri"], for monthly: [1,15]
  accentColor: varchar("accentColor", { length: 32 }),
  active: boolean("active").default(true).notNull(),
  cta: text("cta"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

// ─── Posts ───────────────────────────────────────────────────────────────────
export const posts = mysqlTable("posts", {
  id: int("id").autoincrement().primaryKey(),
  brandId: varchar("brandId", { length: 64 }).notNull(),
  content: text("content").notNull(),
  variantType: mysqlEnum("variantType", ["original", "hot_take", "thread", "hook"]).default("original").notNull(),
  score: float("score"),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "published"]).default("pending").notNull(),
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