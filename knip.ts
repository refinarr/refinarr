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
    // Peer dep of `@prisma/adapter-libsql`; required at runtime even though
    // we never import it directly.
    "@libsql/client",
    // CLI tool, only invoked via `npx shadcn add` from the terminal.
    "shadcn",
    // Pino references this as a string ID (`transport.target`), invisible to
    // static analysis. Dev-only pretty printer.
    "pino-pretty",
    // Used by the postcss/Tailwind build pipeline, not imported in code.
    "tailwindcss",
  ],
};

export default config;
