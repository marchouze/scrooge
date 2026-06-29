// scripts/file-nadia-fx-e2e-independent-validation-report.ts
//
// One-shot RMS Phase 3 filing for Nadia's independent second-line validation
// finding report: the FX end-to-end correctness proof (book one trade →
// accounting → BA returns → UI → provenance) under D-FX-E2E-CORRECTNESS-V1.
// Emits a RecordFiled(documents) event so the Documents register holds the
// canonical validation report. Idempotent — skips if already filed.
//
// Authority: D-FX-E2E-CORRECTNESS-V1; D-RMS-PHASE-3.
// Author: Nadia (Independent-validation engineer, second line — validation, risk).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:fx-e2e-independent-validation-report:2026-06-29";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-nadia-fx-e2e-independent-validation-report] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# FX end-to-end independent validation report — book one trade, prove it 100% correct

**Author:** Nadia (Independent-validation engineer, second line — validation, risk, market-risk, credit-risk)
**Date:** 2026-06-29
**Authority:** D-FX-E2E-CORRECTNESS-V1 (CEO-approved)
**Brief:** brief:nadia:fx-end-to-end-independent-proof-book-one-trade-v:2026-06-29
**Run:** run:nadia:2026-06-29T06-40-54-166Z
**Deliverable:** \`prototype/tests/fx-e2e-booking-to-returns.test.ts\` (golden regression proof, 8 tests, green)

## Mandate

Independent, ADVERSARIAL second-line proof that FX trading is 100% correct
end-to-end through the new born-V2 manual desk path (#1610 / #1611 / #1612).
Validated against DOMAIN-TRUTH ORACLES — IFRS 9, IAS 21, SARB Regulations
Relating to Banks reg 28(5) & reg 29(3), SARB Currency & Exchanges Manual,
BCBS D352 — not internal consistency. Method: book ONE concrete specimen and
trace it link-by-link, then attack the chain at its fail-closed seams.

## Specimen

| Field | Value |
|---|---|
| Trade | BUY USD 1,000,000 / SELL ZAR |
| Booked rate | 18.50 (ZAR per USD) |
| Counterparty | onboarded ZA-resident bank → Exchange-Control **authorised-dealer** |
| Trade date | **2026-06-15** (backdated — unmistakably NOT today) |
| Settlement date | **2026-06-17** (T+2 from the BACKDATED trade date — NOT a forced T+2-from-now) |
| Provenance | \`simulated\` / scenario \`operator:manual-desk-booking\` |

## Per-link verdict

| Link | Oracle | Verdict | Evidence |
|---|---|---|---|
| 1. Booking | born-V2; D-FX-INSTRUMENT-BUYSELL-QUAD | **PASS** | Emits \`FilInstrumentCreated\` (assetClass fx), ZERO \`FxTradeExecuted\` (V1 retired). \`economicTerms.tradeDate\`=2026-06-15 EXACTLY (≠ today), \`settlementDate\`=2026-06-17 EXACTLY (no forced T+2). Symmetric quad \`{buy: USD 1,000,000, sell: ZAR 18,500,000}\` — counter leg NOT dropped. Provenance simulated / operator:manual-desk-booking. |
| 2a. Trade-date accounting | IFRS 9 §5.1.1/B3.1.2; IAS 21 | **PASS** | \`postFxInitialRecognitionLegs\` posts EXACTLY 4 legs, ALL off-balance-sheet memorandum (ACC-9100-001/002/003). ZERO on-balance-sheet legs (FVTPL, FV≈0 at inception). Self-balancing PER CURRENCY (USD net 0, ZAR net 0). No \`pnlKind\` at inception. |
| 2b. Cost-basis MTM | IFRS 9 §5.7.1 (FVTPL delta) | **PASS** | With a +1.00 ZAR/USD rate move (18.5→19.5) the unrealised P&L = **R1,000,000** (= signedNotional × (spot − bookedRate)), NOT R19,500,000 (full-notional × spot — the #1610 bug). The impossible full-notional move cannot recur: cost basis is sourced from the \`fxAgreement\` ZAR sell-leg, subtracted from current market value; absent ⇒ fail-closed UNAVAILABLE. |
| 3. BA returns | SARB reg 28(5) & reg 29(3); BCBS D352 §718(xiii) | **PASS** | BA-325 reg-29(3): the USD purchase commitment lands in the **authorised-dealer × USD** cell (R0650/C0010) = 100,000,000 minor; R0750 effective NOP USD = same. BA-320 reg-28(5): USD \`netPositionBaseCurrencyMinor\` = 100,000,000 (= BA-325 R0750 USD) → **reconcile BY CONSTRUCTION**. Reg 28(5) 8% open-position charge present and positive (not zero-filled). |
| 4. UI granularity | Marc's visibility requirement | **PASS** | The trade is a row in the V2 FX blotter with \`tradeDate\`=2026-06-15, \`settlementDate\`=2026-06-17, \`residencyBucket\`=authorised-dealer ("Authorised dealers"), \`counterpartyJurisdiction\`=ZA, \`counterpartySector\`=banking, \`residencyUnmapped\`=false. |
| 5. Provenance coherence | operating-book vs production-only | **PASS** | INCLUDED under operating-book (foldedInstanceCount ≥ 1, link 3). EXCLUDED under production-only (auth-dealer USD = 0, NOP USD = 0) — production stays honest-empty pre-licence. |

## Adversarial angles (fail-closed seams)

| Attack | Verdict | Evidence |
|---|---|---|
| A. Unmappable-residency counterparty (hand-typed, never onboarded) | **PASS (fails closed)** | The position is NOT folded into any residency row; it is surfaced LOUDLY in \`unmappable[]\` with a reason ("could not be classified … register the party …"). Never silently misclassified to a default bucket. |
| B. Currency pair with NO market rate (CHF/ZAR, empty market store) | **PASS (fails closed)** | daily-pnl marks the position UNAVAILABLE: \`unmarkableLivePositions\` ≥ 1, \`unrealisedComplete\`=false, \`totalUnrealised.present\`=false. Never a silent zero or fabricated number. |
| C. Cost-basis MTM with a real rate move | **PASS** | Covered in link 2b — magnitude is the delta, not the full notional. |

## Findings (consistent-but-wrong / fail-open / domain-divergence)

No HIGH or blocking findings. The chain is domain-truth correct end-to-end. Two
LOW documentation-coherence observations (cosmetic; NOT correctness defects;
routed to the coordinator, not fixed in-line per second-line independence):

1. **LOW — stale doc comment in \`dashboard/trade-book-view.ts\` (\`bookFxTrade\` JSDoc, ~L1118-1124).**
   The function header still narrates the OLD provenance policy ("a manually-booked
   trade during the build phase … → tagged \`build-phase-fixture\` (NOT production …
   NOT simulated)"). The CODE (≈L1257) correctly tags \`simulated\` /
   \`operator:manual-desk-booking\`, and a later comment block (L1240-1264) explains
   the correct policy. The contradictory earlier header is consistent-but-wrong
   prose that could mislead a future reader. Recommend the coordinator route a
   one-line doc fix (no behaviour change).

2. **LOW — comment/shape mismatch in \`ba-325-reg29-fx-residency-fold.ts\` (~L350-356).**
   The foreign-leg-amount comment describes the simulator's ANCHOR-book shape
   ("the canonical FIL FX notional is ZAR-denominated against the foreign base"),
   whereas the MANUAL desk path books the FOREIGN leg as the notional
   (\`notional.currency\`=USD). The fold's RESULT is correct for BOTH shapes (it
   keys the column on \`hedgingSetTag\` base and converts \`notional.amount\` in its
   own currency), but the comment only describes one shape. Cosmetic; recommend a
   comment refresh to cover both materialisations.

## Residuals (named, not blockers)

- **Settlement realisation is out of Lane-1 scope.** The born-V2 booking path does
  NOT trigger settlement (no \`FilInstrumentTerminated\` / realised-P&L on the value
  date); the enriched FX settlement event family (D-FIL-FX-SETTLEMENT-EVENTS) exists
  but is not exercised by the manual desk path. End-to-end "100% correct" is proven
  for booking → trade-date accounting → revaluation MTM → BA returns → UI →
  provenance. The settlement/derecognition leg is a separate, tracked extension.
- **Backdating into a closed period.** Marc chose UNRESTRICTED backdating; the path
  aligns \`as_of\` to the backdated trade date so postings fold into the correct
  (back) period — coherent. A backdated trade into a period whose return was already
  computed would change that figure on re-derivation; this is a REPORTING-INTEGRITY
  consideration (an as-of/amended-return discipline), flagged here as a residual for
  the returns-of-record process, NOT a code defect.
- **Licence-day counterparty POPULATION** (gap \`ba325-reg29-fx-residency-detail\`)
  remains the only DATA deferral — the fold is provable today against the sim book.

## Overall verdict

**FX is independently validated as correct end-to-end for the booking →
accounting → BA-returns → UI → provenance chain**, against the IFRS 9 / IAS 21 /
SARB reg 28(5) & reg 29(3) / BCBS oracles, with all fail-closed seams holding.
The #1610 cost-basis MTM fix is proven (delta, not full-notional). The two LOW
findings are documentation-coherence only. The named residual — settlement
realisation — bounds the "100% correct end-to-end" claim to the pre-settlement
lifecycle; within that boundary the chain is correct. The golden test
\`tests/fx-e2e-booking-to-returns.test.ts\` is the durable regression proof.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-FX-E2E-CORRECTNESS-V1"],
    actor: {
      type: "service",
      id: "agent:nadia:validation",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "FX end-to-end independent validation report — book one trade, prove it 100% correct",
      path: "2026-06-29_nadia_fx-e2e-independent-validation-report.md",
      category: "validation-finding",
      author: "Nadia (Independent-validation engineer, second line — validation, risk)",
      date: "2026-06-29",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
