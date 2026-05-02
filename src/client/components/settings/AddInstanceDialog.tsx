"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useCreateInstance, useUpdateInstance } from "@/client/hooks/useInstances";
import { withToast } from "@/client/lib/with-toast";
import type { Instance } from "@/shared/types/models";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Instance | null;
}

export function AddInstanceDialog({ open, onClose, editing }: Props) {
  const t = useTranslations("settings.instanceForm");
  const tToast = useTranslations("toast.instance");
  const tCommon = useTranslations("common");
  const isEdit = !!editing;
  const create = useCreateInstance();
  const update = useUpdateInstance();
  const [selectedType, setSelectedType] = useState<"radarr" | "sonarr">(editing?.type ?? "radarr");

  const schema = useMemo(
    () =>
      z.object({
        type: z.enum(["radarr", "sonarr"]),
        name: z.string().min(1),
        url: z.url(),
        apiKey: isEdit ? z.string() : z.string().min(1),
      }),
    [isEdit]
  );
  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { type: editing.type, name: editing.name, url: editing.url, apiKey: "" }
      : { type: "radarr", name: "", url: "", apiKey: "" },
  });

  const runUpdate = withToast(update, { success: tToast("updated"), error: tToast("updateFailed") });
  const runCreate = withToast(create, { success: tToast("added"), error: tToast("addFailed") });

  const onSubmit = async (data: FormValues) => {
    if (editing) {
      const payload = data.apiKey.trim()
        ? data
        : { type: data.type, name: data.name, url: data.url };
      await runUpdate({ id: editing.id, data: payload });
    } else {
      await runCreate(data);
    }
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("type")}</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => {
                if (v) {
                  const next = v as "radarr" | "sonarr";
                  setSelectedType(next);
                  setValue("type", next);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue>{selectedType === "radarr" ? "Radarr" : "Sonarr"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="radarr">Radarr</SelectItem>
                <SelectItem value="sonarr">Sonarr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("name")}</Label>
            <Input {...register("name")} placeholder={t("namePlaceholder")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("url")}</Label>
            <Input {...register("url")} placeholder={t("urlPlaceholder")} />
            {errors.url && <p className="text-xs text-destructive">{errors.url.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("apiKey")}</Label>
            <Input
              {...register("apiKey")}
              type="password"
              placeholder={isEdit ? t("apiKeyPlaceholderEdit") : t("apiKeyPlaceholderNew")}
            />
            {errors.apiKey && <p className="text-xs text-destructive">{errors.apiKey.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>{tCommon("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
