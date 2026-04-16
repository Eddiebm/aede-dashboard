import type { Request, Response } from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { getClientByStripeCustomerId, updateClientPlan } from "./db";

export async function handleStripeWebhook(req: Request, res: Response) {
  if (!ENV.stripeSecretKey || !ENV.stripeWebhookSecret) {
    console.error("[Stripe] Webhook rejected: Stripe secrets not configured");
    res.status(503).send("Stripe not configured");
    return;
  }

  const stripe = new Stripe(ENV.stripeSecretKey);
  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string") {
    console.error("[Stripe] Missing stripe-signature header");
    res.status(400).send("Missing signature");
    return;
  }

  let event: Stripe.Event;
  try {
    const raw = req.body;
    if (!Buffer.isBuffer(raw) && typeof raw !== "string") {
      console.error("[Stripe] Webhook body must be raw buffer");
      res.status(400).send("Invalid body");
      return;
    }
    event = stripe.webhooks.constructEvent(
      raw,
      sig,
      ENV.stripeWebhookSecret
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Stripe] Webhook signature verification failed", msg);
    res.status(400).send(`Webhook Error: ${msg}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clientIdRaw = session.metadata?.clientId;
        const plan = session.metadata?.plan as "starter" | "pro" | undefined;
        if (clientIdRaw && plan) {
          const id = parseInt(clientIdRaw, 10);
          if (!Number.isNaN(id)) {
            const subId = session.subscription;
            let periodEnd: Date | null = new Date(
              Date.now() + 365 * 24 * 60 * 60 * 1000
            );
            if (typeof subId === "string") {
              const sub = (await stripe.subscriptions.retrieve(
                subId
              )) as Stripe.Subscription;
              const periodEnds = sub.items.data
                .map(item => item.current_period_end)
                .filter(v => typeof v === "number");
              const latestEnd = periodEnds.length > 0 ? Math.max(...periodEnds) : null;
              periodEnd = latestEnd ? new Date(latestEnd * 1000) : periodEnd;
            }
            const custId =
              typeof session.customer === "string"
                ? session.customer
                : session.customer?.id;
            await updateClientPlan(
              id,
              plan,
              periodEnd,
              custId ?? undefined
            );
            console.log(
              `[Stripe] checkout.session.completed: client ${id} → plan ${plan}`
            );
          }
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const metaId = sub.metadata?.clientId;
        if (metaId) {
          const id = parseInt(metaId, 10);
          if (!Number.isNaN(id)) {
            await updateClientPlan(id, "free", null);
            console.log(`[Stripe] subscription deleted: client ${id} → free`);
            break;
          }
        }
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (customerId) {
          const client = await getClientByStripeCustomerId(customerId);
          if (client) {
            await updateClientPlan(client.id, "free", null);
            console.log(
              `[Stripe] subscription deleted: client ${client.id} via customer`
            );
          }
        }
        break;
      }
      default:
        console.log(`[Stripe] Unhandled event type ${event.type}`);
    }
    res.json({ received: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Stripe] Webhook handler error", msg);
    res.status(500).send(msg);
  }
}
