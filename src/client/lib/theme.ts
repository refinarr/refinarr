import {
  BRANDS,
  DEFAULT_BRAND_ID,
  DEFAULT_MODE,
  getBrandById,
  getDefaultBrand,
  type Brand,
  type Mode,
  type Surface,
} from "@/client/themes";

const BRAND_KEY = "rfn-brand";
const MODE_KEY = "rfn-mode";
const LEGACY_THEME_KEY = "rfn-theme";
const THEME_CHANGE_EVENT = "rfn:themechange";
const TRANSITION_CLASS = "theme-transition";
const TRANSITION_MS = 200;

export interface ThemeChangeDetail {
  brand: Brand;
  mode: Mode;
  surface: Surface;
}

function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable — fall through silently
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

// One-time migration from the flat-theme model. Runs every time we
// resolve state from storage; only takes effect when a legacy `rfn-theme`
// is present and at least one of the new keys is missing.
function migrateLegacy(): void {
  const legacy = safeRead(LEGACY_THEME_KEY);
  if (!legacy) return;
  const brand = safeRead(BRAND_KEY);
  const mode = safeRead(MODE_KEY);
  if (brand && mode) {
    safeRemove(LEGACY_THEME_KEY);
    return;
  }
  let nextBrand = "amber";
  let nextMode: Mode = "dark";
  if (legacy === "light") {
    nextBrand = "amber";
    nextMode = "light";
  } else if (legacy === "dark-teal") {
    nextBrand = "teal";
    nextMode = "dark";
  }
  safeWrite(BRAND_KEY, nextBrand);
  safeWrite(MODE_KEY, nextMode);
  safeRemove(LEGACY_THEME_KEY);
}

function readMode(): Mode {
  const raw = safeRead(MODE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return DEFAULT_MODE;
}

export function resolveSurface(mode: Mode): Surface {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function getCurrentBrand(): Brand {
  migrateLegacy();
  return getBrandById(safeRead(BRAND_KEY)) ?? getDefaultBrand();
}

export function getCurrentMode(): Mode {
  migrateLegacy();
  return readMode();
}

export function applyBrandMode(brand: Brand, mode: Mode): void {
  const root = document.documentElement;
  const surface = resolveSurface(mode);
  const vars = brand.cssVars[surface];

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
  root.setAttribute("data-theme", brand.id);
  root.classList.toggle("dark", surface === "dark");
}

function dispatchChange(brand: Brand, mode: Mode): void {
  const surface = resolveSurface(mode);
  window.dispatchEvent(
    new CustomEvent<ThemeChangeDetail>(THEME_CHANGE_EVENT, {
      detail: { brand, mode, surface },
    }),
  );
}

function applyWithTransition(brand: Brand, mode: Mode): void {
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  applyBrandMode(brand, mode);
  window.setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
  }, TRANSITION_MS);
}

export function setBrand(id: string): void {
  const brand = getBrandById(id) ?? getDefaultBrand();
  const mode = getCurrentMode();
  safeWrite(BRAND_KEY, brand.id);
  applyWithTransition(brand, mode);
  dispatchChange(brand, mode);
}

export function setMode(mode: Mode): void {
  const brand = getCurrentBrand();
  safeWrite(MODE_KEY, mode);
  applyWithTransition(brand, mode);
  dispatchChange(brand, mode);
}

let systemMqlBound = false;
function bindSystemListener(): void {
  if (systemMqlBound) return;
  if (typeof window === "undefined" || !window.matchMedia) return;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getCurrentMode() === "system") {
      const brand = getCurrentBrand();
      applyBrandMode(brand, "system");
      dispatchChange(brand, "system");
    }
  };
  mql.addEventListener("change", handler);
  systemMqlBound = true;
}

export function initializeTheme(): void {
  migrateLegacy();
  applyBrandMode(getCurrentBrand(), getCurrentMode());
  bindSystemListener();
}

export const THEME_EVENT = THEME_CHANGE_EVENT;
export const THEME_BRAND_KEY = BRAND_KEY;
export const THEME_MODE_KEY = MODE_KEY;
export const THEME_LEGACY_KEY = LEGACY_THEME_KEY;
export { BRANDS, DEFAULT_BRAND_ID, DEFAULT_MODE };
export type { Brand, Mode, Surface };
