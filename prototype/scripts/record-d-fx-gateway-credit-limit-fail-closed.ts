// scripts/record-d-fx-gateway-credit-limit-fail-closed.ts
//
// Records D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED (CEO session-delegation):
// the synchronous FX pre-trade gateway (routeOrderToGateway) now enforces the
// credit-limit check FAIL-CLOSED — an order is rejected when the counterparty
// has no loaded, in-good-standing credit limit (or the limit is exhausted/
// expired/stale). This aligns the synchronous (RFQ-UI) gateway with the
// already-fail-closed async runtime aggregator (kai-credit-capital-funding-check).
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-fx-gateway-credit-limit-fail-closed.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T15:00:00.000Z";

recordDecision(
  {
    decisionId: "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "FX pre-trade gateway credit-limit check is FAIL-CLOSED",
    category: "risk",
    recommendation:
      "Wire the synchronous FX pre-trade gateway (routeOrderToGateway) credit-limit check to checkHeadroom, reading the same event store the gateway writes to (threaded). An order is REJECTED when the counterparty has no loaded, in-good-standing credit limit, or when the limit is exhausted/expired/stale — a bank must not trade without an approved credit limit (Credit Risk Policy §1.3; Banks Act Reg 23). This is fail-closed: in build-phase, with no limits loaded, gateway-routed (RFQ-UI) FX orders are rejected at the credit-limit check until real limits load. The autonomous sim trade flow does not route through this gateway and is unaffected.",
    rationale:
      "Critical-path item 3 from the FX-OTC umbrella NPA roadmap. The async runtime aggregator (kai-credit-capital-funding-check) already enforces credit-limit/capital-impact/funding fail-closed; the synchronous gateway enforced only counterparty-eligibility + sanctions, with the other five checks approve-always. Marc chose hard fail-closed (over fail-open-on-missing or build-phase-sim limits) — the regulatorily-correct posture; it avoids both improvising a fail-open policy and inventing per-counterparty credit-limit amounts. capital-impact and funding remain approve-always in the sync path pending CRO/Treasury threshold calibration (the async path uses stubbed thresholds); suitability is redundant with the enforced counterparty-eligibility check and identity is subsumed by sanctions+eligibility.",
    citations: ["D-FX-OTC-NPA-SCOPE-EXPANSION", "D-CREDIT-LIMIT-ENGINE-BUILD", "RAS-B3"],
    recordedVia: "scrooge:session-delegation",
  },
  AS_OF,
);

process.exit(0);
