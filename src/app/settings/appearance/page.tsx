"use client";
import { useTranslations } from "next-intl";
import { ThemeSelector } from "@/client/components/settings/ThemeSelector";

export default function AppearanceSettingsPage() {
  const t = useTranslations("settings");
  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("sections.appearance")}</h2>
      <ThemeSelector />
    </section>
  );
}
