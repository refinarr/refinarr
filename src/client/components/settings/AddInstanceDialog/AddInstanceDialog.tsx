"use client";
import { useTranslations } from "next-intl";
import { Loader2, Plug } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/client/components/ui/dialog";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { FormField } from "@/client/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import type { PublicInstance } from "@/shared/types/api";
import type { ArrType } from "@/shared/types/models";
import { ALL_ARR_TYPES, isArrType } from "@/shared/arr-type";
import { useAddInstanceForm } from "./useAddInstanceForm";

const PLACEHOLDER_KEYS: Record<ArrType, { name: string; url: string }> = {
  radarr: { name: "namePlaceholder", url: "urlPlaceholder" },
  sonarr: { name: "namePlaceholderSonarr", url: "urlPlaceholderSonarr" },
};

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: PublicInstance | null;
}

export function AddInstanceDialog({ open, onClose, editing }: Props) {
  const t = useTranslations("settings.instanceForm");
  const tCommon = useTranslations("common");

  const {
    register,
    errors,
    selectedType,
    onChangeType,
    submit,
    handleTest,
    canTest,
    isEdit,
    submitting,
    testing,
  } = useAddInstanceForm({ editing, onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {/* Connection */}
          <div className="flex flex-col gap-1.5">
            <Label>{t("type")}</Label>
            <Select
              value={selectedType}
              onValueChange={(v) => {
                if (v && isArrType(v)) onChangeType(v);
              }}
            >
              <SelectTrigger>
                <SelectValue>{t(`types.${selectedType}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_ARR_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField
            id="instance-name"
            label={t("name")}
            error={errors.name?.message}
          >
            <Input
              {...register("name")}
              placeholder={t(PLACEHOLDER_KEYS[selectedType].name)}
            />
          </FormField>
          <FormField
            id="instance-url"
            label={t("url")}
            error={errors.url?.message}
          >
            <Input
              {...register("url")}
              placeholder={t(PLACEHOLDER_KEYS[selectedType].url)}
            />
          </FormField>
          <FormField
            id="instance-apikey"
            label={t("apiKey")}
            error={errors.apiKey?.message}
          >
            <Input
              {...register("apiKey")}
              type="password"
              placeholder={
                isEdit ? t("apiKeyPlaceholderEdit") : t("apiKeyPlaceholderNew")
              }
            />
          </FormField>

          {/* Performance */}
          <div className="border-t pt-3">
            <FormField
              id="instance-sph"
              label={t("searchesPerHour")}
              error={errors.searchesPerHour?.message}
              description={t("searchesPerHourHelp")}
            >
              <Input
                {...register("searchesPerHour", { valueAsNumber: true })}
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={!canTest || testing}
            >
              {testing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plug className="mr-2 size-4" />
              )}
              {t("testConnection")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {tCommon("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
