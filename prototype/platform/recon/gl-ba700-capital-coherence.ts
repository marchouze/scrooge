// platform/recon/gl-ba700-capital-coherence.ts
//
// recon:gl-ba700-capital-coherence — the STANDING fail-closed gate proving the
// V2 General Ledger Share Capital balance and the BA-700 capital-composition CET1
// paid-up-ordinary-shares numerator are two coherent renders of the SAME capital
// FIL events, OVER THE LIVE EVENT STORE, under BOTH provenance lenses.
//
// ## Why this exists (closes the coherence-only-in-a-unit-test gap)
//
// Under D-V2-UI-VISIBILITY-REMEDIATION the capital fold-through
// (`accounting/posting-rules-v2/capital-fold.ts`) makes the V2 trial balance fold
// the capital FIL instances, so `computeTrialBalanceV2` now shows the R300m CET1
// injection on `ACC-5000-001` (Share Capital). The BA-700 own-funds view
// (`projections/ba700-capital-composition.ts`) folds the SAME capital FIL events
// into its CET1 `cet1.paid-up-ordinary-shares` numerator. The two views derive the
// same economic fact via the same lifted capital posting rules — so under any one
// provenance lens they MUST agree.
//
// That agreement was proven ONLY by a unit test (`capital-fold.test.ts`) over an
// in-memory store. This gate makes the coherence a STANDING assertion over the
// live event store the dashboard + parity gates read (composition.eventStore,
// V2_ANCHOR_ENTITY, V2 read window) — the same (store, entity, window) the
// dashboard capital surface (`buildCapitalView`) and `recon:gl-v2-parity` use, so
// there is no drift between what is surfaced and what is proven.
//
// ## The invariant (FAIL-CLOSED)
//
// For EACH provenance lens ∈ { production-only, combined }:
//
//   −(V2 trial-balance amountMinor for ACC-5000-001)        ← GL credit balance
//        ==
//   Σ (BA-700 composition lines with subCategory            ← BA-700 numerator
//      "cet1.paid-up-ordinary-shares").amountMinor
//
// Both sides apply the SAME explicit `ProvenanceFilter`, so:
//   - `production-only` excludes the simulated R300m injection → both sides 0
//     (the honest empty pre-licence state; 0 == 0 still asserted, never skipped).
//   - `combined` admits the injection → both sides R300,000,000.
//
// A divergence means a stray GL posting reached the Share Capital account WITHOUT
// going through the capital fold (e.g. a hand-authored GlPostingEmitted to
// ACC-5000-001), or the capital fold silently stopped contributing to one view but
// not the other. Either is a Principle-1 incoherence — fail-closed (Charter cmd 2).
//
// ## Non-vacuity (MV-CAP-COH-001)
//
// The CLI / on-store path REQUIRES the +Sim (combined) lens to fold a NON-ZERO
// paid-up CET1 numerator (the R300m injection, emitted by ci:migrate's
// `capital:emit-injection-v2-sim`). A zero there means the capital fold produced
// nothing and the equality proof is vacuous (0 == 0); fail-closed — mirroring the
// MV-CAP-001 guard in `recon:capital-materialisation-integrity`.
//
// READ-ONLY: pure folds over the event store; no events written (Principle 1).
//
// BOUNDARY: V1-SIDE recon infrastructure (`platform/`). MAY import from
// `v2-core/` + `platform/projections` (the permitted v1→v2 direction).
//
// Authority: D-V2-UI-VISIBILITY-REMEDIATION (CEO 2026-06-22) under
//   D-V2-UI-OVERSIGHT-STANDARD; D-CAPITAL-ASSET-CLASS-V1;
//   D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-ENGINEERING-INTEGRITY-CHARTER
//   (fail-closed); Reg 38; Banks Act §70; BCBS RBC20.2; D5/2025 §2.1.3 (form BA 100);
//   Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../event-store/store";
import { computeCapitalComposition } from "../projections/ba700-capital-composition";
import type { ProvenanceFilter } from "../projections/filter";
import { computeTrialBalanceV2Uncached } from "../projections/gl-projection-v2";
import { V2_ANCHOR_ENTITY, V2_PERIOD_END, V2_PERIOD_START } from "../projections/v2-read-window";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "gl-ba700-capital-coherence";

/** CET1 paid-up ordinary share-capital own-funds account (per chart of accounts). */
const SHARE_CAPITAL_ACCOUNT = "ACC-5000-001";
/** The BA-700 composition sub-category ACC-5000-001 renders the GL side of. */
const PAID_UP_SUBCATEGORY = "cet1.paid-up-ordinary-shares";

/** The two provenance lenses the coherence MUST hold under. */
const LENSES: readonly ProvenanceFilter[] = [{ mode: "production-only" }, { mode: "combined" }];

export interface RunOpts {
  /** The event store to fold over (the live composition store on the CLI path). */
  readonly eventStore: EventStore;
  /** Anchor entity. Defaults to V2_ANCHOR_ENTITY. */
  readonly entity?: string;
  /** Fold window lower bound (ISO date). Defaults to V2_PERIOD_START. */
  readonly periodStart?: string;
  /** Fold window upper bound (ISO date). Defaults to V2_PERIOD_END. */
  readonly periodEnd?: string;
  /** Functional currency the composition is rolled up in. Defaults to ZAR (anchor). */
  readonly functionalCurrency?: string;
  /**
   * When TRUE (the CLI / on-store path), the +Sim (combined) lens MUST fold a
   * non-zero paid-up CET1 numerator (fail-closed vacuity guard — MV-CAP-COH-001).
   * When FALSE (unit tests probing a specific fixture), a zero combined numerator
   * is allowed (the equality is still asserted). Defaults to FALSE.
   */
  readonly requireNonVacuousCombined?: boolean;
}

export function run(opts: RunOpts): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const entity = opts.entity ?? V2_ANCHOR_ENTITY;
  const periodStart = opts.periodStart ?? V2_PERIOD_START;
  const periodEnd = opts.periodEnd ?? V2_PERIOD_END;
  // ZAR is the build-phase anchor functional currency; the composition rolls up in
  // it (a leg in a different currency is excluded — licence-day refinement).
  const functionalCurrency = opts.functionalCurrency ?? "ZAR";

  let combinedPaidUpMinor = 0;

  for (const filter of LENSES) {
    // (1) GL ⇿ BA-700 equality under this lens.
    result.asserted += 1;

    let glShareCapitalCreditMinor: number;
    let compositionPaidUpMinor: number;
    try {
      // GL side — the V2 trial balance Share Capital credit balance. The fold
      // stores credit balances as NEGATIVE amountMinor, so the credit magnitude is
      // the negation. An absent row is a zero balance (honest empty state).
      const tb = computeTrialBalanceV2Uncached({
        eventStore: opts.eventStore,
        entity,
        periodStart,
        periodEnd,
        filter,
      });
      const shareCapitalRow = tb.rows.find((r) => r.leafAccountId === SHARE_CAPITAL_ACCOUNT);
      glShareCapitalCreditMinor = -(shareCapitalRow?.amountMinor ?? 0);

      // BA-700 side — the capital-composition CET1 paid-up-ordinary-shares
      // numerator (credit-positive own-funds stock) under the SAME lens.
      const composition = computeCapitalComposition({
        eventStore: opts.eventStore,
        entity,
        asOf: periodEnd,
        functionalCurrency,
        filter,
      });
      compositionPaidUpMinor = composition.lines
        .filter((l) => l.subCategory === PAID_UP_SUBCATEGORY)
        .reduce((sum, l) => sum + l.amountMinor, 0);
    } catch (err) {
      violations.push({
        subject: `gl-ba700-capital-coherence:fold-error:${filter.mode}`,
        message: `the GL or BA-700 capital fold threw under the ${filter.mode} lens (a tier / account resolution likely failed closed): ${
          err instanceof Error ? err.message : String(err)
        }. Inspect the capital FIL events in the store. Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-CAPITAL-ASSET-CLASS-V1.`,
        severity: "fail",
      });
      continue;
    }

    if (filter.mode === "combined") combinedPaidUpMinor = compositionPaidUpMinor;

    if (glShareCapitalCreditMinor !== compositionPaidUpMinor) {
      violations.push({
        subject: `gl-ba700-capital-coherence:divergence:${filter.mode}`,
        message: `Under the ${filter.mode} lens the V2 GL Share Capital (${SHARE_CAPITAL_ACCOUNT}) credit balance (${glShareCapitalCreditMinor} minor) does NOT equal the BA-700 capital-composition CET1 ${PAID_UP_SUBCATEGORY} numerator (${compositionPaidUpMinor} minor). Both views fold the SAME capital FIL events through the same lifted capital posting rules — a divergence means a stray GL posting reached ${SHARE_CAPITAL_ACCOUNT} without going through the capital fold (e.g. a hand-authored GlPostingEmitted), or the fold stopped contributing to one view. Fail-closed (Principle 1; D-V2-UI-VISIBILITY-REMEDIATION; D-CAPITAL-ASSET-CLASS-V1).`,
        severity: "fail",
      });
    }
  }

  // (2) Non-vacuity guard — the +Sim lens must fold a non-zero paid-up numerator
  // (MV-CAP-COH-001), else the equality above is a vacuous 0 == 0.
  if (opts.requireNonVacuousCombined) {
    result.asserted += 1;
    if (combinedPaidUpMinor === 0) {
      violations.push({
        subject: "gl-ba700-capital-coherence:vacuous-combined-lens",
        message: `VACUOUS coherence proof: under the +Sim (combined) lens the BA-700 CET1 ${PAID_UP_SUBCATEGORY} numerator is zero — no capital instruments folded over the live store (entity ${entity}, window ${periodStart}..${periodEnd}). The gate asserted nothing (0 == 0). Fail-closed (MV-CAP-COH-001): ci:migrate must emit the capital injection (capital:emit-injection-v2-sim). Authority: D-V2-UI-VISIBILITY-REMEDIATION; D-CAPITAL-ASSET-CLASS-V1.`,
        severity: "fail",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `gl-ba700-capital-coherence: ${SHARE_CAPITAL_ACCOUNT} GL credit == BA-700 ${PAID_UP_SUBCATEGORY} numerator under production-only + combined lenses; +Sim paid-up = ${combinedPaidUpMinor} minor.`;
  return result;
}

if (import.meta.main) {
  // CLI path — fold over the live composition event store, fail-closed on a
  // vacuous +Sim lens (the R300m injection must be present, per ci:migrate).
  const { eventStore } = await import("../composition");
  const r = run({ eventStore, requireNonVacuousCombined: true });
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
