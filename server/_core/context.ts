import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookies } from "cookie";
import type { User, Client } from "../../drizzle/schema";
import {
  getDashboardSessionByToken,
  getUserByOpenId,
  getClientById,
  upsertUser,
} from "../db";
import { ENV } from "./env";
import { DASHBOARD_SESSION_COOKIE } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  client: Client | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const { req } = opts;
  let user: User | null = null;
  let client: Client | null = null;

  const raw = req.headers.cookie;
  const cookies = raw ? parseCookies(raw) : {};
  const dashToken = cookies[DASHBOARD_SESSION_COOKIE];

  if (dashToken) {
    try {
      const session = await getDashboardSessionByToken(dashToken);
      if (session && new Date(session.expiresAt).getTime() > Date.now()) {
        if (session.clientId != null) {
          const row = await getClientById(session.clientId);
          if (row) {
            client = row;
          }
        } else if (ENV.ownerOpenId) {
          let u = await getUserByOpenId(ENV.ownerOpenId);
          if (!u) {
            await upsertUser({
              openId: ENV.ownerOpenId,
              name: "Owner",
              role: "admin",
              lastSignedIn: new Date(),
            });
            u = await getUserByOpenId(ENV.ownerOpenId);
          }
          user = u ?? null;
        }
      }
    } catch (e) {
      console.error("[Auth] Failed to resolve dashboard session", e);
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    client,
  };
}
