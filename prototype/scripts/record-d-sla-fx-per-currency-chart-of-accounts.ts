// scripts/record-d-sla-fx-per-currency-chart-of-accounts.ts
//
// Records D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS — closure of FX functionality
// review gap #2 (docs/2026-06-08_fx-functionality-domain-review.md): the
// per-currency Chart-of-Accounts provisioning was ZAR/USD-only for the
// correspondent nostro (ACC-1200) and settlement-failed receivable (ACC-2300)
// sub-ledgers, so EUR/GBP/JPY/CHF/AUD legs for those logicals routed to the FX
// unresolved-currency suspense (ACC-2100-007) — a Principle-5 gap.
//
// Supported FX currency set (data-driven, NOT hardcoded): derived from the live
// FX feed universe — the TwelveData target pairs (TWELVE_DATA_TARGET_PAIRS) plus
// the simulated seed-mid-rate pairs — which yields ZAR/USD/EUR/GBP/JPY/CHF/AUD.
// This is the SAME set already provisioned for the FX trading accounts under
// D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING.
//
// This run provisions the remaining per-currency accounts so the whole supported
// set books to dedicated accounts, never suspense:
//   - Correspondent nostros: GBP ACC-1200-004, JPY ACC-1200-005, CHF
//     ACC-1200-006, AUD ACC-1200-007 (ZAR/USD/EUR already existed).
//   - Settlement-failed receivables: EUR ACC-2300-005, GBP ACC-2300-006, JPY
//     ACC-2300-007, CHF ACC-2300-008, AUD ACC-2300-009 (ZAR/USD already existed).
// The SLA resolver + legacy posting-rule helpers (nostroAccountFor /
// settlementFailedReceivableAccountFor) route the supported set to the dedicated
// accounts. A new gate recon:fx-supported-currency-no-suspense asserts that no
// supported currency routes any per-currency FX logical to ACC-2100-007 in
// steady state. The ECL allowance + credit-loss expense remain ZAR functional-
// currency only (IAS 21 §23). The ACC-2100-007 suspense + urgent-correction
// alert path is RETAINED for genuinely unsupported currencies.
//
// Session-delegation: Marc (CEO) build-phase authority (no-pause rule); Scrooge
// is the recording instrument (recordedVia: scrooge:session-delegation). CFO
// category — Chart-of-Accounts provisioning under Camille (Chief Financial
// Officer, finance); engineering executed by Bea (Accounting & financial
// reporting engineer, engineering).
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument; work
//   executed by Bea (Accounting & financial reporting engineer) under Camille (CFO).

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-08T10:39:00.000Z";
const ASOF = "2026-06-08T10:40:00.000Z";

const DECISION_ID = "D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS";
const TITLE =
  "Per-currency FX Chart-of-Accounts — provision nostros + settlement-failed receivables for the full supported FX set";

const CITATIONS = [
  "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
  "D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING",
  "D-COA-CURRENCY-DECOUPLING",
  "Principles/5-multi-currency-entity-country.md",
];

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "finance",
    recommendation:
      "Provision per-currency correspondent nostros (GBP/JPY/CHF/AUD) and " +
      "settlement-failed receivables (EUR/GBP/JPY/CHF/AUD) so the full supported " +
      "FX set books to dedicated accounts, not the FX unresolved-currency suspense.",
    rationale:
      "FX review gap #2: per-currency CoA was ZAR/USD-only for the nostro + " +
      "settlement-failed sub-ledgers (Principle 5 gap). Opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "finance",
    recommendation:
      "Provision the remaining per-currency FX Chart-of-Accounts leaves so every " +
      "SUPPORTED FX currency (ZAR/USD/EUR/GBP/JPY/CHF/AUD — derived from the live " +
      "TwelveData feed universe + simulated seed pairs) resolves each per-currency " +
      "FX logical to a dedicated account, never the FX unresolved-currency suspense " +
      "(ACC-2100-007). Correspondent nostros added: GBP ACC-1200-004, JPY " +
      "ACC-1200-005, CHF ACC-1200-006, AUD ACC-1200-007 (ZAR/USD/EUR pre-existed). " +
      "Settlement-failed receivables added: EUR ACC-2300-005, GBP ACC-2300-006, JPY " +
      "ACC-2300-007, CHF ACC-2300-008, AUD ACC-2300-009 (ZAR/USD pre-existed). " +
      "Accounts added to both coa-registry.ts and chart-of-accounts.json (names " +
      "currency-free per D-COA-CURRENCY-DECOUPLING); the SLA AccountId union was " +
      "regenerated (sla:codegen). The SLA resolver fx.nostro + " +
      "fx.settlement_failed_receivable rows and the legacy posting-rule helpers " +
      "(nostroAccountFor / settlementFailedReceivableAccountFor in fx-spot.ts) route " +
      "the supported set to the dedicated accounts. The ECL allowance (ACC-2300-003) " +
      "and credit-loss expense (ACC-2300-004) remain ZAR functional-currency only " +
      "(IAS 21 §23). New gate recon:fx-supported-currency-no-suspense (wired into " +
      "ci:recon:domain) asserts no supported currency routes any per-currency FX " +
      "logical to ACC-2100-007 in steady state. The suspense + urgent-correction " +
      "alert path is RETAINED unchanged for genuinely unsupported currencies " +
      "(e.g. SGD/NOK), and the build-phase write-off path (fx-subledger-writeoff.ts, " +
      "ACC-2100-009) is untouched.",
    rationale:
      "FX functionality review (docs/2026-06-08_fx-functionality-domain-review.md) " +
      "gap #2: per-currency Chart-of-Accounts was complete for the FX TRADING " +
      "receivable/payable/unrealised-P&L accounts (D-SLA-FX-PER-CURRENCY-ACCOUNT-" +
      "PROVISIONING) but NOT for the correspondent-nostro (ACC-1200) or " +
      "settlement-failed receivable (ACC-2300) sub-ledgers, which existed for " +
      "ZAR/USD(/EUR) only. A EUR/GBP/JPY/CHF/AUD FX trade therefore still landed " +
      "balanced-but-suspense postings on those legs, requiring manual correction — " +
      "a Principle-5 (multi-currency from day one) gap. Provisioning the dedicated " +
      "accounts closes the gap; the new recon gate keeps it closed non-regressably. " +
      "CEO build-phase authority (no-pause rule); the supported set is the live FX " +
      "feed universe, so the change is data-coherent with the bank's actual traded " +
      "currencies.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify({ ok: true, eventId: result.eventId, decisionId: DECISION_ID }, null, 2),
);
