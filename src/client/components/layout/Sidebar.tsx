"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Film, Tv2, LayoutDashboard, History, Settings } from "lucide-react";
import { cn } from "@/client/lib/utils";
import { HealthDot } from "./HealthDot";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/movies", label: "Movies", icon: Film },
  { href: "/shows", label: "Shows", icon: Tv2 },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card px-3 py-4">
      <div className="mb-6 flex items-center gap-2 px-3">
        <span className="text-lg font-bold tracking-tight">{"Remedarr"}</span>
        <HealthDot />
      </div>
      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
