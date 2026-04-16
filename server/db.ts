import { eq, desc, asc, count, and, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  brands,
  posts,
  pipelineRuns,
  InsertBrand,
  InsertPost,
  InsertPipelineRun,
  platformCredentials,
  publishLog,
  dashboardSessions,
  clients,
  scheduledPosts,
  approvalQueue,
  InsertPublishLog,
  InsertDashboardSession,
  InsertClient,
  InsertScheduledPost,
  InsertApprovalQueue,
  mediaAssets,
  InsertMediaAsset,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { PlatformId } from "@shared/constants";
import { SCHEDULER_BATCH_LIMIT } from "@shared/constants";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Brands ───────────────────────────────────────────────────────────────────
export async function getAllBrands(clientId?: number | null) {
  const db = await getDb();
  if (!db) return [];
  if (clientId != null && clientId !== undefined) {
    return db
      .select()
      .from(brands)
      .where(eq(brands.clientId, clientId))
      .orderBy(brands.name);
  }
  return db.select().from(brands).orderBy(brands.name);
}

export async function countBrandsForClient(clientId: number) {
  const db = await getDb();
  if (!db) return 0;
  const r = await db
    .select({ n: count() })
    .from(brands)
    .where(eq(brands.clientId, clientId));
  return Number(r[0]?.n ?? 0);
}

export async function getBrandById(brandId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brands).where(eq(brands.brandId, brandId)).limit(1);
  return result[0];
}

export async function getBrandByIdScoped(brandId: string, clientId?: number | null) {
  const b = await getBrandById(brandId);
  if (!b) return undefined;
  if (clientId != null && clientId !== undefined && b.clientId !== clientId) {
    return undefined;
  }
  return b;
}

export async function upsertBrand(brand: InsertBrand) {
  const db = await getDb();
  if (!db) return;
  await db.insert(brands).values(brand).onDuplicateKeyUpdate({
    set: {
      name: brand.name,
      description: brand.description,
      audience: brand.audience,
      tone: brand.tone,
      url: brand.url,
      schedule: brand.schedule,
      accentColor: brand.accentColor,
      active: brand.active,
      cta: brand.cta,
      ...(brand.clientId !== undefined ? { clientId: brand.clientId } : {}),
      ...(brand.requiresApproval !== undefined
        ? { requiresApproval: brand.requiresApproval }
        : {}),
    },
  });
}

export async function toggleBrandActive(brandId: string, active: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(brands).set({ active }).where(eq(brands.brandId, brandId));
}

export async function updateBrandSchedule(
  brandId: string,
  schedule: {
    frequency: "daily" | "weekly" | "monthly" | "off";
    postTime: string;
    postDays?: unknown;
  }
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(brands)
    .set({
      frequency: schedule.frequency,
      postTime: schedule.postTime,
      postDays: schedule.postDays ?? null,
    })
    .where(eq(brands.brandId, brandId));
}

// ─── Platform credentials ─────────────────────────────────────────────────────
export async function getPlatformCredentialsForBrand(brandId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformCredentials).where(eq(platformCredentials.brandId, brandId));
}

export async function upsertPlatformCredential(
  brandId: string,
  platform: PlatformId,
  credentials: Record<string, string>
) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(platformCredentials)
    .values({ brandId, platform, credentials })
    .onDuplicateKeyUpdate({
      set: { credentials, updatedAt: new Date() },
    });
}

// ─── Publish log ──────────────────────────────────────────────────────────────
export async function insertPublishLog(row: InsertPublishLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(publishLog).values(row);
}

export async function getPublishLogsByBrand(brandId: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(publishLog)
    .where(eq(publishLog.brandId, brandId))
    .orderBy(desc(publishLog.publishedAt))
    .limit(limit);
}

export async function insertMediaAsset(row: InsertMediaAsset) {
  const db = await getDb();
  if (!db) return;
  await db.insert(mediaAssets).values(row);
}

export async function getMediaAssetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return rows[0];
}

export async function listMediaAssetsByBrand(brandId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.brandId, brandId))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit);
}

export async function countTotalBrands() {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ n: count() }).from(brands);
  return Number(r[0]?.n ?? 0);
}

export async function countPublishLogsSince(since: Date) {
  const db = await getDb();
  if (!db) return 0;
  const r = await db
    .select({ n: count() })
    .from(publishLog)
    .where(
      and(eq(publishLog.status, "success"), gte(publishLog.publishedAt, since))
    );
  return Number(r[0]?.n ?? 0);
}

export async function countPublishLogsForClientThisMonth(clientId: number) {
  const db = await getDb();
  if (!db) return 0;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const r = await db
    .select({ n: count() })
    .from(publishLog)
    .innerJoin(brands, eq(publishLog.brandId, brands.brandId))
    .where(
      and(eq(brands.clientId, clientId), gte(publishLog.publishedAt, start))
    );
  return Number(r[0]?.n ?? 0);
}

// ─── Dashboard sessions ───────────────────────────────────────────────────────
export async function insertDashboardSession(row: InsertDashboardSession) {
  const db = await getDb();
  if (!db) return;
  await db.insert(dashboardSessions).values(row);
}

export async function getDashboardSessionByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(dashboardSessions)
    .where(eq(dashboardSessions.token, token))
    .limit(1);
  return rows[0];
}

export async function deleteDashboardSession(token: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(dashboardSessions).where(eq(dashboardSessions.token, token));
}

// ─── Clients ──────────────────────────────────────────────────────────────────
export async function insertClient(row: InsertClient) {
  const db = await getDb();
  if (!db) return;
  await db.insert(clients).values(row);
}

export async function getClientByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clients).where(eq(clients.email, email)).limit(1);
  return rows[0];
}

export async function getClientById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return rows[0];
}

export async function getClientByStripeCustomerId(stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return rows[0];
}

export async function listClientsWithBrandCounts() {
  const db = await getDb();
  if (!db) return [];
  const all = await db.select().from(clients).orderBy(asc(clients.name));
  const out: (typeof all[number] & { brandCount: number })[] = [];
  for (const c of all) {
    const brandCount = await countBrandsForClient(c.id);
    out.push({ ...c, brandCount });
  }
  return out;
}

export async function deleteClientById(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(clients).where(eq(clients.id, id));
}

export async function updateClientPlan(
  id: number,
  plan: "free" | "starter" | "pro",
  planExpiresAt: Date | null,
  stripeCustomerId?: string | null
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(clients)
    .set({
      plan,
      planExpiresAt,
      ...(stripeCustomerId !== undefined ? { stripeCustomerId } : {}),
    })
    .where(eq(clients.id, id));
}

export async function updateClientStripeId(id: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(clients).set({ stripeCustomerId }).where(eq(clients.id, id));
}

// ─── Scheduled posts ──────────────────────────────────────────────────────────
export async function insertScheduledPost(row: InsertScheduledPost) {
  const db = await getDb();
  if (!db) return;
  await db.insert(scheduledPosts).values(row);
}

export async function listScheduledForBrand(brandId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.brandId, brandId),
        eq(scheduledPosts.status, "pending")
      )
    )
    .orderBy(scheduledPosts.scheduledFor);
}

export async function listUpcomingPendingScheduled(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.status, "pending"))
    .orderBy(scheduledPosts.scheduledFor)
    .limit(limit);
}

export async function getDueScheduledPosts(before: Date, limit = SCHEDULER_BATCH_LIMIT) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.status, "pending"),
        lte(scheduledPosts.scheduledFor, before)
      )
    )
    .orderBy(scheduledPosts.scheduledFor)
    .limit(limit);
}

export async function updateScheduledPostStatus(
  id: number,
  status: "pending" | "processing" | "published" | "cancelled" | "failed",
  errorMessage?: string | null
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(scheduledPosts)
    .set({
      status,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    })
    .where(eq(scheduledPosts.id, id));
}

export async function cancelScheduledPost(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(scheduledPosts)
    .set({ status: "cancelled" })
    .where(eq(scheduledPosts.id, id));
}

// ─── Approval queue ───────────────────────────────────────────────────────────
export async function insertApprovalQueue(row: InsertApprovalQueue) {
  const db = await getDb();
  if (!db) return;
  await db.insert(approvalQueue).values(row);
}

export async function countPendingApprovals() {
  const db = await getDb();
  if (!db) return 0;
  const r = await db
    .select({ n: count() })
    .from(approvalQueue)
    .where(eq(approvalQueue.status, "pending"));
  return Number(r[0]?.n ?? 0);
}

export async function listPendingApprovals() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(approvalQueue)
    .where(eq(approvalQueue.status, "pending"))
    .orderBy(desc(approvalQueue.createdAt));
}

export async function getApprovalById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(approvalQueue).where(eq(approvalQueue.id, id)).limit(1);
  return rows[0];
}

export async function setApprovalStatus(
  id: number,
  status: "approved" | "rejected" | "pending"
) {
  const db = await getDb();
  if (!db) return;
  await db.update(approvalQueue).set({ status }).where(eq(approvalQueue.id, id));
}

// ─── Posts (pipeline) ─────────────────────────────────────────────────────────
export async function getPostsByBrand(brandId: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(posts)
    .where(eq(posts.brandId, brandId))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
}

export async function getAllPosts(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(desc(posts.createdAt)).limit(limit);
}

export async function insertPost(post: InsertPost) {
  const db = await getDb();
  if (!db) return;
  await db.insert(posts).values(post);
}

export async function getPostStats() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ brandId: posts.brandId, total: count() })
    .from(posts)
    .groupBy(posts.brandId);
}

// ─── Pipeline Runs ────────────────────────────────────────────────────────────
export async function getRecentPipelineRuns(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pipelineRuns)
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(limit);
}

export async function getPipelineRunsByBrand(brandId: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.brandId, brandId))
    .orderBy(desc(pipelineRuns.startedAt))
    .limit(limit);
}

export async function insertPipelineRun(run: InsertPipelineRun) {
  const db = await getDb();
  if (!db) return;
  await db.insert(pipelineRuns).values(run);
}

export async function updatePipelineRun(
  id: number,
  update: Partial<
    Pick<
      InsertPipelineRun,
      | "status"
      | "postsGenerated"
      | "postsApproved"
      | "postsPublished"
      | "errorMessage"
      | "completedAt"
    >
  >
) {
  const db = await getDb();
  if (!db) return;
  await db.update(pipelineRuns).set(update).where(eq(pipelineRuns.id, id));
}

// ─── Analytics (publish_log) ─────────────────────────────────────────────────
export async function getPublishLogsInRange(
  brandId: string | null,
  clientId: number | null,
  from: Date,
  to: Date
) {
  const db = await getDb();
  if (!db) return [];
  const timeCond = and(
    gte(publishLog.publishedAt, from),
    lte(publishLog.publishedAt, to)
  );
  if (brandId) {
    return db
      .select()
      .from(publishLog)
      .where(and(eq(publishLog.brandId, brandId), timeCond))
      .orderBy(desc(publishLog.publishedAt));
  }
  if (clientId != null) {
    const brandRows = await db
      .select({ brandId: brands.brandId })
      .from(brands)
      .where(eq(brands.clientId, clientId));
    const ids = brandRows.map(b => b.brandId);
    if (ids.length === 0) return [];
    return db
      .select()
      .from(publishLog)
      .where(and(inArray(publishLog.brandId, ids), timeCond))
      .orderBy(desc(publishLog.publishedAt));
  }
  return db
    .select()
    .from(publishLog)
    .where(timeCond)
    .orderBy(desc(publishLog.publishedAt));
}

export async function getPublishCountByPlatform(
  brandId: string | null,
  clientId: number | null,
  from: Date,
  to: Date
): Promise<{ platform: string; n: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const timeCond = and(
    gte(publishLog.publishedAt, from),
    lte(publishLog.publishedAt, to),
    eq(publishLog.status, "success")
  );
  if (brandId) {
    return db
      .select({
        platform: publishLog.platform,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(publishLog)
      .where(and(eq(publishLog.brandId, brandId), timeCond))
      .groupBy(publishLog.platform);
  }
  if (clientId != null) {
    return db
      .select({
        platform: publishLog.platform,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(publishLog)
      .innerJoin(brands, eq(publishLog.brandId, brands.brandId))
      .where(and(eq(brands.clientId, clientId), timeCond))
      .groupBy(publishLog.platform);
  }
  return db
    .select({
      platform: publishLog.platform,
      n: sql<number>`count(*)`.mapWith(Number),
    })
    .from(publishLog)
    .where(timeCond)
    .groupBy(publishLog.platform);
}
