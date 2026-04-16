import { PLATFORMS, PLATFORM_CHAR_LIMIT, type PlatformId } from "@shared/constants";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { ENV } from "../_core/env";
import {
  dashboardProcedure,
  ownerProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "../_core/trpc";
import {
  getBrandByIdScoped,
  getPlatformCredentialsForBrand,
  insertApprovalQueue,
  getPublishLogsByBrand,
  getPostsByBrand,
  getAllPosts,
  getPostStats,
} from "../db";
import { runPublishToPlatforms } from "../publishJob";

const platformSchema = z.enum(PLATFORMS);

function credentialsMap(
  rows: Awaited<ReturnType<typeof getPlatformCredentialsForBrand>>
): Partial<Record<PlatformId, Record<string, string>>> {
  const out: Partial<Record<PlatformId, Record<string, string>>> = {};
  for (const r of rows) {
    out[r.platform as PlatformId] = r.credentials;
  }
  return out;
}

export const postsRouter = router({
  publish: dashboardProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        content: z.string().min(1),
        platforms: z.array(platformSchema).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const clientId = ctx.client?.id ?? null;
      const brand = await getBrandByIdScoped(input.brandId, clientId);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found or not accessible for this account.",
        });
      }
      if (!brand.active) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This brand is inactive — activate it before publishing.",
        });
      }

      const credRows = await getPlatformCredentialsForBrand(input.brandId);
      const credMap = credentialsMap(credRows);
      for (const p of input.platforms) {
        const limit = PLATFORM_CHAR_LIMIT[p];
        if (input.content.length > limit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Content exceeds ${p} limit of ${limit} characters.`,
          });
        }
        if (!credMap[p] || Object.keys(credMap[p]!).length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${p} credentials are missing for this brand — add them in brand settings first.`,
          });
        }
      }

      const postId = nanoid();

      if (brand.requiresApproval) {
        await insertApprovalQueue({
          postId,
          brandId: input.brandId,
          content: input.content,
          platforms: input.platforms,
          status: "pending",
        });
        return { queued: true as const, postId };
      }

      const outcomes = await runPublishToPlatforms({
        postId,
        brandId: input.brandId,
        content: input.content,
        platforms: input.platforms,
        credentialsByPlatform: credMap,
        simulated: ENV.simulatePublish,
      });

      return {
        queued: false as const,
        postId,
        results: outcomes.map(o => ({
          platform: o.platform,
          success: o.result.success,
          postUrl: o.result.postUrl,
          errorMessage: o.result.errorMessage,
        })),
      };
    }),

  generate: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        hint: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const brand = await getBrandByIdScoped(input.brandId, null);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found.",
        });
      }
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You write short social posts for ${brand.name}. Tone: ${brand.tone ?? "clear and direct"}. Audience: ${brand.audience ?? "general"}.`,
            },
            {
              role: "user",
              content:
                input.hint?.trim() ||
                `Write one concise social post (under 280 characters) for ${brand.name}. No hashtags unless essential.`,
            },
          ],
        });
        const raw = response?.choices?.[0]?.message?.content;
        const text =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.map(p => ("text" in p ? p.text : "")).join("\n")
              : "";
        const trimmed = text.trim();
        if (!trimmed) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI returned empty content — try again or adjust the hint.",
          });
        }
        const normalized = trimmed.length > 280 ? `${trimmed.slice(0, 277)}...` : trimmed;
        return { content: normalized };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[Posts:generate]", msg);
        if (e instanceof TRPCError) throw e;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `AI generation failed: ${msg}`,
        });
      }
    }),

  publishLogByBrand: dashboardProcedure
    .input(z.object({ brandId: z.string().min(1), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const clientId = ctx.client?.id ?? null;
      const brand = await getBrandByIdScoped(input.brandId, clientId);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found or not accessible for this account.",
        });
      }
      const rows = await getPublishLogsByBrand(input.brandId, input.limit ?? 20);
      return rows.map(r => ({
        id: r.id,
        postId: r.postId,
        brandId: r.brandId,
        platform: r.platform,
        status: r.status,
        postUrl: r.postUrl,
        errorMessage: r.errorMessage,
        simulated: r.simulated,
        publishedAt: r.publishedAt,
      }));
    }),

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
});
