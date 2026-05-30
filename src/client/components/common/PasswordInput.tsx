"use client";
import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/client/components/ui/input";
import { cn } from "@/client/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type">;

// Password field with a show/hide eye toggle (GAP-2). The 12-char minimum is a
// hard ask, so letting users reveal what they typed cuts retry friction. The
// toggle is tabIndex=-1 so keyboard flow goes straight to the submit button.
export function PasswordInput({ className, ...props }: Props) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={t(show ? "hidePassword" : "showPassword")}
        className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex items-center px-3"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
