// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import type { ActionStatus } from "@/shared/types/models";
import { renderWithProviders, screen } from "@/test/render";
import { ActionStatusBadge } from "../ActionStatusBadge";

// Record<ActionStatus, string> forces the compiler to flag a missing
// status if the union grows — so this stays a real exhaustive check
// instead of a list someone could forget to extend.
describe("ActionStatusBadge — exhaustive ActionStatus coverage", () => {
  const labels: Record<ActionStatus, string> = {
    success: "Success",
    searched: "Searched",
    failed: "Failed",
    dry_run: "Dry Run",
    pending: "Pending",
    grabbed: "Grabbed",
    downloaded: "Downloaded",
  };

  for (const [status, label] of Object.entries(labels) as Array<
    [ActionStatus, string]
  >) {
    it(`renders label for status="${status}"`, () => {
      renderWithProviders(<ActionStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }
});
