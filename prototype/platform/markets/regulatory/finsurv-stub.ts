// platform/markets/regulatory/finsurv-stub.ts
//
// Build-phase stub: emit a pending TradeReportSubmitted for a given tradeId.
//
// At licence-day this module is replaced by the live FinSurv submission
// pipeline (Mira's PROC-FINSURV-REPORT-01 substrate). Until then, the
// stub marks each FxTradeExecuted as "pending" so the downstream projection
// of outstanding submissions is populated without a live API.
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer; requires FinSurv reporting)
//   - EXCON-SARB-CIRC-3-2020 (reporting window obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering)

import { clock } from "../../composition";
import { newEventId } from "../../core/types";
import { makeTradeReportSubmitted } from "../../event-store/event-types/regulatory-reporting";
import type { EventStore } from "../../event-store/store";

const FINSURV_CITATIONS = [
  "D-FX-AD-STATUS",
  "EXCON-SARB-CIRC-3-2020",
  "ORG-MK-08",
  "ORG-EXCON-ODP-001",
];

const FINSURV_ACTOR = {
  type: "service" as const,
  id: "mira:finsurv-stub",
};

const BANK_ENTITY = "BANK-ZA-001";

/**
 * Emit a pending TradeReportSubmitted event for the given tradeId.
 *
 * Build-phase only. The stub always emits `status: "pending"` — meaning
 * the report has been "submitted" to FinSurv but acknowledgement is not
 * yet wired (no live API in the build phase).
 *
 * @param store         EventStore to append into.
 * @param tradeId       The trade being reported.
 * @param submittedAt   ISO 8601 timestamp of the (stub) submission.
 *                      Defaults to now.
 * @param finsurvCategory  Optional FinSurv transaction category code
 *                         (e.g. "ODP-001"). When provided it is included
 *                         in the payload; when absent the field is omitted.
 */
export function emitFinsuvPendingReport(
  store: EventStore,
  tradeId: string,
  submittedAt?: string,
  finsurvCategory?: string,
): void {
  const asOf = clock.now().slice(0, 10);
  const resolvedSubmittedAt = submittedAt ?? clock.now();

  const payload: Parameters<typeof makeTradeReportSubmitted>[0]["payload"] = {
    tradeId,
    regulator: "SARB-FinSurv",
    reportCategory: "FinSurv-FX-AD",
    submittedAt: resolvedSubmittedAt,
    status: "pending",
    citations: FINSURV_CITATIONS,
    ...(finsurvCategory !== undefined ? { finsurvCategory } : {}),
  };

  store.append(
    makeTradeReportSubmitted({
      asOf,
      entity: BANK_ENTITY,
      actor: FINSURV_ACTOR,
      citations: FINSURV_CITATIONS,
      payload,
      eventId: newEventId(),
    }),
  );
}
