import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_TEXT_CHAR_LIMIT,
  PLATFORM_CHAR_LIMIT,
  type PlatformId,
} from "@shared/constants";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function minLimitForPlatforms(platforms: PlatformId[]): number {
  if (platforms.length === 0) return DEFAULT_TEXT_CHAR_LIMIT;
  return Math.min(...platforms.map(p => PLATFORM_CHAR_LIMIT[p]));
}

export default function Composer() {
  const [brandId, setBrandId] = useState<string>("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<PlatformId[]>([]);
  const [aiVariants, setAiVariants] = useState<string[] | null>(null);
  const [tab, setTab] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("12:00");

  const brands = trpc.brands.all.useQuery();
  const platformsQ = trpc.brands.listCredentialPlatforms.useQuery(
    { brandId },
    { enabled: Boolean(brandId) }
  );
  const logQ = trpc.posts.publishLogByBrand.useQuery(
    { brandId, limit: 20 },
    { enabled: Boolean(brandId) }
  );
  const upcomingQ = trpc.schedule.upcoming.useQuery(
    { brandId },
    { enabled: Boolean(brandId) && tab === "schedule" }
  );

  const available = useMemo(
    () => (platformsQ.data ?? []) as PlatformId[],
    [platformsQ.data]
  );

  useEffect(() => {
    setSelected(s => s.filter(x => available.includes(x)));
  }, [available]);

  const limit = minLimitForPlatforms(selected);
  const remaining = limit - content.length;

  const publish = trpc.posts.publish.useMutation({
    onSuccess: data => {
      if (data.queued) {
        toast.success("Post queued for approval");
      } else {
        toast.success("Publish complete");
      }
      logQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const generate = trpc.posts.generate.useMutation({
    onSuccess: d => {
      if (Array.isArray(d.variants) && d.variants.length > 1) {
        setAiVariants(d.variants);
        setContent(d.variants[0]);
      } else {
        setAiVariants(null);
        setContent(d.content);
      }
      toast.success("Content generated");
    },
    onError: e => toast.error(e.message),
  });

  const scheduleCreate = trpc.schedule.create.useMutation({
    onSuccess: () => {
      toast.success("Scheduled");
      upcomingQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const cancelSched = trpc.schedule.cancel.useMutation({
    onSuccess: () => upcomingQ.refetch(),
    onError: e => toast.error(e.message),
  });

  function togglePlatform(p: PlatformId) {
    setSelected(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  }

  function combineDateTime(d: Date, timeStr: string): Date {
    const [hh, mm] = timeStr.split(":").map(Number);
    const x = new Date(d);
    x.setHours(hh ?? 12, mm ?? 0, 0, 0);
    return x;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 font-mono">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Compose</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft a post and publish to connected platforms.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Brand</Label>
          <Select
            value={brandId || undefined}
            onValueChange={v => {
              setBrandId(v);
              setSelected([]);
            }}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {(brands.data ?? []).map(b => (
                <SelectItem key={b.brandId} value={b.brandId}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!brandId ? (
          <p className="text-sm text-muted-foreground">Select a brand to continue.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {available.length === 0 ? (
                <p className="text-sm text-muted-foreground w-full">
                  No platform credentials configured for this brand. Add them under the brand
                  detail page.
                </p>
              ) : (
                available.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlatform(p)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-colors",
                      selected.includes(p)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-secondary/60"
                    )}
                  >
                    {p}
                  </button>
                ))
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="body">Content</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generate.isPending || !brandId}
                  onClick={() =>
                    generate.mutate({
                      brandId,
                      hint: content.trim() || undefined,
                        platforms: selected.length > 0 ? selected : undefined,
                        variants: selected.length > 0 ? 2 : 1,
                    })
                  }
                >
                  {generate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Generate with AI
                </Button>
              </div>
              <Textarea
                id="body"
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                className={remaining < 0 ? "border-destructive" : ""}
              />
              <p className="text-xs text-muted-foreground">
                {selected.length === 0
                  ? "Select platforms to see the strictest character limit."
                  : `${remaining} characters remaining (limit ${limit} for selected platforms)`}
              </p>
              {aiVariants && aiVariants.length > 1 ? (
                <div className="space-y-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Pick an AI variant to use:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {aiVariants.map((v, idx) => (
                      <button
                        key={`${idx}-${v.slice(0, 12)}`}
                        type="button"
                        onClick={() => setContent(v)}
                        className="border border-border rounded-lg px-3 py-2 text-left hover:bg-secondary/40 transition-colors"
                      >
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">
                          Variant {idx + 1}
                        </p>
                        <p className="text-sm mt-1 line-clamp-4">{v}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <Tabs value={tab} onValueChange={v => setTab(v as "now" | "schedule")}>
              <TabsList>
                <TabsTrigger value="now">Publish now</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="now" className="space-y-4 mt-4">
                <Button
                  disabled={
                    publish.isPending ||
                    selected.length === 0 ||
                    !content.trim() ||
                    remaining < 0
                  }
                  onClick={() =>
                    publish.mutate({ brandId, content: content.trim(), platforms: selected })
                  }
                >
                  {publish.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Publish now
                </Button>

                {publish.data && !publish.data.queued && "results" in publish.data ? (
                  <div className="rounded-lg border border-border divide-y">
                    {publish.data.results.map(r => (
                      <div
                        key={r.platform}
                        className="flex items-start gap-3 p-3 text-sm"
                      >
                        {r.success ? (
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium capitalize">{r.platform}</p>
                          {r.postUrl ? (
                            <a
                              href={r.postUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline break-all"
                            >
                              {r.postUrl}
                            </a>
                          ) : null}
                          {r.errorMessage ? (
                            <p className="text-destructive text-xs mt-1">{r.errorMessage}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {publish.data?.queued ? (
                  <p className="text-sm text-muted-foreground">
                    This brand requires approval — your post was queued for review.
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="justify-start">
                        {scheduledDate ? format(scheduledDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                      />
                    </PopoverContent>
                  </Popover>
                  <div className="space-y-1">
                    <Label htmlFor="tm">Time (local)</Label>
                    <input
                      id="tm"
                      type="time"
                      className="border rounded-md px-2 py-2 text-sm bg-background"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  disabled={
                    scheduleCreate.isPending ||
                    !scheduledDate ||
                    selected.length === 0 ||
                    !content.trim()
                  }
                  onClick={() => {
                    if (!scheduledDate) return;
                    const when = combineDateTime(scheduledDate, scheduledTime);
                    scheduleCreate.mutate({
                      brandId,
                      content: content.trim(),
                      platforms: selected,
                      scheduledFor: when,
                    });
                  }}
                >
                  {scheduleCreate.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Schedule post
                </Button>

                <div>
                  <h3 className="text-sm font-medium mb-2">Upcoming</h3>
                  {(upcomingQ.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No scheduled posts. Pick a date and time, select platforms, then schedule.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {upcomingQ.data!.map(row => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-2 border rounded-md p-2 text-sm"
                        >
                          <span>
                            {new Date(row.scheduledFor).toLocaleString()} —{" "}
                            {(row.platforms as string[]).join(", ")}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cancelSched.isPending}
                            onClick={() => cancelSched.mutate({ id: row.id })}
                          >
                            Cancel
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {brandId ? (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Recent publish activity
            </h2>
            {logQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (logQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No publishes yet for this brand. Publish a post to see history here.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link / error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logQ.data!.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(row.publishedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="capitalize">{row.platform}</TableCell>
                      <TableCell>
                        <Badge variant={row.status === "success" ? "default" : "destructive"}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {row.postUrl ?? row.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
