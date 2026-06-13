// scripts/seed-v2-fil-instances-ir-fx.ts
//
// WS-V2-BBAAS — materialise the anchor bank's IR + FX book as NATIVE FIL
// INSTANCES. Reads the v1 IR-swap + FX-trade events (READ-ONLY) from the v1
// canonical store and emits the FIL instance lifecycle family
// (`FilInstrumentCreated` / `FilInstrumentTerminated`) into the SEPARATE v2
// anchor store (`BANK_V2_ANCHOR_DB`, the same store S4 uses). It NEVER writes
// to the v1 canonical store.
//
// One v1 trade → one `fil:inst:<tenant>:<tradeId>` carrying its
// `fil:type:ir:*` / `fil:type:fx:*` taxonomy type and its REAL lifecycle:
//   executed                          → FilInstrumentCreated{ initialStage:active }
//   settled / matured / cancelled     → FilInstrumentTerminated{ terminalStage }
// with the lifecycle-event `asOf` set to the v1 opening / terminal event's
// `as_of`, so an as-of fold reconstructs the historical live set (the SA-CCR
// parity proof replays at a recorded as_of).
//
// Economic terms are extracted to MIRROR the v1 SA-CCR adapter
// (`platform/risk/sa-ccr/positions-to-summaries.ts`) EXACTLY for FX (ZAR leg
// selection, direction, hedging-set tag, settlement date) so the FIL-instance-
// sourced SA-CCR re-proof is byte-clean.
//
// Idempotent: a `FilInstrumentCreated` / `FilInstrumentTerminated` already
// present for an instance URN is skipped.
//
// BOUNDARY: this is a SCRIPT (NOT under v2-core), so it MAY read v1
// (`recon:v2-no-v1-import` constrains only files under `v2-core/`). It imports
// the v2-core FIL grammar for the URNs + schemas (the permitted v1→v2 direction).
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION; D-MODEL-BINDING-CONTRACT-V1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; Principle 1; Principle 5.
// brief: brief:atlas:v2-fil-instance-materialisation-ir-fx-native-fil:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

import { formatInstanceUrn, formatTypeUrn } from "../v2-core/fil-core/urn";
import {
  type FilEconomicTerms,
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../v2-core/fil-instances/events";

// ---------------------------------------------------------------------------
// Store resolution — v1 (read-only source) and v2 anchor (write target).
// ---------------------------------------------------------------------------

function resolveV1Db(): string {
  const fromEnv = process.env.BANK_EVENT_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromHome = process.env.BANK_HOME_EVENT_DB;
  if (fromHome && fromHome.length > 0) return fromHome;
  const homeDefault = resolve(homedir(), ".local", "share", "bank", "event.db");
  if (existsSync(homeDefault)) return homeDefault;
  return resolve(import.meta.dir, "..", ".local", "event.db");
}

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

const V1_DB_PATH = resolveV1Db();
const V2_DB_PATH = resolveV2AnchorDb();
const TENANT = "LE-ZA-HOZ-BANK";
const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service", id: "agent:atlas:seed-v2-fil-instances-ir-fx" };
const CITATIONS = [
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
];

// FIL type URNs (align with the S4 product filTypeScopes).
const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const FX_FORWARD_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "forward",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const IR_SWAP_TYPE_URN = formatTypeUrn({
  assetClass: "ir",
  familyPath: "swap.vanilla",
  typeSlug: "vanilla-irs-zar",
  version: { major: 1, minor: 0 },
});

// ---------------------------------------------------------------------------
// v1 store readers (raw SQLite — read-only; the script never imports the v1
// composition store to keep the dependency surface minimal and read-only).
// ---------------------------------------------------------------------------

if (!existsSync(V1_DB_PATH)) {
  console.error(`[seed-v2-fil-instances] v1 store not found at ${V1_DB_PATH}; nothing to read.`);
  process.exit(1);
}

const v1 = new Database(V1_DB_PATH, { readonly: true });

interface V1Row {
  event_id: string;
  type: string;
  as_of: string;
  payload: string;
}

function replayV1(type: string): V1Row[] {
  return v1
    .query<V1Row, [string]>(
      "SELECT event_id, type, as_of, payload FROM events WHERE type = ? ORDER BY sequence ASC",
    )
    .all(type);
}

// ---------------------------------------------------------------------------
// v2 anchor store — same DDL as S4.
// ---------------------------------------------------------------------------

const parentDir = dirname(V2_DB_PATH);
if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
const v2 = new Database(V2_DB_PATH);
v2.exec(`
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

/** Has a lifecycle event of `type` already been emitted for this instance URN? */
function alreadyEmitted(type: string, instanceUrn: string): boolean {
  const rows = v2
    .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
    .all(type);
  for (const r of rows) {
    try {
      const p = JSON.parse(r.payload) as { instance?: string };
      if (p.instance === instanceUrn) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function append(type: string, asOf: string, payload: Record<string, unknown>): void {
  v2.query(
    `INSERT OR IGNORE INTO v2_events
       (event_id, type, as_of, entity, actor_type, actor_id, citations, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    type,
    asOf,
    ENTITY,
    ACTOR.type,
    ACTOR.id,
    JSON.stringify(CITATIONS),
    JSON.stringify(payload),
  );
}

// ---------------------------------------------------------------------------
// Lifecycle-state resolution. We resolve terminal state per tradeId by scanning
// the relevant closure event types. Mirrors `resolveTradeLifecycle` semantics
// without importing the v1 lifecycle module (read-only, payload-shape driven).
// ---------------------------------------------------------------------------

type TerminalStage = "settled" | "matured" | "cancelled" | "terminated";

interface TerminalInfo {
  readonly stage: TerminalStage;
  readonly asOf: string;
}

/** Normalise an ISO date (`YYYY-MM-DD`) to an instant for the lifecycle asOf. */
function toInstant(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T00:00:00.000Z`;
  return iso;
}

function tradeIdOf(p: Record<string, unknown>): string | undefined {
  const t = p.tradeId;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && typeof (t as { value?: unknown }).value === "string") {
    return (t as { value: string }).value;
  }
  return undefined;
}

/** Map FX terminal events → terminal stage + asOf, keyed by tradeId. */
function buildFxTerminals(): Map<string, TerminalInfo> {
  const out = new Map<string, TerminalInfo>();
  const settle = (type: string, stage: TerminalStage) => {
    for (const r of replayV1(type)) {
      const p = JSON.parse(r.payload) as Record<string, unknown>;
      const id = tradeIdOf(p);
      if (!id) continue;
      // terminal-wins: latest terminal supersedes (store order ASC ⇒ last write wins)
      out.set(id, { stage, asOf: toInstant(r.as_of) });
    }
  };
  settle("SettlementConfirmed", "settled");
  settle("TradeMatured", "matured");
  settle("FxTradeCancelled", "cancelled");
  return out;
}

/** Map IR-swap terminal events → terminal stage + asOf, keyed by tradeId. */
function buildIrTerminals(): Map<string, TerminalInfo> {
  const out = new Map<string, TerminalInfo>();
  for (const r of replayV1("IrdSwapTerminated")) {
    const p = JSON.parse(r.payload) as Record<string, unknown>;
    const id = tradeIdOf(p);
    if (!id) continue;
    out.set(id, { stage: "terminated", asOf: toInstant(r.as_of) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// FX materialisation.
//
// Economic-terms extraction mirrors `buildFxSaCcrTradeSummaries`:
//   - ZAR notional = the leg side denominated in ZAR (near leg / first leg);
//   - direction    = side==="sell" ? "short" : "long";
//   - hedgingSetTag= `${base}/${quote}`;
//   - settlementDate = near.settlementDate.iso (the static maturity anchor;
//     remaining-years is derived at-as-of by the projection, not stored).
// Trades with no ZAR leg (cross pairs) are skipped — they form no ZAR netting
// set in v1 either, so this preserves parity.
// ---------------------------------------------------------------------------

interface NearLeg {
  legKind?: string;
  notional?: { currency?: string; amountMinor?: number };
  counterNotional?: { currency?: string; amountMinor?: number };
  settlementDate?: { iso?: string };
}

function materialiseFx(): { created: number; terminated: number; skipped: number } {
  const terminals = buildFxTerminals();
  let created = 0;
  let terminated = 0;
  let skipped = 0;

  for (const r of replayV1("FxTradeExecuted")) {
    const p = JSON.parse(r.payload) as Record<string, unknown>;
    const tradeId = tradeIdOf(p);
    if (!tradeId) {
      skipped += 1;
      continue;
    }

    const counterparty = p.counterparty as { partyId?: string } | undefined;
    const counterpartyId = counterparty?.partyId;
    if (!counterpartyId) {
      skipped += 1;
      continue;
    }

    const legs = (p.legs as NearLeg[] | undefined) ?? [];
    const near = legs.find((l) => l.legKind === "near") ?? legs[0];
    if (!near || !near.notional || !near.counterNotional) {
      skipped += 1;
      continue;
    }

    // ZAR leg selection (mirror the v1 adapter).
    let zarMinor: number | null = null;
    if (near.notional.currency === "ZAR") zarMinor = near.notional.amountMinor ?? null;
    else if (near.counterNotional.currency === "ZAR")
      zarMinor = near.counterNotional.amountMinor ?? null;
    if (zarMinor === null || zarMinor === 0) {
      skipped += 1; // cross pair (no ZAR leg) — no ZAR netting set forms
      continue;
    }

    const pair = p.currencyPair as { base?: string; quote?: string } | undefined;
    const base = pair?.base ?? "";
    const quote = pair?.quote ?? "";
    const side = p.side as string | undefined;
    const taxonomy = String(p.productTaxonomy ?? "FX-spot");
    const typeUrn = taxonomy.toLowerCase().includes("forward")
      ? FX_FORWARD_TYPE_URN
      : FX_SPOT_TYPE_URN;

    const instance = formatInstanceUrn({ tenant: TENANT, instanceId: tradeId });

    const economicTerms: FilEconomicTerms = {
      assetClass: "fx",
      notional: { currency: "ZAR", minorUnits: BigInt(Math.abs(zarMinor)) },
      direction: side === "sell" ? "short" : "long",
      counterpartyId,
      nettingSetId: `NS-${counterpartyId}-ZAR`,
      currency: "ZAR",
      settlementDate: near.settlementDate?.iso ?? r.as_of,
      ...(base && quote ? { hedgingSetTag: `${base}/${quote}` } : {}),
    };

    // FilInstrumentCreated — at the trade-execution as_of.
    if (!alreadyEmitted("FilInstrumentCreated", instance)) {
      const payload = filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance,
        type: typeUrn,
        tenant: TENANT,
        asOf: r.as_of,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: r.event_id },
        initialStage: "active",
        economicTerms,
      });
      append("FilInstrumentCreated", r.as_of, serialise(payload));
      created += 1;
    }

    // FilInstrumentTerminated — at the terminal as_of (if closed).
    const term = terminals.get(tradeId);
    if (term && !alreadyEmitted("FilInstrumentTerminated", instance)) {
      const payload = filInstrumentTerminatedPayloadSchema.parse({
        kind: "FilInstrumentTerminated",
        instance,
        type: typeUrn,
        tenant: TENANT,
        asOf: term.asOf,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: r.event_id },
        terminalStage: term.stage,
      });
      append("FilInstrumentTerminated", term.asOf, serialise(payload));
      terminated += 1;
    }
  }

  return { created, terminated, skipped };
}

// ---------------------------------------------------------------------------
// IR-swap materialisation. IRS notional/currency/maturity come from the
// IrdSwapTradeExecuted payload. SA-CCR netting-set convention mirrors FX
// (`NS-<counterpartyId>-<ccy>`). Direction: receive-fixed ⇒ long, pay-fixed ⇒
// short (the supervisory-delta sign convention for the fixed leg).
// ---------------------------------------------------------------------------

function materialiseIr(): { created: number; terminated: number; skipped: number } {
  const terminals = buildIrTerminals();
  let created = 0;
  let terminated = 0;
  let skipped = 0;

  for (const r of replayV1("IrdSwapTradeExecuted")) {
    const p = JSON.parse(r.payload) as Record<string, unknown>;
    const tradeId = tradeIdOf(p);
    if (!tradeId) {
      skipped += 1;
      continue;
    }
    const counterpartyId = String(p.counterpartyLei ?? "");
    const currency = String(p.currency ?? "ZAR");
    const notionalMinor = Number(p.notionalMinor ?? 0);
    if (!counterpartyId || notionalMinor === 0) {
      skipped += 1;
      continue;
    }
    const role = String(p.role ?? "receive-fixed");
    const instance = formatInstanceUrn({ tenant: TENANT, instanceId: tradeId });

    const economicTerms: FilEconomicTerms = {
      assetClass: "ir",
      notional: { currency, minorUnits: BigInt(Math.abs(notionalMinor)) },
      direction: role.includes("pay-fixed") ? "short" : "long",
      counterpartyId,
      nettingSetId: `NS-${counterpartyId}-${currency}`,
      currency,
      settlementDate: String(p.maturityDate ?? r.as_of),
      hedgingSetTag: currency,
    };

    if (!alreadyEmitted("FilInstrumentCreated", instance)) {
      const payload = filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance,
        type: IR_SWAP_TYPE_URN,
        tenant: TENANT,
        asOf: r.as_of,
        originatingEvent: { eventType: "IrdSwapTradeExecuted", eventId: r.event_id },
        initialStage: "active",
        economicTerms,
      });
      append("FilInstrumentCreated", r.as_of, serialise(payload));
      created += 1;
    }

    const term = terminals.get(tradeId);
    if (term && !alreadyEmitted("FilInstrumentTerminated", instance)) {
      const payload = filInstrumentTerminatedPayloadSchema.parse({
        kind: "FilInstrumentTerminated",
        instance,
        type: IR_SWAP_TYPE_URN,
        tenant: TENANT,
        asOf: term.asOf,
        originatingEvent: { eventType: "IrdSwapTradeExecuted", eventId: r.event_id },
        terminalStage: term.stage,
      });
      append("FilInstrumentTerminated", term.asOf, serialise(payload));
      terminated += 1;
    }
  }

  return { created, terminated, skipped };
}

// ---------------------------------------------------------------------------
// JSON serialisation — bigint Money.minorUnits → number (the v2 anchor store
// holds JSON; the FIL instance projection re-reads minorUnits as bigint). The
// stored JSON mirrors the v1 minor-unit integers exactly.
// ---------------------------------------------------------------------------

function serialise(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? Number(v) : v)),
  ) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

console.log("\n=== V2 FIL-instance materialisation (IR + FX) ===");
console.log(`v1 source store : ${V1_DB_PATH} (read-only)`);
console.log(`v2 anchor store : ${V2_DB_PATH} (write target)\n`);

const fx = materialiseFx();
const ir = materialiseIr();

v1.close();

const totalInstances =
  v2
    .query<{ c: number }, [string]>("SELECT COUNT(*) c FROM v2_events WHERE type = ?")
    .get("FilInstrumentCreated")?.c ?? 0;

console.log("FX :", `${fx.created} created, ${fx.terminated} terminated, ${fx.skipped} skipped`);
console.log("IR :", `${ir.created} created, ${ir.terminated} terminated, ${ir.skipped} skipped`);
console.log(`\nTotal FIL instances in v2 anchor store: ${totalInstances}`);
console.log(`  FX type: ${FX_SPOT_TYPE_URN} / ${FX_FORWARD_TYPE_URN}`);
console.log(`  IR type: ${IR_SWAP_TYPE_URN}`);
console.log("=== Materialisation complete ===\n");

v2.close();
