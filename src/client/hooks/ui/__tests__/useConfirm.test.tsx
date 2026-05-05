// @vitest-environment happy-dom
import { describe, test, expect } from "vitest";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { useConfirm } from "../useConfirm";
import { renderWithProviders, screen } from "@/test/render";

interface HostProps {
  onResolve: (v: boolean) => void;
  destructive?: boolean;
  autoOpen?: boolean;
}

function Host({ onResolve, destructive, autoOpen }: HostProps) {
  const { confirm, dialog } = useConfirm();
  useEffect(() => {
    if (!autoOpen) return;
    confirm({
      title: "Delete?",
      body: "This will delete it.",
      destructive,
    }).then(onResolve);
  }, [confirm, onResolve, destructive, autoOpen]);
  return <>{dialog}</>;
}

describe("useConfirm", () => {
  test("renders the dialog with title + body when confirm() is called", async () => {
    renderWithProviders(<Host onResolve={() => {}} autoOpen />);
    expect(await screen.findByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("This will delete it.")).toBeInTheDocument();
  });

  test("clicking confirm resolves the promise with true", async () => {
    let resolved: boolean | undefined;
    renderWithProviders(
      <Host
        onResolve={(v) => {
          resolved = v;
        }}
        autoOpen
      />,
    );
    const confirmBtn = await screen.findByRole("button", {
      name: /confirm|delete|yes/i,
    });
    await userEvent.click(confirmBtn);
    // Drain the microtask the promise resolves on.
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(true);
  });

  test("clicking cancel resolves the promise with false", async () => {
    let resolved: boolean | undefined;
    renderWithProviders(
      <Host
        onResolve={(v) => {
          resolved = v;
        }}
        autoOpen
      />,
    );
    const cancelBtn = await screen.findByRole("button", { name: /cancel|no/i });
    await userEvent.click(cancelBtn);
    await new Promise((r) => setTimeout(r, 0));
    expect(resolved).toBe(false);
  });

  test("destructive=true applies destructive styling to the confirm action", async () => {
    renderWithProviders(<Host onResolve={() => {}} destructive autoOpen />);
    const confirmBtn = await screen.findByRole("button", {
      name: /confirm|delete|yes/i,
    });
    expect(confirmBtn.className).toMatch(/destructive/);
  });

  test("dialog is not rendered until confirm() is called", () => {
    renderWithProviders(<Host onResolve={() => {}} />);
    expect(screen.queryByText("Delete?")).not.toBeInTheDocument();
  });
});
