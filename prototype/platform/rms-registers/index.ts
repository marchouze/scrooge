// platform/rms-registers/index.ts
//
// RMS Phase 1 Slice 3 — projection runtime + 7 RMS register projections.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//   §6 (Register schemas), §13 Slice 3 (Projection runtime for the seven registers)
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
// slice authorisation D-RMS-PHASE-1-SLICE-3.
//
// This module exports seven typed `Projection` definitions over the RMS event
// family (and the legacy `CeoDecision` type, which the Decisions register
// pair-couples with `DecisionRequested`). Each projection:
//
//   - is a pure (state, event) → state reducer (Principle 1 — events are the
//     only source of truth; the projection is a deterministic query, not
//     stored state);
//   - is content-addressed and idempotent under replay (folding the same event
//     stream twice yields the same state);
//   - declares an `accepts` predicate that narrows on event types so the
//     `LocalProjector` skips unrelated events efficiently;
//   - exposes JSON snapshot codecs (`encodeSnapshot` / `decodeSnapshot`) so
//     the EvSS Slice-3 snapshot path (`Projector.projectFromSnapshot`) can
//     restore state without reading the full event log.
//
// Provenance handling. Per the D-DATA-PROVENANCE-SUBSTRATE design (PR #161),
// callers can pre-filter events by `provenance.kind` before folding (the
// projection itself does not branch on provenance — that is a read-time
// concern handled at the consumer / dashboard layer in Slice 4). The
// `filterEventsByProvenance` helper exposed here wraps the common case.
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Atlas (Core banking platform architect, engineering — substrate
//          consult on event-store seams)

export {
  decisionsRegisterProjection,
  type DecisionsRegisterRow,
  type DecisionsRegisterState,
  type DecisionsRegisterStatus,
  type DecisionsRegisterResolution,
  decisionsRegisterRows,
  decisionsRegisterByActor,
} from "./decisions";

export {
  correspondenceRegisterProjection,
  type CorrespondenceRegisterRow,
  type CorrespondenceRegisterState,
  correspondenceRegisterRows,
} from "./correspondence";

export {
  agentRunsRegisterProjection,
  type AgentRunsRegisterRow,
  type AgentRunsRegisterState,
  type AgentRunsOutcome,
  agentRunsRegisterRows,
} from "./agent-runs";

export {
  documentRegisterProjection,
  type DocumentRegisterRow,
  type DocumentRegisterState,
  documentRegisterRows,
} from "./document";

export {
  feedbackRegisterProjection,
  type FeedbackRegisterRow,
  type FeedbackRegisterState,
  feedbackRegisterRows,
  feedbackRegisterBySubject,
} from "./feedback";

export {
  briefsRegisterProjection,
  type BriefsRegisterRow,
  type BriefsRegisterState,
  type BriefsRegisterStatus,
  briefsRegisterRows,
} from "./briefs-dispatches";

export {
  workstreamsRegisterProjection,
  type WorkstreamsRegisterRow,
  type WorkstreamsRegisterState,
  type WorkstreamsStatus,
  workstreamsRegisterRows,
} from "./workstreams";

export { filterEventsByProvenance, type ProvenanceFilter } from "./filter";
