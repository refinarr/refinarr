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
