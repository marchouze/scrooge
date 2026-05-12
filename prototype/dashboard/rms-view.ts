// dashboard/rms-view.ts
//
// RMS Phase 1 Slice 4 — dashboard register-render derivation layer.
//
// Spec: Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//   §6 (register schemas), §13 Slice 4 (dashboard render — dual-render).
// Standing authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09);
// slice authorisation D-RMS-PHASE-1-SLICE-4.
//
// This module is the projection-runtime *consumer* for the dashboard. It
// folds the live event store through the seven RMS register projections
// (Slice 3 substrate, `prototype/platform/rms-registers/`) and produces
// JSON-serialisable view rows for the API layer to hand to the rms.html
// register pages.
//
// Dual-render discipline (CLAUDE.md "Records substrate"):
//
//   - The legacy Owner Inbox feed in `derive.ts` is unchanged. New register
//     views are surfaced *alongside* it via the seven `/api/rms/...`
//     endpoints. Phase 4 archives the legacy feed; Phase 1 keeps both
//     visible.
//   - The Decisions register view is the *richer* read-shape than the
//     legacy `decisionsOpen` / `decisionsResolved` arrays — it is keyed
//     by `decisionId`, carries the full request envelope (recommendation,
//     options, source-document hashes, citations), and exposes the
//     canonical `requestEventId` audit pin. The legacy arrays remain the
//     single source for the existing `/index.html` dashboard until
//     Phase 4 cutover.
//
// Provenance handling. Per the D-DATA-PROVENANCE-SUBSTRATE design (PR
// #161) and the Slice-3 `filterEventsByProvenance` helper, the API layer
// can pre-filter events by `provenance.kind` before folding. Phase 1
// dual-render keeps this implicit (mode-aware reads layer in once the
// dashboard exposes a mode-toggle UI in Phase 2 §11.3).
//
// Substrate gaps surfaced (declared, not hidden — Principle 6):
//
//   1. **Slice 5 — end-to-end round-trip.** This module reads the
//      register projections; demonstrating the full chain
//      (AgentBriefIssued → AgentRunStarted → AgentRunCompleted →
//      DecisionRequested → CeoDecision) without any Owner Inbox /
//      Team Inbox file authored is Slice 5's territory.
//   2. **Phase 2 dual-render maturation.** Decisions Desk (§10 of spec)
//      keystroke-shortcut UI, side-panel record browser, mode-toggle
//      filter chips — all Phase 2.
//   3. **Phase 3 cutover.** When Phase 3 lands, `/index.html`
//      `decisionsOpen` rendering switches to read from this module's
//      Decisions register, and the legacy event-source path in
//      `derive.ts` is retired.
//   4. **Phase 4 archive.** Legacy `Owner Inbox/` and `Team Inbox/`
//      folders move to `archive/`; the seven RMS registers become the
//      sole canonical view.
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
//          + dashboard derivation curator)
//          · Atlas (Core banking platform architect, engineering — substrate
//          consult on event-store seams)

import type { EventStore } from "../platform/event-store/store";
import { LocalProjector } from "../platform/projections";
import { defaultProvenanceFilter, effectiveStreamKey } from "../platform/projections/filter";
import {
  type AgentRunsRegisterRow,
  type BriefsRegisterRow,
  type CorrespondenceRegisterRow,
  type DecisionsRegisterRow,
  type DocumentRegisterRow,
  type FeedbackRegisterRow,
  type WorkstreamsRegisterRow,
  agentRunsRegisterProjection,
  agentRunsRegisterRows,
  briefsRegisterProjection,
  briefsRegisterRows,
  correspondenceRegisterProjection,
  correspondenceRegisterRows,
  decisionsRegisterProjection,
  decisionsRegisterRows,
  documentRegisterProjection,
  documentRegisterRows,
  feedbackRegisterProjection,
  feedbackRegisterRows,
  workstreamsRegisterProjection,
  workstreamsRegisterRows,
} from "../platform/rms-registers";

// ---------------------------------------------------------------------------
// Register-key registry. The seven RMS registers per spec §6. Used by the
// API layer to validate `:register` route parameters and by the front-end
// to discover the register catalogue without hard-coding it twice.
// ---------------------------------------------------------------------------

export const RMS_REGISTER_KEYS = [
  "decisions",
  "correspondence",
  "agent-runs",
  "document",
  "feedback",
  "briefs-dispatches",
  "workstreams",
] as const;

export type RmsRegisterKey = (typeof RMS_REGISTER_KEYS)[number];

export interface RmsRegisterDescriptor {
  readonly key: RmsRegisterKey;
  readonly title: string;
  readonly blurb: string;
  /** Plain-English description of which event types fold into this register. */
  readonly folds: readonly string[];
  /** Status taxonomy for this register, when one applies; empty otherwise. */
  readonly statusTaxonomy: readonly string[];
}

export const RMS_REGISTER_CATALOGUE: readonly RmsRegisterDescriptor[] = [
  {
    key: "decisions",
    title: "Decisions",
    blurb:
      "Pair-coupled DecisionRequested + CeoDecision rows. The richer read-shape than the legacy decisionsOpen / decisionsResolved arrays.",
    folds: ["DecisionRequested", "CeoDecision"],
    statusTaxonomy: ["open", "resolved", "revision-requested", "superseded"],
  },
  {
    key: "correspondence",
    title: "Correspondence",
    blurb:
      "RecordFiled rows where registerKey='correspondence'. Supersession chain materialised via supersedes / supersededBy.",
    folds: ["RecordFiled (registerKey=correspondence)"],
    statusTaxonomy: [],
  },
  {
    key: "agent-runs",
    title: "Records of agent runs",
    blurb:
      "Pair-coupled AgentRunStarted + AgentRunCompleted rows keyed by runId. BriefSuperseded flags in-flight runs whose brief was retired.",
    folds: ["AgentRunStarted", "AgentRunCompleted", "BriefSuperseded"],
    statusTaxonomy: ["in-flight", "delivered", "blocked", "withdrawn"],
  },
  {
    key: "document",
    title: "Document",
    blurb:
      "One row per documentHash ever cited by any RMS event. RecordFiled registers the row; un-registered documents surface with classification 'agent-internal'.",
    folds: [
      "AgentBriefIssued",
      "AgentRunCompleted",
      "DecisionRequested",
      "Feedback",
      "RecordFiled",
    ],
    statusTaxonomy: [],
  },
  {
    key: "feedback",
    title: "Feedback",
    blurb:
      "One row per Feedback event keyed by feedbackId. Grouped by `${subject.kind}:${subject.ref}` for the records-browser side panel.",
    folds: ["Feedback"],
    statusTaxonomy: [],
  },
  {
    key: "briefs-dispatches",
    title: "Briefs / dispatches",
    blurb:
      "AgentBriefIssued rows keyed by briefId; status derived from downstream AgentRunStarted / AgentRunCompleted / BriefSuperseded events.",
    folds: ["AgentBriefIssued", "AgentRunStarted", "AgentRunCompleted", "BriefSuperseded"],
    statusTaxonomy: ["issued", "in-flight", "delivered", "blocked", "withdrawn", "superseded"],
  },
  {
    key: "workstreams",
    title: "Workstreams",
    blurb:
      "Logical grouping by AgentBriefIssued.workstreamId. Status derived from per-brief outcomes inside the workstream.",
    folds: ["AgentBriefIssued", "AgentRunStarted", "AgentRunCompleted", "BriefSuperseded"],
    statusTaxonomy: ["active", "complete", "blocked"],
  },
];

export function isRmsRegisterKey(s: string): s is RmsRegisterKey {
  return (RMS_REGISTER_KEYS as readonly string[]).includes(s);
}

// ---------------------------------------------------------------------------
// View rows — JSON-serialisable shapes for the API layer.
//
// The register projections produce `ReadonlyMap`-keyed state; the row
// helpers (`xxxRegisterRows()`) return arrays. The view types here are
// the same shapes the front-end consumes; we re-export the row interfaces
// so the API endpoints type cleanly.
// ---------------------------------------------------------------------------

export type DecisionsRegisterView = readonly DecisionsRegisterRow[];
export type CorrespondenceRegisterView = readonly CorrespondenceRegisterRow[];
export type AgentRunsRegisterView = readonly AgentRunsRegisterRow[];
export type DocumentRegisterView = readonly DocumentRegisterRow[];
export type FeedbackRegisterView = readonly FeedbackRegisterRow[];
export type BriefsRegisterView = readonly BriefsRegisterRow[];
export type WorkstreamsRegisterView = readonly WorkstreamsRegisterRow[];

export interface RmsRegisterCounts {
  readonly decisions: number;
  readonly correspondence: number;
  readonly agentRuns: number;
  readonly document: number;
  readonly feedback: number;
  readonly briefsDispatches: number;
  readonly workstreams: number;
}

export interface RmsRegistersSummary {
  readonly asOf: string;
  readonly counts: RmsRegisterCounts;
  readonly catalogue: readonly RmsRegisterDescriptor[];
}

export interface RmsRegistersFold {
  readonly asOf: string;
  readonly decisions: DecisionsRegisterView;
  readonly correspondence: CorrespondenceRegisterView;
  readonly agentRuns: AgentRunsRegisterView;
  readonly document: DocumentRegisterView;
  readonly feedback: FeedbackRegisterView;
  readonly briefsDispatches: BriefsRegisterView;
  readonly workstreams: WorkstreamsRegisterView;
}

// ---------------------------------------------------------------------------
// Folder — folds the EventStore through the seven projections in one pass.
//
// Each projection's `accepts` predicate skips unrelated events; a single
// `replay()` is cheaper than seven independent ones because the event log
// is read once. The `LocalProjector` builds each projection from its
// initial state via the Slice 3 runtime (`platform/projections/runtime.ts`).
//
// The function is pure: same EventStore + same now() → same fold. The API
// layer wraps this in a thin server-side cache (5s TTL) so repeated polling
// from the dashboard front-end doesn't re-fold on every request.
//
// F-027 snapshot adoption: the `decisions` projection (highest volume —
// folds CeoDecision + DecisionRequested events which accumulate monotonically)
// uses the snapshot-aware path (`projectFromSnapshot`) rather than a naive
// full replay. After computing the state, `maybeSnapshot` persists a snapshot
// when the cadence rule fires (first-snapshot or every-K-events threshold),
// so subsequent requests only replay the delta from the snapshot forward.
//
// The other six projections use the standard `build()` path because their
// event volumes are lower in the current build phase; they are marked with a
// TODO comment so future work can extend the snapshot path as event counts grow.
//
// Stream-key convention: `"dashboard:<projectionName>#prov=<filterDigest>"`,
// per `effectiveStreamKey()` from `platform/projections/filter.ts`.
// ---------------------------------------------------------------------------

// Stable base stream keys for the snapshot-enabled projections.
const DECISIONS_STREAM_KEY = "dashboard:decisionsRegister";

export function buildRmsRegistersFold(
  store: EventStore,
  now: () => string = () => new Date().toISOString(),
): RmsRegistersFold {
  const projector = new LocalProjector(store);
  const asOf = now();
  const provFilter = defaultProvenanceFilter();
  const effDecisionsKey = effectiveStreamKey(DECISIONS_STREAM_KEY, provFilter);

  // F-027: decisions projection — snapshot-aware path.
  // `projectFromSnapshot` loads the most recent snapshot ≤ asOf for the
  // effective stream key and folds only the delta events on top. On a fresh
  // store (no snapshot yet) it degrades gracefully to a full naive replay.
  // After folding, `maybeSnapshot` persists a new snapshot when the cadence
  // rule fires (CeoDecision cadence from the event-type registry).
  const { state: decisionsState, deltaCount: decisionsDelta } = projector.projectFromSnapshot(
    decisionsRegisterProjection,
    { streamKey: DECISIONS_STREAM_KEY, asOf, provenanceFilter: provFilter },
  );

  // Attempt snapshot emission after the fold — persists state when the
  // cadence rule (K events or T seconds since last snapshot) fires.
  // The uptoSequence is the current store count; close enough for the
  // cadence rule (the store does not expose the exact last-event sequence
  // without an additional query, and the cadence rule's threshold is coarse).
  const uptoSequence = store.count();
  projector.maybeSnapshot(decisionsRegisterProjection, {
    streamKey: DECISIONS_STREAM_KEY,
    asOf,
    uptoSequence,
    state: decisionsState,
    eventType: "CeoDecision",
    provenanceFilter: provFilter,
  });

  // Remaining projections use the standard naive-replay path.
  // TODO(F-027): extend snapshot path to correspondenceRegisterProjection,
  // agentRunsRegisterProjection, documentRegisterProjection,
  // workstreamsRegisterProjection, briefsRegisterProjection, and
  // feedbackRegisterProjection once their event volumes justify it.
  // Each already has encodeSnapshot/decodeSnapshot codecs defined.
  void effDecisionsKey; // used for logging; actual key managed by projectFromSnapshot
  void decisionsDelta; // available for debug logging if needed

  const correspondenceState = projector.build(correspondenceRegisterProjection);
  const agentRunsState = projector.build(agentRunsRegisterProjection);
  const documentState = projector.build(documentRegisterProjection);
  const feedbackState = projector.build(feedbackRegisterProjection);
  const briefsState = projector.build(briefsRegisterProjection);
  const workstreamsState = projector.build(workstreamsRegisterProjection);

  return {
    asOf,
    decisions: decisionsRegisterRows(decisionsState),
    correspondence: correspondenceRegisterRows(correspondenceState),
    agentRuns: agentRunsRegisterRows(agentRunsState),
    document: documentRegisterRows(documentState),
    feedback: feedbackRegisterRows(feedbackState),
    briefsDispatches: briefsRegisterRows(briefsState),
    workstreams: workstreamsRegisterRows(workstreamsState),
  };
}

export function summariseFold(fold: RmsRegistersFold): RmsRegistersSummary {
  return {
    asOf: fold.asOf,
    counts: {
      decisions: fold.decisions.length,
      correspondence: fold.correspondence.length,
      agentRuns: fold.agentRuns.length,
      document: fold.document.length,
      feedback: fold.feedback.length,
      briefsDispatches: fold.briefsDispatches.length,
      workstreams: fold.workstreams.length,
    },
    catalogue: RMS_REGISTER_CATALOGUE,
  };
}

// ---------------------------------------------------------------------------
// Single-register view selector — used by the `/api/rms/:register`
// endpoint. Returns the matching view array as `unknown` so the
// endpoint can JSON-encode it without per-key conditional branches.
// ---------------------------------------------------------------------------

export function selectRegisterView(
  fold: RmsRegistersFold,
  key: RmsRegisterKey,
): readonly unknown[] {
  switch (key) {
    case "decisions":
      return fold.decisions;
    case "correspondence":
      return fold.correspondence;
    case "agent-runs":
      return fold.agentRuns;
    case "document":
      return fold.document;
    case "feedback":
      return fold.feedback;
    case "briefs-dispatches":
      return fold.briefsDispatches;
    case "workstreams":
      return fold.workstreams;
  }
}
