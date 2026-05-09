import type { useTranslations } from "next-intl";

type T = ReturnType<typeof useTranslations<"time">>;

function toMs(date: Date | string | number): number {
  if (typeof date === "number") return date;
  if (typeof date === "string") return new Date(date).getTime();
  return date.getTime();
}

/**
 * Compact past-relative formatter — "12s ago", "3m ago", "2h ago", "5d ago".
 * Coarse-grained intentionally; UI needs enough granularity to distinguish
 * "just now" from "earlier today" from "stale". For an exact timestamp the
 * user can read the tooltip or open the detail dialog.
 */
export function formatRelative(date: Date | string | number, t: T): string {
  const ms = toMs(date);
  if (!Number.isFinite(ms)) return t("unknown");
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return t("secondsAgo", { n: seconds });
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return t("minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { n: days });
}

export function msUntil(isoString: string): number {
  const t = new Date(isoString).getTime();
  return Number.isFinite(t) ? Math.max(0, t - Date.now()) : 0;
}

/**
 * Forward-looking variant — "in 12m", "in 2h". Returns "now" for past or
 * zero offsets. Used by the queue ETA tooltip.
 */
export function formatEta(ms: number, t: T): string {
  if (ms <= 0) return t("etaNow");
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin === 0) return t("etaLessThanMinute");
  if (totalMin < 60) return t("etaMinutes", { n: totalMin });
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0
    ? t("etaHours", { n: hours })
    : t("etaHoursMinutes", { n: hours, m: mins });
}
