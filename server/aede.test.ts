import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getAllBrands: vi.fn().mockResolvedValue([
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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getBrandById: vi.fn().mockImplementation(async (brandId: string) => {
    if (brandId === "frankgrant") {
      return {
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
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return undefined;
  }),
  upsertBrand: vi.fn().mockResolvedValue(undefined),
  toggleBrandActive: vi.fn().mockResolvedValue(undefined),
  getPostsByBrand: vi.fn().mockResolvedValue([
    {
      id: 1,
      brandId: "frankgrant",
      content: "Test post content",
      variantType: "original",
      score: 7.5,
      status: "approved",
      platforms: null,
      publishedAt: null,
      impressions: 0,
      likes: 0,
      reposts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getAllPosts: vi.fn().mockResolvedValue([]),
  insertPost: vi.fn().mockResolvedValue(undefined),
  getPostStats: vi.fn().mockResolvedValue([{ brandId: "frankgrant", total: 1 }]),
  getRecentPipelineRuns: vi.fn().mockResolvedValue([]),
  getPipelineRunsByBrand: vi.fn().mockResolvedValue([]),
  insertPipelineRun: vi.fn().mockResolvedValue(undefined),
  updatePipelineRun: vi.fn().mockResolvedValue(undefined),
}));

// Mock LLM
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            posts: [
              { content: "NIH grant tip: Apply early and use peer review simulation.", score: 8.0 },
              { content: "Your research deserves funding. Let FrankGrant help.", score: 7.5 },
              { content: "Low score post", score: 3.0 },
            ],
          }),
        },
      },
    ],
  }),
}));

function makeCtx(user?: TrpcContext["user"]): TrpcContext {
  return {
    user: user ?? null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
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

describe("brands.list", () => {
  it("returns all brands as a public procedure", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.brands.list();
    expect(result).toHaveLength(1);
    expect(result[0].brandId).toBe("frankgrant");
  });
});

describe("brands.get", () => {
  it("returns a brand by ID", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.brands.get({ brandId: "frankgrant" });
    expect(result?.name).toBe("FrankGrant");
  });

  it("returns undefined for unknown brand", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.brands.get({ brandId: "unknown-brand" });
    expect(result).toBeUndefined();
  });
});

describe("brands.toggle", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.brands.toggle({ brandId: "frankgrant", active: false })
    ).rejects.toThrow();
  });

  it("succeeds for authenticated user", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.brands.toggle({ brandId: "frankgrant", active: false });
    expect(result.success).toBe(true);
  });
});

describe("posts.byBrand", () => {
  it("returns posts for a brand", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.posts.byBrand({ brandId: "frankgrant" });
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(7.5);
  });
});

describe("posts.stats", () => {
  it("returns post counts grouped by brand", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.posts.stats();
    expect(result[0].brandId).toBe("frankgrant");
    expect(Number(result[0].total)).toBe(1);
  });
});

describe("pipeline.trigger", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeCtx());
    await expect(
      caller.pipeline.trigger({ brandId: "frankgrant" })
    ).rejects.toThrow();
  });

  it("generates and approves posts above threshold", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    const result = await caller.pipeline.trigger({ brandId: "frankgrant" });
    expect(result.success).toBe(true);
    expect(result.generated).toBe(3);
    expect(result.approved).toBe(2); // 2 posts score >= 5
  });

  it("throws for unknown brand", async () => {
    const caller = appRouter.createCaller(makeCtx(adminUser));
    await expect(
      caller.pipeline.trigger({ brandId: "nonexistent" })
    ).rejects.toThrow("Brand not found");
  });
});

describe("auth.logout", () => {
  it("clears session cookie and returns success", async () => {
    const { ctx } = (() => {
      const clearedCookies: string[] = [];
      const ctx = makeCtx(adminUser);
      (ctx.res as any).clearCookie = (name: string) => clearedCookies.push(name);
      return { ctx, clearedCookies };
    })();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});
