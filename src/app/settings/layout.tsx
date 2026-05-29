"use client";
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Info,
  KeyRound,
  Palette,
  Server,
  Settings,
  User,
} from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { useMe } from "@/client/hooks/data/useMe";
import { useConfig } from "@/client/hooks/data/useConfig";
import { SettingsRail, type SettingsRailItem } from "./components/SettingsRail";
import { SettingsPicker } from "./components/SettingsPicker";

interface Props {
  children: ReactNode;
}

export default function SettingsLayout({ children }: Props) {
  const t = useTranslations("settings");
  const { data: me } = useMe();
  const { data: config } = useConfig();

  // Account section is only meaningful for password-bearing sessions.
  // X-Api-Key callers can't change a password, so the section + rail
  // entry are hidden to keep navigation honest (no dead links).
  const showAccount = me?.source === "session";
  // Diagnostics is an opt-in surface gated behind debug mode — same
  // bar as the source-filter dropdown on /logs. Cache stats aren't
  // sensitive, but the page exists to help users investigate when
  // something feels off, not as a default-on settings affordance.
  const showDiagnostics = config?.debugMode ?? false;

  const items = useMemo<SettingsRailItem[]>(() => {
    // Order: operational first (General sets app defaults, Instances
    // wires Sonarr/Radarr — the app's core), then cosmetic
    // (Appearance), then admin-y (API Access, System), then auth
    // (Account), then dev-only (Diagnostics) last.
    const list: SettingsRailItem[] = [
      {
        id: "general",
        label: t("sections.general"),
        icon: Settings,
        href: "/settings/general",
      },
      {
        id: "instances",
        label: t("sections.instances"),
        icon: Server,
        href: "/settings/instances",
      },
      {
        id: "appearance",
        label: t("sections.appearance"),
        icon: Palette,
        href: "/settings/appearance",
      },
      {
        id: "api-access",
        label: t("sections.apiAccess"),
        icon: KeyRound,
        href: "/settings/api-access",
      },
      {
        id: "system",
        label: t("sections.system"),
        icon: Info,
        href: "/settings/system",
      },
    ];
    if (showAccount) {
      list.push({
        id: "account",
        label: t("sections.account"),
        icon: User,
        href: "/settings/account",
      });
    }
    if (showDiagnostics) {
      list.push({
        id: "diagnostics",
        label: t("sections.diagnostics"),
        icon: Activity,
        href: "/settings/diagnostics",
      });
    }
    return list;
  }, [t, showAccount, showDiagnostics]);

  return (
    <AppShell>
      <div className="space-y-page">
        {/* Inline header matches the Dashboard / Queue / History /
            Logs pattern — `<h1>` + muted subtitle in the page's normal
            content flow, no separate `bg-card` chrome bar. */}
        <header>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
        </header>

        <div className="md:hidden">
          <SettingsPicker items={items} />
        </div>

        <div className="gap-page flex">
          <SettingsRail items={items} className="sticky top-0 hidden md:flex" />
          <div className="space-y-page max-w-2xl flex-1">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
