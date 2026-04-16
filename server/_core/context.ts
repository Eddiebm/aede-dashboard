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
import { sdk } from "./sdk";
import { DASHBOARD_SESSION_COOKIE } from "@shared/const";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  /** Owner / OAuth user — set when JWT session or owner dashboard session (not client). */
  user: User | null;
  /** Multi-tenant client account — mutually exclusive with owner `user` for dashboard session auth. */
  client: Client | null;
};

// Local dev admin user — injected automatically when running on localhost
// without Manus OAuth configured. This bypasses the login requirement so
// the dashboard is fully accessible during local development.
const LOCAL_DEV_USER: User = {
  id: 1,
  openId: "local-dev-owner",
  name: "Local Dev",
  email: "dev@localhost",
  loginMethod: "local",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function isLocalDev(req: CreateExpressContextOptions["req"]): boolean {
  // Only activate local dev mode when:
  // 1. No Manus OAuth is configured (no VITE_APP_ID or it is set to "local")
  // 2. Request is coming from localhost
  const appId = process.env.VITE_APP_ID ?? "";
  const isManusConfigured = appId && appId !== "local" && appId !== "";
  if (isManusConfigured) return false;

  const host = req.headers.host ?? "";
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0")
  );
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const { req } = opts;
  let user: User | null = null;
  let client: Client | null = null;

  // Inject local dev user automatically when running on localhost
  // without Manus OAuth — no login required in this mode.
  if (isLocalDev(opts.req)) {
    return {
      req: opts.req,
      res: opts.res,
      user: LOCAL_DEV_USER,
      client: null,
    };
  }
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
          } else {
            console.warn("[Auth] Dashboard session references missing client id", session.clientId);
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
        } else {
          console.warn("[Auth] OWNER_OPEN_ID is not set — cannot resolve owner dashboard session");
        }
      }
    } catch (e) {
      console.error("[Auth] Failed to resolve dashboard session", e);
    }
  }

  if (!user && !client) {
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    client,
  };
}
