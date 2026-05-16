// scripts/record-d-group-a-symmetry-fix.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice D — fix Group A symmetry residuals.
//
// The four Group A baseline entries in decision-symmetry-baseline.txt had
// `requested` openers missing from the event store. This script emits
// them idempotently at the correct asOf (before each decision's terminal
// approval event) so the symmetry recon gate passes without a baseline
// suppression entry.
//
// Root cause: these decisions were approved via CEO session-delegation or
// close-out scripts that emitted only terminal (approve) events. The
// migrate:decisions-backfill script couldn't synthesise openers for them
// because their source documents lack standardised frontmatter
// `decision-id` fields in the primary name pattern.
//
// Decisions fixed here:
//   - D-PRINCIPLES-P2-P6-MERGE (approved 2026-05-11T07:44:04.000Z)
//   - D-MARKETS-CAPEX-OVERRUN-REVIEW (decision-required, no terminal yet
//     → emit requested at proposal date)
//   - D-POLICY-DOCUMENT-HOME (approved 2026-05-14T17:11:29.629Z)
//   - D-AGENT-AUTONOMY-OPERATIONAL (approved 2026-05-11T05:25:00.000Z)
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Idempotent: skips emission if the (decisionId, phase) triple is already
// present (projection.byId.get(id).events.some(e => e.phase === 'requested')).
//
// Author: Atlas (Core banking platform architect, engineering)

import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { eventStore } from "../platform/composition";
import { requestDecision } from "../runtime/decisions/record";

// ---------------------------------------------------------------------------
// Check which decisions already have a `requested` event
// ---------------------------------------------------------------------------

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));

function hasPhase(decisionId: string, phase: string): boolean {
  const history = register.byId.get(decisionId);
  if (!history) return false;
  return history.events.some((e) => e.phase === phase);
}

function emitRequestedIfMissing(
  decisionId: string,
  requestedAsOf: string,
  opts: {
    title: string;
    rationale: string;
  },
): void {
  if (hasPhase(decisionId, "requested")) {
    console.log(
      JSON.stringify({
        level: "info",
        msg: `${decisionId}: requested phase already present — skip`,
      }),
    );
    return;
  }
  requestDecision(
    {
      decisionId,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: opts.title,
      category: "governance",
      recommendation: opts.title,
      rationale: opts.rationale,
      sourceDocHashes: [],
      citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
      recordedVia: "backfill:decisions-framework-cutover",
      actor: { type: "human", id: "marc@tgv.co.za" },
    },
    requestedAsOf,
  );
  console.log(
    JSON.stringify({
      level: "info",
      msg: `${decisionId}: emitted requested opener at ${requestedAsOf}`,
    }),
  );
}

// ---------------------------------------------------------------------------
// 1. D-PRINCIPLES-P2-P6-MERGE
//    Approved: 2026-05-11T07:44:04.000Z (PR #215 merge timestamp)
//    Source spec: Owner Inbox/actioned/2026-05-11_owen_d-principles-p2-p6-merge_decision-spec.md
//    Requested opener: day before approval (2026-05-11T00:00:00.000Z)
// ---------------------------------------------------------------------------
emitRequestedIfMissing(
  "D-PRINCIPLES-P2-P6-MERGE",
  "2026-05-11T00:00:00.000Z",
  {
    title: "Principles 2 and 6 — merge into single principle",
    rationale:
      "Backfill: requested opener for D-PRINCIPLES-P2-P6-MERGE. Source: Owen (Company Secretary, governance) decision spec filed 2026-05-11. Approved via PR #215 merge. The CeoDecision approve event was emitted in the close-out script; the requested opener was missing from the event chain.",
  },
);

// ---------------------------------------------------------------------------
// 2. D-MARKETS-CAPEX-OVERRUN-REVIEW
//    Source: Owner Inbox/actioned/2026-05-12_saskia_capex-overrun-flag.md
//    Status: decision-required, filed 2026-05-12. No terminal event in the
//    record (Marc was asked to confirm R45m estimate withdrawn). If no
//    terminal event exists, the decision is open. We emit the requested
//    opener at 2026-05-12.
// ---------------------------------------------------------------------------
emitRequestedIfMissing(
  "D-MARKETS-CAPEX-OVERRUN-REVIEW",
  "2026-05-12T00:00:00.000Z",
  {
    title: "CapEx overrun — R45m prior estimate vs R5m approved envelope",
    rationale:
      "Backfill: requested opener for D-MARKETS-CAPEX-OVERRUN-REVIEW. Source: Saskia (Platform engineer) flag report 2026-05-12. The prior franchise-design estimate carried ~R45m vs the CEO-approved R5m envelope under D-MARKETS-CAPITAL-TIME-SHAPE. Marc was asked to formally confirm the R45m estimate is withdrawn. The requested opener ensures the symmetry chain is valid whether or not a terminal event is subsequently emitted.",
  },
);

// ---------------------------------------------------------------------------
// 3. D-POLICY-DOCUMENT-HOME
//    Approved: 2026-05-14T17:11:29.629Z (Owen decision record)
//    Source: Owner Inbox/2026-05-12_owen_policy-document-home-decision.md
//    Requested opener: proposal date 2026-05-12
// ---------------------------------------------------------------------------
emitRequestedIfMissing(
  "D-POLICY-DOCUMENT-HOME",
  "2026-05-12T00:00:00.000Z",
  {
    title: "Canonical home for policy documents",
    rationale:
      "Backfill: requested opener for D-POLICY-DOCUMENT-HOME. Source: Owen (Company Secretary, governance) decision spec filed 2026-05-12. Approved 2026-05-14 via Scrooge CEO decision record. The CeoDecision approve event was emitted; the requested opener was missing from the event chain.",
  },
);

// ---------------------------------------------------------------------------
// 4. D-AGENT-AUTONOMY-OPERATIONAL
//    Approved: 2026-05-11T05:25:00.000Z (Scrooge CEO decision record)
//    Source: Owner Inbox/actioned/2026-05-11_atlas_agent-autonomy-operational-status-and-delta-brief.md
//    Requested opener: 2026-05-11T00:00:00.000Z (same day, before approval)
// ---------------------------------------------------------------------------
emitRequestedIfMissing(
  "D-AGENT-AUTONOMY-OPERATIONAL",
  "2026-05-11T00:00:00.000Z",
  {
    title: "Agent autonomy — close the four operational gaps to make Principle 6 production-true",
    rationale:
      "Backfill: requested opener for D-AGENT-AUTONOMY-OPERATIONAL. Source: Atlas (Core banking platform architect, engineering) delta brief 2026-05-11. Approved 2026-05-11 via Scrooge CEO decision record (PR #205 context). The CeoDecision approve event was emitted; the requested opener was missing from the event chain.",
  },
);

console.log(
  JSON.stringify({
    level: "info",
    msg: "record-d-group-a-symmetry-fix: complete",
  }),
);
