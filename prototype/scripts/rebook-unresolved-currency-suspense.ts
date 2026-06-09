// scripts/rebook-unresolved-currency-suspense.ts
//
// One-time, idempotent corrective re-book of FX-spot legs stranded in the FX
// unresolved-currency suspense account (ACC-2100-007) for currencies that NOW
// have a dedicated per-currency home account.
//
// ─── WHAT WENT WRONG ────────────────────────────────────────────────────────
// The SLA resolver correctly degrades a per-currency account-resolution miss to
// the FX unresolved-currency suspense (ACC-2100-007) + a high-severity
// integrity SubstrateAlert (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). An
// autonomous runtime run (2026-06-09T00:10:46Z) posted GBP and JPY FX-spot
// principal-payment (PR-FX-PRIN) nostro legs to suspense — the run executed
// against a resolver build that pre-dated the GBP/JPY/EUR/CHF/AUD per-currency
// provisioning (PR #1101, D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS). Those
// currencies now resolve to dedicated nostros (GBP → ACC-1200-004, JPY →
// ACC-1200-005), but the legs already booked to suspense remain stranded there
// and the two integrity alerts (alert:integrity:sla-unresolved-currency-{gbp,jpy})
// stay live until the suspense balance is cleared.
//
// ─── WHAT THIS SCRIPT DOES ──────────────────────────────────────────────────
// Append-only (Principle 1 — NO mutation, NO SQL DELETE). For each suspense leg
// whose currency now resolves to a dedicated account, it emits ONE corrective
// `SubLedgerPostingEmitted` (postingType "sla-rebook-unresolved-currency-
// suspense") carrying TWO legs in the SAME currency:
//   1. REVERSE the leg out of the suspense account ACC-2100-007 (opposite side,
//      same amount) — nets the suspense balance for that currency toward zero.
//   2. RE-BOOK the same amount/side into the resolver-correct per-currency home
//      account (the nostro the leg should have resolved to).
// The pair balances within the currency, so the institution-wide trial balance
// is undisturbed; only the account distribution is corrected.
//
// ─── PROVENANCE DISCIPLINE (hard constraint) ────────────────────────────────
// Each correction inherits the EXACT provenance tag of the posting it corrects
// (the stranded GBP/JPY legs are `simulated`), so the correction lives in the
// same provenance plane as the original. Production / build-phase-fixture legs
// are NEVER given a different plane.
//
// ─── SCOPE ──────────────────────────────────────────────────────────────────
// Only currencies that NOW resolve to a dedicated account are re-booked. A
// currency that still has no home account (genuinely unsupported) is left in
// suspense and flagged out-of-scope (never silently dropped) — suspense remains
// the permanent last-resort safety net for unsupported currencies.
//
// ─── IDEMPOTENCY ────────────────────────────────────────────────────────────
// Keyed on `${correctsEventId}:${legIndex}`. A re-run skips any leg whose
// correction already exists AND is aligned to the source posting's timestamp.
// Safe to run repeatedly; a second run emits 0.
//
// ─── TIMESTAMP ALIGNMENT + SUPERSEDE ────────────────────────────────────────
// The GL view drops legs whose `postedAt` is later than the live book's latest
// `as_of` (the `postedAt > asOf` cut-off). A correction stamped with wall-clock-
// now therefore never clears the GL-view suspense. The correction is instead
// stamped with the CORRECTED posting's own `postedAt` (`sourcePostedAt`) so it
// lands inside the window. A legacy correction emitted with a wall-clock (future)
// timestamp is detected as STALE and SUPERSEDED: the runner reverses it (carrying
// the SAME future timestamp, so the stale + reversal pair nets to zero in every
// view) and emits one source-aligned re-book that clears the GL-view suspense.
// Append-only throughout (Principle 1).
//
// ─── HOW SCROOGE RUNS IT (post-merge, live home store) ──────────────────────
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run prototype/scripts/rebook-unresolved-currency-suspense.ts
//   (add --apply to mutate; default is a DRY-RUN that prints the plan and
//    mutates nothing.)
//
// Authority:
//   D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05) — the
//     standing mandate: "add a dedicated per-currency account and re-book".
//   D-PROACTIVE-ESCALATION-SURFACING (CEO-approved 2026-06-09) — surfaced the
//     two integrity alerts from the autonomous runtime.
//   D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase 2026-06-08).
//   IFRS 9 §5.7.1 (FVTPL); IAS 21 §23; Principles/1-events-are-truth.md;
//   Principles/5-multi-currency-entity-country.md.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

// Opt into the shared HOME event-store BEFORE composition resolves its dbPath.
// BANK_EVENT_DB (set to a tmpdir in local/test runs) still wins over the home
// default, so this is safe: home-store on Scrooge's run, tmp on every dev run.
import "../platform/event-store/resolve-event-db-boot";

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
const JURISDICTION = "ZA";
const REPRESENTATION = "IFRS";
const PRODUCT = "FX-spot";

const ACTOR = {
  type: "service" as const,
  id: "agent:bea:rebook-unresolved-currency-suspense:D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
};
const CITATIONS = [
  "D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE",
  "D-PROACTIVE-ESCALATION-SURFACING",
  "D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS",
  "IFRS-9-§5.7.1",
  "IAS-21-§23",
  "Principles/1-events-are-truth.md",
  "Principles/5-multi-currency-entity-country.md",
];
const REBOOK_POSTING_TYPE = "sla-rebook-unresolved-currency-suspense";

/**
 * The logical account that PR-FX-PRIN routes through suspense on a per-currency
 * miss. PR-FX-PRIN is the sole production rule that books an FX-spot principal
 * cash leg, and the only leg it resolves per-currency to a potentially-missing
 * account is `fx.nostro` (fx.receivable / fx.payable carry their own dedicated
 * per-currency rows already). A stranded suspense leg is therefore a nostro leg
 * that missed; we re-resolve it as fx.nostro for its currency.
 */
const SUSPENSE_LOGICAL = "fx.nostro";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrandedLeg {
  readonly correctsEventId: string;
  readonly legIndex: number;
  readonly leg: SubLedgerLeg;
  /** The provenance tag to inherit. */
  readonly provenance: unknown;
  /**
   * The corrected posting's own timestamp (postedAt, falling back to as_of).
   * The correction is stamped with this value — NOT wall-clock-now — so it lands
   * in the same temporal window as the leg it corrects and is never future-dated
   * relative to the live book (a future `postedAt` is dropped by the GL view's
   * `postedAt > asOf` cut-off, which would leave the suspense balance uncleared).
   */
  readonly sourcePostedAt: string;
}

// ---------------------------------------------------------------------------
// Discovery — find legs sitting on the unresolved-currency suspense account.
// ---------------------------------------------------------------------------

export function discoverStrandedLegsFrom(events: Iterable<Event>): StrandedLeg[] {
  const found: StrandedLeg[] = [];
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;

    const payload = e.payload as {
      postingType?: string;
      legs?: SubLedgerLeg[];
      postedAt?: string;
    };
    // Never re-correct a correction (idempotency safety + avoids loops).
    if (payload.postingType === REBOOK_POSTING_TYPE) continue;
    if (!Array.isArray(payload.legs)) continue;

    const sourcePostedAt = typeof payload.postedAt === "string" ? payload.postedAt : e.as_of;

    payload.legs.forEach((leg, legIndex) => {
      if (leg.accountId !== FX_UNRESOLVED_CURRENCY_SUSPENSE) return;
      found.push({
        correctsEventId: e.event_id,
        legIndex,
        leg,
        provenance: e.provenance,
        sourcePostedAt,
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

/** A previously-emitted correction posting, indexed for supersede detection. */
export interface ExistingCorrection {
  readonly eventId: string;
  readonly correctsEventId: string;
  readonly legIndex: number;
  /** The correction's own postedAt (used to detect future-dating). */
  readonly postedAt: string;
  readonly legs: readonly SubLedgerLeg[];
  readonly provenance: unknown;
}

/**
 * Index existing correction postings by `${correctsEventId}:${legIndex}`. A
 * stranded leg may have at most one correction per key in the steady state; the
 * map holds whichever exist so the runner can decide skip vs. supersede.
 */
export function existingCorrectionsFrom(events: Iterable<Event>): Map<string, ExistingCorrection> {
  const out = new Map<string, ExistingCorrection>();
  for (const e of events) {
    if (e.type !== "SubLedgerPostingEmitted") continue;
    const p = e.payload as {
      postingType?: string;
      correctsEventId?: string;
      legIndex?: number;
      postedAt?: string;
      legs?: SubLedgerLeg[];
    };
    if (p.postingType !== REBOOK_POSTING_TYPE) continue;
    if (typeof p.correctsEventId !== "string" || typeof p.legIndex !== "number") continue;
    out.set(`${p.correctsEventId}:${p.legIndex}`, {
      eventId: e.event_id,
      correctsEventId: p.correctsEventId,
      legIndex: p.legIndex,
      postedAt: typeof p.postedAt === "string" ? p.postedAt : e.as_of,
      legs: Array.isArray(p.legs) ? p.legs : [],
      provenance: e.provenance,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Target resolution.
// ---------------------------------------------------------------------------

/**
 * Resolve the correct per-currency physical account for a stranded suspense
 * leg. Returns `undefined` when the resolver still has no dedicated account for
 * the currency (it would route back to suspense) — those are out of scope here.
 */
export function resolveTargetAccount(currency: string): string | undefined {
  const outcome = defaultResolver.resolve({
    entity: ENTITY,
    product: PRODUCT,
    currency,
    jurisdiction: JURISDICTION,
    representation: REPRESENTATION,
    logical: SUSPENSE_LOGICAL,
  });
  if (!outcome.ok) return undefined;
  if (outcome.physical === FX_UNRESOLVED_CURRENCY_SUSPENSE) return undefined;
  return outcome.physical;
}

// ---------------------------------------------------------------------------
// Correction builder.
// ---------------------------------------------------------------------------

/**
 * Build the two-leg corrective posting for one stranded leg:
 *   - reverse the suspense leg (opposite side, same amount/currency),
 *   - re-book the same amount/side into the per-currency target account.
 * Both legs share the currency → balanced within currency.
 */
function buildCorrectionLegs(m: StrandedLeg, target: string): SubLedgerLeg[] {
  const reverseSide = m.leg.debitCredit === "debit" ? "credit" : "debit";
  return [
    // (1) reverse out of the suspense account
    {
      accountId: m.leg.accountId,
      debitCredit: reverseSide,
      amountMinor: m.leg.amountMinor,
      currency: m.leg.currency,
    },
    // (2) re-book into the per-currency home account (same side as original)
    {
      accountId: target,
      debitCredit: m.leg.debitCredit,
      amountMinor: m.leg.amountMinor,
      currency: m.leg.currency,
    },
  ];
}

export function buildCorrectionEvent(m: StrandedLeg, target: string): Event {
  const legs = buildCorrectionLegs(m, target);
  // Stamp the correction with the corrected posting's own timestamp so it lands
  // in the same temporal window — never future-dated past the live book's
  // latest as_of (which the GL view's `postedAt > asOf` cut-off would drop,
  // leaving the suspense balance uncleared).
  const event = makeSubLedgerPostingEmitted({
    asOf: m.sourcePostedAt,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      postingType: REBOOK_POSTING_TYPE,
      correctsEventId: m.correctsEventId,
      legIndex: m.legIndex,
      legs,
      postedAt: m.sourcePostedAt,
      representation: REPRESENTATION,
      memo: `Re-books an FX-spot leg stranded in the unresolved-currency suspense (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE): the ${m.leg.currency} ${SUSPENSE_LOGICAL} leg ${m.legIndex} of posting ${m.correctsEventId} was routed to suspense ${FX_UNRESOLVED_CURRENCY_SUSPENSE} by a resolver build that pre-dated the ${m.leg.currency} per-currency provisioning. Reversed out of ${FX_UNRESOLVED_CURRENCY_SUSPENSE} and re-booked into the dedicated home account ${target} (${SUSPENSE_LOGICAL}, ${m.leg.currency}).`,
    } as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
  });
  // Inherit the original posting's provenance tag (same plane).
  return { ...event, provenance: m.provenance } as Event;
}

/**
 * Build a reversal that neutralises a STALE (future-dated) correction. The
 * stale correction's legs are mirrored (each side flipped) and stamped with the
 * STALE correction's own (future) postedAt, so the reversal stays paired with
 * the stale posting in EVERY view: both fall outside the live-book temporal
 * window (GL view postedAt>asOf cut-off) and net to zero together, while the
 * separately-emitted, source-aligned re-book (which IS inside the window) is the
 * one that clears suspense in the GL view. Raw + GL-view both reconcile.
 *
 * Used only to supersede the legacy wall-clock-dated corrections (see
 * `sourcePostedAt`); a fresh run never produces a stale correction, so this path
 * is empty in steady state.
 */
export function buildSupersedeReversalEvent(stale: ExistingCorrection, provenance: unknown): Event {
  const legs = stale.legs.map((l) => ({
    accountId: l.accountId,
    debitCredit: (l.debitCredit === "debit" ? "credit" : "debit") as "debit" | "credit",
    amountMinor: l.amountMinor,
    currency: l.currency,
  }));
  const event = makeSubLedgerPostingEmitted({
    asOf: stale.postedAt,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      postingType: REBOOK_POSTING_TYPE,
      correctsEventId: stale.eventId,
      legIndex: 0,
      legs,
      postedAt: stale.postedAt,
      representation: REPRESENTATION,
      memo: `Supersedes a future-dated unresolved-currency suspense re-book (${stale.eventId}, postedAt ${stale.postedAt}) whose timestamp fell outside the live book window (GL view postedAt>asOf cut-off, so it never cleared the GL-view suspense). Reverses the stale posting (same future timestamp → the pair nets to zero in every view); the source-aligned re-book that follows clears the GL-view suspense. Append-only (Principle 1).`,
    } as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
  });
  return { ...event, provenance } as Event;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export interface RebookResult {
  readonly discovered: number;
  readonly emitted: number;
  readonly skipped: number;
  readonly superseded: number;
  readonly outOfScope: number;
}

/**
 * Run the re-book. `apply: false` (default) is a DRY-RUN — it computes and logs
 * the plan but mutates NOTHING. `apply: true` appends the corrective postings.
 */
export function runRebook(opts: { apply: boolean }): RebookResult {
  const all = [...eventStore.replay({ type: "SubLedgerPostingEmitted" })];
  const stranded = discoverStrandedLegsFrom(all);
  const corrections = existingCorrectionsFrom(all);

  let emitted = 0;
  let skipped = 0;
  let superseded = 0;
  let outOfScope = 0;

  for (const m of stranded) {
    const key = `${m.correctsEventId}:${m.legIndex}`;
    const existing = corrections.get(key);

    // A correction already exists AND is aligned to the source posting's
    // timestamp → effective in the GL view → nothing to do.
    if (existing && existing.postedAt === m.sourcePostedAt) {
      skipped += 1;
      continue;
    }

    const target = resolveTargetAccount(m.leg.currency);
    if (!target) {
      // Still no dedicated account (genuinely unsupported currency) — out of
      // scope; flag loudly so it is never silently dropped.
      outOfScope += 1;
      logger.warn(
        { correctsEventId: m.correctsEventId, legIndex: m.legIndex, currency: m.leg.currency },
        "rebook-unresolved-currency-suspense: no dedicated account for currency — out of scope (would route back to suspense)",
      );
      continue;
    }

    // A STALE (future-dated) correction exists from an earlier wall-clock run:
    // reverse it first so the corrected, source-aligned re-book is not a
    // double-move. Append-only (Principle 1).
    if (existing) {
      const reversal = buildSupersedeReversalEvent(existing, m.provenance);
      if (opts.apply) eventStore.append(reversal);
      superseded += 1;
      logger.info(
        {
          apply: opts.apply,
          supersedes: existing.eventId,
          stalePostedAt: existing.postedAt,
          alignedPostedAt: m.sourcePostedAt,
        },
        opts.apply
          ? "rebook-unresolved-currency-suspense: superseded stale future-dated correction"
          : "rebook-unresolved-currency-suspense: DRY-RUN (would supersede stale correction)",
      );
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
        from: FX_UNRESOLVED_CURRENCY_SUSPENSE,
        to: target,
        amountMinor: m.leg.amountMinor,
      },
      opts.apply
        ? "rebook-unresolved-currency-suspense: emitted"
        : "rebook-unresolved-currency-suspense: DRY-RUN (would emit)",
    );
  }

  logger.info(
    { discovered: stranded.length, emitted, skipped, superseded, outOfScope, apply: opts.apply },
    "rebook-unresolved-currency-suspense: done",
  );
  return { discovered: stranded.length, emitted, skipped, superseded, outOfScope };
}

// Entry point — `--apply` mutates; default is a dry-run.
if (import.meta.main) {
  const apply = process.argv.includes("--apply");
  runRebook({ apply });
}
