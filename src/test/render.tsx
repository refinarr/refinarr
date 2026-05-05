import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import messages from "../../messages/en.json";

interface ProvidersProps {
  children: ReactNode;
}

function AllProviders({ children }: ProvidersProps) {
  // Fresh QueryClient per render so cached fetches don't bleed across
  // tests. retry: false keeps assertion timeouts predictable when a
  // mocked endpoint rejects.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from "@testing-library/react";
