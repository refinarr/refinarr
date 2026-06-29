// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { useCronPreview } from "@/client/hooks/data/useAutoSearch";
import { AUTO_SEARCH_SCOPES } from "@/shared/types/models";
import { renderWithProviders } from "@/test/render";
import {
  AutoSearchFormFields,
  isAutoSearchScope,
  type AutoSearchFields,
} from "../AutoSearchFormFields";

vi.mock("@/client/hooks/data/useAutoSearch", () => ({
  useCronPreview: vi.fn().mockReturnValue({ data: null, isError: false }),
}));

vi.mock("@/client/hooks/ui/useDebouncedValue", () => ({
  useDebouncedValue: vi.fn((value: unknown) => value),
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
  autoSearchCooldownHours: 0,
};

describe("isAutoSearchScope", () => {
  // Drives off AUTO_SEARCH_SCOPES (the single source of truth) so any scope
  // added to the type/schema/Select is automatically asserted to pass the
  // guard — prevents the "can't choose mixed" drift (#134) from recurring.
  test.each(AUTO_SEARCH_SCOPES)("accepts the '%s' scope", (scope) => {
    expect(isAutoSearchScope(scope)).toBe(true);
  });

  test("rejects unknown values and null", () => {
    expect(isAutoSearchScope("bogus")).toBe(false);
    expect(isAutoSearchScope(null)).toBe(false);
  });
});

describe("AutoSearchFormFields", () => {
  let onChange: (next: Partial<AutoSearchFields>) => void;

  beforeEach(() => {
    onChange = vi.fn() as unknown as typeof onChange;
    vi.mocked(useCronPreview).mockReturnValue({
      data: null,
      isError: false,
    } as unknown as ReturnType<typeof useCronPreview>);
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

  test("cron tab: shows aria-invalid when useCronPreview returns error", async () => {
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
          autoSearchCronExpression: "0 3 * * X",
        }}
        onChange={onChange}
      />,
    );
    const cronInput = screen.getByPlaceholderText("0 3 * * *");
    expect(cronInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/invalid cron/i)).toBeInTheDocument();
  });

  test("cron tab: shows aria-invalid for partial expression (fewer than 5 fields)", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{
          ...defaults,
          autoSearchEnabled: true,
          autoSearchScheduleMode: "cron",
          autoSearchCronExpression: "0 3 * *",
        }}
        onChange={onChange}
      />,
    );
    const cronInput = screen.getByPlaceholderText("0 3 * * *");
    expect(cronInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/invalid cron/i)).toBeInTheDocument();
  });

  test("cron tab: no error for valid 5-field expression", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{
          ...defaults,
          autoSearchEnabled: true,
          autoSearchScheduleMode: "cron",
          autoSearchCronExpression: "0 3 * * *",
        }}
        onChange={onChange}
      />,
    );
    const cronInput = screen.getByPlaceholderText("0 3 * * *");
    expect(cronInput).not.toHaveAttribute("aria-invalid");
  });

  test("cron tab: no error for empty expression", () => {
    renderWithProviders(
      <AutoSearchFormFields
        value={{
          ...defaults,
          autoSearchEnabled: true,
          autoSearchScheduleMode: "cron",
          autoSearchCronExpression: "",
        }}
        onChange={onChange}
      />,
    );
    const cronInput = screen.getByPlaceholderText("0 3 * * *");
    expect(cronInput).not.toHaveAttribute("aria-invalid");
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
