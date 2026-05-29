// Shared helpers for log rendering — parsing context JSON and
// highlighting the title inside a message line. Used by LogRow and
// LogDetailPanel so they can't drift apart on either the parse shape
// or the title-highlight colour.

export interface LogContext {
  action: string | null;
  title: string | null;
  parsedObject: Record<string, unknown> | null;
}

export function parseLogContext(raw: string | null): LogContext {
  if (!raw) return { action: null, title: null, parsedObject: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { action: null, title: null, parsedObject: null };
    }
    const obj = parsed as Record<string, unknown>;
    return {
      action: typeof obj.action === "string" ? obj.action : null,
      title: typeof obj.title === "string" ? obj.title : null,
      parsedObject: obj,
    };
  } catch {
    return { action: null, title: null, parsedObject: null };
  }
}

// Splits the message around the first occurrence of `title` so the
// title can render in the brand colour. Falls back to plain text when
// the title is absent (older entries that pre-date the message format).
export function renderMessageWithTitle(message: string, title: string | null) {
  if (!title) return <>{message}</>;
  const idx = message.indexOf(title);
  if (idx < 0) return <>{message}</>;
  return (
    <>
      {message.slice(0, idx)}
      <span className="text-brand">{title}</span>
      {message.slice(idx + title.length)}
    </>
  );
}
