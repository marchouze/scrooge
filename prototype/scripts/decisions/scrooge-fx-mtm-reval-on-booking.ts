// prototype/scripts/decisions/scrooge-fx-mtm-reval-on-booking.ts
// CEO authorisation (Marc, in-session 2026-06-02 via Scrooge session delegation):
// wire FX mark-to-market revaluation to fire inline on every new FxTradeExecuted
// booking, so freshly-booked trades are marked immediately instead of sitting
// unmarked until the next scheduled daily MTM run. Triggered by a dashboard
// banner ("4 position(s) have no mark — MTM feed required") whose true cause was
// that four trades booked at 18:43 post-dated the 18:00 daily MTM run; production
// marks existed for all pairs. Decision event emitted to the shared store;
// recordDecision is idempotent.
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.
import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-FX-MTM-REVAL-ON-BOOKING",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Auto-trigger FX position revaluation inline on each new booking",
    category: "engineering",
    recommendation:
      "Export a scoped single-trade revaluation wrapper (revalueTradeScoped) from runtime/agents/rohan-daily-mtm.ts that reuses the existing per-position revalueOnePosition logic and emits only FxPositionRevalued (+ OfficialMarkAdopted), without MtmRunCompleted / Owner-Inbox deliverable / valuation-adjustment sweep. Call it inline (non-fatal) after each beaGlPostingEngine scoped-posting call in dashboard/trade-book-view.ts so newly-booked FX trades are marked immediately. Mirror the proven scoped GL-posting pattern. The daily 18:00 UTC rohan:daily-mtm run is unchanged and remains the full-portfolio recon pass. Interim mechanism: the LocalEventTriggerBus is in Phase-1 shadow mode, so a subscribesTo:[FxTradeExecuted] handler would not fire in-process today; the inline scoped call is correct until the bus migration lands.",
    rationale:
      "The product-control dashboard flagged 4 positions with no mark / 'MTM feed required'. Root cause was not a missing feed (all pairs had production ticks at 2026-06-01 19:00) but that the four trades were booked at 18:43, after the 18:00 daily MTM run, and no revaluation fired afterwards — the dashboard infers 'unavailable' from the absence of an FxPositionRevalued event. Marking at booking time (alongside the existing inline GL posting) removes the unmarked-window between bookings and scheduled runs.",
    sourceDocHashes: [],
    citations: [
      "urn:decision:bank:D-MARKETS-SCHEMA-FOUNDATION",
      "urn:decision:bank:D-FX-SALES-TRADING-FRONTEND",
      "urn:decision:bank:D-EVENT-VIEW-BOUNDARY-WIRE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
console.log(
  JSON.stringify({ eventId: result.eventId, decisionId: "D-FX-MTM-REVAL-ON-BOOKING" }, null, 2),
);
