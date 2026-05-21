// scripts/record-d-fx-sales-trading-frontend-slice-2.ts
//
// One-shot: emit a CeoDecision event for D-FX-SALES-TRADING-FRONTEND-SLICE-2
// — the substrate-adoption slice that lands the FX desk RFQ form, the
// synthetic-quote stub, the trade-emit endpoint, and the confirmation panel.
//
// Standing authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
// Per the no-pause rule, downstream slices of an approved decision dispatch
// without per-item CEO confirmation; this script records the slice-2 sub-
// authorisation so the audit trail names it explicitly.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets) + Saskia (Head of Global Markets,
//         governance) + Anya (Data / analytics engineer, engineering).

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-2",
  action: "approve" as const,
  title:
    "FX sales & trading front-end Slice 2 — RFQ form + trade-emit (D-FX-SALES-TRADING-FRONTEND)",
  outcome:
    "Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) + Saskia (Head of Global Markets, governance) + Anya (Data / analytics engineer, engineering)'s Slice 2 substrate change approved as drafted under standing D-FX-SALES-TRADING-FRONTEND authority. New module prototype/dashboard/markets-fx-trade.ts implements RFQ validation, eligibility re-check at emit time (pack §3 G1 defence-in-depth), synthetic fixed-spread quote stub for ZAR/USD spot (real pricer is Slice 3), payload builder against the FX CDM (prototype/platform/markets/cdm/fx.ts, PR #49), and provenance-tagged FxTradeExecuted append. Two new server routes: POST /api/markets/fx/quote (synthetic quote without append) and POST /api/markets/fx/trade (validate → eligibility-gate → quote → append → confirm). FX desk page (PR #154) extended with an RFQ form section (counterparty / currencyPair / side / notional / valueDate), a quote panel (synthetic bid/offer/mid), a trade button, and a confirmation panel showing tradeId + eventId + provenance scenario. Every emitted event carries provenance kind:'simulated', scenario:'first-dry-run-2026-Q1', sourceLineage:'agent-runtime:kai-fx-rfq' per D-DATA-PROVENANCE-SUBSTRATE Slice 6+1 + the dispatch brief. First-dry-run constraint (USD/ZAR spot only) enforced at validation. Smoke test in prototype/tests/markets-fx-trade-emit.test.ts covers 21 cases — validation (8), synthetic quote (3), payload shape (2), eligibility gate (2), emit round-trip (4), quote-only (2). Substrate gaps surfaced: full RfqRequested/QuoteResponded chain (pack §9 #2; queues behind RMS Slice 2), real pricer (Slice 3), multi-pair / forwards / NDFs (Slice 3), sales-rep attribution (Niko activates at licence-day), NPA badge (Slice 7), risk-officer view + rejection feed (Slices 4-5), OrderProposed → gateway fan-out (Slice 4), composition-mode flag (Atlas follow-on inherited from Slice 1). Decision record at Owner Inbox/2026-05-10_kai-saskia-anya_d-fx-sales-trading-frontend-slice-2.md. Full bun run ci green from prototype/.",
  comment: "downstream dispatch from D-FX-SALES-TRADING-FRONTEND; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_kai-saskia-anya_d-fx-sales-trading-frontend-slice-2.md",
  asOf: "2026-05-10T13:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "skipped (event already exists)");
    return 0;
  }

  recordCeoDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: "script:record-d-fx-sales-trading-frontend-slice-2",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
