// platform/rms-registers/document.ts
//
// RMS Phase 1 Slice 3 — Document register projection.
//
// Spec §6.4. Materialises one row per `documentHash` ever cited by any RMS
// event. The row records:
//
//   - first-seen-at (the `as_of` of the earliest event citing the hash);
//   - first-referenced-by (the `event_id` of that earliest event);
//   - the union of citing event_ids (reverse-lookup);
//   - the latest `RecordFiled` row that registered the hash, if any
//     (classification, retention, recordId, supersession chain).
//
// Documents *cited but not yet `RecordFiled`* are surfaced with
// `recordId: null` and `classification: "agent-internal"` (the spec's
// pre-registered default).
//
// Folded events:
//   - `AgentBriefIssued`     → cites `directiveDocumentHash`
//   - `AgentRunCompleted`    → cites every `deliverableDocumentHashes`
//   - `DecisionRequested`    → cites every `sourceDocumentHashes`
//   - `Feedback`             → cites optional `bodyDocumentHash`
//   - `RecordFiled`          → cites `documentHash` AND registers the row
//
// Author: Anya (Data / analytics engineer, engineering)

import { z } from "zod";
import type {
  AgentBriefIssuedPayload,
  AgentRunCompletedPayload,
  DecisionRequestedPayload,
  FeedbackPayload,
  RecordFiledPayload,
} from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export interface DocumentRegisterRow {
  readonly documentHash: string;
  readonly recordId: string | null;
  readonly firstSeenAt: string;
  readonly firstReferencedByEventId: string;
  readonly firstReferencedByEventType: string;
  readonly referencedByEventIds: readonly string[];
  readonly classification: RecordFiledPayload["classification"];
  readonly retention: RecordFiledPayload["retention"] | null;
  readonly registerKey: RecordFiledPayload["registerKey"] | null;
  readonly supersedes: string | null;
  readonly supersededBy: string | null;
  /** True iff this hash was added by a `RecordFiled` (not just cited). */
  readonly registered: boolean;
  /** Optional metadata from the filing event (title, path, category, author, date). */
  readonly metadata: RecordFiledPayload["metadata"] | null;
}

export interface DocumentRegisterState {
  readonly rows: ReadonlyMap<string, DocumentRegisterRow>;
}

export const documentRegisterInitial: DocumentRegisterState = { rows: new Map() };

const DOC_FOLDABLE_TYPES = new Set([
  "AgentBriefIssued",
  "AgentRunCompleted",
  "DecisionRequested",
  "Feedback",
  "RecordFiled",
]);

function isDocumentEvent(event: { type: string }): boolean {
  return DOC_FOLDABLE_TYPES.has(event.type);
}

function citationsFromEvent(event: Event): readonly string[] {
  switch (event.type) {
    case "AgentBriefIssued": {
      const p = event.payload as AgentBriefIssuedPayload;
      return [p.directiveDocumentHash];
    }
    case "AgentRunCompleted": {
      const p = event.payload as AgentRunCompletedPayload;
      return p.deliverableDocumentHashes;
    }
    case "DecisionRequested": {
      const p = event.payload as DecisionRequestedPayload;
      return p.sourceDocumentHashes;
    }
    case "Feedback": {
      const p = event.payload as FeedbackPayload;
      return p.bodyDocumentHash ? [p.bodyDocumentHash] : [];
    }
    case "RecordFiled": {
      const p = event.payload as RecordFiledPayload;
      return [p.documentHash];
    }
    default:
      return [];
  }
}

function ensureRow(state: DocumentRegisterState, hash: string, event: Event): DocumentRegisterRow {
  const existing = state.rows.get(hash);
  if (existing) {
    if (existing.referencedByEventIds.includes(event.event_id)) return existing;
    return {
      ...existing,
      referencedByEventIds: [...existing.referencedByEventIds, event.event_id],
    };
  }
  return {
    documentHash: hash,
    recordId: null,
    firstSeenAt: event.as_of,
    firstReferencedByEventId: event.event_id,
    firstReferencedByEventType: event.type,
    referencedByEventIds: [event.event_id],
    classification: "agent-internal",
    retention: null,
    registerKey: null,
    supersedes: null,
    supersededBy: null,
    registered: false,
    metadata: null,
  };
}

function applyEvent(state: DocumentRegisterState, event: Event): DocumentRegisterState {
  const hashes = citationsFromEvent(event);
  if (hashes.length === 0) return state;
  const next = new Map(state.rows);
  for (const hash of hashes) {
    if (!hash) continue;
    next.set(hash, ensureRow(state, hash, event));
  }

  if (event.type === "RecordFiled") {
    const p = event.payload as RecordFiledPayload;
    const row = next.get(p.documentHash);
    if (row) {
      next.set(p.documentHash, {
        ...row,
        recordId: p.recordId,
        classification: p.classification,
        retention: p.retention,
        registerKey: p.registerKey,
        supersedes: p.supersedes ?? null,
        registered: true,
        metadata: p.metadata ?? null,
      });
    }
    // Mark the predecessor's `supersededBy` chain. The supersedes link is
    // by `recordId`, not `documentHash`; we walk all rows and patch the
    // first match (recordId is unique by construction).
    if (p.supersedes) {
      for (const [hash, candidate] of next) {
        if (candidate.recordId === p.supersedes && candidate.supersededBy === null) {
          next.set(hash, { ...candidate, supersededBy: p.recordId });
          break;
        }
      }
    }
  }

  return { rows: next };
}

export const documentRegisterProjection: Projection<DocumentRegisterState, Event> = {
  name: "rms.document",
  initial: documentRegisterInitial,
  accepts: (e): e is Event => isDocumentEvent(e),
  reduce(state, event) {
    return applyEvent(state, event);
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    // F-007 fix (RMS Phase 2 Block B, D-RMS-PHASE-2-4-AUTHORSHIP,
    // 2026-05-16): replace `z.record(z.unknown())` with a typed schema
    // that mirrors `DocumentRegisterRow` exactly. Drift between this
    // codec and the in-memory shape is now a parse failure (degrades to
    // initial state with structured log) rather than a silent type-cast.
    const retentionSchema = z.object({
      citationRef: z.string().min(1),
      minimumYears: z.number().int().positive(),
      archivalTier: z.enum(["hot", "cool", "archive"]),
    });
    const metadataSchema = z.object({
      title: z.string(),
      path: z.string(),
      category: z.string(),
      author: z.string().optional(),
      date: z.string().optional(),
    });
    const documentRegisterRowSchema = z.object({
      documentHash: z.string(),
      recordId: z.string().nullable(),
      firstSeenAt: z.string(),
      firstReferencedByEventId: z.string(),
      firstReferencedByEventType: z.string(),
      referencedByEventIds: z.array(z.string()),
      classification: z.enum([
        "ceo-only",
        "governance-seat",
        "engineering-seat",
        "agent-internal",
        "public-disclosure",
      ]),
      retention: retentionSchema.nullable(),
      registerKey: z
        .enum([
          "decisions",
          "correspondence",
          "agent-runs",
          "documents",
          "feedback",
          "briefs",
          "workstreams",
        ])
        .nullable(),
      supersedes: z.string().nullable(),
      supersededBy: z.string().nullable(),
      registered: z.boolean(),
      metadata: metadataSchema.nullable(),
    });
    const SnapshotSchema = z.object({
      rows: z.array(z.tuple([z.string(), documentRegisterRowSchema])),
    });
    let raw: unknown;
    try {
      raw = JSON.parse(payload);
    } catch (err) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.document",
          msg: "decodeSnapshot: JSON.parse failed — degrading to empty state (F-007)",
          error: String(err),
        }),
      );
      return documentRegisterInitial;
    }
    const result = SnapshotSchema.safeParse(raw);
    if (!result.success) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "bank-prototype",
          pipeline: "rms.document",
          msg: "decodeSnapshot: Zod validation failed — degrading to empty state (F-007)",
          error: result.error.message,
        }),
      );
      return documentRegisterInitial;
    }
    const parsed = result.data as unknown as { rows: Array<[string, DocumentRegisterRow]> };
    return { rows: new Map(parsed.rows) };
  },
};

export function documentRegisterRows(state: DocumentRegisterState): DocumentRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.firstSeenAt < b.firstSeenAt ? -1 : a.firstSeenAt > b.firstSeenAt ? 1 : 0,
  );
}
