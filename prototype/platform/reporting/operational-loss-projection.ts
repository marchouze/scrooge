// platform/reporting/operational-loss-projection.ts
//
// Operational loss-event register — projection over the OperationalLossEvent
// stream (Principle 1: events are truth; this is a query, never stored state).
//
// Folds the captured internal-loss data set into:
//   - the latest record per lossEventId (latest-wins on as_of, so a status
//     change / recovery update / correction supersedes the prior capture),
//   - open vs closed partitions (open = not yet recovered / closed / written-off),
//   - per-business-line aggregates (count + gross + recovery + net) over the
//     BA 400 β-line taxonomy, split open/closed,
//   - per-BCBS-event-type-category aggregates.
//
// This is the CAPTURE register. It deliberately produces NO capital number —
// op-RWA stays gross-income-blocked (BIA/TSA, revenue-start; Camille CFO;
// platform/reporting/ba-400-op-risk.ts). The loss-data set is a precondition
// for a future loss-distribution approach, not a substitute for it.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   Basel II Annex 9 / BCBS D196 §644; Reg 33 (operational risk).
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import type {
  OperationalLossEventPayload,
  OperationalLossEventTypeCategory,
  OperationalLossStatus,
} from "../event-store/event-types/operational-risk";
import type { EventStore } from "../event-store/store";
import { utcNow } from "../types/time";
import type { BaselBusinessLine } from "./ba-400-op-risk";

/** A loss is "closed" when terminal; otherwise it is "open" (still live). */
const CLOSED_STATUSES: ReadonlySet<OperationalLossStatus> = new Set<OperationalLossStatus>([
  "recovered",
  "closed",
  "written-off",
]);

export function isOpenLoss(status: OperationalLossStatus): boolean {
  return !CLOSED_STATUSES.has(status);
}

/** A single captured loss, with derived net + open/closed bucket. */
export interface OperationalLossRecord {
  readonly lossEventId: string;
  readonly eventDate: string;
  readonly discoveryDate: string;
  readonly grossLossMinor: number;
  readonly recoveryMinor: number;
  /** grossLoss − recovery (never below 0). */
  readonly netLossMinor: number;
  readonly currency: string;
  readonly businessLine: BaselBusinessLine;
  readonly eventTypeCategory: OperationalLossEventTypeCategory;
  readonly status: OperationalLossStatus;
  readonly open: boolean;
  readonly description: string;
  readonly productId?: string;
  /** as_of of the latest event that set this record's state. */
  readonly asOf: string;
}

export interface OperationalLossLineAggregate {
  readonly businessLine: BaselBusinessLine;
  readonly count: number;
  readonly openCount: number;
  readonly closedCount: number;
  readonly grossLossMinor: number;
  readonly recoveryMinor: number;
  readonly netLossMinor: number;
}

export interface OperationalLossCategoryAggregate {
  readonly eventTypeCategory: OperationalLossEventTypeCategory;
  readonly count: number;
  readonly grossLossMinor: number;
  readonly netLossMinor: number;
}

export interface OperationalLossProjection {
  /** Latest record per lossEventId, deterministic order (sorted by lossEventId). */
  readonly records: readonly OperationalLossRecord[];
  readonly openRecords: readonly OperationalLossRecord[];
  readonly closedRecords: readonly OperationalLossRecord[];
  /** Per-business-line aggregate, deterministic order (sorted by businessLine). */
  readonly byBusinessLine: readonly OperationalLossLineAggregate[];
  /** Per-BCBS-event-type-category aggregate, deterministic order. */
  readonly byEventTypeCategory: readonly OperationalLossCategoryAggregate[];
  readonly totals: {
    readonly count: number;
    readonly openCount: number;
    readonly closedCount: number;
    readonly grossLossMinor: number;
    readonly recoveryMinor: number;
    readonly netLossMinor: number;
  };
  readonly asOf: string;
}

interface MutableRecord {
  payload: OperationalLossEventPayload;
  asOf: string;
}

/**
 * Fold every OperationalLossEvent into the read-model. Single pass; latest-wins
 * per lossEventId on as_of (ties broken by stream order — later replay wins).
 */
export function buildOperationalLossProjection(
  store: Pick<EventStore, "replay">,
  asOf?: string,
): OperationalLossProjection {
  const latest = new Map<string, MutableRecord>();

  for (const e of store.replay({ type: "OperationalLossEvent" })) {
    const p = e.payload as OperationalLossEventPayload;
    if (typeof p.lossEventId !== "string") continue;
    const prior = latest.get(p.lossEventId);
    // latest-wins: replace when this event is at or after the prior as_of
    // (stream order resolves ties so the later-replayed event wins).
    if (prior === undefined || e.as_of >= prior.asOf) {
      latest.set(p.lossEventId, { payload: p, asOf: e.as_of });
    }
  }

  const records: OperationalLossRecord[] = [];
  for (const { payload: p, asOf: recordAsOf } of latest.values()) {
    const recovery = p.recoveryMinor ?? 0;
    const net = Math.max(0, p.grossLossMinor - recovery);
    const open = isOpenLoss(p.status);
    const record: OperationalLossRecord = {
      lossEventId: p.lossEventId,
      eventDate: p.eventDate,
      discoveryDate: p.discoveryDate,
      grossLossMinor: p.grossLossMinor,
      recoveryMinor: recovery,
      netLossMinor: net,
      currency: p.currency,
      businessLine: p.businessLine,
      eventTypeCategory: p.eventTypeCategory,
      status: p.status,
      open,
      description: p.description,
      ...(p.productId !== undefined ? { productId: p.productId } : {}),
      asOf: recordAsOf,
    };
    records.push(record);
  }
  records.sort((a, b) => a.lossEventId.localeCompare(b.lossEventId));

  // Per-business-line aggregate.
  const lineMap = new Map<BaselBusinessLine, OperationalLossLineAggregate>();
  for (const r of records) {
    const prev = lineMap.get(r.businessLine) ?? {
      businessLine: r.businessLine,
      count: 0,
      openCount: 0,
      closedCount: 0,
      grossLossMinor: 0,
      recoveryMinor: 0,
      netLossMinor: 0,
    };
    lineMap.set(r.businessLine, {
      businessLine: r.businessLine,
      count: prev.count + 1,
      openCount: prev.openCount + (r.open ? 1 : 0),
      closedCount: prev.closedCount + (r.open ? 0 : 1),
      grossLossMinor: prev.grossLossMinor + r.grossLossMinor,
      recoveryMinor: prev.recoveryMinor + r.recoveryMinor,
      netLossMinor: prev.netLossMinor + r.netLossMinor,
    });
  }
  const byBusinessLine = [...lineMap.values()].sort((a, b) =>
    a.businessLine.localeCompare(b.businessLine),
  );

  // Per-event-type-category aggregate.
  const catMap = new Map<OperationalLossEventTypeCategory, OperationalLossCategoryAggregate>();
  for (const r of records) {
    const prev = catMap.get(r.eventTypeCategory) ?? {
      eventTypeCategory: r.eventTypeCategory,
      count: 0,
      grossLossMinor: 0,
      netLossMinor: 0,
    };
    catMap.set(r.eventTypeCategory, {
      eventTypeCategory: r.eventTypeCategory,
      count: prev.count + 1,
      grossLossMinor: prev.grossLossMinor + r.grossLossMinor,
      netLossMinor: prev.netLossMinor + r.netLossMinor,
    });
  }
  const byEventTypeCategory = [...catMap.values()].sort((a, b) =>
    a.eventTypeCategory.localeCompare(b.eventTypeCategory),
  );

  const openRecords = records.filter((r) => r.open);
  const closedRecords = records.filter((r) => !r.open);

  const totals = records.reduce(
    (acc, r) => ({
      count: acc.count + 1,
      openCount: acc.openCount + (r.open ? 1 : 0),
      closedCount: acc.closedCount + (r.open ? 0 : 1),
      grossLossMinor: acc.grossLossMinor + r.grossLossMinor,
      recoveryMinor: acc.recoveryMinor + r.recoveryMinor,
      netLossMinor: acc.netLossMinor + r.netLossMinor,
    }),
    {
      count: 0,
      openCount: 0,
      closedCount: 0,
      grossLossMinor: 0,
      recoveryMinor: 0,
      netLossMinor: 0,
    },
  );

  return {
    records,
    openRecords,
    closedRecords,
    byBusinessLine,
    byEventTypeCategory,
    totals,
    asOf: asOf ?? utcNow(),
  };
}
