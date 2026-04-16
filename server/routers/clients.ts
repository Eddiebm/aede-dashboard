import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { z } from "zod";
import { DASHBOARD_SESSION_COOKIE, ONE_YEAR_MS } from "@shared/constants";
import { getSessionCookieOptions } from "../_core/cookies";
import { ownerProcedure, publicProcedure, router } from "../_core/trpc";
import {
  insertClient,
  getClientByEmail,
  listClientsWithBrandCounts,
  deleteClientById,
  insertDashboardSession,
} from "../db";

export const clientsRouter = router({
  list: ownerProcedure.query(async () => {
    return listClientsWithBrandCounts();
  }),

  invite: ownerProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        email: z.string().email(),
        tempPassword: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await getClientByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A client with this email already exists.",
        });
      }
      const passwordHash = await bcrypt.hash(input.tempPassword, 10);
      await insertClient({
        name: input.name,
        email: input.email,
        passwordHash,
        plan: "free",
      });
      return { success: true as const };
    }),

  delete: ownerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deleteClientById(input.id);
      return { success: true as const };
    }),

  clientLogin: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await getClientByEmail(input.email);
      if (!client) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }
      const ok = await bcrypt.compare(input.password, client.passwordHash);
      if (!ok) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + ONE_YEAR_MS);
      await insertDashboardSession({
        token,
        expiresAt,
        clientId: client.id,
      });
      const opts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(DASHBOARD_SESSION_COOKIE, token, {
        ...opts,
        maxAge: ONE_YEAR_MS,
      });
      return {
        success: true as const,
        client: { id: client.id, name: client.name, email: client.email },
      };
    }),

});
