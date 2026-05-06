"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Film,
  Tv2,
  LayoutDashboard,
  History,
  Settings,
  EyeOff,
  AlertCircle,
  LogOut,
  Hourglass,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { useMe, useLogout } from "@/client/hooks/data/useMe";
import { ARR_LIBRARY_ROUTE } from "@/shared/arr-type";

interface NavLink {
  href: string;
  key:
    | "dashboard"
    | "movies"
    | "shows"
    | "ignored"
    | "queue"
    | "history"
    | "logs"
    | "settings";
  icon: LucideIcon;
}

const links: NavLink[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: ARR_LIBRARY_ROUTE.radarr, key: "movies", icon: Film },
  { href: ARR_LIBRARY_ROUTE.sonarr, key: "shows", icon: Tv2 },
  { href: "/ignored", key: "ignored", icon: EyeOff },
  { href: "/queue", key: "queue", icon: Hourglass },
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
              "focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {t(key)}
          </Link>
        ))}
      </nav>
      <div className="border-border mt-auto border-t px-3 pt-4">
        {me && (
          <p
            className="text-muted-foreground mb-2 truncate text-xs"
            title={me.username}
          >
            {me.username}
          </p>
        )}
        {me?.source === "session" && (
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-2 rounded-md text-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <LogOut className="size-3.5" />
            {tAuth("logout")}
          </button>
        )}
      </div>
    </>
  );
}
