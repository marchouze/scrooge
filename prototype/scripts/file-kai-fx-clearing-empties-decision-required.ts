// scripts/file-kai-fx-clearing-empties-decision-required.ts
//
// One-shot RMS Phase 3 filing: Kai's DECISION-REQUIRED brief on Item 1 of
// D-FX-REALISATION-COMPLETION-V1 — remediating Nadia's MEDIUM clearing-account
// finding (finding:nadia:fx-settlement-clearing-account-standing-balance:2026-06-29).
//
// Item 1 as prescribed (post the deliverable-spot cash exchange nostro-to-nostro,
// no clearing leg) is CONFIRMED correct as accounting doctrine but CONFLICTS with a
// hard, enforced system invariant (per-currency trial-balance double-entry). This
// brief records the conflict + two implementable options so the coordinator / CEO
// can rule. Items 2 + 3 of the same decision are DELIVERED (PR #1616).
//
// Events-first authoring (D-RMS-PHASE-3): the markdown is a render of this
// RecordFiled event. Idempotent — skips if already filed.
//
// Authority: D-FX-REALISATION-COMPLETION-V1; D-FX-SETTLEMENT-REALISATION-V1;
//   D-AGENT-DOMAIN-COMPETENCE (premise-challenge duty); Engineering Charter
//   (cmd 1 root-cause; cmd 5 no-silent-deferral — the gap becomes a typed record).
// Author: Kai (Trading systems engineer, engineering — Lane 5a).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:kai:fx-clearing-empties-decision-required:2026-06-29";

const body = `# DECISION-REQUIRED — FX settlement clearing-account "empties-at-settlement" remediation (Item 1)

**Author:** Kai (Trading systems engineer, engineering — Lane 5a)
**Date:** 2026-06-29
**Authority:** D-FX-REALISATION-COMPLETION-V1 (Item 1); D-FX-SETTLEMENT-REALISATION-V1
**Remediates:** finding:nadia:fx-settlement-clearing-account-standing-balance:2026-06-29 (Nadia, MEDIUM)
**Companion deliverable:** PR #1616 (Items 2 + 3 — FxConversionExecuted realisation wiring + BA-320 FCY-cash NOP — DELIVERED, green CI)

## Summary

Item 1 asks me to post the deliverable-spot cash exchange **nostro-to-nostro** (\`Dr USD nostro / Cr ZAR nostro\`, no clearing leg) so the FX settlement clearing account (ACC-2100-027) empties at settlement, per Nadia's domain-truth ruling. I **CONFIRM the accounting doctrine** — but the prescribed entry **breaks a hard, enforced system invariant**, so I have NOT implemented it unilaterally (premise-challenge duty: silently executing a premise that breaks an invariant is a finding). This brief surfaces the conflict + two implementable options for a ruling.

## The doctrine is correct (confirmed against the oracle)

A deliverable FX spot settles **PvP** — both legs on the same value date, simultaneously. A clearing/suspense account exists to BRIDGE an inter-leg timing window; with no window there is nothing legitimate to hold. The current rule (PR-FX-SETTLE-V2 / \`postSettlementMovementLegs\`) posts each cash leg against an equal-and-opposite clearing leg **in the same currency**, leaving ACC-2100-027 carrying \`−USD 1m / +ZAR 18.5m\` for the specimen — the exact negation of the nostro position (redundant), accumulating unbounded across trades, with no wired drain (PR-FX-CONVERT-V2 never touches it). Nadia's ruling is right.

## The conflict (why I did not just implement it)

\`computeTrialBalanceV2.perCurrencyTotals\` (platform/accounting/period-close.ts; platform/projections/gl-projection-v2.ts) enforces **PER-CURRENCY** native double-entry: \`debitMinor === creditMinor\` for EACH currency. Nadia's own S5 golden test (\`tests/fx-e2e-settlement-derecognition.test.ts\`) asserts exactly this across the cycle.

A deliverable FX spot is **inherently cross-currency**. Nadia's prescribed entry \`Dr Cash[USD] 1,000,000 / Cr Cash[ZAR] 18,500,000\` balances in **ZAR-equivalent at the booked rate** (USD 1m × 18.50 = ZAR 18.5m) but **NOT per-currency** (USD has a debit with no USD credit; ZAR has a credit with no ZAR debit). The clearing account is precisely the **same-currency contra** that makes each leg self-balance natively — which is what keeps the trial balance per-currency-balanced AND rate-independent (the clearing leg absorbs the market-vs-booked translation in the GL view's ZAR-equivalent in-balance check too). Removing it without a replacement same-currency contra breaks the per-currency trial balance.

There is **no per-currency-balanced settlement entry for a deliverable spot that does not leave a same-currency standing balance somewhere** — because trade-date recognition here is OFF-BALANCE-SHEET only (PR-FX-001-V2), so there is no on-balance-sheet same-currency receivable/payable to extinguish. "Empties-at-settlement" is therefore only reachable by changing the FX trial-balance in-balance check from per-currency-native to **functional (ZAR) cost-basis equivalence** — an architecture change, not a posting-rule tweak.

## Options for a ruling

**Option A — Re-base the FX trial-balance invariant on functional (ZAR) cost-basis equivalence (Nadia's doctrine, full).** Post nostro-to-nostro (no clearing leg); change \`computeTrialBalanceV2\` to assert in-balance in ZAR-equivalent at the **booked/cost-basis** rate (rate-independent, P&L-neutral) for cross-currency FX entries; update S5 + the per-currency recon gates accordingly. Largest blast radius (trial-balance core + several recon gates + the GL-view in-balance check); the most correct end-state. CEO/Charter-level engineering decision.

**Option B — Give the clearing account a drain path via the conversion (lower blast radius).** Keep settlement as-is (per-currency-balanced via clearing), but have the FCY→ZAR conversion (now wired in PR #1616) ALSO reverse the trade's clearing legs (\`Dr Clearing[USD] / Cr Clearing[ZAR]\`), so the clearing nets to zero per-currency once the position is realised. This fixes finding #4 (no drain path) and the unbounded-accumulation-forever concern (it drains at realisation), stays per-currency-balanced throughout, and is a contained posting-rule change. It does NOT empty clearing AT settlement (it empties at conversion), so it partially addresses the doctrine — clearing still carries the in-flight position between settle and convert. A pragmatic interim that is strictly better than today.

## Recommendation

Recommend **Option A** as the correct end-state (it is the domain-truth doctrine Nadia ruled), gated on a CEO/Charter engineering decision because it re-bases the trial-balance invariant. If a faster partial remediation is wanted now, **Option B** is a contained, per-currency-safe improvement that gives the clearing account a real drain path. Either way, the MEDIUM finding stays OPEN until a ruling lands; Items 2 + 3 (PR #1616) do not depend on it.

## Status of D-FX-REALISATION-COMPLETION-V1

- **Item 1 (clearing empties):** DECISION-REQUIRED (this brief). NOT implemented — conflict with the per-currency trial-balance invariant.
- **Item 2 (realisation wiring):** DELIVERED — PR #1616. FxConversionExecuted (born-V2) strikes realised P&L (IAS 21 §28) end-to-end + closes the position.
- **Item 3 (BA-320 FCY-cash NOP):** DELIVERED — PR #1616. Settled FCY cash now attracts the reg-28(5) net-open-position charge; exposure continuous across settlement.

For Nadia (Lane 5b) to independently validate Items 2 + 3 and to confirm this Item-1 conflict analysis against the per-currency invariant.
`;

const already = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);
if (already) {
  console.log(`[file-kai-fx-clearing-empties] ${RECORD_ID} already filed — skipping.`);
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
    citations: ["D-RMS-PHASE-3", "D-FX-REALISATION-COMPLETION-V1"],
    actor: { type: "service", id: "agent:kai:trading-systems" },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "DECISION-REQUIRED — FX settlement clearing-account empties-at-settlement remediation (Item 1, D-FX-REALISATION-COMPLETION-V1)",
      path: "2026-06-29_kai_fx-clearing-empties-decision-required.md",
      category: "decision-required",
      author: "Kai (Trading systems engineer, engineering — Lane 5a)",
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
