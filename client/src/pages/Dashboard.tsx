import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

const BRAND_COLORS: Record<string, string> = {
  frankgrant: "#1a6b3c",
  nihpaylines: "#1a4a8a",
  rentlease: "#7c3a1a",
  rewbs: "#8a1a1a",
  busos: "#1a1a8a",
  coare: "#3a1a8a",
  chiefmarketingofficer: "#1a6b6b",
  stillhere: "#2d6a4f",
  promptangel: "#7b2d8b",
  codemama: "#c0392b",
  mfsautopilot: "#e67e22",
  mfsolopreneurs: "#16a085",
};

function parseCronTime(cron: string | null | undefined): string {
  if (!cron) return "—";
  // Parse "0 7 * * *" -> "7:00 AM"
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

function StatusDot({ status }: { status: string }) {
  const cls =
    status === "running"
      ? "dot-running"
      : status === "completed"
      ? "dot-completed"
      : "dot-failed";
  return <span className={cls} />;
}

export default function Dashboard() {
  const { data: brands = [], isLoading: brandsLoading } = trpc.brands.all.useQuery();
  const { data: runs = [], isLoading: runsLoading } = trpc.pipeline.recent.useQuery({ limit: 15 });
  const { data: stats = [] } = trpc.posts.stats.useQuery();

  const statMap = Object.fromEntries(stats.map((s) => [s.brandId, s.total]));

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background -m-4">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">AEDE</span>
          <span className="text-border">|</span>
          <span className="text-sm font-medium">Autonomous Execution + Distribution Engine</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
        </span>
      </header>

      <div className="flex">
        <main className="flex-1 min-w-0">
          {/* Stats row */}
          <div className="grid grid-cols-4 border-b border-border">
            <div className="stat-cell border-r border-border">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Brands</p>
              <p className="font-mono text-2xl font-semibold">{brands.length}</p>
            </div>
            <div className="stat-cell border-r border-border">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Active</p>
              <p className="font-mono text-2xl font-semibold text-emerald-700">
                {brands.filter((b) => b.active).length}
              </p>
            </div>
            <div className="stat-cell border-r border-border">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Posts</p>
              <p className="font-mono text-2xl font-semibold">
                {stats.reduce((a, s) => a + Number(s.total), 0)}
              </p>
            </div>
            <div className="stat-cell">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">Runs Today</p>
              <p className="font-mono text-2xl font-semibold">
                {runs.filter((r) => {
                  const d = new Date(r.startedAt);
                  const now = new Date();
                  return d.toDateString() === now.toDateString();
                }).length}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border">
            {/* Brand grid */}
            <div>
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-sm font-semibold uppercase tracking-widest">Brand Overview</h2>
              </div>
              {brandsLoading ? (
                <div className="p-5 font-mono text-sm text-muted-foreground">Loading…</div>
              ) : brands.length === 0 ? (
                <div className="p-5 font-mono text-sm text-muted-foreground">No brands configured.</div>
              ) : (
                <div>
                  {brands.map((b) => (
                    <Link key={b.brandId} href={`/brand/${b.brandId}`}>
                      <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border hover:bg-secondary/40 cursor-pointer transition-colors">
                        <div
                          className="w-1 self-stretch shrink-0"
                          style={{ background: b.accentColor ?? BRAND_COLORS[b.brandId] ?? "#888" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{b.name}</span>
                            {!b.active && (
                              <span className="font-mono text-xs text-muted-foreground border border-border px-1">
                                paused
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {b.audience ?? "No audience set"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-sm font-semibold">{statMap[b.brandId] ?? 0}</p>
                          <p className="font-mono text-xs text-muted-foreground">posts</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-xs text-muted-foreground">{parseCronTime(b.schedule)}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pipeline activity */}
            <div>
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-sm font-semibold uppercase tracking-widest">Pipeline Activity</h2>
              </div>
              {runsLoading ? (
                <div className="p-5 font-mono text-sm text-muted-foreground">Loading…</div>
              ) : runs.length === 0 ? (
                <div className="p-5 font-mono text-sm text-muted-foreground">No pipeline runs yet.</div>
              ) : (
                <div>
                  {runs.map((r) => {
                    const brand = brands.find((b) => b.brandId === r.brandId);
                    return (
                      <div key={r.id} className="pipeline-row">
                        <StatusDot status={r.status} />
                        <div
                          className="w-1 h-6 shrink-0"
                          style={{
                            background:
                              brand?.accentColor ??
                              BRAND_COLORS[r.brandId] ??
                              "#888",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {brand?.name ?? r.brandId}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {formatTime(r.startedAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0 font-mono text-xs text-muted-foreground">
                          <p>{r.postsGenerated ?? 0} gen</p>
                          <p>{r.postsApproved ?? 0} approved</p>
                        </div>
                        <span
                          className={`font-mono text-xs px-1.5 py-0.5 border ${
                            r.status === "completed"
                              ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                              : r.status === "running"
                              ? "border-amber-300 text-amber-700 bg-amber-50"
                              : "border-red-300 text-red-700 bg-red-50"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
      </div>
    </DashboardLayout>
  );
}
