"use client";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/client/components/ui/button";
import { HealthDot } from "./HealthDot";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  onToggleSidebar: () => void;
}

export function TopHeader({ onToggleSidebar }: Props) {
  const tNav = useTranslations("nav");
  return (
    <header className="border-border bg-card sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleSidebar}
        aria-label={tNav("openMenu")}
      >
        <Menu className="size-5" />
      </Button>
      <Logo size="md" />
      <span className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <HealthDot />
      </span>
    </header>
  );
}
