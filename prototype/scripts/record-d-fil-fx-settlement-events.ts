// scripts/record-d-fil-fx-settlement-events.ts
//
// Records D-FIL-FX-SETTLEMENT-EVENTS (CEO-approved 2026-06-18 by Marc in-session
// via Scrooge session-delegation — "proceed as recommended"). Marc is the
// authorising principal; Scrooge is the recording instrument.
//
// The decision: build a richer FIL terminal/settlement event family so the five
// FX completeness posting rules delivered under D-ACCT-FX-IFRS-POSTING-COMPLETENESS
// (PR #1424) fire automatically at fold time, closing their five ProductDeferredGaps.
// New events carry the economic terms the rules consume — notional, settlement
// rate, accumulated reval / OCI, FVOCI election — plus an NDF-fixing event and
// swap near/far settlement events the lifecycle currently lacks.
//
// Idempotent — skips if already approved.

import "../platform/event-store/resolve-event-db-boot";
import { eventStore } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FIL-FX-SETTLEMENT-EVENTS";

const already = [...eventStore.replay({ type: "Decision" })].some((e) => {
  const p = e.payload as { decisionId?: string; phase?: string };
  return p.decisionId === DECISION_ID && p.phase === "approved";
});
if (already) {
  console.log(`[record] ${DECISION_ID} already approved — skipping.`);
  process.exit(0);
}

const r = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    category: "engineering",
    title: "FIL FX settlement/terminal event family to fire the deferred FX posting rules",
    recommendation:
      "Approved (WS-FIL-FX-SETTLEMENT-EVENTS). Extend the FIL instance lifecycle with the economic-term-bearing settlement/terminal event family the five FX completeness posting rules consume: a terminal/settlement event carrying notional, settlement rate, accumulated reval and OCI, and the FVOCI election flag; an NDF-fixing event (fixing rate, contracted rate, settlement currency, no principal exchange); and swap near/far leg settlement events. Wire the existing PR-FX-SETTLE-V2, reworked PR-FX-CLOSE-V2, PR-FX-SWAP-NEAR/FAR-V2, PR-FX-NDF-FIX-V2 and PR-FX-FVOCI-RECLASS-V2 to fold over these events, and close the five ProductDeferredGaps (fx-settlement-realised-pnl-trigger, fx-derecognition-realised-reversal-trigger, fx-swap-near-far-leg-trigger, fx-ndf-fixing-trigger, fx-fvoci-reclass-trigger) once each rule fires and its trial-balance fold balances on real events. Dispatched after PR #1424 merges so the rules and the new events co-locate.",
    rationale:
      "Root-cause finding from the WS-ACCT-FX-COMPLETENESS run (PR #1424): the FX posting logic is implemented and unit-tested, but the FIL terminal event carries no economic terms and no NDF-fixing or swap-leg settlement events exist, so the five rules cannot fold automatically. The gaps were recorded honestly as ProductDeferredGaps rather than silently omitted; this decision authorises the substrate that closes them. No new accounting policy — FX FVTPL/FVOCI is settled; this is the event-family substrate the determined treatment needs.",
    citations: [],
    sourceDocHashes: [],
    followOnDispatch: [{ route: "accounting-engineer:fil-fx-settlement-events" }],
    recordedVia: "scrooge:session-delegation",
  },
  "2026-06-18T06:25:00.000Z",
);
console.log(JSON.stringify({ ok: true, decisionId: DECISION_ID, eventId: r.eventId }, null, 2));
