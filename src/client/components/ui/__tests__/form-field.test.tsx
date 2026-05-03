// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "../form-field";
import { Input } from "../input";

describe("FormField", () => {
  it("renders label, input, and wires htmlFor → id", () => {
    render(
      <FormField id="email" label="Email">
        <Input type="email" defaultValue="" />
      </FormField>
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("renders the description and ties it to the input via aria-describedby", () => {
    render(
      <FormField id="password" label="Password" description="At least 12 characters">
        <Input type="password" defaultValue="" />
      </FormField>
    );
    const input = screen.getByLabelText("Password");
    const descId = input.getAttribute("aria-describedby");
    expect(descId).toBe("password-description");
    expect(screen.getByText("At least 12 characters")).toHaveAttribute("id", descId!);
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("renders the error with role=alert and marks the input invalid", () => {
    render(
      <FormField id="username" label="Username" error="Required">
        <Input defaultValue="" />
      </FormField>
    );
    const input = screen.getByLabelText("Username");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("username-error");
    const err = screen.getByRole("alert");
    expect(err).toHaveTextContent("Required");
    expect(err).toHaveAttribute("id", "username-error");
  });

  it("merges description and error IDs into a single aria-describedby", () => {
    render(
      <FormField id="x" label="X" description="hint" error="bad">
        <Input defaultValue="" />
      </FormField>
    );
    const input = screen.getByLabelText("X");
    expect(input.getAttribute("aria-describedby")).toBe("x-description x-error");
  });
});
