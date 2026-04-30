"use client";
import { useState } from "react";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import { Badge } from "@/client/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { useConfig, useUpdateConfig } from "@/client/hooks/useConfig";
import { toast } from "sonner";

export function DryRunToggle() {
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isDryRun = config?.dryRun ?? true;

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      setConfirmOpen(true);
    } else {
      updateConfig.mutate({ dryRun: "true" });
      toast.info("Dry Run mode enabled");
    }
  };

  const goLive = async () => {
    await updateConfig.mutateAsync({ dryRun: "false" });
    toast.warning("Live mode enabled — actions will execute for real");
    setConfirmOpen(false);
  };

  return (
    <>
      <div className="flex items-center gap-4">
        <Switch checked={isDryRun} onCheckedChange={handleToggle} />
        <Label>Dry Run Mode</Label>
        <Badge variant={isDryRun ? "outline" : "destructive"}>
          {isDryRun ? "Dry Run" : "Live"}
        </Badge>
      </div>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch to Live Mode?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            In Live mode, search, delete, and blacklist actions will execute for real. Make sure
            you&apos;re ready.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={goLive}>Go Live</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
