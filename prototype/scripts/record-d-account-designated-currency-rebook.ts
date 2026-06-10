// scripts/record-d-account-designated-currency-rebook.ts
//
// Records D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK — Marc's in-session approval
// ("both", 2026-06-10) of the two-part remediation of the cross-currency
// contamination found in the USD-designated accounts:
//
//   Finding (Scrooge account sweep, 2026-06-10): GBP/JPY/CHF/EUR/AUD legs
//   posted into the USD-designated accounts ACC-1200-002 (Nostro),
//   ACC-2100-002 (FX Trading Receivable) and ACC-2100-004 (FX Trading
//   Payable) between 2026-06-01 and 2026-06-06, while the default-to-USD
//   currency-resolution defect was live (fixed for future postings by
//   D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, PR #1101, 2026-06-08). The
//   suspense re-book (PR #1140) zeroed ACC-2100-007 but never moved the
//   residuals stranded inside the USD accounts. GBP residual in
//   ACC-2100-002 also does NOT offset ACC-2100-010 exactly (~837m GBP-minor
//   gap), so the trading-balance migration was incomplete too.
//
//   (1) Bea (GL engineer, accounting) re-books each foreign-currency
//       residual out of ACC-1200-002 / ACC-2100-002 / ACC-2100-004 into the
//       matching per-currency accounts (1200-003..007, 2100-010..024 family),
//       reconciling the GBP receivable gap, same pattern as PR #1140.
//   (2) New recon:account-designated-currency gate — no posted leg's
//       currency may contradict the account's coa-registry designated
//       currency (multi-currency accounts exempt by registry field).
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-DECISIONS-FRAMEWORK-REDESIGN.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-10T17:20:00.000Z";
const APP = "2026-06-10T17:25:00.000Z";

const base = {
  decisionId: "D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Re-book cross-currency residuals stranded in USD-designated accounts (ACC-1200-002 / ACC-2100-002 / ACC-2100-004) + standing recon:account-designated-currency gate",
  category: "engineering" as const,
  recommendation:
    "Dispatch Bea (GL engineer, accounting) to (1) emit re-booking journal entries moving every foreign-currency residual out of the USD-designated accounts ACC-1200-002 (Nostro: GBP -168,715,899 / JPY -1,383,231,143 / CHF +331,799,070 minor), ACC-2100-002 (FX Trading Receivable: AUD/CHF/EUR/GBP/JPY residuals incl. GBP -21,432,009,076,252 minor) and ACC-2100-004 (FX Trading Payable: mirror residuals) into the matching per-currency accounts provisioned by D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, reconciling the ~837m GBP-minor receivable gap between ACC-2100-002 and ACC-2100-010 along the way; and (2) build a recon:account-designated-currency gate asserting no SubLedgerPostingEmitted leg carries a currency contradicting the leg account's coa-registry designated currency (registry-declared multi-currency accounts, e.g. suspense and NOP memoranda, exempt).",
  rationale:
    "Scrooge account sweep 2026-06-10 (prompted by Marc: 'why are there multiple gbp nostro accounts. check all accounts') found GBP/JPY/CHF/EUR/AUD legs posted into the three USD-designated accounts between 2026-06-01 and 2026-06-06 while the default-to-USD currency-resolution defect was live; PR #1101 (2026-06-08) fixed future postings and PR #1140 zeroed the GBP/JPY suspense, but the USD-account contamination was never re-booked (events are immutable per Principle 1 — correction requires compensating entries, not edits). The standing misstatement distorts per-currency exposure, NOP inputs and any per-currency reporting. CEO approved both remediation items in-session ('both', 2026-06-10).",
  citations: [
    "Principles/1-events-are-truth.md",
    "D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS",
    "D-COA-CURRENCY-DECOUPLING",
    "prototype/platform/accounting/coa-registry.ts",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
