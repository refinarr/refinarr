"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useServerEvents } from "@/client/hooks/useServerEvents";
import { initializeTheme } from "@/client/lib/theme";

// Mounted inside QueryClientProvider so the SSE-driven invalidations land
// on the same QueryClient as the rest of the tree. Renders nothing — its
// only job is to wire useServerEvents into the React lifecycle.
function ServerEventsMount() {
  useServerEvents();
  return null;
}

// Applies the persisted theme's full CSS-var payload after hydration.
// The anti-FOUC inline script in `app/layout.tsx` already set the
// data-theme attribute before paint; this fills in everything else.
function ThemeMount() {
  useEffect(() => {
    initializeTheme();
  }, []);
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000 } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeMount />
      <ServerEventsMount />
      {children}
    </QueryClientProvider>
  );
}
