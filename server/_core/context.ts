import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
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
  let user: User | null = null;

  // Inject local dev user automatically when running on localhost
  // without Manus OAuth — no login required in this mode.
  if (isLocalDev(opts.req)) {
    return {
      req: opts.req,
      res: opts.res,
      user: LOCAL_DEV_USER,
    };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
