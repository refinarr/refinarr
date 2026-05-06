import { amber } from "./amber";
import { teal } from "./teal";
import type { Brand, Mode } from "./types";

export type { Brand, BrandSwatch, Mode, Surface } from "./types";

export const BRANDS: Brand[] = [amber, teal];

export const DEFAULT_BRAND_ID = "amber";
export const DEFAULT_MODE: Mode = "system";

export function getBrandById(id: string | null | undefined): Brand | undefined {
  if (!id) return undefined;
  return BRANDS.find((b) => b.id === id);
}

export function getDefaultBrand(): Brand {
  return getBrandById(DEFAULT_BRAND_ID) ?? BRANDS[0];
}
