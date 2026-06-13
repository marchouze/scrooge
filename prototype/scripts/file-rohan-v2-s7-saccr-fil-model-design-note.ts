// scripts/file-rohan-v2-s7-saccr-fil-model-design-note.ts
//
// RMS Phase 3 filing — Rohan's V2 S7-FIL design note: SA-CCR as the first
// FIL-Model, built in v2-core and parity-proven against the live v1 engine.
// Idempotent — skips if already filed.
//
// Authority: D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Rohan (Risk Engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";
import { SA_CCR_METHODOLOGY_HASH } from "../v2-core/fil-models/sa-ccr";

const RECORD_ID = "record:documents:rohan:v2-s7-saccr-fil-model-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-rohan-v2-s7-saccr] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S7-FIL — SA-CCR as the first FIL-Model: build + parity-proven, v1 live

**Author:** Rohan (Risk Engineer, engineering)
**Date:** 2026-06-13
**Authority:** D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1; D-FIL-FRAMEWORK-UNIFICATION; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Atlas (Core banking platform architect, engineering); Nadia (Model validation engineer, engineering)
**Status:** Implemented — PR feat(v2-s7): SA-CCR as first FIL-Model — build + parity-proven, v1 live (WS-V2-BBAAS)
**Methodology hash:** \`${SA_CCR_METHODOLOGY_HASH}\`

---

## 1. What this slice did (and did NOT do)

SA-CCR is the **first cross-package FIL-Model** — the first time a model is
implemented inside \`v2-core\` (FIL-first, entity-generic, hard no-v1-import
boundary) rather than in the v1 \`platform/\` code-line. Per the CEO scope
decision (2026-06-13), this slice **builds and proves parity ONLY**:

- **Declared** SA-CCR as a FIL-Model: \`FilModelImplementationDeclared\`,
  modelId \`sa-ccr\`, implementing \`RiskMeasurable\` over \`fil:type:ir:*\` +
  \`fil:type:fx:*\`, emitting \`CcrReplacementCostComputed\` +
  \`CcrEadComputed\`, citing BCBS d317 / CRE52, version 1.0, methodologyHash
  \`${SA_CCR_METHODOLOGY_HASH}\`. The FIL-Models register folds empty → 1 row.
- **Implemented** the SA-CCR methodology IN \`v2-core\` (RC, PFE add-on, EAD,
  netting aggregation), FIL-mediated, with **zero v1 imports** (the
  \`recon:v2-no-v1-import\` boundary gate confirms it).
- **Stood up** \`recon:v2-saccr-parity\` — a v1-side gate that replays the
  recorded SA-CCR history, re-runs both engines, and asserts byte-equivalence
  of both CCR event payloads per netting set.

**Out of scope (gated follow-on):** NO alias-flip, NO v1 retirement, NO
repoint of CVA / BA-700 / RWA consumers, NO Nadia validation. **The v1 engine
stays LIVE and unchanged.**

## 2. Field-by-field v1 → v2 methodology mapping

The v2 methodology (\`v2-core/fil-models/sa-ccr/methodology.ts\`) is a faithful
port of the live v1 engine. Identical formulae, constants, and — critically —
identical bigint minor-unit arithmetic and half-up rounding, so the outputs are
byte-identical.

| Component | v1 (oracle) | v2 (candidate) | Mapping |
|---|---|---|---|
| Replacement cost | \`replacement-cost.ts::computeReplacementCost\` | \`methodology.ts::computeReplacementCost\` | Margined RC = max(V−C, MTA+TH, 0); unmargined RC = max(V, 0). Same \`bigMax3\`. |
| Supervisory factors | \`pfe-addon.ts::SUPERVISORY_FACTOR\` | \`methodology.ts::SUPERVISORY_FACTOR\` | ir 0.5% / fx 4.0% / credit 1.30% / equity 32% / commodity 18% — identical Table 2 (CRE52 §52.45–§52.52). |
| Maturity factor | \`pfe-addon.ts::maturityFactor\` | \`methodology.ts::maturityFactor\` | Unmargined √(min(M,1y)); margined √(10bd/250). Identical (d317 §164). |
| Hedging-set key | \`pfe-addon.ts::hedgingSetKey\` | \`methodology.ts::hedgingSetKey\` | IR \`ccy:maturity-bucket\`; FX \`pair\`; commodity/credit/equity buckets — identical (d317 §158–§160). |
| Delta | \`pfe-addon.ts::tradeDelta\` | \`methodology.ts::tradeDelta\` | Linear ±1 by direction. Identical (d317 §15 / CRE52 §52.46). |
| PFE add-on | \`pfe-addon.ts::computeAddOn\` | \`methodology.ts::computeAddOn\` | Σ(|Σ δ·d·MF| × SF) per asset class; Number adjusted-notional + \`Math.round\` to minor units — bit-identical. |
| PFE multiplier | \`pfe-addon.ts::pfeMultiplier\` | \`methodology.ts::pfeMultiplier\` | min(1, 0.05 + 0.95·exp((V−C)/(2·0.95·AggOn))) — identical (d317 §149 / CRE52 §52.5). |
| EAD composition | \`ead.ts::computeEad\` | \`methodology.ts::computeEad\` | EAD = α×(RC+PFE), α=1.4; PFE = round₁ₑ₆(mult·AggOn); EAD = round₁ₑ₄(1.4·(RC+PFE)) — identical half-up scaling. |
| Event payloads | \`compute-and-emit.ts\` (\`makeCcr*\`) | parity harness builds the same field set | \`Number(minor)\` coercion identical; envelope (event_id/as_of/actor) excluded from parity (non-deterministic in v1). |

The methodologyHash (\`${SA_CCR_METHODOLOGY_HASH}\`) is an FNV-1a digest pinning
the version + α + PFE floor + MPOR + the supervisory-factor schedule + the
formula shapes, so any silent drift in the v2 formulae changes the hash (the
D-MODEL-BINDING-CONTRACT-V1 §3 integrity anchor).

## 3. Parity result

\`recon:v2-saccr-parity\` over the live anchor store:

- **Netting sets checked:** 2 (NS-investec-bank-za-ZAR; NS-…-0eaca28d-ZAR).
- **Byte-diff count: 0.** Both \`CcrReplacementCostComputed\` and
  \`CcrEadComputed\` payloads are byte-identical between v1 recompute, v2
  recompute, AND the recorded v1 events:
  - investec: rc=55,517,791 pfe=16,917,542 ead=101,409,466 (cents, ZAR).
  - 0eaca28d: rc=0 pfe=1,147,429 ead=1,606,401 (cents, ZAR).
- On a clean checkout (no recorded CCR history) the gate degrades to a green
  "nothing to reconcile" — the model's own unit tests carry the byte-math proof
  (the worked d317 examples). This mirrors the \`var-nop-exposure-parity\`
  flat-bench pattern.

## 4. FIL-instance materialisation gap (surfaced, not hidden)

The v2 model's intent is to read IR + FX positions as **native FIL instances**
via the \`RiskMeasurable\` facet. Those per-trade FIL instances are **not yet
materialised** — there is no live \`fil:inst:\` event family in the store; a
future slice mints them. So the parity harness **adapts v1 positions into the
v2 \`SaCcrTradeSummary\` shape at the v1 side** (allowed: the boundary forbids
only v2→v1) and **pins the RC inputs (vMtm, collateral) from the recorded v1
RC event** rather than re-deriving them.

Two notes on the pinning:
- The adaptation is 1:1 (same fields), so it does not perturb parity.
- We deliberately do NOT re-resolve vMtm via the v1 \`resolveMtm\` cumulative-
  delta walk inside the gate: that resolver is as-of-sensitive and drifts as
  later revaluations land, which would make the recorded-history comparison
  non-deterministic. Pinning the authoritative recorded inputs is the correct
  engineering choice and isolates the parity assertion to the **methodology**,
  which is what this slice proves.

**Gap owner / next step:** native FIL-instance materialisation (a later FIL
slice) replaces the harness-boundary adapter with a real \`RiskMeasurable\`
read over \`fil:inst:\` events; at that point the gate reconstructs inputs from
FIL instances directly and the pinning is retired.

## 5. Explicit next step (gated follow-on)

1. **Nadia validation** — independent model-validation sign-off of the v2
   SA-CCR FIL-Model (flips \`validationStatus\` submitted →
   validation-approved). The parity proof here is engineering validation, not
   the third-line model-validation gate.
2. **Alias-flip** — once parity soaks and Nadia signs off, repoint the SA-CCR
   producer path to the v2 model.
3. **v1 retirement** — retire the v1 \`platform/risk/sa-ccr/*\` engine and
   repoint CVA / BA-700 / RWA consumers to the v2 outputs.

None of (1)–(3) is in this slice. The v1 engine is LIVE and untouched.

## 6. Substrate gap

- **FIL-instance materialisation** (above) — the harness-boundary adapter is
  the explicit interim; a future slice mints native \`fil:inst:\` IR + FX
  instances and the gate reads them directly.
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
    citations: [
      "D-W4-MODEL-LIBRARY-PILOT",
      "D-MODEL-BINDING-CONTRACT-V1",
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
      "BCBS-SA-CCR-CRE52",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:rohan:risk-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S7-FIL — SA-CCR as the first FIL-Model: build + parity-proven, v1 live",
      path: "2026-06-13_rohan_v2-s7-saccr-fil-model-design-note.md",
      category: "design-note",
      author: "Rohan (Risk Engineer, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T09:30:00.000Z",
);

console.log(JSON.stringify({ ok: true, recordId: RECORD_ID, eventId: result.eventId }, null, 2));
