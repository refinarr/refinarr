// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import type { ActionStatus } from "@/shared/types/models";
import { renderWithProviders, screen } from "@/test/render";
import { ActionStatusBadge } from "../ActionStatusBadge";

// Every value in the ActionStatus union should produce a label and a
// styled badge — no fall-through. If a future status is added without
// updating ActionStatusBadge, this exhaustive test is the safety net
// (TS will also catch it via Record<ActionStatus, ...> but the
// rendered label is what users actually see).
describe("ActionStatusBadge — exhaustive ActionStatus coverage", () => {
  const cases: Array<{ status: ActionStatus; label: string }> = [
    { status: "success", label: "Success" },
    { status: "searched", label: "Searched" },
    { status: "failed", label: "Failed" },
    { status: "dry_run", label: "Dry Run" },
    { status: "pending", label: "Pending" },
    { status: "grabbed", label: "Grabbed" },
    { status: "downloaded", label: "Downloaded" },
  ];

  for (const { status, label } of cases) {
    it(`renders label for status="${status}"`, () => {
      renderWithProviders(<ActionStatusBadge status={status} />);
      expect(screen.getByText(label)).toBeTruthy();
    });
  }
});
