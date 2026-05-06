"use client";
import { useTranslations } from "next-intl";
import { AppShell } from "@/client/components/layout/AppShell";
import { QueueContent } from "@/client/components/queue/QueueContent";
import { PageErrorBoundary } from "@/client/components/states/PageErrorBoundary";

export default function QueuePage() {
  const t = useTranslations("queue");
  return (
    <AppShell>
      <PageErrorBoundary>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
          </div>
          <QueueContent />
        </div>
      </PageErrorBoundary>
    </AppShell>
  );
}
