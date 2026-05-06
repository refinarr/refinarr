import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Toaster } from "@/client/components/ui/sonner";
import { DEFAULT_BRAND_ID, DEFAULT_MODE } from "@/client/themes";
import { SURFACE_DARK, SURFACE_LIGHT } from "@/shared/theme";
import Providers from "./providers";
import "./globals.css";

// Sets data-theme + .dark class before first paint so globals.css picks
// the right background/foreground. The full CSS-var payload is applied
// at hydration by initializeTheme() inside Providers. Also performs a
// one-time migration from the old flat `rfn-theme` key.
const FOUC_SCRIPT = `(function () {
  try {
    var legacy = localStorage.getItem("rfn-theme");
    var brand = localStorage.getItem("rfn-brand");
    var mode = localStorage.getItem("rfn-mode");
    if (legacy && (!brand || !mode)) {
      if (legacy === "light") { brand = "amber"; mode = "light"; }
      else if (legacy === "dark-teal") { brand = "teal"; mode = "dark"; }
      else { brand = "amber"; mode = "dark"; }
      localStorage.setItem("rfn-brand", brand);
      localStorage.setItem("rfn-mode", mode);
      localStorage.removeItem("rfn-theme");
    }
    brand = brand || "${DEFAULT_BRAND_ID}";
    mode = mode || "${DEFAULT_MODE}";
    var dark = mode === "dark" || (mode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", brand);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Refinarr",
  description: "Custom Format upgrade dashboard for Radarr & Sonarr",
  applicationName: "Refinarr",
  appleWebApp: {
    capable: true,
    title: "Refinarr",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: SURFACE_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: SURFACE_DARK },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FOUC_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
          <Toaster richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
