import { describe, test, expect } from "vitest";
import {
  passwordChangeSchema,
  instanceUpdateSchema,
} from "@/shared/types/schemas";

describe("instanceUpdateSchema cron validation", () => {
  // #23: a bare single-field PUT must not be able to persist a garbage cron.
  test("rejects an invalid cron expression even on its own", () => {
    const r = instanceUpdateSchema.safeParse({
      autoSearchCronExpression: "garbage_string",
    });
    expect(r.success).toBe(false);
  });

  test("accepts a valid cron expression", () => {
    const r = instanceUpdateSchema.safeParse({
      autoSearchCronExpression: "*/5 * * * *",
    });
    expect(r.success).toBe(true);
  });

  test("accepts a payload that omits the cron field", () => {
    const r = instanceUpdateSchema.safeParse({ name: "Renamed" });
    expect(r.success).toBe(true);
  });
});

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
