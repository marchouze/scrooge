// platform/accounting/period-close.ts
//
// Period-close orchestration helper — D-REPORTING-CAPABILITY-SLICE-2.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
// (CEO-approved 2026-05-10), pack §6 Slice 2.
//
// This module supplies a small set of pure functions and one orchestrator
// that compose the three Slice-2 event types
// (`AccountingPeriodOpened`, `AccountingPeriodClosed`,
// `TrialBalanceSnapshotted`) into a per-entity close transaction:
//
//   1. `openPeriod`         — appends an `AccountingPeriodOpened` event for
//                             a given (entity, periodId). Refuses to open
//                             a period that is already open and not closed
//                             (idempotent-terminal). Tolerates idempotent
//                             re-open of the same payload (no-op return).
//                             Reopens after close require an explicit
//                             `reopenOf` event_id and `reopenReason`.
//
//   2. `computeTrialBalance` — folds the existing M1
//                             `SubLedgerPostingEmitted` stream over the
//                             period (entity, periodStart..periodEnd) and
//                             returns per-(account, currency) signed
//                             balances + per-currency debit/credit totals.
//                             Pure function; no event side-effects.
//
//   3. `closePeriod`        — runs the close transaction:
//                               (a) compute the trial balance for the period.
//                               (b) optionally write the trial-balance JSON
//                                   to the RMS document store (BLAKE3 hash).
//                               (c) append `TrialBalanceSnapshotted` (kind:
//                                   "close") with rows + per-currency totals
//                                   + optional document hash.
//                               (d) call `eventStore.snapshot({...})` with
//                                   the per-entity stream-key so the
//                                   D-EVENT-STORE-SCALING Slice 2 snapshot
//                                   substrate caches the trial-balance for
//                                   replayFromSnapshot consumers.
//                               (e) append `AccountingPeriodClosed` referencing
//                                   the snapshot's event_id.
//                             All five steps share the same `closedAt`. The
//                             orchestrator returns the typed result for the
//                             caller (close audit trail).
//
// Per-entity isolation. Pack §6 Q2 — each Hoz entity (LE-ZA-HOZ-BANK,
// LE-ZA-HOZ-SECURITIES, LE-ZA-HOZ-GROUP) runs its own open/close chain.
// The orchestrator scopes every replay/append to `args.entity` and uses
// the per-entity stream-key `<entity>|accounting-period` for snapshots.
//
// Provenance discipline (D-DATA-PROVENANCE-SUBSTRATE). Every event the
// orchestrator emits carries the caller-supplied `provenance` tag (or
// none — the event-store's soft-tagger will default it). Production
// closes use `productionTag({sourceLineage: 'agent:bea:period-close'})`;
// dry-run / scenario closes use `simulatedTag({scenario, sourceLineage:
// 'agent:bea:period-close'})`. The orchestrator is provenance-agnostic —
// callers attach the tag.
//
// Substrate gaps surfaced (forward-link, named in the Slice-2 decision
// record):
//   - **Chart-of-accounts coverage** — M1 stub leaf account IDs flow
//     through the trial balance unchanged. Slice 6+ projection-runtime
//     rebuild requires the chart populated (Bea M1 substrate-gap §3,
//     target M2). The trial-balance schema accepts both `ACC-NNNN-NNN`
//     and `ACC-<slug>` for forward-compat.
//   - **IFRS statement renderer** — Slice 6+ territory; not built here.
//     `TrialBalanceSnapshotted.rows` is the input contract.
//   - **BA 110 / BA-form generators** — Slice 3+ territory; not built
//     here.
//   - **Concurrency control** — close orchestration assumes single-writer
//     per (entity, periodId). Multi-writer guard is a Vera follow-on
//     (substrate-gap; named in the decision record §6).
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; close orchestration owner)
//   + Atlas (Core banking platform architect, engineering — substrate
//   consult; snapshot integration + stream-key convention).

import { amountToMinorUnits } from "../core/decimal-money";
import { type MoneyWire, legAmountMoney } from "../core/money-codec";
import type { DocumentStore } from "../document-store";
import {
  type AccountingPeriodClosedPayload,
  type AccountingPeriodOpenedPayload,
  type TrialBalanceSnapshotRow,
  type TrialBalanceSnapshottedPayload,
  makeAccountingPeriodClosed,
  makeAccountingPeriodOpened,
  makeTrialBalanceSnapshotted,
} from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor, Event, ProvenanceTag } from "../event-store/types";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { readWithOutputSnapshot } from "../projections/output-snapshot-cache";

// ---------------------------------------------------------------------------
// Stream-key convention
// ---------------------------------------------------------------------------

/**
 * Stream-key for the per-entity accounting-period stream. Per
 * D-EVENT-STORE-SCALING Slice 2 Q4 + pack §6 Q2 — one stream per legal
 * entity; close-snapshots keyed on this stream so loadSnapshot resolves
 * the latest period-end snapshot ≤ asOf.
 */
export function periodCloseStreamKey(entity: string): string {
  if (!entity) throw new Error("periodCloseStreamKey: entity required");
  return `${entity}|accounting-period`;
}

// ---------------------------------------------------------------------------
// openPeriod
// ---------------------------------------------------------------------------

export interface OpenPeriodArgs {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly actor: Actor;
  readonly citations: readonly string[];
  readonly payload: AccountingPeriodOpenedPayload;
  /** ISO 8601 — append-time `as_of`. Convention: same as `openedAt`. */
  readonly asOf?: string;
  readonly provenance?: ProvenanceTag;
}

export interface OpenPeriodResult {
  readonly event: Event;
  /** True iff this call appended a new event; false if the period was already open with this payload. */
  readonly appended: boolean;
}

/**
 * Open an accounting period for `args.entity` at `args.payload.periodId`.
 *
 * Idempotency: if an `AccountingPeriodOpened` for this (entity, periodId)
 * already exists, the call is a no-op return (`appended: false`). If a
 * matching `AccountingPeriodClosed` exists and `args.payload.reopenOf` is
 * NOT set, this throws — reopens require explicit `reopenOf` discipline
 * (audit-sensitive per pack §6 Slice 2).
 */
export function openPeriod(args: OpenPeriodArgs): OpenPeriodResult {
  const asOf = args.asOf ?? args.payload.openedAt;
  const periodId = args.payload.periodId;

  const isReopen = Boolean(args.payload.reopenOf);

  // Walk existing events for this (entity, periodId).
  let priorOpened: Event | undefined;
  let priorClosed: Event | undefined;
  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodOpened",
  })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === periodId && !p.reopenOf) priorOpened = e;
  }
  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodClosed",
  })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === periodId) priorClosed = e;
  }

  if (priorOpened && !priorClosed && !isReopen) {
    // Period already open and not closed — idempotent return iff payload matches.
    const priorPayload = priorOpened.payload as unknown as AccountingPeriodOpenedPayload;
    if (
      priorPayload.periodKind === args.payload.periodKind &&
      priorPayload.periodStart === args.payload.periodStart &&
      priorPayload.periodEnd === args.payload.periodEnd &&
      priorPayload.functionalCurrency === args.payload.functionalCurrency
    ) {
      return { event: priorOpened, appended: false };
    }
    throw new Error(
      `openPeriod: period ${periodId} already open for entity ${args.entity} with a different payload`,
    );
  }

  if (priorClosed && !isReopen) {
    throw new Error(
      `openPeriod: period ${periodId} for entity ${args.entity} is closed (event_id=${priorClosed.event_id}); reopen requires \`reopenOf\` + \`reopenReason\``,
    );
  }

  if (isReopen && args.payload.reopenOf !== priorClosed?.event_id) {
    throw new Error(
      `openPeriod: reopenOf=${args.payload.reopenOf} does not match prior AccountingPeriodClosed event_id (${priorClosed?.event_id ?? "none"}) for period ${periodId}`,
    );
  }

  const event = makeAccountingPeriodOpened({
    asOf,
    entity: args.entity,
    actor: args.actor,
    citations: [...args.citations],
    payload: args.payload,
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
  args.eventStore.append(event);
  return { event, appended: true };
}

// ---------------------------------------------------------------------------
// computeTrialBalance
// ---------------------------------------------------------------------------

export interface ComputeTrialBalanceArgs {
  readonly eventStore: EventStore;
  readonly entity: string;
  /** Inclusive start of the fold window. Convention: AccountingPeriodOpened.periodStart. */
  readonly periodStart: string;
  /** Inclusive end of the fold window. Convention: AccountingPeriodOpened.periodEnd. */
  readonly periodEnd: string;
}

export interface TrialBalance {
  readonly rows: readonly TrialBalanceSnapshotRow[];
  readonly perCurrencyTotals: readonly {
    readonly currency: string;
    readonly debitMinor: number;
    readonly creditMinor: number;
  }[];
  /** Last `SubLedgerPostingEmitted` sequence folded. */
  readonly uptoSequence: number;
}

// Two on-disk leg formats exist:
//   v1 (legacy, scenario 03): { debit: string, credit: string, currency, amountMinor }
//   v2 (fx-accounting.ts):    { accountId: string, debitCredit: "debit"|"credit", currency, amountMinor }
// computeTrialBalance handles both.
// Each leg carries the decimal `amount` (MoneyWire) source of truth on the wire;
// `amountMinor` is the legacy compat field, optional here because the readers
// source value from `amount` via `legAmountMoney` (D-DECIMAL-NATIVE-CONSUMER-
// MIGRATION-BEFORE-WAVE-3). `legAmountMoney` lifts legacy amountMinor-only legs.
type SubLedgerLegV1 = {
  readonly debit: string;
  readonly credit: string;
  readonly currency: string;
  readonly amount?: MoneyWire;
  readonly amountMinor?: number;
};
type SubLedgerLegV2 = {
  readonly accountId: string;
  readonly debitCredit: "debit" | "credit";
  readonly currency: string;
  readonly amount?: MoneyWire;
  readonly amountMinor?: number;
};
type SubLedgerLeg = SubLedgerLegV1 | SubLedgerLegV2;

function isLegV2(leg: SubLedgerLeg): leg is SubLedgerLegV2 {
  return "accountId" in leg;
}

/**
 * Compute the per-(account, currency) trial balance for `entity` over the
 * inclusive window [periodStart, periodEnd]. Folds the M1
 * `SubLedgerPostingEmitted` event stream — every leg posts +amountMinor
 * to the debit account and -amountMinor to the credit account in the
 * leg's currency. The resulting trial balance is per-currency balanced
 * by construction (every leg contributes equal debit and credit).
 *
 * Rows with a zero net balance are dropped (a closed account that
 * netted to zero adds noise without information).
 *
 * Pure function — no events appended.
 */
export function computeTrialBalance(args: ComputeTrialBalanceArgs): TrialBalance {
  // D-PROJECTION-SNAPSHOT-ADOPTION — read through the byte-identical
  // output-snapshot cache. `computeTrialBalanceUncached` (below) is the
  // unchanged pure fold. The cache returns it without recompute only when
  // the store population (count) is unchanged for this exact (entity, period
  // window); since the fold bounds on `as_of ∈ [periodStart, periodEnd]`
  // (not on append-sequence), any new SubLedgerPostingEmitted changes count()
  // and invalidates the cache — so the cached output is bit-for-bit the
  // un-cached value. The period window is encoded in the stream key; we use
  // `periodEnd` as the snapshot asOf.
  const { output } = readWithOutputSnapshot<TrialBalance>({
    store: args.eventStore,
    streamKey: `trial-balance:${args.entity}:${args.periodStart}..${args.periodEnd}`,
    asOf: args.periodEnd,
    compute: () => computeTrialBalanceUncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as TrialBalance,
  });
  return output;
}

/**
 * Unchanged pure trial-balance fold. Kept as the slow path behind the
 * output-snapshot cache in `computeTrialBalance`. Direct callers wanting to
 * bypass the cache (e.g. the equality regression test) call this.
 */
export function computeTrialBalanceUncached(args: ComputeTrialBalanceArgs): TrialBalance {
  // Per-(account|currency) signed amount in minor units.
  // Sign convention: positive = debit balance; negative = credit balance.
  const balances = new Map<string, { account: string; currency: string; amount: number }>();
  let uptoSequence = 0;

  // Provenance filter: exclude simulated events from production trial-balance
  // computation. Authority: D-PROVENANCE-FILTER-ENFORCEMENT (CEO-approved 2026-05-12).
  const provenanceFilter = defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "SubLedgerPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;
    if (e.as_of < args.periodStart || e.as_of > args.periodEnd) continue;
    const payload = e.payload as unknown as { legs?: readonly SubLedgerLeg[] };
    if (!payload.legs) continue;
    for (const leg of payload.legs) {
      // Source the value from the decimal `amount` source of truth (legacy
      // amountMinor-only legs are lifted by `legAmountMoney`).
      const legMinor = Number(amountToMinorUnits(legAmountMoney(leg)));
      if (isLegV2(leg)) {
        const key = `${leg.accountId}|${leg.currency}`;
        const row = balances.get(key) ?? {
          account: leg.accountId,
          currency: leg.currency,
          amount: 0,
        };
        row.amount += leg.debitCredit === "debit" ? legMinor : -legMinor;
        balances.set(key, row);
      } else {
        // v1 format: one entry covers debit account (+) and credit account (-)
        const dk = `${leg.debit}|${leg.currency}`;
        const dr = balances.get(dk) ?? { account: leg.debit, currency: leg.currency, amount: 0 };
        dr.amount += legMinor;
        balances.set(dk, dr);
        const ck = `${leg.credit}|${leg.currency}`;
        const cr = balances.get(ck) ?? { account: leg.credit, currency: leg.currency, amount: 0 };
        cr.amount -= legMinor;
        balances.set(ck, cr);
      }
    }
    // The store doesn't surface sequence on Event; we fold by count of
    // SubLedgerPostingEmitted events. Slice 5 stream-partitioning will
    // give us a real per-stream sequence; until then the count is the
    // proxy and is sufficient for the close-orchestration's purpose
    // (reproducibility witness — the same N events fold to the same TB).
    uptoSequence += 1;
  }

  // Drop zero-net rows; sort deterministically (account, currency) for
  // forensic reproducibility.
  const rows: TrialBalanceSnapshotRow[] = [];
  for (const row of balances.values()) {
    if (row.amount === 0) continue;
    rows.push({
      leafAccountId: row.account,
      currency: row.currency,
      amountMinor: row.amount,
    });
  }
  rows.sort((a, b) => {
    if (a.leafAccountId < b.leafAccountId) return -1;
    if (a.leafAccountId > b.leafAccountId) return 1;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  // Per-currency totals: derive from the post-drop rows so they match
  // the TrialBalanceSnapshotted schema's row-vs-totals invariant. This is
  // the trial-balance discipline IAS 1 implies — debits = credits when
  // summed across surviving accounts; cancelling pairs that net to zero
  // are dropped at the row level and contribute zero to the totals.
  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? { debit: 0, credit: 0 };
    if (row.amountMinor >= 0) t.debit += row.amountMinor;
    else t.credit += -row.amountMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const perCurrencyTotals = [...totalsByCurrency.entries()]
    .map(([currency, t]) => ({
      currency,
      debitMinor: t.debit,
      creditMinor: t.credit,
    }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));

  return { rows, perCurrencyTotals, uptoSequence };
}

// ---------------------------------------------------------------------------
// closePeriod
// ---------------------------------------------------------------------------

export interface ClosePeriodArgs {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly periodId: string;
  /** ISO 8601 — when the period closed (processing time, ≥ periodEnd). */
  readonly closedAt: string;
  readonly actor: Actor;
  readonly citations: readonly string[];
  /**
   * Optional document store. When supplied, the trial-balance JSON is
   * written content-addressed; the resulting hash flows into both
   * `TrialBalanceSnapshotted.documentHash` and
   * `AccountingPeriodClosed.trialBalanceDocumentHash`.
   */
  readonly documentStore?: DocumentStore;
  readonly provenance?: ProvenanceTag;
}

export interface ClosePeriodResult {
  readonly trialBalance: TrialBalance;
  readonly trialBalanceSnapshotEvent: Event;
  readonly accountingPeriodClosedEvent: Event;
  /** RMS document-store hash, when a documentStore was supplied. */
  readonly documentHash?: string;
  /** Snapshot row id from EvSS Slice 2 snapshot substrate. */
  readonly snapshotRowId: number;
}

/**
 * Run the close transaction for (entity, periodId). See module header for
 * the five-step sequence.
 *
 * Throws if no `AccountingPeriodOpened` exists for (entity, periodId), or
 * if a matching `AccountingPeriodClosed` already exists (idempotent-
 * terminal — closes are forensic). Reopen-then-reclose is permitted via
 * `openPeriod` first (the reopen creates a new `AccountingPeriodOpened`
 * with `reopenOf`; subsequent `closePeriod` matches the most-recent
 * open).
 */
export function closePeriod(args: ClosePeriodArgs): ClosePeriodResult {
  // Find the most-recent (by sequence — replay is ordered) open event
  // that has not yet been matched by a close.
  let mostRecentOpen: Event | undefined;
  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodOpened",
  })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === args.periodId) mostRecentOpen = e;
  }
  if (!mostRecentOpen) {
    throw new Error(
      `closePeriod: no AccountingPeriodOpened for (entity=${args.entity}, periodId=${args.periodId})`,
    );
  }

  // Reject if a close already exists with `as_of` ≥ the most-recent open.
  // (Reopens append a new open whose `as_of` > prior close, so this
  // rule catches double-close while permitting reopen-reclose.)
  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "AccountingPeriodClosed",
  })) {
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === args.periodId && e.as_of >= mostRecentOpen.as_of) {
      throw new Error(
        `closePeriod: period ${args.periodId} already closed for entity ${args.entity} (event_id=${e.event_id})`,
      );
    }
  }

  const openedPayload = mostRecentOpen.payload as unknown as AccountingPeriodOpenedPayload;

  // (a) compute the trial balance.
  const trialBalance = computeTrialBalance({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: openedPayload.periodStart,
    periodEnd: openedPayload.periodEnd,
  });

  // (b) optionally write trial-balance JSON to the document store.
  let documentHash: string | undefined;
  if (args.documentStore) {
    const json = JSON.stringify({
      entity: args.entity,
      periodId: args.periodId,
      asOf: args.closedAt,
      uptoSequence: trialBalance.uptoSequence,
      rows: trialBalance.rows,
      perCurrencyTotals: trialBalance.perCurrencyTotals,
    });
    const put = args.documentStore.put(json);
    documentHash = put.hash;
  }

  // (c) construct + append TrialBalanceSnapshotted.
  const tbPayload: TrialBalanceSnapshottedPayload = {
    periodId: args.periodId,
    snapshotKind: "close",
    snapshotAsOf: args.closedAt,
    uptoSequence: trialBalance.uptoSequence,
    rows: [...trialBalance.rows],
    perCurrencyTotals: [...trialBalance.perCurrencyTotals],
    ...(documentHash ? { documentHash } : {}),
  };
  const tbEvent = makeTrialBalanceSnapshotted({
    asOf: args.closedAt,
    entity: args.entity,
    actor: args.actor,
    citations: [...args.citations],
    payload: tbPayload,
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
  args.eventStore.append(tbEvent);

  // Capture the event store high-watermark immediately after appending the
  // trial-balance snapshot. This frozen cursor flows into
  // `AccountingPeriodClosed.eventSequence` so that all downstream subscribers
  // (BA 110, BA 310, BA 300, conduct, CMS, climate) replay against the same
  // event window, preventing divergence when new events append concurrently.
  // Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
  const closedAtSequence = args.eventStore.highWatermark();

  // (d) cache the trial balance via the EvSS Slice 2 snapshot substrate.
  // Stream-key partitions per entity per pack §6 Q2 + D-EVENT-STORE-
  // SCALING Slice 2 Q4. Payload is the same JSON shape as the doc-store
  // (a denormalised cache for replayFromSnapshot consumers).
  const snapPayload = JSON.stringify({
    periodId: args.periodId,
    asOf: args.closedAt,
    uptoSequence: trialBalance.uptoSequence,
    rows: trialBalance.rows,
    perCurrencyTotals: trialBalance.perCurrencyTotals,
    trialBalanceSnapshotEventId: tbEvent.event_id,
    ...(documentHash ? { documentHash } : {}),
  });
  const snapshotRow = args.eventStore.snapshot({
    streamKey: periodCloseStreamKey(args.entity),
    asOf: args.closedAt,
    uptoSequence: trialBalance.uptoSequence,
    payload: snapPayload,
  });

  // (e) append AccountingPeriodClosed referencing the snapshot.
  const closedPayload: AccountingPeriodClosedPayload = {
    periodId: args.periodId,
    closedAt: args.closedAt,
    trialBalanceSnapshotEventId: tbEvent.event_id,
    uptoSequence: trialBalance.uptoSequence,
    eventSequence: closedAtSequence,
    ...(documentHash ? { trialBalanceDocumentHash: documentHash } : {}),
  };
  const closedEvent = makeAccountingPeriodClosed({
    asOf: args.closedAt,
    entity: args.entity,
    actor: args.actor,
    citations: [...args.citations],
    payload: closedPayload,
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
  args.eventStore.append(closedEvent);

  return {
    trialBalance,
    trialBalanceSnapshotEvent: tbEvent,
    accountingPeriodClosedEvent: closedEvent,
    ...(documentHash !== undefined ? { documentHash } : {}),
    snapshotRowId: snapshotRow.id,
  };
}

// ---------------------------------------------------------------------------
// Replay helpers (read-side; consumers query close audit chains)
// ---------------------------------------------------------------------------

/**
 * The forensic chain for (entity, periodId): every open + close + reopen
 * event in append order. Used by Vera's continuous-controls recon and by
 * the dashboard's period-status tile.
 */
export function periodAuditChain(args: {
  readonly eventStore: EventStore;
  readonly entity: string;
  readonly periodId: string;
}): readonly Event[] {
  const chain: Event[] = [];
  for (const e of args.eventStore.replay({ entity: args.entity })) {
    if (
      e.type !== "AccountingPeriodOpened" &&
      e.type !== "AccountingPeriodClosed" &&
      e.type !== "TrialBalanceSnapshotted"
    ) {
      continue;
    }
    const p = e.payload as Record<string, unknown>;
    if (p.periodId === args.periodId) chain.push(e);
  }
  return chain;
}
