// scripts/file-nadia-v2-saccr-model-validation.ts
//
// Independent model-risk validation of the v2 SA-CCR FIL-Model (V2 S7-FIL),
// by Nadia (Model validation, risk) — third-line, a distinct plane from
// implementation (Rohan). Brief
// `brief:nadia:independent-model-validation-of-v2-sa-ccr-fil-mo:2026-06-13`;
// authority D-SACCR-V2-CUTOVER-ACCELERATE (CEO-approved 2026-06-13),
// D-W4-MODEL-LIBRARY-PILOT, D-MODEL-BINDING-CONTRACT-V1.
//
// VERDICT: VALIDATED-WITH-CONDITIONS. The methodology is a faithful d317/CRE52
// port; the v1 FX MtM-summing defect is independently CONFIRMED; the v2
// latest-per-trade basis is the correct d317 treatment. The alias-flip is
// CONDITIONALLY CLEARED — cleared to proceed once the three OPEN conditions
// land (NOT cleared to flip on `main` as it stands today).
//
// Emits, in order, Principle-1 typed events:
//   1. three ValidationFindingRaised (the OPEN conditions — severity blocking
//      for the FLIP, not blocking for the MODEL methodology itself);
//   2. one ModelValidationApproved (the verdict — submitted → approved);
//   3. one RecordFiled (the validation report in the Documents register).
//
// Idempotent — skips if the validation record is already filed.
//
// Author: Nadia (Model validation, risk).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import {
  makeModelValidationApproved,
  makeValidationFindingRaised,
} from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:v2-saccr-model-validation:2026-06-13";
const MODEL_ID = "sa-ccr";
const MODEL_VERSION = "1.0";
const ENTITY = String(BANK_ZA_001);

const ACTOR = { type: "service" as const, id: "agent:nadia:model-validation" };
const CITATIONS = [
  "D-SACCR-V2-CUTOVER-ACCELERATE",
  "D-W4-MODEL-LIBRARY-PILOT",
  "D-MODEL-BINDING-CONTRACT-V1",
  "BCBS-SA-CCR-CRE52",
  "SR-11-7",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-nadia-v2-saccr-model-validation] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// The three OPEN conditions gating the ALIAS-FLIP (not the model methodology).
// ---------------------------------------------------------------------------

const FINDINGS: Array<{
  findingId: string;
  severity: "low" | "medium" | "high" | "blocking";
  description: string;
}> = [
  {
    findingId: "MV-SACCR-V2-001",
    severity: "blocking",
    description:
      "FLIP-BLOCKING (model-clean): the Valuable-feed branch (rohan/v2-saccr-vmtm-collateral-feed, brief's #1298) " +
      "is NOT yet merged to main. It is the piece that makes the LIVE v2 RC-input resolution use the latest-per-trade " +
      "*Revalued event-of-record (sourceVMtmFromValuableFeed → materialiseNettingSetRevaluations, last-write-wins) — " +
      "i.e. the fix for the v1 FX-summing defect. On main as it stands, recon:v2-saccr-parity still PINS vMtm from the " +
      "recorded v1 RC event, so the live resolution defect is NOT exercised and v2 is byte-equivalent to v1 INCLUDING " +
      "the defect on the live path. Condition: merge the Valuable-feed branch (retiring the pin; recorded-RC divergence " +
      "reclassified to warn, correctly attributed to the v1 defect) BEFORE the alias-flip.",
  },
  {
    findingId: "MV-SACCR-V2-002",
    severity: "blocking",
    description:
      "FLIP-BLOCKING (model-clean): no live wiring routes the CCR events-of-record (CcrReplacementCostComputed / " +
      "CcrEadComputed) through the v2 model. The sole live emitter remains v1 platform/risk/sa-ccr/compute-and-emit.ts; " +
      "v2 computeSaCcr is invoked only by the parity harness + unit tests. The 'alias-flip' slice that makes v2 the " +
      "source-of-record does not exist yet. Condition: the flip slice must (a) route live emission through v2 sourced " +
      "via the Valuable feed, and (b) carry the recon:v2-saccr-parity hard gate green at the moment of flip.",
  },
  {
    findingId: "MV-SACCR-V2-003",
    severity: "high",
    description:
      "AT-FLIP REMEDIATION: v1 resolveMtm (platform/risk/sa-ccr/compute-and-emit.ts ~line 161) must be CORRECTED or " +
      "RETIRED at the flip. Its FX arm sums FxPositionRevalued.unrealisedPnlZarMinor across revaluations on the false " +
      "premise it is a per-period delta; the producer (fx-forward-revaluation.ts computeMtmPnlMinor) computes it as " +
      "(currentRate − bookedRate_at_inception) × notional / currentRate — the FULL cumulative mark, recomputed each EOD. " +
      "Summing N revaluations N-counts the mark (recorded Investec RC ~R55.5m vs correct ~R0). The IRS arm is already " +
      "correct (last-write-wins on npvClosingMinor; the genuine delta npvDeltaMinor is correctly NOT summed). Leaving " +
      "v1 resolveMtm live as any fallback after the flip would reintroduce the defect; it must not survive the cutover.",
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
      raisedBy: "Nadia (Model validation, risk)",
      severity: f.severity,
      description: f.description,
    },
  });
  eventStore.append(ev);
  console.log(`[finding] ${f.findingId} (${f.severity}) ${ev.event_id}`);
}

// ---------------------------------------------------------------------------
// The verdict — ModelValidationApproved (submitted → approved). The model
// METHODOLOGY is validated with no open methodology findings; the OPEN findings
// above are conditions on the FLIP, tracked as validationFindings (not resolved
// at sign-off). expiryDate sets the periodic re-validation horizon (SR-11-7).
// ---------------------------------------------------------------------------

const approval = makeModelValidationApproved({
  asOf: clock.now(),
  entity: ENTITY,
  actor: ACTOR,
  citations: CITATIONS,
  payload: {
    modelId: MODEL_ID,
    version: MODEL_VERSION,
    approvedBy: "Nadia (Model validation, risk)",
    // No methodology findings to resolve — the model port is clean. The OPEN
    // FLIP conditions (MV-SACCR-V2-001/002/003) are NOT resolved by this
    // sign-off; they are tracked open and gate the flip slice, not the model.
    validationFindingsResolved: [],
    // Periodic re-validation horizon — 12 months (SR-11-7 annual cadence) or on
    // a methodologyHash change / cited-provision drift, whichever is sooner.
    expiryDate: "2027-06-13",
  },
});
eventStore.append(approval);
console.log(`[verdict] ModelValidationApproved (validated-with-conditions) ${approval.event_id}`);

// ---------------------------------------------------------------------------
// The validation report — RecordFiled, Documents register.
// ---------------------------------------------------------------------------

const body = `# Independent model validation — v2 SA-CCR FIL-Model (S7-FIL)

**Validator:** Nadia (Model validation, risk) — independent third line; a distinct plane from implementation (Rohan (Risk engineer, engineering)).
**Date:** 2026-06-13
**Model:** \`sa-ccr\` v1.0 — the FIRST FIL-Model. Methodology hash \`SA_CCR_METHODOLOGY_HASH\` (FNV-1a over version + load-bearing d317 constants).
**Brief:** \`brief:nadia:independent-model-validation-of-v2-sa-ccr-fil-mo:2026-06-13\` (WS-V2-BBAAS).
**Authority:** D-SACCR-V2-CUTOVER-ACCELERATE (CEO-approved 2026-06-13); D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1.
**Verdict event:** \`ModelValidationApproved\` — \`sa-ccr\` v1.0, \`submitted → validation-approved\`.

---

## VERDICT: VALIDATED-WITH-CONDITIONS — alias-flip CONDITIONALLY CLEARED

The v2 SA-CCR FIL-Model methodology is a faithful BCBS d317 / CRE52 port and the v2 latest-per-trade
mark-to-market basis is the CORRECT regulatory treatment. The v1 FX MtM-summing defect is independently
**CONFIRMED** (read at code + event level, not taken on faith). The model itself carries **no open
methodology findings**.

The **alias-flip is CONDITIONALLY CLEARED**: cleared to proceed once the three open conditions below land.
It is **NOT cleared to flip on \`main\` as it stands today**, because the live v2 source-of-record path that
carries the fix is not yet merged or wired. A validation that distinguishes "the model is correct" from
"the cutover is safe to execute right now" is the substance of third-line independence here; the two are
not the same statement.

---

## 1. Methodology fidelity (d317 / CRE52) — FAITHFUL

Read independently against \`v2-core/fil-models/sa-ccr/methodology.ts\`:

- **Replacement cost (§136 / CRE52.10–18):** \`max(V − C, MTA + TH, 0)\` margined; \`max(V, 0)\` unmargined. Correct, including the non-negative-collateral guard and the margined-requires-(TH, MTA) precondition.
- **PFE add-on (§149–191 / CRE52.45–63):** Table-2 supervisory factors (ir 0.5%, fx 4%, credit 1.3%, equity 32%, commodity 18%); hedging-set keys (IR by ccy × maturity bucket, FX by pair, commodity by type); supervisory delta linear ±1 (§15 / CRE52.46 — correct for the linear IR/FX scope, no optionality); maturity factor \`√(min(M, 1))\` unmargined and \`√(10/250)\` margined (§164). Net-then-abs per hedging set, abs-sum across sets — correct aggregation.
- **PFE multiplier (§149 / CRE52.5):** \`min(1, floor + (1−floor)·exp((V−C)/(2(1−floor)·AddOn)))\`, floor 0.05. Correct; degenerate \`AddOn = 0 ⇒ 1.0\` handled.
- **EAD (§10):** \`α × (RC + PFE)\`, α = 1.4. Correct. bigint minor-unit arithmetic with explicit 1e6/1e4-scaled half-up rounding preserved byte-for-byte from v1.

Worked checks reproduce the d317 reference shapes (e.g. single FX trade, V = 50 000, |notional| = 1 000 000, MF = 1: PFE add-on = 40 000; multiplier ≈ 1; EAD = 1.4 × (50 000 + 40 000) = 126 000). Confirmed against the model's own unit suite.

**Limitations noted (faithful to v1, documented — not defects):**
- **L1 — representative supervisory factors:** one SF per asset class (IR flat 0.5%, no sub-bucket curve schedule; credit/equity single-name vs index not differentiated). For the S7-FIL IR + FX scope this is exact (IR single-currency SF = 0.5% is the standard figure; FX SF = 4%). When the model's scope extends to credit/equity/commodity, the SF schedule must be elaborated before those classes are validated.
- **L2 — linear delta only:** no optionality in scope; FX/IR options would require a supervisory delta with Black-Scholes inputs. Correctly out of scope for v1.0.

## 2. The v1 FX MtM-summing defect — INDEPENDENTLY CONFIRMED

Read at code + event level, both sides:

- **Producer** (\`platform/markets/eod/fx-forward-revaluation.ts\`, \`computeMtmPnlMinor\`): \`pnlDelta = (currentForwardRate − bookedRate) × notional / currentForwardRate\`, where \`bookedRate\` is the trade's **contractual rate fixed at inception** (\`farLeg.rate.amount\` / \`nearLeg.rate.amount\`). This is the position's **FULL unrealised mark from inception**, recomputed at each EOD against the same fixed booked rate — NOT an incremental period delta. The local variable is *named* \`pnlDelta\` and the v1 \`resolveMtm\` comment calls the field a "delta P&L for the revaluation period," but the producing formula contradicts that: there is no prior-rate term.
- **Consumer** (\`platform/risk/sa-ccr/compute-and-emit.ts\`, \`resolveMtm\` ~line 161): the FX arm **sums** \`unrealisedPnlZarMinor\` across every \`FxPositionRevalued\` for a trade (\`prev + …\`). A trade revalued N times is therefore **N-counted** in V, hence in RC. The IRS arm is **correct** — last-write-wins on \`npvClosingMinor\` (the cumulative closing NPV); and the IRS producer emits a *separate, genuine* delta field \`npvDeltaMinor = closing − opening\` which \`resolveMtm\` correctly does NOT sum. The asymmetry is decisive: the field that IS a delta is not summed; the field that is NOT a delta is summed.
- **Recorded impact:** the Investec netting-set RC of ~R55.5m vs the correct ~R0 is consistent with N-counting of a cumulative mark that nets to approximately zero at a single point in time.

**Correct d317 treatment:** RC's \`V\` is the **current net mark-to-market** of the netting set as-of the valuation date (CRE52.10) — exactly **one** mark per trade, latest as-of. Summing successive cumulative marks has no basis in d317.

**Which engine matches it:** the v2 model (and the v1 IRS arm) — **latest-per-trade, last-write-wins**. The Valuable feed (\`platform/risk/sa-ccr/fil-valuable-collateral-feed.ts\`, \`materialiseNettingSetRevaluations\`) implements exactly this: \`latest.set(tradeId, …)\` for BOTH IRS and FX, then sums **across trades** (correct netting aggregation), never across time. v1-FX does not. **Defect real; v2 is the correct basis.**

## 3. Parity evidence — VALID, with a precise scope caveat

\`recon:v2-saccr-parity\` (\`platform/recon/v2-saccr-parity.ts\`):

- **Hard gate (\`fail\`) — VALID:** v1-recompute RC/EAD == v2 RC/EAD over **identical inputs** + FIL-instance-sourced trade structure, byte-compared on a stable-JSON of the payloads. This is a sound *port-fidelity* proof: it proves the v2 arithmetic faithfully reproduces v1's. The structural-parity sub-assertion (FIL-instance trades == v1-adapter trades) correctly guards the data-access path.
- **Advisory (\`warn\`) — CORRECTLY REASONED (on the Valuable-feed branch):** once the feed branch is merged, the harness sources vMtm from the Valuable feed (correct latest-per-trade), retires the recorded-RC pin, and compares the feed-sourced RC against the recorded v1 RC **as an oracle**. A divergence there is **expected** — it is the defect manifesting — and is **surfaced (both vMtm values + basis + as-of), not forced to match**, classified \`warn\` not \`fail\`. That is the correct third-line posture: do not bend the correct Principle-1 source to a wrong-basis oracle. The divergence is **correctly attributed to the v1 defect, not a v2 error**.
- **CAVEAT (the basis of condition MV-SACCR-V2-001):** on \`main\` as it stands the feed branch is **not merged**, so the harness still **pins vMtm from the recorded RC event**. In that state the defect is in the input-resolution layer (\`resolveMtm\`), which the pinned harness **bypasses** — so the hard gate proves port-fidelity but does NOT exercise the fix, and v2 reproduces the recorded (defective) RC exactly. The fix is only live once the feed branch lands.

## 4. FIL-mediated inputs — SOUND

- **vMtm ← the Valuable feed:** the latest \`*Revalued\` event-of-record per trade, as-of the RC date, projected into the \`Valuable\` facet's \`RevaluationRecord\` shape (\`sourceVMtmFromValuableFeed\`). This is the Principle-1 reading (the canonical revaluation event), correctly last-write-wins per trade and summed only across trades. Single-currency netting-set discipline enforced (IRS \`currency\` match; FX contributes to ZAR sets only, per the ZAR-denominated \`FxPositionRevalued\` schema). Sound.
- **collateral ← the register:** \`getCollateralInventory(asOf)\` haircut-adjusted ZAR pool, major→minor conversion. Mirrors v1 \`resolveCollateral\` so parity holds. Sound for the build phase.

## 5. Conditions / limitations

**Blocking the ALIAS-FLIP (model is clean; these gate the cutover, not the methodology):**
- **MV-SACCR-V2-001 (blocking):** merge the Valuable-feed branch (\`rohan/v2-saccr-vmtm-collateral-feed\`, brief's #1298) before the flip — it carries the live latest-per-trade fix and retires the recorded-RC pin.
- **MV-SACCR-V2-002 (blocking):** build the alias-flip slice that routes live CCR emission through v2 (sourced via the Valuable feed) with \`recon:v2-saccr-parity\` hard gate green at the moment of flip. No such wiring exists today; v1 \`compute-and-emit.ts\` is still the sole live emitter.
- **MV-SACCR-V2-003 (high):** correct or retire v1 \`resolveMtm\`'s FX-summing arm at the flip so it cannot survive as a defective fallback.

**Standing limitations (accepted for v1.0):**
- Per-netting-set collateral allocation deferred (D-CSA-COLLATERAL-ALLOCATION); interim bank-level ZAR pool.
- Build-phase simulated data; forward-rate curve is a static seed (GAP-FWD-1/2); flat-discount approximation.
- L1 representative supervisory factors and L2 linear-delta-only (§1) — re-validate before any scope extension to credit/equity/commodity or optionality.

## 6. Re-validation

Annual (SR-11-7), expiry 2027-06-13, or sooner on a \`methodologyHash\` change or drift of any cited d317/CRE52 provision (the verbatimHash re-open semantics of D-MODEL-BINDING-CONTRACT-V1 §3).
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
      title: "Independent model validation — v2 SA-CCR FIL-Model (S7-FIL)",
      path: "2026-06-13_nadia_v2-saccr-model-validation.md",
      category: "model-validation",
      author: "Nadia (Model validation, risk)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict: "validated-with-conditions",
      aliasFlipCleared: "conditional (MV-SACCR-V2-001/002/003)",
      validationEventId: approval.event_id,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
