import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClientsPage() {
  const utils = trpc.useUtils();
  const list = trpc.clients.list.useQuery();
  const invite = trpc.clients.invite.useMutation({
    onSuccess: () => {
      toast.success("Client invited");
      utils.clients.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const del = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client removed");
      utils.clients.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8 font-mono">
        <h1 className="text-xl font-semibold">Clients</h1>

        <form
          className="space-y-4 border border-border rounded-lg p-6"
          onSubmit={e => {
            e.preventDefault();
            invite.mutate({ name, email, tempPassword });
          }}
        >
          <h2 className="text-sm font-semibold uppercase tracking-widest">Invite client</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="n">Name</Label>
              <Input id="n" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e">Email</Label>
              <Input
                id="e"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp">Temporary password</Label>
              <Input
                id="tp"
                type="password"
                value={tempPassword}
                onChange={e => setTempPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
          </div>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? "Sending…" : "Invite"}
          </Button>
        </form>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest mb-2">All clients</h2>
          {list.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (list.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients yet — invite someone to give them portal access.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Brands</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data!.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.email}</TableCell>
                    <TableCell>{c.brandCount}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={del.isPending}
                        onClick={() => {
                          if (confirm(`Delete client ${c.email}?`)) del.mutate({ id: c.id });
                        }}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
