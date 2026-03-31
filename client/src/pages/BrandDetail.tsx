import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ArrowLeft, Play, RefreshCw } from "lucide-react";

const BRAND_COLORS: Record<string, string> = {
  frankgrant: "#1a6b3c",
  nihpaylines: "#1a4a8a",
  rentlease: "#7c3a1a",
  rewbs: "#8a1a1a",
  busos: "#1a1a8a",
  coare: "#3a1a8a",
  chiefmarketingofficer: "#1a6b6b",
};

type Tab = "posts" | "pipeline" | "info";

function scoreClass(score: number | null | undefined) {
  if (!score) return "score-badge";
  if (score >= 7) return "score-badge score-high";
  if (score >= 5) return "score-badge score-mid";
  return "score-badge score-low";
}

function parseCronTime(cron: string | null | undefined): string {
  if (!cron) return "—";
  const parts = cron.trim().split(/\s+/);
  if (parts.length >= 3) {
    const min = parseInt(parts[0], 10);
    const hr = parseInt(parts[1], 10);
    if (!isNaN(hr) && !isNaN(min)) {
      const h = hr % 12 || 12;
      const m = min.toString().padStart(2, "0");
      const ampm = hr < 12 ? "AM" : "PM";
      return `${h}:${m} ${ampm} daily`;
    }
  }
  return cron;
}

function formatTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BrandDetail() {
  const params = useParams<{ brandId: string }>();
  const brandId = params.brandId;
  const [tab, setTab] = useState<Tab>("posts");
  const { isAuthenticated } = useAuth();

  const { data: brand, isLoading: brandLoading } = trpc.brands.get.useQuery({ brandId });
  const { data: posts = [], isLoading: postsLoading, refetch: refetchPosts } = trpc.posts.byBrand.useQuery({ brandId, limit: 50 });
  const { data: runs = [], isLoading: runsLoading, refetch: refetchRuns } = trpc.pipeline.byBrand.useQuery({ brandId, limit: 20 });

  const utils = trpc.useUtils();
  const trigger = trpc.pipeline.trigger.useMutation({
    onSuccess: (data) => {
      toast.success(`Pipeline complete — ${data.approved} posts approved`);
      refetchPosts();
      refetchRuns();
      utils.pipeline.recent.invalidate();
      utils.posts.stats.invalidate();
    },
    onError: (err) => {
      toast.error(`Pipeline failed: ${err.message}`);
    },
  });

  const accentColor = brand?.accentColor ?? BRAND_COLORS[brandId] ?? "#888";

  if (brandLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">Loading…</span>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground">Brand not found.</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
              <ArrowLeft size={14} />
              All Brands
            </span>
          </Link>
          <span className="text-border">|</span>
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">AEDE</span>
        </div>
        {isAuthenticated && (
          <button
            className="trigger-btn flex items-center gap-2"
            disabled={trigger.isPending}
            onClick={() => trigger.mutate({ brandId })}
          >
            {trigger.isPending ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play size={13} />
                Run Pipeline
              </>
            )}
          </button>
        )}
      </header>

      {/* Brand header */}
      <div className="border-b border-border">
        <div className="flex items-stretch">
          <div className="w-1.5 shrink-0" style={{ background: accentColor }} />
          <div className="px-6 py-5 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{brand.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">{brand.description ?? "No description"}</p>
              </div>
              <div className="text-right shrink-0">
                {brand.active ? (
                  <span className="font-mono text-xs border border-emerald-300 text-emerald-700 bg-emerald-50 px-2 py-1">
                    ACTIVE
                  </span>
                ) : (
                  <span className="font-mono text-xs border border-zinc-300 text-zinc-500 bg-zinc-50 px-2 py-1">
                    PAUSED
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Audience</p>
                <p className="text-sm mt-1">{brand.audience ?? "—"}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Tone</p>
                <p className="text-sm mt-1">{brand.tone ?? "—"}</p>
              </div>
              <div>
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Schedule</p>
                <p className="font-mono text-sm mt-1">{brand.schedule ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar px-6">
        {(["posts", "pipeline", "info"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`tab-item ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "posts" ? `Posts (${posts.length})` : t === "pipeline" ? `Pipeline (${runs.length})` : "Info"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {/* Posts tab */}
        {tab === "posts" && (
          <div>
            {postsLoading ? (
              <div className="p-6 font-mono text-sm text-muted-foreground">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="p-6">
                <p className="font-mono text-sm text-muted-foreground">No posts yet.</p>
                {isAuthenticated && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Click <strong>Run Pipeline</strong> to generate content for this brand.
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {posts.map((p) => (
                  <div key={p.id} className="post-card border-0 border-b border-border px-6 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm leading-relaxed flex-1">{p.content}</p>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={scoreClass(p.score)}>
                          {p.score != null ? p.score.toFixed(1) : "—"}
                        </span>
                        <span className="variant-chip">{p.variantType}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-3">
                      <span
                        className={`font-mono text-xs px-1.5 py-0.5 border ${
                          p.status === "published"
                            ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                            : p.status === "approved"
                            ? "border-blue-300 text-blue-700 bg-blue-50"
                            : p.status === "rejected"
                            ? "border-red-300 text-red-700 bg-red-50"
                            : "border-zinc-300 text-zinc-600 bg-zinc-50"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">{formatTime(p.createdAt)}</span>
                      {p.publishedAt && (
                        <span className="font-mono text-xs text-muted-foreground">
                          Published {formatTime(p.publishedAt)}
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-4 font-mono text-xs text-muted-foreground">
                        <span>{p.impressions ?? 0} imp</span>
                        <span>{p.likes ?? 0} likes</span>
                        <span>{p.reposts ?? 0} reposts</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pipeline tab */}
        {tab === "pipeline" && (
          <div>
            {runsLoading ? (
              <div className="p-6 font-mono text-sm text-muted-foreground">Loading…</div>
            ) : runs.length === 0 ? (
              <div className="p-6 font-mono text-sm text-muted-foreground">No pipeline runs yet.</div>
            ) : (
              <div>
                <div className="grid grid-cols-5 px-6 py-2 border-b border-border bg-secondary/40">
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Status</span>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Started</span>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Completed</span>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Generated</span>
                  <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Approved</span>
                </div>
                {runs.map((r) => (
                  <div key={r.id} className="grid grid-cols-5 px-6 py-3 border-b border-border hover:bg-secondary/30 transition-colors">
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 border self-start w-fit ${
                        r.status === "completed"
                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                          : r.status === "running"
                          ? "border-amber-300 text-amber-700 bg-amber-50"
                          : "border-red-300 text-red-700 bg-red-50"
                      }`}
                    >
                      {r.status}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{formatTime(r.startedAt)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatTime(r.completedAt)}</span>
                    <span className="font-mono text-sm">{r.postsGenerated ?? 0}</span>
                    <span className="font-mono text-sm">{r.postsApproved ?? 0}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Info tab */}
        {tab === "info" && (
          <div className="px-6 py-5 max-w-2xl">
            <div className="divide-y divide-border border border-border">
              {[
                ["Brand ID", brand.brandId],
                ["Name", brand.name],
                ["URL", brand.url ?? "—"],
                ["Description", brand.description ?? "—"],
                ["Audience", brand.audience ?? "—"],
                ["Tone", brand.tone ?? "—"],
                ["CTA", brand.cta ?? "—"],
                ["Schedule", parseCronTime(brand.schedule)],
                ["Active", brand.active ? "Yes" : "No"],
                ["Created", formatTime(brand.createdAt)],
                ["Updated", formatTime(brand.updatedAt)],
              ].map(([label, value]) => (
                <div key={label} className="flex">
                  <div className="w-36 shrink-0 px-4 py-3 bg-secondary/40 border-r border-border">
                    <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">{label}</span>
                  </div>
                  <div className="px-4 py-3 flex-1">
                    <span className="text-sm">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
