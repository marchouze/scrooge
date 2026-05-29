// platform/types/financial-input.ts
//
// FinancialInput<T> — the "no silent zero" primitive (objective 4 of
// D-TRUSTED-FIGURES-PROGRAM-V1). A financial figure is computed from inputs
// that are either *present* (a value with lineage) or *absent* (a reason +
// where it was expected from). Code must never collapse an absent input to 0
// with `?? 0` / `|| 0` / `: 0`: a missing required input makes the output
// "value unavailable", surfaced loudly, never a number that looks real.
//
// This complements the calculation-history axis: calc engines propagate
// absence into CalculationPerformed.status = "degraded" | "failed" +
// missingInputs (see model-registry/calculation-emit.ts) instead of zero-ing.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (Core banking platform architect, engineering).

/** A present financial input: a resolved value with its lineage. */
export interface PresentInput<T> {
  readonly present: true;
  readonly value: T;
  /** Where the value came from (event type / source lineage / upstream model). */
  readonly lineage: string;
}

/** An absent financial input: why it is missing and where it should come from. */
export interface AbsentInput {
  readonly present: false;
  /** Why the input could not be resolved. */
  readonly reason: string;
  /** Where the input was expected to come from (so the gap can be chased). */
  readonly expectedFrom: string;
}

/**
 * A financial input is present (with lineage) or absent (with a reason).
 * There is no third "zero" state — absence is modelled explicitly so it can
 * never be silently coerced into a real-looking number.
 */
export type FinancialInput<T> = PresentInput<T> | AbsentInput;

/** Construct a present input. */
export function present<T>(value: T, lineage: string): PresentInput<T> {
  return { present: true, value, lineage };
}

/** Construct an absent input. */
export function absent(reason: string, expectedFrom: string): AbsentInput {
  return { present: false, reason, expectedFrom };
}

/** Type guard: the input resolved to a value. */
export function isPresent<T>(input: FinancialInput<T>): input is PresentInput<T> {
  return input.present;
}

/**
 * Read a present value or throw a descriptive error. Use only when the caller
 * has already asserted presence (e.g. status is `ok`); prefer branching on
 * `isPresent` so absence flows into a degraded/failed figure rather than a throw.
 */
export function requireValue<T>(input: FinancialInput<T>): T {
  if (!input.present) {
    throw new Error(
      `financial-input: required value absent (${input.reason}; expected from ${input.expectedFrom})`,
    );
  }
  return input.value;
}

/**
 * Loud table lookup — the structural replacement for `table[key] ?? default`
 * on a *financial weight* table. A key that is absent from the table is a
 * data-integrity fault (registry/union drift, or corrupt external data), not
 * an excuse to silently weight a position at the default. It throws with the
 * offending key and table name so the failure is loud, never a wrong figure
 * derived from a 0% / 100% guess.
 */
export function requireWeight(
  table: Readonly<Record<string, number>>,
  key: string,
  tableLabel: string,
): number {
  const weight = table[key];
  if (weight === undefined) {
    throw new Error(
      `${tableLabel}: no weight for category "${key}" — the figure cannot be derived from an unknown category (a silent 0/100% default would produce a wrong regulatory number). Add the category to the financial-constants registry or correct the input data.`,
    );
  }
  return weight;
}
