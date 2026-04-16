import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { dashboardProcedure, ownerProcedure, router } from "../_core/trpc";
import {
  getBrandByIdScoped,
  insertScheduledPost,
  listScheduledForBrand,
  cancelScheduledPost,
} from "../db";
import { PLATFORMS } from "@shared/constants";

const platformSchema = z.enum(PLATFORMS);

export const scheduleRouter = router({
  create: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        content: z.string().min(1),
        platforms: z.array(platformSchema).min(1),
        scheduledFor: z.date(),
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
      await insertScheduledPost({
        brandId: input.brandId,
        content: input.content,
        platforms: input.platforms,
        scheduledFor: input.scheduledFor,
        status: "pending",
      });
      return { success: true as const };
    }),

  upcoming: dashboardProcedure
    .input(z.object({ brandId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const clientId = ctx.client?.id ?? null;
      const brand = await getBrandByIdScoped(input.brandId, clientId);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found or not accessible for this account.",
        });
      }
      const rows = await listScheduledForBrand(input.brandId);
      return rows.map(r => ({
        id: r.id,
        brandId: r.brandId,
        content: r.content,
        platforms: r.platforms,
        scheduledFor: r.scheduledFor,
        status: r.status,
        createdAt: r.createdAt,
      }));
    }),

  cancel: ownerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await cancelScheduledPost(input.id);
      return { success: true as const };
    }),
});
