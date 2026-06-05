// platform/accounting/sla/resolver.ts
//
// Account resolver — the localisation layer (Phase-0 spec §5, Principle 5).
//
// Maps a LOGICAL account reference to a PHYSICAL chart-of-accounts leaf:
//
//   key   = (entity, product, currency, jurisdiction, representation, logical)
//   value = ACC-NNNN-NNN  (typed as the generated `AccountId` union)
//
// Resolver rows are data, validated against `coa-registry.ts` at module load
// (every physical target MUST be a real COA leaf — `isAccountId`).
//
// Lookup precedence (spec §5.2, as corrected by
// D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE, CEO-approved 2026-06-05):
//   1. PER-CURRENCY exact match on
//      (entity, product, currency, jurisdiction, representation, logical).
//      Each currency resolves to its OWN account. There is NO currency-wildcard
//      "pool" precedence — the FCY-pool framing was rejected: the USD account
//      (ACC-2100-002 / ACC-2100-004) is USD-ONLY, not a multi-currency pool.
//   2. On an account-resolution MISS — the (entity, product, jurisdiction,
//      representation, logical) axes are valid but no row covers the leg's
//      currency — the resolver returns a typed `unresolved-currency` outcome.
//      The interpreter turns this into a BALANCING posting to the FX
//      unresolved-currency suspense account (ACC-2100-007) PLUS a high-severity
//      urgent-correction SubstrateAlert. It is NEVER a silent USD fallback and
//      NEVER a dropped posting.
//   3. When there is no candidate row AT ALL for the logical/product/entity
//      axes (an unknown logical account, product, or entity — a genuine rule /
//      config bug), the resolver returns `no-matching-row`, which the
//      interpreter surfaces as the loud `SubLedgerPostingRejected` reject. This
//      is distinct from the currency miss in (2): a rule-shape bug must be
//      fixed by the rule author, not parked in suspense.
//
// Note on byte-for-byte parity (spec §3.2 / §11.3): the corrected resolver
// reproduces the legacy `receivableAccountFor`/`payableAccountFor` output
// EXACTLY for the two currencies the legacy engine books correctly — ZAR and
// USD. For every OTHER currency the legacy engine mis-booked to the USD slot
// (its `default → USD` fallback); the corrected resolver DELIBERATELY DIVERGES
// (own account if the COA has one, else suspense + urgent-correction alert).
// That divergence is the latent default-to-USD defect being fixed, not a
// regression — parallel-run parity now holds for ZAR/USD only, by design.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05);
//            D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Citations: Principles/5-multi-currency-entity-country.md.

import { type AccountId, isAccountId } from "./generated/sla-types";

// ---------------------------------------------------------------------------
// Row + key types
// ---------------------------------------------------------------------------

/**
 * A single resolver row. Each row is PER-CURRENCY — there is no currency
 * wildcard. (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE removed the `currency: "*"`
 * pool row.)
 */
export interface ResolverRow {
  readonly entity: string;
  readonly product: string;
  /** ISO-4217 code. */
  readonly currency: string;
  readonly jurisdiction: string;
  readonly representation: string;
  readonly logical: string;
  readonly physical: AccountId;
  /** Free-text note. */
  readonly note?: string;
}

export interface ResolverKey {
  readonly entity: string;
  readonly product: string;
  readonly currency: string;
  readonly jurisdiction: string;
  readonly representation: string;
  readonly logical: string;
}

export type ResolveOutcome =
  | { ok: true; physical: AccountId; via: "exact" }
  /**
   * Account-resolution miss: the (entity, product, jurisdiction,
   * representation, logical) axes ARE valid (at least one candidate row), but
   * no row covers `key.currency`. The interpreter routes this leg to the FX
   * unresolved-currency suspense account + raises an urgent-correction alert.
   * NOT a hard reject — the posting must still balance.
   */
  | { ok: false; reason: "unresolved-currency"; key: ResolverKey; candidates: number }
  /**
   * No candidate row at all for the logical/product/entity axes — an unknown
   * logical account / product / entity. A genuine rule/config bug: the
   * interpreter surfaces the loud `SubLedgerPostingRejected`. (NOT suspense.)
   */
  | { ok: false; reason: "no-matching-row"; key: ResolverKey; candidates: 0 };

// ---------------------------------------------------------------------------
// Resolver table (IFRS representation only — Phase 1)
//
// FX-spot IFRS account map, PER-CURRENCY (no pool rows):
//   fx.receivable  ZAR → ACC-2100-001 ; USD → ACC-2100-002
//   fx.payable     ZAR → ACC-2100-003 ; USD → ACC-2100-004
// ACC-2100-002 / -004 are USD-ONLY (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
// EUR/GBP/JPY/etc have NO dedicated FX-spot trading account today, so they
// account-resolution-miss → suspense (ACC-2100-007) + urgent-correction alert.
// ---------------------------------------------------------------------------

export const IFRS_FX_SPOT_RESOLVER_ROWS: readonly ResolverRow[] = [
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-001",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-002",
    note: "USD-only trading receivable (NOT an FCY pool).",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "ZAR",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-003",
  },
  {
    entity: "LE-ZA-HOZ-BANK",
    product: "FX-spot",
    currency: "USD",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-004",
    note: "USD-only trading payable (NOT an FCY pool).",
  },
];

/**
 * The dedicated FX unresolved-currency suspense account
 * (D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE). The interpreter posts an
 * account-resolution-miss leg here so the entry still balances, then raises a
 * high-severity urgent-correction alert. NOT a silent fallback: every posting
 * to this account is accompanied by a loud alert + recon finding.
 */
export const FX_UNRESOLVED_CURRENCY_SUSPENSE: AccountId = "ACC-2100-007";

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export class AccountResolver {
  private readonly rows: readonly ResolverRow[];

  constructor(rows: readonly ResolverRow[]) {
    // Validate every physical target is a real COA leaf at construction —
    // a typo or a retired account ID fails loudly here (and `physical` is
    // already typed `AccountId`, so the literal is also tsc-checked).
    for (const row of rows) {
      if (!isAccountId(row.physical)) {
        throw new Error(
          `AccountResolver: row (${row.logical}, ${row.currency}, ${row.representation}) ` +
            `targets unknown COA account '${row.physical}'`,
        );
      }
    }
    this.rows = rows;
  }

  /**
   * Resolve a logical account ref to a physical COA leaf. PER-CURRENCY only:
   *   - exact (entity, product, currency, jurisdiction, representation, logical)
   *     → ok.
   *   - valid axes but unmapped currency → `unresolved-currency` (interpreter
   *     routes to suspense + urgent-correction alert).
   *   - no candidate row for the axes at all → `no-matching-row` (loud reject).
   * NEVER returns a silent default; the USD account is reachable for USD only.
   */
  resolve(key: ResolverKey): ResolveOutcome {
    const sameAxes = (r: ResolverRow): boolean =>
      r.entity === key.entity &&
      r.product === key.product &&
      r.jurisdiction === key.jurisdiction &&
      r.representation === key.representation &&
      r.logical === key.logical;

    // 1. per-currency exact match
    const exact = this.rows.find((r) => sameAxes(r) && r.currency === key.currency);
    if (exact) return { ok: true, physical: exact.physical, via: "exact" };

    // 2./3. miss — classify by whether the logical/product/entity axes are valid
    const candidates = this.rows.filter(sameAxes).length;
    if (candidates > 0) {
      // valid axes, unmapped currency → account-resolution miss → suspense
      return { ok: false, reason: "unresolved-currency", key, candidates };
    }
    // unknown logical / product / entity → genuine rule/config bug → reject
    return { ok: false, reason: "no-matching-row", key, candidates: 0 };
  }
}

/** The Phase-1 default resolver (IFRS FX-spot rows). */
export const defaultResolver = new AccountResolver(IFRS_FX_SPOT_RESOLVER_ROWS);
