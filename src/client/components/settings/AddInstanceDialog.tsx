"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { FormField } from "@/client/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/client/components/ui/select";
import { useCreateInstance, useUpdateInstance, useTestCredentials } from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";
import type { Instance } from "@/shared/types/models";
import { Loader2, Plug } from "lucide-react";

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
  const test = useTestCredentials();
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

  const { register, handleSubmit, setValue, reset, getValues, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { type: editing.type, name: editing.name, url: editing.url, apiKey: "" }
      : { type: "radarr", name: "", url: "", apiKey: "" },
  });

  const runUpdate = withToast(update, { success: tToast("updated"), error: tToast("updateFailed") });
  const runCreate = withToast(create, { success: tToast("added"), error: tToast("addFailed") });
  const runTest = withToast(test, {
    success: tToast("testOk", { name: editing?.name ?? t("testFallbackName") }),
    error: tToast("testFailed", { name: editing?.name ?? t("testFallbackName") }),
  });

  const watchedUrl = useWatch({ control, name: "url" });
  const watchedApiKey = useWatch({ control, name: "apiKey" });
  const canTest = !!watchedUrl?.trim() && !!watchedApiKey?.trim();

  const handleTest = () => {
    const v = getValues();
    return runTest({ type: v.type, url: v.url, apiKey: v.apiKey });
  };

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

  const submitting = create.isPending || update.isPending;

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
          <FormField id="instance-name" label={t("name")} error={errors.name?.message}>
            <Input {...register("name")} placeholder={t("namePlaceholder")} />
          </FormField>
          <FormField id="instance-url" label={t("url")} error={errors.url?.message}>
            <Input {...register("url")} placeholder={t("urlPlaceholder")} />
          </FormField>
          <FormField id="instance-apikey" label={t("apiKey")} error={errors.apiKey?.message}>
            <Input
              {...register("apiKey")}
              type="password"
              placeholder={isEdit ? t("apiKeyPlaceholderEdit") : t("apiKeyPlaceholderNew")}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{tCommon("cancel")}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!canTest || test.isPending}
            >
              {test.isPending
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Plug className="mr-2 h-4 w-4" />}
              {t("testConnection")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
