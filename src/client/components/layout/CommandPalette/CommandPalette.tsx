"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
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
import {
  useInstances,
  useConfiguredArrTypes,
} from "@/client/hooks/data/useInstances";
import { useConfig } from "@/client/hooks/data/useConfig";
import { ARR_UI } from "@/client/lib/arr-ui";
import { ALL_ARR_TYPES, ARR_LIBRARY_ROUTE } from "@/shared/arr-meta";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("commandPalette");
  const tNav = useTranslations("nav");
  const { data: instances } = useInstances();
  const arrTypes = useConfiguredArrTypes();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="overflow-hidden p-0 sm:max-w-[520px]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("description")}
        </DialogDescription>
        <Command>
          <CommandInput placeholder={t("placeholder")} />
          <CommandList>
            <CommandEmpty>{t("empty")}</CommandEmpty>

            <CommandGroup heading={t("groups.navigate")}>
              <CommandItem onSelect={() => go("/dashboard")}>
                <LayoutDashboard className="size-4" />
                {tNav("dashboard")}
              </CommandItem>
              {arrTypes.map((type) => {
                const { navLabelKey, Icon } = ARR_UI[type];
                return (
                  <CommandItem
                    key={type}
                    onSelect={() => go(ARR_LIBRARY_ROUTE[type])}
                  >
                    <Icon className="size-4" />
                    {tNav(navLabelKey)}
                  </CommandItem>
                );
              })}
              <CommandItem onSelect={() => go("/ignored")}>
                <EyeOff className="size-4" />
                {tNav("ignored")}
              </CommandItem>
              <CommandItem onSelect={() => go("/history")}>
                <History className="size-4" />
                {tNav("history")}
              </CommandItem>
              <CommandItem onSelect={() => go("/logs")}>
                <AlertCircle className="size-4" />
                {tNav("logs")}
              </CommandItem>
              <CommandItem onSelect={() => go("/settings")}>
                <Settings className="size-4" />
                {tNav("settings")}
              </CommandItem>
            </CommandGroup>

            {ALL_ARR_TYPES.map((type) => {
              const matches = instances?.filter((i) => i.type === type) ?? [];
              if (matches.length === 0) return null;
              const { commandPaletteHeadingKey, Icon } = ARR_UI[type];
              return (
                <CommandGroup key={type} heading={t(commandPaletteHeadingKey)}>
                  {matches.map((i) => (
                    <CommandItem
                      key={i.id}
                      keywords={[type, i.name]}
                      onSelect={() =>
                        go(`${ARR_LIBRARY_ROUTE[type]}?instanceId=${i.id}`)
                      }
                    >
                      <Icon className="size-4" />
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
                <Plus className="size-4" />
                {t("actions.addInstance")}
              </CommandItem>
              <CommandItem
                keywords={["dry", "run", "live", "mode"]}
                onSelect={() => go("/settings#dry-run")}
              >
                <ToggleLeft className="size-4" />
                {t("actions.toggleDryRun")}
                <span className="text-muted-foreground ml-auto text-xs">
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
