// scripts/raise-d-fx-gateway-capital-funding-thresholds.ts
//
// RAISES (does NOT approve) D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS as a
// `requested`-phase Decision attributed to the CRO (with ALCO/Treasury
// co-ownership of the funding leg). This is the "open, awaiting seat decision"
// artifact — it appears in decisionsOpen until the CRO/ALCO decide. Scrooge
// records it at Marc's in-session instruction to raise it; it is NOT a CEO
// approval and emits no downstream dispatch.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/raise-d-fx-gateway-capital-funding-thresholds.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T16:30:00.000Z";

recordDecision(
  {
    decisionId: "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
    phase: "requested",
    authority: "CRO",
    authorityRef: "agent:helena:cro",
    actor: { type: "service", id: "agent:scrooge:chief-of-staff" },
    title: "Pre-trade gateway capital-impact + funding thresholds (CRO + ALCO/Treasury)",
    category: "risk",
    recommendation:
      "DECISION REQUIRED (CRO primary; ALCO/Treasury co-own the funding leg). The synchronous FX pre-trade gateway (routeOrderToGateway) currently leaves the capital-impact and funding checks approve-always; the async aggregator (kai-credit-capital-funding-check) enforces them but only against stubbed thresholds (capital-funding-stub.json: totalRwaLimitZAR, currentRwaZAR, RWA weights; LCR minimumLcrPct, outflowPerMillionNotionalZAR). Three sub-decisions: (1) CAPITAL-IMPACT threshold basis — what pro-forma RWA / capital-headroom ceiling rejects an order? Options: (a) RAS capital-appetite buffer over the Pillar-1 minimum (CET1/T1/Total), (b) an absolute RWA budget, (c) a % of available capital. (2) FUNDING/LCR threshold basis — what post-trade LCR floor rejects an order? Options: (a) the 100% regulatory minimum (BCBS 238), (b) a higher RAS LCR operating buffer (e.g. 110%), (c) an NSFR companion floor. (3) GATEWAY POSTURE for these two checks — fail-closed (reject when the capital/LCR projection is unavailable, mirroring the credit-limit decision D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED) vs fail-open-with-flag in build-phase. Engineering will wire the chosen thresholds into BOTH the sync gateway and the async stub once decided; the numbers must come from CRO RAS calibration + ALCO/Treasury LCR appetite, not be improvised.",
    rationale:
      "Surfaced from the FX-OTC umbrella NPA roadmap (critical-path item 3 residual). The credit-limit check is now fail-closed (D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED, #1177); capital-impact and funding are the remaining unenforced pre-trade checks. Unlike credit-limit (whose 'reject when no approved limit' rule needed no invented number), these require quantitative thresholds that are a CRO risk-appetite + ALCO/Treasury funding-appetite calibration. Raised for decision rather than improvised, per the standing rule not to set regulated capital/liquidity numbers without the owning seat.",
    citations: [
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
      "RAS-B1",
      "ORG-PR-01",
    ],
    recordedVia: "scrooge:session-delegation:raise-capital-funding-thresholds",
  },
  AS_OF,
);

process.exit(0);
