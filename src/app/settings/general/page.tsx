"use client";
import { useTranslations } from "next-intl";
import { DebugModeToggle } from "@/client/components/settings/DebugModeToggle";
import { DryRunToggle } from "@/client/components/settings/DryRunToggle";

export default function GeneralSettingsPage() {
  const t = useTranslations("settings");
  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("sections.general")}</h2>
      <DryRunToggle prominent />
      <DebugModeToggle />
    </section>
  );
}
