"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Label } from "@/client/components/ui/label";
import { useCustomFormats } from "@/client/hooks/useCustomFormats";
import { usePreferences, useSetPreferences } from "@/client/hooks/usePreferences";
import type { Instance } from "@/shared/types/models";
import { withToast } from "@/client/lib/with-toast";
import { Loader2 } from "lucide-react";

interface Props {
  instance: Instance;
}

export function CfPreferencePicker({ instance }: Props) {
  const t = useTranslations("settings.cfPicker");
  const tToast = useTranslations("toast.cfs");
  const tCommon = useTranslations("common");
  const type = instance.type === "radarr" ? "radarr" : "sonarr";
  const { data: available, isLoading: loadingCfs } = useCustomFormats(type, instance.id);
  const { data: saved } = usePreferences(instance.id);
  const setPreferences = useSetPreferences();

  const [overrides, setOverrides] = useState<Map<number, boolean>>(new Map());

  const savedIds = new Set((saved ?? []).map((p) => p.cfId));
  const isSelected = (id: number) => overrides.get(id) ?? savedIds.has(id);
  const selectedCount = (available ?? []).filter((cf) => isSelected(cf.id)).length;

  const toggle = (id: number) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, !isSelected(id));
      return next;
    });
  };

  const savePrefs = withToast(setPreferences, {
    success: tToast("saved"),
    error: tToast("saveFailed"),
  });

  const save = async () => {
    const cfs = (available ?? [])
      .filter((cf) => isSelected(cf.id))
      .map((cf) => ({ cfId: cf.id, cfName: cf.name }));
    await savePrefs({ instanceId: instance.id, cfs });
    setOverrides(new Map());
  };

  const clearAll = () => {
    const next = new Map<number, boolean>();
    for (const cf of available ?? []) next.set(cf.id, false);
    setOverrides(next);
  };

  if (loadingCfs) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("loading")}
        </CardContent>
      </Card>
    );
  }

  if (!available?.length) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          {t("empty", { name: instance.name })}
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
            {selectedCount > 0 && (
              <>
                <Badge variant="secondary">{t("selectedCount", { count: selectedCount })}</Badge>
                <Button size="sm" variant="ghost" onClick={clearAll}>
                  {tCommon("clear")}
                </Button>
              </>
            )}
            <Button size="sm" onClick={save} disabled={setPreferences.isPending}>
              {tCommon("save")}
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
                checked={isSelected(cf.id)}
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
