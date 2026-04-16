import { SCHEDULER_POLL_INTERVAL_MS } from "@shared/constants";
import { ENV } from "./_core/env";
import {
  getDueScheduledPosts,
  updateScheduledPostStatus,
  getBrandById,
  getPlatformCredentialsForBrand,
} from "./db";
import { runPublishToPlatforms } from "./publishJob";
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

let interval: ReturnType<typeof setInterval> | null = null;

export function startScheduler() {
  if (interval) return;
  console.log("[Scheduler] Started polling for due scheduled posts");
  interval = setInterval(() => {
    tick().catch(e => {
      console.error("[Scheduler] Tick failed", e instanceof Error ? e.message : e);
    });
  }, SCHEDULER_POLL_INTERVAL_MS);
}

async function tick() {
  const due = await getDueScheduledPosts(new Date());
  for (const row of due) {
    await updateScheduledPostStatus(row.id, "processing");
    try {
      const brand = await getBrandById(row.brandId);
      if (!brand?.active) {
        await updateScheduledPostStatus(
          row.id,
          "failed",
          "Brand is inactive or missing — scheduled post skipped."
        );
        continue;
      }
      const credRows = await getPlatformCredentialsForBrand(row.brandId);
      const credMap = credentialsMap(credRows);
      const platforms = row.platforms as PlatformId[];
      const postId = `sched-${row.id}-${Date.now()}`;
      await runPublishToPlatforms({
        postId,
        brandId: row.brandId,
        content: row.content,
        platforms,
        credentialsByPlatform: credMap,
        simulated: ENV.simulatePublish,
      });
      await updateScheduledPostStatus(row.id, "published");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[Scheduler] Failed scheduled post", row.id, msg);
      await updateScheduledPostStatus(row.id, "failed", msg);
    }
  }
}
