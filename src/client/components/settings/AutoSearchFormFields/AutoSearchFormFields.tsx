"use client";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/client/components/ui/switch";
import { Label } from "@/client/components/ui/label";
import { Input } from "@/client/components/ui/input";
import { FormField } from "@/client/components/ui/form-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/client/components/ui/tabs";
import { useCronPreview } from "@/client/hooks/data/useAutoSearch";
import { useDebouncedValue } from "@/client/hooks/ui/useDebouncedValue";
import { formatCronTime } from "@/client/lib/format";
import type {
  AutoSearchPickStrategy,
  AutoSearchScope,
  AutoSearchScheduleMode,
  AutoSearchScoringMode,
} from "@/shared/types/models";

export interface AutoSearchFields {
  autoSearchEnabled: boolean;
  autoSearchScheduleMode: AutoSearchScheduleMode;
  autoSearchIntervalMinutes: number;
  autoSearchCronExpression: string;
  autoSearchBatchLimit: number;
  autoSearchMonitoredOnly: boolean;
  autoSearchScope: AutoSearchScope;
  autoSearchPickStrategy: AutoSearchPickStrategy;
  autoSearchCooldownHours: number;
  autoSearchScoringMode: AutoSearchScoringMode;
}

function isScheduleMode(v: string | null): v is AutoSearchScheduleMode {
  return v === "interval" || v === "cron";
}

function isIntervalUnit(v: string | null): v is IntervalDisplayUnit["key"] {
  return v === "minutes" || v === "hours" || v === "days";
}

function isPickStrategy(v: string | null): v is AutoSearchPickStrategy {
  return v === "balanced" || v === "random";
}

const AUTO_SEARCH_SCORING_MODE_SET = new Set<string>(["inherit", "profile"]);
function isScoringMode(v: string | null): v is AutoSearchScoringMode {
  return v !== null && AUTO_SEARCH_SCORING_MODE_SET.has(v);
}

function isAutoSearchScope(v: string | null): v is AutoSearchScope {
  return v === "missing" || v === "upgrade" || v === "flagged" || v === "all";
}

interface IntervalDisplayUnit {
  key: "minutes" | "hours" | "days";
  divisor: number;
  max: number;
}

const CRON_PRESETS = [
  { labelKey: "cronPresetNightly" as const, expression: "0 3 * * *" },
  { labelKey: "cronPresetTwiceDaily" as const, expression: "0 6,18 * * *" },
  { labelKey: "cronPresetWeekends" as const, expression: "0 3 * * 0,6" },
  { labelKey: "cronPresetHourly" as const, expression: "0 * * * *" },
] as const;

const UNITS: IntervalDisplayUnit[] = [
  { key: "minutes", divisor: 1, max: 59 },
  { key: "hours", divisor: 60, max: 23 },
  { key: "days", divisor: 1440, max: 365 },
];

const UNIT_DIVISOR: Record<IntervalDisplayUnit["key"], number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

function autoFormatCron(raw: string, prev: string): string {
  if (raw.length <= prev.length) return raw;
  // Paste of exactly 5 simple chars (digits + *): treat each as its own field
  if (
    raw.length - prev.length > 1 &&
    !raw.includes(" ") &&
    raw.length === 5 &&
    /^[\d*]+$/.test(raw)
  ) {
    return raw.split("").join(" ");
  }
  let result = raw;
  for (let i = 0; i < 10; i++) {
    const before = result;
    // Space before * when not already preceded by space/comma/slash/dash
    result = result.replace(/([^ ,/\-])\*/g, "$1 *");
    // Split leading-zero digit pair e.g. "03" → "0 3" (not 00, not inside ranges/steps)
    result = result.replace(/(?<!\d)0([1-9])(?![/\-,])/g, "0 $1");
    result = result.replace(/ {2,}/g, " ");
    if (result === before) break;
  }
  return result;
}

function minutesToDisplay(minutes: number): {
  value: number;
  unit: IntervalDisplayUnit["key"];
} {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "days" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "hours" };
  return { value: minutes, unit: "minutes" };
}

function displayToMinutes(
  value: number,
  unit: IntervalDisplayUnit["key"],
): number {
  return value * UNIT_DIVISOR[unit];
}

interface Props {
  value: AutoSearchFields;
  onChange: (next: Partial<AutoSearchFields>) => void;
  disabled?: boolean;
}

export function AutoSearchFormFields({ value, onChange, disabled }: Props) {
  const t = useTranslations("settings.autoSearch");
  const prevCronRef = useRef(value.autoSearchCronExpression);
  const { value: intervalValue, unit: intervalUnit } = minutesToDisplay(
    value.autoSearchIntervalMinutes,
  );
  const cronPreview = useCronPreview(value.autoSearchCronExpression);
  const debouncedCron = useDebouncedValue(value.autoSearchCronExpression, 400);
  const trimmedCron = debouncedCron.trim();
  const cronFieldCount = trimmedCron.split(/\s+/).length;
  const isAtAlias = /^@(yearly|annually|monthly|weekly|daily|hourly)$/i.test(
    trimmedCron,
  );
  const cronError =
    (trimmedCron !== "" && !isAtAlias && cronFieldCount !== 5) ||
    cronPreview.isError;

  const scopeLabel: Record<AutoSearchScope, string> = {
    missing: t("scopeMissing"),
    upgrade: t("scopeUpgrade"),
    flagged: t("scopeFlagged"),
    all: t("scopeAll"),
  };
  const scopeDesc: Record<AutoSearchScope, string> = {
    missing: t("scopeMissingDesc"),
    upgrade: t("scopeUpgradeDesc"),
    flagged: t("scopeFlaggedDesc"),
    all: t("scopeAllDesc"),
  };
  const strategy: AutoSearchPickStrategy = value.autoSearchPickStrategy;
  const pickLabel: Record<AutoSearchPickStrategy, string> = {
    balanced: t("pickStrategyBalanced"),
    random: t("pickStrategyRandom"),
  };
  const pickDesc: Record<AutoSearchPickStrategy, string> = {
    balanced: t("pickStrategyBalancedDesc"),
    random: t("pickStrategyRandomDesc"),
  };
  const scoringModeLabel: Record<AutoSearchScoringMode, string> = {
    inherit: t("scoringModeInherit"),
    profile: t("scoringModeProfile"),
  };
  const scoringModeDesc: Record<AutoSearchScoringMode, string> = {
    inherit: t("scoringModeInheritDesc"),
    profile: t("scoringModeProfileDesc"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Switch
          id="auto-search-enabled"
          checked={value.autoSearchEnabled}
          onCheckedChange={(checked) =>
            onChange({ autoSearchEnabled: checked })
          }
          disabled={disabled}
        />
        <Label htmlFor="auto-search-enabled" className="cursor-pointer">
          {t("enableLabel")}
        </Label>
      </div>

      {value.autoSearchEnabled && (
        <>
          <Tabs
            value={value.autoSearchScheduleMode}
            onValueChange={(v) => {
              if (isScheduleMode(v)) onChange({ autoSearchScheduleMode: v });
            }}
          >
            <TabsList>
              <TabsTrigger value="interval" disabled={disabled}>
                {t("modeIntervalTab")}
              </TabsTrigger>
              <TabsTrigger value="cron" disabled={disabled}>
                {t("modeCronTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="interval" className="mt-3">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <FormField
                    id="auto-search-interval"
                    label={t("intervalLabel")}
                  >
                    <Input
                      id="auto-search-interval"
                      type="number"
                      min={1}
                      max={999}
                      inputMode="numeric"
                      value={intervalValue}
                      disabled={disabled}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const v = Math.max(
                          1,
                          parseInt(e.target.value, 10) || 1,
                        );
                        onChange({
                          autoSearchIntervalMinutes: displayToMinutes(
                            v,
                            intervalUnit,
                          ),
                        });
                      }}
                    />
                  </FormField>
                </div>
                <Select
                  value={intervalUnit}
                  onValueChange={(u) => {
                    if (isIntervalUnit(u))
                      onChange({
                        autoSearchIntervalMinutes: displayToMinutes(
                          intervalValue,
                          u,
                        ),
                      });
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue>
                      {t(`intervalUnit.${intervalUnit}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.key} value={u.key}>
                        {t(`intervalUnit.${u.key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="cron" className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {CRON_PRESETS.map(({ labelKey, expression }) => (
                  <button
                    key={labelKey}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({ autoSearchCronExpression: expression })
                    }
                    className="border-input hover:bg-accent rounded-md border px-2 py-0.5 text-xs disabled:pointer-events-none disabled:opacity-50"
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <FormField
                  id="auto-search-cron"
                  label={t("cronLabel")}
                  error={cronError ? t("cronInvalid") : undefined}
                >
                  <Input
                    id="auto-search-cron"
                    value={value.autoSearchCronExpression}
                    placeholder={t("cronPlaceholder")}
                    maxLength={80}
                    disabled={disabled}
                    onChange={(e) => {
                      const sanitized = e.target.value.replace(
                        /[^0-9A-Za-z*/?\-,#@\s]/g,
                        "",
                      );
                      const formatted = autoFormatCron(
                        sanitized,
                        prevCronRef.current,
                      );
                      prevCronRef.current = formatted;
                      onChange({ autoSearchCronExpression: formatted });
                    }}
                  />
                </FormField>
                {!cronError && cronPreview.data && (
                  <p className="text-muted-foreground text-xs">
                    {t("cronNextPreview", {
                      next: cronPreview.data.next
                        .map(formatCronTime)
                        .join(" · "),
                    })}
                  </p>
                )}
                <p className="text-muted-foreground text-xs">
                  {t("cronHint")}{" "}
                  <a
                    href="https://crontab.guru"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    crontab.guru
                  </a>
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <FormField
            id="auto-search-batch"
            label={t("batchLimitLabel")}
            description={
              value.autoSearchBatchLimit === 0
                ? t("batchLimitHelperZero")
                : t("batchLimitHelper", { count: value.autoSearchBatchLimit })
            }
          >
            <Input
              id="auto-search-batch"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={value.autoSearchBatchLimit}
              disabled={disabled}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = Math.max(
                  0,
                  Math.min(100, parseInt(e.target.value, 10) || 0),
                );
                onChange({ autoSearchBatchLimit: v });
              }}
            />
          </FormField>

          <div className="flex items-start gap-3">
            <Switch
              id="auto-search-monitored"
              checked={value.autoSearchMonitoredOnly}
              onCheckedChange={(checked) =>
                onChange({ autoSearchMonitoredOnly: checked })
              }
              disabled={disabled}
            />
            <div className="space-y-0.5">
              <Label htmlFor="auto-search-monitored" className="cursor-pointer">
                {t("monitoredOnlyLabel")}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t("monitoredOnlyHelper")}
              </p>
            </div>
          </div>

          <FormField
            id="auto-search-scope"
            label={t("scopeLabel")}
            description={scopeDesc[value.autoSearchScope]}
          >
            <Select
              value={value.autoSearchScope}
              onValueChange={(v) => {
                if (isAutoSearchScope(v)) onChange({ autoSearchScope: v });
              }}
              disabled={disabled}
            >
              <SelectTrigger id="auto-search-scope">
                <SelectValue>{scopeLabel[value.autoSearchScope]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flagged">{t("scopeFlagged")}</SelectItem>
                <SelectItem value="upgrade">{t("scopeUpgrade")}</SelectItem>
                <SelectItem value="missing">{t("scopeMissing")}</SelectItem>
                <SelectItem value="all">{t("scopeAll")}</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="auto-search-pick-strategy"
            label={t("pickStrategyLabel")}
            description={pickDesc[strategy]}
          >
            <Select
              value={strategy}
              onValueChange={(v) => {
                if (isPickStrategy(v)) onChange({ autoSearchPickStrategy: v });
              }}
              disabled={disabled}
            >
              <SelectTrigger id="auto-search-pick-strategy">
                <SelectValue>{pickLabel[strategy]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="balanced">
                  {t("pickStrategyBalanced")}
                </SelectItem>
                <SelectItem value="random">
                  {t("pickStrategyRandom")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            id="auto-search-cooldown"
            label={t("cooldownLabel")}
            description={
              value.autoSearchCooldownHours === 0
                ? t("cooldownHelperOff")
                : t("cooldownHelper", { n: value.autoSearchCooldownHours })
            }
          >
            <Input
              id="auto-search-cooldown"
              type="number"
              min={0}
              max={8760}
              inputMode="numeric"
              value={value.autoSearchCooldownHours}
              disabled={disabled}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = Math.max(
                  0,
                  Math.min(8760, parseInt(e.target.value, 10) || 0),
                );
                onChange({ autoSearchCooldownHours: v });
              }}
            />
          </FormField>

          <FormField
            id="auto-search-scoring-mode"
            label={t("scoringModeLabel")}
            description={scoringModeDesc[value.autoSearchScoringMode]}
          >
            <Select
              value={value.autoSearchScoringMode}
              onValueChange={(v) => {
                if (isScoringMode(v)) onChange({ autoSearchScoringMode: v });
              }}
              disabled={disabled}
            >
              <SelectTrigger id="auto-search-scoring-mode">
                <SelectValue>
                  {scoringModeLabel[value.autoSearchScoringMode]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max">
                <SelectItem value="inherit">
                  {t("scoringModeInherit")}
                </SelectItem>
                <SelectItem value="profile">
                  {t("scoringModeProfile")}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <p className="text-muted-foreground text-xs">{t("helperText")}</p>
        </>
      )}
    </div>
  );
}
