"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useCreateInstance,
  useUpdateInstance,
  useTestCredentials,
} from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";
import { DEFAULT_ARR_TYPE } from "@/shared/arr-type";
import type { PublicInstance } from "@/shared/types/api";
import type { ArrType, ScoringMode } from "@/shared/types/models";

interface Args {
  editing?: PublicInstance | null;
  onSuccess: () => void;
}

const normalizeUrl = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `http://${url}`;

export function useAddInstanceForm({ editing, onSuccess }: Args) {
  const t = useTranslations("settings.instanceForm");
  const tToast = useTranslations("toast.instance");
  const isEdit = !!editing;

  const create = useCreateInstance();
  const update = useUpdateInstance();
  const test = useTestCredentials();

  const [selectedType, setSelectedType] = useState<ArrType>(
    editing?.type ?? DEFAULT_ARR_TYPE,
  );

  const schema = useMemo(
    () =>
      z.object({
        type: z.enum(["radarr", "sonarr"]),
        name: z.string().min(1),
        url: z
          .string()
          .min(1)
          .transform((v) => (/^https?:\/\//i.test(v) ? v : `http://${v}`))
          .pipe(z.url()),
        apiKey: isEdit ? z.string() : z.string().min(1),
        searchesPerHour: z.number().int().min(1).max(1000),
        scoringMode: z.enum(["manual", "profile"]),
        autoSearchEnabled: z.boolean(),
        autoSearchScheduleMode: z.enum(["interval", "cron"]),
        autoSearchIntervalMinutes: z
          .number()
          .int()
          .min(1)
          .max(60 * 24 * 365),
        autoSearchCronExpression: z.string().max(128),
        autoSearchBatchLimit: z.number().int().min(0).max(100),
        autoSearchMonitoredOnly: z.boolean(),
        autoSearchScope: z.enum(["missing", "upgrade", "flagged", "all"]),
        autoSearchPickStrategy: z.enum(["balanced", "random"]),
      }),
    [isEdit],
  );
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    getValues,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          type: editing.type,
          name: editing.name,
          url: editing.url,
          apiKey: "",
          searchesPerHour: editing.searchesPerHour,
          scoringMode: editing.scoringMode,
          autoSearchEnabled: editing.autoSearchEnabled,
          autoSearchScheduleMode: editing.autoSearchScheduleMode,
          autoSearchIntervalMinutes: editing.autoSearchIntervalMinutes,
          autoSearchCronExpression: editing.autoSearchCronExpression,
          autoSearchBatchLimit: editing.autoSearchBatchLimit,
          autoSearchMonitoredOnly: editing.autoSearchMonitoredOnly,
          autoSearchScope: editing.autoSearchScope,
          autoSearchPickStrategy: editing.autoSearchPickStrategy,
        }
      : {
          type: DEFAULT_ARR_TYPE,
          name: "",
          url: "",
          apiKey: "",
          searchesPerHour: 20,
          scoringMode: "profile" as ScoringMode,
          autoSearchEnabled: false,
          autoSearchScheduleMode: "interval" as const,
          autoSearchIntervalMinutes: 1440,
          autoSearchCronExpression: "0 3 * * *",
          autoSearchBatchLimit: 5,
          autoSearchMonitoredOnly: true,
          autoSearchScope: "flagged" as const,
          autoSearchPickStrategy: "balanced" as const,
        },
  });

  const runUpdate = withToast(update, {
    success: tToast("updated"),
    error: tToast("updateFailed"),
  });
  const runCreate = withToast(create, {
    success: tToast("added"),
    error: tToast("addFailed"),
  });
  const runTest = withToast(test, {
    success: tToast("testOk", { name: editing?.name ?? t("testFallbackName") }),
    error: tToast("testFailed", {
      name: editing?.name ?? t("testFallbackName"),
    }),
  });

  const watchedUrl = useWatch({ control, name: "url" });
  const watchedApiKey = useWatch({ control, name: "apiKey" });
  const canTest = !!watchedUrl?.trim() && !!watchedApiKey?.trim();

  const handleTest = () => {
    const v = getValues();
    return runTest({
      type: v.type,
      url: normalizeUrl(v.url),
      apiKey: v.apiKey,
    });
  };

  const onChangeType = (next: ArrType) => {
    setSelectedType(next);
    setValue("type", next);
  };

  const submit = handleSubmit(async (data) => {
    if (editing) {
      const payload = data.apiKey.trim()
        ? data
        : {
            type: data.type,
            name: data.name,
            url: data.url,
            searchesPerHour: data.searchesPerHour,
            scoringMode: data.scoringMode,
            autoSearchEnabled: data.autoSearchEnabled,
            autoSearchScheduleMode: data.autoSearchScheduleMode,
            autoSearchIntervalMinutes: data.autoSearchIntervalMinutes,
            autoSearchCronExpression: data.autoSearchCronExpression,
            autoSearchBatchLimit: data.autoSearchBatchLimit,
            autoSearchMonitoredOnly: data.autoSearchMonitoredOnly,
            autoSearchScope: data.autoSearchScope,
            autoSearchPickStrategy: data.autoSearchPickStrategy,
          };
      await runUpdate({ id: editing.id, data: payload });
    } else {
      await runCreate(data);
    }
    reset();
    onSuccess();
  });

  return {
    register,
    control,
    errors,
    selectedType,
    onChangeType,
    submit,
    handleTest,
    canTest,
    isEdit,
    submitting: create.isPending || update.isPending,
    testing: test.isPending,
  };
}
