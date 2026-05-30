// prototype/scripts/decisions/scrooge-fx-sim-frontend-input-driver.ts
// CEO authorisation (Marc, in-session 2026-05-30 via Scrooge session delegation):
// FX counterparty sim inputs trades through the front-end trade-book form
// (Claude-in-Chrome) as an external actor, via a reusable parameterised
// browser-driver; the in-process executeFxTrade wiring for the counterparty sim
// is retired. Decision event already emitted to the shared store; recordDecision
// is idempotent so re-running is harmless.
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.
import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-FX-SIM-FRONTEND-INPUT-DRIVER",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "FX counterparty sim inputs trades via the front-end form (Claude-in-Chrome) — reusable browser-driver; retire in-process booking",
    category: "engineering",
    recommendation:
      "Build a reusable parameterised front-end trade-input mechanism for the FX counterparty simulation: a deterministic param-generator (reusing FxRateEngine + SIM_COUNTERPARTIES + generateSimTrade, every spec tagged provenance=simulated), a documented agent-executable browser-driver procedure that books each spec through trade-book.html via Claude-in-Chrome, and retirement of the in-process executeFxTrade booking on the counterparty-fx-request module so the front-end is the canonical input path. Autonomous unattended browser runs are an explicit substrate gap (they need an agent runtime).",
    rationale:
      "A 3rd-party simulator models actors outside the bank; the faithful realisation is transacting through the bank's external web surface, not internal function calls. The in-process coupling was also the wedge vector (separately fixed in PR #912). The browser-driving is necessarily an agent activity, so the deliverable is a reusable driver + procedure an agent runs, with unattended autonomy named as a roadmap gap.",
    sourceDocHashes: [],
    citations: [
      "urn:decision:bank:D-MARKETS-SCHEMA-FOUNDATION",
      "urn:principle:bank:6-autonomous-by-default",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
console.log(
  JSON.stringify(
    { eventId: result.eventId, decisionId: "D-FX-SIM-FRONTEND-INPUT-DRIVER" },
    null,
    2,
  ),
);
