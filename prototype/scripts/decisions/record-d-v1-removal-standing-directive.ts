// scripts/decisions/record-d-v1-removal-standing-directive.ts
//
// Records D-V1-REMOVAL-STANDING-DIRECTIVE — Marc's in-session approval
// (2026-06-19) extending D-V1-REMOVAL-PHASE-1 into a STANDING directive:
// (1) never embed new V1 dependency, and (2) actively retire all V1 code
// near-term. Backs the new "V1 retirement — no new dependency, near-term
// full removal" subsection added to CLAUDE.md, so that section is no longer
// markdown-without-event (Principle 1).
//
// DECISION:
//   Two binding rules, no exceptions absent a recorded Decision:
//     1. New code never imports V1 modules (route through v2-core/ canonical
//        homes, never the v1 re-export shims) and never emits `v1-only` event
//        types — every new event type is born V2 (v2status v2-parallel or
//        v2-replaced). The v1-only count is harden-only and must trend to zero.
//        Adding any new v1-only type or V1 importer requires an explicit
//        CEO-approved Decision (category engineering).
//     2. V1 removal is a standing build-phase priority, not background cleanup.
//        Whenever an agent touches a module that still depends on V1 it retires
//        that dependency in the same change wherever feasible (root-cause, not
//        defer), flipping types v1-only -> v2-parallel -> v2-replaced and
//        ratcheting the baseline down in the same PR. Target end-state: zero
//        v1-only event types and zero v1 re-export shims.
//
//   Enforced by the four existing recon gates: recon:v2-no-v1-import,
//   recon:v1-removal-ratchet (baseline 585 as of 2026-06-15, decreases only),
//   recon:v1-removal-v2status-coverage, recon:v1-only-count-trend.
//
// Category: engineering build decision (substrate / platform / schema) —
//   CEO authority during the build phase per the decision-authority routing
//   table.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-19T12:10:00.000Z";
const ASOF = "2026-06-19T12:11:00.000Z";

const TITLE =
  "Standing V1-retirement directive — never embed new V1 dependency; actively retire all V1 code near-term";

const CITATIONS = [
  "D-V1-REMOVAL-PHASE-1",
  "D-ENGINEERING-INTEGRITY-CHARTER",
  "Engineering-Charter.md",
  "CLAUDE.md",
];

const RECOMMENDATION =
  "Extend D-V1-REMOVAL-PHASE-1 into a standing directive with two binding " +
  "rules: (1) never embed new V1 dependency — new code never imports V1 " +
  "modules (route through the v2-core/ canonical homes, never the v1 " +
  "re-export shims) and never emits `v1-only` event types; every new event " +
  "type is born V2 (v2status v2-parallel or v2-replaced); the v1-only count " +
  "is harden-only and trends to zero; adding any new v1-only type or V1 " +
  "importer requires an explicit CEO-approved engineering Decision. (2) " +
  "Actively retire V1 near-term — whenever an agent touches a module that " +
  "still depends on V1 it retires that dependency in the same change wherever " +
  "feasible (root-cause, not defer), flipping types v1-only -> v2-parallel -> " +
  "v2-replaced and ratcheting the baseline down in the same PR. Target " +
  "end-state: zero v1-only event types and zero v1 re-export shims. Enforced " +
  "by recon:v2-no-v1-import, recon:v1-removal-ratchet, " +
  "recon:v1-removal-v2status-coverage, recon:v1-only-count-trend.";

const RATIONALE =
  "D-V1-REMOVAL-PHASE-1 (2026-06-15) tagged the v1-only estate (baseline 585) " +
  "and stood up the ratchet, but framed removal as harden-only drift control " +
  "rather than an active retirement programme. Marc's 2026-06-19 directive " +
  "raises it to a standing build-phase priority: stop adding V1 dependency at " +
  "all, and drive the existing estate to zero in the near term rather than " +
  "letting it decay slowly. This is the V1 analogue of the no-further-embed " +
  "stance taken on minor-unit money (D-V2-CORE-MONEY-DECIMAL-NATIVE) and " +
  "follows Engineering Charter commands 1 (root-cause), 4 (source, don't " +
  "hardcode), 5 (no silent deferral) and 3 (ratchets harden only). Encoded as " +
  "the new 'V1 retirement — no new dependency, near-term full removal' " +
  "subsection in CLAUDE.md. Approved by Marc in-session 2026-06-19.";

requestDecision(
  {
    decisionId: "D-V1-REMOVAL-STANDING-DIRECTIVE",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "Standing V1-retirement directive submitted for CEO approval; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-V1-REMOVAL-STANDING-DIRECTIVE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
