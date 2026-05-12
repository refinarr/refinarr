"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { AddInstanceDialog } from "@/client/components/settings/AddInstanceDialog";
import { InstanceCard } from "@/client/components/settings/InstanceCard";
import { SettingsCardSkeleton } from "@/client/components/states/SettingsCardSkeleton";
import { Button } from "@/client/components/ui/button";
import { useInstances } from "@/client/hooks/data/useInstances";
import type { PublicInstance } from "@/shared/types/api";

export default function InstancesSettingsPage() {
  const t = useTranslations("settings");
  const { data: instances, isLoading } = useInstances();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicInstance | null>(null);

  return (
    <section className="space-y-section">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("sections.instances")}</h2>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" /> {t("addInstance")}
        </Button>
      </div>
      {isLoading ? (
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
      <AddInstanceDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
      />
    </section>
  );
}
