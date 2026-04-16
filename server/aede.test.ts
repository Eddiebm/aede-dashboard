import bcrypt from "bcryptjs";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { runPublishToPlatforms } from "./publishJob";
import { DASHBOARD_SESSION_COOKIE } from "@shared/constants";

vi.mock("./db", () => ({
  getAllBrands: vi.fn(),
  getBrandById: vi.fn(),
  getBrandByIdScoped: vi.fn(),
  upsertBrand: vi.fn(),
  toggleBrandActive: vi.fn(),
  updateBrandSchedule: vi.fn(),
  getPostsByBrand: vi.fn(),
  getAllPosts: vi.fn(),
  insertPost: vi.fn(),
  getPostStats: vi.fn(),
  getRecentPipelineRuns: vi.fn(),
  getPipelineRunsByBrand: vi.fn(),
  insertPipelineRun: vi.fn(),
  updatePipelineRun: vi.fn(),
  getPlatformCredentialsForBrand: vi.fn(),
  insertApprovalQueue: vi.fn(),
  getPublishLogsByBrand: vi.fn(),
  insertScheduledPost: vi.fn(),
  listScheduledForBrand: vi.fn(),
  cancelScheduledPost: vi.fn(),
  insertClient: vi.fn(),
  getClientByEmail: vi.fn(),
  listClientsWithBrandCounts: vi.fn(),
  deleteClientById: vi.fn(),
  insertDashboardSession: vi.fn(),
  getApprovalById: vi.fn(),
  listPendingApprovals: vi.fn(),
  setApprovalStatus: vi.fn(),
  countPendingApprovals: vi.fn(),
  getPublishLogsInRange: vi.fn(),
  getPublishCountByPlatform: vi.fn(),
  countPublishLogsSince: vi.fn(),
  countTotalBrands: vi.fn(),
  updateClientPlan: vi.fn(),
  updateClientStripeId: vi.fn(),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./publishJob", () => ({
  runPublishToPlatforms: vi.fn(),
}));

function makeCtx(user?: TrpcContext["user"], client?: TrpcContext["client"]): TrpcContext {
  return {
    user: user ?? null,
    client: client ?? null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn(), cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const adminUser: NonNullable<TrpcContext["user"]> = {
  id: 1,
  openId: "owner-open-id",
  name: "Eddie",
  email: "eddie@coare.com",
  loginMethod: "manus",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getAllBrands).mockResolvedValue([
    {
      id: 1,
      brandId: "frankgrant",
      name: "FrankGrant",
      description: "NIH grant writing",
      audience: "Researchers",
      tone: "Authoritative",
      url: "https://frankgrant.pages.dev",
      schedule: "0 7 * * *",
      accentColor: "#1a6b3c",
      active: true,
      cta: "Start your grant",
      frequency: "daily",
      postTime: "09:00",
      postDays: null,
      clientId: null,
      requiresApproval: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as any);
  vi.mocked(db.getBrandById).mockResolvedValue({
    brandId: "frankgrant",
    name: "FrankGrant",
    active: true,
    description: "NIH grant writing",
    audience: "Researchers",
    tone: "Authoritative",
    cta: "Start your grant",
  } as any);
  vi.mocked(db.getBrandByIdScoped).mockResolvedValue({
    brandId: "frankgrant",
    name: "FrankGrant",
    active: true,
    requiresApproval: false,
    clientId: null,
  } as any);
  vi.mocked(db.getPostsByBrand).mockResolvedValue([
    { id: 1, brandId: "frankgrant", content: "Test", score: 7.5 },
  ] as any);
  vi.mocked(db.getAllPosts).mockResolvedValue([]);
  vi.mocked(db.getPostStats).mockResolvedValue([{ brandId: "frankgrant", total: 1 }] as any);
  vi.mocked(db.getPipelineRunsByBrand).mockResolvedValue([]);
  vi.mocked(db.getPlatformCredentialsForBrand).mockResolvedValue([
    {
      platform: "twitter",
      credentials: {
        apiKey: "k",
        apiSecret: "s",
        accessToken: "at",
        accessTokenSecret: "ats",
      },
    },
  ] as any);
  vi.mocked(db.getPublishLogsByBrand).mockResolvedValue([]);
  vi.mocked(invokeLLM).mockResolvedValue({
    choices: [{ message: { content: "Generated test content." } }],
  } as any);
  vi.mocked(runPublishToPlatforms).mockResolvedValue([
    { platform: "twitter", result: { success: true, postUrl: "https://x.com/post/1" } },
  ] as any);
});

describe("brands.list", () => {
  it("returns all brands for authenticated actor", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.brands.list();
    expect(result).toHaveLength(1);
    expect(result[0].brandId).toBe("frankgrant");
  });
});

describe("Required AEDE router tests", () => {
  it("posts.publish publishes to selected platforms", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.posts.publish({
      brandId: "frankgrant",
      content: "Hello X",
      platforms: ["twitter"],
    });
    expect(result.queued).toBe(false);
    if (!result.queued) {
      expect(result.results[0]?.success).toBe(true);
    }
    expect(runPublishToPlatforms).toHaveBeenCalledTimes(1);
  });

  it("posts.generate returns LLM text content", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.posts.generate({ brandId: "frankgrant" });
    expect(result.content).toContain("Generated");
  });

  it("schedule.create inserts scheduled post", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const when = new Date(Date.now() + 60_000);
    const result = await caller.schedule.create({
      brandId: "frankgrant",
      content: "Schedule me",
      platforms: ["twitter"],
      scheduledFor: when,
    });
    expect(result.success).toBe(true);
    expect(db.insertScheduledPost).toHaveBeenCalledTimes(1);
  });

  it("clients.invite hashes password and stores new client", async () => {
    vi.mocked(db.getClientByEmail).mockResolvedValue(undefined);
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.clients.invite({
      name: "Acme",
      email: "acme@example.com",
      tempPassword: "temp-pass-123",
    });
    expect(result.success).toBe(true);
    expect(db.insertClient).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(db.insertClient).mock.calls[0]?.[0] as any;
    expect(payload.passwordHash).not.toBe("temp-pass-123");
  });

  it("clients.clientLogin creates session and sets cookie", async () => {
    const hash = await bcrypt.hash("secret-pass", 10);
    vi.mocked(db.getClientByEmail).mockResolvedValue({
      id: 11,
      name: "Client A",
      email: "client@example.com",
      passwordHash: hash,
      plan: "free",
    } as any);
    const ctx = makeCtx();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.clients.clientLogin({
      email: "client@example.com",
      password: "secret-pass",
    });
    expect(result.success).toBe(true);
    expect(db.insertDashboardSession).toHaveBeenCalledTimes(1);
    expect((ctx.res as any).cookie).toHaveBeenCalledWith(
      DASHBOARD_SESSION_COOKIE,
      expect.any(String),
      expect.objectContaining({ maxAge: expect.any(Number) })
    );
  });

  it("approval.approve publishes queued item and marks approved", async () => {
    vi.mocked(db.getApprovalById).mockResolvedValue({
      id: 17,
      postId: "post-17",
      brandId: "frankgrant",
      content: "Needs approval",
      platforms: ["twitter"],
      status: "pending",
    } as any);
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.approval.approve({ id: 17 });
    expect(result.success).toBe(true);
    expect(db.setApprovalStatus).toHaveBeenCalledWith(17, "approved");
    expect(runPublishToPlatforms).toHaveBeenCalledTimes(1);
  });
});
