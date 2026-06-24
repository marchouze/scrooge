// platform/markets/settlement/cash-sink.ts
//
// SHARED STORE-AGNOSTIC settlement sink (Slice 0, WS-FX-V2-SIMULATOR Phase 2).
//
// Slice 0 unifies the two FX-settlement → cash-instrument-of-record emit paths
// that diverged in Phase 1:
//   - the SIMULATOR scenario path (`settle-fx-leg.ts`) appends FIL lifecycle
//     events to the in-memory scenario `EventStore` via the registered factories;
//   - the PRODUCTION path (`materialise-settled-cash.ts`) INSERTs the same FIL
//     lifecycle events into the standalone v2-anchor SQLite store.
//
// Both build the SAME payloads (now via the ONE shared grammar,
// `v2-core/fil-instances/cash-materialisation.ts`). The ONLY difference is WHERE
// the events land. This module is the seam that parameterises that: a `CashSink`
// is "a place FIL lifecycle events can be idempotently appended". Two adapters
// implement it — one over a scenario `EventStore`, one over the anchor SQLite —
// so the two paths converge on a single sink contract (Principle 1 — one grammar,
// one sink, parameterised by store).
//
// IDEMPOTENCY is the sink's responsibility: it answers `hasCreated(instance)` /
// `hasTerminated(instance)` and only appends when absent (append-only, replay-
// safe — Principle 1).
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION; Principle 1;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed; root-cause; no fork).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import type {
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import type { TradeSettlementExecutedPayload } from "../../../v2-core/fil-instances/trade-settlement";
import { newEventId } from "../../core/types";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
  makeTradeSettlementExecuted,
} from "../../event-store/event-types/fil-instances";
import { type ProvenanceTag, provenanceForEmit } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

// ---------------------------------------------------------------------------
// The store-agnostic sink contract.
// ---------------------------------------------------------------------------

export interface CashSink {
  /** Has a FilInstrumentCreated for this instance URN already been emitted? */
  hasCreated(instanceUrn: string): boolean;
  /** Has a FilInstrumentTerminated for this instance URN already been emitted? */
  hasTerminated(instanceUrn: string): boolean;
  /**
   * Has a `TradeSettlementExecuted` for this HOLDING instance URN already been
   * emitted? (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2.) Idempotency keys on the
   * deterministic holding URN — the same `<tradeId>-cash-<side>` stem the cash
   * create uses — so a re-run appends nothing (append-only, replay-safe).
   */
  hasSettlement(holdingInstanceUrn: string): boolean;
  /** Append a FilInstrumentCreated. The sink owns event-id + envelope. */
  appendCreated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentCreatedPayload;
    /** Deterministic event-id where the caller wants replay-stable ids (scenario). */
    readonly eventId?: string;
  }): void;
  /** Append a FilInstrumentTerminated. The sink owns event-id + envelope. */
  appendTerminated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentTerminatedPayload;
    readonly eventId?: string;
  }): void;
  /**
   * Append a `TradeSettlementExecuted` — the born-V2 single-asset settlement-of-
   * record (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2). The sink owns event-id +
   * envelope.
   */
  appendSettlement(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: TradeSettlementExecutedPayload;
    readonly eventId?: string;
  }): void;
}

const SINK_ACTOR = { type: "service" as const, id: "agent:settlement:cash-sink" };

// ---------------------------------------------------------------------------
// EventStore-backed sink — the SIMULATOR scenario path. Appends via the
// registered born-V2 factories so the scenario store carries the canonical
// validated events. Idempotency reads the scenario store's replay.
// ---------------------------------------------------------------------------

export class EventStoreCashSink implements CashSink {
  private readonly store: EventStore;
  private readonly actor: { readonly type: "service"; readonly id: string };
  /**
   * OPTIONAL explicit provenance applied to every emitted FIL lifecycle event.
   * Defaults to the active category policy via `provenanceForEmit` (the normal
   * SUT/production path). The LIVE simulator (simulation-v2-live/) passes a
   * `simulated` tag so the cash legs it materialises are provenance-segregated in
   * the shared event store and never leak into production reads.
   */
  private readonly provenance: ProvenanceTag | undefined;

  constructor(
    store: EventStore,
    actor?: { readonly type: "service"; readonly id: string },
    provenance?: ProvenanceTag,
  ) {
    this.store = store;
    this.actor = actor ?? SINK_ACTOR;
    this.provenance = provenance;
  }

  hasCreated(instanceUrn: string): boolean {
    return [...this.store.replay({ type: "FilInstrumentCreated" })].some(
      (e) => (e.payload as { instance?: string }).instance === instanceUrn,
    );
  }

  hasTerminated(instanceUrn: string): boolean {
    return [...this.store.replay({ type: "FilInstrumentTerminated" })].some(
      (e) => (e.payload as { instance?: string }).instance === instanceUrn,
    );
  }

  hasSettlement(holdingInstanceUrn: string): boolean {
    return [...this.store.replay({ type: "TradeSettlementExecuted" })].some(
      (e) => (e.payload as { holdingInstance?: string }).holdingInstance === holdingInstanceUrn,
    );
  }

  appendCreated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentCreatedPayload;
    readonly eventId?: string;
  }): void {
    this.store.append(
      makeFilInstrumentCreated({
        asOf: args.asOf,
        entity: args.entity,
        actor: this.actor,
        citations: [...args.citations],
        // EXPLICIT provenance (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN): the
        // settlement cash-sink is the originating system; kind via category policy.
        provenance:
          this.provenance ??
          provenanceForEmit("FilInstrumentCreated", {
            sourceLineage: "settlement:cash-sink",
          }),
        eventId: args.eventId ?? newEventId(),
        payload: args.payload,
      }),
    );
  }

  appendTerminated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentTerminatedPayload;
    readonly eventId?: string;
  }): void {
    this.store.append(
      makeFilInstrumentTerminated({
        asOf: args.asOf,
        entity: args.entity,
        actor: this.actor,
        citations: [...args.citations],
        provenance:
          this.provenance ??
          provenanceForEmit("FilInstrumentTerminated", {
            sourceLineage: "settlement:cash-sink",
          }),
        eventId: args.eventId ?? newEventId(),
        payload: args.payload,
      }),
    );
  }

  appendSettlement(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: TradeSettlementExecutedPayload;
    readonly eventId?: string;
  }): void {
    this.store.append(
      makeTradeSettlementExecuted({
        asOf: args.asOf,
        entity: args.entity,
        actor: this.actor,
        citations: [...args.citations],
        provenance:
          this.provenance ??
          provenanceForEmit("TradeSettlementExecuted", {
            sourceLineage: "settlement:cash-sink",
          }),
        eventId: args.eventId ?? newEventId(),
        payload: args.payload,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// Anchor-DB-backed sink — the PRODUCTION path. INSERTs into the v2-anchor SQLite
// `v2_events` table (the same table `materialise-settled-cash.ts` wrote to). The
// table DDL mirrors the seed so a fresh store materialises correctly. The writer
// is opened once and held for the sink's lifetime; call `close()` when done.
// ---------------------------------------------------------------------------

const ANCHOR_DDL = `
CREATE TABLE IF NOT EXISTS v2_events (
  sequence    INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT    UNIQUE NOT NULL,
  type        TEXT    NOT NULL,
  as_of       TEXT    NOT NULL,
  entity      TEXT    NOT NULL,
  actor_type  TEXT    NOT NULL,
  actor_id    TEXT    NOT NULL,
  citations   TEXT    NOT NULL,
  payload     TEXT    NOT NULL,
  recorded_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_v2_type   ON v2_events(type);
CREATE INDEX IF NOT EXISTS idx_v2_entity ON v2_events(entity);
CREATE INDEX IF NOT EXISTS idx_v2_as_of  ON v2_events(as_of);
`;

export class AnchorDbCashSink implements CashSink {
  private readonly db: Database;
  private readonly actor: { readonly type: "service"; readonly id: string };

  constructor(dbPath: string, actor?: { readonly type: "service"; readonly id: string }) {
    const parentDir = dirname(dbPath);
    if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(ANCHOR_DDL);
    this.actor = actor ?? SINK_ACTOR;
  }

  private has(evType: string, instanceUrn: string): boolean {
    const rows = this.db
      .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
      .all(evType);
    for (const r of rows) {
      const p = JSON.parse(r.payload) as { instance?: string };
      if (p.instance === instanceUrn) return true;
    }
    return false;
  }

  hasCreated(instanceUrn: string): boolean {
    return this.has("FilInstrumentCreated", instanceUrn);
  }

  hasTerminated(instanceUrn: string): boolean {
    return this.has("FilInstrumentTerminated", instanceUrn);
  }

  hasSettlement(holdingInstanceUrn: string): boolean {
    const rows = this.db
      .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
      .all("TradeSettlementExecuted");
    for (const r of rows) {
      const p = JSON.parse(r.payload) as { holdingInstance?: string };
      if (p.holdingInstance === holdingInstanceUrn) return true;
    }
    return false;
  }

  private insert(
    evType: "FilInstrumentCreated" | "FilInstrumentTerminated" | "TradeSettlementExecuted",
    args: {
      readonly asOf: string;
      readonly entity: string;
      readonly citations: readonly string[];
      readonly payload: Record<string, unknown>;
      readonly eventId?: string;
    },
  ): void {
    // Write path — `Database.run` (statement execute), an INSERT into the anchor
    // store's `v2_events` table. INSERT OR IGNORE keeps it idempotent on event_id.
    this.db.run(
      `INSERT OR IGNORE INTO v2_events
         (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        args.eventId ?? newEventId(),
        evType,
        args.asOf,
        args.entity,
        this.actor.type,
        this.actor.id,
        JSON.stringify([...args.citations]),
        JSON.stringify(args.payload),
      ],
    );
  }

  appendCreated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentCreatedPayload;
    readonly eventId?: string;
  }): void {
    this.insert("FilInstrumentCreated", {
      ...args,
      payload: args.payload as unknown as Record<string, unknown>,
    });
  }

  appendTerminated(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: FilInstrumentTerminatedPayload;
    readonly eventId?: string;
  }): void {
    this.insert("FilInstrumentTerminated", {
      ...args,
      payload: args.payload as unknown as Record<string, unknown>,
    });
  }

  appendSettlement(args: {
    readonly asOf: string;
    readonly entity: string;
    readonly citations: readonly string[];
    readonly payload: TradeSettlementExecutedPayload;
    readonly eventId?: string;
  }): void {
    this.insert("TradeSettlementExecuted", {
      ...args,
      payload: args.payload as unknown as Record<string, unknown>,
    });
  }

  /** Release the anchor-store writer. */
  close(): void {
    this.db.close();
  }
}
