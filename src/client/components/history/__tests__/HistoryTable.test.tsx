// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import type { ActionLog } from "@/shared/types/models";
import { renderWithProviders, screen, within } from "@/test/render";
import { HistoryTable } from "../HistoryTable";

function makeLog(overrides: Partial<ActionLog>): ActionLog {
  return {
    id: 1,
    instanceId: 1,
    action: "search",
    mediaId: 1,
    title: "Movie 1",
    isDryRun: false,
    status: "success",
    error: null,
    payload: null,
    groupId: null,
    commandId: null,
    createdAt: new Date("2026-05-08T12:00:00Z"),
    lastRetriedAt: null,
    ...overrides,
  };
}

describe("HistoryTable grouping", () => {
  // Single-item groups + null-groupId rows render as flat sibling
  // table rows. No batch parent, no expand affordance.
  it("renders flat rows when groupId is null", () => {
    const logs = [
      makeLog({ id: 1, title: "Alpha" }),
      makeLog({ id: 2, title: "Bravo" }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
    // No "Batch" header anywhere when nothing is grouped.
    expect(screen.queryByText(/Batch · /)).toBeNull();
  });

  // The whole point of this PR. N rows with the same UUID collapse
  // under one parent header that summarizes them; children are hidden
  // until expanded.
  it("collapses sibling rows under one batch parent and hides children", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, title: "Alpha", groupId }),
      makeLog({ id: 2, title: "Bravo", groupId }),
      makeLog({ id: 3, title: "Charlie", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    // Parent header surfaces the count.
    expect(screen.getByText(/3 items/)).toBeTruthy();
    // Children are hidden until the parent is clicked.
    expect(screen.queryByText("Alpha")).toBeNull();
    expect(screen.queryByText("Bravo")).toBeNull();
    expect(screen.queryByText("Charlie")).toBeNull();
  });

  // Click-to-expand reveals the children. Per-row retry remains usable
  // once expanded — that's the contract that lets users fix individual
  // failed items inside a mostly-successful batch.
  it("expands children on click, then collapses again", async () => {
    const user = userEvent.setup();
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, title: "Alpha", groupId }),
      makeLog({ id: 2, title: "Bravo", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    // Parent row exposes role="button" (with aria-expanded) so keyboard
    // users can Tab into it; click handler fires the toggle either way.
    const parent = screen.getByRole("button", { expanded: false });
    await user.click(parent);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getByText("Bravo")).toBeTruthy();
    await user.click(screen.getByRole("button", { expanded: true }));
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  // Keyboard activation: Enter and Space both trigger the toggle, same
  // as click. role="button" + tabIndex=0 + onKeyDown handler.
  it("expands children on Enter / Space (keyboard accessibility)", async () => {
    const user = userEvent.setup();
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, title: "Alpha", groupId }),
      makeLog({ id: 2, title: "Bravo", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    const parent = screen.getByRole("button", { expanded: false });
    parent.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Alpha")).toBeTruthy();
    await user.keyboard(" ");
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  // A solitary row renders flat — the bulk client only stamps a
  // groupId when >1 items are submitted, so a single-row group only
  // arises after siblings drain off-screen (e.g. cleared) or via a
  // legacy row. Either way "Batch · 1 item" would be misleading.
  // Pending queue rows are synthesized into the history feed at the
  // API layer, so by the time a solo group reaches us, it is genuinely
  // the only row.
  it("renders a single-row group as flat (no parent header)", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [makeLog({ id: 1, title: "Solo", groupId })];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getByText("Solo")).toBeTruthy();
    expect(screen.queryByText(/items/)).toBeNull();
  });

  // Mixed list: a batch parent for the grouped rows + flat rows for
  // the rest. Order is preserved (logs come in createdAt-desc).
  it("interleaves batch and flat groups", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, title: "Recent flat" }),
      makeLog({ id: 2, title: "Batch A", groupId }),
      makeLog({ id: 3, title: "Batch B", groupId }),
      makeLog({ id: 4, title: "Older flat" }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getByText("Recent flat")).toBeTruthy();
    expect(screen.getByText("Older flat")).toBeTruthy();
    expect(screen.getByText(/2 items/)).toBeTruthy();
    // Batch children remain hidden.
    expect(screen.queryByText("Batch A")).toBeNull();
  });

  // Status pill on the parent surfaces the worst outstanding state so
  // partially-failed batches stand out in the list.
  it("summarizes child statuses on the parent row (failed wins over success)", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, status: "success", groupId }),
      makeLog({ id: 2, status: "failed", error: "boom", groupId }),
      makeLog({ id: 3, status: "success", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    const parent = screen.getByRole("button", { expanded: false });
    // The aggregate badge inside the parent row should reflect the
    // worst child status.
    expect(within(parent).getByText(/Failed/i)).toBeTruthy();
  });
});
