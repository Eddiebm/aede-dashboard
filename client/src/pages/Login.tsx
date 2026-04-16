import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const login = trpc.auth.dashboardLogin.useMutation({
    onSuccess: () => {
      toast.success("Signed in");
      setLocation("/");
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background font-mono">
      <div className="w-full max-w-sm space-y-6 border border-border p-8 rounded-lg">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AEDE owner login</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the dashboard password configured on the server.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            login.mutate({ password });
          }}
        >
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
            {login.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
