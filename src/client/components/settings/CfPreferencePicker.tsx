"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { useCustomFormats } from "@/client/hooks/useCustomFormats";
import { usePreferences, useSetPreferences } from "@/client/hooks/usePreferences";
import type { Instance } from "@/shared/types/models";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  instance: Instance;
}

export function CfPreferencePicker({ instance }: Props) {
  const type = instance.type === "radarr" ? "radarr" : "sonarr";
  const { data: available, isLoading: loadingCfs } = useCustomFormats(type, instance.id);
  const { data: saved } = usePreferences(instance.id);
  const setPreferences = useSetPreferences();

  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (saved) setSelected(new Set(saved.map((p) => p.cfId)));
  }, [saved]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    const cfs = (available ?? [])
      .filter((cf) => selected.has(cf.id))
      .map((cf) => ({ cfId: cf.id, cfName: cf.name }));
    await setPreferences.mutateAsync({ instanceId: instance.id, cfs });
    toast.success("Custom Formats saved");
  };

  if (loadingCfs) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading custom formats…
        </CardContent>
      </Card>
    );
  }

  if (!available?.length) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          No custom formats found in {instance.name}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{instance.name}</CardTitle>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Badge variant="secondary">{selected.size} selected</Badge>
            )}
            <Button size="sm" onClick={save} disabled={setPreferences.isPending}>
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {available.map((cf) => (
            <div key={cf.id} className="flex items-center gap-2">
              <Checkbox
                id={`cf-${instance.id}-${cf.id}`}
                checked={selected.has(cf.id)}
                onCheckedChange={() => toggle(cf.id)}
              />
              <Label htmlFor={`cf-${instance.id}-${cf.id}`} className="text-sm cursor-pointer">
                {cf.name}
              </Label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
