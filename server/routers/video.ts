import { nanoid } from "nanoid";
import { z } from "zod";
import {
  DEFAULT_VIDEO_GENERATION_DURATION_SEC,
  MAX_VIDEO_UPLOAD_BYTES,
  PLATFORMS,
  THREADS_GRAPH_BASE,
  type PlatformId,
} from "@shared/constants";
import { TRPCError } from "@trpc/server";
import { TwitterApi } from "twitter-api-v2";
import { dashboardProcedure, ownerProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";
import {
  getBrandByIdScoped,
  getMediaAssetById,
  getPlatformCredentialsForBrand,
  insertMediaAsset,
  insertPublishLog,
  listMediaAssetsByBrand,
} from "../db";
import { storagePut } from "../storage";
import { downloadBinary, editVideoAsset } from "../videoUtils";

const platformSchema = z.enum(PLATFORMS);

function credentialsMap(
  rows: Awaited<ReturnType<typeof getPlatformCredentialsForBrand>>
): Partial<Record<PlatformId, Record<string, string>>> {
  const out: Partial<Record<PlatformId, Record<string, string>>> = {};
  for (const r of rows) out[r.platform as PlatformId] = r.credentials;
  return out;
}

async function publishVideoToPlatform(params: {
  platform: PlatformId;
  credentials: Record<string, string> | undefined;
  videoUrl: string;
  caption: string;
}): Promise<{ success: boolean; postUrl?: string; errorMessage?: string }> {
  const { platform, credentials, videoUrl, caption } = params;
  if (!credentials || Object.keys(credentials).length === 0) {
    return {
      success: false,
      errorMessage: `${platform} credentials are missing for this brand`,
    };
  }

  if (platform === "telegram") {
    const botToken = credentials.botToken?.trim();
    const channelId = credentials.channelId?.trim();
    if (!botToken || !channelId) {
      return {
        success: false,
        errorMessage:
          "Telegram video publish requires botToken and channelId credentials for this brand.",
      };
    }
    const buffer = await downloadBinary(videoUrl);
    const form = new FormData();
    form.append("chat_id", channelId);
    form.append("caption", caption);
    form.append(
      "video",
      new Blob([new Uint8Array(buffer)], { type: "video/mp4" }),
      "video.mp4"
    );
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      return {
        success: false,
        errorMessage: `Telegram video publish failed (${res.status}): ${message}`,
      };
    }
    return {
      success: true,
      postUrl: channelId.startsWith("@")
        ? `https://t.me/${channelId.slice(1)}`
        : `https://t.me/c/${String(channelId).replace(/^-100/, "")}`,
    };
  }

  if (platform === "discord") {
    const webhookUrl = credentials.webhookUrl?.trim();
    if (!webhookUrl) {
      return {
        success: false,
        errorMessage: "Discord video publish requires webhookUrl credentials for this brand.",
      };
    }
    const buffer = await downloadBinary(videoUrl);
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content: caption || "Video update" }));
    form.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "video/mp4" }),
      "video.mp4"
    );
    const res = await fetch(webhookUrl, { method: "POST", body: form });
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      return {
        success: false,
        errorMessage: `Discord video publish failed (${res.status}): ${message}`,
      };
    }
    return { success: true };
  }

  if (platform === "twitter") {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    const accessToken = credentials.accessToken?.trim();
    const accessTokenSecret = credentials.accessTokenSecret?.trim();
    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return {
        success: false,
        errorMessage:
          "Twitter/X video publish requires apiKey, apiSecret, accessToken, and accessTokenSecret credentials.",
      };
    }
    const buffer = await downloadBinary(videoUrl);
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    });
    const rw = client.readWrite;
    const mediaId = await rw.v1.uploadMedia(buffer, { mimeType: "video/mp4", target: "tweet" });
    const tweet = await rw.v2.tweet({
      text: caption?.trim() || "Video update",
      media: { media_ids: [mediaId] },
    });
    return { success: true, postUrl: `https://twitter.com/i/web/status/${tweet.data.id}` };
  }

  if (platform === "mastodon") {
    let instanceUrl = (credentials.instanceUrl ?? "").trim().replace(/\/+$/, "");
    const accessToken = (credentials.accessToken ?? "").trim();
    if (!instanceUrl || !accessToken) {
      return {
        success: false,
        errorMessage:
          "Mastodon video publish requires instanceUrl and accessToken credentials.",
      };
    }
    if (!instanceUrl.startsWith("http")) {
      instanceUrl = `https://${instanceUrl}`;
    }
    const buffer = await downloadBinary(videoUrl);
    const uploadForm = new FormData();
    uploadForm.append(
      "file",
      new Blob([new Uint8Array(buffer)], { type: "video/mp4" }),
      "video.mp4"
    );
    const mediaRes = await fetch(`${instanceUrl}/api/v2/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: uploadForm,
    });
    if (!mediaRes.ok) {
      const message = await mediaRes.text().catch(() => mediaRes.statusText);
      return {
        success: false,
        errorMessage: `Mastodon media upload failed (${mediaRes.status}): ${message}`,
      };
    }
    const media = (await mediaRes.json()) as { id?: string };
    if (!media.id) {
      return {
        success: false,
        errorMessage: "Mastodon media upload did not return a media id.",
      };
    }
    const postRes = await fetch(`${instanceUrl}/api/v1/statuses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: caption?.trim() || "",
        media_ids: [media.id],
      }),
    });
    if (!postRes.ok) {
      const message = await postRes.text().catch(() => postRes.statusText);
      return {
        success: false,
        errorMessage: `Mastodon status publish failed (${postRes.status}): ${message}`,
      };
    }
    const posted = (await postRes.json()) as { url?: string };
    return { success: true, postUrl: posted.url ?? instanceUrl };
  }

  if (platform === "threads") {
    const accessToken = (credentials.accessToken ?? "").trim();
    const userId = (credentials.userId ?? "").trim();
    if (!accessToken || !userId) {
      return {
        success: false,
        errorMessage: "Threads video publish requires accessToken and userId credentials.",
      };
    }
    const createParams = new URLSearchParams({
      media_type: "VIDEO",
      video_url: videoUrl,
      text: caption?.trim() || "",
      access_token: accessToken,
    });
    const createRes = await fetch(
      `${THREADS_GRAPH_BASE}/${encodeURIComponent(userId)}/threads?${createParams.toString()}`,
      { method: "POST" }
    );
    if (!createRes.ok) {
      const message = await createRes.text().catch(() => createRes.statusText);
      return {
        success: false,
        errorMessage: `Threads container creation failed (${createRes.status}): ${message}`,
      };
    }
    const createData = (await createRes.json()) as { id?: string };
    if (!createData.id) {
      return {
        success: false,
        errorMessage: "Threads container creation did not return an id.",
      };
    }
    const publishParams = new URLSearchParams({
      creation_id: createData.id,
      access_token: accessToken,
    });
    const publishRes = await fetch(
      `${THREADS_GRAPH_BASE}/${encodeURIComponent(
        userId
      )}/threads_publish?${publishParams.toString()}`,
      { method: "POST" }
    );
    if (!publishRes.ok) {
      const message = await publishRes.text().catch(() => publishRes.statusText);
      return {
        success: false,
        errorMessage: `Threads publish failed (${publishRes.status}): ${message}`,
      };
    }
    return { success: true, postUrl: createData.id };
  }

  return {
    success: false,
    errorMessage: `${platform} video publish is not supported yet. Supported now: Twitter/X, Mastodon, Threads, Telegram, Discord.`,
  };
}

export const videoRouter = router({
  listByBrand: dashboardProcedure
    .input(z.object({ brandId: z.string().min(1), limit: z.number().min(1).max(100).optional() }))
    .query(async ({ ctx, input }) => {
      const brand = await getBrandByIdScoped(input.brandId, ctx.client?.id ?? null);
      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found or not accessible for this account.",
        });
      }
      const rows = await listMediaAssetsByBrand(input.brandId, input.limit ?? 30);
      return rows.map(r => ({
        id: r.id,
        source: r.source,
        mimeType: r.mimeType,
        storageUrl: r.storageUrl,
        createdAt: r.createdAt,
      }));
    }),

  upload: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().startsWith("video/"),
        base64Data: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const brand = await getBrandByIdScoped(input.brandId, null);
      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found." });
      }
      const bin = Buffer.from(input.base64Data, "base64");
      if (bin.byteLength > MAX_VIDEO_UPLOAD_BYTES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Video file exceeds ${(MAX_VIDEO_UPLOAD_BYTES / 1024 / 1024).toFixed(0)}MB upload limit.`,
        });
      }
      const ext = input.fileName.includes(".")
        ? input.fileName.split(".").pop() ?? "mp4"
        : "mp4";
      const key = `videos/${input.brandId}/${Date.now()}-${nanoid(8)}.${ext}`;
      const stored = await storagePut(key, bin, input.mimeType);
      await insertMediaAsset({
        brandId: input.brandId,
        source: "uploaded",
        mimeType: input.mimeType,
        storageKey: stored.key,
        storageUrl: stored.url,
      });
      return { success: true as const, url: stored.url };
    }),

  generate: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        prompt: z.string().min(3),
        durationSec: z.number().int().min(3).max(30).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!ENV.videoGenerationApiUrl) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "VIDEO_GENERATION_API_URL is missing — configure it to enable video generation.",
        });
      }
      const brand = await getBrandByIdScoped(input.brandId, null);
      if (!brand) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Brand not found." });
      }
      const durationSec = input.durationSec ?? DEFAULT_VIDEO_GENERATION_DURATION_SEC;
      const res = await fetch(ENV.videoGenerationApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(ENV.videoGenerationApiKey
            ? { Authorization: `Bearer ${ENV.videoGenerationApiKey}` }
            : {}),
        },
        body: JSON.stringify({
          prompt: input.prompt,
          durationSec,
          brand: brand.name,
        }),
      });
      if (!res.ok) {
        const message = await res.text().catch(() => res.statusText);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Video generation provider returned ${res.status}: ${message}`,
        });
      }
      const payload = (await res.json()) as { videoUrl?: string };
      if (!payload.videoUrl) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Video generation provider did not return a videoUrl.",
        });
      }
      const binary = await downloadBinary(payload.videoUrl);
      const stored = await storagePut(
        `videos/${input.brandId}/${Date.now()}-${nanoid(8)}.mp4`,
        binary,
        "video/mp4"
      );
      await insertMediaAsset({
        brandId: input.brandId,
        source: "generated",
        mimeType: "video/mp4",
        storageKey: stored.key,
        storageUrl: stored.url,
      });
      return { success: true as const, url: stored.url };
    }),

  edit: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        assetId: z.number().int().positive(),
        trimStartSec: z.number().min(0).max(600).optional(),
        trimEndSec: z.number().min(0).max(600).optional(),
        caption: z.string().max(140).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const asset = await getMediaAssetById(input.assetId);
      if (!asset || asset.brandId !== input.brandId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video asset not found for this brand.",
        });
      }
      const sourceBuffer = await downloadBinary(asset.storageUrl);
      const edited = await editVideoAsset({
        inputBuffer: sourceBuffer,
        trimStartSec: input.trimStartSec,
        trimEndSec: input.trimEndSec,
        caption: input.caption,
      });
      const stored = await storagePut(
        `videos/${input.brandId}/${Date.now()}-${nanoid(8)}-edited.mp4`,
        edited,
        "video/mp4"
      );
      await insertMediaAsset({
        brandId: input.brandId,
        source: "edited",
        mimeType: "video/mp4",
        storageKey: stored.key,
        storageUrl: stored.url,
      });
      return { success: true as const, url: stored.url };
    }),

  publish: ownerProcedure
    .input(
      z.object({
        brandId: z.string().min(1),
        assetId: z.number().int().positive(),
        platforms: z.array(platformSchema).min(1),
        caption: z.string().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const asset = await getMediaAssetById(input.assetId);
      if (!asset || asset.brandId !== input.brandId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Video asset not found for this brand.",
        });
      }
      const credRows = await getPlatformCredentialsForBrand(input.brandId);
      const credMap = credentialsMap(credRows);
      const postId = `video-${input.assetId}-${nanoid(6)}`;
      const results: Array<{
        platform: PlatformId;
        success: boolean;
        postUrl?: string;
        errorMessage?: string;
      }> = [];
      for (const platform of input.platforms) {
        try {
          const result = await publishVideoToPlatform({
            platform,
            credentials: credMap[platform],
            videoUrl: asset.storageUrl,
            caption: input.caption ?? "",
          });
          await insertPublishLog({
            postId,
            brandId: input.brandId,
            platform,
            status: result.success ? "success" : "failed",
            content: input.caption ?? null,
            postUrl: result.postUrl,
            errorMessage: result.errorMessage,
            simulated: false,
            publishedAt: new Date(),
          });
          results.push({ platform, ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await insertPublishLog({
            postId,
            brandId: input.brandId,
            platform,
            status: "failed",
            content: input.caption ?? null,
            errorMessage: `Video publish failed: ${message}`,
            simulated: false,
            publishedAt: new Date(),
          });
          results.push({
            platform,
            success: false,
            errorMessage: `Video publish failed: ${message}`,
          });
        }
      }
      return { postId, results };
    }),
});

