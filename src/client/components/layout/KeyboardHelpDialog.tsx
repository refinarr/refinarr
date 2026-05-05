"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";

const SHORTCUTS = [
  { keys: ["⌘", "K"], descKey: "openPalette" as const },
  { keys: ["Ctrl", "K"], descKey: "openPaletteWin" as const },
  { keys: ["?"], descKey: "showHelp" as const },
  { keys: ["Esc"], descKey: "closeDialog" as const },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

export function KeyboardHelpDialog() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("keyboardHelp");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "?") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ul className="mt-2 space-y-2">
          {SHORTCUTS.map((s) => (
            <li
              key={s.keys.join("-")}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-muted-foreground">
                {t(`shortcuts.${s.descKey}`)}
              </span>
              <span className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
