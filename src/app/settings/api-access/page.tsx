"use client";
import { useTranslations } from "next-intl";
import { ApiKeyCard } from "@/client/components/settings/ApiKeyCard";

export default function ApiAccessSettingsPage() {
  const t = useTranslations("settings");
  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("sections.apiAccess")}</h2>
      <ApiKeyCard />
    </section>
  );
}
