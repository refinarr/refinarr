// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreLabel } from "../ScoreLabel";

describe("ScoreLabel", () => {
  it("renders score / target in profile mode", () => {
    render(<ScoreLabel score={120} minProfileScore={500} />);
    expect(screen.getByText("120 / 500")).toBeInTheDocument();
  });

  it("renders score as a percent in manual mode", () => {
    render(<ScoreLabel score={0.75} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("rounds the percent to the nearest integer", () => {
    render(<ScoreLabel score={0.666} />);
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows 0 / 0 when minProfileScore is 0 (a profile with no cutoff)", () => {
    render(<ScoreLabel score={0} minProfileScore={0} />);
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });
});
