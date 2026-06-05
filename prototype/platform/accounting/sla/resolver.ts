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
// Lookup precedence (spec §5.2):
//   1. Exact (entity, product, currency, jurisdiction, representation, logical).
//   2. Currency wildcard within the same (entity, product, jurisdiction,
//      representation, logical) — for genuinely multi-currency POOL accounts
//      only (e.g. the FCY pool ACC-2100-002 / ACC-2100-004, which COA marks
//      currency-OMITTED precisely because per-entry currency is authoritative).
//   3. NO silent default. A miss REJECTS LOUDLY (returns an error result the
//      interpreter surfaces as SubLedgerPostingRejected). This directly
//      retires the `default → RECEIVABLE_USD` fallbacks in fx-spot.ts, which
//      are documented Principle-5 blockers.
//
// Note on byte-for-byte parity (spec §3.2 / §11.3): the legacy
// `receivableAccountFor`/`payableAccountFor` switches mapped ZAR → the ZAR
// account and EVERY OTHER currency → the USD account (ACC-2100-002 / -004).
// That "USD slot" is, in the COA, the genuine multi-currency FCY POOL account
// (currency OMITTED). The resolver reproduces the legacy output EXACTLY by
// modelling ZAR as an exact row and all non-ZAR currencies as the
// currency-wildcard POOL row (precedence rule 2) — NOT as a silent default.
// A currency with neither an exact row nor a covering pool row rejects loudly.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Citations: Principles/5-multi-currency-entity-country.md.

import { type AccountId, isAccountId } from "./generated/sla-types";

// ---------------------------------------------------------------------------
// Row + key types
// ---------------------------------------------------------------------------

/** A single resolver row. `currency: "*"` marks a multi-currency pool row. */
export interface ResolverRow {
  readonly entity: string;
  readonly product: string;
  /** ISO-4217 code, or "*" for a multi-currency pool account. */
  readonly currency: string;
  readonly jurisdiction: string;
  readonly representation: string;
  readonly logical: string;
  readonly physical: AccountId;
  /** Free-text note (e.g. COA pool rationale). */
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
  | { ok: true; physical: AccountId; via: "exact" | "currency-pool" }
  | { ok: false; reason: "no-matching-row"; key: ResolverKey; candidates: number };

// ---------------------------------------------------------------------------
// Resolver table (IFRS representation only — Phase 1)
//
// FX-spot IFRS account map, reproducing the legacy FX_ACCOUNTS layout:
//   fx.receivable  ZAR  → ACC-2100-001 ; * (FCY pool) → ACC-2100-002
//   fx.payable     ZAR  → ACC-2100-003 ; * (FCY pool) → ACC-2100-004
// ACC-2100-002 / -004 are the COA multi-currency FCY pool accounts
// (currency OMITTED in coa-registry.ts — correct, not a gap).
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
    currency: "*",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.receivable",
    physical: "ACC-2100-002",
    note: "FCY multi-currency pool (COA currency OMITTED); per-entry currency authoritative.",
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
    currency: "*",
    jurisdiction: "ZA",
    representation: "IFRS",
    logical: "fx.payable",
    physical: "ACC-2100-004",
    note: "FCY multi-currency pool (COA currency OMITTED); per-entry currency authoritative.",
  },
];

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
   * Resolve a logical account ref to a physical COA leaf. Precedence:
   * exact match → currency-pool ("*") match → reject loudly. NEVER returns a
   * silent default.
   */
  resolve(key: ResolverKey): ResolveOutcome {
    const sameAxes = (r: ResolverRow): boolean =>
      r.entity === key.entity &&
      r.product === key.product &&
      r.jurisdiction === key.jurisdiction &&
      r.representation === key.representation &&
      r.logical === key.logical;

    // 1. exact currency
    const exact = this.rows.find((r) => sameAxes(r) && r.currency === key.currency);
    if (exact) return { ok: true, physical: exact.physical, via: "exact" };

    // 2. currency-pool wildcard
    const pool = this.rows.find((r) => sameAxes(r) && r.currency === "*");
    if (pool) return { ok: true, physical: pool.physical, via: "currency-pool" };

    // 3. reject loudly
    const candidates = this.rows.filter(sameAxes).length;
    return { ok: false, reason: "no-matching-row", key, candidates };
  }
}

/** The Phase-1 default resolver (IFRS FX-spot rows). */
export const defaultResolver = new AccountResolver(IFRS_FX_SPOT_RESOLVER_ROWS);
