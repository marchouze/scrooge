// prototype/scripts/decisions/scrooge-operating-book-provenance-architecture.ts
//
// CEO authorisation (Marc, in-session 2026-06-03 via Scrooge session delegation)
// for the operating-book provenance architecture: separate the lineage/audit axis
// (provenance.kind) from the inclusion axis (a settable, bank-wide, event-sourced
// prod/sim mode + per-category granularity), with one canonical operating-book
// selector replacing the four incompatible filtering patterns, the sandbox simulator
// gated on the bank-wide mode, a unified lifecycle resolver, honest UI badges, and
// recon gates. recordDecision is idempotent so re-running is harmless.
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Operating-book provenance architecture — separate lineage from inclusion; settable bank-wide prod/sim mode with per-category granularity; one canonical operating-book selector",
    category: "engineering",
    recommendation:
      "Stop using provenance.kind as an inclusion filter. (A) Keep provenance.kind (+scenario/variant/sourceLineage) as the immutable lineage/audit axis. (B) Introduce a settable, event-sourced bank-wide mode (sim|prod) replacing the BANK_LIFECYCLE_PHASE/BANK_PHASE/BANK_PROVENANCE_SUBSTRATE_ACTIVE env vars, plus a category->provenance policy table (default under sim: decisions/governance/briefs/agent-runs/build/substrate = production; trades/GL/counterparties/messages/settlement/market-data = simulated), generalising the hardcoded PRODUCTION_CARVE_OUTS. (C) Add one canonical operating-book selector (filter.ts: mode 'operating-book', operatingBookFilter(), eventInOperatingBook()) that every projection/GL/ALM/RWA/recon/dashboard endpoint calls; in sim mode the book = all categories at policy provenance, holding out only explicitly-flagged scenario/stress/rehearsal runs via a reserved tags:['sandbox'] marker plus a scenario-id-prefix fallback (no legacy re-tagging required); flip defaultProvenanceMode to operating-book and correct the inverted liveFlowView. (D) Gate ThirdPartySimHub on the bank-wide mode. (E) Add a unified registry-driven lifecycle resolver (trade-lifecycle-state.ts) so active/matured/cancelled/settled is answered one way across all products. (F) Derive UI pageProvenance from realized folded lineage; add a config page to set the mode + granularity. (G) Lock it in with recon gates: operating-book-selector-coverage, trade-lifecycle-parity (all products), provenance-badge-lineage. Execute as PR1-PR5 per the filed review; PR1 (selector + default flip) is the highest-impact, zero-migration fix.",
    rationale:
      "provenance.kind is overloaded to answer two orthogonal questions: lineage (where did this come from) and inclusion (should this count toward the operating book and its measurements/alerts). Wiring inclusion off lineage via a permanent production-only default meant build-phase operating data tagged 'simulated' was silently dropped from measurements — contrary to the CEO requirement that build phase exercise all functionality, including every measurement and alert, on its operating data. The workaround (a third kind build-phase-fixture admitted only in build phase) plus an inverted ALM liveFlowView produced four incompatible filtering patterns and no single definition of 'the book'. This is the single root cause behind the LCR two-engine split (PR #1003/#1004), the RWA R7.83tn blow-up (PR #996), the '0 settlement instructions' gap (PR #1000), and the recurring fixture-pollution guards. Separating the axes, making inclusion a settable bank-wide policy, and converging on one selector + one lifecycle resolver removes the class of defect rather than patching instances. The legitimate concern behind production-only (scenario runs must not pollute reporting) is preserved exactly by the sandbox marker.",
    sourceDocHashes: [],
    citations: [
      "urn:principle:bank:1-events-are-truth",
      "urn:principle:bank:2-single-graph-discipline",
      "urn:decision:bank:D-PROVENANCE-FILTER-ENFORCEMENT",
      "urn:decision:bank:D-PROVENANCE-BUILD-PHASE-CLASS",
      "urn:decision:bank:D-DATA-PROVENANCE-SUBSTRATE",
      "urn:decision:bank:D-LCR-TILE-PROVENANCE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    { eventId: result.eventId, decisionId: "D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE" },
    null,
    2,
  ),
);
