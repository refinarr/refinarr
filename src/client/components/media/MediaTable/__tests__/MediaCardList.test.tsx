import { describe, it, expect } from "vitest";
import { CARD_HEIGHT_ESTIMATE_PX } from "../MediaCardList";

describe("MediaCardList virtualizer estimate", () => {
  // Regression guard for the card-stacking-on-scroll bug: virtual-core
  // suppresses the ref-attach remeasure while isScrolling, so a fast
  // flick briefly positions freshly-mounted cards at this estimate. It
  // MUST be >= the tallest real card (CF-chip row ~118px) so the
  // transient flashes a gap, never an overlap. Do not lower below 110.
  it("over-estimates at/above the real card height ceiling", () => {
    expect(CARD_HEIGHT_ESTIMATE_PX).toBeGreaterThanOrEqual(110);
  });
});
