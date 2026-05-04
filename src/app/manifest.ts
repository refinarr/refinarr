import type { MetadataRoute } from "next";
import { SURFACE_DARK } from "@/shared/theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Refinarr",
    short_name: "Refinarr",
    description: "Custom Format upgrade dashboard for Radarr & Sonarr",
    start_url: "/",
    display: "standalone",
    background_color: SURFACE_DARK,
    theme_color: SURFACE_DARK,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
