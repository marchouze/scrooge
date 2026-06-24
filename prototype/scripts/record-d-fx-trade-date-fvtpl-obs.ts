// scripts/record-d-fx-trade-date-fvtpl-obs.ts
//
// Records one CEO decision approved by Marc in-session 2026-06-24 via Scrooge
// session-delegation (Marc is the authorising principal; Scrooge is the
// recording instrument — recordedVia: scrooge:session-delegation).
//
//   D-FX-TRADE-DATE-FVTPL-OBS — Fix the FX trade-date GL recognition. The current
//   PR-FX-001-V2 books a meaningless same-currency receivable/payable pair (e.g. a
//   GBP asset AND a GBP liability of equal amount) that nets to zero and drops the
//   counter-currency. Adopt IFRS 9 FVTPL derivative accounting for trading-book FX
//   spot/forward, and reflect the contractual notionals off-balance-sheet in the
//   trial balance.
//
// Analysis: platform/accounting/posting-rules-v2/fx-trade-date-ifrs-analysis.md.
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const APP_AT = "2026-06-24T00:00:00.000Z";
const D = "D-FX-TRADE-DATE-FVTPL-OBS";

function alreadyApproved(decisionId: string): boolean {
  return [...eventStore.replay({ type: "Decision" })].some((e) => {
    const p = e.payload as { decisionId?: string; phase?: string };
    return p.decisionId === decisionId && p.phase === "approved";
  });
}

if (alreadyApproved(D)) {
  console.log(`[record] ${D} already approved — skipping.`);
} else {
  const r = recordDecision(
    {
      decisionId: D,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      category: "engineering",
      title:
        "FX trade-date recognition → IFRS 9 FVTPL derivative; contractual notionals to off-balance-sheet memorandum accounts reflected in the trial balance",
      recommendation:
        "Approved — Policy A (FVTPL) with off-balance-sheet notionals reflected in the trial balance. (1) Remove the current PR-FX-001-V2 same-currency receivable/payable gross-up — it books a GBP asset and a GBP liability of equal amount that net to zero and drop the counter-currency; it is vacuous double-entry and inflates BA-100 gross assets/liabilities. (2) On trade date, recognise the trading-book FX spot/forward as an IFRS 9 derivative at FAIR VALUE — ~0 for an at-market trade, so NO on-balance-sheet gross-up at inception; the position is carried by daily fair-value revaluation through P&L (FVTPL, IFRS 9 §5.7.1). (3) Record the contractual buy/sell notionals (from the fxAgreement quad) in OFF-BALANCE-SHEET MEMORANDUM accounts, self-balancing per currency, and REFLECT THEM IN THE TRIAL BALANCE in a clearly-segregated off-balance-sheet section — excluded from on-balance-sheet asset/liability/equity totals, the GL in-balance check, and the BA-100 on-balance-sheet lines. (4) Correct PR-FX-REVAL-V2 to post the fair-value DELTA to the on-balance-sheet derivative position vs P&L (it currently posts the full notional). (5) Apply the change to BOTH copies of the FX posting logic (the v2-core fold v2-core/posting-rules/fx.ts AND the gl-posting-engine-v2 emitter) so recon:gl-v2-fold-equivalence-fx stays green; add the new OBS memorandum accounts + an off-balance-sheet category to the chart of accounts; classify them off-balance-sheet in the GL/TB view (v2-finance-gl-view.ts) and BA-100. (6) Add a recon assertion that trade-date FX produces NO same-currency on-balance-sheet gross-up and that the contractual notionals land in OBS memorandum accounts; rebaseline recon:gl-v2-fold-equivalence-fx and the BA-100 expectations. Settlement (settle-fx-leg materialising the two cash legs in their own currencies) is already correct and unchanged; market risk (SA-CCR / BA-320, which read the FIL instances) is unaffected.",
      rationale:
        "Decided interactively 2026-06-24 after the CEO observed the live FX simulator's GL raising a GBP asset and a GBP liability for one trade. Analysis (platform/accounting/posting-rules-v2/fx-trade-date-ifrs-analysis.md) confirms PR-FX-001-V2 maps a risk-style single-notional+direction onto a same-currency Dr/Cr pair: economically vacuous and a BA-100 gross-up. Trading-book FX spot/forward is a derivative under IFRS 9; FVTPL (fair value through P&L) is the textbook treatment — at inception fair value ≈ 0 so there is no on-balance-sheet gross receivable/payable, and the position appears through daily MtM. The contractual notionals are a real commitment and the CEO directed they be reflected off-balance-sheet IN the trial balance (memorandum accounts), so gross exposure is visible without commingling with on-balance-sheet assets/liabilities. This sits under the Engineering Charter and the V1-retirement directive; it supersedes the same-currency recognition basis of D-ACCT-FX-IFRS-POSTING-COMPLETENESS for the trade-date rule.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D} approved — ${r.eventId}`);
}

const stillOpen = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === D && p.phase === "requested";
});
console.log(`[verify] ${D} open(requested) present: ${stillOpen}`);
