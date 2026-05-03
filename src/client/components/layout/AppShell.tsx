"use client";
import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { KeyboardHelpDialog } from "./KeyboardHelpDialog";

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const tA11y = useTranslations("a11y");
  return (
    <div className="flex min-h-screen flex-col md:h-screen md:flex-row md:overflow-hidden">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {tA11y("skipToContent")}
      </a>
      <Topbar />
      <Sidebar />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 p-4 pb-20 focus:outline-none md:overflow-y-auto md:p-6 md:pb-6"
      >
        {children}
      </main>
      <CommandPalette />
      <KeyboardHelpDialog />
    </div>
  );
}
