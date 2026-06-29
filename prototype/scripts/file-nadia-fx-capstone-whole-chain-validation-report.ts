// scripts/file-nadia-fx-capstone-whole-chain-validation-report.ts
//
// One-shot RMS Phase 3 filing for Nadia's CAPSTONE independent second-line
// validation of the WHOLE settled-FX accounting chain (book → settle → EOD-MTM →
// convert) on a MULTI-TRADE book, under D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1. Emits:
//   1. RecordFiled(documents) — the final per-link PASS/FAIL validation report with
//      the independent overall verdict on FX end-to-end correctness + the per-entry
//      ZAR invariant proven pre- and post-MTM.
//   2. ValidationFindingClosed — closes the MEDIUM clearing-account finding
//      (finding:nadia:fx-settlement-clearing-account-standing-balance:2026-06-29),
//      remediated by #1617/#1618: a deliverable PvP spot now posts NO clearing leg,
//      so ACC-2100-027 is EMPTY at settlement (independently re-proven across all
//      four capstone trades).
// Idempotent — skips whichever is already present.
//
// Authority: D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1; D-GL-FUNCTIONAL-CURRENCY-
//   BALANCING-V1; D-FX-SETTLEMENT-REALISATION-V1; D-FX-REALISATION-COMPLETION-V1;
//   D-FX-E2E-CORRECTNESS-V1; D-RMS-PHASE-3.
// Author: Nadia (Independent-validation engineer, second line — validation, risk).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { makeValidationFindingClosed } from "../platform/event-store/event-types/model-risk";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:nadia:fx-capstone-whole-chain-validation-report:2026-06-29";
const CLEARING_FINDING_ID =
  "finding:nadia:fx-settlement-clearing-account-standing-balance:2026-06-29";

const body = `# CAPSTONE — independent validation of the WHOLE settled-FX accounting chain (book → settle → EOD-MTM → convert) on a multi-trade book

**Author:** Nadia (Independent-validation engineer, second line — validation, risk, market-risk, credit-risk)
**Date:** 2026-06-29
**Authority:** D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1 (CEO-approved 2026-06-29)
**Brief:** brief:nadia:capstone-comprehensive-independent-proof-of-whol:2026-06-29
**Run:** run:nadia:2026-06-29T13-42-30-308Z
**Subject of validation:** the FX correctness programme end-to-end — booking #1611, UI #1612, provenance/cost-basis #1610, e2e proof #1613, settlement #1614, settlement proof #1615, realisation+NOP #1616, functional-currency TB + clearing #1617, EOD-MTM per-entry balance #1618.
**Deliverable:** \`prototype/tests/fx-e2e-capstone-whole-chain.test.ts\` (multi-trade golden e2e, 11 tests, green) + this report.

## DECISION-REQUIRED FIRST

- **MEDIUM clearing-account finding (\`${CLEARING_FINDING_ID}\`) → CLOSED.** My independent evidence confirms #1617/#1618 remediated it: a deliverable PvP spot now posts NO clearing leg at all, so ACC-2100-027 is EMPTY at settlement (zero, not "smaller") for ALL FOUR capstone trades. This filing emits the \`ValidationFindingClosed\`. No CEO action required — surfaced for awareness.
- **No HIGH / BLOCKING findings.** No new findings raised. The chain is independently validated correct end-to-end through realisation, with the TB balancing both sides of MTM. Two bounded residuals are named below (neither blocks).

## Mandate

FINAL, ADVERSARIAL second-line proof that the whole chain holds on a MULTI-TRADE
book — validated against DOMAIN-TRUTH ORACLES (IFRS 9; IAS 21 §21/§23/§28; SARB Reg
28(5)/29(3)), not internal consistency. The headline per-entry ZAR invariant was
recomputed INDEPENDENTLY from first principles (translating each leg at the rate its
own settlement implies), NOT by trusting \`recon:gl-per-entry-zar-balance\`.

## The multi-trade book (varied counterparty / pair / direction; one backdated)

| Trade | Side | Pair | Notional | Rate | Trade / value date | Note |
|---|---|---|---|---|---|---|
| T1 | BUY | USD/ZAR | 1,000,000 | 18.50 | 2026-06-15 / 06-17 | long USD |
| T2 | SELL | EUR/ZAR | 500,000 | 20.00 | 2026-06-15 / 06-17 | short EUR (opposite direction) |
| T3 | BUY | USD/ZAR | 400,000 | 18.70 | 2026-06-16 / 06-18 | same FCY as T1 (netting) |
| T4 | BUY | USD/ZAR | 250,000 | 18.40 | 2026-06-10 / 06-12 | BACKDATED (trade + value in a past period) |

Counterparty: onboarded ZA-resident bank → Exchange-Control authorised-dealer.

## Per-link verdict

| Link | Oracle | Verdict | Evidence |
|---|---|---|---|
| **1 — Booking** | IFRS 9 §5.1.1/B3.1.2; D-FX-INSTRUMENT-BUYSELL-QUAD | **PASS** | Every trade books a born-V2 \`FilInstrumentCreated\` (no V1 \`FxTradeExecuted\`), exact user trade+settlement dates (no auto-increment), the symmetric buy/sell quad (base notional + ZAR counter-leg = notional × rate), \`simulated\`/\`operator:manual-desk-booking\` provenance, \`direction\` = long/short by side. Trade-date posts ONLY OBS memorandum legs (ACC-9100-*), ZERO on-balance-sheet, no P&L (FVTPL, FV≈0 at inception); OBS self-balances per currency. |
| **2 — Per-entry ZAR balance (headline)** | IAS 21 §21; D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1 | **PASS** | INDEPENDENTLY recomputed: every booking + settlement entry's Dr/Cr legs, translated to ZAR at the rate THAT TRADE's own settlement implies (\`|ZAR settled| / |FCY settled|\`), net to ~0 (max residual < R1, rounding-scale). The conversion entry balances at its own rate (USD leg @ cost basis vs ZAR legs). Because every entry is ZAR-balanced, the sum is ZAR-balanced — pre- AND post-MTM (links 4). NOT a call into the recon gate. |
| **3 — Settlement** | IAS 21 §23; standard PvP nostro-to-nostro | **PASS** | Clearing account (ACC-2100-027) is EMPTY for every trade — \`netByCcy\` size 0, zero in USD/EUR/ZAR (the MEDIUM finding, REMEDIATED — confirmed zero, not "smaller"). Realised P&L (ACC-2100-006) = 0 at settlement (P&L-neutral form-change). Cash materialises in its OWN currency (USD nostro +1.4m across T1/T3/T4; EUR nostro −0.5m on T2). |
| **4 — EOD-MTM** | IAS 21 §23 (retranslation), §28 (FVTPL, never OCI) | **PASS** | On the multi-trade settled book the ZAR TB balances POST-MTM (residual 0, \`inBalance=true\`) AND PRE-MTM (residual 0). The reval RAN (not a vacuous zero): ACC-1200-099 retranslation adjustment is equal-and-opposite to ACC-2100-005 unrealised P&L (FVTPL); independently, every reval entry's two ZAR legs net to zero. A MISSING closing mark fails CLOSED — the held FCY currencies surface in \`unmarkedCurrencies\` and NO reval leg is posted (no silent zero). |
| **5 — Conversion (realisation)** | IAS 21 §28; #1618 designated-currency fix | **PASS** | Converting the settled USD 1m @ 19.25 strikes realised P&L = signedNotional × (convert − booked) = 1,000,000 × (19.25 − 18.50) = +R750,000 (proceeds 19.25m − cost basis 18.50m); position CLOSED. The FCY nostro draw-down leg (ACC-1200-002) is denominated in USD at the FACE amount (1,000,000) — NO ZAR-into-USD-nostro contamination (the #1618 bug cannot recur); \`recon:account-designated-currency\` green. The conversion entry balances in ZAR at its own rate. |
| **6 — BA returns** | SARB Reg 28(5), Reg 29(3) | **PASS** | BA-325 reg-29(3): the long USD purchase commitments land in the authorised-dealer residency cell (\`foldedInstanceCount\` > 0, auth-dealer USD > 0). BA-320 reg-28(5): a USD net-open position exists with an available rate and a positive open-position charge (not zero-filled). The reg-29 residency fold and the reg-28(5) NOP reflect the live book coherently across the lifecycle. |
| **7 — Provenance** | Principle 1; honest-empty pre-licence | **PASS** | The whole chain folds under operating-book (settled USD nostro legs present); EXCLUDED under production-only (zero legs — production stays honest-empty pre-licence, no real FX book). |

## Adversarial seams attacked (all HELD)

| Attack | Verdict | Evidence |
|---|---|---|
| A rate move between settlement and EOD-MTM — magnitude correct, TB still zero? | **PASS** | The reval magnitude is the NET-position retranslation (net FCY × (mark − cost rate)); the equal-and-opposite ZAR legs prove the net was revalued ONCE; TB residual 0 post-MTM. |
| Second EOD-MTM next day — revalue from prior mark (no double-count)? | **PASS (by construction)** | The reval is a pure fold of the settled-cash net position vs the latest closing mark; exactly ONE retranslation leg per revalued currency (a per-trade gross reval would produce more) — it revalues the net, not each trade gross, so re-running is idempotent against the position, not additive. |
| Two trades same FCY (T1+T3 USD) netting in the cash position — reval nets correctly? | **PASS** | \`foldSettledFcyCashPositions\` returns the SUMMED net USD position with a finite positive cost rate (basis/net); the reval acts on the net, not per-trade. |
| Backdated trade (T4) whose settlement + EOD fall in a past period — coherent? | **PASS** | T4 (trade 2026-06-10, value 2026-06-12) settles immediately, its OBS releases, its cash materialises, and it folds into the per-entry ZAR balance identically to the current-period trades. |
| Unprovisioned mark / missing closing rate — fail closed, never a fabricated/silent zero? | **PASS** | Pre-MTM (no marks) book: \`unmarkedCurrencies\` non-empty, ZERO reval legs posted. Fail-closed (Engineering Charter cmd 2). |

## The MEDIUM clearing-account finding — REMEDIATED (closing it)

My Lane-4b finding (\`${CLEARING_FINDING_ID}\`) was that a deliverable spot left an
unbounded STANDING two-currency balance in ACC-2100-027 (the exact negation of the
nostro position, with no wired relief path). #1617 (D-GL-FUNCTIONAL-CURRENCY-
BALANCING-V1, Option A) re-based the TB in-balance invariant to the FUNCTIONAL
currency (IAS 21 §21) — the basis \`recon:gl-currency-dimension-integrity\` already
mandates — which UNBLOCKED the domain-correct treatment: a deliverable PvP spot
settles nostro-to-nostro (both legs same value date, no inter-leg window to bridge),
so NO clearing leg is posted and ACC-2100-027 is EMPTY at settlement. #1618 then
landed the daily EOD-MTM retranslation of the settled FCY cash (the §23 monetary
item) with its §28 P&L contra, so the functional TB balances both sides of MTM.

**Independent re-proof in this capstone:** across ALL FOUR trades the clearing account
carries no balance in any currency (\`netByCcy(FX_CLEARING).size === 0\`); the FX
exposure lives purely as nostro cash; the conversion rule draws down the FCY nostro in
USD and never touches ACC-2100-027. The clearing account is correctly RESERVED for
genuinely sequential-leg settlement (swap near/far) — not deleted. **The finding is
remediated; I am closing it.**

## Engineering integrity (Charter)

- Whole-tree \`bunx tsc --noEmit\`: clean. \`bunx biome check\`: clean.
- Full \`bun run ci\` on a CLEAN isolated store (pinned BANK_EVENT_DB / BANK_V2_ANCHOR_DB / BANK_V2_CONTROL_PLANE_DB): ci:core (8494 tests, 0 fail), ci:migrate, recon:infra (107/0), recon:domain (168/0).
- Load-bearing gates green: \`recon:gl-per-entry-zar-balance\`, \`recon:account-designated-currency\`, \`recon:gl-currency-dimension-integrity\`.
- V1 retirement honoured: the proof imports V2 canonical homes only; the booking path is born-V2 (no V1 \`FxTradeExecuted\`).

## Residuals (named — they bound the verdict)

- **Public-SUT EOD-MTM seam.** The public booking/settle/convert path (\`bookFxTrade\` / \`settleManualFxTrade\` / \`convertFcyToZar\`) is driven against the genuine composition store (Part A). The EOD-MTM TB-balance proof (Part B, link 4) uses the multi-trade settled fixture builder (the recon gate's own \`settledMultiTradeStores\`, re-derived independently) because the public SUT path does not expose a one-call EOD-MTM trigger over an operator-controlled mark set. The reval LOGIC is the production fold (\`deriveFxCashRevalLegs\` / \`buildGlView\`) — the same code the GL view and recon gate run — so this bounds *how* the EOD-MTM is driven in-test, not *what* it computes. A public EOD-MTM run-trigger seam over the manual desk book would let one store carry all of book→settle→EOD→convert; tracked as a substrate gap, not a defect.
- **BA-return cross-suite exactness.** Link 6 asserts the lifecycle is reflected (folded count > 0, auth-dealer USD present, positive NOP charge) rather than a fragile cross-suite exact equality, because the shared composition store accumulates other suites' trades. The by-construction BA-320↔BA-325 reconciliation is proven exactly in the isolated-store Lane-3 proof (\`fx-e2e-booking-to-returns.test.ts\` LINK 3); this capstone confirms coherence on the shared multi-trade book.

## Overall verdict (independent)

**FX is independently validated CORRECT END-TO-END THROUGH REALISATION on a
multi-trade book, with the ZAR trial balance balancing BOTH SIDES of MTM.** Booking
(born-V2, exact dates, buy/sell quad, OBS-only trade date) → accounting (per-entry ZAR
balance, independently recomputed) → BA returns (reg-28(5) NOP + reg-29(3) residency)
→ settlement (clearing EMPTY, P&L-neutral, cash in own currency) → EOD-MTM (§23
retranslation + §28 FVTPL contra; TB residual 0 pre- AND post-MTM; missing mark fails
closed) → realisation (\`FxConversionExecuted\` strikes signedNotional × (convert −
booked); FCY leg in its own currency) — every link holds against the IFRS 9 / IAS 21 /
SARB Reg 28/29 oracles, and every fail-closed seam holds. The MEDIUM clearing-account
finding is REMEDIATED and CLOSED. The verdict is bounded only by the two named
residuals above (the in-test EOD-MTM driver and BA cross-suite exactness), neither of
which is a correctness defect. The golden test
\`tests/fx-e2e-capstone-whole-chain.test.ts\` (11 tests) is the durable regression proof.
`;

// 1) Close the MEDIUM clearing-account finding — remediated by #1617/#1618 and
//    independently re-proven in this capstone (clearing EMPTY across all 4 trades).
const findingRaised = [...eventStore.replay({ type: "ValidationFindingRaised" })].some(
  (e) => (e.payload as { findingId?: string }).findingId === CLEARING_FINDING_ID,
);
const findingAlreadyClosed = [...eventStore.replay({ type: "ValidationFindingClosed" })].some(
  (e) => (e.payload as { findingId?: string }).findingId === CLEARING_FINDING_ID,
);
if (findingRaised && !findingAlreadyClosed) {
  eventStore.append(
    makeValidationFindingClosed({
      asOf: clock.now(),
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:nadia:validation" },
      citations: [
        "D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1",
        "D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1",
        "D-FX-SETTLEMENT-REALISATION-V1",
      ],
      eventId: `${CLEARING_FINDING_ID}:closed:2026-06-29`,
      payload: {
        findingId: CLEARING_FINDING_ID,
        closedBy: "Nadia (Independent-validation engineer, second line — validation, risk)",
        resolution:
          "REMEDIATED by #1617 (D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1, re-based the TB in-balance invariant to the functional currency, unblocking PvP nostro-to-nostro settlement) and #1618 (daily EOD-MTM retranslation of settled FCY cash, IAS 21 §23/§28). A deliverable PvP spot now posts NO clearing leg, so ACC-2100-027 is EMPTY at settlement. Independently re-proven across all four capstone trades (tests/fx-e2e-capstone-whole-chain.test.ts LINK 3 — netByCcy(ACC-2100-027).size === 0 for every trade; the FX exposure lives purely as nostro cash; the conversion rule never touches the clearing account). The clearing account is correctly reserved for genuinely sequential-leg settlement (swap near/far), not deleted.",
        closedAt: clock.now(),
      },
    }),
  );
  console.log(`[file-nadia-fx-capstone] closed finding ${CLEARING_FINDING_ID}`);
} else if (findingAlreadyClosed) {
  console.log(`[file-nadia-fx-capstone] finding ${CLEARING_FINDING_ID} already closed — skipping.`);
} else {
  console.log(
    `[file-nadia-fx-capstone] finding ${CLEARING_FINDING_ID} not found raised — skipping close.`,
  );
}

// 2) File the validation report.
const recordAlready = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (recordAlready) {
  console.log(`[file-nadia-fx-capstone] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

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
    citations: ["D-RMS-PHASE-3", "D-GL-PER-ENTRY-FUNCTIONAL-BALANCE-V1"],
    actor: { type: "service", id: "agent:nadia:validation" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "CAPSTONE — independent validation of the whole settled-FX accounting chain (book → settle → EOD-MTM → convert), multi-trade, per-entry ZAR balance pre- and post-MTM",
      path: "2026-06-29_nadia_fx-capstone-whole-chain-validation-report.md",
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
