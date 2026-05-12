// platform/rms-registers/correspondence.ts
//
// RMS Phase 1 Slice 3 — Correspondence register projection.
//
// Spec §6.2. Folds `RecordFiled` events whose `registerKey === "correspondence"`
// into one row per `recordId`. Supersession is materialised via the
// `supersedes` link: the prior row is marked `supersededBy: <newRecordId>`
// and the new row carries `supersedes: <oldRecordId>`. Both rows remain
// queryable; current views filter to `supersededBy === null`.
//
// Author: Anya (Data / analytics engineer, engineering)

import { z } from "zod";
import type { RecordFiledPayload } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import type { Projection } from "../projections/types";

export interface CorrespondenceRegisterRow {
  readonly correspondenceId: string;
  readonly recordEventId: string;
  readonly documentHash: string;
  readonly classification: RecordFiledPayload["classification"];
  readonly retention: RecordFiledPayload["retention"];
  readonly correspondenceAt: string;
  readonly supersedes: string | null;
  readonly supersededBy: string | null;
  readonly correctsOriginalErrors: boolean;
}

export interface CorrespondenceRegisterState {
  readonly rows: ReadonlyMap<string, CorrespondenceRegisterRow>;
}

export const correspondenceRegisterInitial: CorrespondenceRegisterState = {
  rows: new Map(),
};

function isCorrespondenceEvent(event: Event): boolean {
  if (event.type !== "RecordFiled") return false;
  const p = event.payload as RecordFiledPayload;
  return p.registerKey === "correspondence";
}

function applyRecordFiled(
  state: CorrespondenceRegisterState,
  event: Event,
): CorrespondenceRegisterState {
  const p = event.payload as RecordFiledPayload;
  const id = p.recordId;
  if (!id) return state;
  const next = new Map(state.rows);

  // Mark predecessor as superseded if cited.
  if (p.supersedes) {
    const prior = next.get(p.supersedes);
    if (prior) {
      next.set(p.supersedes, { ...prior, supersededBy: id });
    }
  }

  next.set(id, {
    correspondenceId: id,
    recordEventId: event.event_id,
    documentHash: p.documentHash,
    classification: p.classification,
    retention: p.retention,
    correspondenceAt: event.as_of,
    supersedes: p.supersedes ?? null,
    supersededBy: null,
    correctsOriginalErrors: Boolean(p.correctsOriginalErrors),
  });
  return { rows: next };
}

export const correspondenceRegisterProjection: Projection<CorrespondenceRegisterState, Event> = {
  name: "rms.correspondence",
  initial: correspondenceRegisterInitial,
  accepts: (e): e is Event => isCorrespondenceEvent(e),
  reduce(state, event) {
    return applyRecordFiled(state, event);
  },
  encodeSnapshot(state) {
    return JSON.stringify({ rows: Array.from(state.rows.entries()) });
  },
  decodeSnapshot(payload) {
    const SnapshotSchema = z.object({
      rows: z.array(z.tuple([z.string(), z.record(z.unknown())])),
    });
    const result = SnapshotSchema.safeParse(JSON.parse(payload));
    if (!result.success) {
      throw new Error(`decodeSnapshot: invalid payload — ${result.error.message}`);
    }
    const parsed = result.data as unknown as { rows: Array<[string, CorrespondenceRegisterRow]> };
    return { rows: new Map(parsed.rows) };
  },
};

export function correspondenceRegisterRows(
  state: CorrespondenceRegisterState,
): CorrespondenceRegisterRow[] {
  return Array.from(state.rows.values()).sort((a, b) =>
    a.correspondenceAt < b.correspondenceAt ? -1 : a.correspondenceAt > b.correspondenceAt ? 1 : 0,
  );
}
