import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/test/**/*.ts"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    // shadcn-installed primitives. Edits would be clobbered by `shadcn add`,
    // so we don't track their internals.
    "src/client/components/ui/**",
  ],
  ignoreDependencies: [
    // Used inside globals.css via `@import "tw-animate-css"`. Knip can't see
    // CSS-side imports.
    "tw-animate-css",
    // CLI tool, only invoked via `npx shadcn add` from the terminal.
    "shadcn",
    // Pino references this as a string ID (`transport.target`), invisible to
    // static analysis. Dev-only pretty printer.
    "pino-pretty",
  ],
};

export default config;
