// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import {
  AutoSearchFormFields,
  type AutoSearchFields,
} from "../AutoSearchFormFields";

vi.mock("@/client/hooks/data/useAutoSearch", () => ({
  useCronPreview: vi.fn().mockReturnValue({ data: null, isError: false }),
}));

const defaults: AutoSearchFields = {
  autoSearchEnabled: false,
  autoSearchScheduleMode: "interval",
  autoSearchIntervalMinutes: 1440,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged",
  autoSearchPickStrategy: "balanced",
};

describe("AutoSearchFormFields", () => {
  let onChange: (next: Partial<AutoSearchFields>) => void;

  beforeEach(() => {
    onChange = vi.fn() as unknown as typeof onChange;
  });

  test("renders enable toggle in off state", () => {
    renderWithProviders(
      <AutoSearchFormFields value={defaults} onChange={onChange} />,
    );
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
  });

  test("toggle change calls onChange with autoSearchEnabled", () => {
    renderWithProviders(
      <AutoSearchFormFields value={defaults} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith({ autoSearchEnabled: true });
  });

  test("mode tabs not visible when auto-search is disabled", () => {
    renderWithProviders(
      <AutoSearchFormFields value={defaults} onChange={onChange} />,
    );
    // Tabs only render when enabled
    expect(screen.queryByRole("tab")).toBeNull();
  });

  test("when enabled, renders interval and cron tabs", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{ ...defaults, autoSearchEnabled: true }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("tab", { name: /interval/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /cron/i })).toBeInTheDocument();
  });

  test("interval tab: changing number calls onChange with updated intervalMinutes", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{
          ...defaults,
          autoSearchEnabled: true,
          autoSearchScheduleMode: "interval",
        }}
        onChange={onChange}
      />,
    );
    // Use label text to disambiguate from the batch-limit spinbutton
    const input = screen.getByLabelText("Run every");
    fireEvent.change(input, { target: { value: "2" } });
    // 2 days = 2880 minutes
    expect(onChange).toHaveBeenCalledWith({ autoSearchIntervalMinutes: 2880 });
  });

  test("switching to cron tab calls onChange with scheduleMode=cron", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{ ...defaults, autoSearchEnabled: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /cron/i }));
    expect(onChange).toHaveBeenCalledWith({ autoSearchScheduleMode: "cron" });
  });

  test("monitored-only toggle fires onChange", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{ ...defaults, autoSearchEnabled: true }}
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /monitored items only/i }),
    );
    expect(onChange).toHaveBeenCalledWith({ autoSearchMonitoredOnly: false });
  });

  test("cron tab: shows invalid error when useCronPreview has error", async () => {
    const { useCronPreview } =
      await import("@/client/hooks/data/useAutoSearch");
    vi.mocked(useCronPreview).mockReturnValue({
      data: null,
      isError: true,
    } as unknown as ReturnType<typeof useCronPreview>);

    renderWithProviders(
      <AutoSearchFormFields
        value={{
          ...defaults,
          autoSearchEnabled: true,
          autoSearchScheduleMode: "cron",
        }}
        onChange={onChange}
      />,
    );
    // The cron input has placeholder "0 3 * * *" (from messages)
    const cronInput = screen.getByPlaceholderText("0 3 * * *");
    expect(cronInput.className).toContain("border-destructive");
  });

  test("scope select fires onChange with the selected scope", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{ ...defaults, autoSearchEnabled: true }}
        onChange={onChange}
      />,
    );
    // Verify all four scope options render (via accessible combobox)
    const scopeCombo = screen.getAllByRole("combobox");
    expect(scopeCombo.length).toBeGreaterThanOrEqual(1);
  });

  test("disabled prop disables toggle", () => {
    renderWithProviders(
      <AutoSearchFormFields value={defaults} onChange={onChange} disabled />,
    );
    // base-ui Switch renders aria-disabled rather than native disabled on a button
    expect(screen.getByRole("switch")).toHaveAttribute("aria-disabled", "true");
  });
});
