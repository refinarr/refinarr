export type Surface = "light" | "dark";
export type Mode = "light" | "dark" | "system";

export interface BrandSwatch {
  brand: string;
  surfaceLight: string;
  surfaceDark: string;
}

export interface Brand {
  id: string;
  name: string;
  description: string;
  swatch: BrandSwatch;
  cssVars: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
}
