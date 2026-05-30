// scripts/correct-agent-scope-fixtures-2026-05-30.ts
//
// One-shot: emit Principle-1 corrections for two malformed build-phase-fixture
// `AgentDecision` events from the 2026-05-28 FX-breach simulation. The original
// events (emitted by sim-fx-breach-sequence.ts and
// sim-saskia-unwind-ravi-recompute.ts) set `inScopeBy` / `decidedBy` to agent
// IDs rather than registered mandate-scope strings, tripping recon:agent-scope
// (Vera findings F-VERA-20260530-{ZW2R,YGFV,F02J,...}).
//
// Events are immutable (Principle 1) — we do not delete the malformed events.
// We re-emit the same `decisionId` with corrected fields; recon:agent-scope now
// dedups latest-per-decisionId, so the correction supersedes the malformed
// predecessor. The sim scripts are fixed in the same PR so future runs emit the
// correct shape from the start.
//
// Provenance: build-phase-fixture (these remain simulation fixtures, not
// production agent decisions). No production pollution.
//
// Authority: CEO session delegation (Marc, 2026-05-30 "do 1-4").

import { eventStore } from "../platform/composition";
import { makeAgentDecision } from "../platform/event-store/event-types/agent";
import { buildPhaseFixtureTag, sourceLineage } from "../platform/event-store/provenance";

const AS_OF = "2026-05-30T08:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const provenance = buildPhaseFixtureTag({
  sourceLineage: sourceLineage("agent-scope-fixture-correction-2026-05-30"),
});

// --- Eitan: correct inScopeBy (decidedBy "agent:eitan" already resolves) -----
const eitan = makeAgentDecision({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:eitan" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001", "PROC-FX-POSITION-GOVERNANCE"],
  payload: {
    decisionId: "EITAN-FX-REDUCE-2026-05-28",
    decidedBy: "agent:eitan",
    what: "Instruct Saskia to reduce FX NOP by ZAR 53.9M — target NOP ≤ ZAR 180M. Execute via OTC USD/ZAR sells through correspondent. Settlement T+2. Book: FX-TRADING.",
    inScopeBy: "Approve FX-position adjustments within Excon",
    options: ["reduce-nop-via-usd-zar-sell", "request-limit-recalibration", "escalate-only"],
    chosen: "reduce-nop-via-usd-zar-sell",
    rationale:
      "B3 NOP ZAR 233.9M exceeds RAS limit ZAR 200M by 16.9%. Intraday unwind within Eitan §9 authority. Target ZAR 180M preserves 10% headroom per ALCO standing practice. Limit recalibration deferred — requires Helena sign-off, >24h timeline.",
  },
});
eventStore.append({ ...eitan, provenance });

// --- Ravi: correct decidedBy (runner sub-id → agent urn) + inScopeBy ---------
const ravi = makeAgentDecision({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "service", id: "agent:ravi:intraday-stress" },
  citations: ["RAS-B3", "EXCON-OECD-FX-001"],
  payload: {
    decisionId: "RAVI-NOP-RECOMPUTE-2026-05-28",
    decidedBy: "agent:ravi",
    what: "Recompute B3 NOP post-Saskia unwind and confirm limit compliance",
    inScopeBy: "Approve daily LCR / NSFR / IRRBB / FX position attestation",
    options: ["compliant", "still-breaching"],
    chosen: "compliant",
    rationale:
      "Post-unwind B3 NOP = ZAR 180.0M (90.0% of ZAR 200M limit). Saskia executed 2 tranches: USD 2.00M + USD 1.27M at 16.4674 ZAR/USD (settle 2026-05-30). Reduction: ZAR 53.85M. B3 now within target ZAR 180M. Breach ESC-FX-B3-2026-05-28 resolved.",
  },
});
eventStore.append({ ...ravi, provenance });

console.log("corrected:", eitan.event_id, "(EITAN-FX-REDUCE-2026-05-28)");
console.log("corrected:", ravi.event_id, "(RAVI-NOP-RECOMPUTE-2026-05-28)");
