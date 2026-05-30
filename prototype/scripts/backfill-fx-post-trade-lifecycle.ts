// scripts/backfill-fx-post-trade-lifecycle.ts
//
// Idempotent backfill — emit FxSettlementInstructed (×2 legs) and
// SettlementConfirmed for every non-cancelled FxTradeExecuted that has no
// FxSettlementInstructed in the event store.
//
// ─── WHY THIS GAP EXISTS ──────────────────────────────────────────────────────
//
// Live trades fired through `EnvSimEngine.fireTrade()` call
// `runPostTradeLifecycle()` synchronously and produce the full lifecycle chain.
// Seed and fixture trades were written by scripts that called
// `store.append(makeFxTradeExecuted(...))` directly — bypassing the runtime
// bus and therefore bypassing `runPostTradeLifecycle`. As a result, the event
// store had 685 FxTradeExecuted but only 260 FxSettlementInstructed and 170
// SettlementConfirmed at the time this backfill was authored (2026-05-30).
//
// ─── APPROACH ────────────────────────────────────────────────────────────────
//
// Deterministic idempotent backfill:
//
//   1. Replay all FxTradeExecuted, FxTradeCancelled, FxSettlementInstructed,
//      SettlementConfirmed events in one pass.
//   2. For every executed, non-cancelled trade with no FxSettlementInstructed,
//      emit two FxSettlementInstructed events (pay-leg + receive-leg).
//   3. For every trade that has both instructions but no SettlementConfirmed
//      AND whose settlementDate ≤ today, emit SettlementConfirmed.
//      (Future-dated trades are instructed but deferred to settle-matured-trades.)
//
// Settlement dates come from the trade's own `legs[0].settlementDate.iso` —
// never synthesised.
//
// Provenance: lifecycle events inherit the provenance kind of the originating
// FxTradeExecuted (build-phase-fixture or simulated) with
// sourceLineage "backfill:fx-post-trade-lifecycle". Production events are
// NEVER emitted here — all uninstructed trades in the store are build-phase-
// fixture or simulated.
//
// ─── AUTHORITY ────────────────────────────────────────────────────────────────
//
//   D-FX-CLS-MEMBERSHIP        — default settlement path is correspondent
//   D-MARKETS-SCHEMA-FOUNDATION — CDM FX event shapes
//   D-FX-AD-STATUS             — FinSurv reporting context
//   Principle 1                — events are the only source of truth
//   Principle 6                — autonomous by default
//
// Author: Atlas (Core banking platform architect, engineering)

// Run with: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/backfill-fx-post-trade-lifecycle.ts
// The BANK_EVENT_DB env var must be set before this script runs so the
// composition root resolves to the shared event store (not the per-worktree
// fallback). All emission scripts in this codebase follow the same pattern —
// see feedback_event_store_wrong_path.md.

import { newEventId, nowUtc } from "../platform/core/types";
import { eventStore } from "../platform/composition";
import { buildPhaseFixtureTag, simulatedTag, type ProvenanceTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import type { OfficialMarkAdoptedPayload } from "../platform/event-store/event-types/valuation";
import {
  makeFxSettlementInstructed,
  makeSettlementConfirmed,
  type FxTradeExecutedPayload,
} from "../platform/markets/cdm/fx";
import { baseAmountMinor } from "../platform/markets/cdm/fx-helpers";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:atlas:backfill-fx-post-trade-lifecycle" };
const CITATIONS = [
  "D-FX-CLS-MEMBERSHIP",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "D-FX-AD-STATUS",
] as const;

const SIM_CORRESPONDENT = {
  partyId: "CORRESPONDENT-BANK-001",
  name: "SimulatedCorrespondent Bank",
  role: "settlement-agent" as const,
  jurisdiction: "ZA",
};

const BACKFILL_SOURCE_LINEAGE = "backfill:fx-post-trade-lifecycle";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeRecord {
  tradeId: string;
  payload: FxTradeExecutedPayload;
  prov: ProvenanceTag;
}

interface InstructedRecord {
  payLeg: boolean;
  receiveLeg: boolean;
  settlementDate: string;
  payCurrency: string;
  receiveCurrency: string;
}

// ---------------------------------------------------------------------------
// Helper — attach provenance to an event produced by a make* factory
// ---------------------------------------------------------------------------

function withProvenance(event: Event, prov: ProvenanceTag): Event {
  // The Event type declares provenance as optional; spread into a new object
  // so the tag travels through the store's append() path cleanly.
  return { ...event, provenance: prov };
}

// ---------------------------------------------------------------------------
// Official-mark index for realised P&L (IAS 21 §28)
// ---------------------------------------------------------------------------

function buildOfficialMarkIndex(): Map<string, { rate: number; markAsOf: string }> {
  const byPairAndDate = new Map<string, { rate: number; markAsOf: string }>();
  try {
    for (const e of eventStore.replay({ type: "OfficialMarkAdopted" })) {
      const m = e.payload as unknown as OfficialMarkAdoptedPayload;
      if (m.markType !== "fx-rate") continue;
      const key = `${m.instrumentKey}:${m.markAsOf.slice(0, 10)}`;
      const existing = byPairAndDate.get(key);
      if (!existing || m.markAsOf > existing.markAsOf) {
        byPairAndDate.set(key, { rate: Number.parseFloat(m.mark), markAsOf: m.markAsOf });
      }
    }
  } catch {
    // No marks yet — all P&L will be zero (book-rate fallback).
  }
  return byPairAndDate;
}

function findSettlementRate(
  index: Map<string, { rate: number; markAsOf: string }>,
  currencyPair: string,
  settlementDate: string,
): number | null {
  let best: { rate: number; markAsOf: string } | null = null;
  for (const [key, mark] of index.entries()) {
    if (!key.startsWith(`${currencyPair}:`)) continue;
    const markDate = key.slice(currencyPair.length + 1);
    if (markDate <= settlementDate) {
      if (!best || markDate > best.markAsOf) best = mark;
    }
  }
  return best ? best.rate : null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const dryRun = process.argv.includes("--dry-run");
  const todayIso = nowUtc().slice(0, 10);

  // -------------------------------------------------------------------------
  // Pass 1 — build indexes from a single full replay
  // -------------------------------------------------------------------------
  const trades = new Map<string, TradeRecord>();
  const instructed = new Map<string, InstructedRecord>();
  const confirmed = new Set<string>();
  const cancelled = new Set<string>();

  for (const e of eventStore.replay({})) {
    switch (e.type) {
      case "FxTradeExecuted": {
        const p = e.payload as unknown as FxTradeExecutedPayload;
        const tradeId = p.tradeId.value;
        const rawProv = e.provenance as { kind?: string; scenario?: string; sourceLineage?: string } | null | undefined;
        const kind = rawProv?.kind ?? "build-phase-fixture";
        if (kind !== "build-phase-fixture" && kind !== "simulated") {
          // Production trade — the live subscriber handles these; skip backfill.
          break;
        }
        // Derive backfill provenance tag from the trade's own kind.
        const backfillProv: ProvenanceTag =
          kind === "simulated"
            ? simulatedTag({
                scenario: rawProv?.scenario ?? "pre-substrate-build-phase",
                sourceLineage: BACKFILL_SOURCE_LINEAGE,
              })
            : buildPhaseFixtureTag({ sourceLineage: BACKFILL_SOURCE_LINEAGE });

        trades.set(tradeId, { tradeId, payload: p, prov: backfillProv });
        break;
      }

      case "FxSettlementInstructed": {
        const p = e.payload as Record<string, unknown>;
        const rawId = p.tradeId as { value?: string } | string | undefined;
        const tradeId = typeof rawId === "string" ? rawId : rawId?.value;
        if (!tradeId) break;
        const nc = p.netCash as { currency: string; amountMinor: number } | undefined;
        if (!nc) break;
        const sd = (p.settlementDate as { iso?: string } | undefined)?.iso ?? "";
        const prev = instructed.get(tradeId) ?? {
          payLeg: false,
          receiveLeg: false,
          settlementDate: sd,
          payCurrency: nc.currency,
          receiveCurrency: nc.currency,
        };
        if (nc.amountMinor < 0) {
          instructed.set(tradeId, { ...prev, payLeg: true, payCurrency: nc.currency });
        } else {
          instructed.set(tradeId, { ...prev, receiveLeg: true, receiveCurrency: nc.currency });
        }
        break;
      }

      case "SettlementConfirmed": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) confirmed.add(id);
        break;
      }

      case "FxTradeCancelled": {
        const id = (e.payload as { tradeId?: string }).tradeId;
        if (id) cancelled.add(id);
        break;
      }
    }
  }

  const officialMarks = buildOfficialMarkIndex();

  let instructedEmitted = 0;
  let confirmedEmitted = 0;
  let skippedCancelled = 0;
  let skippedAlreadyFullyInstructed = 0;
  let skippedFutureSettlement = 0;

  // -------------------------------------------------------------------------
  // Pass 2 — emit missing FxSettlementInstructed + SettlementConfirmed
  // -------------------------------------------------------------------------
  for (const [tradeId, rec] of trades) {
    if (cancelled.has(tradeId)) {
      skippedCancelled++;
      continue;
    }

    const alreadyInstr = instructed.get(tradeId);
    const hasPayLeg = alreadyInstr?.payLeg ?? false;
    const hasReceiveLeg = alreadyInstr?.receiveLeg ?? false;
    const fullyInstructed = hasPayLeg && hasReceiveLeg;

    if (fullyInstructed) {
      skippedAlreadyFullyInstructed++;
    } else {
      // Must emit missing leg(s).
      const trade = rec.payload;
      const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
      if (!nearLeg) {
        console.error(
          JSON.stringify({
            level: "warn",
            tradeId,
            msg: "backfill-fx-post-trade-lifecycle — trade has no legs; skipping",
          }),
        );
        continue;
      }

      const payCurrency = nearLeg.payCurrency;
      const receiveCurrency = nearLeg.receiveCurrency;
      const payNotionalMinor = -Math.abs(nearLeg.notional.amountMinor);
      const receiveNotionalMinor = Math.abs(nearLeg.counterNotional.amountMinor);
      const settlementDateIso =
        nearLeg.settlementDate?.iso ?? addTwoCalendarDays(trade.tradeDate.iso);

      if (!hasPayLeg) {
        if (!dryRun) {
          const ev = withProvenance(
            makeFxSettlementInstructed({
              asOf: settlementDateIso,
              entity: ENTITY,
              actor: ACTOR,
              citations: [...CITATIONS],
              payload: {
                tradeId: trade.tradeId,
                legKind: "near",
                settlementId: { scheme: "INTERNAL", value: `STL-BF-${tradeId}-PAY` },
                settlementPath: "correspondent",
                settlementForm: "physical",
                correspondent: SIM_CORRESPONDENT,
                counterparty: trade.counterparty,
                netCash: { currency: payCurrency, amountMinor: payNotionalMinor },
                settlementDate: { iso: settlementDateIso, calendar: "JIHCAL" },
                messageStandard: "ISO-20022-pacs.009",
              },
              eventId: newEventId(),
            }),
            rec.prov,
          );
          eventStore.append(ev);
        }
        instructedEmitted++;
      }

      if (!hasReceiveLeg) {
        if (!dryRun) {
          const ev = withProvenance(
            makeFxSettlementInstructed({
              asOf: settlementDateIso,
              entity: ENTITY,
              actor: ACTOR,
              citations: [...CITATIONS],
              payload: {
                tradeId: trade.tradeId,
                legKind: "near",
                settlementId: { scheme: "INTERNAL", value: `STL-BF-${tradeId}-RCV` },
                settlementPath: "correspondent",
                settlementForm: "physical",
                correspondent: SIM_CORRESPONDENT,
                counterparty: trade.counterparty,
                netCash: { currency: receiveCurrency, amountMinor: receiveNotionalMinor },
                settlementDate: { iso: settlementDateIso, calendar: "JIHCAL" },
                messageStandard: "ISO-20022-pacs.009",
              },
              eventId: newEventId(),
            }),
            rec.prov,
          );
          eventStore.append(ev);
        }
        instructedEmitted++;
      }

      // Update in-memory map so the confirmation step below sees full instructions.
      const prevInstr = instructed.get(tradeId) ?? {
        payLeg: false,
        receiveLeg: false,
        settlementDate: settlementDateIso,
        payCurrency,
        receiveCurrency,
      };
      instructed.set(tradeId, {
        payLeg: true,
        receiveLeg: true,
        settlementDate:
          prevInstr.settlementDate !== "" ? prevInstr.settlementDate : settlementDateIso,
        payCurrency: payCurrency,
        receiveCurrency: receiveCurrency,
      });
    }

    // -----------------------------------------------------------------------
    // Confirmation step: emit SettlementConfirmed for mature instructed trades
    // -----------------------------------------------------------------------
    if (confirmed.has(tradeId)) continue;

    const instr = instructed.get(tradeId);
    if (!instr || !instr.payLeg || !instr.receiveLeg) continue;

    // Only confirm trades whose settlement date ≤ today (open-market convention).
    if (instr.settlementDate > todayIso) {
      skippedFutureSettlement++;
      continue;
    }

    const trade = rec.payload;
    const nearLeg = trade.legs.find((l) => l.legKind === "near") ?? trade.legs[0];
    const currencyPairStr = `${trade.currencyPair.base}/${trade.currencyPair.quote}`;
    const settlementDate = instr.settlementDate;

    // IAS 21 §28 realised P&L.
    let realisedPnlDelta = 0;
    if (nearLeg) {
      const bookRate = nearLeg.rate.amount;
      const notionalBaseMinor = baseAmountMinor(nearLeg, trade.currencyPair);
      let settlementRate = findSettlementRate(officialMarks, currencyPairStr, settlementDate);
      if (settlementRate === null) {
        console.error(
          JSON.stringify({
            level: "warn",
            tradeId,
            currencyPair: currencyPairStr,
            settlementDate,
            msg: "backfill-fx-post-trade-lifecycle — no OfficialMarkAdopted; realisedPnlDelta=0 (IAS 21 §28 book-rate fallback)",
          }),
        );
        settlementRate = bookRate;
      } else if (settlementRate > 0 && bookRate > 0) {
        // Direction sanity-check (same guard as post-trade-lifecycle.ts).
        const ratio = settlementRate / bookRate;
        if (ratio > 5 || ratio < 0.2) settlementRate = 1 / settlementRate;
      }
      const isBuy = trade.side === "buy";
      realisedPnlDelta = Math.round(
        (isBuy ? 1 : -1) * (settlementRate - bookRate) * Math.abs(notionalBaseMinor),
      );
    }

    if (!dryRun) {
      const ev = withProvenance(
        makeSettlementConfirmed({
          asOf: settlementDate,
          entity: ENTITY,
          actor: ACTOR,
          citations: [...CITATIONS],
          payload: {
            tradeId,
            currencyPair: currencyPairStr,
            settledDate: settlementDate,
            realisedPnlDelta,
            settlementRef: `SWIFT-CONF-BF-${tradeId.slice(-12)}`,
            citations: [...CITATIONS],
          },
          eventId: newEventId(),
        }),
        rec.prov,
      );
      eventStore.append(ev);
    }
    confirmed.add(tradeId);
    confirmedEmitted++;
  }

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  console.log(
    JSON.stringify({
      level: "info",
      dryRun,
      msg: dryRun
        ? "backfill-fx-post-trade-lifecycle — DRY RUN (no events emitted)"
        : "backfill-fx-post-trade-lifecycle — complete",
      instructedEmitted: dryRun ? 0 : instructedEmitted,
      confirmedEmitted: dryRun ? 0 : confirmedEmitted,
      wouldEmitInstructed: dryRun ? instructedEmitted : undefined,
      wouldEmitConfirmed: dryRun ? confirmedEmitted : undefined,
      skippedCancelled,
      skippedAlreadyFullyInstructed,
      skippedFutureSettlement,
    }),
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addTwoCalendarDays(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

main();
