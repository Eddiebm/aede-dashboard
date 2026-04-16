import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PLATFORMS, type PlatformId } from "@shared/constants";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const base64 = raw.includes(",") ? raw.split(",")[1] : raw;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VideosPage() {
  const [brandId, setBrandId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [durationSec, setDurationSec] = useState(8);
  const [assetId, setAssetId] = useState<number | null>(null);
  const [caption, setCaption] = useState("");
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([
    "telegram",
    "discord",
  ]);

  const brandsQ = trpc.brands.all.useQuery();
  const assetsQ = trpc.video.listByBrand.useQuery(
    { brandId, limit: 30 },
    { enabled: Boolean(brandId) }
  );

  const generate = trpc.video.generate.useMutation({
    onSuccess: () => {
      toast.success("Video generated");
      assetsQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const upload = trpc.video.upload.useMutation({
    onSuccess: () => {
      toast.success("Video uploaded");
      assetsQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const edit = trpc.video.edit.useMutation({
    onSuccess: () => {
      toast.success("Video edited");
      assetsQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const publish = trpc.video.publish.useMutation({
    onSuccess: res => {
      const failed = res.results.filter(r => !r.success).length;
      if (failed === 0) toast.success("Video published to all selected platforms");
      else toast.warning(`Published with ${failed} platform failure(s)`);
    },
    onError: e => toast.error(e.message),
  });

  const selectedAsset = useMemo(
    () => (assetsQ.data ?? []).find(x => x.id === assetId) ?? null,
    [assetsQ.data, assetId]
  );

  function togglePlatform(platform: PlatformId) {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 font-mono">
        <div>
          <h1 className="text-xl font-semibold">Videos</h1>
          <p className="text-sm text-muted-foreground">
            Generate, edit, and auto-post video assets.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Brand</Label>
          <Select value={brandId || undefined} onValueChange={setBrandId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {(brandsQ.data ?? []).map(b => (
                <SelectItem key={b.brandId} value={b.brandId}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!brandId ? (
          <p className="text-sm text-muted-foreground">
            Select a brand to start generating or uploading videos.
          </p>
        ) : (
          <>
            <section className="space-y-3 border rounded-lg p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Generate video</h2>
              <Textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe the video to generate..."
              />
              <div className="flex items-center gap-3">
                <Label htmlFor="dur">Duration (sec)</Label>
                <Input
                  id="dur"
                  type="number"
                  min={3}
                  max={30}
                  value={durationSec}
                  onChange={e => setDurationSec(Number(e.target.value || 8))}
                  className="w-24"
                />
                <Button
                  disabled={generate.isPending || !prompt.trim()}
                  onClick={() =>
                    generate.mutate({ brandId, prompt: prompt.trim(), durationSec })
                  }
                >
                  {generate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Generate
                </Button>
              </div>
            </section>

            <section className="space-y-3 border rounded-lg p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Upload video</h2>
              <input
                type="file"
                accept="video/*"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const base64Data = await fileToBase64(file);
                  upload.mutate({
                    brandId,
                    fileName: file.name,
                    mimeType: file.type || "video/mp4",
                    base64Data,
                  });
                }}
              />
              {upload.isPending ? (
                <p className="text-xs text-muted-foreground">Uploading...</p>
              ) : null}
            </section>

            <section className="space-y-3 border rounded-lg p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Edit video</h2>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1">
                  <Label>Asset</Label>
                  <Select
                    value={assetId ? String(assetId) : undefined}
                    onValueChange={v => setAssetId(Number(v))}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="Select video asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {(assetsQ.data ?? []).map(a => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          #{a.id} {a.source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Trim start (sec)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={trimStart}
                    onChange={e => setTrimStart(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Trim end (sec)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={trimEnd}
                    onChange={e => setTrimEnd(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[220px]">
                  <Label>Caption overlay</Label>
                  <Input
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Optional on-video caption"
                  />
                </div>
                <Button
                  disabled={edit.isPending || !assetId}
                  onClick={() =>
                    edit.mutate({
                      brandId,
                      assetId: assetId!,
                      trimStartSec: trimStart ? Number(trimStart) : undefined,
                      trimEndSec: trimEnd ? Number(trimEnd) : undefined,
                      caption: caption.trim() || undefined,
                    })
                  }
                >
                  {edit.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Edit
                </Button>
              </div>
            </section>

            <section className="space-y-3 border rounded-lg p-4">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Auto-post video</h2>
              <p className="text-xs text-muted-foreground">
                Supported now: Twitter/X, Mastodon, Threads, Telegram, and Discord.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-full border text-xs ${
                      selectedPlatforms.includes(p)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label>Post caption</Label>
                <Textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={2}
                  placeholder="Caption for platform post"
                />
              </div>
              <Button
                disabled={publish.isPending || !assetId || selectedPlatforms.length === 0}
                onClick={() =>
                  publish.mutate({
                    brandId,
                    assetId: assetId!,
                    platforms: selectedPlatforms,
                    caption: caption.trim() || undefined,
                  })
                }
              >
                {publish.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Auto-post video
              </Button>
              {publish.data ? (
                <div className="text-xs space-y-1 border rounded p-3">
                  {publish.data.results.map(r => (
                    <p key={r.platform}>
                      {r.platform}: {r.success ? "success" : r.errorMessage}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-widest">Video assets</h2>
              {(assetsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No video assets yet. Generate or upload your first video above.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {assetsQ.data!.map(asset => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setAssetId(asset.id)}
                      className={`text-left border rounded p-3 ${
                        selectedAsset?.id === asset.id ? "border-primary" : "border-border"
                      }`}
                    >
                      <p className="text-xs text-muted-foreground">
                        #{asset.id} · {asset.source}
                      </p>
                      <p className="text-xs break-all mt-1">{asset.storageUrl}</p>
                      <video className="w-full mt-2 rounded" src={asset.storageUrl} controls />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

