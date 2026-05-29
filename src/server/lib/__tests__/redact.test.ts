import { describe, test, expect } from "vitest";
import { redactString, redactContext } from "@/server/lib/redact";

describe("redactString — query param patterns", () => {
  test("?apikey= is redacted", () => {
    expect(redactString("?apikey=abc123secret")).toBe("?apikey=***");
  });

  test("?api_key= is redacted", () => {
    expect(redactString("?api_key=abc123secret&other=val")).toBe(
      "?api_key=***&other=val",
    );
  });

  test("?api-key= is redacted", () => {
    expect(redactString("?api-key=abc123secret")).toBe("?api-key=***");
  });

  test("?apiKey= (camelCase) is redacted", () => {
    expect(redactString("?apiKey=abc123secret")).toBe("?apiKey=***");
  });

  test("APIKEY (uppercase) is redacted", () => {
    expect(redactString("?APIKEY=secretvalue")).toBe("?APIKEY=***");
  });
});

describe("redactString — header patterns", () => {
  test("X-Api-Key header value is redacted", () => {
    expect(redactString("X-Api-Key: deadbeef1234567890abcdef12345678")).toBe(
      "X-Api-Key: ***",
    );
  });

  test("Authorization header value is redacted", () => {
    expect(
      redactString("Authorization: Bearer deadbeef1234567890abcdef12345678"),
    ).toBe("Authorization: ***");
  });
});

describe("redactString — 32-char hex token pattern", () => {
  test("standalone 32-char hex is redacted", () => {
    expect(redactString("deadbeef1234567890abcdef12345678")).toBe("***");
  });

  test("32-char hex inline in text is redacted", () => {
    expect(redactString("key is deadbeef1234567890abcdef12345678 here")).toBe(
      "key is *** here",
    );
  });

  test("31-char hex is NOT redacted (boundary)", () => {
    const s = "a".repeat(31);
    expect(redactString(s)).toBe(s);
  });

  test("33-char hex is NOT redacted (boundary)", () => {
    const s = "a".repeat(33);
    expect(redactString(s)).toBe(s);
  });

  test("uppercase 32-char hex is redacted (case-insensitive)", () => {
    expect(redactString("DEADBEEF1234567890ABCDEF12345678")).toBe("***");
  });
});

describe("redactString — no-op cases", () => {
  test("string with no sensitive data is unchanged", () => {
    expect(redactString("nothing sensitive here")).toBe(
      "nothing sensitive here",
    );
  });

  test("empty string returns empty string", () => {
    expect(redactString("")).toBe("");
  });
});

describe("redactContext — reserved keys", () => {
  test("password key is scrubbed", () => {
    expect(redactContext({ password: "secret" })).toEqual({ password: "***" });
  });

  test("apikey key is scrubbed (case-insensitive)", () => {
    expect(redactContext({ APIKEY: "secret" })).toEqual({ APIKEY: "***" });
  });

  test("x-api-key key is scrubbed", () => {
    expect(redactContext({ "x-api-key": "secret" })).toEqual({
      "x-api-key": "***",
    });
  });

  test("authorization key is scrubbed", () => {
    expect(redactContext({ authorization: "Bearer token" })).toEqual({
      authorization: "***",
    });
  });

  test("cookie key is scrubbed", () => {
    expect(redactContext({ cookie: "session=abc" })).toEqual({ cookie: "***" });
  });

  test("set-cookie key is scrubbed", () => {
    expect(redactContext({ "set-cookie": "session=abc" })).toEqual({
      "set-cookie": "***",
    });
  });

  test("session key is scrubbed", () => {
    expect(redactContext({ session: "abc123" })).toEqual({ session: "***" });
  });

  test("passwordhash key is scrubbed", () => {
    expect(redactContext({ passwordhash: "scrypt$..." })).toEqual({
      passwordhash: "***",
    });
  });

  test("token key is scrubbed", () => {
    expect(redactContext({ token: "abc" })).toEqual({ token: "***" });
  });

  test("bearer key is scrubbed (case-insensitive)", () => {
    expect(redactContext({ Bearer: "abc" })).toEqual({ Bearer: "***" });
  });

  test("jwt key is scrubbed", () => {
    expect(redactContext({ jwt: "eyJ..." })).toEqual({ jwt: "***" });
  });

  test("secret key is scrubbed", () => {
    expect(redactContext({ secret: "shh" })).toEqual({ secret: "***" });
  });

  test("credentials key is scrubbed", () => {
    expect(redactContext({ credentials: "u:p" })).toEqual({
      credentials: "***",
    });
  });
});

describe("redactContext — string values run through redactString", () => {
  test("string value with apikey pattern is redacted", () => {
    const result = redactContext({ url: "http://host?apikey=abc123" });
    expect(result?.url).toBe("http://host?apikey=***");
  });

  test("string value with 32-char hex is redacted", () => {
    const result = redactContext({
      msg: "token deadbeef1234567890abcdef12345678 rejected",
    });
    expect(result?.msg).toBe("token *** rejected");
  });
});

describe("redactContext — nested objects", () => {
  test("nested object is recursively redacted", () => {
    const result = redactContext({
      nested: { authorization: "Bearer token" },
    });
    expect(result?.nested).toEqual({ authorization: "***" });
  });

  test("deeply nested reserved key is scrubbed", () => {
    const result = redactContext({
      outer: { inner: { password: "secret" } },
    });
    expect((result?.outer as Record<string, unknown>)?.inner).toEqual({
      password: "***",
    });
  });
});

describe("redactContext — array recursion", () => {
  test("clean string array passes through unchanged", () => {
    expect(redactContext({ tags: ["one", "two"] })).toEqual({
      tags: ["one", "two"],
    });
  });

  test("array of strings: each element runs through redactString", () => {
    const result = redactContext({
      msgs: [
        "ok",
        "token deadbeef1234567890abcdef12345678 rejected",
        "?apikey=leak",
      ],
    });
    expect(result?.msgs).toEqual(["ok", "token *** rejected", "?apikey=***"]);
  });

  test("array of objects: each element recurses, reserved keys scrubbed", () => {
    const result = redactContext({
      events: [
        { type: "login", password: "shh" },
        { type: "rotate", apikey: "abc" },
      ],
    });
    expect(result?.events).toEqual([
      { type: "login", password: "***" },
      { type: "rotate", apikey: "***" },
    ]);
  });

  test("nested arrays recurse all the way down", () => {
    const result = redactContext({
      batches: [[{ token: "abc" }], [{ password: "shh" }]],
    });
    expect(result?.batches).toEqual([
      [{ token: "***" }],
      [{ password: "***" }],
    ]);
  });

  test("mixed array (strings + objects) handles each kind", () => {
    const result = redactContext({
      mixed: ["?apikey=leak", { token: "abc" }, 42],
    });
    expect(result?.mixed).toEqual(["?apikey=***", { token: "***" }, 42]);
  });
});

describe("redactContext — non-redacted types", () => {
  test("number values pass through unchanged", () => {
    expect(redactContext({ count: 42 })).toEqual({ count: 42 });
  });

  test("boolean values pass through unchanged", () => {
    expect(redactContext({ enabled: true })).toEqual({ enabled: true });
  });

  test("null value passes through unchanged", () => {
    expect(redactContext({ val: null })).toEqual({ val: null });
  });

  test("undefined ctx returns undefined", () => {
    expect(redactContext(undefined)).toBeUndefined();
  });
});
