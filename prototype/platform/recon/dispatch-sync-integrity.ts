// platform/recon/dispatch-sync-integrity.ts
//
// Continuous-controls pipeline: dispatch sync integrity.
//
// Scans `AgentBriefIssued` + `AgentRunStarted` + `AgentRunCompleted` event
// streams and flags any case where a decider-class run closed `delivered`
// while a required reviewer-class brief for the same scope had no closing
// `AgentRunCompleted{outcome:"delivered"}` at the decider's close timestamp.
//
// Two detection modes:
//
//   1. **Forward (`blocksOn`-aware).** Briefs emitted on or after the
//      D-DISPATCH-SYNC-PRIMITIVE landing carry `runRoleClass` and `blocksOn`.
//      The pipeline asserts the runtime gate held — i.e. every entry in
//      `blocksOn` has a matching delivered `AgentRunCompleted` whose
//      `completedAt <= decider.completedAt`. Failures here indicate the
//      runtime gate was bypassed (e.g. `--force-close-bypass-sync`); they
//      are still emitted as `fail` so an audit trail exists.
//
//   2. **Legacy (workstream + title heuristic).** Pre-primitive runs have
//      empty `blocksOn`. The pipeline groups briefs by `workstreamId`; if a
//      workstream has ≥ 1 reviewer-titled brief and ≥ 1 decider-titled brief
//      and the decider's closing run lands `delivered` BEFORE the reviewer's
//      closing run lands, that's the 2026-05-20 incident shape and a `fail`.
//
// Authority: D-DISPATCH-SYNC-PRIMITIVE (CEO-approved 2026-05-20).
// Spec: platform/dispatch/sync-primitive-spec.md
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { assertBlockingRunsClosed } from "../dispatch";
import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
} from "../event-store/event-types/agent";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "dispatch-sync-integrity";

// ---------------------------------------------------------------------------
// Reviewer / decider title heuristics for legacy detection mode.
// ---------------------------------------------------------------------------

const REVIEWER_TITLE_RE = /\b(independent[\s-]validation|reviewer|review|validate|validation)\b/i;
const DECIDER_TITLE_RE =
  /\b(approval|approve|decider|merge|sign[\s-]?off|signoff|cro[\s-]?approval|ceo[\s-]?approval)\b/i;

// ---------------------------------------------------------------------------
// Input shape — events grouped by type. The `run({...})` overload accepts
// injected events for unit-testing (matching the pattern used by
// credit-limit-* recon pipelines).
// ---------------------------------------------------------------------------

export interface DispatchSyncReconInput {
  briefIssuedEvents: ReadonlyArray<Pick<Event, "as_of" | "payload">>;
  runCompletedEvents: ReadonlyArray<Pick<Event, "as_of" | "payload">>;
}

interface BriefRow {
  payload: AgentBriefIssuedPayload;
  asOf: string;
}

interface CompletionRow {
  payload: AgentRunCompletedPayload;
  asOf: string;
}

// ---------------------------------------------------------------------------
// Forward mode — `blocksOn`-aware
// ---------------------------------------------------------------------------

function checkForwardMode(
  briefs: ReadonlyArray<BriefRow>,
  completions: ReadonlyArray<CompletionRow>,
): ReconViolation[] {
  const briefsById = new Map<string, BriefRow>();
  for (const b of briefs) briefsById.set(b.payload.briefId, b);

  const out: ReconViolation[] = [];

  // Build a single Event[]-shape for the dispatch primitive (it accepts
  // anything matching the `Event` shape; we cast minimally).
  const eventsForAssert: Event[] = completions.map((c) => ({
    event_id: "synthetic",
    type: "AgentRunCompleted",
    as_of: c.asOf,
    entity: "BANK-ZA-001",
    actor: { type: "service", id: "recon" },
    citations: ["D-DISPATCH-SYNC-PRIMITIVE"],
    payload: c.payload as unknown as Record<string, unknown>,
  }));

  for (const c of completions) {
    if (c.payload.outcome !== "delivered") continue;
    const brief = briefsById.get(c.payload.briefId);
    if (!brief) continue;
    const blocksOn = brief.payload.blocksOn ?? [];
    if (blocksOn.length === 0) continue;

    const result = assertBlockingRunsClosed({
      brief: brief.payload,
      events: eventsForAssert,
      asOf: c.payload.completedAt,
    });
    if (result.ok) continue;

    for (const status of result.blocksOn) {
      if (status.satisfied) continue;
      out.push({
        subject: `agent-run:${c.payload.runId}`,
        message:
          `Decider run \`${c.payload.runId}\` (brief \`${c.payload.briefId}\`) closed delivered at ${c.payload.completedAt} ` +
          `but required reviewer brief \`${status.briefId}\` (${status.requiredRoleClass}) was not closed delivered first ` +
          `(${status.reason ?? "unknown"}). Forward-mode violation — runtime gate was bypassed. Citations: D-DISPATCH-SYNC-PRIMITIVE.`,
        severity: "fail",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Legacy mode — workstream + title heuristic
// ---------------------------------------------------------------------------

interface WorkstreamGroup {
  workstreamId: string;
  reviewerBriefs: BriefRow[];
  deciderBriefs: BriefRow[];
}

function groupByWorkstream(briefs: ReadonlyArray<BriefRow>): Map<string, WorkstreamGroup> {
  const out = new Map<string, WorkstreamGroup>();
  for (const b of briefs) {
    const ws = b.payload.workstreamId;
    if (!ws) continue;

    // Skip briefs that already opted into forward mode — the forward checker
    // handles them. We classify by title only for the legacy path.
    if ((b.payload.blocksOn ?? []).length > 0) continue;
    if (b.payload.runRoleClass) continue;

    let group = out.get(ws);
    if (!group) {
      group = { workstreamId: ws, reviewerBriefs: [], deciderBriefs: [] };
      out.set(ws, group);
    }
    if (REVIEWER_TITLE_RE.test(b.payload.title)) {
      group.reviewerBriefs.push(b);
    } else if (DECIDER_TITLE_RE.test(b.payload.title)) {
      group.deciderBriefs.push(b);
    }
  }
  return out;
}

function checkLegacyMode(
  briefs: ReadonlyArray<BriefRow>,
  completions: ReadonlyArray<CompletionRow>,
): ReconViolation[] {
  const groups = groupByWorkstream(briefs);
  const out: ReconViolation[] = [];

  // Index completions by briefId — earliest delivered closing wins.
  const completionByBrief = new Map<string, CompletionRow>();
  for (const c of completions) {
    if (c.payload.outcome !== "delivered") continue;
    const existing = completionByBrief.get(c.payload.briefId);
    if (!existing || c.payload.completedAt < existing.payload.completedAt) {
      completionByBrief.set(c.payload.briefId, c);
    }
  }

  for (const group of groups.values()) {
    if (group.reviewerBriefs.length === 0) continue;
    if (group.deciderBriefs.length === 0) continue;

    // For each decider in the workstream, check whether at least one reviewer
    // brief in the same workstream closed delivered BEFORE the decider did.
    for (const decider of group.deciderBriefs) {
      const deciderCompletion = completionByBrief.get(decider.payload.briefId);
      if (!deciderCompletion) continue;

      // Find any reviewer brief that closed delivered at or before the
      // decider's close timestamp.
      const reviewerClosedInTime = group.reviewerBriefs.some((r) => {
        const rc = completionByBrief.get(r.payload.briefId);
        if (!rc) return false;
        return rc.payload.completedAt <= deciderCompletion.payload.completedAt;
      });

      if (reviewerClosedInTime) continue;

      // Surface the first reviewer brief as the canonical scope citation.
      const firstReviewer = group.reviewerBriefs[0];
      if (!firstReviewer) continue;
      const reviewerCompletion = completionByBrief.get(firstReviewer.payload.briefId);
      const reviewerCloseInfo = reviewerCompletion
        ? `closed delivered at ${reviewerCompletion.payload.completedAt}`
        : "had no delivered closing event";

      out.push({
        subject: `agent-run:${deciderCompletion.payload.runId}`,
        message: `Decider run \`${deciderCompletion.payload.runId}\` (brief \`${decider.payload.briefId}\`, workstream \`${group.workstreamId}\`) closed delivered at ${deciderCompletion.payload.completedAt} but reviewer brief \`${firstReviewer.payload.briefId}\` ${reviewerCloseInfo}. Legacy-mode violation — reviewer→decider topology was bracketed without sync primitive. Citations: D-DISPATCH-SYNC-PRIMITIVE.`,
        severity: "fail",
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main run() — testable + live
// ---------------------------------------------------------------------------

export function run(input?: DispatchSyncReconInput): ReconResult {
  const result = emptyResult(PIPELINE);

  let briefRows: BriefRow[];
  let completionRows: CompletionRow[];

  if (input) {
    briefRows = input.briefIssuedEvents.map((e) => ({
      payload: e.payload as AgentBriefIssuedPayload,
      asOf: e.as_of,
    }));
    completionRows = input.runCompletedEvents.map((e) => ({
      payload: e.payload as AgentRunCompletedPayload,
      asOf: e.as_of,
    }));
  } else {
    briefRows = [];
    completionRows = [];
    for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
      briefRows.push({ payload: e.payload as AgentBriefIssuedPayload, asOf: e.as_of });
    }
    for (const e of eventStore.replay({ type: "AgentRunCompleted" })) {
      completionRows.push({ payload: e.payload as AgentRunCompletedPayload, asOf: e.as_of });
    }
  }

  result.asserted = briefRows.length + completionRows.length;

  const violations: ReconViolation[] = [
    ...checkForwardMode(briefRows, completionRows),
    ...checkLegacyMode(briefRows, completionRows),
  ];

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "Dispatch sync integrity passed"
        : "Dispatch sync integrity FAILED — reviewer→decider topology bracketed without sync primitive",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
