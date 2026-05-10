// scripts/record-d-bank-account-substrate.ts
//
// One-shot: emit a CeoDecision event for D-BANK-ACCOUNT-SUBSTRATE — the
// bank-account event family + master/balance projections substrate.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10),
// which adopted D-BANK-ACCOUNT-SUBSTRATE as a sub-decision under its
// umbrella per pack §6 brief #A1. This script records the slice sub-
// authorisation under that standing approval per CLAUDE.md "Dispatch
// discipline" — no new CEO approval required.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-BANK-ACCOUNT-SUBSTRATE",
  action: "approve" as const,
  title: "Bank-account event family + master/balance projections (D-BANK-ACCOUNT-SUBSTRATE)",
  outcome:
    "Tomas (Operations & payments engineer, engineering — reports to Devon COO; lead) ships the bank-account substrate atomically: three event types (BankAccountOpened / BankAccountConfigured / BankAccountClosed) with typed Zod payload schemas + make…() constructors + governance-7y retention; two projections under prototype/platform/projections/accounts/ (accounts.master — current state per accountId; accounts.balance — running per-account signed-cash sum over the convention triple {accountId, cashAmountMinor, currency}). Wired to Anya's semantic-layer registry (PR #156) via the chartOfAccounts.leafAccountId field on every BankAccountOpened — the Balance and CashAndBalancesAtSARB entries' formula strings already reference the leaf-account ID convention. Substrate-gap notes: M1-→-account dispatch deferred to D-EVENT-STORE-SCALING Slice 4 GL projection (the M1 sub-ledger projection materialises postings keyed by sourceEventId+legKind, not accountId; the dry-run scenario script #A4 bridges this gap by emitting events that carry the convention triple directly). Closure-cascade rules + posting-against-closed-account guard routed to Bea's accounting policies + Vera's substrate-integrity recon as follow-ons. Atlas (Core banking platform architect, engineering — substrate consult) sanity-checked the projection contracts. Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO) approved the chart-of-accounts integration and the signed-balance semantics.",
  comment:
    "downstream substrate dispatch from D-FIRST-DRY-RUN-SCENARIO §6 #A1; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_tomas-atlas-bea_d-bank-account-substrate.md",
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
      recordedVia: "script:record-d-bank-account-substrate",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
