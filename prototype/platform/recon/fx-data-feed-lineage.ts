// platform/recon/fx-data-feed-lineage.ts
//
// recon:fx-data-feed-lineage — FX C8 data-quality lineage audit. BLOCKING.
//
// THE AUDIT (the FX OTC Vanilla NPA's tracked gap `fx-data-feed-lineage-audit`):
// the FX product is valued + settled off two data feeds, and the data-quality
// dimension may only become a green, non-vacuous basis once each feed carries
// provenance / lineage metadata traceable to source. This gate asserts exactly
// that, end-to-end, and FAILS CLOSED when lineage is missing.
//
//   FEED 1 — the per-instrument FX RATE FEED (`market_data_ticks`, the separate
//   MarketDataStore). Every `fx-quote` tick that the FX valuation path consumes
//   MUST carry:
//     - a non-empty `source` (the lineage-to-source axis — which provider / feed
//       the rate came from, e.g. `twelve-data`, `open-er-api`, `ws-v2-s1-fixture`).
//       A blank source is unverifiable lineage → FAIL.
//     - a recognised `provenance` value (`production` | `simulated`). A tick with
//       an unrecognised provenance is a schema breach → FAIL.
//   This population is NON-EMPTY on any real store (the FX rate feed ingests
//   continuously), so the rate-feed audit is non-vacuous: it asserts real lineage
//   over real ticks. Where a source is a SIMULATED / synthetic build-phase feed,
//   the gate does NOT pretend it is a live provider — it surfaces that explicitly
//   as a typed `info` tracked residual (honesty: command 3 + command 5), never
//   green-by-omission.
//
//   FEED 2 — the SETTLEMENT-CONFIRMATION lineage (`FilFxSettlementConfirmed`
//   events in the main event store). Every such event MUST carry:
//     - `originatingEvent.eventId` + `originatingEvent.eventType` (the lineage
//       BACK to the canonical v1 trade event of record this settlement renders —
//       Principle 1). A missing/blank originating-event ref is a broken lineage
//       chain → FAIL.
//     - a non-empty `provenance.sourceLineage` on the envelope (the originating-
//       system axis). Blank → FAIL.
//   HONEST RESIDUAL (the build-phase reality, surfaced not hidden): no production
//   seed emits `FilFxSettlementConfirmed` yet — the FX book is materialised as
//   FIL instances (Created/Terminated) but the per-leg settlement-confirmation
//   event family is wired (schema + fold + posting rules) and NOT yet populated.
//   So on the current build-phase store this sub-population is genuinely empty.
//   The gate does NOT silently green that: it emits an explicit `info` tracked-
//   residual violation naming the gap, and the RULE is fail-closed — the instant
//   one settlement-confirmation event lands without lineage, this gate FAILS.
//   The non-vacuity of THIS rule is proven by the regression test (a populated
//   store with a lineage-less settlement event makes the gate fail), not by the
//   build-phase store.
//
// NON-VACUITY (command 2): the gate asserts genuine lineage over the real
// rate-feed population (non-empty), and the settlement-confirmation rule is
// proven to FAIL on a populated store missing lineage by
// `tests/fx-data-feed-lineage.test.ts`. An empty store (no ticks, no settlement
// events) is the only trivially-passing case — and even then the settlement
// tracked-residual `info` fires so the operator knows the audit is awaiting data.
//
// READ-ONLY: this gate reads the market-data store + the event store; it touches
// no production number and emits no events.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (CEO-approved 2026-06-19);
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; D-NPA-POST-APPROVAL-FINDING-REVIEW;
//   D-MARKETS-SCHEMA-FOUNDATION; D-DATA-PROVENANCE-SUBSTRATE; Principle 1; Principle 2.
// Author: Anya (Data & analytics engineer, engineering).

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-data-feed-lineage";

// The FX valuation path reads `fx-quote` ticks (mid/bid/ask) — that is the rate
// feed whose lineage this gate audits. Other data types (bond-price, jibar, …)
// are out of the FX-product scope.
const FX_RATE_DATA_TYPE = "fx-quote";

// The settlement-confirmation event family for the FX product. ONE event type
// with a leg discriminator (spot / swap-near / swap-far).
const FX_SETTLEMENT_EVENT_TYPE = "FilFxSettlementConfirmed";

// Recognised provenance values for a rate-feed tick (the MarketDataStore column
// is `"production" | "simulated"`). Anything else is a schema breach.
const RECOGNISED_TICK_PROVENANCE: ReadonlySet<string> = new Set(["production", "simulated"]);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  /** Override the event-store path (main store; carries FilFxSettlementConfirmed). */
  eventDbPath?: string;
  /** Override the market-data store path (carries the fx-quote rate feed). */
  marketDataDbPath?: string;
}

// ---------------------------------------------------------------------------
// Rate-feed read — a thin readonly view over `market_data_ticks`. We read the
// raw rows directly (not via MarketDataStore.query) because the audit needs the
// ALL-provenance population including any blank-source rows the safe-default
// `production` filter would hide.
// ---------------------------------------------------------------------------

interface RateTickRow {
  id: string;
  source: string | null;
  instrument: string | null;
  provenance: string | null;
}

function readFxRateTicks(dbPath: string): RateTickRow[] {
  if (!existsSync(dbPath)) return [];
  let db: Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return [];
  }
  try {
    const tableExists = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='market_data_ticks'`,
      )
      .all();
    if (tableExists.length === 0) return [];
    return db
      .query<RateTickRow, [string]>(
        `SELECT id, source, instrument, provenance
           FROM market_data_ticks
          WHERE data_type = ?`,
      )
      .all(FX_RATE_DATA_TYPE);
  } finally {
    db.close();
  }
}

interface RunInputs {
  rateTicks: RateTickRow[];
  settlementEvents: Array<{ eventId: string; payload: Record<string, unknown>; provenance: unknown }>;
}

function readInputs(opts: RunOpts): RunInputs {
  const repoRoot = findRepoRoot(import.meta.dir);
  const eventDbPath =
    opts.eventDbPath ??
    process.env.BANK_EVENT_DB ??
    resolve(repoRoot, "prototype/.local/event.db");
  const marketDataDbPath =
    opts.marketDataDbPath ??
    process.env.BANK_MARKET_DATA_DB ??
    resolve(repoRoot, "prototype/.local/market-data.db");

  const rateTicks = readFxRateTicks(marketDataDbPath);

  const settlementEvents: RunInputs["settlementEvents"] = [];
  if (existsSync(eventDbPath)) {
    const store = new EventStore(eventDbPath, { readonly: true });
    try {
      for (const ev of store.replay({ type: FX_SETTLEMENT_EVENT_TYPE })) {
        settlementEvents.push({
          eventId: ev.event_id,
          payload: ev.payload as Record<string, unknown>,
          provenance: ev.provenance,
        });
      }
    } finally {
      store.close();
    }
  }

  return { rateTicks, settlementEvents };
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const inputs = readInputs(opts);

  // -------------------------------------------------------------------------
  // FEED 1 — FX rate feed lineage. Every fx-quote tick must carry a non-empty
  // `source` (lineage-to-source) + a recognised provenance value.
  // -------------------------------------------------------------------------
  const simulatedSources = new Map<string, number>();
  let productionTicks = 0;
  for (const tick of inputs.rateTicks) {
    result.asserted += 1;
    const source = (tick.source ?? "").trim();
    const provenance = (tick.provenance ?? "").trim();

    if (source.length === 0) {
      violations.push({
        subject: `rate-feed:tick:${tick.id}`,
        message: `FX rate-feed tick (${tick.instrument ?? "?"}) carries NO source — lineage-to-source is unverifiable. Every fx-quote tick must record the provider / feed it came from (the MarketDataStore.source axis).`,
        severity: "fail",
      });
      continue;
    }
    if (!RECOGNISED_TICK_PROVENANCE.has(provenance)) {
      violations.push({
        subject: `rate-feed:tick:${tick.id}`,
        message: `FX rate-feed tick from source "${source}" carries an unrecognised provenance "${provenance || "(empty)"}" — expected one of ${[...RECOGNISED_TICK_PROVENANCE].join(" | ")}.`,
        severity: "fail",
      });
      continue;
    }
    if (provenance === "simulated") {
      simulatedSources.set(source, (simulatedSources.get(source) ?? 0) + 1);
    } else {
      productionTicks += 1;
    }
  }

  // Honest residual (command 5): simulated / synthetic build-phase feeds carry a
  // real `source` (so lineage IS traceable) but are NOT a live provider. Surface
  // them explicitly as a typed tracked residual rather than letting them pass as
  // if they were production-grade lineage.
  for (const [source, count] of simulatedSources.entries()) {
    violations.push({
      subject: `rate-feed:simulated-source:${source}`,
      message: `${count} fx-quote tick(s) from a SIMULATED rate source "${source}" — lineage is traceable to this synthetic feed, but it is a build-phase / sim provider, not a live market-data vendor. Tracked residual until the live FX feed is connected (licence-day); valuation reads default to production-only so these never reach a live valuation.`,
      severity: "info",
    });
  }

  // -------------------------------------------------------------------------
  // FEED 2 — settlement-confirmation lineage. Every FilFxSettlementConfirmed
  // event must carry originatingEvent (lineage back to the v1 trade event of
  // record) + a non-empty envelope provenance.sourceLineage.
  // -------------------------------------------------------------------------
  let settlementChecked = 0;
  for (const ev of inputs.settlementEvents) {
    settlementChecked += 1;
    result.asserted += 1;

    const orig = ev.payload.originatingEvent as Record<string, unknown> | undefined;
    const origEventId = orig && typeof orig.eventId === "string" ? orig.eventId.trim() : "";
    const origEventType = orig && typeof orig.eventType === "string" ? orig.eventType.trim() : "";

    if (origEventId.length === 0 || origEventType.length === 0) {
      violations.push({
        subject: `settlement:${ev.eventId}`,
        message: `FilFxSettlementConfirmed event has NO originating-event lineage (eventType="${origEventType || "(empty)"}", eventId="${origEventId || "(empty)"}") — the settlement-confirmation cannot be traced back to the canonical v1 trade event of record (Principle 1). Lineage chain broken.`,
        severity: "fail",
      });
      continue;
    }

    const tag = ev.provenance as Record<string, unknown> | undefined | null;
    const sourceLineage = tag && typeof tag.sourceLineage === "string" ? tag.sourceLineage.trim() : "";
    if (sourceLineage.length === 0) {
      violations.push({
        subject: `settlement:${ev.eventId}`,
        message: `FilFxSettlementConfirmed event carries an empty envelope provenance.sourceLineage — the originating-system axis is unverifiable. Every event must trace to its originating system (D-DATA-PROVENANCE-SUBSTRATE).`,
        severity: "fail",
      });
    }
  }

  // Honest residual (command 5): in the build phase no production seed emits
  // settlement-confirmation events yet (the FX book materialises as FIL
  // instances; the per-leg settlement family is wired + fold-ready but not
  // populated). Surface that explicitly — the RULE above is fail-closed, so the
  // moment a lineage-less settlement event lands, this gate FAILS (proven by the
  // regression test). We do NOT silently green an empty settlement population.
  if (settlementChecked === 0) {
    violations.push({
      subject: "settlement:tracked-residual",
      message:
        "No FilFxSettlementConfirmed events present — the FX settlement-confirmation lineage rule is wired and fail-closed but exercises ZERO events in the build phase (no production seed emits this family yet; the FX book is materialised as FIL instances). Tracked residual: the lineage assertion is live and will FAIL on the first lineage-less settlement event (regression-tested). Awaiting settlement-event population (licence-day FX settlement flow).",
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-data-feed-lineage: ${inputs.rateTicks.length} fx-quote tick(s) (${productionTicks} production, ${[...simulatedSources.values()].reduce((a, b) => a + b, 0)} simulated) + ${settlementChecked} settlement-confirmation event(s) audited for lineage-to-source.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  const fails = r.violations.filter((v) => v.severity === "fail");
  const infos = r.violations.filter((v) => v.severity === "info");
  for (const v of fails) {
    process.stderr.write(`  FAIL  [${v.subject}] ${v.message}\n`);
  }
  for (const v of infos) {
    process.stdout.write(`  info  [${v.subject}] ${v.message}\n`);
  }
  if (r.ok) {
    process.stdout.write(`recon:${PIPELINE} OK — ${r.asOf}\n`);
    process.exit(0);
  }
  process.stderr.write(`\nrecon:${PIPELINE} FAILED — ${fails.length} violation(s)\n`);
  process.exit(1);
}
