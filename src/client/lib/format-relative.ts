/**
 * Tiny relative-time formatter — "12s ago", "3m ago", "2h ago", "5d ago".
 * Coarse-grained intentionally; UI only needs enough granularity to
 * distinguish "just now" from "earlier today" from "stale". For a real
 * timestamp the user can read the tooltip / dialog.
 */
function toMs(date: Date | string | number): number {
  if (typeof date === "number") return date;
  if (typeof date === "string") return new Date(date).getTime();
  return date.getTime();
}

export function formatRelative(date: Date | string | number): string {
  const ms = toMs(date);
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Forward-looking variant — "in 12m", "in 2h". Returns "now" for past
 * or zero offsets. Used by the queue ETA tooltip.
 */
export function formatEta(ms: number): string {
  if (ms <= 0) return "now";
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}
