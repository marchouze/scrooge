// prototype/platform/obligations/review-urn.ts
//
// Shared helper: the stable `obligationUrn` an ObligationReviewCompleted event
// carries for a given obligation. Used by BOTH the authoring emitter and the
// recon fold so the review event can always be mapped back to its obligation,
// even for the legacy rows whose adopted `urn` is still `[TBD]`/empty.
//
// Precedence: the obligation's own canonical urn when populated; otherwise a
// deterministic id-derived fallback (the same shape the review-status recon's
// markdown parser already synthesises for `[TBD]` rows). The urn is normalised:
// surrounding back-ticks are stripped (the seed wraps some urns in `…`).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

/** Strip wrapping back-ticks/whitespace the seed sometimes adds to a urn cell. */
export function normaliseUrn(urn: string | undefined): string {
  return (urn ?? "").replace(/`/g, "").trim();
}

/** True when a urn is absent or the `[TBD]` placeholder. */
export function isPlaceholderUrn(urn: string | undefined): boolean {
  const u = normaliseUrn(urn);
  return u === "" || u === "[TBD]" || /\[TBD\]/.test(u);
}

/**
 * The stable `obligationUrn` for review-event purposes:
 *   - the obligation's canonical urn when populated (back-ticks stripped);
 *   - else `urn:obligation:bank:<id-lowercased>` — deterministic, id-derived.
 */
export function reviewUrnForObligation(id: string, urn: string | undefined): string {
  if (isPlaceholderUrn(urn)) return `urn:obligation:bank:${id.toLowerCase()}`;
  return normaliseUrn(urn);
}
