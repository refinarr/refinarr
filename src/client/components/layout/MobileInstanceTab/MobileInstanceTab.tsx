"use client";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { InstanceMenuItem } from "@/client/components/common/InstanceMenuItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/client/components/ui/dropdown-menu";
import { useInstances } from "@/client/hooks/data/useInstances";
import { cn } from "@/client/lib/utils";
import type { ArrType } from "@/shared/types/models";

interface Props {
  arrType: ArrType;
  href: string;
  label: string;
  icon: LucideIcon;
}

// Route tab that doubles as an instance picker for /movies + /shows.
// Tap opens a dropdown of instances of the relevant arr-type. After
// selection, navigate to the route with `?instanceId=<id>`. With 0-1
// instances, the tab is a plain Link — no picker UI shown for cases
// that have nothing to pick.
//
// The outer wrapper renders a Suspense boundary around the body so
// pages that render AppShell without their own Suspense (notably
// /logs, where Next 16 fails the build with one above us) don't
// regress on `useSearchParams`.
export function MobileInstanceTab(props: Props) {
  return (
    <Suspense fallback={<MobileInstanceTabFallback {...props} />}>
      <MobileInstanceTabImpl {...props} />
    </Suspense>
  );
}

// Suspense fallback — renders a plain Link to the route without any
// query params. Avoids a flicker between fallback and real content
// since on most navigations the searchParams resolve synchronously.
function MobileInstanceTabFallback({ href, label, icon: Icon }: Props) {
  return (
    <Link
      href={href}
      className="text-muted-foreground hover:text-foreground flex flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors"
    >
      <Icon className="size-5" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function MobileInstanceTabImpl({ arrType, href, label, icon: Icon }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: instances } = useInstances();

  const typed = (instances ?? []).filter(
    (i) => i.type === arrType && i.enabled,
  );
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const activeIdParam = Number(searchParams.get("instanceId") ?? 0);

  const tabClass = cn(
    "flex flex-1 flex-col items-center justify-center gap-1 px-2 text-xs font-medium transition-colors",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  );

  // 0 or 1 instances: plain Link. With 1 instance, encode its id in
  // the href so a tap from /dashboard lands on /movies?instanceId=N
  // (matches how MediaListShell expects URL state).
  if (typed.length <= 1) {
    const targetHref =
      typed.length === 1 ? `${href}?instanceId=${typed[0].id}` : href;
    return (
      <Link
        href={targetHref}
        aria-current={active ? "page" : undefined}
        className={tabClass}
      >
        <Icon className="size-5" />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  // 2+ instances: tap opens a dropdown of instances. Preserve query
  // params only when navigating WITHIN the current route — switching
  // from /shows?mediaId=123 to /movies must drop mediaId, otherwise
  // /movies treats 123 as a movie id and the page lands empty.
  const select = (id: number) => {
    const params = active
      ? new URLSearchParams(searchParams.toString())
      : new URLSearchParams();
    params.set("instanceId", String(id));
    router.push(`${href}?${params.toString()}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger type="button" className={tabClass}>
        <span className="relative">
          <Icon className="size-5" />
          <span
            className="bg-primary text-primary-foreground absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] leading-none font-semibold"
            aria-hidden
          >
            {typed.length}
          </span>
        </span>
        <span className="truncate">{label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        side="top"
        sideOffset={8}
        className="flex max-w-[calc(100vw-2rem)] min-w-64 flex-col gap-1 p-1.5"
      >
        {typed.map((inst) => (
          <InstanceMenuItem
            key={inst.id}
            instance={inst}
            active={inst.id === activeIdParam && active}
            onSelect={select}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
