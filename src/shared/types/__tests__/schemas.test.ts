import { describe, test, expect } from "vitest";
import { passwordChangeSchema } from "@/shared/types/schemas";

describe("passwordChangeSchema", () => {
  const base = {
    currentPassword: "current-password-123",
    newPassword: "brand-new-pass-123",
  };

  test("accepts a matching confirmation", () => {
    const r = passwordChangeSchema.safeParse({
      ...base,
      confirmPassword: base.newPassword,
    });
    expect(r.success).toBe(true);
  });

  test("rejects a mismatched confirmation", () => {
    const r = passwordChangeSchema.safeParse({
      ...base,
      confirmPassword: "something-else-123",
    });
    expect(r.success).toBe(false);
  });

  test("rejects a missing confirmation", () => {
    const r = passwordChangeSchema.safeParse(base);
    expect(r.success).toBe(false);
  });
});
