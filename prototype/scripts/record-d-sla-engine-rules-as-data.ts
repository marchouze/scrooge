// scripts/record-d-sla-engine-rules-as-data.ts
//
// Records D-SLA-ENGINE-RULES-AS-DATA — Marc's in-session approval (2026-06-05)
// to adopt a rules-as-data sub-ledger accounting (SLA) engine and commission
// the Phase-0 design spec as the first deliverable.
//
// Session-delegation: Marc (CEO) approved the plan in-session; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Engineering
// build decision → CEO authority during the build phase.
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import { recordDecision } from "../runtime/decisions/record";

const ASOF = "2026-06-05T09:00:00.000Z";

const result = recordDecision(
  {
    decisionId: "D-SLA-ENGINE-RULES-AS-DATA",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Adopt rules-as-data sub-ledger accounting (SLA) engine; commission Phase-0 spec",
    category: "engineering",
    recommendation:
      "Complete the declarative turn of the existing posting substrate into a rules-as-data SLA " +
      "engine: posting rules become versioned, human-readable YAML/JSON templates; one interpreter " +
      "executes the registry (collapsing the two hard-coded dispatchers); a declarative account " +
      "resolver keyed on (entity, product, currency, jurisdiction, representation); circumstance- " +
      "conditional rule resolution with parallel accounting representations (IFRS + regulatory + tax " +
      "bases from one event); dry-run/preview/approval; runtime reject-loudly. First deliverable is a " +
      "reviewable design spec (Phase 0) authored by Bea; no engine code changes until Marc signs it off.",
    rationale:
      "Posting logic is the artefact an auditor reviews; today it is buried in two hard-coded " +
      "dispatchers plus a metadata-only registry that can drift. The bank already has ~70% of the " +
      "SLA four-layer model; this completes it as a visible, inspectable, versioned artefact and " +
      "makes circumstance-conditional generation (multi-entity, multi-framework, differing " +
      "regulatory requirements) first-class per Principle 5. Plan approved in-session 2026-06-05.",
    citations: [
      "Principles/2-single-graph-discipline.md",
      "Principles/5-multi-currency-entity-country.md",
      "GOV-FRAMEWORK-CEO-RESERVED",
    ],
    followOnDispatch: [
      {
        route: "Bea: author rules-as-data SLA engine design spec (Phase 0)",
        note: "Lands as RMS RecordFiled + markdown render; review by CFO seat + Owen (CoSec).",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, eventId: result.eventId, decisionId: "D-SLA-ENGINE-RULES-AS-DATA" }, null, 2));
