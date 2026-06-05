// scripts/rebook-simulated-fx-misbookings.ts
//
// One-time, idempotent corrective re-book of the SIMULATED FX trade mis-bookings
// (D-SLA-REBOOK-SIMULATED-MISBOOKINGS, CFO-approved).
//
// ─── WHAT WENT WRONG ────────────────────────────────────────────────────────
// Before the per-currency provisioning (D-SLA-FX-PER-CURRENCY-ACCOUNT-
// PROVISIONING) and the suspense-on-miss correction (D-SLA-RESOLVER-UNRESOLVED-
// TO-SUSPENSE), the legacy FX posting path used a `default → USD slot` fallback:
// ANY non-ZAR/USD foreign currency (GBP/CHF/AUD/EUR/JPY) was SILENTLY mis-booked
// into the USD trading accounts (ACC-2100-002 receivable / ACC-2100-004 payable).
// 66 SIMULATED FX trades (119 legs) sit on the USD accounts in a foreign
// currency. The USD account is USD-ONLY — those legs do not belong there.
//
// ─── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────
// Append-only (Principle 1 — NO mutation, NO SQL DELETE). For each mis-booked
// leg it emits ONE corrective `SubLedgerPostingEmitted` with postingType
// "sla-rebook-simulated-misbooking" carrying TWO legs in the SAME currency:
//   1. REVERSE the leg out of the USD account (opposite side, same amount) —
//      nets the USD-account foreign-currency balance to zero.
//   2. RE-BOOK the same amount/side into the resolver-correct PER-CURRENCY
//      account (ACC-2100-010..024) — accounts-first into the now-provisioned
//      home account.
// The pair balances within the foreign currency, so the institution-wide trial
// balance is undisturbed; only the account distribution is corrected.
//
// ─── PROVENANCE DISCIPLINE (hard constraint) ────────────────────────────────
// Scope is SIMULATED provenance ONLY — production and build-phase-fixture
// postings are NEVER touched. Each correction inherits the EXACT provenance tag
// (kind: "simulated" + scenario + sourceLineage) of the posting it corrects, so
// the correction lives in the same provenance plane as the original.
//
// ─── IDEMPOTENCY ────────────────────────────────────────────────────────────
// Keyed on `${correctsEventId}:${legIndex}`. A re-run skips any leg already
// corrected. Safe to run repeatedly.
//
// ─── HOW SCROOGE RUNS IT (post-merge, live home store) ──────────────────────
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run prototype/scripts/rebook-simulated-fx-misbookings.ts
//   (add --apply to mutate; default is a DRY-RUN that prints the plan and
//    mutates nothing.)
//
// Authority:
//   D-SLA-REBOOK-SIMULATED-MISBOOKINGS (CFO-approved)
//   D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING (CFO-approved 2026-06-05)
//   D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05)
//   IFRS 9 §5.7.1 (FVTPL); IAS 21 §23; Principles/1-events-are-truth.md;
//   Principles/5-multi-currency-entity-country.md
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import type { SubLedgerLeg } from "../platform/accounting/fx-accounting-types";
import { defaultResolver } from "../platform/accounting/sla/resolver";
import { eventStore } from "../platform/composition";
import { makeSubLedgerPostingEmitted } from "../platform/event-store/event-types/fx-accounting";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const JURISDICTION = "ZA";
const REPRESENTATION = "IFRS";
const PRODUCT = "FX-spot";

const ACTOR = {
  type: "service" as const,
  id: "agent:bea:rebook-simulated-fx-misbookings:D-SLA-REBOOK-SIMULATED-MISBOOKINGS",
};
const CITATIONS = [
  "D-SLA-REBOOK-SIMULATED-MISBOOKINGS",
  "D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING",
  "IFRS-9-§5.7.1",
  "IAS-21-§23",
  "Principles/1-events-are-truth.md",
  "Principles/5-multi-currency-entity-country.md",
];
const REBOOK_POSTING_TYPE = "sla-rebook-simulated-misbooking";

/** USD trading accounts — the silent-fallback slot the mis-bookings landed in. */
const USD_RECEIVABLE = "ACC-2100-002";
const USD_PAYABLE = "ACC-2100-004";

/** Logical account for each USD slot (so we re-resolve per the foreign currency). */
const USD_ACCOUNT_LOGICAL: Readonly<Record<string, string>> = {
  [USD_RECEIVABLE]: "fx.receivable",
  [USD_PAYABLE]: "fx.payable",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MisbookedLeg {
  readonly correctsEventId: string;
  readonly legIndex: number;
  readonly leg: SubLedgerLeg;
  readonly logical: string;
  /** The provenance tag to inherit (simulated). */
  readonly provenance: unknown;
}

// ---------------------------------------------------------------------------
// Discovery — find simulated foreign-currency legs sitting on the USD slot.
// ---------------------------------------------------------------------------

function provenanceKind(e: Event): string | undefined {
  return (e.provenance as { kind?: string } | undefined | null)?.kind;
}

/**
 * Resolve the correct per-currency physical account for a mis-booked leg.
 * Returns `undefined` when the resolver does not have a dedicated account for
 * the currency (it would route to suspense) — those are out of scope here:
 * the re-book only moves currencies that now HAVE a provisioned home account.
 */
export function resolveTargetAccount(logical: string, currency: string): string | undefined {
  const outcome = defaultResolver.resolve({
    entity: ENTITY,
    product: PRODUCT,
    currency,
    jurisdiction: JURISDICTION,
    representation: REPRESENTATION,
    logical,
  });
  return outcome.ok ? outcome.physical : undefined;
}

export function discoverMisbookedLegsFrom(events: Iterable<Event>): MisbookedLeg[] {
  const found: MisbookedLeg[] = [];
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    // Provenance discipline: SIMULATED ONLY. Never production / build-phase-fixture.
    if (provenanceKind(e) !== "simulated") continue;

    const payload = e.payload as {
      postingType?: string;
      legs?: SubLedgerLeg[];
    };
    // Only the booking-stage postings carry the trading receivable/payable legs.
    if (payload.postingType !== "trade-booking") continue;
    if (!Array.isArray(payload.legs)) continue;

    payload.legs.forEach((leg, legIndex) => {
      const isUsdSlot = leg.accountId === USD_RECEIVABLE || leg.accountId === USD_PAYABLE;
      if (!isUsdSlot) return;
      // A USD-currency leg on the USD slot is correct — leave it.
      if (leg.currency === "USD") return;
      const logical = USD_ACCOUNT_LOGICAL[leg.accountId];
      if (!logical) return;
      found.push({
        correctsEventId: e.event_id,
        legIndex,
        leg,
        logical,
        provenance: e.provenance,
      });
    });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Idempotency — which (correctsEventId:legIndex) are already re-booked.
// ---------------------------------------------------------------------------

export function alreadyRebookedKeysFrom(events: Iterable<Event>): Set<string> {
  const keys = new Set<string>();
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    const p = e.payload as { postingType?: string; correctsEventId?: string; legIndex?: number };
    if (p.postingType !== REBOOK_POSTING_TYPE) continue;
    if (typeof p.correctsEventId === "string" && typeof p.legIndex === "number") {
      keys.add(`${p.correctsEventId}:${p.legIndex}`);
    }
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Correction builder.
// ---------------------------------------------------------------------------

/**
 * Build the two-leg corrective posting for one mis-booked leg:
 *   - reverse the USD-account leg (opposite side, same amount/currency),
 *   - re-book the same amount/side into the per-currency target account.
 * Both legs share the foreign currency → balanced within currency.
 */
function buildCorrectionLegs(m: MisbookedLeg, target: string): SubLedgerLeg[] {
  const reverseSide = m.leg.debitCredit === "debit" ? "credit" : "debit";
  return [
    // (1) reverse out of the USD slot
    {
      accountId: m.leg.accountId,
      debitCredit: reverseSide,
      amountMinor: m.leg.amountMinor,
      currency: m.leg.currency,
    },
    // (2) re-book accounts-first into the per-currency home account
    {
      accountId: target,
      debitCredit: m.leg.debitCredit,
      amountMinor: m.leg.amountMinor,
      currency: m.leg.currency,
    },
  ];
}

export function buildCorrectionEvent(m: MisbookedLeg, target: string): Event {
  const legs = buildCorrectionLegs(m, target);
  const event = makeSubLedgerPostingEmitted({
    asOf: new Date().toISOString().slice(0, 10),
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      postingType: REBOOK_POSTING_TYPE,
      correctsEventId: m.correctsEventId,
      legIndex: m.legIndex,
      legs,
      postedAt: new Date().toISOString(),
      memo: `Re-books a SIMULATED FX mis-booking (D-SLA-REBOOK-SIMULATED-MISBOOKINGS): ${m.leg.currency} leg ${m.legIndex} of posting ${m.correctsEventId} was silently booked to the USD slot ${m.leg.accountId} by the legacy default→USD fallback. Reversed out of ${m.leg.accountId} and re-booked into the per-currency home account ${target} (${m.logical}, ${m.leg.currency}). USD account is USD-only.`,
    } as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
  });
  // Inherit the original posting's simulated provenance tag (same plane).
  return { ...event, provenance: m.provenance } as Event;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface RebookResult {
  readonly discovered: number;
  readonly emitted: number;
  readonly skipped: number;
  readonly outOfScope: number;
}

/**
 * Run the re-book. `apply: false` (default) is a DRY-RUN — it computes and logs
 * the plan but mutates NOTHING. `apply: true` appends the corrective postings.
 */
export function runRebook(opts: { apply: boolean }): RebookResult {
  const all = [...eventStore.replay({ type: "SubLedgerPostingEmitted" })];
  const misbooked = discoverMisbookedLegsFrom(all);
  const done = alreadyRebookedKeysFrom(all);

  let emitted = 0;
  let skipped = 0;
  let outOfScope = 0;

  for (const m of misbooked) {
    const key = `${m.correctsEventId}:${m.legIndex}`;
    if (done.has(key)) {
      skipped += 1;
      continue;
    }
    const target = resolveTargetAccount(m.logical, m.leg.currency);
    if (!target) {
      // No dedicated per-currency account (would route to suspense) — out of
      // scope for this corrective; flag loudly so it is never silently dropped.
      outOfScope += 1;
      logger.warn(
        { correctsEventId: m.correctsEventId, legIndex: m.legIndex, currency: m.leg.currency },
        "rebook-simulated-fx-misbookings: no dedicated account for currency — out of scope (would route to suspense)",
      );
      continue;
    }

    const event = buildCorrectionEvent(m, target);
    if (opts.apply) {
      eventStore.append(event);
    }
    emitted += 1;
    logger.info(
      {
        apply: opts.apply,
        correctsEventId: m.correctsEventId,
        legIndex: m.legIndex,
        currency: m.leg.currency,
        from: m.leg.accountId,
        to: target,
        amountMinor: m.leg.amountMinor,
      },
      opts.apply
        ? "rebook-simulated-fx-misbooking: emitted"
        : "rebook-simulated-fx-misbooking: DRY-RUN (would emit)",
    );
  }

  logger.info(
    { discovered: misbooked.length, emitted, skipped, outOfScope, apply: opts.apply },
    "rebook-simulated-fx-misbookings: done",
  );
  return { discovered: misbooked.length, emitted, skipped, outOfScope };
}

// Entry point — `--apply` mutates; default is a dry-run.
if (import.meta.main) {
  const apply = process.argv.includes("--apply");
  runRebook({ apply });
}
