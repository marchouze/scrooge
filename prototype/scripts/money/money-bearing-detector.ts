// scripts/money/money-bearing-detector.ts
//
// Structural "is this event type money-bearing?" detector, shared by the
// slice-4 purge classifier (its fail-closed guard) and the Wave-1 test.
//
// WHY THIS EXISTS
// ---------------
// The slice-4 config-only purge is an ALLOW-LIST keyed on
// `categoryForEventType`. A money-bearing transactional type that is
// UNCATEGORISED (returns <none>) was silently routed to the RETAIN bucket —
// which is how 496 financial-transaction events survived the purge (PR #1325).
// A purge must FAIL CLOSED on unknown-but-money-bearing types, not retain them.
//
// "Money-bearing" is derived STRUCTURALLY from a payload (a legacy `*Minor`
// numeric key OR a `__money`/MoneyWire field at any depth) — never a hard-coded
// denylist — so new money-bearing types are caught automatically.
//
// Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION (CEO-approved 2026-06-14, be0580ff).
// Brief: brief:atlas:wave-1-close-purge-classifier-gap-make-residual-:2026-06-14.
// Author: Atlas (Core banking platform architect, engineering)

/**
 * True iff the payload carries money anywhere: a legacy integer `*Minor` field
 * (key ends in "Minor", value is a number) OR a MoneyWire marker
 * (`{ __money: "v1", ... }`). Recurses through objects and arrays.
 */
export function isMoneyBearingPayload(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(isMoneyBearingPayload);
  const record = value as Record<string, unknown>;
  // MoneyWire marker.
  if (typeof record.__money === "string") return true;
  for (const key of Object.keys(record)) {
    const child = record[key];
    // Legacy minor-unit encoding: key ends in "Minor" with a numeric value.
    // A string field ending in "Minor" is NOT money (could be a naming
    // coincidence), matching the residual-minor gate's own rule.
    if (key.endsWith("Minor") && typeof child === "number") return true;
    if (isMoneyBearingPayload(child)) return true;
  }
  return false;
}

/** Minimal read interface — sample one representative payload per event type. */
export interface SamplePayloadSource {
  /** Returns a sample payload JSON string for the type, or undefined if none. */
  samplePayload(eventType: string): string | undefined;
}

/**
 * Given the distinct event types in a store and a category resolver, return the
 * types that carry money but resolve to NO provenance category. A purge keyed
 * on the category allow-list must abort (fail closed) when this is non-empty,
 * rather than silently retaining (orphaning) these events.
 */
export function findUncategorisedMoneyTypes(
  allTypes: readonly string[],
  source: SamplePayloadSource,
  categoryFor: (eventType: string) => string | undefined,
): string[] {
  return allTypes.filter((t) => {
    if (categoryFor(t) !== undefined) return false;
    const raw = source.samplePayload(t);
    if (!raw) return false;
    try {
      return isMoneyBearingPayload(JSON.parse(raw));
    } catch {
      return false;
    }
  });
}
