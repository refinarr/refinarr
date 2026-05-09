"use client";
import { useState } from "react";
import { useController } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Loader2, Plug } from "lucide-react";
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
import { CfPreferencePicker } from "@/client/components/settings/CfPreferencePicker";
import {
  AutoSearchFormFields,
  type AutoSearchFields,
} from "@/client/components/settings/AutoSearchFormFields";
import type { PublicInstance } from "@/shared/types/api";
import type { ArrType, ScoringMode } from "@/shared/types/models";
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
  const tTypes = useTranslations("settings.instanceForm.types");
  const tAutoSearch = useTranslations("settings.autoSearch");
  const tSettings = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [autoSearchOpen, setAutoSearchOpen] = useState(
    editing?.autoSearchEnabled ?? false,
  );

  const {
    register,
    control,
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

  const { field: scoringModeField } = useController({
    control,
    name: "scoringMode",
  });
  const { field: autoSearchEnabledField } = useController({
    control,
    name: "autoSearchEnabled",
  });
  const { field: scheduleModeField } = useController({
    control,
    name: "autoSearchScheduleMode",
  });
  const { field: intervalField } = useController({
    control,
    name: "autoSearchIntervalMinutes",
  });
  const { field: cronField } = useController({
    control,
    name: "autoSearchCronExpression",
  });
  const { field: batchField } = useController({
    control,
    name: "autoSearchBatchLimit",
  });
  const { field: monitoredField } = useController({
    control,
    name: "autoSearchMonitoredOnly",
  });
  const { field: scopeField } = useController({
    control,
    name: "autoSearchScope",
  });
  const { field: pickStrategyField } = useController({
    control,
    name: "autoSearchPickStrategy",
  });

  const autoSearchValue: AutoSearchFields = {
    autoSearchEnabled: autoSearchEnabledField.value,
    autoSearchScheduleMode: scheduleModeField.value,
    autoSearchIntervalMinutes: intervalField.value,
    autoSearchCronExpression: cronField.value,
    autoSearchBatchLimit: batchField.value,
    autoSearchMonitoredOnly: monitoredField.value,
    autoSearchScope: scopeField.value,
    autoSearchPickStrategy: pickStrategyField.value,
  };

  const handleAutoSearchChange = (next: Partial<AutoSearchFields>) => {
    if (next.autoSearchEnabled !== undefined)
      autoSearchEnabledField.onChange(next.autoSearchEnabled);
    if (next.autoSearchScheduleMode !== undefined)
      scheduleModeField.onChange(next.autoSearchScheduleMode);
    if (next.autoSearchIntervalMinutes !== undefined)
      intervalField.onChange(next.autoSearchIntervalMinutes);
    if (next.autoSearchCronExpression !== undefined)
      cronField.onChange(next.autoSearchCronExpression);
    if (next.autoSearchBatchLimit !== undefined)
      batchField.onChange(next.autoSearchBatchLimit);
    if (next.autoSearchMonitoredOnly !== undefined)
      monitoredField.onChange(next.autoSearchMonitoredOnly);
    if (next.autoSearchScope !== undefined)
      scopeField.onChange(next.autoSearchScope);
    if (next.autoSearchPickStrategy !== undefined)
      pickStrategyField.onChange(next.autoSearchPickStrategy);
  };

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
                <SelectValue>{tTypes(selectedType)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ALL_ARR_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {tTypes(type)}
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
          <div className="flex flex-col gap-3 border-t pt-3">
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
            <FormField
              id="instance-scoring-mode"
              label={tAutoSearch("scoringModeLabel")}
            >
              <Select
                value={scoringModeField.value}
                onValueChange={(v) =>
                  scoringModeField.onChange(v as ScoringMode)
                }
              >
                <SelectTrigger id="instance-scoring-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profile">
                    {tAutoSearch("scoringModeProfile")}
                  </SelectItem>
                  <SelectItem value="manual">
                    {tAutoSearch("scoringModeManual")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Wanted Custom Formats — Edit only */}
          {isEdit && editing && (
            <div className="border-t pt-3">
              <p className="mb-2 text-sm font-medium">
                {tSettings("wantedCfs")}
              </p>
              <CfPreferencePicker instance={editing} />
            </div>
          )}

          {/* Auto-search */}
          <div className="border-t pt-2">
            <button
              type="button"
              onClick={() => setAutoSearchOpen((o) => !o)}
              className="flex w-full items-center gap-2 py-1.5 text-sm font-medium"
            >
              {autoSearchOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              {tAutoSearch("sectionTitle")}
              <span className="text-muted-foreground text-xs font-normal">
                ({tAutoSearch("optionalLabel")})
              </span>
            </button>
            {autoSearchOpen && (
              <div className="mt-2">
                <AutoSearchFormFields
                  value={autoSearchValue}
                  onChange={handleAutoSearchChange}
                />
              </div>
            )}
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
