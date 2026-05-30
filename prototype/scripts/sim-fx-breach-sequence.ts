#!/usr/bin/env bun
// Simulated market action sequence — FX NOP breach response
// Actors: Ravi (breach detection) → Eitan (decision + escalation)
// Provenance: sim (build-phase action simulation; no real trades executed)

import { eventStore } from "../platform/composition";
import { makeAgentDecision, makeAgentEscalation } from "../platform/event-store/event-types/agent";
import { makeFXPositionBreach } from "../platform/event-store/event-types/markets-trading-extended";

const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = new Date().toISOString();
const AS_OF_DATE = AS_OF.slice(0, 10);

const B3_CURRENT_ZAR = 233_850_085;
const B3_LIMIT_ZAR = 200_000_000;
const BREACH_PCT = B3_CURRENT_ZAR / B3_LIMIT_ZAR;
const EXCESS_ZAR = B3_CURRENT_ZAR - B3_LIMIT_ZAR;
const TARGET_NOP_ZAR = 180_000_000;
const REDUCTION_NEEDED_ZAR = B3_CURRENT_ZAR - TARGET_NOP_ZAR;

console.log("=== Simulated FX Breach Response Sequence ===");
console.log(`B3 current: ZAR ${(B3_CURRENT_ZAR / 1e6).toFixed(1)}M`);
console.log(`B3 limit:   ZAR ${(B3_LIMIT_ZAR / 1e6).toFixed(1)}M`);
console.log(
  `Excess:     ZAR ${(EXCESS_ZAR / 1e6).toFixed(1)}M  (${((BREACH_PCT - 1) * 100).toFixed(1)}% over)`,
);
console.log("");

// Step 1 — Ravi emits FXPositionBreach
const breachEvent = makeFXPositionBreach({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:ravi:intraday-stress" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001", "BCBS-D457"],
  payload: {
    breachId: `B3-BREACH-${AS_OF_DATE}`,
    currencyPair: "USD/ZAR+EUR/ZAR+GBP/ZAR",
    positionAmount: B3_CURRENT_ZAR,
    limitAmount: B3_LIMIT_ZAR,
    breachPct: BREACH_PCT,
    detectedAt: AS_OF,
    severity: "breach",
    reportingCurrency: "ZAR",
  },
});
eventStore.append(breachEvent);
console.log(`[1] Ravi → FXPositionBreach  breachId=B3-BREACH-${AS_OF_DATE}  severity=breach`);

// Step 2 — Eitan AgentDecision: direct Saskia to reduce NOP
const eitanDecision = makeAgentDecision({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:eitan" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001", "PROC-FX-POSITION-GOVERNANCE"],
  payload: {
    decisionId: `EITAN-FX-REDUCE-${AS_OF_DATE}`,
    decidedBy: "agent:eitan",
    what: `Instruct Saskia to reduce FX NOP by ZAR ${(REDUCTION_NEEDED_ZAR / 1e6).toFixed(1)}M — target NOP ≤ ZAR ${(TARGET_NOP_ZAR / 1e6).toFixed(0)}M. Execute via OTC USD/ZAR sells through correspondent. Settlement T+2. Book: FX-TRADING.`,
    // `inScopeBy` must match an entry in Eitan's registered `decisionsInScope`
    // (asserted by recon:agent-scope) — it is the mandate that authorizes the act.
    inScopeBy: "Approve FX-position adjustments within Excon",
    options: ["reduce-nop-via-usd-zar-sell", "request-limit-recalibration", "escalate-only"],
    chosen: "reduce-nop-via-usd-zar-sell",
    rationale: `B3 NOP ZAR ${(B3_CURRENT_ZAR / 1e6).toFixed(1)}M exceeds RAS limit ZAR ${(B3_LIMIT_ZAR / 1e6).toFixed(0)}M by ${((BREACH_PCT - 1) * 100).toFixed(1)}%. Intraday unwind within Eitan §9 authority. Target ZAR ${(TARGET_NOP_ZAR / 1e6).toFixed(0)}M preserves 10% headroom per ALCO standing practice. Limit recalibration deferred — requires Helena sign-off, >24h timeline.`,
  },
});
eventStore.append(eitanDecision);
console.log(
  `[2] Eitan → AgentDecision    decisionId=EITAN-FX-REDUCE-${AS_OF_DATE}  chosen=reduce-nop-via-usd-zar-sell  reduction=ZAR ${(REDUCTION_NEEDED_ZAR / 1e6).toFixed(1)}M`,
);

// Step 3 — Eitan AgentEscalation: notify Helena + CEO (§10 SLA ≤1h)
const escalation = makeAgentEscalation({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:eitan" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001", "TEAM-EITAN-SPEC-S10"],
  payload: {
    escalationId: `ESC-FX-B3-${AS_OF_DATE}`,
    raisedBy: "agent:eitan",
    question: `B3 FX NOP breach: ZAR ${(B3_CURRENT_ZAR / 1e6).toFixed(1)}M vs limit ZAR ${(B3_LIMIT_ZAR / 1e6).toFixed(0)}M (${((BREACH_PCT - 1) * 100).toFixed(1)}% over). Eitan has directed Saskia to unwind ZAR ${(REDUCTION_NEEDED_ZAR / 1e6).toFixed(1)}M via USD/ZAR sells to reach ZAR ${(TARGET_NOP_ZAR / 1e6).toFixed(0)}M target. Notifying Helena + CEO per §10. Approve intraday unwind strategy or request appetite change?`,
    options: [
      "approve-intraday-unwind-strategy",
      "request-limit-recalibration",
      "escalate-to-board",
    ],
    blockedBy: "B3-NOP-breach-resolution",
    deadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    severity: "high",
    routedTo: "agent:helena,marc@tgv.co.za",
  },
});
eventStore.append(escalation);
console.log(
  `[3] Eitan → AgentEscalation  escalationId=ESC-FX-B3-${AS_OF_DATE}  routedTo=helena+CEO  deadline=1h`,
);

console.log("");
console.log("=== 3 events emitted. ===");
console.log("Outstanding:");
console.log("  · Helena/CEO → AgentEscalationDecided on ESC-FX-B3");
console.log(
  `  · Saskia → FxTradeExecuted (USD/ZAR sells, ZAR ${(REDUCTION_NEEDED_ZAR / 1e6).toFixed(1)}M notional)`,
);
console.log(`  · Ravi → NOP recompute confirming B3 < ZAR ${(TARGET_NOP_ZAR / 1e6).toFixed(0)}M`);
