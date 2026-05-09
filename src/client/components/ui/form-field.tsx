"use client";
import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Label } from "@/client/components/ui/label";

interface Props {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactElement;
}

export function FormField({ id, label, description, error, children }: Props) {
  const descId = description ? `${id}-description` : undefined;
  const errId = error ? `${id}-error` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  const enhanced = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": describedBy,
        ...(error ? { "aria-invalid": "true" } : {}),
      })
    : children;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {enhanced}
      {description && (
        <p id={descId} className="text-muted-foreground text-xs">
          {description}
        </p>
      )}
      {error && (
        <p id={errId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
