import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function downloadBinary(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to download media (${res.status}): ${message}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath.path, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });
    child.on("error", err => reject(err));
    child.on("exit", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed (${code}): ${stderr.slice(-1200)}`));
      }
    });
  });
}

function escapeFilterText(text: string): string {
  return text.replace(/[:\\']/g, "\\$&");
}

export async function editVideoAsset(params: {
  inputBuffer: Buffer;
  trimStartSec?: number;
  trimEndSec?: number;
  caption?: string;
}): Promise<Buffer> {
  const root = join(tmpdir(), `aede-video-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(root, { recursive: true });
  const inputPath = join(root, "input.mp4");
  const outputPath = join(root, "output.mp4");
  await writeFile(inputPath, params.inputBuffer);

  const args: string[] = ["-y"];
  if (typeof params.trimStartSec === "number" && params.trimStartSec > 0) {
    args.push("-ss", String(params.trimStartSec));
  }
  args.push("-i", inputPath);

  if (
    typeof params.trimEndSec === "number" &&
    params.trimEndSec > 0 &&
    typeof params.trimStartSec === "number" &&
    params.trimEndSec > params.trimStartSec
  ) {
    args.push("-to", String(params.trimEndSec));
  }

  if (params.caption && params.caption.trim().length > 0) {
    const text = escapeFilterText(params.caption.trim());
    args.push(
      "-vf",
      `drawtext=text='${text}':x=(w-text_w)/2:y=h-80:fontsize=36:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12`
    );
  }

  args.push("-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", outputPath);
  try {
    await runFfmpeg(args);
    return await readFile(outputPath);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

