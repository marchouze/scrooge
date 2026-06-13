// scripts/file-nadia-v2-a2-fx-model-validation.ts
//
// Independent model-risk validation of the v2 FX `Valuable` + FCY-cash
// FIL-Models (V2 A2), by Nadia (Independent model-validation engineer, second
// line) — a distinct plane from implementation (Atlas (Core banking platform
// architect, engineering) / Bea (Accounting & financial reporting engineer,
// engineering)). Brief
// `brief:nadia:independent-validation-fx-valuable-fil-model-a4-:2026-06-13`;
// authority D-FIL-ATTRIBUTION-A1-BUILD, D-MODEL-BINDING-CONTRACT-V1.
//
// VERDICT: VALIDATED-WITH-CONDITIONS — RESTRICT-TO-VALIDATED-ENVELOPE.
// The mark-to-market methodology (value = signedNotional × all-in rate, half-
// away-from-zero, 2dp-cancels translation) is FAITHFUL and independently
// reproduced byte-for-byte by the validator's own challenger. The settlement-
// continuity invariant is STRUCTURAL and holds (incl. for JPY). The model is
// APPROVED for the FVTPL FX-trading-book cutover — within an envelope that
// EXCLUDES non-2dp-consistent currency feeds (the JPY 0-dp gap is dormant on the
// 2dp-consistent anchor book but is a live trap for any other feed). The A4
// cutover is CONDITIONALLY CLEARED on the conditions below.
//
// Emits, in order, Principle-1 typed events:
//   1. ValidationFindingRaised × 4 (the envelope restriction + the A4 conditions);
//   2. one ModelValidationApproved (verdict — submitted → approved, restricted
//      envelope recorded in the report + finding MV-FX-A2-001);
//   3. one RecordFiled (the validation report in the Documents register).
//
// Idempotent — skips if the validation record is already filed.
//
// Author: Nadia (Independent model-validation engineer, second line).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import {
  makeModelValidationApproved,
  makeValidationFindingRaised,
} from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:v2-a2-fx-model-validation:2026-06-13";
const MODEL_ID = "fx-valuation";
const MODEL_VERSION = "1.0";
const ENTITY = String(BANK_ZA_001);

const ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const CITATIONS = [
  "D-FIL-ATTRIBUTION-A1-BUILD",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ias-21:§28",
  "urn:reg:iasb:ifrs-9:§4.1.4",
  "SR-11-7",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-nadia-v2-a2-fx-model-validation] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Findings — one envelope restriction (MV-FX-A2-001) + three A4 conditions.
// None is a defect in the A2 MODEL METHODOLOGY; they bound the validated
// ENVELOPE and gate the A4 GL cutover.
// ---------------------------------------------------------------------------

const FINDINGS: Array<{
  findingId: string;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
}> = [
  {
    findingId: "MV-FX-A2-001",
    severity: "high",
    description:
      "ENVELOPE RESTRICTION (non-2dp currency): the methodology kernel pins dp=2 and translates " +
      "signedNotionalMinor × allInRate assuming both legs are 2dp (the 2dp scale cancels). For a 0-dp ISO " +
      "currency (JPY), the value is correct ONLY IF the JPY notional is fed as 2dp-MINOR units consistently " +
      "(as the v1 anchor book does, for byte-parity). The validator independently CONFIRMED (challenger test " +
      "'DOCUMENTED ERROR SURFACE') that a whole-yen (ISO-correct 0-dp) feed would understate the ZAR value " +
      "exactly 100×. The gap is DORMANT on the current anchor book (2dp-consistent) — JPY valuation there is " +
      "CORRECT — but it is a live trap. VALIDATED ENVELOPE: 2dp-consistent currency feeds only. Any feed that " +
      "is not 2dp-consistent (a real 0-dp JPY balance feed, or any other non-2dp currency) is OUTSIDE the " +
      "validated envelope until the named dp-aware refinement lands. NOTE: settlement-continuity is UNAFFECTED " +
      "by this (the dp convention cancels identically on both sides of the boundary — proven over a JPY rate sweep).",
  },
  {
    findingId: "MV-FX-A2-002",
    severity: "high",
    description:
      "A4-BLOCKING (value-vs-P&L semantics): the v2 Valuable computes GROSS translated position value " +
      "(signedNotional × allInRate). The v1 path A4 retires (runEodFxRevaluation, platform/markets/eod/" +
      "fx-revaluation.ts) emits a P&L DELTA (notionalBase × (revalRate − bookRate)) and the GL posting (PR-FX-" +
      "LIFECYCLE-CLOSE) posts a realised-P&L RESIDUAL, not a gross value. These are DIFFERENT quantities. A2 " +
      "only DECLARES the Accountable posting KEYS; it does not wire GL. CONDITION: A4 must, in its posting layer, " +
      "derive the period FVTPL P&L as a DELTA of successive gross Valuable values (Δvalue), NOT post the gross " +
      "value as if it were P&L. Failing to do so would double-count or mis-state FX P&L at cutover. The validator " +
      "must re-review the A4 posting wiring before the GL cutover is cleared (this validation covers the A2 model, " +
      "not the A4 posting engine, which does not yet exist).",
  },
  {
    findingId: "MV-FX-A2-003",
    severity: "medium",
    description:
      "EVIDENCE CAVEAT (recon:fx-book-nop-parity is non-independent): the gate builds its v2 book members FROM " +
      "the SAME deriveNetFxPositionByCurrency fold it then reconciles AGAINST (buildFxTradingBookMembers consumes " +
      "the fold output; the comparison target is the same map). delta=0 is therefore TAUTOLOGICAL with respect to " +
      "the NOP basis: it proves the v2 attribution PLUMBING (member projection → fx-pnl metric → evaluateSlice " +
      "engine path) faithfully reproduces the numbers it was handed, and WOULD catch a real attribution-engine " +
      "defect (wrong sum, dropped member, cross-currency mix) — but it CANNOT detect an error in the NOP fold " +
      "itself, because both sides originate there. The cutover justification 'parity=0 ⇒ v2 == standing-NOP/VaR " +
      "book' is SOUND in the narrow plumbing sense and CAVEATED, not circular-and-worthless. CONDITION: do not " +
      "represent parity=0 as independent confirmation of the NOP basis; the NOP fold's own correctness rests on " +
      "the separate B3/VaR validation (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP), not on this gate.",
  },
  {
    findingId: "MV-FX-A2-004",
    severity: "medium",
    description:
      "ONGOING-MONITORING REQUIREMENT (post-cutover backtest): once A4 makes v2 the FX source-of-record, a " +
      "backtest/parallel-run must run v1 (runEodFxRevaluation) and v2 (Δ gross Valuable value) side-by-side over " +
      "a soak window and reconcile daily FX P&L to within rounding tolerance, with any divergence dispositioned " +
      "(BacktestRun / BacktestBreachDisposed). The methodologyHash (computeFxMethodologyHash) is the drift anchor: " +
      "any change to the load-bearing constants (reporting currency, rounding, value formula, dp) re-opens " +
      "validation (D-MODEL-BINDING-CONTRACT-V1 §3). Re-validation cadence: annual (SR-11-7) or on hash change.",
  },
];

for (const f of FINDINGS) {
  const ev = makeValidationFindingRaised({
    asOf: clock.now(),
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      findingId: f.findingId,
      modelId: MODEL_ID,
      raisedBy: "Nadia (Independent model-validation engineer, second line)",
      severity: f.severity,
      description: f.description,
    },
  });
  eventStore.append(ev);
  console.log(`[finding] ${f.findingId} (${f.severity}) ${ev.event_id}`);
}

// ---------------------------------------------------------------------------
// The verdict — ModelValidationApproved (submitted → approved). The A2 model
// METHODOLOGY is validated with NO open methodology defects; the findings above
// are an ENVELOPE RESTRICTION + A4 cutover conditions, tracked open (not resolved
// at sign-off). The restricted envelope is recorded in the report body and in
// MV-FX-A2-001. expiryDate sets the periodic re-validation horizon (SR-11-7).
// ---------------------------------------------------------------------------

const approval = makeModelValidationApproved({
  asOf: clock.now(),
  entity: ENTITY,
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    modelId: MODEL_ID,
    version: MODEL_VERSION,
    approvedBy: "Nadia (Independent model-validation engineer, second line)",
    // No methodology defects to resolve — the kernel is clean and independently
    // reproduced. The open findings are the validated-envelope restriction
    // (MV-FX-A2-001) + the A4 conditions (002/003/004); they are tracked open
    // and gate the FLIP / the non-2dp envelope, not the A2 model methodology.
    validationFindingsResolved: [],
    expiryDate: "2027-06-13",
  },
});
eventStore.append(approval);
console.log(
  `[verdict] ModelValidationApproved (validated-with-conditions, restricted envelope) ${approval.event_id}`,
);

// ---------------------------------------------------------------------------
// The validation report — RecordFiled, Documents register.
// ---------------------------------------------------------------------------

const body = `# Independent model validation — v2 FX \`Valuable\` + FCY-cash FIL-Models (A2)

**Validator:** Nadia (Independent model-validation engineer, second line) — independent of implementation (Atlas (Core banking platform architect, engineering) / Bea (Accounting & financial reporting engineer, engineering)).
**Date:** 2026-06-13
**Model:** \`fx-valuation\` v1.0 (FX spot/forward \`Valuable\` + \`Accountable\`) and \`fcy-cash\` v1.0 (monetary \`Valuable\` + \`Accountable\`) — the SECOND cross-package FIL-Model after SA-CCR. Methodology hash \`computeFxMethodologyHash\` (FNV-1a over version + load-bearing constants).
**Brief:** \`brief:nadia:independent-validation-fx-valuable-fil-model-a4-:2026-06-13\` (WS-V2-BBAAS).
**Authority:** D-FIL-ATTRIBUTION-A1-BUILD (A2 build slice); D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION.
**Verdict event:** \`ModelValidationApproved\` — \`fx-valuation\` v1.0, \`submitted → validation-approved\` (restricted envelope).

---

## VERDICT: VALIDATED-WITH-CONDITIONS — RESTRICT-TO-VALIDATED-ENVELOPE; A4 conditionally cleared

The A2 FX mark-to-market methodology is **faithful** and was **independently reproduced byte-for-byte** by the validator's own from-scratch challenger (\`nadia-validation-challenger.test.ts\` — a different arithmetic path, 18 cases). The settlement-continuity invariant is **structural and holds** (incl. for JPY). The model is **APPROVED for the FVTPL FX-trading-book cutover (A4)** within a **restricted validated envelope** and on the conditions below.

**Validated envelope (MV-FX-A2-001):** 2dp-consistent currency feeds only. JPY (and any non-2dp ISO currency) is in-envelope ONLY while fed as 2dp-minor units consistently (as the v1 anchor book does). A genuine 0-dp / non-2dp-consistent feed is **outside** the validated envelope until the named dp-aware refinement lands.

A validation that separates "the model arithmetic is correct" (it is) from "the cutover is safe to execute as-is" (conditional) is the substance of second-line independence here.

---

## 1. Methodology fidelity — FAITHFUL (independently reproduced)

Read independently against \`v2-core/fil-models/fx-valuation/methodology.ts\` + \`fx-model.ts\` + \`fcy-cash-model.ts\`:

- **Valuation kernel:** \`value = signedNotionalMinor × allInRate\`, rounded **half-away-from-zero** to a whole minor unit; the 2dp minor-unit scale cancels (CCY cents × ZAR/CCY ⇒ ZAR cents). The reporting-currency leg is its own value at rate 1. The validator re-implemented this with a **deliberately different code path** (longhand sign/magnitude rounding from \`Math\` primitives, no import of the model's \`scaleMinorByRate\`) and matched the model **to the cent** over a 7-case sweep including negatives, a 1-minor-unit edge, and a 7.78m-unit case.
- **All-in rate:** spot for a spot position; \`spot + forward-points\` for a forward (additive, v2-native convention). Missing forward points default to zero (spot-only all-in). A missing **spot** observable for a non-reporting currency is a **hard error** (no silent zero) — independently confirmed.
- **Sensitivity:** value is **linear in rate** (2×/3× confirmed) and **linear in notional** (3× confirmed) — the correct behaviour for a single-multiply mark-to-market.
- **Lifecycle-free:** \`value(marks, asOf)\` takes no lifecycle/stage argument — the structural root of settlement continuity (§2).
- **FCY-cash:** value = balance × closing rate (IAS-21 §23 monetary-item retranslation), recognised at the derecognised receivable's **settlement-date carrying amount** (the same notional carried forward, not a trade-date cost). Confirmed: same kernel, same arithmetic.

**Limitations (faithful to v1, documented — not defects):** dp=2 pin (MV-FX-A2-001); hedge-accounting designation deferred (does NOT affect the FVTPL trading book being cut over — see §4); forward-points are a single additive observable (no term-structure curve in A2 scope).

## 2. Settlement-continuity invariant — STRUCTURAL, HOLDS

The invariant (value_pre of the FX position == value_post of the FCY cash, at the settlement-date rate) is **structural**: \`value()\` has no lifecycle branch, and the FCY cash carries the **same notional**, so both sides are \`notional × settlement-date-rate\` by construction. Independently confirmed over a rate sweep, **including JPY** (§3). \`recon:fx-settlement-continuity\` ran GREEN with **5 structural cases + 16 settled FX instances** checked in the anchor store (a non-vacuous history proof). Sound.

## 3. JPY non-2dp deferred gap (named A2 gap a) — REAL, BOUNDED, DORMANT; envelope-restricted

JPY is a 0-dp ISO currency; the v1 FX book carries it as 2dp-minor and the kernel pins dp=2. The validator:
- **Confirmed JPY valuation is CORRECT on the anchor book** — because the JPY notional is fed as 2dp-minor consistently, the 2dp scale cancels identically on both the JPY leg and the ZAR result. The live anchor-book JPY net position (~−19.6m JPY, short) values correctly.
- **Quantified the error surface:** a whole-yen (ISO-correct 0-dp) feed into the same field would understate the ZAR value **exactly 100×** (challenger test 'DOCUMENTED ERROR SURFACE'). The gap is a **unit-label** issue, not an arithmetic one.
- **Proved settlement continuity is UNAFFECTED** by the deferral — the dp convention cancels on both sides of the settlement boundary (JPY rate sweep).

**Disposition:** the gap is dormant on the 2dp-consistent anchor book, so the cutover is not blocked by it; but the validated envelope **excludes** non-2dp-consistent feeds (MV-FX-A2-001).

## 4. Hedge-accounting deferral (named A2 gap b) — DOES NOT affect the FVTPL cutover

The \`Accountable\` facet returns **FVTPL** for the FX trading book (IFRS-9 §4.1.4 — held-for-trading). Hedge-accounting designation (which would change the category) is a named A2 gap. The book A4 cuts over is the **FVTPL trading book**; hedge-designated FX is out of scope. The deferral therefore **does not affect** the cutover population: confirmed that the trading-book designation → FVTPL path is correct and self-contained. No condition arises from this gap for the trading-book cutover (it WILL matter when hedge-designated FX enters scope — re-validate then).

## 5. Build-time evidence — parity gates assessed

- **\`recon:fx-settlement-continuity\` — SOUND, non-vacuous.** Proves value_pre == value_post both structurally (rate sweep) and over history (16 settled FX instances). Not circular: a model drift between the FX-position and FCY-cash Valuables WOULD surface. Green.
- **\`recon:fx-book-nop-parity\` — SOUND-BUT-CAVEATED (NOT independent of the NOP basis), MV-FX-A2-003.** The gate builds its v2 book members FROM the same \`deriveNetFxPositionByCurrency\` fold it then reconciles against. \`delta=0\` is **tautological w.r.t. the NOP basis**: it proves the v2 attribution **plumbing** (member projection → \`fx-pnl\` metric → \`evaluateSlice\`) faithfully reproduces the fold, and WOULD catch a real attribution-engine defect — but it **cannot** detect an error in the NOP fold itself (both sides originate there). Against the canonical store the gate reported **5 currencies, delta=0**. The cutover justification "parity=0 ⇒ v2 == standing-NOP/VaR book" is therefore sound in the **plumbing** sense and **caveated**, not circular-and-worthless. The NOP fold's own correctness rests on the separate B3/VaR validation (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP), not on this gate.

## 6. Value-vs-P&L semantics (A4 condition MV-FX-A2-002)

The v2 Valuable returns **gross translated value**; the v1 path A4 retires emits a **P&L delta**, and the GL posting (PR-FX-LIFECYCLE-CLOSE) posts a **realised-P&L residual**. These are different quantities. A2 only DECLARES the Accountable posting KEYS — it does not wire GL. **A4 must derive period FVTPL P&L as Δ(gross Valuable value), not post the gross value as P&L**, or it will mis-state FX P&L at cutover. This is a CONDITION on A4 and requires a validator re-review of the A4 posting wiring (out of A2 scope — that engine does not yet exist).

## 7. Backtest / ongoing monitoring (MV-FX-A2-004)

Post-cutover: parallel-run v1 vs v2 daily FX P&L over a soak window, reconcile to rounding tolerance, disposition divergences (\`BacktestRun\` / \`BacktestBreachDisposed\`). \`methodologyHash\` is the drift anchor — any change to the load-bearing constants re-opens validation (D-MODEL-BINDING-CONTRACT-V1 §3). Re-validation: annual (SR-11-7), expiry 2027-06-13, or sooner on a hash change.

## 8. Conditions summary

**Restricted validated envelope:** 2dp-consistent currency feeds only (MV-FX-A2-001, high).
**A4 cutover conditions (blocking the GL cutover, not the A2 model):**
- MV-FX-A2-002 (high): A4 posting layer must derive P&L as Δ(gross value), not post gross value as P&L; validator re-review of A4 wiring required.
- MV-FX-A2-003 (medium): do not represent \`recon:fx-book-nop-parity\` = 0 as independent confirmation of the NOP basis.
- MV-FX-A2-004 (medium): post-cutover backtest / parallel-run + drift-anchor monitoring.

**A4 is CONDITIONALLY CLEARED** for the FVTPL FX-trading-book cutover within the 2dp-consistent envelope, subject to the A4 posting re-review (MV-FX-A2-002). It is **NOT** cleared for non-2dp-consistent feeds, and **NOT** cleared to post gross value as P&L.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    supersedes: undefined,
    citations: CITATIONS,
    actor: ACTOR,
    entity: ENTITY,
    metadata: {
      title: "Independent model validation — v2 FX Valuable + FCY-cash FIL-Models (A2)",
      path: "2026-06-13_nadia_v2-a2-fx-model-validation.md",
      category: "model-validation",
      author: "Nadia (Independent model-validation engineer, second line)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: "validated-with-conditions (restrict-to-validated-envelope)",
      validatedEnvelope: "FVTPL FX-trading book, 2dp-consistent currency feeds only",
      a4Cleared: "conditional (MV-FX-A2-002 A4 posting re-review; envelope excludes non-2dp feeds)",
      validationEventId: approval.event_id,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
