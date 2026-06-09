---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T10:19:16.391Z
decision-required: false
---

# Scrooge — CEO decision record: D-IRS-FAMILY-CONVERGE-ACCOUNTING, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-IRS-FAMILY-CONVERGE-ACCOUNTING`
- **Title:** IRS event-family convergence: accounting IrdSwap* is canonical
- **Action:** approve
- **Outcome:** Approved. Converge the IRS lifecycle onto the accounting IrdSwap* family as the single canonical source for GL posting and BA-320 regulatory reporting. The live EOD engine (runEodIrsRevaluation) and the booking/coupon/termination paths emit IrdSwap* events (IrdSwapTradeExecuted/IrdSwapPositionRevalued with bucketed dv01ByTenorBucket + bookDesignation/IrdSwapCouponSettled/IrdSwapTerminated); the markets-CDM Irs* emission is retired or reduced to a trade-domain mirror; CVA repoints to IrdSwap*. Resolves the verified defect: live IRS book (1 IrsTradeBooked + 5 IrsPositionRevalued) currently produces 0 GL postings because GL interpreter + BA-320 key on IrdSwap* which nothing emitted.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Closes WS-BA-RETURNS-IRS-FAMILY-RECONCILE part 1. Matches documented intent in pr-ird.ts (GL keys on IrdSwap*). Historical pre-cutover Irs* events handling (one-time translation vs accept-from-cutover) to be surfaced in the PR, not silently decided. Replay-safety required.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
