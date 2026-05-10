// scripts/record-d-fx-sales-trading-frontend-slice-1.ts
//
// One-shot: emit a CeoDecision event for D-FX-SALES-TRADING-FRONTEND-SLICE-1
// — the substrate-adoption slice that lands the FX desk page shell, the
// counterparty-picker fold, and the launcher tile.
//
// Standing authority: D-FX-SALES-TRADING-FRONTEND (CEO-approved 2026-05-10).
// Per the no-pause rule, downstream slices of an approved decision dispatch
// without per-item CEO confirmation; this script records the slice-1 sub-
// authorisation so the audit trail names it explicitly.
//
// Run once; idempotent (skips ids already recorded).
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets) + Atlas (Core banking platform
//         architect, engineering) + Anya (Data / analytics engineer,
//         engineering).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-FX-SALES-TRADING-FRONTEND-SLICE-1",
  action: "approve" as const,
  title:
    "FX sales & trading front-end Slice 1 — UI shell + counterparty picker (D-FX-SALES-TRADING-FRONTEND)",
  outcome:
    "Kai (Trading systems engineer, engineering — reports to Saskia, Head of Global Markets) + Atlas (Core banking platform architect, engineering) + Anya (Data / analytics engineer, engineering)'s Slice 1 substrate change approved as drafted under standing D-FX-SALES-TRADING-FRONTEND authority. New page at /markets/fx/desk.html using the existing bank UI shell (PR #52); new GET /api/markets/fx/counterparties endpoint reads CounterpartyEligibilityScreened / CounterpartyEligibilityRevalidated / CounterpartyEligibilityBreached events (Niko's institutional-eligibility screening v0 — PR #77) and returns only counterparties whose latest screening result is institutional-eligible AND whose latest event is not a Breached. Substrate-mode banner pinned to the top of the page per pack §3 J7. Launcher tile registered on home.html (markets section) linking to the desk page. Smoke test in prototype/tests/markets-fx-desk-shell.test.ts covers fold semantics (5 cases — pass/fail filtering, breach gating, breach-then-revalidation re-include, latest-revalidation surfaced, empty store) + page-surface assertions (3 cases — banner copy, asset existence, launcher-tile registration). RFQ form (Slice 2), pricer (Slice 3), risk-officer view (Slice 5), NPA badge (Slice 7) deliberately out of scope per pack §6. Substrate gaps surfaced (pack §9): composition-mode flag (Atlas follow-on), RfqRequested + QuoteResponded event types (queues behind RMS Slice 2), FX blotter + headroom projections (Slices 2 + 3), Niko eligibility-projection read-API (migrates at licence-day), synthetic counterparty corpus (Kai authors in Slice 2). Full bun run ci green from prototype/.",
  comment: "downstream dispatch from D-FX-SALES-TRADING-FRONTEND; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_kai-atlas-anya_fx-sales-trading-frontend-slice-1.md",
  asOf: "2026-05-10T11:00:00.000Z",
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
      recordedVia: "script:record-d-fx-sales-trading-frontend-slice-1",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
