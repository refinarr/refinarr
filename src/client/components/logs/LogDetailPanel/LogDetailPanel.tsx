"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Hash,
  X,
  FileJson,
} from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { LogLevelBadge } from "@/client/components/logs/LogLevelBadge";
import { ActionBadge } from "@/client/components/logs/ActionBadge";
import { JsonView } from "@/client/components/logs/JsonView";
import {
  parseLogContext,
  renderMessageWithTitle,
} from "@/client/components/logs/log-utils";
import { formatContext } from "@/client/lib/format";
import { withToast } from "@/client/lib/with-toast";
import type { AppLogEntry } from "@/shared/types/models";
import { apiStatusClass, parseApiContext } from "./parseApiContext";

interface Props {
  entry: AppLogEntry | null;
  onClose?: () => void;
}

// Detail-panel-specific extras: pull errorMessage / stack / traceId
// out so they render in their own sections. Built on top of the shared
// parseLogContext so the parse shape can't drift from LogRow.
interface DetailContext {
  raw: string | null;
  parsedObject: Record<string, unknown> | null;
  errorMessage: string | null;
  stack: string | null;
  traceId: string | null;
}

function parseDetailContext(raw: string | null): DetailContext {
  const base = parseLogContext(raw);
  if (!base.parsedObject) {
    return {
      raw,
      parsedObject: null,
      errorMessage: null,
      stack: null,
      traceId: null,
    };
  }
  const { errorMessage, stack, traceId } = base.parsedObject;
  return {
    raw,
    parsedObject: base.parsedObject,
    errorMessage: typeof errorMessage === "string" ? errorMessage : null,
    stack: typeof stack === "string" ? stack : null,
    traceId: typeof traceId === "string" ? traceId : null,
  };
}

function renderContextBody(ctx: DetailContext, emptyLabel: string) {
  if (ctx.raw === null) {
    return <div className="text-muted-foreground text-sm">{emptyLabel}</div>;
  }
  if (ctx.parsedObject !== null) {
    return <JsonView value={ctx.parsedObject} />;
  }
  return (
    <pre className="bg-muted/40 max-h-72 overflow-y-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
      {ctx.raw}
    </pre>
  );
}

export function LogDetailPanel({ entry, onClose }: Props) {
  const t = useTranslations("logs");
  const tDetail = useTranslations("logs.detail");
  const tToast = useTranslations("toast.logs");
  const [stackOpen, setStackOpen] = useState(false);

  const ctx = useMemo(
    () => parseDetailContext(entry?.context ?? null),
    [entry],
  );
  const apiCtx = useMemo(
    () => parseApiContext(entry?.context ?? null),
    [entry],
  );

  const copyMutation = useMutation({
    mutationFn: (text: string) => navigator.clipboard.writeText(text),
  });
  const copy = withToast(copyMutation, {
    success: tToast("copied"),
    error: tToast("copyFailed"),
  });

  if (!entry) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        {t("selectPrompt")}
      </div>
    );
  }

  const fullJson = formatContext(entry.context) ?? "";
  const recordJson = JSON.stringify(entry, null, 2);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <LogLevelBadge level={entry.level} />
            {entry.source && (
              <Badge variant="outline" className="text-[10px]">
                {entry.source}
              </Badge>
            )}
            {typeof ctx.parsedObject?.action === "string" && (
              <ActionBadge action={ctx.parsedObject.action} />
            )}
            {entry.instanceId !== null && (
              <Badge variant="outline" className="text-[10px]">
                #{entry.instanceId}
              </Badge>
            )}
          </div>
          <div className="text-foreground text-sm font-medium wrap-break-word">
            {renderMessageWithTitle(
              entry.message,
              typeof ctx.parsedObject?.title === "string"
                ? ctx.parsedObject.title
                : null,
            )}
          </div>
          <div className="text-muted-foreground text-xs tabular-nums">
            {tDetail("timestamp")}: {new Date(entry.createdAt).toLocaleString()}
          </div>
          {apiCtx?.method && apiCtx.path && (
            <div className="font-mono text-xs">
              <span className="text-muted-foreground">{apiCtx.method}</span>{" "}
              <span>{apiCtx.path}</span>
              {apiCtx.status !== undefined && (
                <span className={`ml-2 ${apiStatusClass(apiCtx.status)}`}>
                  {apiCtx.status}
                </span>
              )}
            </div>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={tDetail("close")}
          >
            <X className="size-4" />
          </Button>
        )}
      </header>

      <div className="flex flex-wrap gap-2 border-b p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(recordJson)}
          disabled={copyMutation.isPending}
        >
          <Copy className="mr-1.5 size-3.5" />
          {tDetail("copyRecord")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!ctx.traceId || copyMutation.isPending}
          onClick={() => ctx.traceId && copy(ctx.traceId)}
        >
          <Hash className="mr-1.5 size-3.5" />
          {ctx.traceId ? tDetail("copyTraceId") : tDetail("noTraceId")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copy(fullJson || recordJson)}
          disabled={copyMutation.isPending}
        >
          <FileJson className="mr-1.5 size-3.5" />
          {tDetail("copyJson")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {ctx.errorMessage && (
          <section className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {tDetail("error")}
            </h3>
            <div className="border-critical/40 bg-critical/5 text-critical-foreground rounded-md border p-3">
              <div className="font-mono text-xs break-all">
                {ctx.errorMessage}
              </div>
              {ctx.stack && (
                <>
                  <button
                    type="button"
                    onClick={() => setStackOpen((v) => !v)}
                    className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs"
                  >
                    {stackOpen ? (
                      <ChevronDown className="size-3" />
                    ) : (
                      <ChevronRight className="size-3" />
                    )}
                    {stackOpen ? tDetail("hideStack") : tDetail("showStack")}
                  </button>
                  {stackOpen && (
                    <pre className="text-muted-foreground bg-neutral-soft mt-2 max-h-64 overflow-y-auto rounded-sm p-2 font-mono text-[11px] whitespace-pre-wrap">
                      {ctx.stack}
                    </pre>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {tDetail("context")}
          </h3>
          {renderContextBody(ctx, tDetail("noContext"))}
        </section>
      </div>
    </div>
  );
}
