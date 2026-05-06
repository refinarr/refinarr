"use client";
import { useEffect, useMemo, useState } from "react";
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

  // Mobile renders a single section at a time (swap UX). `pickedId` is
  // what the dropdown shows + what mobile renders; on desktop it falls
  // through to the IntersectionObserver-driven `observed` for rail
  // highlight. Initialized from URL hash so deep-links land on the
  // right section.
  const [pickedId, setPickedId] = useState<SectionId>(
    () => readHash(ids) ?? ids[0],
  );
  const observed = useActiveSection({ ids });
  // Active id: rail uses observed (scroll-spy); picker + mobile content
  // use pickedId (explicit choice). They re-converge on click via the
  // `navigate` handler which sets pickedId AND scrolls.
  const desktopActive = observed || pickedId;

  // Scroll-spy → URL hash (desktop only — mobile updates hash via navigate).
  useEffect(() => {
    if (!observed) return;
    if (window.location.hash === `#${observed}`) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    window.history.replaceState(null, "", `#${observed}`);
  }, [observed]);

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

  // Mobile header lives at AppShell's flex level (between TopHeader and
  // <main>) instead of as a sticky child of <main>. This keeps it pinned
  // by flex layout — immune to iOS rubber-band overscroll inside <main>,
  // which previously dragged the bar down and revealed empty space.
  const mobileHeader = (
    <div className="space-y-3 px-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
      </header>
      <SettingsPicker items={items} active={pickedId} onSelect={navigate} />
    </div>
  );

  return (
    <AppShell mobileHeader={mobileHeader}>
      <div className="space-y-page">
        {/* Desktop-only title + subtitle. Mobile renders these inside
            mobileHeader at the AppShell level. */}
        <header className="hidden md:block">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </header>

        <div className="gap-page flex">
          <SettingsRail
            items={items}
            active={desktopActive}
            onSelect={navigate}
            className="sticky top-0 hidden md:flex"
          />

          <div className="space-y-page max-w-2xl flex-1">
            <section id="general" className={sectionClass("general")}>
              <h2 className="text-lg font-semibold">{t("sections.general")}</h2>
              <DryRunToggle prominent />
            </section>

            <section id="appearance" className={sectionClass("appearance")}>
              <h2 className="text-lg font-semibold">
                {t("sections.appearance")}
              </h2>
              <ThemeSelector />
            </section>

            <section id="instances" className={sectionClass("instances")}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {t("sections.instances")}
                </h2>
                <Button
                  size="sm"
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
              <h2 className="text-lg font-semibold">
                {t("sections.apiAccess")}
              </h2>
              <ApiKeyCard />
            </section>

            {showAccount && (
              <section id="account" className={sectionClass("account")}>
                <h2 className="text-lg font-semibold">
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
