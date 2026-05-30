// prototype/scripts/decisions/scrooge-market-data-provenance-isolation-hardening.ts
//
// CEO authorisation (Marc, in-session 2026-05-30 via Scrooge session delegation)
// to structurally harden the production/simulated isolation in the
// MarketDataStore so simulated FX ticks can never leak into real MTM/valuation.
// Decision event D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING already emitted to
// the shared store; recordDecision is idempotent so re-running is harmless.
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Harden production/simulated isolation in MarketDataStore — production-only by default; keep the synthetic FX feed",
    category: "engineering",
    recommendation:
      "Make the production/simulated split structural rather than convention-enforced: getLatest() gains a provenance parameter defaulting to production; query() defaults to production when omitted; non-production reads must opt in explicitly; the sim-hub synthetic FX feed is retained (relabelled as synthetic) because it drives the FX trade-sim loop without burning Twelve Data free-tier credits; recon asserts the guarantee survives future edits.",
    rationale:
      "Marc flagged that MTM feeds are production data and must not live in the sim unless the sim produces a genuinely separate simulated feed. The current state already honours that — simulated ticks carry provenance=simulated and all valuation consumers filter to production — but the isolation is convention + a source-grep gate, not the type system. getLatest() has no provenance parameter and query() returns all-provenance when omitted. Making production-only the safe default converts the guarantee from 'every caller remembered to filter' to 'leakage is impossible unless a caller deliberately asks for it'.",
    sourceDocHashes: [],
    citations: [
      "urn:decision:bank:D-MARKETS-SCHEMA-FOUNDATION",
      "urn:principle:bank:1-events-are-truth",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    { eventId: result.eventId, decisionId: "D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING" },
    null,
    2,
  ),
);
