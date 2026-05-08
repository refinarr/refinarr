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
    status: "searched",
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

  // Regression: when the search worker round-robins between instances,
  // two batches submitted around the same time produce ActionLog rows
  // whose createdAt timestamps interleave between groups. The old
  // adjacency-based bucketer collapsed each into solo flat rows.
  // Fixture timestamps are deliberately interleaved B→A→B→A in
  // createdAt-desc order so the input mirrors what the API emits.
  it("groups non-adjacent rows of the same batch (interleaved createdAt order)", () => {
    const groupA = "11111111-1111-1111-1111-111111111111";
    const groupB = "22222222-2222-2222-2222-222222222222";
    const logs = [
      makeLog({
        id: 1,
        title: "B-newer",
        groupId: groupB,
        createdAt: new Date("2026-05-08T12:00:04Z"),
      }),
      makeLog({
        id: 2,
        title: "A-newer",
        groupId: groupA,
        createdAt: new Date("2026-05-08T12:00:03Z"),
      }),
      makeLog({
        id: 3,
        title: "B-older",
        groupId: groupB,
        createdAt: new Date("2026-05-08T12:00:02Z"),
      }),
      makeLog({
        id: 4,
        title: "A-older",
        groupId: groupA,
        createdAt: new Date("2026-05-08T12:00:01Z"),
      }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByText("A-newer")).toBeNull();
    expect(screen.queryByText("B-newer")).toBeNull();
    const counts = screen.getAllByText(/2 items/);
    expect(counts).toHaveLength(2);
  });

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
    expect(screen.queryByText("Batch A")).toBeNull();
  });

  // The count-per-status approach replaces a single summary badge that
  // had to compromise between "show worst" (hid progress) and "show
  // most-advanced" (hid problems). Display order stays fixed:
  //   pending → failed → dry_run → searched → grabbed → downloaded → success
  it("parent renders a count badge per status present (mixed batch)", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, status: "searched", groupId }),
      makeLog({ id: 2, status: "downloaded", groupId }),
      makeLog({ id: 3, status: "failed", error: "boom", groupId }),
      makeLog({ id: 4, status: "searched", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    const parent = screen.getByRole("button", { expanded: false });
    expect(within(parent).getByText("1 Failed")).toBeTruthy();
    expect(within(parent).getByText("2 Searched")).toBeTruthy();
    expect(within(parent).getByText("1 Downloaded")).toBeTruthy();
  });

  it("parent shows the count even for a homogeneous batch (e.g. 3 Downloaded)", () => {
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, status: "downloaded", groupId }),
      makeLog({ id: 2, status: "downloaded", groupId }),
      makeLog({ id: 3, status: "downloaded", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    const parent = screen.getByRole("button", { expanded: false });
    expect(within(parent).getByText("3 Downloaded")).toBeTruthy();
  });

  it("parent counts render in fixed display order regardless of input order", () => {
    // Children supplied in createdAt-desc order: downloaded, searched,
    // failed, pending. Display order should still read pending →
    // failed → searched → downloaded.
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({ id: 1, status: "downloaded", groupId }),
      makeLog({ id: 2, status: "searched", groupId }),
      makeLog({ id: 3, status: "failed", error: "boom", groupId }),
      makeLog({ id: 4, status: "pending", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    const parent = screen.getByRole("button", { expanded: false });
    // Match only count-prefixed status badges. The bare `^[0-9]+\s/`
    // regex would also catch the date column's "3 hours ago" text.
    const labels = within(parent)
      .getAllByText(
        /^\d+ (Pending|Failed|Dry Run|Searched|Grabbed|Downloaded|Success)$/,
      )
      .map((el) => el.textContent);
    expect(labels).toEqual([
      "1 Pending",
      "1 Failed",
      "1 Searched",
      "1 Downloaded",
    ]);
  });
});

// Flat (single, ungrouped) rows still render the bare badge with no
// count — the row IS the item, count is implicit.
describe("ActionStatusBadge — flat-row rendering (no count prefix)", () => {
  it("flat row badge has no leading number", () => {
    const logs = [makeLog({ id: 1, status: "downloaded", title: "Solo" })];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getByText("Downloaded")).toBeTruthy();
    expect(screen.queryByText("1 Downloaded")).toBeNull();
  });
});

// Command-sync poll captures the upstream `body.completionMessage` (e.g.
// "0 releases found"). It renders as a small italic subscript next to
// the title — the user-visible payoff of statusPoller. Cover both row
// shapes so neither path silently regresses.
describe("HistoryTable completionMessage", () => {
  it("renders completionMessage as a subscript on flat rows", () => {
    const logs = [
      makeLog({
        id: 1,
        title: "Movie X",
        completionMessage: "0 releases found",
      }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    expect(screen.getByText(/0 releases found/)).toBeTruthy();
  });

  it("renders completionMessage on expanded batch children", async () => {
    const user = userEvent.setup();
    const groupId = "11111111-2222-3333-4444-555555555555";
    const logs = [
      makeLog({
        id: 1,
        title: "Alpha",
        groupId,
        completionMessage: "Sent 1 release(s) to download client",
      }),
      makeLog({ id: 2, title: "Bravo", groupId }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    // Children hidden until expanded — message must not leak to the
    // parent header.
    expect(screen.queryByText(/Sent 1 release/)).toBeNull();
    await user.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByText(/Sent 1 release/)).toBeTruthy();
  });

  it("does not render the · separator when completionMessage is null", () => {
    const logs = [
      makeLog({ id: 1, title: "Movie Y", completionMessage: null }),
    ];
    renderWithProviders(<HistoryTable logs={logs} />);
    // No subscript text node alongside the title.
    expect(screen.queryByText(/^· /)).toBeNull();
  });
});
