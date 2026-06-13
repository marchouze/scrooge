// scripts/file-rohan-saccr-alias-flip-cutover.ts
//
// RecordFiled — SA-CCR alias-flip cutover record (RMS Phase 3, WS-V2-BBAAS).
// The deliverable of the DECIDER run that flips the v2 SA-CCR FIL-Model to the
// sole live CCR emitter, retires the defective v1 `resolveMtm`, and corrects the
// recorded RC/EAD figures.
//
// Authority: D-SACCR-V2-CUTOVER-ACCELERATE (CEO-approved 2026-06-13);
//   D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1. Brief
//   `brief:rohan:sa-ccr-alias-flip-v2-sole-live-emitter-v1-retire:2026-06-13`.
//   Gated on (and cleared by) Nadia's reviewer validation
//   (`record:documents:nadia:v2-saccr-model-validation:2026-06-13`,
//   ModelValidationApproved, validated-with-conditions MV-SACCR-V2-001/002/003).
//
// Idempotent — skips if the record is already filed.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/file-rohan-saccr-alias-flip-cutover.ts
//
// Author: Rohan (Risk Engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:rohan:saccr-alias-flip-cutover:2026-06-13";
const ENTITY = String(BANK_ZA_001);
const ACTOR = { type: "service" as const, id: "agent:rohan:risk-engineer" };
const CITATIONS = [
  "D-SACCR-V2-CUTOVER-ACCELERATE",
  "D-W4-MODEL-LIBRARY-PILOT",
  "D-MODEL-BINDING-CONTRACT-V1",
  "BCBS-SA-CCR-CRE52",
  "Policies/credit-risk-policy-v1.md#3",
];

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (alreadyFiled) {
  console.log(`[file-rohan-saccr-alias-flip-cutover] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# SA-CCR alias-flip cutover — v2 sole live emitter, v1 retired, recorded RC/EAD corrected

**Author:** Rohan (Risk Engineer, engineering).
**Date:** 2026-06-13.
**Brief:** \`brief:rohan:sa-ccr-alias-flip-v2-sole-live-emitter-v1-retire:2026-06-13\` (WS-V2-BBAAS).
**Authority:** D-SACCR-V2-CUTOVER-ACCELERATE (CEO-approved 2026-06-13); D-W4-MODEL-LIBRARY-PILOT; D-MODEL-BINDING-CONTRACT-V1.
**Reviewer gate (cleared):** Nadia (Model validation, risk) — ModelValidationApproved (validated-with-conditions), \`record:documents:nadia:v2-saccr-model-validation:2026-06-13\`. Flip conditions MV-SACCR-V2-001 (Valuable-feed merged, #1298), 002 (live wiring through v2 — this cutover), 003 (v1 resolveMtm retired — this cutover) all satisfied.

---

## What changed

The live \`CcrReplacementCostComputed\` + \`CcrEadComputed\` events of record are now computed by the VALIDATED v2 SA-CCR FIL-Model (\`v2-core/fil-models/sa-ccr\` — \`computeSaCcr\`), with RC inputs sourced END-TO-END from the FIL-mediated feeds:
- **vMtm** ← \`sourceVMtmFromValuableFeed\` — the LATEST \`*Revalued\` event-of-record per trade, last-write-wins, summed only across trades (the correct d317/CRE52.10 \`V\` basis).
- **collateral** ← \`sourceCollateralFromRegister\` — the collateral-inventory register (build-phase bank-level ZAR pool).

The CCR event SCHEMAS are UNCHANGED; downstream consumers (\`rwa-from-positions\` CreditRWA, \`ba-700-leverage-ratio\`, \`leverage-ratio-metrics\`, \`cva-engine\`) read the event of record and are untouched.

## What was retired vs kept

- **RETIRED:** the v1 \`resolveMtm\` input-resolution function (\`platform/risk/sa-ccr/compute-and-emit.ts\`). Its FX arm SUMMED \`FxPositionRevalued.unrealisedPnlZarMinor\` across revaluations on the false premise it was a per-period delta; it is the FULL cumulative mark recomputed each EOD, so summing N revals N-counted V. The function no longer exists and has no live fallback (Nadia MV-SACCR-V2-003). The barrel export and its dedicated tests are removed; the FX-summing path is severed.
- **KEPT:** the v1 pure methodology functions (\`replacement-cost.ts\`, \`pfe-addon.ts\`, \`ead.ts\`). They are the ORACLE side of \`recon:v2-saccr-parity\` (v1-recompute vs v2 byte-equivalence) — not a live emission path. \`resolveCollateral\` is no longer re-exported (superseded by the register feed).

## Single-emitter gate

New \`recon:ccr-single-emitter\` (\`platform/recon/ccr-single-emitter.ts\`, wired into the infra recon suite): asserts exactly ONE production module emits the CCR events (the v2-sourced \`compute-and-emit.ts\`), it is the expected module, and \`resolveMtm\` does not survive as a live symbol. The existing \`recon:posting-engine-single-subscriber\` covers only GL postings (\`SubLedgerPostingEmitted\`), not CCR events — this gate is the CCR-specific analogue.

## Recorded RC/EAD correction (event-sourced; Principle 1)

\`scripts/recompute-sa-ccr-v2-alias-flip.ts\` reconstructs the recorded-date book (2026-06-11) and re-prices it under the v2 latest-per-trade MtM basis, appending corrected events at a later computationDate (2026-06-13) so the projection's latest-by-computationDate selection adopts them. Historical (defective) events are retained in the log as the audit trail — never mutated.

| Netting set | Before RC | After RC | Before EAD | After EAD | EAD Δ |
|---|---|---|---|---|---|
| Investec (NS-…investec-bank-za-ZAR) | R555,177.91 | **R0** | R1,014,094.66 | R43,211.29 | **−R970,883.37** |
| NS-…0eaca28d-…-ZAR | R0 | R9,835.54 | R16,064.01 | R108,002.30 | +R91,938.29 |

**Total recorded CCR EAD: R1,030,158.67 → R151,213.59 (net −R878,945.08).** This is the credit-exposure input to CreditRWA (× risk-weight × 12.5 for the capital requirement) and, once the BA-700 derivative-exposure component is chained to the CCR event of record, the leverage-exposure measure. The Investec RC collapsing to R0 confirms the defect: the defective FX-sum N-counted a cumulative mark that nets adverse (negative V) at the valuation point, so the correct unmargined RC = max(V, 0) = 0.

## Proof

- \`recon:v2-saccr-parity\` HARD GATE GREEN: 0 byte-diffs (v1-recompute == v2 over identical FIL-mediated inputs) over the 2 recorded netting sets. The recorded-vs-feed oracle divergences are SURFACED as \`warn\` (the defect manifesting), not forced.
- \`recon:ccr-single-emitter\`: PASS (1 v2-sourced emitter; v1 resolveMtm retired).
- \`bun run ci\`: GREEN on clean GH CI. (Locally only \`recon:event-store-append-only\` fails on the pre-existing home-store archive-partition gap, D-EVENT-STORE-SCALING-PHASE-5 — env-only, passes on CI.)
- \`validationStatus\` on the FIL-Models registry row: \`validation-approved\`.

## Substrate gap surfaced

The projection's CCR-event-of-record selection is latest-by-\`computationDate\` with first-seen-wins on ties, so a same-date correction cannot supersede a defective same-date event without touching consumer logic (out of scope). The cutover therefore stamps the correction at a later computationDate while pricing the recorded-date book — which leaves a permanent \`recon:v2-saccr-parity\` oracle \`warn\` (the restatement's valuation date differs from its stamp). A future slice could add an explicit \`CcrFigureSuperseded\`/restatement event type so a correction is unambiguously the event of record at the original valuation date. Tracked as \`GAP-CCR-RESTATEMENT-AT-ORIGINAL-DATE\`.
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
      title:
        "SA-CCR alias-flip cutover — v2 sole live emitter, v1 retired, recorded RC/EAD corrected",
      path: "2026-06-13_rohan_saccr-alias-flip-cutover.md",
      category: "model-cutover",
      author: "Rohan (Risk Engineer, engineering)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      recordId: RECORD_ID,
      recordFiledEventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
