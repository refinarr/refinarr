import { amber } from "./amber";
import { teal } from "./teal";
import type { Brand, BrandId, Mode } from "./types";

export type { Brand, BrandId, Mode, Surface } from "./types";

export const DEFAULT_BRAND = amber;
export const BRANDS: readonly Brand[] = [DEFAULT_BRAND, teal];
export const DEFAULT_BRAND_ID: BrandId = DEFAULT_BRAND.id;
export const DEFAULT_MODE: Mode = "system";

export function getBrandById(id: string | null | undefined): Brand | undefined {
  if (!id) return undefined;
  return BRANDS.find((b) => b.id === id);
}

export function getDefaultBrand(): Brand {
  return DEFAULT_BRAND;
}
