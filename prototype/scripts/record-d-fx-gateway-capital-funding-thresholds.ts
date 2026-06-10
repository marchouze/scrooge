// scripts/record-d-fx-gateway-capital-funding-thresholds.ts
//
// Records D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS phase APPROVED — the CRO
// ratification of the FX pre-trade gateway capital-impact + funding threshold
// schedule, resolving the requested-phase decision raised in PR #1181.
// Authority: Helena (Chief Risk Officer, governance) — seat authority per the
// decision-authority routing table (risk-appetite calibration → CRO); funding
// leg co-owned by Ravi (Treasury / ALM engineer, engineering) → Eitan
// (Treasurer) for ALCO/Treasury. Dispatch authority: D-QUEUE-CLOSEOUT-2026-06-10
// (CEO, 2026-06-10), brief
// brief:helena:ratify-fx-pre-trade-gateway-capital-impact-fundi:2026-06-10.
//
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-fx-gateway-capital-funding-thresholds.ts

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-10T17:20:00.000Z";

recordDecision(
  {
    decisionId: "D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS",
    phase: "approved",
    authority: "CRO",
    authorityRef: "agent:helena:cro",
    actor: { type: "service", id: "agent:helena:cro" },
    title: "Pre-trade gateway capital-impact + funding thresholds (CRO + ALCO/Treasury)",
    category: "risk",
    recommendation:
      "RATIFIED threshold schedule (canonical typed source: platform/risk/fx-gateway-thresholds.ts; every number a named, cited constant or RAS-register band). " +
      "(1) CAPITAL-IMPACT — basis (a), RAS §B3 capital appetite operationalised as a pro-forma RWA ceiling: the gateway must not admit an order whose pro-forma RWA would consume capital headroom past the RAS amber / CEO-escalation line. " +
      "Ceiling = (R300m ICAAP v1 build-phase capital envelope [capital.build-phase.total-capital-minor] − R100m RAS amber headroom floor [capital.threshold.ceo-escalation-minor]) / 12.0% operating minimum total capital ratio [capital.gateway.operating-minimum-total-capital-ratio: 8.0% Banks Act Reg 38 Pillar-1 base + 2.5% CCB + 0.0% Pillar-2A build-phase + 1.5pp RAS §B3 operating buffer] = R1,666,666,666 (floored, conservative). " +
      "Current RWA prefers the RwaComputed event-of-record (D-RWA-ENGINE-W2-SLICE-3); fallback ICAAP v1 baseline R73.75m [capital.build-phase.total-rwa-minor]. Per-instrument-class weights: CRO-owned rwa.instrument-weight registry (Reg38-CRE20); an unknown class REJECTS. " +
      "(2) FUNDING/LCR — basis (b), the RAS LCR operating buffer, NOT the bare BCBS 238 100% minimum: post-trade LCR floor = 110%, sourced LIVE from the RAS appetite register (appetite:liquidity:lcr amber lower bound = RAS §B3 red boundary / management-action trigger). Build-phase current-LCR baseline 150% [lcr.gateway.build-phase-baseline-pct] until the live LCR observation chain lands; outflow model 0.5pp per R1m ZAR notional [lcr.gateway.outflow-impact-pct-per-million-notional]. " +
      "(3) POSTURE — fail-closed, mirroring D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED: unresolvable order fields, unknown instrument class, or a non-ZAR-projectable quote currency REJECT; sell orders reduce exposure and are admitted without evaluation. " +
      "Enforcement is wired in BOTH paths — the synchronous gateway (routeOrderToGateway) and the async aggregator handler (kai-credit-capital-funding-check, capital-funding-stub.json RETIRED) — through the same shared evaluators, guarded by recon:fx-gateway-threshold-enforcement (fails on any approve-always regression while this decision stands).",
    rationale:
      "CRO ratification by Helena (Chief Risk Officer, governance) under the decision-authority routing table (risk-appetite calibration → CRO); the FUNDING LEG IS CO-OWNED by Ravi (Treasury / ALM engineer, engineering) → Eitan (Treasurer) for ALCO/Treasury: the LCR floor binds the gateway to the Treasury-owned RAS §B3 liquidity appetite (not an improvised number), and the outflow-per-notional model + build-phase LCR baseline are Treasury/ALM calibration constants registered under their co-ownership. " +
      "Basis choices: (1a) over an absolute RWA budget because it derives from already-governed constants (capital envelope, RAS headroom amber line, capital-ratio stack) so a recalibration of any input flows through without re-deciding; (2b) over the bare regulatory minimum because the bank operates at appetite, and a gateway that admits orders into the management-action zone would manufacture its own RAS breaches; (3) fail-closed per the credit-limit precedent — the regulatorily-correct posture. " +
      "Resolves the requested-phase decision raised by Scrooge (PR #1181) from the FX-OTC umbrella NPA roadmap critical-path item 3 residual; dispatch authority D-QUEUE-CLOSEOUT-2026-06-10 (CEO).",
    citations: [
      "D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED",
      "D-QUEUE-CLOSEOUT-2026-06-10",
      "D-RAS",
      "D-RWA-ENGINE-W2-SLICE-3",
      "RAS-B1",
      "ORG-PR-01",
      "Reg38-CRE20",
      "BCBS-238-LCR",
    ],
    // recordedVia vocabulary is schema-constrained; the seat authority is the
    // `authority: "CRO"` field — this suffix records the coordination channel.
    recordedVia: "scrooge:session-delegation:helena-cro-ratification",
  },
  AS_OF,
);

process.exit(0);
