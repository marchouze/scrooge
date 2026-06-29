// platform/projections/gl-projection-v2.ts
//
// Phase 3A — V2 GL trial-balance projection (D-V1-REMOVAL-PHASE-3A, CEO-approved 2026-06-15).
//
// Reads GlPostingEmitted events (one event = one DR or CR leg) and folds them
// into the same TrialBalance shape that V1's computeTrialBalance returns. This
// enables the recon:gl-v2-parity gate to byte-compare the two paths.
//
// ## Design
//
// GlPostingEmitted is single-leg (unlike the V1 SubLedgerPostingEmitted which
// carries a legs[] array). Each event carries:
//   - accountCode: COA account ID
//   - creditDebit: "credit" | "debit"
//   - amount: MoneyWire (decimal-native; currency + amount string in major units)
//   - postingDate: ISO date (filters against periodStart..periodEnd window)
//
// The fold converts each amount to minor units via amountToMinorUnits (consistent
// with the V1 fold in computeTrialBalanceUncached). The sign convention is:
//   debit  → +minor (positive balance contribution)
//   credit → −minor (negative balance contribution)
//
// ## Output
//
// Returns a TrialBalance (same type as V1's computeTrialBalance). At Phase 3A
// only the FX sub-set has GlPostingEmitted events (PR-FX-001-V2, PR-FX-REVAL-V2,
// PR-FX-CLOSE-V2). Accounts where V1 posts but V2 doesn't → surfaced by the parity
// gate as advisory warnings. Accounts where BOTH post → byte-compared per
// (accountCode, currency) net balance.
//
// ## Caching
//
// Uses readWithOutputSnapshot (same pattern as the V1 computeTrialBalance) with
// stream key "gl-v2-trial-balance:<entity>:<periodStart>..<periodEnd>".
//
// ## Provenance
//
// Applies the same defaultProvenanceFilter as V1 (excludes simulated events from
// production trial-balance runs). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.
//
// Authority: D-V1-REMOVAL-PHASE-3A (CEO-approved 2026-06-15).
// Citations: IFRS-9-§3.1.1; IFRS-9-§5.7.1; IAS-21-§23; P1-EVENTS-AS-TRUTH.
// Author: Atlas (Substrate Architect, engineering).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type RateMap, convertMinor } from "../accounting/fx-rate-projection";
import type { TrialBalance } from "../accounting/period-close";
import { isCapitalSourcedGlPosting } from "../accounting/posting-rules-v2/capital-fold";
import { deriveCapitalInstanceLegs } from "../accounting/posting-rules-v2/capital-instance-fold";
import { deriveFxConversionLegs } from "../accounting/posting-rules-v2/fx-conversion-fold";
import { deriveFxInstanceLegs } from "../accounting/posting-rules-v2/fx-instance-fold";
import { type Money, amountToMinorUnits } from "../core/decimal-money";
import { type MoneyWire, legAmountMoney } from "../core/money-codec";
import type { TrialBalanceSnapshotRow } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import {
  type ProvenanceFilter,
  defaultProvenanceFilter,
  eventMatchesProvenanceFilter,
  provenanceFilterDigest,
} from "./filter";
import { readWithOutputSnapshot } from "./output-snapshot-cache";

// ---------------------------------------------------------------------------
// FX read-path separation (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD, 2026-06-17).
//
// The FX contribution to the V2 trial balance is now a PURE FOLD over the
// primary FIL instance events (FilInstrumentCreated/Amended/Terminated, FX)
// through the lifted FX posting rules — NOT the stored GlPostingEmitted event.
// Bond / money-market / capital accounts STILL come from GlPostingEmitted.
//
// To avoid double-counting if FX GlPostingEmitted events ever exist in the
// store (the dual-run engine can still emit them for other consumers), every
// GlPostingEmitted fold below SKIPS legs whose postingRuleId is an FX V2 rule
// id — those accounts are served by the FIL fold instead. Non-FX postingRuleIds
// (PR-CAP-*, bond, mm, …) fold from GlPostingEmitted exactly as before.
// ---------------------------------------------------------------------------

/** FX V2 posting-rule ids whose GlPostingEmitted legs are excluded (FX-fold owns them). */
const FX_V2_POSTING_RULE_ID_SET: ReadonlySet<string> = new Set([
  "PR-FX-001-V2",
  "PR-FX-REVAL-V2",
  "PR-FX-CLOSE-V2",
  // PR-FX-CONVERT-V2 (realisation) folds IN MEMORY via deriveFxConversionLegs
  // (D-FX-REALISATION-COMPLETION-V1) — exclude any materialised GlPostingEmitted to
  // avoid double-counting (belt-and-suspenders; the conversion emits no
  // GlPostingEmitted today).
  "PR-FX-CONVERT-V2",
]);

/** True iff a GlPostingEmitted leg was produced by an FX V2 posting rule. */
function isFxSourcedGlPosting(postingRuleId: string | undefined): boolean {
  return postingRuleId !== undefined && FX_V2_POSTING_RULE_ID_SET.has(postingRuleId);
}

// ---------------------------------------------------------------------------
// ComputeTrialBalanceV2Args — mirrors the V1 ComputeTrialBalanceArgs interface.
// ---------------------------------------------------------------------------

export interface ComputeTrialBalanceV2Args {
  readonly eventStore: EventStore;
  readonly entity: string;
  /** Inclusive start of the fold window. Convention: AccountingPeriodOpened.periodStart. */
  readonly periodStart: string;
  /** Inclusive end of the fold window. Convention: AccountingPeriodOpened.periodEnd. */
  readonly periodEnd: string;
  /**
   * Provenance lens for ALL three fold sources (GlPostingEmitted, the FX FIL fold,
   * and the capital FIL fold). Defaults to `defaultProvenanceFilter()` (the
   * operating-book read), preserving the existing read path AND the gl-v2-parity
   * gate (which calls the Uncached entry points with no filter). An oversight
   * surface supplies an explicit `{ mode: "production-only" | "combined" }` so the
   * simulated R300m capital injection is excluded under Prod (honest empty pre-
   * licence) and admitted under +Sim — the SAME lens the BA-700 capital view uses,
   * which is what makes the GL Share Capital balance agree with the BA-700 capital
   * numerator under the same lens (GL ⇿ BA-700 coherence,
   * D-V2-UI-VISIBILITY-REMEDIATION).
   */
  readonly filter?: ProvenanceFilter;
}

// ---------------------------------------------------------------------------
// GlPostingEmitted leg shape (inline type — avoids importing the full schema).
// ---------------------------------------------------------------------------

interface GlLeg {
  readonly accountCode: string;
  readonly creditDebit: "credit" | "debit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  /** The V2 posting rule that produced this leg — used to exclude FX-sourced legs. */
  readonly postingRuleId?: string;
}

// ---------------------------------------------------------------------------
// computeTrialBalanceV2Uncached — the pure fold over GlPostingEmitted events.
// ---------------------------------------------------------------------------

/**
 * Pure fold over GlPostingEmitted events for `entity` over [periodStart, periodEnd].
 *
 * Each GlPostingEmitted is one leg (DR or CR). The fold accumulates per-
 * (accountCode, currency) signed balances in minor units and derives the
 * per-currency debit/credit totals.
 *
 * Zero-balance accounts are dropped (consistent with the V1 fold).
 */
export function computeTrialBalanceV2Uncached(args: ComputeTrialBalanceV2Args): TrialBalance {
  // Per-(accountCode|currency) signed amount in minor units.
  // Sign convention: positive = debit balance; negative = credit balance.
  const balances = new Map<string, { account: string; currency: string; amount: number }>();
  let uptoSequence = 0;

  // Provenance lens — the caller's filter (oversight Prod / +Sim) or the
  // operating-book default. Authority: D-PROVENANCE-FILTER-ENFORCEMENT;
  // D-V2-UI-VISIBILITY-REMEDIATION (provenance-aware GL surface).
  const provenanceFilter = args.filter ?? defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlLeg;
    // FX and capital accounts now come from the FIL folds (below); skip FX- and
    // capital-sourced GlPostingEmitted to avoid double-counting. Non-FX/non-capital
    // (bond / money-market) legs still fold here exactly as before. Capital emits
    // no GlPostingEmitted today, so this is belt-and-suspenders against a future
    // capital GlPostingEmitted leg.
    if (isFxSourcedGlPosting(leg.postingRuleId)) continue;
    if (isCapitalSourcedGlPosting(leg.postingRuleId)) continue;
    // Date gate: filter against the posting period window.
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);

    // Increment count as sequence proxy (consistent with V1 which uses event count
    // as uptoSequence — "the same N events fold to the same TB").
    uptoSequence += 1;
  }

  // FX contribution — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveFxInstanceLegs`), NOT the raw-event fold. The two are proven
  // byte-equivalent by `recon:gl-v2-fold-equivalence-fx`, so the combined
  // TrialBalance stays byte-identical through this cutover; accounting now reads
  // FIL STATE (the register `stage`) rather than re-scanning the lifecycle stream.
  // Same provenance filter + posting-date window. The FX legs accumulate into the
  // same per-(accountCode,currency) balances map as the non-FX GlPostingEmitted
  // legs, so the combined TrialBalance shape is unchanged.
  // Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (Step C).
  const fxFold = deriveFxInstanceLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of fxFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);
    uptoSequence += 1;
  }

  // FX REALISATION contribution — the FCY→ZAR conversion legs (PR-FX-CONVERT-V2),
  // folded from the born-V2 `FxConversionExecuted` events (D-FX-REALISATION-
  // COMPLETION-V1, Item 2). These strike realised FX P&L (ACC-2100-006) +
  // reclassify cumulative unrealised (ACC-2100-005) — every leg in the reporting
  // currency, so the contribution self-balances per currency. Same provenance lens
  // + posting-date window as the FX fold above; the conversion folds in the SAME
  // partition as the FCY cash position it closes. This is the missing trigger
  // wiring that strikes realised P&L end-to-end (Nadia's Lane-4b residual).
  for (const leg of deriveFxConversionLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  })) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);
    uptoSequence += 1;
  }

  // Capital contribution — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveCapitalInstanceLegs`), NOT the raw-event fold. Proven byte-equivalent
  // to `foldCapitalContributionLegs` by `capital-instance-fold.test.ts` (incl. the
  // R300m CET1 injection + cancelled-capital), so the combined TrialBalance stays
  // byte-identical through this cutover; accounting now reads FIL STATE rather than
  // re-scanning the capital lifecycle stream. This still closes the GL ⇿ BA-700
  // coherence seam: the R300m fold-native injection (Dr settlement-cash / Cr Share
  // Capital) appears in the trial balance. Both legs derive so the balance stays in
  // balance. Same provenance filter + posting-date window as the FX derivation.
  // Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (capital cutover).
  const capitalFold = deriveCapitalInstanceLegs({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of capitalFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const key = `${leg.accountCode}|${leg.amount.currency}`;
    const row = balances.get(key) ?? {
      account: leg.accountCode,
      currency: leg.amount.currency,
      amount: 0,
    };
    row.amount += leg.creditDebit === "debit" ? legMinor : -legMinor;
    balances.set(key, row);
    uptoSequence += 1;
  }

  // Build sorted rows (drop zero-balance entries — consistent with V1).
  // TrialBalanceSnapshotRow shape: { leafAccountId, currency, amountMinor }
  // where amountMinor is signed: positive = debit balance, negative = credit balance.
  const rows: TrialBalanceSnapshotRow[] = [];

  for (const { account, currency, amount } of balances.values()) {
    if (amount === 0) continue;
    rows.push({ leafAccountId: account, currency, amountMinor: amount });
  }

  // Sort deterministically (leafAccountId, currency) — consistent with V1 sort.
  rows.sort((a, b) => {
    if (a.leafAccountId < b.leafAccountId) return -1;
    if (a.leafAccountId > b.leafAccountId) return 1;
    return a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0;
  });

  // Derive per-currency totals from the post-drop rows (consistent with V1).
  const totalsByCurrency = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const t = totalsByCurrency.get(row.currency) ?? { debit: 0, credit: 0 };
    if (row.amountMinor >= 0) t.debit += row.amountMinor;
    else t.credit += -row.amountMinor;
    totalsByCurrency.set(row.currency, t);
  }
  const perCurrencyTotals = [...totalsByCurrency.entries()]
    .map(([currency, t]) => ({ currency, debitMinor: t.debit, creditMinor: t.credit }))
    .sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));

  return { rows, perCurrencyTotals, uptoSequence };
}

// ---------------------------------------------------------------------------
// Functional-currency (IAS 21) trial-balance balancing.
//
// IAS 21 §21 records a foreign-currency transaction in the FUNCTIONAL currency at
// the transaction-date spot rate; the books balance in the FUNCTIONAL currency
// (ZAR for LE-ZA-HOZ-BANK). Per-currency NATIVE balancing (ΣDr == ΣCr within each
// currency's own minor units) is NOT an IFRS requirement — and is wrong for a
// genuine cross-currency transaction: a deliverable FX spot is Dr USD-cash /
// Cr ZAR-cash, which never balances in native minor units (USD cents ≠ ZAR cents;
// Principle 5) yet balances exactly once each leg is translated to ZAR at the
// transaction-date spot.
//
// `perCurrencyTotals` is RETAINED as a first-class Principle-5 sub-ledger DIMENSION
// (one running pair per currency; never summed across currencies) — it just stops
// being the BALANCING CONSTRAINT. The headline in-balance invariant is the
// functional-currency one below, aligned with `recon:gl-currency-dimension-
// integrity` (which already mandates asserting in-balance in the functional
// currency via explicit conversion) and the production `buildGlView` (whose
// `inBalance` flag is `zarTotalDebitMinor === zarTotalCreditMinor`).
//
// Rates are EVENT-SOURCED (Charter cmd 4 — source, don't hardcode): the caller
// supplies a `RateMap` built from the canonical FxTradeExecuted projection
// (`buildRateMap`), and conversion is exact via `convertMinor`. Honest on a missing
// rate (Charter cmd 2 — fail-closed): a currency with no conversion path is
// surfaced in `unconvertibleCurrencies` and the result is `balanced: false` (never
// a fake balanced zero by silently dropping the leg).
// Authority: D-GL-FUNCTIONAL-CURRENCY-BALANCING-V1 (CEO-approved 2026-06-29).
// ---------------------------------------------------------------------------

export interface FunctionalCurrencyBalance {
  /** True iff ΣDr(functional) == ΣCr(functional) AND every currency converted. */
  readonly balanced: boolean;
  /** Functional-currency (ZAR-equiv) total debits in minor units. */
  readonly functionalDebitMinor: number;
  /** Functional-currency (ZAR-equiv) total credits in minor units. */
  readonly functionalCreditMinor: number;
  /** Currencies whose totals could not be translated (no event-sourced rate path). */
  readonly unconvertibleCurrencies: readonly string[];
}

/**
 * Assert the trial balance is in balance in the FUNCTIONAL currency (IAS 21 §21).
 *
 * Converts each `perCurrencyTotals` entry to the functional currency via the
 * event-sourced `rateMap` and sums. The functional currency itself (default ZAR)
 * is the identity. Fail-closed: a currency with no conversion path makes the result
 * unbalanced and is listed in `unconvertibleCurrencies` — never silently dropped.
 *
 * Per-currency NATIVE totals remain available on `tb.perCurrencyTotals` as a
 * Principle-5 dimension; this function does NOT require them to self-balance.
 */
export function trialBalanceFunctionalCurrencyBalance(
  tb: TrialBalance,
  rateMap: RateMap,
  functionalCurrency = "ZAR",
): FunctionalCurrencyBalance {
  let functionalDebitMinor = 0;
  let functionalCreditMinor = 0;
  const unconvertibleCurrencies: string[] = [];

  for (const t of tb.perCurrencyTotals) {
    const dr = convertMinor(t.debitMinor, t.currency, functionalCurrency, rateMap);
    const cr = convertMinor(t.creditMinor, t.currency, functionalCurrency, rateMap);
    if (dr === null || cr === null) {
      unconvertibleCurrencies.push(t.currency);
      continue;
    }
    functionalDebitMinor += dr;
    functionalCreditMinor += cr;
  }

  const balanced =
    unconvertibleCurrencies.length === 0 && functionalDebitMinor === functionalCreditMinor;
  return { balanced, functionalDebitMinor, functionalCreditMinor, unconvertibleCurrencies };
}

// ---------------------------------------------------------------------------
// computeTrialBalanceV2 — cached entry point (mirrors V1 computeTrialBalance).
// ---------------------------------------------------------------------------

/**
 * Compute the V2 trial balance for `entity` over [periodStart, periodEnd].
 *
 * Uses the output-snapshot cache (same pattern as V1 computeTrialBalance)
 * with stream key "gl-v2-trial-balance:<entity>:<periodStart>..<periodEnd>".
 *
 * For parity gate use: call `computeTrialBalanceV2Uncached` directly to
 * bypass the cache and compare against V1's `computeTrialBalanceUncached`.
 */
export function computeTrialBalanceV2(args: ComputeTrialBalanceV2Args): TrialBalance {
  const { output } = readWithOutputSnapshot<TrialBalance>({
    store: args.eventStore,
    streamKey: glV2StreamKey("gl-v2-trial-balance", args),
    asOf: args.periodEnd,
    compute: () => computeTrialBalanceV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as TrialBalance,
  });
  return output;
}

// ---------------------------------------------------------------------------
// Cache stream-key helper — the filter digest is part of the key so a snapshot
// computed under one provenance lens never serves a request for another (a Prod
// snapshot must not paint the +Sim R300m injection). Omitting `filter` (the
// operating-book default path) yields the bare key, preserving existing snapshot
// rows + the parity gate (which uses the Uncached entry points, never cached).
// ---------------------------------------------------------------------------

function glV2StreamKey(prefix: string, args: ComputeTrialBalanceV2Args): string {
  const base = `${prefix}:${args.entity}:${args.periodStart}..${args.periodEnd}`;
  return args.filter ? `${base}#prov=${provenanceFilterDigest(args.filter)}` : base;
}

// ===========================================================================
// S5 (WS-V2-AUTHORITATIVE) — entry-level + account-master V2 projections.
//
// The trial-balance fold above answers "what is the net balance per account?".
// The dashboard's /api/gl/entries and /api/gl/accounts routes need two more
// shapes that the balance-only fold cannot serve:
//
//   computeGlEntriesV2   — individually-addressable ledger entries (one per
//                          GlPostingEmitted leg), matching the V1 GlLedgerEntry
//                          shape (/api/gl/entries).
//   computeGlAccountsV2  — account-master: per-account, per-currency balances
//                          with COA name/category metadata, matching the V1
//                          /api/gl/accounts shape.
//
// Both read the SAME GlPostingEmitted stream, apply the SAME provenance filter
// and posting-date window as the trial-balance fold, and resolve COA metadata
// from the SAME chart-of-accounts.json the V1 gl-projection uses — so the V2
// read path is a true equivalent of V1, not a parallel re-implementation with
// drift. Both are output-snapshot-cached (Charter cmd 7 — deterministic replay).
//
// Authority: D-BANK-WIDE-V2-MIGRATION + D-V2-AUTHORITATIVE-FLIP-PREREQS
//            (CEO-approved 2026-06-16); D-ENGINEERING-INTEGRITY-CHARTER;
//            brief:atlas:ws-v2-authoritative-s5-v2-gl-posting-engine-expa:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).
// ===========================================================================

// ---------------------------------------------------------------------------
// COA metadata loader — reads the SAME chart-of-accounts.json as the V1
// gl-projection (platform/accounting/chart-of-accounts.json), so account
// name / category / natural-side resolve identically across V1 and V2.
// ---------------------------------------------------------------------------

interface CoaEntryV2 {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly side: "debit" | "credit";
}

interface CoaFileV2 {
  readonly items?: readonly CoaEntryV2[];
  readonly accounts?: readonly CoaEntryV2[];
}

let _coaCacheV2: Map<string, CoaEntryV2> | null = null;

function loadCoaV2(): Map<string, CoaEntryV2> {
  if (_coaCacheV2) return _coaCacheV2;
  try {
    // The COA file is resident alongside the V1 gl-projection in platform/accounting.
    const filePath = join(import.meta.dir, "..", "accounting", "chart-of-accounts.json");
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as CoaFileV2;
    const entries: readonly CoaEntryV2[] = parsed.items ?? parsed.accounts ?? [];
    _coaCacheV2 = new Map(entries.map((e) => [e.id, e]));
  } catch {
    _coaCacheV2 = new Map();
  }
  return _coaCacheV2;
}

function getCoaEntryV2(accountId: string): CoaEntryV2 {
  const coa = loadCoaV2();
  return (
    coa.get(accountId) ?? {
      id: accountId,
      name: accountId,
      category: "unknown",
      side: "debit",
    }
  );
}

// ---------------------------------------------------------------------------
// Full GlPostingEmitted leg shape needed for entry-level projection.
// (The trial-balance fold only needed accountCode / creditDebit / amount /
// postingDate; the entry-level view also surfaces description + posting rule.)
// ---------------------------------------------------------------------------

interface GlPostingLegFull {
  readonly accountCode: string;
  readonly creditDebit: "credit" | "debit";
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly description?: string;
  readonly postingRuleId?: string;
  readonly sourceEventId?: string;
}

// ---------------------------------------------------------------------------
// computeGlEntriesV2 — entry-level ledger projection.
//
// Returns one GlLedgerEntryV2 per GlPostingEmitted leg in the window, matching
// the V1 GlLedgerEntry shape the /api/gl/entries route surfaces. Decimal-native
// amount is the source of truth; amountMinor is derived for the legacy view.
// ---------------------------------------------------------------------------

export interface GlLedgerEntryV2 {
  /** Source GlPostingEmitted event_id (individually addressable). */
  readonly eventId: string;
  /** Source event type — always GlPostingEmitted for the V2 path. */
  readonly source: "GlPostingEmitted";
  /** ISO date this posting was made (GlPostingEmitted.postingDate). */
  readonly postedAt: string;
  /** Human-readable description (from the posting payload). */
  readonly description: string;
  /** Account this leg belongs to. */
  readonly accountId: string;
  readonly accountName: string;
  readonly accountCategory: string;
  readonly debitCredit: "debit" | "credit";
  /** Amount in minor currency units (derived from the decimal amount). */
  readonly amountMinor: number;
  /** Amount as exact decimal Money — source of truth. */
  readonly amount: Money;
  /** ISO 4217 currency. */
  readonly currency: string;
  /** Originating instrument/source event the posting was derived from. */
  readonly sourceEventId?: string;
  /** The V2 posting rule that produced this leg (e.g. PR-FX-001-V2). */
  readonly postingRuleId?: string;
}

export function computeGlEntriesV2Uncached(args: ComputeTrialBalanceV2Args): GlLedgerEntryV2[] {
  const entries: GlLedgerEntryV2[] = [];
  const provenanceFilter = args.filter ?? defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlPostingLegFull;
    // FX + capital entries come from the FIL folds (below); skip FX- and
    // capital-sourced GlPostingEmitted.
    if (isFxSourcedGlPosting(leg.postingRuleId)) continue;
    if (isCapitalSourcedGlPosting(leg.postingRuleId)) continue;
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const coa = getCoaEntryV2(leg.accountCode);

    entries.push({
      eventId: e.event_id,
      source: "GlPostingEmitted",
      postedAt: leg.postingDate,
      description:
        typeof leg.description === "string" && leg.description.length > 0
          ? leg.description
          : `GL posting (${leg.postingRuleId ?? "V2"})`,
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      debitCredit: leg.creditDebit,
      amountMinor: legMinor,
      amount: legMoney,
      currency: leg.amount.currency,
      ...(typeof leg.sourceEventId === "string" ? { sourceEventId: leg.sourceEventId } : {}),
      ...(typeof leg.postingRuleId === "string" ? { postingRuleId: leg.postingRuleId } : {}),
    });
  }

  // FX entries — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveFxInstanceLegs`). Each derived leg preserves its per-leg `filEventId`
  // so the individually-addressable ledger entry remains sourced from the FIL
  // lifecycle event, byte-identical to the prior raw-event fold.
  // Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (Step C).
  const fxFold = deriveFxInstanceLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of fxFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const coa = getCoaEntryV2(leg.accountCode);
    entries.push({
      eventId: leg.filEventId,
      source: "GlPostingEmitted",
      postedAt: leg.postingDate,
      description: leg.description,
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      debitCredit: leg.creditDebit,
      amountMinor: legMinor,
      amount: legMoney,
      currency: leg.amount.currency,
      sourceEventId: leg.sourceEventId,
      postingRuleId: leg.postingRuleId,
    });
  }

  // FX REALISATION entries — the FCY→ZAR conversion legs (PR-FX-CONVERT-V2), folded
  // from the born-V2 `FxConversionExecuted` events (D-FX-REALISATION-COMPLETION-V1).
  // Each leg's source event is the converted cash instance (`leg.sourceEventId`);
  // there is no separate `filEventId`, so the ledger-entry `eventId` reuses the
  // source-event addressing (one entry per conversion leg).
  let conversionLegSeq = 0;
  for (const leg of deriveFxConversionLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  })) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const coa = getCoaEntryV2(leg.accountCode);
    entries.push({
      eventId: `${leg.sourceEventId}::fx-conversion-${conversionLegSeq}`,
      source: "GlPostingEmitted",
      postedAt: leg.postingDate,
      description: leg.description,
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      debitCredit: leg.creditDebit,
      amountMinor: legMinor,
      amount: legMoney,
      currency: leg.amount.currency,
      ...(typeof leg.sourceEventId === "string" ? { sourceEventId: leg.sourceEventId } : {}),
      ...(typeof leg.postingRuleId === "string" ? { postingRuleId: leg.postingRuleId } : {}),
    });
    conversionLegSeq += 1;
  }

  // Capital entries — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveCapitalInstanceLegs`), byte-equivalent to the prior raw-event fold.
  // Each derived leg (the Dr settlement-cash + Cr own-funds pair) is an
  // individually-addressable ledger entry preserving its source FIL `filEventId`
  // (GL ⇿ BA-700 coherence). Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.
  const capitalFold = deriveCapitalInstanceLegs({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of capitalFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    const coa = getCoaEntryV2(leg.accountCode);
    entries.push({
      eventId: leg.filEventId,
      source: "GlPostingEmitted",
      postedAt: leg.postingDate,
      description: leg.description,
      accountId: leg.accountCode,
      accountName: coa.name,
      accountCategory: coa.category,
      debitCredit: leg.creditDebit,
      amountMinor: legMinor,
      amount: legMoney,
      currency: leg.amount.currency,
      sourceEventId: leg.sourceEventId,
      postingRuleId: leg.postingRuleId,
    });
  }

  // Sort by postedAt ascending (consistent with V1 buildGlView).
  entries.sort((a, b) => a.postedAt.localeCompare(b.postedAt));
  return entries;
}

/**
 * Cached entry-level V2 ledger projection. Mirrors the V1 buildGlView
 * ledgerEntries shape for the /api/gl/entries route.
 */
export function computeGlEntriesV2(args: ComputeTrialBalanceV2Args): GlLedgerEntryV2[] {
  const { output } = readWithOutputSnapshot<GlLedgerEntryV2[]>({
    store: args.eventStore,
    streamKey: glV2StreamKey("gl-v2-entries", args),
    asOf: args.periodEnd,
    compute: () => computeGlEntriesV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as GlLedgerEntryV2[],
  });
  return output;
}

// ---------------------------------------------------------------------------
// computeGlAccountsV2 — account-master projection.
//
// Folds GlPostingEmitted legs into per-(account, currency) balances WITH COA
// name / category / natural-side metadata, matching the V1 /api/gl/accounts
// shape ({ accountId, name, category, balances: { [currency]: GlAccountBalance } }).
// ---------------------------------------------------------------------------

export interface GlAccountBalanceV2 {
  readonly accountId: string;
  readonly accountName: string;
  readonly accountCategory: string;
  readonly naturalSide: "debit" | "credit";
  /** Net balance in minor units (positive = balance on the account's natural side). */
  readonly balanceMinor: number;
  readonly totalDebitsMinor: number;
  readonly totalCreditsMinor: number;
}

export interface GlAccountMasterV2 {
  readonly accountId: string;
  readonly name: string;
  readonly category: string;
  /** Per-currency balances keyed by ISO 4217 code. */
  readonly balances: Record<string, GlAccountBalanceV2>;
}

/** Accumulate one (accountCode, creditDebit, minor, currency) leg into the account-master map. */
function accumulateAccountLeg(
  byAccount: Map<string, Map<string, GlAccountBalanceV2>>,
  accountCode: string,
  creditDebit: "debit" | "credit",
  legMinor: number,
  currency: string,
): void {
  const coa = getCoaEntryV2(accountCode);
  let byCurrency = byAccount.get(accountCode);
  if (!byCurrency) {
    byCurrency = new Map<string, GlAccountBalanceV2>();
    byAccount.set(accountCode, byCurrency);
  }
  const existing = byCurrency.get(currency);
  const bal: GlAccountBalanceV2 = existing ?? {
    accountId: accountCode,
    accountName: coa.name,
    accountCategory: coa.category,
    naturalSide: coa.side,
    balanceMinor: 0,
    totalDebitsMinor: 0,
    totalCreditsMinor: 0,
  };

  // GlAccountBalanceV2 is readonly; rebuild with the accumulated figures.
  const isDebit = creditDebit === "debit";
  const signedDelta = isDebit
    ? bal.naturalSide === "debit"
      ? legMinor
      : -legMinor
    : bal.naturalSide === "credit"
      ? legMinor
      : -legMinor;

  byCurrency.set(currency, {
    accountId: bal.accountId,
    accountName: bal.accountName,
    accountCategory: bal.accountCategory,
    naturalSide: bal.naturalSide,
    balanceMinor: bal.balanceMinor + signedDelta,
    totalDebitsMinor: bal.totalDebitsMinor + (isDebit ? legMinor : 0),
    totalCreditsMinor: bal.totalCreditsMinor + (isDebit ? 0 : legMinor),
  });
}

export function computeGlAccountsV2Uncached(args: ComputeTrialBalanceV2Args): GlAccountMasterV2[] {
  // Outer key: accountId; inner key: currency.
  const byAccount = new Map<string, Map<string, GlAccountBalanceV2>>();
  const provenanceFilter = args.filter ?? defaultProvenanceFilter();

  for (const e of args.eventStore.replay({
    entity: args.entity,
    type: "GlPostingEmitted",
  })) {
    if (!eventMatchesProvenanceFilter(e, provenanceFilter)) continue;

    const leg = e.payload as unknown as GlPostingLegFull;
    // FX + capital accounts come from the FIL folds (below); skip FX- and
    // capital-sourced GlPostingEmitted.
    if (isFxSourcedGlPosting(leg.postingRuleId)) continue;
    if (isCapitalSourcedGlPosting(leg.postingRuleId)) continue;
    if (!leg.postingDate) continue;
    if (leg.postingDate < args.periodStart || leg.postingDate > args.periodEnd) continue;

    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    accumulateAccountLeg(
      byAccount,
      leg.accountCode,
      leg.creditDebit,
      legMinor,
      leg.amount.currency,
    );
  }

  // FX accounts — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveFxInstanceLegs`), byte-equivalent to the prior raw-event fold.
  // Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (Step C).
  const fxFold = deriveFxInstanceLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of fxFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    accumulateAccountLeg(
      byAccount,
      leg.accountCode,
      leg.creditDebit,
      legMinor,
      leg.amount.currency,
    );
  }

  // FX REALISATION accounts — the FCY→ZAR conversion legs (PR-FX-CONVERT-V2), folded
  // from the born-V2 `FxConversionExecuted` events (D-FX-REALISATION-COMPLETION-V1).
  for (const leg of deriveFxConversionLegs({
    eventStore: args.eventStore,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  })) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    accumulateAccountLeg(
      byAccount,
      leg.accountCode,
      leg.creditDebit,
      legMinor,
      leg.amount.currency,
    );
  }

  // Capital accounts — STATE-DRIVEN derivation from the FIL instance register
  // (`deriveCapitalInstanceLegs`), byte-equivalent to the prior raw-event fold (Dr
  // settlement-cash / Cr own-funds). Closes the GL ⇿ BA-700 coherence seam in the
  // account-master view too. Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE.
  const capitalFold = deriveCapitalInstanceLegs({
    eventStore: args.eventStore,
    entity: args.entity,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    filter: provenanceFilter,
  });
  for (const leg of capitalFold.legs) {
    const legMoney = legAmountMoney({ amount: leg.amount, currency: leg.amount.currency });
    const legMinor = Number(amountToMinorUnits(legMoney));
    accumulateAccountLeg(
      byAccount,
      leg.accountCode,
      leg.creditDebit,
      legMinor,
      leg.amount.currency,
    );
  }

  const accounts: GlAccountMasterV2[] = [];
  for (const [accountId, byCurrency] of byAccount.entries()) {
    const balances: Record<string, GlAccountBalanceV2> = {};
    // Deterministic currency ordering for replay-stable output.
    const currencies = [...byCurrency.keys()].sort((a, b) => a.localeCompare(b));
    for (const ccy of currencies) {
      const b = byCurrency.get(ccy);
      if (b) balances[ccy] = b;
    }
    const first = byCurrency.get(currencies[0] ?? "");
    const coa = getCoaEntryV2(accountId);
    accounts.push({
      accountId,
      name: first?.accountName ?? coa.name,
      category: first?.accountCategory ?? coa.category,
      balances,
    });
  }

  accounts.sort((a, b) => a.accountId.localeCompare(b.accountId));
  return accounts;
}

/**
 * Cached account-master V2 projection. Mirrors the V1 /api/gl/accounts shape.
 */
export function computeGlAccountsV2(args: ComputeTrialBalanceV2Args): GlAccountMasterV2[] {
  const { output } = readWithOutputSnapshot<GlAccountMasterV2[]>({
    store: args.eventStore,
    streamKey: glV2StreamKey("gl-v2-accounts", args),
    asOf: args.periodEnd,
    compute: () => computeGlAccountsV2Uncached(args),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as GlAccountMasterV2[],
  });
  return output;
}
