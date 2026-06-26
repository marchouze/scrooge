// platform/recon/fx-fair-value-hierarchy-integrity.ts
//
// recon:fx-fair-value-hierarchy-integrity — ENFORCING IFRS 13 fair-value-level gate.
//
// THE FINDING IT CLOSES (D-FX-IFRS-REVIEW-FOUNDATION, F6). The FX fair-value
// hierarchy level is DECLARED, not VERIFIED: the FX treatment module carries
// `fairValueHierarchy: "level-2"` and the FX model's `fairValueHierarchy()` returns
// the literal `"level-2"`. Nothing derives the level from the instrument's actual
// valuation inputs, so the historic PR #643 level-1 mis-tag would re-pass any test
// that only asserts `toBe("level-2")` (the literal echoes itself). A consistent-but-
// wrong declaration passes — exactly the failure mode the IFRS-review foundation
// exists to kill (PROC-GOV-ADC-01 §4 — validate against domain truth, not internal
// consistency; Engineering Charter cmd 3 — no green by concealment).
//
// THE INVARIANT. For every FX vanilla instrument the DECLARED IFRS 13 hierarchy
// level — on BOTH the FX model's Accountable facet (`fairValueHierarchy()`) AND the
// FX reporting-treatment module (`ifrs-classification:fx-fvtpl`) — must EQUAL the
// level DERIVED from the observability of the model's actual valuation inputs
// (`requiredObservables()`), per the IFRS 13 §73 lowest-significant-input rule:
//   - an FX spot/forward consumes the spot fixing (+ forward-points curve) — all
//     OBSERVABLE market inputs, none a quoted price for the identical instrument in
//     an active market, none unobservable → IFRS 13 §81 LEVEL 2.
// A declared level-1 (no active-market quote exists for a bespoke OTC forward) or
// level-3 (the inputs ARE observable) is a wrong tag and fails closed. The
// derivation is the oracle `deriveFairValueHierarchyFromObservables`
// (v2-core/fil-models/fx-valuation/fair-value-hierarchy.ts) — the domain truth,
// not a literal.
//
// METHOD. Pure + store-independent: builds a representative FX FORWARD Valuable
// (the input-richest FX case — spot + forward points), derives its level from
// `requiredObservables()`, and asserts the two declared levels match. A spot-only
// FX position derives the SAME level (a fixing is still an observable market input),
// asserted as a second case so the gate is non-vacuous and covers both shapes.
//
// CLEAN-STORE BEHAVIOUR: store-independent — it reads code declarations, not events,
// so it asserts on every run regardless of seed state (never a silent no-op).
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26, F6); IFRS 13
//   §73/§76/§81/§86; Engineering Charter (fail-closed, no-green-by-concealment,
//   source-don't-hardcode). Principle 2.
// Author: Vera (Internal-audit engineer, third line) — WS-FX-IFRS-REVIEW-FOUNDATION.

import { deriveFairValueHierarchyFromObservables } from "../../v2-core/fil-models/fx-valuation/fair-value-hierarchy";
import { fxAccountable, fxValuable } from "../../v2-core/fil-models/fx-valuation/fx-model";
import type { FairValueHierarchy } from "../../v2-core/reporting-treatments/declaration";
import { FX_TREATMENT_MODULES } from "../../v2-core/reporting-treatments/fx-modules";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-fair-value-hierarchy-integrity";

/** The reporting (functional) currency the representative FX position is valued in. */
const REPORTING = "ZAR";
/** A representative foreign leg — a liquid major pair (USD/ZAR). */
const POSITION_CURRENCY = "USD";

/** The declared fair-value hierarchy on the FX ifrs-classification treatment module. */
function declaredModuleHierarchy(): FairValueHierarchy | undefined {
  const ifrsModule = FX_TREATMENT_MODULES.find((m) => m.category === "ifrs-classification") as
    | { fairValueHierarchy?: FairValueHierarchy }
    | undefined;
  return ifrsModule?.fairValueHierarchy;
}

/**
 * PURE asserter — derives the FX fair-value hierarchy from the model's observable
 * inputs and asserts the two DECLARED levels (model facet + treatment module)
 * match it. Exposed for the injection test (a synthetic declared level can be fed
 * via the `declaredOverride` params).
 */
export function assertFxFairValueHierarchy(opts?: {
  /** Override the FX model's declared level (injection test). */
  modelDeclaredOverride?: FairValueHierarchy;
  /** Override the treatment module's declared level (injection test). */
  moduleDeclaredOverride?: FairValueHierarchy;
}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  try {
    // ----- Derive the level from the model's actual valuation inputs. -----
    // A forward is the input-richest FX shape (spot + forward points); a spot is
    // the minimal shape (spot only). BOTH derive level-2 (every input is an
    // observable market input), so we derive + assert both for non-vacuity.
    const forward = fxValuable({
      currency: POSITION_CURRENCY,
      signedNotional: "7000000.00",
      isForward: true,
      reporting: REPORTING,
    });
    const spot = fxValuable({
      currency: POSITION_CURRENCY,
      signedNotional: "7000000.00",
      isForward: false,
      reporting: REPORTING,
    });
    const derivedForward = deriveFairValueHierarchyFromObservables(forward.requiredObservables());
    const derivedSpot = deriveFairValueHierarchyFromObservables(spot.requiredObservables());

    result.asserted += 1;
    if (derivedForward !== derivedSpot) {
      // Defensive: a forward and a spot must derive the same level (both observable
      // market inputs). A divergence is an oracle defect, surfaced loudly.
      violations.push({
        subject: `${PIPELINE}:derivation-inconsistent`,
        message: `FX forward derived "${derivedForward}" but FX spot derived "${derivedSpot}" — both are valued from observable market inputs and must derive the same IFRS 13 level. Oracle defect (deriveFairValueHierarchyFromObservables).`,
        severity: "fail",
      });
    }
    const derived = derivedForward;

    // ----- (1) The FX model's Accountable facet declares the derived level. -----
    result.asserted += 1;
    const modelDeclared = opts?.modelDeclaredOverride ?? fxAccountable().fairValueHierarchy();
    if (modelDeclared !== derived) {
      violations.push({
        subject: `${PIPELINE}:model-declared-mismatch`,
        message: `The FX model's Accountable facet declares fair-value hierarchy "${modelDeclared}", but the level DERIVED from its valuation inputs (spot fixing + forward points — all observable market inputs, IFRS 13 §81) is "${derived}". An FX vanilla forward is Level 2: there is no active-market quote for the bespoke contract (so not Level 1, §76) and no unobservable input (so not Level 3, §86). The declared level must be the derived level (D-FX-IFRS-REVIEW-FOUNDATION, F6).`,
        severity: "fail",
      });
    }

    // ----- (2) The FX treatment module declares the derived level. -----
    result.asserted += 1;
    const moduleDeclared = opts?.moduleDeclaredOverride ?? declaredModuleHierarchy();
    if (moduleDeclared === undefined) {
      violations.push({
        subject: `${PIPELINE}:module-hierarchy-absent`,
        message: `The FX ifrs-classification treatment module ("ifrs-classification:fx-fvtpl") declares no fairValueHierarchy. An FVTPL FX instrument is fair-valued and MUST carry its IFRS 13 hierarchy level (the derived level is "${derived}"). Authority: D-FX-IFRS-REVIEW-FOUNDATION (F6).`,
        severity: "fail",
      });
    } else if (moduleDeclared !== derived) {
      violations.push({
        subject: `${PIPELINE}:module-declared-mismatch`,
        message: `The FX ifrs-classification treatment module declares fair-value hierarchy "${moduleDeclared}", but the level DERIVED from the FX model's valuation inputs is "${derived}" (IFRS 13 §81 — observable market inputs, no active-market quote for the instrument). The module's declared level must be the derived level (D-FX-IFRS-REVIEW-FOUNDATION, F6).`,
        severity: "fail",
      });
    }

    result.asOf = `${PIPELINE}: derived=${derived} (forward=${derivedForward}, spot=${derivedSpot}); model-declared=${modelDeclared}; module-declared=${moduleDeclared ?? "<absent>"}. ${
      violations.some((v) => v.severity === "fail")
        ? "HIERARCHY-MISMATCH"
        : "declared IFRS 13 level matches the level derived from observable valuation inputs"
    }.`;
  } catch (err) {
    violations.push({
      subject: `${PIPELINE}:error`,
      message: `FX fair-value hierarchy assertion threw: ${err instanceof Error ? err.message : String(err)}.`,
      severity: "fail",
    });
    result.asserted += 1;
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

/** Thin store-independent wrapper over the pure asserter (reads the live declarations). */
export function run(): ReconResult {
  return assertFxFairValueHierarchy();
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
