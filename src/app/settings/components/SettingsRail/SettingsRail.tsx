"use client";
import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/client/lib/utils";

export interface SettingsRailItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  // Absolute path the rail entry navigates to (e.g. "/settings/appearance").
  href: string;
}

interface Props {
  items: SettingsRailItem[];
  className?: string;
}

export function SettingsRail({ items, className }: Props) {
  const t = useTranslations("settings");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("navAriaLabel")}
      className={cn("flex w-56 shrink-0 flex-col gap-1 self-start", className)}
    >
      {items.map(({ id, label, icon: Icon, href }) => {
        // Match exact path OR any nested route under it, so future
        // sub-routes (e.g. /settings/instances/[id]) still highlight
        // the parent rail entry.
        const selected = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={id}
            href={href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
