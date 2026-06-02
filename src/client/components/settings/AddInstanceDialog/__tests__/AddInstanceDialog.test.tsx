// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import type { PublicInstance } from "@/shared/types/api";
import { renderWithProviders } from "@/test/render";
import { AddInstanceDialog } from "../AddInstanceDialog";

const { mockCreateMutateAsync, mockUpdateMutateAsync, mockTestMutateAsync } =
  vi.hoisted(() => ({
    mockCreateMutateAsync: vi.fn().mockResolvedValue({ id: 1 }),
    mockUpdateMutateAsync: vi.fn().mockResolvedValue({ id: 1 }),
    mockTestMutateAsync: vi.fn().mockResolvedValue({ ok: true }),
  }));

vi.mock("@/client/hooks/data/useInstances", () => ({
  useCreateInstance: vi.fn().mockReturnValue({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  }),
  useUpdateInstance: vi.fn().mockReturnValue({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  }),
  useTestCredentials: vi.fn().mockReturnValue({
    mutateAsync: mockTestMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/client/lib/with-toast", () => ({
  withToast: vi.fn(
    (mutation) =>
      (...args: unknown[]) =>
        mutation.mutateAsync(...args),
  ),
}));

const baseInstance: PublicInstance = {
  id: 42,
  type: "radarr",
  name: "My Radarr",
  url: "http://localhost:7878",
  enabled: true,
  searchesPerHour: 20,
  showAllMedia: false,
  createdAt: "2025-01-01T00:00:00Z",
  autoSearchEnabled: false,
  autoSearchScheduleMode: "interval",
  autoSearchIntervalMinutes: 1440,
  autoSearchCronExpression: "0 3 * * *",
  autoSearchBatchLimit: 5,
  autoSearchLastRunAt: null,
  autoSearchMonitoredOnly: true,
  autoSearchScope: "flagged",
  autoSearchPickStrategy: "balanced",
  autoSearchCooldownHours: 0,
  autoSearchPausedUntil: null,
};

const noop = () => {};

function fillAddForm() {
  fireEvent.change(screen.getByLabelText(/name/i), {
    target: { value: "Test Radarr" },
  });
  fireEvent.change(screen.getByLabelText(/url/i), {
    target: { value: "http://localhost:7878" },
  });
  fireEvent.change(screen.getByLabelText(/api key/i), {
    target: { value: "abc123" },
  });
}

describe("AddInstanceDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ id: 1 });
    mockUpdateMutateAsync.mockResolvedValue({ id: 1 });
    mockTestMutateAsync.mockResolvedValue({ ok: true });
  });

  test("shows 'Add Instance' title in add mode", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={null} />,
    );
    expect(screen.getByText(/add instance/i)).toBeInTheDocument();
  });

  test("shows 'Edit Instance' title in edit mode", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={baseInstance} />,
    );
    expect(screen.getByText(/edit instance/i)).toBeInTheDocument();
  });

  test("pre-fills name, url and searchesPerHour in edit mode", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={baseInstance} />,
    );
    expect(screen.getByLabelText(/name/i)).toHaveValue("My Radarr");
    expect(screen.getByLabelText(/url/i)).toHaveValue("http://localhost:7878");
    expect(screen.getByLabelText(/searches per hour/i)).toHaveValue(20);
  });

  test("api key field is empty in edit mode (leave blank to keep)", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={baseInstance} />,
    );
    expect(screen.getByLabelText(/api key/i)).toHaveValue("");
  });

  test("test connection button is disabled when url and api key are empty", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={null} />,
    );
    expect(
      screen.getByRole("button", { name: /test connection/i }),
    ).toBeDisabled();
  });

  test("test connection button enables after url and api key are filled", () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={null} />,
    );
    fireEvent.change(screen.getByLabelText(/url/i), {
      target: { value: "http://localhost:7878" },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: "abc123" },
    });
    expect(
      screen.getByRole("button", { name: /test connection/i }),
    ).not.toBeDisabled();
  });

  test("add mode submit calls useCreateInstance with form values", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AddInstanceDialog open onClose={onClose} editing={null} />,
    );

    fillAddForm();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Test Radarr",
          url: "http://localhost:7878",
          apiKey: "abc123",
          type: "radarr",
        }),
      );
    });
  });

  test("add mode submit calls onClose after success", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AddInstanceDialog open onClose={onClose} editing={null} />,
    );

    fillAddForm();
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test("edit mode submit calls useUpdateInstance with instance id", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AddInstanceDialog open onClose={onClose} editing={baseInstance} />,
    );

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: "Renamed Radarr" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: baseInstance.id,
          data: expect.objectContaining({ name: "Renamed Radarr" }),
        }),
      );
    });
  });

  test("edit mode submit omits apiKey when left blank", async () => {
    renderWithProviders(
      <AddInstanceDialog open onClose={noop} editing={baseInstance} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalled();
      expect(mockUpdateMutateAsync.mock.calls[0][0]).not.toHaveProperty(
        "data.apiKey",
      );
    });
  });

  test("cancel button calls onClose without submitting", () => {
    const onClose = vi.fn();
    renderWithProviders(
      <AddInstanceDialog open onClose={onClose} editing={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
