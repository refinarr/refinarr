"use client";
import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Palette, Server, Settings, User } from "lucide-react";
import { AppShell } from "@/client/components/layout/AppShell";
import { useMe } from "@/client/hooks/data/useMe";
import { SettingsRail, type SettingsRailItem } from "./components/SettingsRail";
import { SettingsPicker } from "./components/SettingsPicker";

interface Props {
  children: ReactNode;
}

export default function SettingsLayout({ children }: Props) {
  const t = useTranslations("settings");
  const { data: me } = useMe();

  // Account section is only meaningful for password-bearing sessions.
  // X-Api-Key callers can't change a password, so the section + rail
  // entry are hidden to keep navigation honest (no dead links).
  const showAccount = me?.source === "session";

  const items = useMemo<SettingsRailItem[]>(() => {
    const list: SettingsRailItem[] = [
      {
        id: "general",
        label: t("sections.general"),
        icon: Settings,
        href: "/settings/general",
      },
      {
        id: "appearance",
        label: t("sections.appearance"),
        icon: Palette,
        href: "/settings/appearance",
      },
      {
        id: "instances",
        label: t("sections.instances"),
        icon: Server,
        href: "/settings/instances",
      },
      {
        id: "api-access",
        label: t("sections.apiAccess"),
        icon: KeyRound,
        href: "/settings/api-access",
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
    return list;
  }, [t, showAccount]);

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
