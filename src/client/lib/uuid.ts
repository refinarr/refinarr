// `crypto.randomUUID()` is only defined in secure contexts (HTTPS or
// localhost). Self-hosted refinarr is routinely reached over plain HTTP on
// a LAN IP (e.g. http://10.10.1.11:7272), where `crypto.randomUUID` is
// undefined — calling it throws a TypeError and takes down every bulk
// action (search / delete / ignore all mint a groupId before dispatch).
// `crypto.getRandomValues()` IS available in insecure contexts, so derive
// an RFC-4122 v4 UUID from it as a fallback. The result must stay a valid
// UUID: the server validates groupId with `z.string().uuid()`.
export function safeRandomUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
