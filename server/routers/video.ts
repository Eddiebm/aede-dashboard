import { nanoid } from "nanoid";
import { z } from "zod";
import {
  DEFAULT_VIDEO_GENERATION_DURATION_SEC,
  MAX_VIDEO_UPLOAD_BYTES,
  PLATFORMS,
  type PlatformId,
} from "@shared/constants";
import { TRPCError } from "@trpc/server";
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

  return {
    success: false,
    errorMessage: `${platform} video publish is not supported yet — use Telegram or Discord for video auto-posting.`,
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

