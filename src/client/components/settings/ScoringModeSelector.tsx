"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { Label } from "@/client/components/ui/label";
import { useConfig, useUpdateConfig } from "@/client/hooks/useConfig";
import { toast } from "sonner";

interface Props {
  instanceId: number;
}

export function ScoringModeSelector({ instanceId }: Props) {
  const { data: config } = useConfig();
  const updateConfig = useUpdateConfig();
  const key = `scoringMode:${instanceId}`;
  const mode = config?.scoringModes?.[key] ?? "manual";

  const handleChange = async (value: string) => {
    await updateConfig.mutateAsync({ [key]: value });
    toast.success(`Scoring mode set to ${value}`);
  };

  return (
    <div className="flex items-center gap-3">
      <Label>Scoring Mode</Label>
      <Select value={mode} onValueChange={(v) => { if (v) handleChange(v); }}>
        <SelectTrigger className="w-36">
          <SelectValue>{mode === "manual" ? "Manual" : "Profile"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">Manual</SelectItem>
          <SelectItem value="profile">Profile</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
