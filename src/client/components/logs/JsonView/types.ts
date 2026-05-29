export type JsonPath = string;

export interface JsonViewProps {
  value: unknown;
  /**
   * Initial depth at which children render expanded. Beyond this depth,
   * objects/arrays start collapsed and the user can drill in. Defaults
   * to 2 — deep enough for typical log contexts without flooding.
   */
  initiallyExpandedDepth?: number;
}
