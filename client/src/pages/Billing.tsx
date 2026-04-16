import { useEffect } from "react";
import { useSearchParams } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const summary = trpc.billing.summary.useQuery();
  const checkout = trpc.billing.createCheckout.useMutation({
    onSuccess: d => {
      window.location.href = d.url;
    },
    onError: e => toast.error(e.message),
  });
  const portal = trpc.billing.createPortal.useMutation({
    onSuccess: d => {
      window.location.href = d.url;
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Checkout complete");
      summary.refetch();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, summary]);

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto space-y-6 font-mono">
        <h1 className="text-xl font-semibold">Billing</h1>
        {summary.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : summary.data ? (
          <div className="space-y-4 border border-border rounded-lg p-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Plan</p>
              <p className="text-lg font-medium">{summary.data.plan}</p>
              {summary.data.planExpiresAt ? (
                <p className="text-xs text-muted-foreground">
                  Renews {new Date(summary.data.planExpiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Brands</p>
              <p>
                {summary.data.brandsUsed} / {summary.data.brandLimit}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">
                Posts this month
              </p>
              <p>
                {summary.data.postsThisMonth} / {summary.data.postLimit}
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={checkout.isPending}
            onClick={() => checkout.mutate({ plan: "starter" })}
          >
            Upgrade to Starter
          </Button>
          <Button
            disabled={checkout.isPending}
            onClick={() => checkout.mutate({ plan: "pro" })}
          >
            Upgrade to Pro
          </Button>
          <Button
            variant="outline"
            disabled={portal.isPending}
            onClick={() => portal.mutate()}
          >
            Manage billing
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
