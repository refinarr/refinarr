import { describe, it, expect } from "vitest";
import { CARD_HEIGHT_ESTIMATE_PX } from "../MediaCardList";

describe("MediaCardList virtualizer estimate", () => {
  // Cards are now a UNIFORM two-row height (CF detail moved off the card
  // to a count on the meta line), so the estimate should MATCH that
  // height — not over- or under-shoot. A mismatch reintroduces the
  // fast-scroll gap (too tall) or overlap (too short) this guards against.
  // Measured at exactly 70px on mobile (#96); the band allows a few px of
  // cross-platform font-metric variance without re-admitting the old 84
  // over-estimate.
  it("matches the uniform two-row card height", () => {
    expect(CARD_HEIGHT_ESTIMATE_PX).toBeGreaterThanOrEqual(66);
    expect(CARD_HEIGHT_ESTIMATE_PX).toBeLessThanOrEqual(74);
  });
});
