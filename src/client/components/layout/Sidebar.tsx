"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Film, Tv2, LayoutDashboard, History, Settings, EyeOff, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { HealthDot } from "./HealthDot";

interface NavLink {
  href: string;
  key: "dashboard" | "movies" | "shows" | "ignored" | "history" | "logs" | "settings";
  icon: LucideIcon;
}

const links: NavLink[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/movies", key: "movies", icon: Film },
  { href: "/shows", key: "shows", icon: Tv2 },
  { href: "/ignored", key: "ignored", icon: EyeOff },
  { href: "/history", key: "history", icon: History },
  { href: "/logs", key: "logs", icon: AlertCircle },
  { href: "/settings", key: "settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tApp = useTranslations();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-3">
        <span className="text-lg font-bold tracking-tight">{tApp("appName")}</span>
        <HealthDot />
      </div>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t(key)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
