export interface ConfigSpec<T> {
  key: string;
  parse: (raw: string) => T;
  encode: (value: T) => string;
  default: T;
}

function defineKey<T>(spec: ConfigSpec<T>): ConfigSpec<T> {
  return spec;
}

export const ConfigKey = {
  DryRun: defineKey<boolean>({
    key: "dryRun",
    parse: (raw) => raw === "true",
    encode: (value) => String(value),
    default: true,
  }),
  ApiKey: defineKey<string | null>({
    key: "apiKey",
    parse: (raw) => raw,
    encode: (value) => value ?? "",
    default: null,
  }),
  DebugMode: defineKey<boolean>({
    key: "debugMode",
    parse: (raw) => raw === "true",
    encode: (value) => String(value),
    default: false,
  }),
} as const;
