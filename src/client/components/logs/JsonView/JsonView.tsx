"use client";
import { useCallback, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/client/lib/utils";
import type { JsonPath, JsonViewProps } from "./types";

type JsonNode =
  | { kind: "null" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "array"; value: unknown[] }
  | { kind: "object"; value: Record<string, unknown> }
  | { kind: "other"; value: unknown };

function classify(value: unknown): JsonNode {
  if (value === null) return { kind: "null" };
  if (typeof value === "boolean") return { kind: "boolean", value };
  if (typeof value === "number") return { kind: "number", value };
  if (typeof value === "string") return { kind: "string", value };
  if (Array.isArray(value)) return { kind: "array", value };
  if (typeof value === "object")
    return { kind: "object", value: value as Record<string, unknown> };
  return { kind: "other", value };
}

interface NodeProps {
  path: JsonPath;
  node: JsonNode;
  depth: number;
  expanded: Set<JsonPath>;
  toggle: (path: JsonPath) => void;
  initiallyExpandedDepth: number;
  keyLabel?: string;
}

interface PrimitiveValueProps {
  node: JsonNode;
}

interface JsonKeyProps {
  name: string;
}

interface CollapseToggleProps {
  open: boolean;
  onClick: () => void;
}

function isOpen(
  path: JsonPath,
  depth: number,
  expanded: Set<JsonPath>,
  initiallyExpandedDepth: number,
): boolean {
  if (expanded.has(path)) return true;
  if (expanded.has(`!${path}`)) return false;
  return depth < initiallyExpandedDepth;
}

function PrimitiveValue({ node }: PrimitiveValueProps) {
  switch (node.kind) {
    case "null":
      return <span className="text-muted-foreground italic">null</span>;
    case "boolean":
      return <span className="text-violet-400">{String(node.value)}</span>;
    case "number":
      return <span className="text-amber-400">{node.value}</span>;
    case "string":
      return (
        <span className="break-all text-emerald-400">
          &quot;{node.value}&quot;
        </span>
      );
    case "other":
      return (
        <span className="text-muted-foreground">{String(node.value)}</span>
      );
    default:
      return null;
  }
}

function JsonKey({ name }: JsonKeyProps) {
  return <span className="text-sky-400">&quot;{name}&quot;</span>;
}

function CollapseToggle({ open, onClick }: CollapseToggleProps) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground inline-flex h-6 w-4 shrink-0 items-center justify-center rounded-sm transition-colors"
      onClick={onClick}
      aria-label={open ? "Collapse" : "Expand"}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function JsonNodeView(props: NodeProps) {
  const {
    path,
    node,
    depth,
    expanded,
    toggle,
    initiallyExpandedDepth,
    keyLabel,
  } = props;

  if (node.kind === "array" || node.kind === "object") {
    const open = isOpen(path, depth, expanded, initiallyExpandedDepth);
    const entries =
      node.kind === "array"
        ? node.value.map((v, i): [string, unknown] => [String(i), v])
        : Object.entries(node.value);
    const isEmpty = entries.length === 0;
    const openBracket = node.kind === "array" ? "[" : "{";
    const closeBracket = node.kind === "array" ? "]" : "}";

    return (
      <div className="leading-6">
        <div className="flex items-center gap-1">
          {!isEmpty && (
            <CollapseToggle open={open} onClick={() => toggle(path)} />
          )}
          {isEmpty && <span className="inline-block h-6 w-4 shrink-0" />}
          <span className="leading-6">
            {keyLabel !== undefined && (
              <>
                <JsonKey name={keyLabel} />
                <span className="text-muted-foreground">: </span>
              </>
            )}
            <span className="text-muted-foreground">{openBracket}</span>
            {(!open || isEmpty) && (
              <>
                {!isEmpty && (
                  <span className="text-muted-foreground/70 mx-1 text-xs">
                    {entries.length}{" "}
                    {node.kind === "array" ? "items" : "fields"}
                  </span>
                )}
                <span className="text-muted-foreground">{closeBracket}</span>
              </>
            )}
          </span>
        </div>
        {open && !isEmpty && (
          <div className="border-border/60 ml-2 border-l pl-3">
            {entries.map(([k, v]) => (
              <JsonNodeView
                key={k}
                path={`${path}.${k}`}
                node={classify(v)}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                initiallyExpandedDepth={initiallyExpandedDepth}
                keyLabel={node.kind === "object" ? k : undefined}
              />
            ))}
            <div>
              <span className="text-muted-foreground">{closeBracket}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 leading-6">
      <span className="inline-block h-6 w-4 shrink-0" />
      <span>
        {keyLabel !== undefined && (
          <>
            <JsonKey name={keyLabel} />
            <span className="text-muted-foreground">: </span>
          </>
        )}
        <PrimitiveValue node={node} />
      </span>
    </div>
  );
}

export function JsonView({ value, initiallyExpandedDepth = 2 }: JsonViewProps) {
  // Collapse state is a single `Set<JsonPath>`. We store explicit
  // overrides only — paths in the set are flipped relative to the
  // depth-based default. This keeps a per-toggle re-render to one
  // state update at the root and avoids per-node state.
  const [expanded, setExpanded] = useState<Set<JsonPath>>(() => new Set());

  const toggle = useCallback(
    (path: JsonPath) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        const openKey = path;
        const closeKey = `!${path}`;
        // Three states map to: forced-open / forced-closed / default.
        // Flip relative to whatever's currently visible.
        if (next.has(openKey)) {
          next.delete(openKey);
          next.add(closeKey);
        } else if (next.has(closeKey)) {
          next.delete(closeKey);
          next.add(openKey);
        } else {
          // No override yet — pick the override that inverts the depth default.
          const depth = path === "$" ? 0 : path.split(".").length - 1;
          if (depth < initiallyExpandedDepth) next.add(closeKey);
          else next.add(openKey);
        }
        return next;
      });
    },
    [initiallyExpandedDepth],
  );

  return (
    <div
      className={cn(
        "bg-muted/40 rounded-md border p-3 font-mono text-xs",
        "overflow-x-auto",
      )}
    >
      <JsonNodeView
        path="$"
        node={classify(value)}
        depth={0}
        expanded={expanded}
        toggle={toggle}
        initiallyExpandedDepth={initiallyExpandedDepth}
      />
    </div>
  );
}
