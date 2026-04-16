import { BskyAgent } from "@atproto/api";
import { TwitterApi } from "twitter-api-v2";
import {
  BLUESKY_SERVICE_URL,
  LINKEDIN_UGC_POSTS_URL,
  PUBLISHER_HTTP_TIMEOUT_MS,
  TELEGRAM_API_BASE,
  THREADS_GRAPH_BASE,
} from "@shared/constants";
import type { PlatformId } from "@shared/constants";

export type PublishResult = {
  success: boolean;
  postUrl?: string;
  errorMessage?: string;
};

function withTimeout(
  ms: number,
  label: string
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(t);
    },
  };
}

export async function publishBluesky(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  try {
    const handle = credentials.handle?.trim();
    const appPassword = credentials.appPassword?.trim();
    if (!handle || !appPassword) {
      return {
        success: false,
        errorMessage:
          "Bluesky credentials are incomplete — add handle and app password for this brand.",
      };
    }
    const agent = new BskyAgent({ service: BLUESKY_SERVICE_URL });
    await agent.login({ identifier: handle, password: appPassword });
    const res = await agent.post({ text: content });
    const uri = res.uri;
    const rkey = uri.includes("/") ? uri.split("/").pop() : uri;
    const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;
    return { success: true, postUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Bluesky]", msg);
    return {
      success: false,
      errorMessage: `Bluesky publish failed: ${msg}`,
    };
  }
}

export async function publishMastodon(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const { cancel, signal } = withTimeout(PUBLISHER_HTTP_TIMEOUT_MS, "mastodon");
  try {
    let instanceUrl = (credentials.instanceUrl ?? "").trim().replace(/\/$/, "");
    const accessToken = (credentials.accessToken ?? "").trim();
    if (!instanceUrl || !accessToken) {
      return {
        success: false,
        errorMessage:
          "Mastodon credentials are incomplete — add instance URL and access token for this brand.",
      };
    }
    if (!instanceUrl.startsWith("http")) {
      instanceUrl = `https://${instanceUrl}`;
    }
    const url = `${instanceUrl}/api/v1/statuses`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: content }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        errorMessage: `Mastodon API error ${res.status}: ${errText.slice(0, 500)}`,
      };
    }
    const data = (await res.json()) as { url?: string };
    return { success: true, postUrl: data.url ?? instanceUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Mastodon]", msg);
    return {
      success: false,
      errorMessage: `Mastodon publish failed: ${msg}`,
    };
  } finally {
    cancel();
  }
}

export async function publishTelegram(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const { cancel, signal } = withTimeout(PUBLISHER_HTTP_TIMEOUT_MS, "telegram");
  try {
    const botToken = (credentials.botToken ?? "").trim();
    const channelId = (credentials.channelId ?? "").trim();
    if (!botToken || !channelId) {
      return {
        success: false,
        errorMessage:
          "Telegram credentials are incomplete — add bot token and channel ID for this brand.",
      };
    }
    const url = `${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channelId, text: content }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        errorMessage: `Telegram API error ${res.status}: ${errText.slice(0, 500)}`,
      };
    }
    const publicLink = channelId.startsWith("@")
      ? `https://t.me/${channelId.slice(1)}`
      : `https://t.me/c/${String(channelId).replace(/^-100/, "")}`;
    return { success: true, postUrl: publicLink };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Telegram]", msg);
    return {
      success: false,
      errorMessage: `Telegram publish failed: ${msg}`,
    };
  } finally {
    cancel();
  }
}

export async function publishDiscord(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const { cancel, signal } = withTimeout(PUBLISHER_HTTP_TIMEOUT_MS, "discord");
  try {
    const webhookUrl = (credentials.webhookUrl ?? "").trim();
    if (!webhookUrl) {
      return {
        success: false,
        errorMessage:
          "Discord webhook URL is missing — add a channel webhook URL for this brand.",
      };
    }
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        errorMessage: `Discord webhook error ${res.status}: ${errText.slice(0, 500)}`,
      };
    }
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Discord]", msg);
    return {
      success: false,
      errorMessage: `Discord publish failed: ${msg}`,
    };
  } finally {
    cancel();
  }
}

export async function publishTwitter(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  try {
    const apiKey = credentials.apiKey?.trim();
    const apiSecret = credentials.apiSecret?.trim();
    const accessToken = credentials.accessToken?.trim();
    const accessTokenSecret = credentials.accessTokenSecret?.trim();
    if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
      return {
        success: false,
        errorMessage:
          "Twitter/X credentials are incomplete — add API key, secret, and access tokens for this brand.",
      };
    }
    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken,
      accessSecret: accessTokenSecret,
    });
    const rw = client.readWrite;
    const tweet = await rw.v2.tweet(content);
    const id = tweet.data.id;
    const postUrl = `https://twitter.com/i/web/status/${id}`;
    return { success: true, postUrl };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Twitter]", msg);
    if (
      typeof msg === "string" &&
      (msg.includes("429") || msg.toLowerCase().includes("rate limit"))
    ) {
      return {
        success: false,
        errorMessage:
          "Twitter/X rate limit exceeded — retry in 15 minutes or reduce posting frequency.",
      };
    }
    return {
      success: false,
      errorMessage: `Twitter/X publish failed: ${msg}`,
    };
  }
}

export async function publishLinkedIn(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const { cancel, signal } = withTimeout(PUBLISHER_HTTP_TIMEOUT_MS, "linkedin");
  try {
    const accessToken = (credentials.accessToken ?? "").trim();
    const userId = (credentials.userId ?? "").trim();
    if (!accessToken || !userId) {
      return {
        success: false,
        errorMessage:
          "LinkedIn credentials are incomplete — add access token and user ID for this brand.",
      };
    }
    const authorUrn = userId.startsWith("urn:") ? userId : `urn:li:person:${userId}`;
    const body = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: content },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
    const res = await fetch(LINKEDIN_UGC_POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        errorMessage: `LinkedIn API error ${res.status}: ${errText.slice(0, 500)}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    const postUrl = data.id
      ? `https://www.linkedin.com/feed/update/${encodeURIComponent(data.id)}`
      : undefined;
    return { success: true, postUrl };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:LinkedIn]", msg);
    return {
      success: false,
      errorMessage: `LinkedIn publish failed: ${msg}`,
    };
  } finally {
    cancel();
  }
}

export async function publishThreads(
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const { cancel, signal } = withTimeout(PUBLISHER_HTTP_TIMEOUT_MS, "threads");
  try {
    const accessToken = (credentials.accessToken ?? "").trim();
    const userId = (credentials.userId ?? "").trim();
    if (!accessToken || !userId) {
      return {
        success: false,
        errorMessage:
          "Threads credentials are incomplete — add access token and user ID for this brand.",
      };
    }
    const base = `${THREADS_GRAPH_BASE}/${userId}`;
    const createUrl = `${base}/threads`;
    const params = new URLSearchParams({
      media_type: "TEXT",
      text: content,
      access_token: accessToken,
    });
    const createRes = await fetch(`${createUrl}?${params.toString()}`, {
      method: "POST",
      signal,
    });
    if (!createRes.ok) {
      const errText = await createRes.text();
      return {
        success: false,
        errorMessage: `Threads create error ${createRes.status}: ${errText.slice(0, 500)}`,
      };
    }
    const created = (await createRes.json()) as { id?: string };
    const creationId = created.id;
    if (!creationId) {
      return {
        success: false,
        errorMessage: "Threads did not return a creation ID — check API permissions.",
      };
    }
    const pubParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });
    const pubRes = await fetch(`${base}/threads_publish?${pubParams.toString()}`, {
      method: "POST",
      signal,
    });
    if (!pubRes.ok) {
      const errText = await pubRes.text();
      return {
        success: false,
        errorMessage: `Threads publish error ${pubRes.status}: ${errText.slice(0, 500)}`,
      };
    }
    return { success: true, postUrl: creationId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Publisher:Threads]", msg);
    return {
      success: false,
      errorMessage: `Threads publish failed: ${msg}`,
    };
  } finally {
    cancel();
  }
}

const publishers: Record<
  PlatformId,
  (c: Record<string, string>, text: string) => Promise<PublishResult>
> = {
  bluesky: publishBluesky,
  mastodon: publishMastodon,
  telegram: publishTelegram,
  discord: publishDiscord,
  twitter: publishTwitter,
  linkedin: publishLinkedIn,
  threads: publishThreads,
};

export async function publishToPlatform(
  platform: PlatformId,
  credentials: Record<string, string>,
  content: string
): Promise<PublishResult> {
  const fn = publishers[platform];
  return fn(credentials, content);
}
