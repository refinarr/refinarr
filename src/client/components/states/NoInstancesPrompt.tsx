"use client";
import { ServerOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";

interface Props {
  onAdd: () => void;
}

export function NoInstancesPrompt({ onAdd }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ServerOff className="h-12 w-12 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold">No instances configured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Add a Radarr or Sonarr instance to get started.
        </p>
      </div>
      <Button onClick={onAdd}>Add Instance</Button>
    </div>
  );
}
