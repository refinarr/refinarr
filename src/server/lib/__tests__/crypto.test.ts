import { describe, test, expect, vi, afterEach } from "vitest";
import { randomBytes } from "crypto";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// ENCRYPTION_KEY must be set before the crypto module is imported for the
// first time in this worker. global-setup.ts already sets it, but we ensure
// the key is set here too in case the test file is run in isolation.
const TEST_KEY = process.env.ENCRYPTION_KEY ?? randomBytes(32).toString("base64");
process.env.ENCRYPTION_KEY = TEST_KEY;

import { encryptSecret, decryptSecret, isEncrypted } from "@/server/lib/crypto";

describe("isEncrypted", () => {
  test("string starting with v1: returns true", () => {
    expect(isEncrypted("v1:abc:def:ghi")).toBe(true);
  });

  test("plain string returns false", () => {
    expect(isEncrypted("plaintext-api-key")).toBe(false);
  });

  test("empty string returns false", () => {
    expect(isEncrypted("")).toBe(false);
  });

  test("v1 prefix without colon returns false", () => {
    expect(isEncrypted("v1")).toBe(false);
  });
});

describe("encryptSecret / decryptSecret round-trip", () => {
  test("plain string round-trips correctly", () => {
    expect(decryptSecret(encryptSecret("my-api-key"))).toBe("my-api-key");
  });

  test("empty string round-trips", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
  });

  test("unicode string round-trips", () => {
    const s = "ñoño-key-🔑";
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });

  test("long string round-trips", () => {
    const s = "a".repeat(256);
    expect(decryptSecret(encryptSecret(s))).toBe(s);
  });

  test("two encryptions of same input produce different ciphertext (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toBe(b);
  });

  test("result starts with v1: prefix", () => {
    expect(encryptSecret("test").startsWith("v1:")).toBe(true);
  });
});

describe("decryptSecret — backwards compatibility", () => {
  test("non-encrypted string returned as-is", () => {
    expect(decryptSecret("plaintext-key")).toBe("plaintext-key");
  });

  test("arbitrary non-v1: string returned unchanged", () => {
    expect(decryptSecret("deadbeef1234567890abcdef12345678")).toBe(
      "deadbeef1234567890abcdef12345678"
    );
  });
});

describe("decryptSecret — malformed blobs", () => {
  test("v1: with no content throws", () => {
    expect(() => decryptSecret("v1:")).toThrow();
  });

  test("v1: with only two colon-separated parts throws", () => {
    expect(() => decryptSecret("v1:onlytwo:parts")).toThrow();
  });

  test("correct structure but IV too short throws", () => {
    // iv = 1 byte, tag = 1 byte, ct = empty
    const short = "v1:" + Buffer.from([0]).toString("base64") + ":" + Buffer.from([0]).toString("base64") + ":";
    expect(() => decryptSecret(short)).toThrow();
  });

  test("correct structure, valid lengths but corrupted ciphertext throws", () => {
    const blob = encryptSecret("original");
    // Flip one character in the ciphertext segment (last part after v1:iv:tag:)
    const parts = blob.split(":");
    parts[3] = parts[3].split("").reverse().join(""); // mangle ciphertext
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});

describe("encryptSecret — input validation", () => {
  test("non-string input throws", () => {
    expect(() => encryptSecret(123 as unknown as string)).toThrow(
      "encryptSecret requires a string"
    );
  });
});

describe("key loading — env var validation", () => {
  const originalKey = process.env.ENCRYPTION_KEY;
  const originalPath = process.env.ENCRYPTION_KEY_PATH;
  const tmpDirs: string[] = [];

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalKey;
    if (originalPath === undefined) delete process.env.ENCRYPTION_KEY_PATH;
    else process.env.ENCRYPTION_KEY_PATH = originalPath;
    for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
    tmpDirs.length = 0;
    vi.resetModules();
  });

  test("ENCRYPTION_KEY with wrong byte length throws on first use", async () => {
    vi.resetModules();
    process.env.ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    const mod = await import("@/server/lib/crypto");
    expect(() => mod.encryptSecret("x")).toThrow(/32 bytes/);
  });

  test("loads key from ENCRYPTION_KEY_PATH file when env var is unset", async () => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const dir = mkdtempSync(join(tmpdir(), "refinarr-key-"));
    tmpDirs.push(dir);
    const keyPath = join(dir, ".encryption-key");
    writeFileSync(keyPath, randomBytes(32));
    process.env.ENCRYPTION_KEY_PATH = keyPath;

    const mod = await import("@/server/lib/crypto");
    const blob = mod.encryptSecret("hello-from-file-key");
    expect(mod.decryptSecret(blob)).toBe("hello-from-file-key");
  });

  test("throws when key file exists but has wrong length", async () => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const dir = mkdtempSync(join(tmpdir(), "refinarr-key-"));
    tmpDirs.push(dir);
    const keyPath = join(dir, ".encryption-key");
    writeFileSync(keyPath, Buffer.alloc(8)); // not 32 bytes
    process.env.ENCRYPTION_KEY_PATH = keyPath;

    const mod = await import("@/server/lib/crypto");
    expect(() => mod.encryptSecret("x")).toThrow(/corrupt/);
  });

  test("generates a new key file when none exists", async () => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
    const dir = mkdtempSync(join(tmpdir(), "refinarr-key-"));
    tmpDirs.push(dir);
    const keyPath = join(dir, "subdir", ".encryption-key");
    process.env.ENCRYPTION_KEY_PATH = keyPath;

    const mod = await import("@/server/lib/crypto");
    const blob = mod.encryptSecret("new-key-test");
    expect(mod.decryptSecret(blob)).toBe("new-key-test");
  });

  test("defaults to a /data path in production when no env/path is set", async () => {
    vi.resetModules();
    delete process.env.ENCRYPTION_KEY;
    // Override the production path to a writable temp dir so we don't try to write to /data.
    const dir = mkdtempSync(join(tmpdir(), "refinarr-prod-key-"));
    tmpDirs.push(dir);
    process.env.ENCRYPTION_KEY_PATH = join(dir, ".encryption-key");
    vi.stubEnv("NODE_ENV", "production");

    try {
      const mod = await import("@/server/lib/crypto");
      const blob = mod.encryptSecret("prod-key-test");
      expect(mod.decryptSecret(blob)).toBe("prod-key-test");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
