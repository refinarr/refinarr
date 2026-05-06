"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Palette, Plus, Server, Settings, User } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { AddInstanceDialog } from "@/client/components/settings/AddInstanceDialog";
import { ApiKeyCard } from "@/client/components/settings/ApiKeyCard";
import { CfPreferencePicker } from "@/client/components/settings/CfPreferencePicker";
import { DryRunToggle } from "@/client/components/settings/DryRunToggle";
import { InstanceCard } from "@/client/components/settings/InstanceCard";
import { PasswordChangeCard } from "@/client/components/settings/PasswordChangeCard";
import { ScoringModeSelector } from "@/client/components/settings/ScoringModeSelector";
import { ThemeSelector } from "@/client/components/settings/ThemeSelector";
import { SettingsCardSkeleton } from "@/client/components/states/SettingsCardSkeleton";
import { Button } from "@/client/components/ui/button";
import { useInstances } from "@/client/hooks/data/useInstances";
import { useMe } from "@/client/hooks/data/useMe";
import { cn } from "@/client/lib/utils";
import { isManualMode } from "@/shared/scoring-mode";
import type { Instance } from "@/shared/types/models";
import { SettingsRail, type SettingsRailItem } from "./components/SettingsRail";
import { SettingsPicker } from "./components/SettingsPicker";
import { useActiveSection } from "./components/useActiveSection";

type SectionId =
  | "general"
  | "appearance"
  | "instances"
  | "api-access"
  | "account";

function readHash(ids: SectionId[]): SectionId | null {
  if (typeof window === "undefined") return null;
  const raw = window.location.hash.replace(/^#/, "");
  return ids.includes(raw as SectionId) ? (raw as SectionId) : null;
}

export default function SettingsPage() {
  const t = useTranslations("settings");
  const { data: instances, isLoading: loadingInstances } = useInstances();
  const { data: me } = useMe();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);

  // Account section is only meaningful for password-bearing sessions.
  // X-Api-Key callers can't change a password, so the section + rail
  // entry are skipped to keep the rail honest (no dead anchors).
  const showAccount = me?.source === "session";

  const items = useMemo<SettingsRailItem[]>(() => {
    const list: SettingsRailItem[] = [
      { id: "general", label: t("sections.general"), icon: Settings },
      { id: "appearance", label: t("sections.appearance"), icon: Palette },
      { id: "instances", label: t("sections.instances"), icon: Server },
      { id: "api-access", label: t("sections.apiAccess"), icon: KeyRound },
    ];
    if (showAccount) {
      list.push({ id: "account", label: t("sections.account"), icon: User });
    }
    return list;
  }, [t, showAccount]);

  const ids = useMemo(() => items.map((i) => i.id) as SectionId[], [items]);

  // `pickedId` is the single source of truth for the active section.
  // Drives the rail highlight, the dropdown value, and (on mobile) which
  // section renders (swap UX). Initialized from the URL hash so deep-
  // links land on the right section.
  const [pickedId, setPickedId] = useState<SectionId>(
    () => readHash(ids) ?? ids[0],
  );

  // Scroll-spy feeds back into pickedId so the rail tracks manual
  // scrolling. `lockUntilRef` suppresses the feedback during
  // programmatic scrolls (clicks → smooth-scroll), where the in-flight
  // scroll would otherwise yank the highlight to whatever section is in
  // the band mid-animation.
  const lockUntilRef = useRef(0);
  const handleSpy = useCallback((id: string) => {
    if (Date.now() < lockUntilRef.current) return;
    setPickedId(id as SectionId);
  }, []);
  useActiveSection({ ids, onChange: handleSpy });

  // Hash → state, on mount and on popstate. On desktop also smooth-scrolls.
  useEffect(() => {
    const apply = () => {
      const id = readHash(ids);
      if (!id) return;
      setPickedId(id);
      if (window.matchMedia("(min-width: 768px)").matches) {
        // RAF gives async children a tick to mount before measuring.
        requestAnimationFrame(() => {
          document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    apply();
    window.addEventListener("popstate", apply);
    return () => window.removeEventListener("popstate", apply);
  }, [ids]);

  const navigate = (id: string) => {
    const sectionId = id as SectionId;
    setPickedId(sectionId);
    // Suppress scroll-spy → pickedId sync during the smooth scroll, so
    // intermediate sections passing through the band don't override the
    // user's explicit choice.
    lockUntilRef.current = Date.now() + 800;
    if (window.location.hash !== `#${sectionId}`) {
      window.history.replaceState(null, "", `#${sectionId}`);
    }
    if (window.matchMedia("(min-width: 768px)").matches) {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const manualInstances = (instances ?? []).filter((i) =>
    isManualMode(i.scoringMode),
  );

  // Mobile renders only the active section (swap UX); desktop renders
  // every section so the scroll-spy can track them. The className
  // toggle keeps non-active sections in the DOM on desktop, hidden on
  // mobile.
  const sectionClass = (id: SectionId) =>
    cn(
      "scroll-mt-header space-y-section",
      pickedId !== id && "hidden md:block",
    );

  // pageHeader lives at AppShell's flex level (between TopHeader and
  // <main>), so it stays pinned on every viewport and iOS rubber-band
  // overscroll inside <main> can't drag it. The picker is mobile-only;
  // desktop uses the SettingsRail beside the content.
  const pageHeader = (
    <div className="bg-card border-border/60 space-y-section p-header border-b">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </header>
      <div className="md:hidden">
        <SettingsPicker items={items} active={pickedId} onSelect={navigate} />
      </div>
    </div>
  );

  return (
    <AppShell pageHeader={pageHeader}>
      <div className="space-y-page">
        <div className="gap-page flex">
          <SettingsRail
            items={items}
            active={pickedId}
            onSelect={navigate}
            className="sticky top-0 hidden md:flex"
          />

          <div className="space-y-page max-w-2xl flex-1">
            <section id="general" className={sectionClass("general")}>
              <h2 className="hidden text-lg font-semibold md:block">
                {t("sections.general")}
              </h2>
              <DryRunToggle prominent />
            </section>

            <section id="appearance" className={sectionClass("appearance")}>
              <h2 className="hidden text-lg font-semibold md:block">
                {t("sections.appearance")}
              </h2>
              <ThemeSelector />
            </section>

            <section id="instances" className={sectionClass("instances")}>
              <div className="flex items-center justify-between">
                <h2 className="hidden text-lg font-semibold md:block">
                  {t("sections.instances")}
                </h2>
                <Button
                  className="ml-auto"
                  onClick={() => {
                    setEditing(null);
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 size-4" /> {t("addInstance")}
                </Button>
              </div>
              {loadingInstances ? (
                <SettingsCardSkeleton />
              ) : (
                <div className="space-y-2">
                  {(instances ?? []).map((inst) => (
                    <InstanceCard
                      key={inst.id}
                      instance={inst}
                      onEdit={() => {
                        setEditing(inst);
                        setDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}

              {(instances ?? []).length > 0 && (
                <div className="space-y-subgroup pt-2">
                  <h3 className="text-muted-foreground text-sm font-medium">
                    {t("scoringMode")}
                  </h3>
                  {(instances ?? []).map((inst) => (
                    <div key={inst.id} className="flex items-center gap-4">
                      <span className="w-36 truncate text-sm font-medium">
                        {inst.name}
                      </span>
                      <ScoringModeSelector instanceId={inst.id} />
                    </div>
                  ))}
                </div>
              )}

              {manualInstances.length > 0 && (
                <div className="space-y-subgroup pt-2">
                  <div>
                    <h3 className="text-muted-foreground text-sm font-medium">
                      {t("wantedCfs")}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t("wantedCfsHelp")}
                    </p>
                  </div>
                  {manualInstances.map((inst) => (
                    <CfPreferencePicker key={inst.id} instance={inst} />
                  ))}
                </div>
              )}
            </section>

            <section id="api-access" className={sectionClass("api-access")}>
              <h2 className="hidden text-lg font-semibold md:block">
                {t("sections.apiAccess")}
              </h2>
              <ApiKeyCard />
            </section>

            {showAccount && (
              <section id="account" className={sectionClass("account")}>
                <h2 className="hidden text-lg font-semibold md:block">
                  {t("sections.account")}
                </h2>
                <PasswordChangeCard />
              </section>
            )}
          </div>
        </div>
      </div>

      <AddInstanceDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </AppShell>
  );
}
