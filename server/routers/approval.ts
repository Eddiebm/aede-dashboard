import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ENV } from "../_core/env";
import { ownerProcedure, router } from "../_core/trpc";
import {
  getApprovalById,
  listPendingApprovals,
  setApprovalStatus,
  getBrandByIdScoped,
  getPlatformCredentialsForBrand,
  countPendingApprovals,
} from "../db";
import { runPublishToPlatforms } from "../publishJob";
import type { PlatformId } from "@shared/constants";

function credentialsMap(
  rows: Awaited<ReturnType<typeof getPlatformCredentialsForBrand>>
): Partial<Record<PlatformId, Record<string, string>>> {
  const out: Partial<Record<PlatformId, Record<string, string>>> = {};
  for (const r of rows) {
    out[r.platform as PlatformId] = r.credentials;
  }
  return out;
}

export const approvalRouter = router({
  pendingCount: ownerProcedure.query(async () => {
    return { count: await countPendingApprovals() };
  }),

  list: ownerProcedure.query(async () => {
    const rows = await listPendingApprovals();
    return rows.map(r => ({
      id: r.id,
      postId: r.postId,
      brandId: r.brandId,
      content: r.content,
      platforms: r.platforms,
      createdAt: r.createdAt,
    }));
  }),

  approve: ownerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const row = await getApprovalById(input.id);
      if (!row || row.status !== "pending") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval item not found or already processed.",
        });
      }
      const brand = await getBrandByIdScoped(row.brandId, null);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand no longer exists for this approval.",
        });
      }
      const credRows = await getPlatformCredentialsForBrand(row.brandId);
      const credMap = credentialsMap(credRows);
      const platforms = row.platforms as PlatformId[];
      await runPublishToPlatforms({
        postId: row.postId,
        brandId: row.brandId,
        content: row.content,
        platforms,
        credentialsByPlatform: credMap,
        simulated: ENV.simulatePublish,
      });
      await setApprovalStatus(row.id, "approved");
      return { success: true as const, postId: row.postId };
    }),

  reject: ownerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const row = await getApprovalById(input.id);
      if (!row || row.status !== "pending") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Approval item not found or already processed.",
        });
      }
      await setApprovalStatus(row.id, "rejected");
      return { success: true as const };
    }),
});
