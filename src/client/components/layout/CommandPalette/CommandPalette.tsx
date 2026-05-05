"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Film,
  Tv2,
  LayoutDashboard,
  History,
  Settings,
  EyeOff,
  AlertCircle,
  Plus,
  ToggleLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/client/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/client/components/ui/command";
import { useInstances } from "@/client/hooks/data/useInstances";
import type { ArrType } from "@/shared/types/models";

// Per-arr-type bits the command palette needs: which heading key to use,
// which icon, and which route to open. Adding Lidarr / Whisparr is one
// more entry; the JSX below iterates this map and auto-renders.
const ARR_GROUPS: Record<ArrType, { headingKey: "groups.radarrInstance" | "groups.sonarrInstance"; route: string; Icon: typeof Film }> = {
  radarr: { headingKey: "groups.radarrInstance", route: "/movies", Icon: Film },
  sonarr: { headingKey: "groups.sonarrInstance", route: "/shows", Icon: Tv2 },
};
import { useConfig } from "@/client/hooks/data/useConfig";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("commandPalette");
  const tNav = useTranslations("nav");
  const { data: instances } = useInstances();
  const { data: config } = useConfig();

  // Global ⌘K / Ctrl+K listener — toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const arrTypes = Object.keys(ARR_GROUPS) as ArrType[];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[520px]" showCloseButton={false}>
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>
        <Command>
          <CommandInput placeholder={t("placeholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>

            <CommandGroup heading={t("groups.navigate")}>
              <CommandItem onSelect={() => go("/dashboard")}>
                <LayoutDashboard className="h-4 w-4" />
                {tNav("dashboard")}
              </CommandItem>
              <CommandItem onSelect={() => go("/movies")}>
                <Film className="h-4 w-4" />
                {tNav("movies")}
              </CommandItem>
              <CommandItem onSelect={() => go("/shows")}>
                <Tv2 className="h-4 w-4" />
                {tNav("shows")}
              </CommandItem>
              <CommandItem onSelect={() => go("/ignored")}>
                <EyeOff className="h-4 w-4" />
                {tNav("ignored")}
              </CommandItem>
              <CommandItem onSelect={() => go("/history")}>
                <History className="h-4 w-4" />
                {tNav("history")}
              </CommandItem>
              <CommandItem onSelect={() => go("/logs")}>
                <AlertCircle className="h-4 w-4" />
                {tNav("logs")}
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Settings className="h-4 w-4" />
                {tNav("settings")}
              </CommandItem>
            </CommandGroup>

            {arrTypes.map((type) => {
              const matches = instances?.filter((i) => i.type === type) ?? [];
              if (matches.length === 0) return null;
              const { headingKey, route, Icon } = ARR_GROUPS[type];
              return (
                <CommandGroup key={type} heading={t(headingKey)}>
                  {matches.map((i) => (
                    <CommandItem
                      key={i.id}
                      keywords={[type, i.name]}
                      onSelect={() => go(`${route}?instanceId=${i.id}`)}
                    >
                      <Icon className="h-4 w-4" />
                      {i.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}

            <CommandGroup heading={t("groups.actions")}>
              <CommandItem
                keywords={["add", "instance", "new"]}
                onSelect={() => go("/settings?action=add")}
              >
                <Plus className="h-4 w-4" />
                {t("actions.addInstance")}
              </CommandItem>
              <CommandItem
                keywords={["dry", "run", "live", "mode"]}
                onSelect={() => go("/settings#dry-run")}
              >
                <ToggleLeft className="h-4 w-4" />
                {t("actions.toggleDryRun")}
                <span className="ml-auto text-xs text-muted-foreground">
                  {config?.dryRun ? t("status.on") : t("status.off")}
                </span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
