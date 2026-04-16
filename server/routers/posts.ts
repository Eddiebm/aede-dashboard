import {
  PLATFORMS,
  PLATFORM_CHAR_LIMIT,
  type PlatformId,
  LEARNING_CTA_KEYWORDS,
  LEARNING_LOOKBACK_DAYS,
  DEFAULT_TEXT_CHAR_LIMIT,
  THREADS_GRAPH_BASE,
} from "@shared/constants";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { TwitterApi } from "twitter-api-v2";
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
  getTopEngagementSignalsForBrand,
  listSuccessfulPublishLogsForEngagementSync,
  updatePublishLogEngagement,
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

function parseTwitterStatusId(url: string): string | null {
  const match = url.match(/status\/(\d+)/i);
  return match?.[1] ?? null;
}

function parseMastodonStatusId(url: string): string | null {
  const m = url.match(/\/(\d+)(?:\?.*)?$/);
  return m?.[1] ?? null;
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
        platforms: z.array(platformSchema).optional(),
        variants: z.number().int().min(1).max(3).optional(),
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
        const requestedPlatforms = input.platforms ?? [];
        const limitForGeneration =
          requestedPlatforms.length > 0
            ? Math.min(...requestedPlatforms.map(p => PLATFORM_CHAR_LIMIT[p]))
            : DEFAULT_TEXT_CHAR_LIMIT;

        const lookbackSignals = await Promise.all(
          requestedPlatforms.length > 0
            ? requestedPlatforms.map(async p => ({
                platform: p,
                signals: await getTopEngagementSignalsForBrand({
                  brandId: input.brandId,
                  platforms: [p],
                  limit: 10,
                }),
              }))
            : [
                {
                  platform: null as unknown as PlatformId,
                  signals: await getTopEngagementSignalsForBrand({
                    brandId: input.brandId,
                    limit: 10,
                  }),
                },
              ]
        );

        const notes = [];
        for (const group of lookbackSignals) {
          const signals = group.signals;
          if (!signals || signals.length === 0) continue;
          const lengths = signals.map(s => s.content.length);
          const avgLen =
            lengths.reduce((a, n) => a + n, 0) / Math.max(1, lengths.length);

          const allText = signals.map(s => s.content).join("\n---\n");
          const lower = allText.toLowerCase();

          const usesQuestion =
            signals.some(s => s.content.slice(0, 80).includes("?")) ||
            lower.includes("?");
          const usesExclaim = lower.includes("!");

          const tail = signals
            .map(s => s.content.slice(Math.max(0, s.content.length - 90)))
            .join("\n")
            .toLowerCase();

          const keywordHits = LEARNING_CTA_KEYWORDS.map(k => ({
            k,
            n: (tail.match(new RegExp(`\\b${k}\\b`, "g")) ?? []).length,
          })).sort((a, b) => b.n - a.n);

          const topCta = keywordHits[0]?.n ? keywordHits[0].k : null;

          const tone =
            usesQuestion && usesExclaim
              ? "energetic + question-driven"
              : usesQuestion
              ? "question-driven"
              : usesExclaim
              ? "energetic"
              : "direct + clear";

          const header =
            requestedPlatforms.length > 0 && group.platform
              ? `On ${group.platform}:`
              : "Across platforms:";

          notes.push(
            `${header} recent winners average ~${Math.round(
              avgLen
            )} chars, tone is ${tone}${
              topCta ? `, CTA keyword "${topCta}" appears often` : ""
            }`
          );
        }

        const patternBlock =
          notes.length > 0
            ? `Recent performance patterns (engagement-weighted, last ${LEARNING_LOOKBACK_DAYS} days):\n- ${notes.join("\n- ")}\n`
            : `No reliable performance history yet — use brand tone and keep it concise.`;

        const variantCount = input.variants ?? 1;
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You write short social posts for ${brand.name}. Tone: ${brand.tone ?? "clear and direct"}. Audience: ${brand.audience ?? "general"}. ${patternBlock} Generate ${variantCount} distinct variants. Each variant must be within ${limitForGeneration} characters.`,
            },
            {
              role: "user",
              content:
                `${input.hint?.trim() || ""}\n${
                  requestedPlatforms.length > 0
                    ? `Target platforms: ${requestedPlatforms.join(", ")}.`
                    : `Target platforms: any.`
                }\nReturn ONLY JSON with a ` +
                "`variants`" +
                ` array of strings. Avoid hashtags unless essential.`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "variants",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  variants: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: ["variants"],
                additionalProperties: false,
              },
            },
          },
        });

        const raw = response?.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(
          typeof raw === "string" ? raw : JSON.stringify(raw)
        ) as { variants?: string[] };

        const variants = Array.isArray(parsed.variants)
          ? parsed.variants
          : [];
        if (variants.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "AI returned no variants — try again or adjust the hint.",
          });
        }

        const truncateToLimit = (txt: string) => {
          const t = txt.trim();
          if (t.length <= limitForGeneration) return t;
          const head = t.slice(0, Math.max(0, limitForGeneration - 3));
          return `${head}...`;
        };

        const safeVariants = variants
          .slice(0, variantCount)
          .map(v => truncateToLimit(v))
          .filter(v => v.length > 0);

        if (safeVariants.length === 0) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "AI variants were empty after trimming — try again.",
          });
        }

        if (variantCount === 1) {
          return { content: safeVariants[0] };
        }

        return { content: safeVariants[0], variants: safeVariants };
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

  syncEngagement: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        platforms: z.array(platformSchema).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const brand = await getBrandByIdScoped(input.brandId, null);
      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found." });
      }

      const logs = await listSuccessfulPublishLogsForEngagementSync({
        brandId: input.brandId,
        platforms: input.platforms,
        limit: input.limit ?? 50,
      });
      const creds = credentialsMap(await getPlatformCredentialsForBrand(input.brandId));

      const updated: Array<{
        id: number;
        platform: PlatformId;
        likes: number;
        reposts: number;
        clicks: number;
        impressions: number;
      }> = [];
      const failed: Array<{ id: number; platform: PlatformId; message: string }> = [];

      for (const row of logs) {
        const platform = row.platform as PlatformId;
        const postUrl = row.postUrl ?? "";
        try {
          if (platform === "twitter") {
            const id = parseTwitterStatusId(postUrl);
            const c = creds.twitter;
            if (!id || !c) {
              failed.push({
                id: row.id,
                platform,
                message: "Twitter sync requires tweet URL and credentials.",
              });
              continue;
            }
            const client = new TwitterApi({
              appKey: c.apiKey,
              appSecret: c.apiSecret,
              accessToken: c.accessToken,
              accessSecret: c.accessTokenSecret,
            });
            const tweet = await client.v2.singleTweet(id, {
              "tweet.fields": ["public_metrics"],
            });
            const m = tweet.data.public_metrics;
            await updatePublishLogEngagement(row.id, {
              likes: m?.like_count ?? 0,
              reposts: m?.retweet_count ?? 0,
              clicks: m?.reply_count ?? 0,
              impressions: 0,
            });
            updated.push({
              id: row.id,
              platform,
              likes: m?.like_count ?? 0,
              reposts: m?.retweet_count ?? 0,
              clicks: m?.reply_count ?? 0,
              impressions: 0,
            });
            continue;
          }

          if (platform === "mastodon") {
            const c = creds.mastodon;
            const statusId = parseMastodonStatusId(postUrl);
            const instanceUrl = c?.instanceUrl?.replace(/\/+$/, "");
            if (!c?.accessToken || !instanceUrl || !statusId) {
              failed.push({
                id: row.id,
                platform,
                message:
                  "Mastodon sync requires instanceUrl/accessToken credentials and a status URL ending with numeric id.",
              });
              continue;
            }
            const res = await fetch(`${instanceUrl}/api/v1/statuses/${statusId}`, {
              headers: { Authorization: `Bearer ${c.accessToken}` },
            });
            if (!res.ok) {
              const message = await res.text().catch(() => res.statusText);
              failed.push({
                id: row.id,
                platform,
                message: `Mastodon API ${res.status}: ${message}`,
              });
              continue;
            }
            const data = (await res.json()) as {
              favourites_count?: number;
              reblogs_count?: number;
              replies_count?: number;
            };
            await updatePublishLogEngagement(row.id, {
              likes: Number(data.favourites_count ?? 0),
              reposts: Number(data.reblogs_count ?? 0),
              clicks: Number(data.replies_count ?? 0),
              impressions: 0,
            });
            updated.push({
              id: row.id,
              platform,
              likes: Number(data.favourites_count ?? 0),
              reposts: Number(data.reblogs_count ?? 0),
              clicks: Number(data.replies_count ?? 0),
              impressions: 0,
            });
            continue;
          }

          if (platform === "threads") {
            const c = creds.threads;
            const postId = postUrl.trim();
            if (!c?.accessToken || !postId) {
              failed.push({
                id: row.id,
                platform,
                message: "Threads sync requires accessToken credentials and a stored post id.",
              });
              continue;
            }
            const fields =
              "like_count,replies_count,reposts_count,quotes_count,views";
            const res = await fetch(
              `${THREADS_GRAPH_BASE}/${encodeURIComponent(
                postId
              )}?fields=${fields}&access_token=${encodeURIComponent(c.accessToken)}`
            );
            if (!res.ok) {
              const message = await res.text().catch(() => res.statusText);
              failed.push({
                id: row.id,
                platform,
                message: `Threads API ${res.status}: ${message}`,
              });
              continue;
            }
            const data = (await res.json()) as {
              like_count?: number;
              replies_count?: number;
              reposts_count?: number;
              quotes_count?: number;
              views?: number;
            };
            const reposts =
              Number(data.reposts_count ?? 0) + Number(data.quotes_count ?? 0);
            await updatePublishLogEngagement(row.id, {
              likes: Number(data.like_count ?? 0),
              reposts,
              clicks: Number(data.replies_count ?? 0),
              impressions: Number(data.views ?? 0),
            });
            updated.push({
              id: row.id,
              platform,
              likes: Number(data.like_count ?? 0),
              reposts,
              clicks: Number(data.replies_count ?? 0),
              impressions: Number(data.views ?? 0),
            });
            continue;
          }

          failed.push({
            id: row.id,
            platform,
            message: `${platform} engagement sync is not supported yet.`,
          });
        } catch (e) {
          failed.push({
            id: row.id,
            platform,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }

      return {
        scanned: logs.length,
        updatedCount: updated.length,
        failedCount: failed.length,
        updated,
        failed,
      };
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
