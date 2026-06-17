import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle2, XCircle } from "lucide-react";

type Status = "idle" | "checking" | "online" | "offline";

const FUNCTION_NAME = "linkedin-api";

export default function EdgeFunctionStatus() {
  const [status, setStatus] = useState<Status>("idle");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [lastDeployAt, setLastDeployAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  const check = useCallback(async () => {
    setStatus("checking");
    setError(null);
    const start = performance.now();
    try {
      // Lightweight ping; the function ignores unknown actions but should respond.
      const { data, error: invokeError } = await supabase.functions.invoke(FUNCTION_NAME, {
        body: { action: "health_check" },
      });
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setCheckedAt(new Date());

      if (invokeError) {
        // Even an error response means the function is reachable & booted
        const ctx: any = (invokeError as any).context;
        const code = ctx?.status ?? null;
        setHttpStatus(code);
        if (code && code >= 200 && code < 600) {
          setStatus("online");
        } else {
          setStatus("offline");
          setError(invokeError.message);
        }
      } else {
        setHttpStatus(200);
        setStatus("online");
        // If the function returns a deployedAt/buildTime field, surface it.
        const deployedAt =
          (data as any)?.deployedAt ??
          (data as any)?.deployed_at ??
          (data as any)?.buildTime ??
          null;
        if (deployedAt) setLastDeployAt(new Date(deployedAt));
      }
    } catch (e: any) {
      setStatus("offline");
      setError(e?.message ?? "Unknown error");
      setCheckedAt(new Date());
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  const StatusBadge = () => {
    if (status === "checking" || status === "idle")
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Checking
        </Badge>
      );
    if (status === "online")
      return (
        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
          <CheckCircle2 className="h-3 w-3" /> Online
        </Badge>
      );
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Offline
      </Badge>
    );
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Edge Function Status</h1>
          <p className="text-sm text-muted-foreground">
            Live health check for the <code>{FUNCTION_NAME}</code> edge function.
          </p>
        </header>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{FUNCTION_NAME}</CardTitle>
            <StatusBadge />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Latency" value={latencyMs !== null ? `${latencyMs} ms` : "—"} />
            <Row label="HTTP status" value={httpStatus !== null ? String(httpStatus) : "—"} />
            <Row
              label="Last checked"
              value={checkedAt ? checkedAt.toLocaleTimeString() : "—"}
            />
            <Row
              label="Last successful deploy"
              value={
                lastDeployAt
                  ? lastDeployAt.toLocaleString()
                  : "Not reported by function"
              }
            />
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                {error}
              </div>
            )}
            <Button onClick={check} disabled={status === "checking"} className="mt-2">
              <RefreshCw className={`mr-2 h-4 w-4 ${status === "checking" ? "animate-spin" : ""}`} />
              Check now
            </Button>
            <p className="text-xs text-muted-foreground">
              Auto-refreshes every 30 seconds.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
