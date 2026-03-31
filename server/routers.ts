import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getAllBrands,
  getBrandById,
  upsertBrand,
  toggleBrandActive,
  getPostsByBrand,
  getAllPosts,
  insertPost,
  getPostStats,
  getRecentPipelineRuns,
  getPipelineRunsByBrand,
  insertPipelineRun,
  updatePipelineRun,
} from "./db";
import { invokeLLM } from "./_core/llm";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  brands: router({
    list: publicProcedure.query(async () => {
      return getAllBrands();
    }),

    get: publicProcedure
      .input(z.object({ brandId: z.string() }))
      .query(async ({ input }) => {
        return getBrandById(input.brandId);
      }),

    upsert: protectedProcedure
      .input(z.object({
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
      }))
      .mutation(async ({ input }) => {
        await upsertBrand(input);
        return { success: true };
      }),

    toggle: protectedProcedure
      .input(z.object({ brandId: z.string(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleBrandActive(input.brandId, input.active);
        return { success: true };
      }),
  }),

  posts: router({
    byBrand: publicProcedure
      .input(z.object({ brandId: z.string(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        return getPostsByBrand(input.brandId, input.limit ?? 50);
      }),

    all: publicProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return getAllPosts(input?.limit ?? 100);
      }),

    stats: publicProcedure.query(async () => {
      return getPostStats();
    }),
  }),

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

        // Insert a running pipeline record
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
          const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
          const generatedPosts: { content: string; score: number }[] = parsed.posts ?? [];

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
