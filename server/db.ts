import { eq, desc, count } from "drizzle-orm";
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
} from "../drizzle/schema";
import { ENV } from "./_core/env";

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
export async function getAllBrands() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(brands).orderBy(brands.name);
}

export async function getBrandById(brandId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(brands).where(eq(brands.brandId, brandId)).limit(1);
  return result[0];
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
    },
  });
}

export async function toggleBrandActive(brandId: string, active: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(brands).set({ active }).where(eq(brands.brandId, brandId));
}

// ─── Posts ────────────────────────────────────────────────────────────────────
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
