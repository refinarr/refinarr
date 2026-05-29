import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdirSync,
} from "fs";
import { dirname, join } from "path";

const ALGO = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const PREFIX = "v1:";

function defaultKeyPath(): string {
  // Mirrors the DB path logic in db.ts: /data in production, project dir in dev.
  // Anchored to process.cwd() so Turbopack's NFT doesn't try to trace
  // the relative `./local/...` form as a project-local module.
  if (process.env.ENCRYPTION_KEY_PATH) return process.env.ENCRYPTION_KEY_PATH;
  return process.env.NODE_ENV === "production"
    ? "/data/.encryption-key"
    : join(process.cwd(), "local", ".encryption-key");
}

function loadOrGenerateKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    const buf = Buffer.from(envKey, "base64");
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `ENCRYPTION_KEY must decode to ${KEY_LEN} bytes (got ${buf.length}). Use a 32-byte base64 value.`,
      );
    }
    return buf;
  }
  // `path` is a runtime, env-driven location. The /* turbopackIgnore: true */
  // markers stop Turbopack's file tracer (output: "standalone" NFT) from
  // trying to follow it — without them it cannot bound the path, over-traces
  // the whole project into .next/standalone, and warns. Markers are
  // build-time only; they do not affect runtime behavior.
  const path = defaultKeyPath();
  if (existsSync(/* turbopackIgnore: true */ path)) {
    const buf = readFileSync(/* turbopackIgnore: true */ path);
    if (buf.length !== KEY_LEN) {
      throw new Error(
        `Encryption key at ${path} is corrupt (length ${buf.length}, expected ${KEY_LEN}).`,
      );
    }
    return buf;
  }
  // Generate on first run.
  const dir = dirname(path);
  if (!existsSync(/* turbopackIgnore: true */ dir))
    mkdirSync(/* turbopackIgnore: true */ dir, { recursive: true });
  const key = randomBytes(KEY_LEN);
  writeFileSync(/* turbopackIgnore: true */ path, key, { mode: 0o600 });
  try {
    chmodSync(/* turbopackIgnore: true */ path, 0o600);
  } catch {
    /* best-effort on Windows */
  }
  return key;
}

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!cachedKey) cachedKey = loadOrGenerateKey();
  return cachedKey;
}

export function encryptSecret(plain: string): string {
  if (typeof plain !== "string")
    throw new Error("encryptSecret requires a string");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(
      ":",
    )
  );
}

export function decryptSecret(blob: string): string {
  if (!isEncrypted(blob)) {
    // Backwards compatibility: rows from before this change.
    return blob;
  }
  const parts = blob.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted secret");
  const iv = Buffer.from(parts[0], "base64");
  const tag = Buffer.from(parts[1], "base64");
  const ct = Buffer.from(parts[2], "base64");
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}

export function isEncrypted(blob: string): boolean {
  return typeof blob === "string" && blob.startsWith(PREFIX);
}
