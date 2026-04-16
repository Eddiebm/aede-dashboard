import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ReviewQueue() {
  const utils = trpc.useUtils();
  const list = trpc.approval.list.useQuery();
  const approve = trpc.approval.approve.useMutation({
    onSuccess: () => {
      toast.success("Approved and published");
      utils.approval.list.invalidate();
      utils.approval.pendingCount.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const reject = trpc.approval.reject.useMutation({
    onSuccess: () => {
      toast.success("Rejected");
      utils.approval.list.invalidate();
      utils.approval.pendingCount.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    type Item = NonNullable<typeof list.data>[number];
    const m = new Map<string, Item[]>();
    for (const item of list.data ?? []) {
      const arr = m.get(item.brandId) ?? [];
      arr.push(item);
      m.set(item.brandId, arr);
    }
    return m;
  }, [list.data]);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 font-mono">
        <h1 className="text-xl font-semibold">Review queue</h1>
        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (list.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts awaiting approval. When a brand requires approval, new posts appear here.
          </p>
        ) : (
          Array.from(grouped.entries()).map(([brandId, items]) => (
            <div key={brandId} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{brandId}</p>
              {items.map(item => (
                <div
                  key={item.id}
                  className="border-t border-border pt-3 first:border-t-0 first:pt-0 space-y-2"
                >
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                  <p className="text-xs text-muted-foreground">
                    Platforms: {(item.platforms as string[]).join(", ")}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={approve.isPending || reject.isPending}
                      onClick={() => approve.mutate({ id: item.id })}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={approve.isPending || reject.isPending}
                      onClick={() => reject.mutate({ id: item.id })}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
