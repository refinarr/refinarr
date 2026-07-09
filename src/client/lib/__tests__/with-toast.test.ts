import { describe, test, expect, vi, beforeEach } from "vitest";
import { withToast } from "@/client/lib/with-toast";
import { ApiClientError } from "@/client/lib/api";

const loadingSpy = vi.fn();
const successSpy = vi.fn();
const errorSpy = vi.fn();
const dismissSpy = vi.fn();
const reportSpy = vi.fn();

vi.mock("@/client/lib/client-error-logger", () => ({
  reportClientError: (...args: unknown[]) => reportSpy(...args),
}));

let nextLoadingId = 0;

vi.mock("sonner", () => ({
  toast: {
    loading: (...args: unknown[]) => {
      loadingSpy(...args);
      return ++nextLoadingId;
    },
    success: (...args: unknown[]) => successSpy(...args),
    error: (...args: unknown[]) => errorSpy(...args),
    dismiss: (...args: unknown[]) => dismissSpy(...args),
  },
}));

beforeEach(() => {
  loadingSpy.mockReset();
  successSpy.mockReset();
  errorSpy.mockReset();
  dismissSpy.mockReset();
  reportSpy.mockReset();
  nextLoadingId = 0;
});

interface MockMutation<TData = unknown, TVars = unknown> {
  mutateAsync: (vars: TVars) => Promise<TData>;
}

function makeMutation<TData, TVars>(
  impl: (vars: TVars) => Promise<TData>,
): MockMutation<TData, TVars> {
  return { mutateAsync: vi.fn(impl) };
}

describe("withToast", () => {
  test("invokes mutateAsync with the variables and returns its data", async () => {
    const mutation = makeMutation<string, { id: number }>(
      async ({ id }) => `done-${id}`,
    );
    const run = withToast(mutation, { success: "ok" });
    await expect(run({ id: 42 })).resolves.toBe("done-42");
    expect(mutation.mutateAsync).toHaveBeenCalledWith({ id: 42 });
  });

  test("shows the loading toast only when caller passes localized copy", async () => {
    const withLoading = withToast(
      makeMutation(async () => "ok"),
      {
        loading: "Saving…",
        success: "Saved",
      },
    );
    await withLoading(undefined);
    expect(loadingSpy).toHaveBeenCalledWith("Saving…");

    loadingSpy.mockReset();
    const withoutLoading = withToast(
      makeMutation(async () => "ok"),
      {
        success: "Saved",
      },
    );
    await withoutLoading(undefined);
    expect(loadingSpy).not.toHaveBeenCalled();
  });

  test("morphs the loading toast into the success toast via shared id", async () => {
    const run = withToast(
      makeMutation(async () => "data"),
      {
        loading: "Saving…",
        success: "Saved",
      },
    );
    await run(undefined);
    expect(successSpy).toHaveBeenCalledWith("Saved", { id: 1 });
  });

  test("uses the explicit error message when provided", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw new Error("ignored");
      }),
      { success: "ok", error: "Custom failure" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(Error);
    expect(errorSpy).toHaveBeenCalledWith("Custom failure", undefined);
  });

  test("falls back to err.message when no explicit error label is provided", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw new Error("Network down");
      }),
      { success: "ok" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(Error);
    expect(errorSpy).toHaveBeenCalledWith("Network down", undefined);
  });

  test("shows no error toast when the throw is not an Error and no error copy is provided", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw "string-error";
      }),
      { success: "ok" },
    );
    await expect(run(undefined)).rejects.toBe("string-error");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("dismisses the loading toast when no error message can be derived", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw "string-error";
      }),
      { loading: "Saving…", success: "ok" },
    );
    await expect(run(undefined)).rejects.toBe("string-error");
    expect(dismissSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  test("prefers the server STORAGE_FULL message over the caller's error copy", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw Object.assign(
          new Error(
            "Data volume is full. Free space on the /data volume and retry.",
          ),
          { code: "STORAGE_FULL" },
        );
      }),
      { success: "ok", error: "Delete failed" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(Error);
    expect(errorSpy).toHaveBeenCalledWith(
      "Data volume is full. Free space on the /data volume and retry.",
      undefined,
    );
  });

  test("success formatter receives resolved data and variables", async () => {
    const mutation = makeMutation<string, { id: number }>(
      async ({ id }) => `done-${id}`,
    );
    const run = withToast(mutation, {
      success: (data, vars) => `${data}:${vars.id}`,
    });
    await run({ id: 7 });
    expect(successSpy).toHaveBeenCalledWith("done-7:7", undefined);
  });

  test("error formatter receives error and variables", async () => {
    const run = withToast(
      makeMutation<string, { id: number }>(async () => {
        throw new Error("failed");
      }),
      {
        success: "ok",
        error: (err, vars) =>
          err instanceof Error ? `${err.message}:${vars.id}` : "unknown",
      },
    );
    await expect(run({ id: 9 })).rejects.toBeInstanceOf(Error);
    expect(errorSpy).toHaveBeenCalledWith("failed:9", undefined);
  });

  test("reports an unexpected client-side throw to the AppLog", async () => {
    // e.g. `crypto.randomUUID()` undefined on an http:// LAN origin — thrown
    // before any request, so nothing else would log it.
    const run = withToast(
      makeMutation(async () => {
        throw new TypeError("crypto.randomUUID is not a function");
      }),
      { success: "ok", error: "Couldn't start search" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(TypeError);
    expect(reportSpy).toHaveBeenCalledTimes(1);
    expect(reportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "crypto.randomUUID is not a function",
      }),
    );
  });

  test("does NOT report ApiClientError (api.ts owns that decision)", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw new ApiClientError({
          status: 400,
          message: "Invalid",
          path: "/x",
          method: "POST",
        });
      }),
      { success: "ok", error: "failed" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(ApiClientError);
    expect(reportSpy).not.toHaveBeenCalled();
  });

  test("does NOT report an aborted mutation (user cancellation)", async () => {
    const run = withToast(
      makeMutation(async () => {
        throw new DOMException("Aborted", "AbortError");
      }),
      { success: "ok", error: "cancelled" },
    );
    await expect(run(undefined)).rejects.toBeInstanceOf(DOMException);
    expect(reportSpy).not.toHaveBeenCalled();
  });
});
