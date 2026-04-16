import type { PlatformId } from "@shared/constants";
import { insertPublishLog } from "./db";
import { publishToPlatform, type PublishResult } from "./publishers";

export type PlatformPublishOutcome = {
  platform: PlatformId;
  result: PublishResult;
};

/**
 * Publishes to each platform independently — one failure never blocks others.
 * Inserts one publish_log row per platform.
 */
export async function runPublishToPlatforms(input: {
  postId: string;
  brandId: string;
  content: string;
  platforms: PlatformId[];
  credentialsByPlatform: Partial<Record<PlatformId, Record<string, string>>>;
  simulated?: boolean;
}): Promise<PlatformPublishOutcome[]> {
  const { postId, brandId, content, platforms, credentialsByPlatform, simulated } = input;
  const outcomes: PlatformPublishOutcome[] = [];

  for (const platform of platforms) {
    const credentials = credentialsByPlatform[platform];
    if (!credentials || Object.keys(credentials).length === 0) {
      const msg = `${platform} credentials are missing for this brand`;
      console.error(`[Publisher:${platform}]`, msg);
      await insertPublishLog({
        postId,
        brandId,
        platform,
        status: "failed",
        content,
        errorMessage: msg,
        simulated: simulated ?? false,
        publishedAt: new Date(),
      });
      outcomes.push({
        platform,
        result: { success: false, errorMessage: msg },
      });
      continue;
    }

    let result: PublishResult;
    if (simulated) {
      result = { success: true, postUrl: "https://example.com/simulated" };
    } else {
      result = await publishToPlatform(platform, credentials, content);
    }

    await insertPublishLog({
      postId,
      brandId,
      platform,
      status: result.success ? "success" : "failed",
      content,
      postUrl: result.postUrl,
      errorMessage: result.errorMessage,
      simulated: simulated ?? false,
      publishedAt: new Date(),
    });

    outcomes.push({ platform, result });
  }

  return outcomes;
}
