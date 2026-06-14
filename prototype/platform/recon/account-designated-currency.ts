// platform/recon/account-designated-currency.ts
//
// recon:account-designated-currency — designated-currency posting gate.
//
// Asserts that no `SubLedgerPostingEmitted` leg carries a currency
// contradicting the leg account's designated `currency` field in
// platform/accounting/coa-registry.ts (D-COA-CURRENCY-DECOUPLING). Accounts
// whose registry entry OMITS `currency` — genuinely multi-currency accounts
// (FX unresolved-currency suspense ACC-2100-007, NOP memoranda ACC-9000-*,
// build-phase write-off ACC-2105-001) — are exempt via the registry field
// itself, never a hardcoded id allowlist; accounts absent from the registry
// (legacy json-only, e.g. ACC-2100-009) carry no designation to contradict.
//
// Two rules over the shared fold in
// platform/accounting/designated-currency-ledger.ts (the SAME fold the
// corrective re-book script scripts/rebook-usd-designated-account-residuals.ts
// uses, so gate and remediation can never drift):
//
//   (A) LIVE RATCHET. Any SubLedgerPostingEmitted leg with
//       postedAt > EFFECTIVE_FROM (the D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK
//       approval instant, 2026-06-10T17:25:00Z) whose currency contradicts the
//       account designation is an IMMEDIATE violation — netting cannot excuse
//       a fresh wrong-currency booking (a new default-to-USD-class defect must
//       red the gate even if a later compensation happens to zero the balance).
//       Sole exemption: the `designated-currency-rebook` corrective posting
//       type, which by construction must touch the wrong-currency account to
//       reverse the residual out of it.
//
//   (B) RESIDUAL (re-book-aware history). For every (account, mismatched
//       currency) pair, the NET across ALL GL-significant legs
//       (SubLedgerPostingEmitted + JournalEntryPosted + ManualJournalEntry —
//       the same three event types buildGlView folds) must be ZERO. Historical
//       pre-re-book defect legs therefore do NOT permanently red the gate: a
//       residual fully compensated by a later corrective entry — the
//       designated-currency-rebook posting, or a CFO-authority manual journal
//       such as FXRECON-LEGACY-20260607 which already compensated
//       ACC-2100-002/004 — nets to zero and is compensated history, not a
//       violation (Principle 1: corrections are new events; "fixed" is a
//       property of the fold). A non-zero net is an UNCOMPENSATED residual:
//       remediation is scripts/rebook-usd-designated-account-residuals.ts
//       --apply (or a fresh decision-scoped correction for accounts outside
//       that script's scope).
//
// Authority: D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK (CEO-approved 2026-06-10);
//   D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase 2026-06-08);
//   D-COA-CURRENCY-DECOUPLING (CEO 2026-05-30).
// Citations: Principles/1-events-are-truth.md;
//   Principles/5-multi-currency-entity-country.md.
// Author: Bea (GL engineer, accounting).

import { fileURLToPath } from "node:url";

import {
  designatedCurrencyOf,
  extractGlLegs,
  mismatchedResiduals,
} from "../accounting/designated-currency-ledger.ts";
import { eventStore } from "../composition.ts";
import { amountToMinorUnits } from "../core/decimal-money";
import type { Event } from "../event-store/types.ts";

const PIPELINE = "recon:account-designated-currency";

/**
 * The D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK approval instant (CEO, 2026-06-10;
 * see scripts/record-d-account-designated-currency-rebook.ts). Mismatched legs
 * posted AFTER this instant are immediate violations (rule A); legs at or
 * before it are governed by the re-book-aware residual rule (B) — the
 * historical defect population (2026-06-01..06) predates it by design.
 */
export const EFFECTIVE_FROM = "2026-06-10T17:25:00.000Z";

/** The corrective posting type that legitimately touches a wrong-currency
 *  account (to reverse the residual out of it). */
export const REBOOK_POSTING_TYPE = "designated-currency-rebook";

export interface Violation {
  readonly subject: string;
  readonly message: string;
}

function fmtMinor(minor: number): string {
  return minor.toLocaleString("en-ZA");
}

/**
 * Run both rules. `events` may be injected for tests; otherwise the
 * composition store is read (empty store → green, by construction).
 */
export function main(opts?: { events?: readonly Event[] }): {
  violations: Violation[];
  asserted: number;
} {
  let events: readonly Event[];
  if (opts?.events) {
    events = opts.events;
  } else {
    try {
      events = [...eventStore.replay({})];
    } catch {
      events = [];
    }
  }

  const legs = extractGlLegs(events);
  const violations: Violation[] = [];
  let asserted = 0;

  // ── Rule A: live ratchet — fresh mismatched SubLedgerPostingEmitted legs ──
  for (const leg of legs) {
    if (leg.eventType !== "SubLedgerPostingEmitted") continue;
    asserted += 1;
    if (leg.postedAt <= EFFECTIVE_FROM) continue;
    if (leg.postingType === REBOOK_POSTING_TYPE) continue;
    const designated = designatedCurrencyOf(leg.accountId);
    if (!designated || designated === leg.currency) continue;
    violations.push({
      subject: `${leg.accountId}:${leg.currency}:${leg.eventId}`,
      message: `SubLedgerPostingEmitted leg posted ${leg.postedAt} (after D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK, ${EFFECTIVE_FROM}) books ${leg.currency} ${leg.debitCredit} ${fmtMinor(Number(amountToMinorUnits(leg.amount)))} minor into ${leg.accountId}, which is designated ${designated} (coa-registry.ts). A designated-currency account must never receive a contradicting-currency leg — this is a fresh default-to-USD-class resolution defect (postingType "${leg.postingType}", event ${leg.eventId}). Fix the resolver/rule, then re-book via a designated-currency-rebook correction.`,
    });
  }

  // ── Rule B: re-book-aware residuals across SLP + JEP + MJE ──
  for (const residual of mismatchedResiduals(legs)) {
    asserted += 1;
    if (residual.netMinor === 0) continue; // fully compensated history — not a violation
    violations.push({
      subject: `${residual.accountId}:${residual.currency}`,
      message: `${residual.accountId} is designated ${residual.designatedCurrency} (coa-registry.ts) but holds an UNCOMPENSATED ${residual.currency} residual: net ${residual.netMinor >= 0 ? "Dr" : "Cr"} ${fmtMinor(Math.abs(residual.netMinor))} minor across ${residual.legCount} legs (SubLedgerPostingEmitted + JournalEntryPosted + ManualJournalEntry fold). Re-book it into the per-currency home: scripts/rebook-usd-designated-account-residuals.ts --apply (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK), or a fresh decision-scoped correction if the account is outside that script's scope. Principle 1: corrections are new events, never edits.`,
    });
  }

  return { violations, asserted };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { violations, asserted } = main();
  if (violations.length > 0) {
    console.error(`\n❌ ${PIPELINE}: ${violations.length} violation(s) of ${asserted} asserted:\n`);
    for (const v of violations) console.error(`  - ${v.subject}: ${v.message}`);
    process.exit(1);
  }
  console.log(
    `✅ ${PIPELINE}: ${asserted} leg/residual assertion(s) checked — no posted leg contradicts its account's designated currency and no uncompensated cross-currency residual remains`,
  );
}
