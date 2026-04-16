import { z } from "zod";
import { ownerProcedure, router } from "../_core/trpc";
import {
  getPublishLogsInRange,
  getPublishCountByPlatform,
  getAllBrands,
} from "../db";

export const analyticsRouter = router({
  report: ownerProcedure
    .input(
      z.object({
        brandId: z.string().nullable().optional(),
        from: z.date(),
        to: z.date(),
      })
    )
    .query(async ({ input }) => {
      const brandId = input.brandId ?? null;
      const logs = await getPublishLogsInRange(brandId, null, input.from, input.to);
      const byPlatform = await getPublishCountByPlatform(brandId, null, input.from, input.to);
      const totalPosts = logs.filter(l => l.status === "success").length;
      const topPlatform = byPlatform.sort((a, b) => b.n - a.n)[0]?.platform ?? null;
      const brands = await getAllBrands();
      const brandCounts = new Map<string, number>();
      for (const l of logs) {
        if (l.status !== "success") continue;
        brandCounts.set(l.brandId, (brandCounts.get(l.brandId) ?? 0) + 1);
      }
      let mostActiveBrandId: string | null = null;
      let maxB = 0;
      for (const [bid, n] of Array.from(brandCounts.entries())) {
        if (n > maxB) {
          maxB = n;
          mostActiveBrandId = bid;
        }
      }
      const mostActiveBrandName =
        mostActiveBrandId != null
          ? brands.find(b => b.brandId === mostActiveBrandId)?.name ?? mostActiveBrandId
          : null;
      const totalReach = logs.reduce(
        (acc, l) =>
          acc +
          (l.impressions ?? 0) +
          (l.likes ?? 0) +
          (l.reposts ?? 0) +
          (l.clicks ?? 0),
        0
      );
      const perDay = new Map<string, number>();
      for (const l of logs) {
        if (l.status !== "success") continue;
        const d = new Date(l.publishedAt).toISOString().slice(0, 10);
        perDay.set(d, (perDay.get(d) ?? 0) + 1);
      }
      const postsOverTime = Array.from(perDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      return {
        summary: {
          totalPosts,
          topPlatform,
          mostActiveBrand: mostActiveBrandName,
          totalReach,
        },
        byPlatform: byPlatform.map(r => ({ platform: r.platform, count: r.n })),
        postsOverTime,
        recent: logs.slice(0, 50).map(l => ({
          id: l.id,
          platform: l.platform,
          status: l.status,
          brandId: l.brandId,
          postUrl: l.postUrl,
          errorMessage: l.errorMessage,
          publishedAt: l.publishedAt,
          impressions: l.impressions ?? 0,
          likes: l.likes ?? 0,
          reposts: l.reposts ?? 0,
          clicks: l.clicks ?? 0,
        })),
      };
    }),
});
