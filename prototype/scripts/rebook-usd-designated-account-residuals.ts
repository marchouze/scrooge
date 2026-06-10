// scripts/rebook-usd-designated-account-residuals.ts
//
// One-time, idempotent corrective re-book of the foreign-currency residuals
// stranded INSIDE the three USD-designated accounts by the default-to-USD
// currency-resolution defect (live 2026-06-01..2026-06-06; fixed for future
// postings by D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, PR #1101).
//
// Authority: D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK (CEO-approved 2026-06-10).
// Brief: brief:bea:re-book-cross-currency-residuals-out-of-usd-desi:2026-06-10.
// Author: Bea (GL engineer, accounting).
//
// ─── WHAT WENT WRONG ────────────────────────────────────────────────────────
// While the default-to-USD defect was live, GBP/JPY/CHF/EUR/AUD legs posted
// into the USD-designated ACC-1200-002 (Nostro), ACC-2100-002 (FX Trading
// Receivable) and ACC-2100-004 (FX Trading Payable). PR #1140 re-booked the
// GBP/JPY unresolved-currency suspense (ACC-2100-007 now nets 0) but never
// moved the residuals inside the USD accounts themselves.
//
// ─── DERIVATION OF EVERY RE-BOOK AMOUNT (shared store, 2026-06-10) ──────────
// Residuals are NOT hardcoded: each run derives them live from the store as
// the per-(account, mismatched-currency) NET across every GL-significant leg
// (SubLedgerPostingEmitted + JournalEntryPosted + ManualJournalEntry — the
// same three event types buildGlView folds; see designated-currency-ledger.ts).
// The figures below document what that fold yields on the shared store as of
// dispatch, and WHY:
//
// (1) ACC-1200-002 Nostro (designated USD) — UNCOMPENSATED, re-booked here:
//       GBP net −168,715,899 = fx-principal-payment −120,056,626
//                            + cancellation-reversal  −48,659,273
//       JPY net −1,383,231,143 = fx-principal-payment +5,565,432,871
//                              + cancellation-reversal −6,948,664,014
//       CHF net   +331,799,070 = fx-principal-payment +331,799,070
//     These are FX-spot principal-settlement cash legs that should have hit
//     the per-currency nostros (GBP → ACC-1200-004, JPY → ACC-1200-005,
//     CHF → ACC-1200-006) but resolved to the USD slot. No later corrective
//     entry ever touched them → net ≠ 0 → re-booked by this script.
//
// (2) ACC-2100-002 / ACC-2100-004 (designated USD) — ALREADY FULLY
//     COMPENSATED, this script verifies net 0 and emits NOTHING for them:
//     the raw SubLedgerPostingEmitted residuals quoted in the dispatch brief
//     (e.g. ACC-2100-002 GBP −21,432,009,076,252; AUD −10,837,249,518,240)
//     are real, but the ManualJournalEntry FXRECON-LEGACY-20260607
//     (event fb-era 636fc88b…, Atlas FX sub-ledger legacy-account
//     reconciliation, 2026-06-07T06:33:16.419Z — the PR #1057-#1060 arc)
//     already compensated every one of them EXACTLY (per-currency MJE legs:
//     ACC-2100-002 GBP +21,432,009,076,252, AUD +10,837,249,518,240, …;
//     mirror on ACC-2100-004), retiring the legacy gross to the live-trade
//     footprint and quarantining the residue to ACC-2100-009 (then written
//     off to ACC-2105-001 by FXWRITEOFF-SUSPENSE-20260607, CFO authority).
//     A raw SubLedgerPostingEmitted-only scan cannot see that MJE — which is
//     why the brief's diagnosis still showed them as live. Per Principle 1 a
//     residual fully compensated by a later corrective entry is FIXED; the
//     fold (not the original events) is the balance.
//
// ─── THE TWO GBP "GAPS" IN THE BRIEF, EXPLAINED ─────────────────────────────
// Gap A: ACC-2100-002 GBP raw (−21,432,009,076,252) vs ACC-2100-010 raw
//   (+21,432,846,100,866): gap +837,024,614 GBP-minor. NOT a missing
//   migration amount. Decomposition:
//     +124,374,818 = legitimate post-fix GBP activity booked DIRECTLY to the
//       per-currency accounts (trade-booking +162,510,527 less principal
//       settlement −38,135,709) — never part of any migration; plus
//     +712,649,796 = net live GBP receivable flow stranded on ACC-2100-002
//       beyond the migrated gross bookings: uncancelled bookings +1,218,447,984
//       (= +21,432,759,861,757 bookings − 21,431,541,413,773 cancellations)
//       + cancellation-reversal +48,659,273 − principal settlements
//       −554,457,461. The sla-rebook-simulated-misbooking script (PR-era)
//       moved only the gross BOOKING legs (−21,432,721,726,048), not the
//       settlement/cancellation flows. The FXRECON-LEGACY-20260607 MJE later
//       compensated the whole ACC-2100-002 GBP residual exactly.
//   The two accounts were never supposed to mirror: 010 carries genuine
//   post-fix activity and 002's residual included flows the migration skipped.
//
// Gap B: ACC-2100-004 GBP raw (+21,432,177,792,151) vs ACC-2100-011 raw
//   (−21,432,721,726,048): gap −543,933,897 — numerically equal (sign-
//   flipped) to the GBP NOP long-memorandum net (ACC-9000-001 GBP
//   +543,933,897, store-verified). NOT a coincidence and NOT a missing
//   amount: the non-migrated part of 004's balance
//   (−21,432,759,861,757 bookings + 21,431,541,413,773 cancellations
//    + 674,514,087 principal payments = −543,933,897) is the bank's net
//   un-discharged GBP payable from the SAME uncancelled defect-era trade set
//   whose net open GBP position the NOP memorandum tracks — the memo books
//   one GBP leg per trade and reverses on cancellation, so net-payable-not-
//   yet-settled and net-open-position coincide on this population. Per-
//   currency double entry closes exactly across the USD accounts:
//   receivable residual +712,649,796 − payable residual 543,933,897
//   − nostro settled GBP 168,715,899 = 0. (The receivable/payable sides were
//   then compensated by the FXRECON MJE; the nostro side is what THIS script
//   re-books.)
//
// ─── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────
// Append-only (Principle 1 — corrections are new events, never edits). For
// each (scoped USD-designated account, foreign currency) whose folded net is
// non-zero, it emits ONE corrective `SubLedgerPostingEmitted`
// (postingType "designated-currency-rebook") with TWO legs in the SAME
// currency, balanced within the currency (trial balance undisturbed):
//   1. REVERSE the net residual out of the USD-designated account.
//   2. RE-BOOK it into the matching per-currency account, resolved from the
//      COA registry by (same name, same category, currency == leg currency):
//      Nostro → ACC-1200-003 (EUR) / 004 (GBP) / 005 (JPY) / 006 (CHF) / 007 (AUD);
//      FX Trading Receivable → ACC-2100-010/013/016/019/022;
//      FX Trading Payable    → ACC-2100-011/014/017/020/023.
//
// ─── TIMESTAMP ALIGNMENT ────────────────────────────────────────────────────
// Each correction is stamped with the LATEST postedAt among the mismatched
// legs it nets (NOT wall-clock-now), so it folds inside the GL view's
// `postedAt > asOf` cut-off for every as-of from the moment contamination
// last moved — same discipline as PR #1140's suspense re-book.
//
// ─── PROVENANCE DISCIPLINE ──────────────────────────────────────────────────
// Each correction inherits the provenance tag of the event carrying the
// latest mismatched leg (same plane; the defect-era legs are `simulated` /
// pre-substrate-build-phase). Production legs would never receive a
// different plane.
//
// ─── IDEMPOTENCY ────────────────────────────────────────────────────────────
// Doubly idempotent: (a) the residual is recomputed from the fold, and the
// correction itself participates in the fold, so a second run derives net 0
// and emits nothing; (b) each correction carries a deterministic
// `rebookKey` = `D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK:<accountId>:<currency>`
// and the runner skips any key already present in the store.
//
// ─── HOW SCROOGE RUNS IT (post-merge, live shared store) ────────────────────
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run prototype/scripts/rebook-usd-designated-account-residuals.ts --apply
//   (default is a DRY-RUN that prints the plan and mutates nothing.)
//
// Citations: D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK;
//   D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS; D-COA-CURRENCY-DECOUPLING;
//   IAS 21 §23; Principles/1-events-are-truth.md;
//   Principles/5-multi-currency-entity-country.md.

// Opt into the shared HOME event-store BEFORE composition resolves its dbPath.
// BANK_EVENT_DB (set to a tmpdir in local/test runs) still wins over the home
// default: home-store on Scrooge's run, tmp on every dev run.
import "../platform/event-store/resolve-event-db-boot";

import { COA_BY_ID } from "../platform/accounting/coa-registry";
import {
  type MismatchedResidual,
  extractGlLegs,
  mismatchedResiduals,
} from "../platform/accounting/designated-currency-ledger";
import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import {
  FX_UNRESOLVED_CURRENCY_SUSPENSE,
  defaultResolver,
} from "../platform/accounting/sla/resolver";
import { eventStore } from "../platform/composition";
import { makeSubLedgerPostingEmitted } from "../platform/event-store/event-types/fx-accounting";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const REPRESENTATION = "IFRS";

export const REBOOK_POSTING_TYPE = "designated-currency-rebook";
export const REBOOK_DECISION = "D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK";

/**
 * The decision-scoped contaminated accounts (D-ACCOUNT-DESIGNATED-CURRENCY-
 * REBOOK names exactly these three USD-designated accounts). The MECHANICS are
 * generic over any designated-currency account; the SCOPE is the decision's.
 */
export const SCOPED_ACCOUNTS = ["ACC-1200-002", "ACC-2100-002", "ACC-2100-004"] as const;

const ACTOR = {
  type: "service" as const,
  id: "agent:bea:rebook-usd-designated-account-residuals:D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK",
};

const CITATIONS = [
  "D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK",
  "D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS",
  "D-COA-CURRENCY-DECOUPLING",
  "IAS-21-§23",
  "Principles/1-events-are-truth.md",
  "Principles/5-multi-currency-entity-country.md",
];

// ---------------------------------------------------------------------------
// Target resolution — registry-driven, never a hardcoded id map.
// ---------------------------------------------------------------------------

/**
 * The contaminated account → SLA logical-account map. The defect-era legs
 * were FX-spot flows the resolver SHOULD have routed per-currency; re-booking
 * re-resolves them through the production `defaultResolver` (the live SLA
 * booking path, post-PR-#1101), so the targets are exactly where those legs
 * book today and can never drift from the interpreter's account resolution —
 * same discipline as the PR #1140 suspense re-book. (A registry name/category
 * lookup is NOT used: the deprecated ACC-1100-002/003 nostro shells share
 * (name, category, currency) with their canonical ACC-1200 replacements and
 * would make the lookup ambiguous; the resolver is the canonical router.)
 */
const LOGICAL_BY_ACCOUNT: Record<string, string> = {
  "ACC-1200-002": "fx.nostro",
  "ACC-2100-002": "fx.receivable",
  "ACC-2100-004": "fx.payable",
};

const PRODUCT = "FX-spot";
const JURISDICTION = "ZA";

/**
 * Resolve the per-currency home for a residual via the production SLA
 * resolver. Throws when the resolver has no dedicated per-currency account
 * (it would route to the unresolved-currency suspense) or when the resolved
 * target's registry designation contradicts the residual currency: a residual
 * must never be silently dropped or mis-routed.
 */
export function resolveTargetAccount(contaminatedAccountId: string, currency: string): string {
  const logical = LOGICAL_BY_ACCOUNT[contaminatedAccountId];
  if (!logical) {
    throw new Error(
      `rebook-usd-designated-account-residuals: no logical-account mapping for ${contaminatedAccountId} — extend LOGICAL_BY_ACCOUNT before re-booking it (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK)`,
    );
  }
  const outcome = defaultResolver.resolve({
    entity: ENTITY,
    product: PRODUCT,
    currency,
    jurisdiction: JURISDICTION,
    representation: REPRESENTATION,
    logical,
  });
  if (!outcome.ok || outcome.physical === FX_UNRESOLVED_CURRENCY_SUSPENSE) {
    throw new Error(
      `rebook-usd-designated-account-residuals: resolver has no dedicated ${currency} account for ${logical} (would route to suspense ${FX_UNRESOLVED_CURRENCY_SUSPENSE}) — provision the per-currency account first; residuals are never silently dropped (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK)`,
    );
  }
  const designated = COA_BY_ID.get(outcome.physical)?.currency;
  if (designated !== currency) {
    throw new Error(
      `rebook-usd-designated-account-residuals: resolver routed ${logical}/${currency} to ${outcome.physical}, whose registry designation is ${designated ?? "(none)"} — refusing to move a residual into a non-matching account (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK)`,
    );
  }
  return outcome.physical;
}

// ---------------------------------------------------------------------------
// Correction builder
// ---------------------------------------------------------------------------

export function rebookKeyFor(accountId: string, currency: string): string {
  return `${REBOOK_DECISION}:${accountId}:${currency}`;
}

/**
 * Build the two-leg corrective posting for one non-zero residual:
 *   - reverse the NET residual out of the contaminated USD-designated account
 *     (debit if the residual is a net credit, credit if a net debit),
 *   - book the same amount on the residual's own side into the per-currency
 *     home account.
 * Both legs share the currency → balanced within currency; the institution-
 * wide trial balance is undisturbed, only the account distribution corrects.
 */
export function buildRebookEvent(residual: MismatchedResidual, targetAccountId: string): Event {
  const residualSide: "debit" | "credit" = residual.netMinor >= 0 ? "debit" : "credit";
  const reverseSide: "debit" | "credit" = residual.netMinor >= 0 ? "credit" : "debit";
  const amountMinor = Math.abs(residual.netMinor);
  const legs: SubLedgerLeg[] = [
    {
      accountId: residual.accountId,
      debitCredit: reverseSide,
      amountMinor,
      currency: residual.currency,
    },
    {
      accountId: targetAccountId,
      debitCredit: residualSide,
      amountMinor,
      currency: residual.currency,
    },
  ];
  const event = makeSubLedgerPostingEmitted({
    // Stamped with the latest mismatched leg's own postedAt — NOT wall-clock-
    // now — so the correction folds inside the GL view's `postedAt > asOf`
    // cut-off for every as-of from the moment contamination last moved.
    asOf: residual.lastPostedAt,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      postingType: REBOOK_POSTING_TYPE,
      rebookKey: rebookKeyFor(residual.accountId, residual.currency),
      legs,
      postedAt: residual.lastPostedAt,
      representation: REPRESENTATION,
      memo: `Re-books the ${residual.currency} residual stranded in the ${residual.designatedCurrency}-designated account ${residual.accountId} by the default-to-USD currency-resolution defect (live 2026-06-01..06, fixed by D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS PR #1101): net ${residual.netMinor} minor across ${residual.legCount} legs, reversed out of ${residual.accountId} and booked into the per-currency home ${targetAccountId}. Authority: D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK (CEO 2026-06-10). Append-only correction (Principle 1).`,
    } as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
  });
  // Inherit the latest mismatched leg's provenance tag (same plane).
  return { ...event, provenance: residual.lastProvenance } as Event;
}

/** rebookKeys already present in the store (idempotency guard b). */
export function existingRebookKeysFrom(events: Iterable<Event>): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    const p = e.payload as { postingType?: string; rebookKey?: string };
    if (p.postingType !== REBOOK_POSTING_TYPE) continue;
    if (typeof p.rebookKey === "string") keys.add(p.rebookKey);
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface RebookPlanItem {
  readonly residual: MismatchedResidual;
  readonly targetAccountId: string;
  readonly event: Event;
}

export interface RebookResult {
  readonly scanned: number;
  readonly compensatedAlready: number;
  readonly skippedExistingKey: number;
  readonly emitted: number;
  readonly plan: RebookPlanItem[];
}

/**
 * Compute (and with `apply: true`, append) the corrective re-books for every
 * non-zero mismatched residual in the decision-scoped accounts. `events` may
 * be injected for tests; otherwise the composition store is read.
 */
export function runRebook(opts: { apply: boolean; events?: readonly Event[] }): RebookResult {
  const events = opts.events ?? [...eventStore.replay({})];
  const legs = extractGlLegs(events);
  const scoped = new Set<string>(SCOPED_ACCOUNTS);
  const residuals = mismatchedResiduals(legs).filter((r) => scoped.has(r.accountId));
  const existingKeys = existingRebookKeysFrom(events);

  let compensatedAlready = 0;
  let skippedExistingKey = 0;
  const plan: RebookPlanItem[] = [];

  for (const residual of residuals) {
    if (residual.netMinor === 0) {
      // Fully compensated by a later corrective entry (re-book posting or
      // CFO-authority manual journal, e.g. FXRECON-LEGACY-20260607) — fixed
      // per Principle 1; nothing to move.
      compensatedAlready += 1;
      logger.info(
        { accountId: residual.accountId, currency: residual.currency, legs: residual.legCount },
        "rebook-usd-designated-account-residuals: residual already fully compensated — skipping",
      );
      continue;
    }
    const key = rebookKeyFor(residual.accountId, residual.currency);
    if (existingKeys.has(key)) {
      // A prior run already corrected this pair, yet the net is non-zero again:
      // NEW contamination after the re-book. Never silently double-book under
      // the same key — surface loudly for a fresh decision-scoped run.
      skippedExistingKey += 1;
      logger.warn(
        { rebookKey: key, netMinor: residual.netMinor },
        "rebook-usd-designated-account-residuals: rebookKey already in store but residual is non-zero — NEW post-rebook contamination; investigate (recon:account-designated-currency will flag it)",
      );
      continue;
    }
    const targetAccountId = resolveTargetAccount(residual.accountId, residual.currency);
    const event = buildRebookEvent(residual, targetAccountId);
    plan.push({ residual, targetAccountId, event });
  }

  for (const item of plan) {
    if (opts.apply) eventStore.append(item.event);
    logger.info(
      {
        apply: opts.apply,
        from: item.residual.accountId,
        to: item.targetAccountId,
        currency: item.residual.currency,
        netMinor: item.residual.netMinor,
        postedAt: item.residual.lastPostedAt,
        rebookKey: rebookKeyFor(item.residual.accountId, item.residual.currency),
      },
      opts.apply
        ? "rebook-usd-designated-account-residuals: emitted"
        : "rebook-usd-designated-account-residuals: DRY-RUN (would emit)",
    );
  }

  const result: RebookResult = {
    scanned: residuals.length,
    compensatedAlready,
    skippedExistingKey,
    emitted: plan.length,
    plan,
  };
  logger.info(
    {
      scanned: result.scanned,
      compensatedAlready,
      skippedExistingKey,
      emitted: result.emitted,
      apply: opts.apply,
    },
    "rebook-usd-designated-account-residuals: done",
  );
  return result;
}

// Entry point — `--apply` mutates; default is a dry-run.
if (import.meta.main) {
  const apply = process.argv.includes("--apply");
  runRebook({ apply });
}
