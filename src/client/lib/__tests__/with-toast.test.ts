import { describe, test, expect, vi, beforeEach } from "vitest";
import { withToast } from "@/client/lib/with-toast";

const promiseSpy = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    promise: (...args: unknown[]) => promiseSpy(...args),
  },
}));

beforeEach(() => {
  promiseSpy.mockReset();
});

interface MockMutation<TData = unknown, TVars = unknown> {
  mutateAsync: (vars: TVars) => Promise<TData>;
}

function makeMutation<TData, TVars>(impl: (vars: TVars) => Promise<TData>): MockMutation<TData, TVars> {
  return { mutateAsync: vi.fn(impl) };
}

describe("withToast", () => {
  test("invokes mutateAsync with the variables and returns its promise", async () => {
    const mutation = makeMutation<string, { id: number }>(async ({ id }) => `done-${id}`);
    // Cast: full UseMutationResult shape isn't needed for this helper.
    const run = withToast(mutation as never, { success: "ok" });
    await expect(run({ id: 42 })).resolves.toBe("done-42");
    expect(mutation.mutateAsync).toHaveBeenCalledWith({ id: 42 });
  });

  test("hands the promise to toast.promise with success/loading/error labels", async () => {
    const mutation = makeMutation(async () => "ok");
    const run = withToast(mutation as never, { loading: "Saving…", success: "Saved" });
    await run(undefined);
    expect(promiseSpy).toHaveBeenCalledTimes(1);
    const [, opts] = promiseSpy.mock.calls[0];
    expect(opts.loading).toBe("Saving…");
    expect(opts.success).toBe("Saved");
    expect(typeof opts.error).toBe("function");
  });

  test("uses default loading copy when not provided", async () => {
    const mutation = makeMutation(async () => "ok");
    const run = withToast(mutation as never, { success: "Saved" });
    await run(undefined);
    const [, opts] = promiseSpy.mock.calls[0];
    expect(opts.loading).toBe("Loading…");
  });

  test("error formatter prefers the explicit error message when provided", async () => {
    const mutation = makeMutation(async () => "ok");
    const run = withToast(mutation as never, { success: "ok", error: "Custom failure" });
    await run(undefined);
    const [, opts] = promiseSpy.mock.calls[0];
    expect(opts.error(new Error("ignored"))).toBe("Custom failure");
  });

  test("error formatter falls back to err.message when no explicit error label", async () => {
    const mutation = makeMutation(async () => "ok");
    const run = withToast(mutation as never, { success: "ok" });
    await run(undefined);
    const [, opts] = promiseSpy.mock.calls[0];
    expect(opts.error(new Error("Network down"))).toBe("Network down");
  });

  test("error formatter uses generic copy when err is not an Error", async () => {
    const mutation = makeMutation(async () => "ok");
    const run = withToast(mutation as never, { success: "ok" });
    await run(undefined);
    const [, opts] = promiseSpy.mock.calls[0];
    expect(opts.error("string-error")).toMatch(/something went wrong/i);
  });
});
