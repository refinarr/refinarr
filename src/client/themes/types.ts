export type Surface = "light" | "dark";
export type Mode = "light" | "dark" | "system";
export type BrandId = "amber" | "teal";

export interface BrandSwatch {
  brand: string;
  surfaceLight: string;
  surfaceDark: string;
}

export interface Brand {
  id: BrandId;
  name: string;
  description: string;
  swatch: BrandSwatch;
  cssVars: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}
