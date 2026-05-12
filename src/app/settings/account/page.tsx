"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PasswordChangeCard } from "@/client/components/settings/PasswordChangeCard";
import { useMe } from "@/client/hooks/data/useMe";

export default function AccountSettingsPage() {
  const t = useTranslations("settings");
  const router = useRouter();
  const { data: me, isLoading } = useMe();

  // X-Api-Key callers don't have a password to change. The rail hides
  // the entry for them, but direct nav (typed URL, stale bookmark) can
  // still land here — punt them back to /settings/general once we know
  // who they are. While useMe is loading we render nothing rather than
  // a flash of the password form for an unauthenticated viewer.
  useEffect(() => {
    if (!isLoading && me && me.source !== "session") {
      router.replace("/settings/general");
    }
  }, [isLoading, me, router]);

  if (isLoading || me?.source !== "session") return null;

  return (
    <section className="space-y-section">
      <h2 className="text-lg font-semibold">{t("sections.account")}</h2>
      <PasswordChangeCard />
    </section>
  );
}
