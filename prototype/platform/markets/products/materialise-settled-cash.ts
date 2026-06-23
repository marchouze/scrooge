// platform/markets/products/materialise-settled-cash.ts
//
// LIVE settlement-handler cash materialisation (D-CASH-ASSET-CLASS-V1,
// WS-CASH-ASSET-CLASS — closes Nadia's HIGH finding MV-CASH-001).
//
// THE GAP THIS CLOSES
// -------------------
// Before this module, the only path that emitted the Cash `FilInstrumentCreated`
// for a settled FX leg was the offline `scripts/backfill-fil-instances.ts`. The
// PRODUCTION FX settlement runtime (`settle-matured-trades.ts` /
// `post-trade-lifecycle.ts`) posted the nostro legs (PrincipalPayment ×2 +
// SettlementConfirmed) WITHOUT materialising the Cash instrument-of-record. The
// NPA (`prd:bank:fx:otc-vanilla`, `maturityMaterialisation{bothLegs:true}`)
// already DECLARED the maturity→cash rule; nothing in the live runtime ACTED on
// it. This module is the runtime mouth: at the settlement point, it reads the
// product rule and materialises both settled cash legs as REAL Cash FIL
// instances, each carrying an `originatingInstrument` back-ref to the FX
// instance-of-record (Principle 1 / Principle 2).
//
// WHERE THE EVENTS LAND
// ---------------------
// FIL-instance lifecycle events are anchor-book records that live ONLY in the v2
// anchor store (`BANK_V2_ANCHOR_DB`, see `fil-instances.ts` header), never the
// v1 canonical store. The settlement runtime writes its v1 events (Principal
// Payment / SettlementConfirmed) to the v1 `EventStore`; this module additionally
// writes the Cash `FilInstrumentCreated` to the v2 anchor store. The two are
// renders of one settled cash position — the GL leg (v1) and the Cash
// instrument-of-record (v2) — which `recon:fx-cash-gl-recognition-integrity`
// ties together fail-closed.
//
// FOREIGN-CURRENCY DENOMINATION (MV-CASH-001 part 2)
// --------------------------------------------------
// Each cash leg is denominated in ITS OWN currency (the received foreign leg in
// the foreign ccy; the paid funding leg in the reporting ccy) — NOT collapsed to
// the reporting currency. This makes the materialised population economically
// correct: the foreign-currency leg is the instrument-of-record whose value
// actually moves with the FX rate, so the continuity proof over it is
// non-degenerate.
//
// IDEMPOTENT / REPLAY-SAFE: each cash instance has a deterministic URN
// (`<tradeId>-cash-<side>`); a re-run that finds the URN already present in the
// anchor store appends nothing (Principle 1 — append-only, replay-safe).
//
// BOUNDARY: V1-SIDE platform file — MAY import v2-core (the permitted v1→v2
// direction) and read the product fixture layer. v2-core never reaches back here.
//
// Authority: D-CASH-ASSET-CLASS-V1; prd:bank:fx:otc-vanilla;
//   D-FIL-FRAMEWORK-UNIFICATION; D-V2-CORE-MONEY-DECIMAL-NATIVE (decimal-native
//   MAJOR-unit Money); D-ENGINEERING-INTEGRITY-CHARTER (fail-closed); Principle 1;
//   Principle 2; Principle 5.
// Cites: IFRS 9 §3.2.3 (per-leg derecognition); IAS 21 §28 (settlement-date FX).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import { getBankConfig } from "../../config/loader";

import {
  type SettledCashLeg as SharedSettledCashLeg,
  buildSettledCashPayloads,
  buildTradeSettlementPayloads,
} from "../../../v2-core/fil-instances/cash-materialisation";
import { newEventId } from "../../core/types";
import { AnchorDbCashSink } from "../settlement/cash-sink";
import { resolveMaturityMaterialisation } from "./maturity-materialisation";

// ---------------------------------------------------------------------------
// v2 anchor store resolution — centralized in the platform config loader
// (D-BANK-CONFIG-STORE). `getBankConfig().v2AnchorDb` applies the same
// env → file → default precedence (BANK_V2_ANCHOR_DB → platform.json →
// $HOME/.local/share/bank/v2-anchor.db) as every other store path, so the
// resolution is no longer duplicated here. The export is retained for the
// existing callers (and the test/recon ergonomics) — it now delegates to config.
// ---------------------------------------------------------------------------

export function resolveV2AnchorDb(): string {
  return getBankConfig().v2AnchorDb;
}

const FIL_CITATIONS = [
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "P1-EVENTS-AS-TRUTH",
];
const TRADE_SETTLEMENT_CITATIONS = [
  "D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL",
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "P1-EVENTS-AS-TRUTH",
];

// ---------------------------------------------------------------------------
// The settled cash flows of a settling FX trade. Each becomes a `cash` FIL
// instance at settlement when the governing product (the FX OTC NPA) declares
// the maturity→cash rule. Amounts are MAJOR-unit signed numbers here (+ received,
// − paid); the emitter routes them through the decimal engine — NO float Money.
// ---------------------------------------------------------------------------

// SLICE 0 — the leg shape is now the ONE shared type from the canonical grammar
// (`v2-core/fil-instances/cash-materialisation.ts`); re-exported here so existing
// importers of `materialise-settled-cash`'s `SettledCashLeg` are unchanged.
export type SettledCashLeg = SharedSettledCashLeg;

export interface SettledFxForCashMaterialisation {
  /** The originating FX trade id (the cash-leg URN stem). */
  readonly tradeId: string;
  /** The FX instance-of-record URN the cash legs link back to. */
  readonly fxInstance: string;
  /** The FIL TYPE URN of the settling FX instrument (drives the product rule). */
  readonly fxTypeUrn: string;
  /** Settlement instant (the cash leg's as-of). */
  readonly settledAsOf: string;
  /** Anchor legal entity + tenant for the cash instances. */
  readonly entity: string;
  readonly tenant: string;
  /** Reporting (functional) currency — for the cash hedgingSetTag pair. */
  readonly reporting: string;
  /** Counterparty + netting-set carried from the FX instance. */
  readonly counterpartyId: string;
  readonly nettingSetId: string;
  /** The two settled cash flows (received + paid). */
  readonly cashLegs: readonly SettledCashLeg[];
}

// ---------------------------------------------------------------------------
// v2 anchor store — open + ensure the canonical v2_events table (mirrors the
// seed's DDL, so a fresh store materialises correctly). The writer is opened
// lazily per call so the settlement runtime stays decoupled from store lifetime.
// ---------------------------------------------------------------------------

function openV2Anchor(dbPath: string): Database {
  const parentDir = dirname(dbPath);
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
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
`);
  return db;
}

const ACTOR = { type: "service" as const, id: "agent:settlement:materialise-settled-cash" };

export interface MaterialisationOpts {
  /** Override the v2 anchor store path — used by tests. */
  readonly dbPath?: string;
  /**
   * Whether to emit the born-V2 `TradeSettlementExecuted` settlement-of-record
   * alongside the cash holdings (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2).
   * Defaults to `true` for the LIVE production settlement runtime. The HISTORICAL
   * backfill (`scripts/backfill-fil-instances.ts`) passes `false`: it reconstructs
   * the pre-cutover settled fixture from v1 events, and back-dating a NEW settlement
   * event model onto that history would rewrite the historical record (replay-safe
   * & append-only — the brief forbids rewriting the settled FX fixture; the fold
   * keeps deriving those legs from the historical `FilInstrumentTerminated{settled}`).
   */
  readonly emitSettlementEvents?: boolean;
}

/** Append a FIL lifecycle event to the anchor store, idempotent on instance+type. */
function appendLifecycle(
  db: Database,
  evType: "FilInstrumentCreated" | "FilInstrumentTerminated",
  asOf: string,
  entity: string,
  payload: Record<string, unknown>,
): void {
  // Write path — `Database.run` (a statement execute), NOT `.query` (a SELECT
  // builder): this is an INSERT into the v2 ANCHOR store's `v2_events` table, not
  // a MarketDataStore valuation read, so the market-data provenance filter does
  // not apply here.
  db.run(
    `INSERT OR IGNORE INTO v2_events
       (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newEventId(),
      evType,
      asOf,
      entity,
      ACTOR.type,
      ACTOR.id,
      JSON.stringify([...FIL_CITATIONS]),
      JSON.stringify(payload),
    ],
  );
}

/** Has a lifecycle event of `evType` for this instance URN already been emitted? */
function hasLifecycle(db: Database, evType: string, instanceUrn: string): boolean {
  const rows = db
    .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
    .all(evType);
  for (const r of rows) {
    const p = JSON.parse(r.payload) as { instance?: string };
    if (p.instance === instanceUrn) return true;
  }
  return false;
}

/**
 * Materialise an FX instrument-of-record (FilInstrumentCreated + optional
 * FilInstrumentTerminated) into the v2 anchor store. Used by the backfill so the
 * anchor store the recon gates read carries the SETTLED FX instances whose cash
 * legs `materialiseSettledCash` produces — making the on-anchor HISTORY proof
 * non-vacuous. Idempotent on instance URN. Returns { created, terminated } counts.
 */
export function materialiseFxInstanceToAnchor(
  args: {
    readonly fxInstance: string;
    readonly fxTypeUrn: string;
    readonly entity: string;
    readonly tenant: string;
    readonly createdAsOf: string;
    readonly economicTerms: Record<string, unknown>;
    readonly originatingEvent: { eventType: string; eventId: string };
    readonly terminal?: { stage: "settled" | "matured" | "cancelled"; asOf: string };
  },
  opts: MaterialisationOpts = {},
): { created: number; terminated: number } {
  const dbPath = opts.dbPath ?? resolveV2AnchorDb();
  const db = openV2Anchor(dbPath);
  let created = 0;
  let terminated = 0;
  try {
    if (!hasLifecycle(db, "FilInstrumentCreated", args.fxInstance)) {
      appendLifecycle(db, "FilInstrumentCreated", args.createdAsOf, args.entity, {
        kind: "FilInstrumentCreated",
        instance: args.fxInstance,
        type: args.fxTypeUrn,
        tenant: args.tenant,
        asOf: args.createdAsOf,
        originatingEvent: args.originatingEvent,
        initialStage: "active",
        economicTerms: args.economicTerms,
      });
      created += 1;
    }
    if (args.terminal && !hasLifecycle(db, "FilInstrumentTerminated", args.fxInstance)) {
      appendLifecycle(db, "FilInstrumentTerminated", args.terminal.asOf, args.entity, {
        kind: "FilInstrumentTerminated",
        instance: args.fxInstance,
        type: args.fxTypeUrn,
        tenant: args.tenant,
        asOf: args.terminal.asOf,
        originatingEvent: args.originatingEvent,
        terminalStage: args.terminal.stage,
      });
      terminated += 1;
    }
  } finally {
    db.close();
  }
  return { created, terminated };
}

/**
 * Materialise the settled cash leg(s) of a settling FX trade as REAL Cash FIL
 * `FilInstrumentCreated` events in the v2 anchor store. PRODUCT-DRIVEN: emits
 * ONLY when the governing product (resolved from the FX FIL type URN — the FX OTC
 * NPA) declares `maturityMaterialisation{ materialisesAssetClass:"cash",
 * onLifecycleStage:"settled" }`. The `bothLegs` flag selects whether the paid
 * (funding) leg is materialised too. Idempotent on the deterministic cash-leg URN.
 *
 * Returns the number of NEW cash instances materialised (0 if the product
 * declares no cash rule, or all legs already present).
 */
export function materialiseSettledCash(
  fx: SettledFxForCashMaterialisation,
  opts: MaterialisationOpts = {},
): number {
  // PRODUCT DECISION — read the maturity→cash rule off the governing product.
  const rule = resolveMaturityMaterialisation(fx.fxTypeUrn);
  if (!rule || rule.materialisesAssetClass !== "cash") return 0;
  if (rule.onLifecycleStage !== "settled") return 0;
  if (fx.cashLegs.length === 0) return 0;

  const legs = rule.bothLegs ? fx.cashLegs : fx.cashLegs.filter((l) => l.side === "received");
  if (legs.length === 0) return 0;

  // SLICE 0 — build the cash payloads through the ONE shared store-agnostic
  // grammar (`v2-core/fil-instances/cash-materialisation.ts`), then route them to
  // the anchor-store sink. The scenario path routes the SAME payloads to an
  // EventStoreCashSink — one grammar, one sink, parameterised by store.
  const materialisationInput = {
    tradeId: fx.tradeId,
    tenant: fx.tenant,
    reporting: fx.reporting,
    counterpartyId: fx.counterpartyId,
    nettingSetId: fx.nettingSetId,
    settledAsOf: fx.settledAsOf,
    fxInstance: fx.fxInstance,
    legs,
    // The driving event is the FX settlement; the originating INSTRUMENT is the
    // FX instance (carried in economicTerms.originatingInstrument for the graph).
    originatingEvent: { eventType: "SettlementConfirmed", eventId: fx.fxInstance },
    cashTypeUrn: rule.materialisesTypeUrn,
  };
  const built = buildSettledCashPayloads(materialisationInput);

  const dbPath = opts.dbPath ?? resolveV2AnchorDb();
  const emitSettlements = opts.emitSettlementEvents ?? true;
  const sink = new AnchorDbCashSink(dbPath);
  let emitted = 0;
  try {
    // Slice 2 (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL): emit the born-V2 single-asset
    // `TradeSettlementExecuted` settlement-of-record (one per settled leg) FIRST,
    // then the holding-at-cost cash create — both from ONE grammar, idempotent on
    // the holding URN. The settlement event is the explicit recorded fact
    // (Principle 1); the GL fold derives its legs from it (dual-read with the
    // historical FilFxSettlementConfirmed). The historical backfill opts out
    // (`emitSettlementEvents:false`) so the pre-cutover fixture stays byte-stable.
    if (emitSettlements) {
      for (const settle of buildTradeSettlementPayloads(materialisationInput)) {
        if (sink.hasSettlement(settle.instance)) continue;
        sink.appendSettlement({
          asOf: fx.settledAsOf,
          entity: fx.entity,
          citations: TRADE_SETTLEMENT_CITATIONS,
          payload: settle.payload,
        });
      }
    }
    for (const leg of built) {
      if (sink.hasCreated(leg.instance)) continue;
      sink.appendCreated({
        asOf: fx.settledAsOf,
        entity: fx.entity,
        citations: FIL_CITATIONS,
        payload: leg.payload,
      });
      emitted += 1;
    }
  } finally {
    sink.close();
  }
  return emitted;
}
