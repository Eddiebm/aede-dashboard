import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PLATFORM_CHAR_LIMIT, type PlatformId } from "@shared/constants";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function minLimit(platforms: PlatformId[]): number {
  if (platforms.length === 0) return 280;
  return Math.min(...platforms.map(p => PLATFORM_CHAR_LIMIT[p]));
}

export default function ClientPortal() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandId, setBrandId] = useState("");
  const [content, setContent] = useState("");
  const [selected, setSelected] = useState<PlatformId[]>([]);

  const session = trpc.auth.me.useQuery();
  const login = trpc.clients.clientLogin.useMutation({
    onSuccess: () => {
      toast.success("Signed in");
      session.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => session.refetch(),
  });

  const brands = trpc.brands.all.useQuery(undefined, {
    enabled: session.data?.kind === "client",
  });
  const platformsQ = trpc.brands.listCredentialPlatforms.useQuery(
    { brandId },
    { enabled: Boolean(brandId) && session.data?.kind === "client" }
  );
  const logQ = trpc.posts.publishLogByBrand.useQuery(
    { brandId, limit: 10 },
    { enabled: Boolean(brandId) && session.data?.kind === "client" }
  );

  const publish = trpc.posts.publish.useMutation({
    onSuccess: d => {
      if (d.queued) toast.success("Queued for approval");
      else toast.success("Published");
      logQ.refetch();
    },
    onError: e => toast.error(e.message),
  });

  const available = (platformsQ.data ?? []) as PlatformId[];
  const limit = minLimit(selected);
  const remaining = limit - content.length;

  if (session.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (session.data?.kind !== "client") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background font-mono">
        <form
          className="w-full max-w-sm space-y-4 border border-border p-8 rounded-lg"
          onSubmit={e => {
            e.preventDefault();
            login.mutate({ email, password });
          }}
        >
          <h1 className="text-lg font-semibold">Client login</h1>
          <div className="space-y-2">
            <Label htmlFor="em">Email</Label>
            <Input
              id="em"
              type="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw">Password</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-mono p-6 max-w-2xl mx-auto space-y-8">
      <header className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Client</p>
          <p className="font-medium">{session.data.client.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Sign out
        </Button>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Your brands</h2>
        {(brands.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No brands assigned yet — contact your account owner.
          </p>
        ) : (
          <ul className="text-sm space-y-1">
            {brands.data!.map(b => (
              <li key={b.brandId}>{b.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest">Quick compose</h2>
        <Select value={brandId || undefined} onValueChange={setBrandId}>
          <SelectTrigger>
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

        {brandId ? (
          <>
            <div className="flex flex-wrap gap-2">
              {available.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setSelected(prev =>
                      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                    )
                  }
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border",
                    selected.includes(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <Textarea
              rows={6}
              value={content}
              onChange={e => setContent(e.target.value)}
              className={remaining < 0 ? "border-destructive" : ""}
            />
            <p className="text-xs text-muted-foreground">
              {remaining} characters remaining
            </p>
            <Button
              disabled={
                publish.isPending ||
                !content.trim() ||
                selected.length === 0 ||
                remaining < 0
              }
              onClick={() =>
                publish.mutate({
                  brandId,
                  content: content.trim(),
                  platforms: selected,
                })
              }
            >
              {publish.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Publish
            </Button>
          </>
        ) : null}
      </section>

      {brandId ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-2">
            Recent activity
          </h2>
          {(logQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No publishes yet.</p>
          ) : (
            <ul className="text-xs space-y-1">
              {logQ.data!.map(row => (
                <li key={row.id}>
                  {new Date(row.publishedAt).toLocaleString()} — {row.platform} — {row.status}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
