"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
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
import { ARR_UI } from "@/client/lib/arr-ui";
import { ARR_LIBRARY_ROUTE, ALL_ARR_TYPES } from "@/shared/arr-meta";

// Per-arr nav label keys come from ARR_UI (one source for the icon +
// i18n key per arr). Adding Lidarr / Whisparr drops a row in arr-ui.ts
// and this union widens automatically.
type ArrNavKey = (typeof ARR_UI)[keyof typeof ARR_UI]["navLabelKey"];

interface NavLink {
  href: string;
  key:
    | "dashboard"
    | ArrNavKey
    | "ignored"
    | "queue"
    | "history"
    | "logs"
    | "settings";
  icon: LucideIcon;
}

const links: NavLink[] = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  ...ALL_ARR_TYPES.map(
    (type): NavLink => ({
      href: ARR_LIBRARY_ROUTE[type],
      key: ARR_UI[type].navLabelKey,
      icon: ARR_UI[type].Icon,
    }),
  ),
  { href: "/ignored", key: "ignored", icon: EyeOff },
  { href: "/queue", key: "queue", icon: Hourglass },
  { href: "/history", key: "history", icon: History },
  { href: "/logs", key: "logs", icon: AlertCircle },
  { href: "/settings", key: "settings", icon: Settings },
];

interface Props {
  onNavigate?: () => void;
  // Hide nav links whose `key` is in this set. Used by the mobile More
  // drawer to skip routes already represented in the bottom tab bar.
  excludeKeys?: ReadonlySet<NavLink["key"]>;
}

export function NavContent({ onNavigate, excludeKeys }: Props) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const { data: me } = useMe();
  const logout = useLogout();
  const visibleLinks = excludeKeys
    ? links.filter((l) => !excludeKeys.has(l.key))
    : links;
  return (
    <>
      <nav className="flex flex-col gap-1">
        {visibleLinks.map(({ href, key, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring focus-visible:ring-offset-background flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {t(key)}
            </Link>
          );
        })}
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
