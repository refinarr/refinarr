import { describe, test, expect } from "vitest";
import { safeImageContentType } from "@/server/lib/image-content-type";

describe("safeImageContentType", () => {
  test("passes through allow-listed image types", () => {
    for (const ct of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/avif",
    ]) {
      expect(safeImageContentType(ct)).toBe(ct);
    }
  });

  test("strips charset / parameters and lowercases", () => {
    expect(safeImageContentType("Image/PNG; charset=binary")).toBe("image/png");
  });

  test("falls back to jpeg for non-image types", () => {
    expect(safeImageContentType("text/html")).toBe("image/jpeg");
    expect(safeImageContentType("application/json")).toBe("image/jpeg");
  });

  test("falls back to jpeg when absent", () => {
    expect(safeImageContentType(null)).toBe("image/jpeg");
    expect(safeImageContentType("")).toBe("image/jpeg");
  });
});
