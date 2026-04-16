import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Analytics() {
  const brands = trpc.brands.all.useQuery();
  const [brandId, setBrandId] = useState<string | "all">("all");
  const [days, setDays] = useState(30);
  const range = useMemo(() => {
    const to = new Date();
    const from = subDays(to, days);
    return { from, to };
  }, [days]);

  const report = trpc.analytics.report.useQuery({
    brandId: brandId === "all" ? null : brandId,
    from: range.from,
    to: range.to,
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 font-mono">
        <h1 className="text-xl font-semibold">Analytics</h1>

        <div className="flex flex-wrap gap-4">
          <Select
            value={brandId}
            onValueChange={v => setBrandId(v as typeof brandId)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {(brands.data ?? []).map(b => (
                <SelectItem key={b.brandId} value={b.brandId}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {report.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : report.data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase">Total posts</p>
                <p className="text-2xl font-semibold">{report.data.summary.totalPosts}</p>
              </div>
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase">Top platform</p>
                <p className="text-lg font-medium capitalize">
                  {report.data.summary.topPlatform ?? "—"}
                </p>
              </div>
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase">Most active brand</p>
                <p className="text-lg font-medium truncate">
                  {report.data.summary.mostActiveBrand ?? "—"}
                </p>
              </div>
              <div className="border border-border rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase">Total reach</p>
                <p className="text-2xl font-semibold">{report.data.summary.totalReach}</p>
              </div>
            </div>

            <div className="h-64 border border-border rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.data.byPlatform}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" name="Posts" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-64 border border-border rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.data.postsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.data.recent.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(row.publishedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{row.brandId}</TableCell>
                    <TableCell className="capitalize">{row.platform}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      {(row.impressions ?? 0) +
                        (row.likes ?? 0) +
                        (row.reposts ?? 0) +
                        (row.clicks ?? 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
