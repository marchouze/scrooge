// scripts/decisions/record-d-v2-ui-visibility-remediation.ts
//
// Records D-V2-UI-VISIBILITY-REMEDIATION — Marc's in-session approval
// (2026-06-22, "continue as recommended") to commission
// WS-V2-UI-VISIBILITY-REMEDIATION: wire the 44 prose/skeleton V2 pages to the
// projections that already compute, in slices, to the existing
// D-V2-UI-OVERSIGHT-STANDARD. No new policy — the standard already binds; this
// decision tracks the multi-slice workstream and authorises the dispatches.
//
// Backed by the filed finding record:scrooge:v2-ui-visibility-audit:2026-06-22.
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-V2-UI-VISIBILITY-REMEDIATION";
const REQUESTED_ASOF = "2026-06-22T08:05:00.000Z";
const ASOF = "2026-06-22T08:06:00.000Z";

const TITLE =
  "V2 UI visibility remediation — wire the 44 prose/skeleton V2 pages to their existing projections, in slices, to D-V2-UI-OVERSIGHT-STANDARD";

const CITATIONS = [
  "D-V2-UI-OVERSIGHT-STANDARD",
  "Principles/6-autonomous-by-default.md",
  "D-CAPITAL-ASSET-CLASS-V1",
];

const RECOMMENDATION =
  "Commission WS-V2-UI-VISIBILITY-REMEDIATION to close the systemic UI-visibility gap " +
  "(15 of 59 V2 pages wired; 44 prose/skeleton while the backing projections compute). " +
  "Sequence: (1) Capital slice — /api/v2/finance/capital from the capital-composition fold " +
  "+ capital-metrics, wire finance/capital.html with formula + constituents (closes the " +
  "loop on D-CAPITAL-ASSET-CLASS-V1, R300m injection); (2) FX wiring — the /api/v2/markets/fx/* " +
  "suite is already served, wire markets/fx.html; (3) financial-metrics sweep (LCR/NSFR/ALM, " +
  "market/credit/op risk, GL/P&L); (4) reports viewer + registers + Errors/Decision-Required. " +
  "Each slice is its own PR built to the standard (drill-through, provenance badge, name-free, " +
  "recon:provenance-badge-coverage). Dispatch under the no-pause rule.";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-22).",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "Marc approved in-session 2026-06-22 ('continue as recommended') after Scrooge's V2 UI " +
      "visibility audit (record:scrooge:v2-ui-visibility-audit:2026-06-22) found 44 of 59 V2 " +
      "pages are prose/skeleton while their projections already compute — a systemic breach of " +
      "D-V2-UI-OVERSIGHT-STANDARD. Oversight is only real if the human can see what the AI is " +
      "doing across every function (Principle 6). No new policy is needed; the standard already " +
      "binds. This decision tracks the slice workstream and authorises the dispatches.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
