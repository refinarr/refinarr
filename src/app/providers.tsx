"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";

export const APP_THEMES = ["light", "dark-orange", "dark-teal"] as const;
export type AppTheme = (typeof APP_THEMES)[number];
export const DEFAULT_THEME: AppTheme = "dark-orange";

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));

  return (
    <ThemeProvider
      attribute="data-theme"
      themes={[...APP_THEMES]}
      defaultTheme={DEFAULT_THEME}
      enableSystem={false}
      enableColorScheme={false}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
