export function formatContext(ctx: string | null): string | null {
  if (!ctx) return null;
  try {
    return JSON.stringify(JSON.parse(ctx), null, 2);
  } catch {
    return ctx;
  }
}

export function formatCronTime(isoString: string): string {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();

  const sameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (sameCalendarDay(d, now)) return `today ${time}`;
  if (sameCalendarDay(d, tomorrow)) return `tomorrow ${time}`;

  const diffDays = Math.round((d.getTime() - now.getTime()) / 86_400_000);
  if (diffDays > 0 && diffDays < 7)
    return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${time}`;

  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatRelative(date: Date | string | number): string {
  const ms = typeof date === "number" ? date : new Date(date).getTime();
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  const sec = 1000,
    min = 60 * sec,
    hr = 60 * min,
    day = 24 * hr;
  if (abs < min) return RTF.format(Math.round(diff / sec), "second");
  if (abs < hr) return RTF.format(Math.round(diff / min), "minute");
  if (abs < day) return RTF.format(Math.round(diff / hr), "hour");
  if (abs < 7 * day) return RTF.format(Math.round(diff / day), "day");
  return new Date(ms).toLocaleDateString();
}
