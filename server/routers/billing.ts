import { TRPCError } from "@trpc/server";
import Stripe from "stripe";
import { z } from "zod";
import {
  PLAN_BRAND_LIMIT,
  PLAN_MONTHLY_POST_LIMIT,
  type PlanId,
} from "@shared/constants";
import { ENV } from "../_core/env";
import { ownerProcedure, router } from "../_core/trpc";
import {
  countPublishLogsSince,
  countTotalBrands,
  getClientByEmail,
  updateClientPlan,
  updateClientStripeId,
} from "../db";

function getStripe(): Stripe {
  if (!ENV.stripeSecretKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Stripe is not configured — set STRIPE_SECRET_KEY to enable billing.",
    });
  }
  return new Stripe(ENV.stripeSecretKey);
}

export const billingRouter = router({
  summary: ownerProcedure.query(async () => {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const brandsUsed = await countTotalBrands();
    const postsThisMonth = await countPublishLogsSince(start);

    let plan: PlanId = "free";
    let planExpiresAt: Date | null = null;
    if (ENV.ownerBillingEmail) {
      const row = await getClientByEmail(ENV.ownerBillingEmail);
      if (row) {
        plan = row.plan as PlanId;
        planExpiresAt = row.planExpiresAt;
      }
    }

    const brandLimit = PLAN_BRAND_LIMIT[plan];
    const postLimit = PLAN_MONTHLY_POST_LIMIT[plan];

    return {
      plan,
      planExpiresAt,
      brandsUsed,
      brandLimit,
      postsThisMonth,
      postLimit,
    };
  }),

  createCheckout: ownerProcedure
    .input(z.object({ plan: z.enum(["starter", "pro"]) }))
    .mutation(async ({ input }) => {
      if (!ENV.ownerBillingEmail) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Set OWNER_BILLING_EMAIL to a client account email that should own the subscription.",
        });
      }
      const client = await getClientByEmail(ENV.ownerBillingEmail);
      if (!client) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `No client exists with email ${ENV.ownerBillingEmail} — invite that client first.`,
        });
      }
      const priceId =
        input.plan === "starter" ? ENV.stripePriceStarter : ENV.stripePricePro;
      if (!priceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Stripe price IDs are missing — set STRIPE_PRICE_STARTER_MONTHLY and STRIPE_PRICE_PRO_MONTHLY.",
        });
      }
      const stripe = getStripe();
      let customerId = client.stripeCustomerId ?? undefined;
      if (!customerId) {
        const cust = await stripe.customers.create({
          email: client.email,
          name: client.name,
          metadata: { clientId: String(client.id) },
        });
        customerId = cust.id;
        await updateClientStripeId(client.id, customerId);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${ENV.publicAppUrl}/billing?checkout=success`,
        cancel_url: `${ENV.publicAppUrl}/billing?checkout=cancel`,
        metadata: {
          clientId: String(client.id),
          plan: input.plan,
        },
        subscription_data: {
          metadata: { clientId: String(client.id) },
        },
      });
      if (!session.url) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe did not return a checkout URL — try again.",
        });
      }
      return { url: session.url };
    }),

  createPortal: ownerProcedure.mutation(async () => {
    if (!ENV.ownerBillingEmail) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Set OWNER_BILLING_EMAIL for billing management.",
      });
    }
    const client = await getClientByEmail(ENV.ownerBillingEmail);
    if (!client?.stripeCustomerId) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No Stripe customer on file — start a subscription first.",
      });
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${ENV.publicAppUrl}/billing`,
    });
    return { url: session.url };
  }),
});
