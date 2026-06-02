// Allow-list of poster content-types we will forward to the browser.
// The poster proxy serves *arr-supplied bytes into a same-origin
// response; a compromised or misconfigured *arr could otherwise return
// `text/html` / `text/javascript`, which the browser (especially with
// `X-Content-Type-Options: nosniff`) would render/execute rather than
// treat as a broken image. Pinning the declared type to a known image
// type closes that hole.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const FALLBACK_IMAGE_TYPE = "image/jpeg";

// Normalize an upstream `content-type` to a safe image type. Strips any
// `; charset=…` parameter and falls back to JPEG for anything not on the
// allow-list (or absent).
export function safeImageContentType(raw: string | null): string {
  const base = (raw ?? "").split(";")[0].trim().toLowerCase();
  return ALLOWED_IMAGE_TYPES.has(base) ? base : FALLBACK_IMAGE_TYPE;
}
