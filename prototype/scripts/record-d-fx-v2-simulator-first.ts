// scripts/record-d-fx-v2-simulator-first.ts
//
// Records one CEO decision approved by Marc in-session 2026-06-20 via Scrooge
// session-delegation (Marc is the authorising principal; Scrooge is the
// recording instrument — recordedVia: scrooge:session-delegation).
//
//   D-FX-V2-SIMULATOR-FIRST — Stop reconciling V1↔V2 for the FX product. V1
//   had too many errors to serve as an authoritative oracle. The FX V2
//   capability is built from base principles and validated against a faithful
//   simulated outside world, not against V1's numbers. The first deliverable
//   is a capable third-party simulator (port & extend the existing V1
//   simulation spine — hub / env-sim / ScenarioClock — to V2) that stands in
//   for every external-world interaction during the test phase. A sharp
//   boundary is binding: the simulator emits ONLY external-party actions and
//   reference data (market rates, counterparty confirmations, settlement
//   statuses, ratings, margin responses, regulator acks, sanctions lists),
//   each tagged `simulated` with scenario provenance; the bank's own V2
//   capability is the system under test and emits only internal events.
//
//   Approved build sequence:
//     Phase 0  — Simulator spine: port & extend V1 hub + behaviour profiles +
//                provenance tagging; build the missing EOD/cadence trigger bus
//                over the clean ScenarioClock; scenario manifest/runner.
//     Phase 1  — Minimal-complete FX E2E driven entirely by the simulator:
//                M1 market-data V2 (forward points + OIS discount curve, not
//                   just spot; retires the flat-discount approximation),
//                M2 counterparty + ISDA/CSA provisioning,
//                M3 trade-confirmation seam (TradeConfirmation* — ends the
//                   instant-booking assumption),
//                M4 EOD-driven daily P&L V2 + VaR V2 over the simulated cohort
//                   (correct-by-construction against the simulator; NO V1
//                   parity gate as the cutover oracle),
//                M5 settlement lifecycle with fail-branching.
//     Phase 2  — Credit-rating feed → Basel class, SA-CCR EAD daily cadence,
//                collateral / margin-call workflow.
//     Phase 3  — Async regulatory ack + remediation, FinSurv/BoP reporting,
//                sanctions list feed + periodic re-screening.
//     Phase 4 (deferred) — PvP/CLS, NDF fixing lifecycle, amendments / early
//                termination.
//
//   First dispatch covers all of Phase 0 + Phase 1.
//
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const APP_AT = "2026-06-20T00:00:00.000Z";
const D = "D-FX-V2-SIMULATOR-FIRST";

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
        "FX V2 simulator-first test strategy — drop V1 parity as oracle; build third-party simulator + Phase 0/1 FX lifecycle",
      recommendation:
        "Approved. (1) V1 is retired as a correctness oracle for the FX product — V1↔V2 reconciliation/parity gates are no longer the cutover basis; the FX V2 capability is built from base principles and validated against a faithful simulated outside world. (2) Build a capable third-party simulator by porting and extending the existing V1 simulation spine (platform/simulation/hub, platform/simulation/env-sim, platform/scenario-clock) to V2; it is the test-phase oracle. (3) Binding boundary: the simulator emits ONLY external-party actions and reference data tagged `simulated` with scenario provenance (market rates, counterparty confirmations, settlement statuses, credit ratings, margin responses, regulator acknowledgements, sanctions lists); the bank's V2 capability is the system under test and emits only internal events — the bank's logic never reaches into the simulator. (4) Approved build sequence — Phase 0: simulator spine + EOD/cadence trigger bus over the clean ScenarioClock + scenario manifest/runner; Phase 1 (minimal-complete FX E2E): M1 market-data V2 forward+OIS (retires flat-discount), M2 counterparty + ISDA/CSA provisioning, M3 trade-confirmation seam, M4 EOD-driven daily P&L V2 + VaR V2 over the simulated cohort (correct-by-construction against the simulator, NOT a V1 parity gate), M5 settlement lifecycle with fail-branching; Phase 2: credit-rating feed → Basel class, SA-CCR daily cadence, collateral/margin-call workflow; Phase 3: async regulatory ack + remediation, FinSurv/BoP, sanctions feed + re-screening; Phase 4 deferred: PvP/CLS, NDF fixing, amendments/early-termination. First dispatch covers all of Phase 0 + Phase 1.",
      rationale:
        "Decided interactively 2026-06-20. The V1 FX stack carried too many errors to act as an authoritative reference, so the prior approach of gating the V2 cutover on V1↔V2 parity (e.g. the A2 daily-P&L and A3 VaR parity recons) is abandoned for FX: parity gates become scaffolding to retire, not targets to satisfy. A simulated outside world is the only honest oracle in the test phase, because there are no real counterparties, markets, correspondents, rating agencies or regulators yet. The existing V1 simulation framework is already event-sourced and provenance-tagged, so porting and extending it is faster to a working oracle than a clean-room rebuild while still being principle-clean. The sharp simulator↔SUT boundary is what makes the end-to-end test meaningful. Scope is FX-first; the spine generalises to other asset classes later. This decision is scoped to FX test strategy and sits under, not over, the bank-wide V1-retirement directive and the Engineering Charter; it cites D-V1-REMOVAL-PHASE2-GAP-A3 and D-FX-OTC-CLOSURE-BACKLOG as the parity-cutover items it supersedes in basis for FX.",
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    APP_AT,
  );
  console.log(`[record] ${D} approved — ${r.eventId}`);
}

// Confirm the decision is not left open.
const stillOpen = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === D && p.phase === "requested";
});
console.log(`[verify] ${D} open(requested) present: ${stillOpen}`);
