import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  COOKIE_NAME,
  DASHBOARD_SESSION_COOKIE,
  ONE_YEAR_MS,
  PLATFORMS,
} from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import {
  dashboardProcedure,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { systemRouter } from "./_core/systemRouter";
import {
  getAllBrands,
  getBrandByIdScoped,
  getBrandById,
  upsertBrand,
  toggleBrandActive,
  updateBrandSchedule,
  getPostsByBrand,
  getAllPosts,
  insertPost,
  getPostStats,
  getRecentPipelineRuns,
  getPipelineRunsByBrand,
  insertPipelineRun,
  updatePipelineRun,
  insertDashboardSession,
  upsertPlatformCredential,
  getPlatformCredentialsForBrand,
} from "./db";
import { postsRouter } from "./routers/posts";
import { scheduleRouter } from "./routers/schedule";
import { clientsRouter } from "./routers/clients";
import { billingRouter } from "./routers/billing";
import { approvalRouter } from "./routers/approval";
import { analyticsRouter } from "./routers/analytics";

const platformSchema = z.enum(PLATFORMS);

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (ctx.client) {
        return {
          kind: "client" as const,
          client: {
            id: ctx.client.id,
            name: ctx.client.name,
            email: ctx.client.email,
            plan: ctx.client.plan,
          },
        };
      }
      if (ctx.user) {
        return { kind: "owner" as const, user: ctx.user };
      }
      return null;
    }),

    dashboardLogin: publicProcedure
      .input(z.object({ password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!ENV.dashboardPasswordHash) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Dashboard password login is not configured — set DASHBOARD_PASSWORD_HASH (bcrypt).",
          });
        }
        const ok = await bcrypt.compare(input.password, ENV.dashboardPasswordHash);
        if (!ok) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid password.",
          });
        }
        const token = nanoid(48);
        const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
        await insertDashboardSession({
          token,
          expiresAt,
          clientId: null,
        });
        const opts = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(DASHBOARD_SESSION_COOKIE, token, {
          ...opts,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true as const };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(DASHBOARD_SESSION_COOKIE, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  brands: router({
    list: dashboardProcedure.query(async ({ ctx }) => {
      return getAllBrands(ctx.client?.id);
    }),

    all: dashboardProcedure.query(async ({ ctx }) => {
      return getAllBrands(ctx.client?.id);
    }),

    get: dashboardProcedure
      .input(z.object({ brandId: z.string() }))
      .query(async ({ ctx, input }) => {
        return getBrandByIdScoped(input.brandId, ctx.client?.id ?? null);
      }),

    upsert: ownerProcedure
      .input(
        z.object({
          brandId: z.string(),
          name: z.string(),
          description: z.string().optional(),
          audience: z.string().optional(),
          tone: z.string().optional(),
          url: z.string().optional(),
          schedule: z.string().optional(),
          accentColor: z.string().optional(),
          active: z.boolean().optional(),
          cta: z.string().optional(),
          clientId: z.number().nullable().optional(),
          requiresApproval: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await upsertBrand(input as Parameters<typeof upsertBrand>[0]);
        return { success: true };
      }),

    toggle: ownerProcedure
      .input(z.object({ brandId: z.string(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleBrandActive(input.brandId, input.active);
        return { success: true };
      }),

    updateSchedule: ownerProcedure
      .input(
        z.object({
          brandId: z.string(),
          frequency: z.enum(["daily", "weekly", "monthly", "off"]),
          postTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:MM format"),
          postDays: z.array(z.union([z.string(), z.number()])).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateBrandSchedule(input.brandId, {
          frequency: input.frequency,
          postTime: input.postTime,
          postDays: input.postDays,
        });
        return { success: true };
      }),

    listCredentialPlatforms: dashboardProcedure
      .input(z.object({ brandId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const brand = await getBrandByIdScoped(
          input.brandId,
          ctx.client?.id ?? null
        );
        if (!brand) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found or not accessible for this account.",
          });
        }
        const rows = await getPlatformCredentialsForBrand(input.brandId);
        return rows.map(r => r.platform);
      }),

    setPlatformCredentials: ownerProcedure
      .input(
        z.object({
          brandId: z.string().min(1),
          platform: platformSchema,
          credentials: z.record(z.string(), z.string()),
        })
      )
      .mutation(async ({ input }) => {
        const brand = await getBrandById(input.brandId);
        if (!brand) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Brand not found.",
          });
        }
        await upsertPlatformCredential(
          input.brandId,
          input.platform,
          input.credentials
        );
        return { success: true as const };
      }),
  }),

  posts: postsRouter,

  schedule: scheduleRouter,

  clients: clientsRouter,

  billing: billingRouter,

  approval: approvalRouter,

  analytics: analyticsRouter,

  pipeline: router({
    recent: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getRecentPipelineRuns(input?.limit ?? 20);
      }),

    byBrand: publicProcedure
      .input(z.object({ brandId: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getPipelineRunsByBrand(input.brandId, input.limit ?? 10);
      }),

    trigger: protectedProcedure
      .input(z.object({ brandId: z.string() }))
      .mutation(async ({ input }) => {
        const brand = await getBrandById(input.brandId);
        if (!brand) throw new Error("Brand not found");

        await insertPipelineRun({
          brandId: input.brandId,
          status: "running",
          postsGenerated: 0,
          postsApproved: 0,
          postsPublished: 0,
          startedAt: new Date(),
        });

        try {
          const response = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `You are a social media content strategist for ${brand.name}. ${brand.description ?? ""}`,
              },
              {
                role: "user",
                content: `Generate 3 high-quality social media posts for ${brand.name}.
Audience: ${brand.audience ?? "general"}
Tone: ${brand.tone ?? "professional"}
CTA: ${brand.cta ?? ""}

Return JSON with a posts array. Each post max 280 chars. Score 1-10 for quality.`,
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "posts",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    posts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          content: { type: "string" },
                          score: { type: "number" },
                        },
                        required: ["content", "score"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["posts"],
                  additionalProperties: false,
                },
              },
            },
          });

          const raw = response?.choices?.[0]?.message?.content ?? "{}";
          const parsed = JSON.parse(
            typeof raw === "string" ? raw : JSON.stringify(raw)
          );
          const generatedPosts: { content: string; score: number }[] =
            parsed.posts ?? [];

          let approved = 0;
          for (const p of generatedPosts) {
            if (p.score >= 5) {
              await insertPost({
                brandId: input.brandId,
                content: p.content,
                score: p.score,
                status: "approved",
                variantType: "original",
              });
              approved++;
            }
          }

          const runs = await getPipelineRunsByBrand(input.brandId, 1);
          const runId = runs[0]?.id;
          if (runId) {
            await updatePipelineRun(runId, {
              status: "completed",
              postsGenerated: generatedPosts.length,
              postsApproved: approved,
              postsPublished: 0,
              completedAt: new Date(),
            });
          }

          return { success: true, generated: generatedPosts.length, approved };
        } catch (err) {
          const runs = await getPipelineRunsByBrand(input.brandId, 1);
          const runId = runs[0]?.id;
          if (runId) {
            await updatePipelineRun(runId, {
              status: "failed",
              errorMessage: String(err),
              completedAt: new Date(),
            });
          }
          throw err;
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
