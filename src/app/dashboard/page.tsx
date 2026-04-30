"use client";
import { AppShell } from "@/client/components/layout/AppShell";
import { useInstances } from "@/client/hooks/useInstances";
import { useConfig } from "@/client/hooks/useConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Badge } from "@/client/components/ui/badge";

export default function DashboardPage() {
  const { data: instances } = useInstances();
  const { data: config } = useConfig();

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your instances</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Instances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{instances?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={config?.dryRun ? "outline" : "destructive"}>
                {config?.dryRun ? "Dry Run" : "Live"}
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Instances</h2>
          {(instances ?? []).map((inst) => (
            <Card key={inst.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <Badge variant="outline" className="capitalize">{inst.type}</Badge>
                <span className="font-medium">{inst.name}</span>
                <span className="text-xs text-muted-foreground">{inst.url}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
