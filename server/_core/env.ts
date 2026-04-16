export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** Bcrypt hash for owner dashboard password (see auth.dashboardLogin) */
  dashboardPasswordHash: process.env.DASHBOARD_PASSWORD_HASH ?? "",
  /** When true, publishers record success without calling external APIs */
  simulatePublish: process.env.SIMULATE_PUBLISH === "1" || process.env.SIMULATE_PUBLISH === "true",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceStarter: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
  /** Client row used for owner workspace Stripe subscription (optional). */
  ownerBillingEmail: process.env.OWNER_BILLING_EMAIL ?? "",
};
