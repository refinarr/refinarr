"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Film, Tv2, LayoutDashboard, History, Settings, EyeOff, AlertCircle, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { useMe, useLogout } from "@/client/hooks/data/useMe";

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

interface Props {
  onNavigate?: () => void;
}

export function NavContent({ onNavigate }: Props) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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
      <div className="mt-auto px-3 pt-4 border-t border-border">
        {me && (
          <p className="text-xs text-muted-foreground truncate mb-2" title={me.username}>
            {me.username}
          </p>
        )}
        {me?.source === "session" && (
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <LogOut className="h-3.5 w-3.5" />
            {tAuth("logout")}
          </button>
        )}
      </div>
    </>
  );
}
