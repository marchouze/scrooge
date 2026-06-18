// scripts/file-nadia-cash-model-validation.ts
//
// Independent second-line validation of the renamed Cash `Valuable` FIL-Model
// (`cash`, `fil:type:cash:balance:vanilla@1.0`) — by Nadia (Independent-
// validation engineer, second line; reports to Helena, CRO). A DISTINCT plane
// from implementation (Atlas / Bea).
//
// WHY RE-OPENED: PR #1421 (D-CASH-ASSET-CLASS-V1) renamed the model `fcy-cash`
// → `cash`. The methodology hash is FNV-1a over (modelId + version), so the id
// change RE-ANCHORS the hash, which re-opens independent validation
// (D-MODEL-BINDING-CONTRACT-V1 §3).
//
// VERDICT: VALIDATED-WITH-CONDITIONS (submitted → validation-approved) for the
// cash Valuable METHODOLOGY; with ONE HIGH finding routed back to the build team
// (MV-CASH-001 — the on-anchor settlement-continuity HISTORY proof is VACUOUS in
// practice because the materialised FIL instances are written to the v1 event
// store, not the v2 anchor store the recon reads; and the fixture's by-currency
// pairing is degenerate). The cash methodology arithmetic itself is FAITHFUL,
// currency-agnostic, and independently reproduced (see
// `v2-core/fil-models/fx-valuation/nadia-cash-validation-challenger.test.ts`).
//
// Emits, in order, Principle-1 typed events:
//   1. ValidationFindingRaised × 3 (MV-CASH-001 high; MV-CASH-002/003 medium);
//   2. one ModelValidationApproved (verdict — submitted → approved, conditions
//      tracked open);
//   3. one RecordFiled (the validation report in the Documents register).
//
// Idempotent — skips if the validation record is already filed.
//
// Authority: D-CASH-ASSET-CLASS-V1; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP;
//   D-ENGINEERING-INTEGRITY-CHARTER; IAS-21-§23; IFRS-9-§3.2; SR-11-7.
// brief: brief:nadia:independent-validation-of-the-cash-valuable-mode:2026-06-18
// Author: Nadia (Independent-validation engineer, second line).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import {
  makeModelValidationApproved,
  makeValidationFindingRaised,
} from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:cash-model-validation:2026-06-18";
const MODEL_ID = "cash";
const MODEL_VERSION = "1.0";
const ENTITY = String(BANK_ZA_001);

const ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const CITATIONS = [
  "D-CASH-ASSET-CLASS-V1",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
  "urn:reg:iasb:ias-21:§23",
  "urn:reg:iasb:ifrs-9:§3.2.3",
  "SR-11-7",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-nadia-cash-model-validation] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Findings — one HIGH (the non-vacuity / pairing defect, routed back to build)
// + two MEDIUM (NOP source-of-record forward-declaration; fx-spot submitted
// status). None is a defect in the cash METHODOLOGY arithmetic, which is clean.
// ---------------------------------------------------------------------------

const FINDINGS: Array<{
  findingId: string;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
}> = [
  {
    findingId: "MV-CASH-001",
    severity: "high",
    description:
      "SETTLEMENT-CONTINUITY HISTORY PROOF IS VACUOUS IN PRACTICE + A DEGENERATE BY-CURRENCY PAIRING (routed " +
      "back to Atlas/Bea — NOT a cash-model methodology defect). Two coupled issues. (a) MIS-ROUTED ANCHOR DATA: " +
      "the brief requires recon:fx-settlement-continuity to prove continuity against the REAL Cash instrument-of-" +
      "record, non-vacuously. The recon's HISTORY proof reads BANK_V2_ANCHOR_DB (v2-anchor.db, table v2_events), " +
      "but scripts/backfill-fil-instances.ts writes the materialised FilInstrumentCreated/Terminated (incl. the " +
      "settled FX + its `cash` legs) into the V1 canonical event.db (table `events`) via platform/composition's " +
      "eventStore — verified on the home store: event.db holds 7 FilInstrument events incl. the USD-received + ZAR-" +
      "paid cash legs with originatingInstrument back-refs, while v2-anchor.db holds ZERO. CI sets BANK_EVENT_DB=" +
      ".local/event.db but does NOT set BANK_V2_ANCHOR_DB, so the recon resolves an absent/empty default anchor DB " +
      "→ the HISTORY proof passes as `info` (flat-bench vacuous) on every run. The STRUCTURAL sweep (5 cases) is the " +
      "ONLY live continuity assertion; the on-anchor HISTORY assurance the brief asks for is not actually exercised. " +
      "(b) DEGENERATE PAIRING: when the materialised data IS read (proven by feeding the real fixture shape to the " +
      "recon `run()`), the settled FX fixture is denominated in the REPORTING currency (ZAR) and the history proof " +
      "pairs the cash leg to the FX position BY economicTerms.currency — matching the OPPOSITE-DIRECTION ZAR PAID " +
      "leg, yielding value_pre +1,852,000 != value_post −1,852,000 (a FALSE breach). The economically-correct FX " +
      "instrument-of-record should be denominated in the FOREIGN currency (USD), pairing with the USD received leg. " +
      "REQUIRED REMEDIATION before this finding closes: (1) materialise FIL instances into BANK_V2_ANCHOR_DB (or " +
      "point the recon at the store the backfill actually writes) so the HISTORY proof is non-vacuous on the anchor " +
      "book; (2) denominate the settled FX instrument-of-record in its foreign currency (or pair the history proof " +
      "by FOREIGN-currency / received-leg, not by the reporting-currency funding leg) so the proof is both non-" +
      "vacuous AND economically correct. The cash Valuable kernel is faithful on each leg — the defect is in the " +
      "seed/recon plumbing, not the model.",
  },
  {
    findingId: "MV-CASH-002",
    severity: "medium",
    description:
      "STANDING-NOP RISK CONTRIBUTION IS A FORWARD DECLARATION, NOT YET SOURCE-OF-RECORD. The cash model declares " +
      "RiskMeasurable (cashRiskMeasurable) with the correct <CCY>/<reporting> risk factor and a positionContribution " +
      "selecting TradeMatured/FcyCashBalanceRevalued, and a domestic (ZAR) balance correctly carries NO risk factor " +
      "(independently confirmed). HOWEVER the LIVE VaR/NOP engine (platform/market-risk/var-engine.ts) still derives " +
      "the standing net FX position from RETAINED FxTradeExecuted events via deriveNetFxPositionByCurrency (settled " +
      "trades retained, only cancelled excluded) — it does NOT read the `cash` FIL RiskMeasurable. cashRiskMeasurable " +
      "is referenced only by recon:attribution-var-diversification, not the engine. So the standing-NOP-includes-" +
      "settled-cash invariant (D-VAR-EXPOSURE-INCLUDES-STANDING-NOP) is currently carried by the V1 retained-trade " +
      "basis and the cash FIL RiskMeasurable is a CONSISTENT parallel declaration, not the live source. This is " +
      "ACCEPTABLE for the cash-class introduction (the NOP number is unchanged and correct) but must NOT be " +
      "represented as 'the cash FIL drives VaR'. CONDITION: when the FIL RiskMeasurable becomes the NOP source-of-" +
      "record, re-validate that the settled-cash contribution equals the retained-trade contribution (parallel run).",
  },
  {
    findingId: "MV-CASH-003",
    severity: "medium",
    description:
      'FX-SPOT MODEL `validationStatus:"submitted"` IS OUT OF SCOPE FOR THIS PASS — TRACK SEPARATELY. The brief ' +
      "asks whether the lingering fx-spot `submitted` status belongs in this validation. Decision: NO. This pass " +
      "validates the CASH Valuable model re-opened by the `fcy-cash`→`cash` rename. The fx-valuation/fx-spot model " +
      "is a DISTINCT model id with its own methodology hash; it was validated-with-conditions under the A2 pass " +
      "(ModelValidationApproved for `fx-valuation` v1.0, brief …fx-valuable-fil-model-a4-:2026-06-13). The CASH_MODEL_" +
      'DECLARATION also still carries validationStatus:"submitted" in code — that is the DECLARATION-time default; ' +
      "this validation's ModelValidationApproved event is the second-line attestation that supersedes it (the register " +
      "row's status derives from the latest validation event, Principle 1, not the code literal). If the fx-spot " +
      "declaration's code-literal `submitted` is intended to reflect the register, that is a SEPARATE housekeeping " +
      "item for the build team to reconcile the declaration literal against the filed validation event; it is not a " +
      "blocker for the cash model and is tracked here for visibility, not folded into this verdict.",
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
      raisedBy: "Nadia (Independent-validation engineer, second line)",
      severity: f.severity,
      description: f.description,
    },
  });
  eventStore.append(ev);
  console.log(`[finding] ${f.findingId} (${f.severity}) ${ev.event_id}`);
}

// ---------------------------------------------------------------------------
// The verdict — ModelValidationApproved (submitted → approved). The cash
// Valuable METHODOLOGY is validated with NO open methodology defect; the
// findings are a HIGH plumbing/non-vacuity defect routed to build (MV-CASH-001)
// + two tracked conditions (002/003). They are tracked OPEN (not resolved at
// sign-off): the approval clears the MODEL's arithmetic for use; MV-CASH-001
// gates the claim that the on-anchor HISTORY proof is non-vacuous.
// ---------------------------------------------------------------------------

const approval = makeModelValidationApproved({
  asOf: clock.now(),
  entity: ENTITY,
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    modelId: MODEL_ID,
    version: MODEL_VERSION,
    approvedBy: "Nadia (Independent-validation engineer, second line)",
    // No methodology defect to resolve — the cash kernel is clean and
    // independently reproduced (currency-agnostic, decimal-native, IAS-21
    // resolution fail-closed). The open findings (MV-CASH-001 high, 002/003
    // medium) are tracked open: a non-vacuity/pairing defect routed to build +
    // two conditions, not methodology defects.
    validationFindingsResolved: [],
    expiryDate: "2027-06-18",
  },
});
eventStore.append(approval);
console.log(
  `[verdict] ModelValidationApproved (cash v1.0, validated-with-conditions) ${approval.event_id}`,
);

// ---------------------------------------------------------------------------
// The validation report — RecordFiled, Documents register.
// ---------------------------------------------------------------------------

const body = `# Independent model validation — Cash \`Valuable\` FIL-Model (\`cash\`)

**Validator:** Nadia (Independent-validation engineer, second line; reports to Helena, CRO) — independent of implementation (Atlas (Core banking platform architect, engineering) / Bea (Accounting & financial reporting engineer, engineering)).
**Date:** 2026-06-18
**Model:** \`cash\` v1.0 — \`fil:type:cash:balance:vanilla@1.0\`, the monetary cash \`Valuable\` (+ \`Accountable\` + \`RiskMeasurable\`). Renamed from \`fcy-cash\` under D-CASH-ASSET-CLASS-V1.
**Brief:** \`brief:nadia:independent-validation-of-the-cash-valuable-mode:2026-06-18\` (WS-CASH-ASSET-CLASS).
**Authority:** D-CASH-ASSET-CLASS-V1; D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION; D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.
**Verdict event:** \`ModelValidationApproved\` — \`cash\` v1.0, \`submitted → validation-approved\` (conditions tracked open).

---

## VERDICT: VALIDATED-WITH-CONDITIONS

The cash valuation **methodology** (\`balance × spot-rate\`, currency-agnostic, IAS-21 reporting-currency resolution, decimal-native rounding) is **FAITHFUL** and **independently reproduced** by the validator's own challenger (\`nadia-cash-validation-challenger.test.ts\`, 11 cases). The \`fcy-cash\` → \`cash\` rename correctly **re-anchored the methodology hash** (the FNV-1a pin includes the model id) — the integrity anchor that re-opened this validation worked as designed.

**ONE HIGH finding is routed back to the build team (MV-CASH-001):** the on-anchor **settlement-continuity HISTORY proof is vacuous in practice** and the fixture's by-currency pairing is **degenerate**. The STRUCTURAL sweep holds, but the specific assurance the brief asks for — \`recon:fx-settlement-continuity\` proving continuity against the REAL Cash instrument-of-record, **non-vacuously** — is NOT actually exercised on the anchor book. This is a seed/recon-plumbing defect, **not** a cash-model methodology defect; the model is approved, the *claim of a non-vacuous on-anchor proof* is withheld until MV-CASH-001 closes.

A validation that separates "the cash arithmetic is correct" (it is) from "the continuity gate proves what it claims, non-vacuously" (it does not yet) is the substance of second-line independence here.

---

## 1. Methodology fidelity — FAITHFUL, currency-agnostic (independently reproduced)

Read independently against \`v2-core/fil-models/fx-valuation/cash-model.ts\` + \`methodology.ts\` + \`reporting-currency-resolver.ts\`:

- **Valuation kernel (shared with the FX position):** \`value = signedNotional × allInRate\`, rounded **half-away-from-zero** to the reporting display dp (2dp), via the v2 decimal engine (no float multiply). The reporting-currency leg values to **itself at rate 1** with **no observable required** — independently confirmed for a ZAR balance (\`observablesUsed.length === 0\`). A USD balance requires the \`USD/ZAR\` observable and values at the closing rate; a missing spot observable for a non-reporting currency is a **hard error** (no silent zero).
- **Currency-agnostic — no \`fcy\`/foreign assumption leaked:** the cash class holds ZAR exactly as USD/EUR/GBP. A USD leg at rate 1.0 equals a ZAR leg of the same notional (same kernel). The model id, scope (\`fil:type:cash:balance\`), and type slug carry **no currency marker** — currency is an instance-level economic term. Confirmed.
- **IAS-21 reporting-currency resolution:** \`reporting\` is the holding entity's FUNCTIONAL currency, resolved fail-closed via \`resolveReportingCurrency\` / \`requireReporting\` — **no \`?? "ZAR"\` default anywhere** in the valuation path (Engineering Charter cmd 2 fail-closed + cmd 4 source-don't-hardcode). A USD balance is foreign to a functional-ZAR branch (retranslated) and domestic to a functional-USD branch (rate 1). Confirmed.
- **Decimal-native rounding:** all arithmetic goes through \`mulD\`/\`roundDecimal\`/\`toDecimal\`; the amount is a canonical decimal string surviving JSON round-trip. Confirmed half-away-from-zero at the \`.5\` boundary, symmetric in sign (carried over from the A2 challenger sweep, which is unchanged and still green).
- **Methodology-hash re-anchor:** \`CASH_MODEL_METHODOLOGY_HASH === computeFxMethodologyHash("cash", {1,0})\`, which is **distinct** from \`computeFxMethodologyHash("fcy-cash", {1,0})\` — pinned by the challenger so a silent revert to \`fcy-cash\` (or any id/version drift) is caught (D-MODEL-BINDING-CONTRACT-V1 §3).

**Accountable facet (Bea's plane, sanity-checked):** IFRS-9 amortised-cost monetary item, fair-value-hierarchy level-1, posting keys for recognition + retranslation. Coherent with IAS-21 §23 retranslation-through-P&L. Not re-derived in depth (out of this pass's Valuable scope) — no concern surfaced.

## 2. Settlement continuity — STRUCTURAL holds; on-anchor HISTORY proof VACUOUS (MV-CASH-001)

**Structural (holds):** \`Valuable.value(marks, asOf)\` is lifecycle-free — it takes no stage argument — so the FX position (pre-settlement) and the cash balance (post-settlement) run the SAME kernel on the SAME notional at the SAME rate. Independently re-proven over a foreign-currency rate sweep (USD/EUR/GBP × {0.0001, 0.5, 1, 18.52, 23.4}): \`value_pre == value_post\` to the cent. The recon's 5-case structural sweep is non-vacuous and correct.

**History (vacuous + degenerate — the HIGH finding):**

- **Mis-routed anchor data.** \`recon:fx-settlement-continuity\` reads \`BANK_V2_ANCHOR_DB\` (\`v2-anchor.db\`, table \`v2_events\`). \`scripts/backfill-fil-instances.ts\` writes the materialised settled FX + its \`cash\` legs into the **V1 canonical \`event.db\`** (table \`events\`) via \`platform/composition\`'s \`eventStore\`. Verified on the home store: \`event.db\` holds 7 \`FilInstrument*\` events — the settled USD FX + a USD **received** cash leg + a ZAR **paid** cash leg, both with \`originatingInstrument\` back-refs — while \`v2-anchor.db\` holds **0**. CI sets \`BANK_EVENT_DB=.local/event.db\` but **not** \`BANK_V2_ANCHOR_DB\`, so the recon resolves an absent/empty default anchor DB and the HISTORY proof passes as \`info\` (flat-bench, "no settled FX instances … the HISTORY proof is vacuous"). The on-anchor assurance the brief requires is therefore **not exercised** on any run.
- **Degenerate by-currency pairing.** When the real fixture shape IS fed to the recon \`run()\`, the proof **fails** (a FALSE breach): the settled FX fixture is denominated in the **reporting** currency (ZAR), so the history proof's by-\`economicTerms.currency\` match selects the opposite-direction **ZAR paid** leg, giving \`value_pre +1,852,000 != value_post −1,852,000\`. The economically-correct instrument-of-record should be denominated in the **foreign** currency (USD) and pair with the USD **received** leg (which DOES satisfy continuity — independently confirmed).

**Required remediation (gates MV-CASH-001 closure):** (1) materialise FIL instances into \`BANK_V2_ANCHOR_DB\` (or point the recon at the store the backfill writes) so the HISTORY proof is non-vacuous on the anchor book; (2) denominate the settled FX instrument-of-record in its foreign currency — or pair the history proof by foreign-currency / received-leg, not the reporting-currency funding leg — so the proof is both non-vacuous AND economically correct.

## 3. Standing-NOP contribution — CORRECT but a forward declaration (MV-CASH-002)

\`cashRiskMeasurable\` declares the correct \`<CCY>/<reporting>\` risk factor and a \`positionContribution\` on \`TradeMatured\`/\`FcyCashBalanceRevalued\`; a domestic (ZAR) balance correctly carries **no** risk factor. But the **live** VaR/NOP engine (\`var-engine.ts\`) still derives the standing net FX position from **retained \`FxTradeExecuted\` events** (\`deriveNetFxPositionByCurrency\` — settled retained, cancelled excluded), the existing D-VAR-EXPOSURE-INCLUDES-STANDING-NOP basis. \`cashRiskMeasurable\` is referenced only by \`recon:attribution-var-diversification\`, not the engine. So the standing-NOP-includes-settled-cash invariant is currently carried by the V1 retained-trade basis and the cash FIL \`RiskMeasurable\` is a **consistent parallel declaration**, not the live source. Acceptable for the cash-class introduction (the NOP number is unchanged and correct); must not be represented as "the cash FIL drives VaR". CONDITION: re-validate parity when the FIL \`RiskMeasurable\` becomes the NOP source-of-record.

## 4. fx-spot \`submitted\` status — OUT OF SCOPE; track separately (MV-CASH-003)

The fx-valuation/fx-spot model is a DISTINCT model id with its own hash, validated-with-conditions under the A2 pass. The lingering \`validationStatus:"submitted"\` code literal on \`CASH_MODEL_DECLARATION\` (and on fx-spot) is the DECLARATION-time default; the register row's status derives from the **latest validation event** (Principle 1), which this pass's \`ModelValidationApproved\` now provides for \`cash\`. Reconciling the code literal to the filed event is separate housekeeping for the build team. Not folded into this verdict.

---

## Conditions register (tracked open at sign-off)

| Finding | Severity | Gates |
|---|---|---|
| MV-CASH-001 | high | The claim of a non-vacuous on-anchor settlement-continuity HISTORY proof. Routed to Atlas/Bea: fix anchor-store routing + foreign-currency instrument-of-record / pairing. |
| MV-CASH-002 | medium | Representing the cash FIL RiskMeasurable as the live VaR/NOP source. Re-validate parity at source-of-record cutover. |
| MV-CASH-003 | medium | Reconcile the \`submitted\` code literal against the filed validation event (housekeeping). |

**Re-validation cadence:** annual (SR-11-7) or on methodology-hash change (D-MODEL-BINDING-CONTRACT-V1 §3).

---

*Filed events-first (Principle 1): 3 × \`ValidationFindingRaised\` + 1 × \`ModelValidationApproved\` + this \`RecordFiled\`. The markdown is a render of the events, not the canonical artefact.*
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
      title: "Independent model validation — Cash Valuable FIL-Model (cash)",
      path: "2026-06-18_nadia_cash-model-validation.md",
      category: "model-validation",
      author: "Nadia (Independent-validation engineer, second line)",
      date: "2026-06-18",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: "validated-with-conditions",
      model: `${MODEL_ID} v${MODEL_VERSION}`,
      findings: FINDINGS.map((f) => `${f.findingId}:${f.severity}`),
      validationEventId: approval.event_id,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
