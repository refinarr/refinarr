"use client";
import { useTranslations } from "next-intl";
import { ServerOff } from "lucide-react";
import { Button } from "@/client/components/ui/button";

interface Props {
  onAdd: () => void;
  // When set (e.g. "Sonarr"), the copy is scoped to that product — used
  // when a library page is opened for an arr type that has no configured
  // instance, vs. the generic "no instances at all" first-run case (#53).
  arrLabel?: string;
}

export function NoInstancesPrompt({ onAdd, arrLabel }: Props) {
  const t = useTranslations("states.noInstances");
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <ServerOff className="text-muted-foreground size-12" />
      <div>
        <p className="text-lg font-semibold">
          {arrLabel ? t("titleForType", { arr: arrLabel }) : t("title")}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          {arrLabel ? t("bodyForType", { arr: arrLabel }) : t("body")}
        </p>
      </div>
      <Button onClick={onAdd}>{t("cta")}</Button>
    </div>
  );
}
