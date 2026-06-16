// v2-core/fil-models/fx-valuation/reporting-currency-resolver.ts
//
// REPORTING-CURRENCY RESOLVER — the IAS-21 functional-currency step.
//
// "Foreign vs. domestic" is a VIEW-TIME comparison between a cash/position
// currency and the FUNCTIONAL currency of the HOLDING entity/branch — never a
// property of an instrument (WS-MULTI-BASE-CURRENCY,
// D-MULTI-BASE-CURRENCY-FOUNDATION). This resolver answers exactly one question:
// "given the entity that holds this position, what currency does it keep its
// books in?" — i.e. what `reporting` currency the FX valuation path values into.
//
// FAIL-CLOSED (Engineering Charter cmd 2; D-ENGINEERING-INTEGRITY-CHARTER): if
// the holding entity's functional currency cannot be resolved, this THROWS. There
// is NO silent "?? ZAR" default — that silent default was the exact debt
// WS-MULTI-BASE-CURRENCY removes (Charter cmd 4 — source, don't hardcode). A
// position whose reporting currency is unresolved cannot be valued; surfacing
// that as a hard error is the correct fail-closed behaviour.
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING). The functional-currency
// LOOKUP is injected by the caller (built from the entity tree / the
// `EntityFunctionalCurrencyAssigned` event projection on the platform side), so
// the v2 core stays free of any `platform/` dependency. The resolver is pure.
//
// Author: Atlas (Core banking platform architect, engineering).

/**
 * A functional-currency lookup: given a holding-entity reference (canonical
 * legal-entity id / `legalEntityRef`), return its functional currency (ISO-4217
 * alpha-3), or `undefined` if the entity is unknown / has no assigned functional
 * currency. Built on the platform side from the entity tree + the
 * `EntityFunctionalCurrencyAssigned` event projection.
 */
export type FunctionalCurrencyLookup = (holdingEntityRef: string) => string | undefined;

/** Build a `FunctionalCurrencyLookup` from a plain entity→currency map. */
export function functionalCurrencyLookupFromMap(
  map: ReadonlyMap<string, string>,
): FunctionalCurrencyLookup {
  return (ref) => map.get(ref);
}

/**
 * Resolve the REPORTING currency (the holding entity's functional currency) for
 * a position. FAIL-CLOSED: throws if the entity ref is missing/empty or the
 * lookup yields no functional currency. NEVER returns a silent default.
 *
 * @param holdingEntityRef canonical legal-entity id of the entity holding the position
 * @param lookup functional-currency lookup (injected; built from the entity tree / events)
 */
export function resolveReportingCurrency(
  holdingEntityRef: string | undefined,
  lookup: FunctionalCurrencyLookup,
): string {
  if (holdingEntityRef === undefined || holdingEntityRef.trim() === "") {
    throw new Error(
      "reporting-currency resolution: missing holding-entity reference — cannot resolve a functional " +
        "currency for the position (fail-closed; no silent ZAR default). WS-MULTI-BASE-CURRENCY.",
    );
  }
  const functional = lookup(holdingEntityRef);
  if (functional === undefined || functional.trim() === "") {
    throw new Error(
      `reporting-currency resolution: holding entity "${holdingEntityRef}" has no assigned functional currency (fail-closed; no silent ZAR default). Emit EntityFunctionalCurrencyAssigned for this entity, or correct the holding-entity reference. WS-MULTI-BASE-CURRENCY.`,
    );
  }
  return functional;
}

/**
 * Fail-closed guard for a reporting currency already carried on a position. The
 * position types make `reporting` REQUIRED, so the absence case is an empty
 * string (a construction defect): throw rather than fall back to a literal. This
 * is the runtime sentinel that replaced every `?? "ZAR"` in the valuation path
 * (WS-MULTI-BASE-CURRENCY; Engineering Charter cmd 2 fail-closed + cmd 4
 * source-don't-hardcode).
 */
export function requireReporting(reporting: string, context: string): string {
  if (reporting === undefined || reporting.trim() === "") {
    throw new Error(
      `${context}: reporting currency is unresolved (empty) — a position must carry its holding entity's functional currency, resolved via resolveReportingCurrency (fail-closed; no silent ZAR default). WS-MULTI-BASE-CURRENCY.`,
    );
  }
  return reporting;
}

/**
 * Resolve the `reporting.currency` POSTURE DIMENSION value for a holding entity.
 * This is the wiring for every FX model's declared
 * `postureDimensions: ["reporting.currency"]`: the posture dimension resolves
 * from the entity tree's functional currency (the same fail-closed resolution),
 * not from a hardcoded literal.
 */
export function resolveReportingCurrencyPostureDimension(args: {
  holdingEntityRef: string | undefined;
  lookup: FunctionalCurrencyLookup;
}): { readonly dimension: "reporting.currency"; readonly value: string } {
  return {
    dimension: "reporting.currency",
    value: resolveReportingCurrency(args.holdingEntityRef, args.lookup),
  };
}
