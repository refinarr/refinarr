"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateInstance, useUpdateInstance, useTestCredentials } from "@/client/hooks/data/useInstances";
import { withToast } from "@/client/lib/with-toast";
import { DEFAULT_ARR_TYPE } from "@/shared/arr-type";
import type { ArrType, Instance } from "@/shared/types/models";

interface Args {
  editing?: Instance | null;
  onSuccess: () => void;
}

const normalizeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `http://${url}`);

// Owns the AddInstanceDialog form state: schema, react-hook-form wiring,
// create/update/test mutations wrapped with toasts, the test-connection
// helper, and the radarr/sonarr type toggle. The parent component is left
// as pure JSX over this hook's return values.
export function useAddInstanceForm({ editing, onSuccess }: Args) {
  const t = useTranslations("settings.instanceForm");
  const tToast = useTranslations("toast.instance");
  const isEdit = !!editing;

  const create = useCreateInstance();
  const update = useUpdateInstance();
  const test = useTestCredentials();

  const [selectedType, setSelectedType] = useState<ArrType>(editing?.type ?? DEFAULT_ARR_TYPE);

  const schema = useMemo(
    () =>
      z.object({
        type: z.enum(["radarr", "sonarr"]),
        name: z.string().min(1),
        url: z.string().min(1).transform((v) => (/^https?:\/\//i.test(v) ? v : `http://${v}`)).pipe(z.url()),
        apiKey: isEdit ? z.string() : z.string().min(1),
        searchesPerHour: z.number().int().min(1).max(1000),
      }),
    [isEdit],
  );
  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, setValue, reset, getValues, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? { type: editing.type, name: editing.name, url: editing.url, apiKey: "", searchesPerHour: editing.searchesPerHour }
      : { type: DEFAULT_ARR_TYPE, name: "", url: "", apiKey: "", searchesPerHour: 20 },
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
    return runTest({ type: v.type, url: normalizeUrl(v.url), apiKey: v.apiKey });
  };

  const onChangeType = (next: ArrType) => {
    setSelectedType(next);
    setValue("type", next);
  };

  const submit = handleSubmit(async (data) => {
    if (editing) {
      const payload = data.apiKey.trim()
        ? data
        : { type: data.type, name: data.name, url: data.url, searchesPerHour: data.searchesPerHour };
      await runUpdate({ id: editing.id, data: payload });
    } else {
      await runCreate(data);
    }
    reset();
    onSuccess();
  });

  return {
    register,
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
