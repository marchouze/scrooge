// platform/records/helpers.ts
//
// RMS Phase 1 Slice 2 — record-helper functions.
//
// Caller-facing helpers that pair a document-store `put` with the appropriate
// RMS event append. The pattern matches `prototype/runtime/decisions/record.ts`
// (`recordCeoDecision`): one canonical entry-point per record kind, validates
// inputs, fans into the typed event constructor, appends to the store.
//
// Idempotency: `documentStore.put` is content-addressed and idempotent — the
// same bytes always yield the same hash and the existing on-disk file is
// preserved (`isNew: false`). Every helper returns the `PutResult` so the
// caller can branch on `isNew` if it cares (e.g. avoid emitting a duplicate
// event when a long-running run replays its inputs).
//
// Helpers do **not** auto-deduplicate the *event* append — re-running
// `recordBriefIssued` with the same `briefId` and identical body returns the
// same `documentHash` but emits a *new* `AgentBriefIssued` event each call.
// Event-level idempotency is the caller's contract; the record-helpers are
// content-addressed at the document layer only. This matches the existing
// `recordCeoDecision` shape.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice authorisation
// D-RMS-PHASE-1-SLICE-2. Spec at
// `Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`
// §3 (Event type definitions).
//
// P1 — events are the only source of truth. The helpers always emit a typed
//      event; the document store is the heavy-bytes carrier the event cites
//      by hash.
// P2 — every event must carry at least one citation; helpers require non-empty
//      `citations` from the caller.
//
// Author: Owen (Company Secretary, governance) +
//         Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { type DocumentHash, type DocumentStore, defaultDocumentStore } from "../document-store";
import {
  type AgentBriefIssuedPayload,
  type AgentRunCompletedPayload,
  type AgentRunStartedPayload,
  type BriefSupersededPayload,
  type DecisionRequestedPayload,
  type FeedbackPayload,
  type RecordFiledPayload,
  type RmsAgentRef,
  makeAgentBriefIssued,
  makeAgentRunCompleted,
  makeAgentRunStarted,
  makeBriefSuperseded,
  makeDecisionRequested,
  makeFeedback,
  makeRecordFiled,
} from "../event-store/event-types";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------

/** Default legal entity for in-bank records. Mirrors `runtime/decisions/record.ts`. */
const DEFAULT_ENTITY = "BANK-ZA-001";

/** Document store handle. Helpers default to the singleton; tests inject. */
export interface RecordHelperDeps {
  readonly documentStore?: DocumentStore;
}

/**
 * Result of any helper that materialises a document + appends an event.
 */
export interface RecordHelperResult {
  readonly event: Event;
  readonly eventId: string;
  readonly documentHash: DocumentHash;
  readonly isNewDocument: boolean;
}

function resolveStore(deps: RecordHelperDeps | undefined): DocumentStore {
  return deps?.documentStore ?? defaultDocumentStore;
}

function requireNonEmpty(field: string, value: unknown): void {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${field} is required`);
  }
}

function requireNonEmptyArray(field: string, value: readonly unknown[] | undefined): void {
  if (!value || value.length === 0) {
    throw new Error(`${field} is required and must be non-empty`);
  }
}

// ---------------------------------------------------------------------------
// recordBriefIssued — RMS-1
// ---------------------------------------------------------------------------

export interface RecordBriefIssuedInput {
  readonly briefId: string;
  readonly issuedTo: RmsAgentRef;
  readonly issuedBy: RmsAgentRef;
  readonly title: string;
  /** The brief body (markdown). Stored in the document store; hash becomes `directiveDocumentHash`. */
  readonly directiveBody: string;
  readonly priority: AgentBriefIssuedPayload["priority"];
  readonly expectedOutputs: AgentBriefIssuedPayload["expectedOutputs"];
  readonly workstreamId?: string;
  readonly scheduledFor?: string;
  readonly supersedes?: string;
  /** Citations for the envelope (Principle 2). */
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

/**
 * Put the brief body into the document store, then append an
 * `AgentBriefIssued` event referencing it by hash.
 */
export function recordBriefIssued(
  input: RecordBriefIssuedInput,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordHelperResult {
  requireNonEmpty("briefId", input.briefId);
  requireNonEmpty("title", input.title);
  requireNonEmpty("directiveBody", input.directiveBody);
  requireNonEmptyArray("citations", input.citations);
  requireNonEmptyArray("expectedOutputs", input.expectedOutputs);

  const store = resolveStore(deps);
  const put = store.put(input.directiveBody);

  const event = makeAgentBriefIssued({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      briefId: input.briefId,
      issuedTo: input.issuedTo,
      issuedBy: input.issuedBy,
      title: input.title,
      directiveDocumentHash: put.hash,
      priority: input.priority,
      expectedOutputs: input.expectedOutputs,
      ...(input.workstreamId ? { workstreamId: input.workstreamId } : {}),
      ...(input.scheduledFor ? { scheduledFor: input.scheduledFor } : {}),
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    },
  });

  eventStore.append(event);

  return {
    event,
    eventId: event.event_id,
    documentHash: put.hash,
    isNewDocument: put.isNew,
  };
}

// ---------------------------------------------------------------------------
// recordAgentRunStarted / recordAgentRunCompleted — RMS-2 + RMS-3
//
// `recordAgentRun(start, completion)` is the convenience wrapper that emits
// the open + close pair in one call (used by Scrooge-coordinated in-session
// runs that have both endpoints in hand). `recordAgentRunStarted` and
// `recordAgentRunCompleted` are the individual helpers for live runs that
// open and close at different times.
// ---------------------------------------------------------------------------

export interface RecordAgentRunStartedInput {
  readonly runId: string;
  readonly briefId: string;
  readonly agent: RmsAgentRef;
  readonly startedAt: string;
  readonly substrate: AgentRunStartedPayload["substrate"];
  readonly worktree?: string;
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

export interface RecordAgentRunStartedResult {
  readonly event: Event;
  readonly eventId: string;
}

/**
 * Append an `AgentRunStarted` event. No document-store interaction — the run
 * lifecycle has no body of its own; the brief body lives in
 * `AgentBriefIssued.directiveDocumentHash` and the deliverables in
 * `AgentRunCompleted.deliverableDocumentHashes`.
 */
export function recordAgentRunStarted(
  input: RecordAgentRunStartedInput,
  asOf: string,
): RecordAgentRunStartedResult {
  requireNonEmpty("runId", input.runId);
  requireNonEmpty("briefId", input.briefId);
  requireNonEmpty("startedAt", input.startedAt);
  requireNonEmptyArray("citations", input.citations);

  const event = makeAgentRunStarted({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      runId: input.runId,
      briefId: input.briefId,
      agent: input.agent,
      startedAt: input.startedAt,
      substrate: input.substrate,
      ...(input.worktree ? { worktree: input.worktree } : {}),
    },
  });

  eventStore.append(event);
  return { event, eventId: event.event_id };
}

export interface RecordAgentRunCompletedInput {
  readonly runId: string;
  readonly briefId: string;
  readonly agent: RmsAgentRef;
  readonly completedAt: string;
  readonly outcome: AgentRunCompletedPayload["outcome"];
  /**
   * Deliverable bodies — one per output document. Each is put into the store;
   * the resulting hashes become `deliverableDocumentHashes`. Pass an empty
   * array for `withdrawn` outcomes (or runs that produced no document).
   */
  readonly deliverableBodies: readonly string[];
  readonly substrateGapsSurfaced: readonly string[];
  readonly deliverableCitations: readonly string[];
  readonly followOnRoutes: AgentRunCompletedPayload["followOnRoutes"];
  /** Envelope citations (Principle 2). */
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

export interface RecordAgentRunCompletedResult {
  readonly event: Event;
  readonly eventId: string;
  readonly deliverableDocumentHashes: readonly DocumentHash[];
  readonly newDeliverableCount: number;
}

/**
 * Put each deliverable body into the document store, then append an
 * `AgentRunCompleted` event referencing them by hash.
 */
export function recordAgentRunCompleted(
  input: RecordAgentRunCompletedInput,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordAgentRunCompletedResult {
  requireNonEmpty("runId", input.runId);
  requireNonEmpty("briefId", input.briefId);
  requireNonEmpty("completedAt", input.completedAt);
  requireNonEmptyArray("citations", input.citations);

  const store = resolveStore(deps);
  const puts = input.deliverableBodies.map((body) => store.put(body));
  const hashes = puts.map((p) => p.hash);
  const newDeliverableCount = puts.filter((p) => p.isNew).length;

  const event = makeAgentRunCompleted({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      runId: input.runId,
      briefId: input.briefId,
      agent: input.agent,
      completedAt: input.completedAt,
      outcome: input.outcome,
      deliverableDocumentHashes: hashes,
      substrateGapsSurfaced: [...input.substrateGapsSurfaced],
      citations: [...input.deliverableCitations],
      followOnRoutes: [...input.followOnRoutes],
    },
  });

  eventStore.append(event);

  return {
    event,
    eventId: event.event_id,
    deliverableDocumentHashes: hashes,
    newDeliverableCount,
  };
}

export interface RecordAgentRunResult {
  readonly started: RecordAgentRunStartedResult;
  readonly completed: RecordAgentRunCompletedResult;
}

/**
 * Convenience: emit the run-started + run-completed pair in one call. Used by
 * Scrooge-coordinated in-session runs that have both endpoints in hand at
 * close-out (the scheduler-driven path uses the individual helpers).
 */
export function recordAgentRun(
  start: RecordAgentRunStartedInput,
  completion: Omit<RecordAgentRunCompletedInput, "runId" | "briefId" | "agent">,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordAgentRunResult {
  const started = recordAgentRunStarted(start, asOf);
  const completed = recordAgentRunCompleted(
    {
      runId: start.runId,
      briefId: start.briefId,
      agent: start.agent,
      ...completion,
    },
    asOf,
    deps,
  );
  return { started, completed };
}

// ---------------------------------------------------------------------------
// recordDecisionRequested — RMS-4
// ---------------------------------------------------------------------------

export interface RecordDecisionRequestedInput {
  readonly decisionId: string;
  readonly title: string;
  readonly category: DecisionRequestedPayload["category"];
  readonly owner: RmsAgentRef;
  readonly forActor: DecisionRequestedPayload["forActor"];
  readonly decisionForActor: string;
  readonly recommendation: DecisionRequestedPayload["recommendation"];
  /**
   * Optional supporting documents. When present, each body is put into the
   * store and the resulting hashes populate `sourceDocumentHashes`.
   */
  readonly sourceDocumentBodies?: readonly string[];
  /** Decision-level citations (Principle 2). */
  readonly decisionCitations: readonly string[];
  readonly deadline?: string;
  readonly options?: DecisionRequestedPayload["options"];
  /** Envelope citations (Principle 2). */
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

export interface RecordDecisionRequestedResult {
  readonly event: Event;
  readonly eventId: string;
  readonly sourceDocumentHashes: readonly DocumentHash[];
  readonly newDocumentCount: number;
}

/**
 * Put any source documents into the store, then append a `DecisionRequested`
 * event with their hashes.
 */
export function recordDecisionRequested(
  input: RecordDecisionRequestedInput,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordDecisionRequestedResult {
  requireNonEmpty("decisionId", input.decisionId);
  requireNonEmpty("title", input.title);
  requireNonEmpty("decisionForActor", input.decisionForActor);
  requireNonEmptyArray("citations", input.citations);

  const store = resolveStore(deps);
  const puts = (input.sourceDocumentBodies ?? []).map((body) => store.put(body));
  const hashes = puts.map((p) => p.hash);
  const newDocumentCount = puts.filter((p) => p.isNew).length;

  const event = makeDecisionRequested({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      decisionId: input.decisionId,
      title: input.title,
      category: input.category,
      owner: input.owner,
      forActor: input.forActor,
      decisionForActor: input.decisionForActor,
      recommendation: input.recommendation,
      sourceDocumentHashes: hashes,
      citations: [...input.decisionCitations],
      ...(input.deadline ? { deadline: input.deadline } : {}),
      ...(input.options ? { options: input.options } : {}),
    },
  });

  eventStore.append(event);

  return {
    event,
    eventId: event.event_id,
    sourceDocumentHashes: hashes,
    newDocumentCount,
  };
}

// ---------------------------------------------------------------------------
// recordFeedback — RMS-5
// ---------------------------------------------------------------------------

export interface RecordFeedbackInput {
  readonly feedbackId: string;
  readonly from: FeedbackPayload["from"];
  readonly channel: FeedbackPayload["channel"];
  readonly intakeAt: string;
  readonly subject: FeedbackPayload["subject"];
  readonly body: string;
  /**
   * Optional long-form body. When present, it is put into the document store
   * and the resulting hash populates `bodyDocumentHash`.
   */
  readonly bodyLongForm?: string;
  readonly classifications: FeedbackPayload["classifications"];
  readonly routedTo?: readonly RmsAgentRef[];
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

export interface RecordFeedbackResult {
  readonly event: Event;
  readonly eventId: string;
  /** Hash of `bodyLongForm` if provided; undefined otherwise. */
  readonly bodyDocumentHash?: DocumentHash;
  readonly isNewBodyDocument: boolean;
}

/**
 * Append a `Feedback` event. If a long-form body is supplied, it is put into
 * the document store first and the hash referenced from the payload.
 */
export function recordFeedback(
  input: RecordFeedbackInput,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordFeedbackResult {
  requireNonEmpty("feedbackId", input.feedbackId);
  requireNonEmpty("intakeAt", input.intakeAt);
  requireNonEmpty("body", input.body);
  requireNonEmptyArray("classifications", input.classifications);
  requireNonEmptyArray("citations", input.citations);

  const store = resolveStore(deps);
  let bodyDocumentHash: DocumentHash | undefined;
  let isNewBodyDocument = false;
  if (input.bodyLongForm) {
    const put = store.put(input.bodyLongForm);
    bodyDocumentHash = put.hash;
    isNewBodyDocument = put.isNew;
  }

  const event = makeFeedback({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      feedbackId: input.feedbackId,
      from: input.from,
      channel: input.channel,
      intakeAt: input.intakeAt,
      subject: input.subject,
      body: input.body,
      ...(bodyDocumentHash ? { bodyDocumentHash } : {}),
      classifications: [...input.classifications],
      ...(input.routedTo ? { routedTo: [...input.routedTo] } : {}),
    },
  });

  eventStore.append(event);

  return {
    event,
    eventId: event.event_id,
    ...(bodyDocumentHash ? { bodyDocumentHash } : {}),
    isNewBodyDocument,
  };
}

// ---------------------------------------------------------------------------
// supersedeBrief — RMS-6
// ---------------------------------------------------------------------------

export interface SupersedeBriefInput {
  readonly originalBriefId: string;
  readonly supersededBy: string;
  readonly reason: BriefSupersededPayload["reason"];
  readonly authorisedBy: RmsAgentRef;
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

export interface SupersedeBriefResult {
  readonly event: Event;
  readonly eventId: string;
}

/**
 * Append a `BriefSuperseded` event. No document-store interaction (the
 * supersession itself has no body — the chain is the audit trail).
 */
export function supersedeBrief(input: SupersedeBriefInput, asOf: string): SupersedeBriefResult {
  requireNonEmpty("originalBriefId", input.originalBriefId);
  requireNonEmpty("supersededBy", input.supersededBy);
  requireNonEmptyArray("citations", input.citations);

  const event = makeBriefSuperseded({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      originalBriefId: input.originalBriefId,
      supersededBy: input.supersededBy,
      reason: input.reason,
      authorisedBy: input.authorisedBy,
    },
  });

  eventStore.append(event);
  return { event, eventId: event.event_id };
}

// ---------------------------------------------------------------------------
// recordFiled — RMS-7
// ---------------------------------------------------------------------------

export interface RecordFiledInput {
  readonly recordId: string;
  readonly registerKey: RecordFiledPayload["registerKey"];
  /** Document body to file. Put into the store; hash becomes `documentHash`. */
  readonly body: string;
  readonly classification: RecordFiledPayload["classification"];
  readonly retention: RecordFiledPayload["retention"];
  readonly supersedes?: string;
  readonly correctsOriginalErrors?: boolean;
  readonly metadata?: RecordFiledPayload["metadata"];
  readonly citations: readonly string[];
  readonly actor: Actor;
  readonly entity?: string;
}

/**
 * Put the artefact into the document store, then append a `RecordFiled`
 * event. This is the event that turns a markdown into a *record* in the
 * governance sense (Owen's note, spec §3.8).
 */
export function recordFiled(
  input: RecordFiledInput,
  asOf: string,
  deps?: RecordHelperDeps,
): RecordHelperResult {
  requireNonEmpty("recordId", input.recordId);
  requireNonEmpty("body", input.body);
  requireNonEmpty("retention.citationRef", input.retention.citationRef);
  requireNonEmptyArray("citations", input.citations);

  const store = resolveStore(deps);
  const put = store.put(input.body);

  const event = makeRecordFiled({
    asOf,
    entity: input.entity ?? DEFAULT_ENTITY,
    actor: input.actor,
    citations: [...input.citations],
    payload: {
      recordId: input.recordId,
      registerKey: input.registerKey,
      documentHash: put.hash,
      classification: input.classification,
      retention: input.retention,
      ...(input.supersedes ? { supersedes: input.supersedes } : {}),
      ...(input.correctsOriginalErrors !== undefined
        ? { correctsOriginalErrors: input.correctsOriginalErrors }
        : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });

  eventStore.append(event);

  return {
    event,
    eventId: event.event_id,
    documentHash: put.hash,
    isNewDocument: put.isNew,
  };
}
