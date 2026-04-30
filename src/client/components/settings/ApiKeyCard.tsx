"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useConfig, useUpdateConfig } from "@/client/hooks/useConfig";
import { toast } from "sonner";
export function ApiKeyCard() {
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [visible, setVisible] = useState(false);

  const apiKey = config?.apiKey ?? "";

  const copy = () => {
    navigator.clipboard.writeText(apiKey);
    toast.success("API key copied");
  };

  const regenerate = async () => {
    const { randomBytes } = await import("crypto");
    const newKey = randomBytes(16).toString("hex");
    await updateConfig.mutateAsync({ apiKey: newKey });
    toast.success("API key regenerated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">API Access</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Input
          readOnly
          type={visible ? "text" : "password"}
          value={apiKey}
          className="font-mono text-sm"
        />
        <Button variant="outline" size="icon" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={copy}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={regenerate} disabled={updateConfig.isPending}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
