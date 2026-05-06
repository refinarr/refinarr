"use client";
import { useSyncExternalStore } from "react";
import {
  BRANDS,
  DEFAULT_BRAND,
  DEFAULT_MODE,
  THEME_EVENT,
  getCurrentBrand,
  getCurrentMode,
  resolveSurface,
  setBrand,
  setMode,
  type Brand,
  type BrandId,
  type Mode,
  type Surface,
} from "@/client/lib/theme";

interface UseThemeResult {
  brand: Brand;
  brands: readonly Brand[];
  mode: Mode;
  surface: Surface;
  setBrand: (id: BrandId) => void;
  setMode: (mode: Mode) => void;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

const SSR_BRAND = (): Brand => DEFAULT_BRAND;
const SSR_MODE = (): Mode => DEFAULT_MODE;
const SSR_SURFACE = (): Surface => "dark";

export function useTheme(): UseThemeResult {
  // Three independent scalar subscriptions so each useSyncExternalStore
  // returns a stable reference across renders. Returning a combined
  // {brand, mode, surface} object would create a fresh ref every call
  // and trigger the "Maximum update depth exceeded" loop.
  const brand = useSyncExternalStore(subscribe, getCurrentBrand, SSR_BRAND);
  const mode = useSyncExternalStore(subscribe, getCurrentMode, SSR_MODE);
  const surface = useSyncExternalStore(
    subscribe,
    () => resolveSurface(getCurrentMode()),
    SSR_SURFACE,
  );

  return {
    brand,
    brands: BRANDS,
    mode,
    surface,
    setBrand,
    setMode,
  };
}
