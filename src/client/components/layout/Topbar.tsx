"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/client/components/ui/sheet";
import { HealthDot } from "./HealthDot";
import { Logo } from "./Logo";
import { NavContent } from "./NavContent";

export function Topbar() {
  const [open, setOpen] = useState(false);
  const tNav = useTranslations("nav");
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card px-3 h-14">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={tNav("openMenu")}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <Logo size="md" />
      <span className="ml-auto">
        <HealthDot />
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex flex-col gap-0 px-3 py-4">
          <SheetTitle className="mb-6 px-3">
            <Logo size="lg" />
          </SheetTitle>
          <SheetDescription className="sr-only">{tNav("menu")}</SheetDescription>
          <NavContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
