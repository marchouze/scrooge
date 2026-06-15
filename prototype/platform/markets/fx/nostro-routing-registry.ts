// platform/markets/fx/nostro-routing-registry.ts
//
// Any-pair nostro designation substrate for OTC FX settlement routing.
//
// The OTC FX product scope v1.0 supports "any currency pair"
// (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL). For settlement routing to work
// on any pair, the substrate must:
//   (a) resolve the correct designated nostro account for every currency
//       we have a correspondent relationship for, AND
//   (b) FAIL-CLOSED — reject trades at the settlement-routing step with a
//       typed `NostroDesignationMissing` event when no nostro is designated.
//
// Fail-closed is the key requirement: suspense accounts hide settlement risk;
// explicit rejection surfaces it. A trade in an undesignated currency must
// NOT route to suspense — it must be visibly rejected so the ops team can
// either provision a correspondent nostro or decline the trade.
//
// The registry is seeded with all currencies for which we already have
// designated nostro accounts (matching FX_ACCOUNTS in fx-spot.ts). As new
// correspondent relationships are established, new entries are added here.
//
// Design intent (Principle 5 — multi-currency from day one): the nostro
// registry is data-driven. Adding a new currency requires only adding an
// entry to NOSTRO_REGISTRY — no code changes to the routing logic itself.
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase, 2026-06-08)
//   - Principle 4 (fail-closed by default)
//   - Principle 5 (multi-currency from day one)
// Author: Tomas (Operations and payments engineer, engineering)

import { FX_ACCOUNTS } from "../../accounting/posting-rules/fx-spot";

// ---------------------------------------------------------------------------
// Nostro designation entry
// ---------------------------------------------------------------------------

export interface NostroDesignationEntry {
  /** ISO 4217 currency code. */
  readonly currency: string;
  /**
   * Chart-of-accounts account ID of the designated correspondent nostro for
   * this currency (e.g. "ACC-1200-001" for ZAR).
   */
  readonly accountId: string;
  /**
   * Human-readable label for the correspondent bank / nostro account.
   * Informational only — the accountId is the routing key.
   */
  readonly label: string;
}

// ---------------------------------------------------------------------------
// NOSTRO_REGISTRY
//
// Seeded with all currencies for which we already have designated correspondent
// nostro accounts, matching the FX_ACCOUNTS constants in fx-spot.ts.
//
// To add a new currency correspondent relationship:
//   1. Provision the new ACC-* account in the chart-of-accounts.
//   2. Add the constant to FX_ACCOUNTS in fx-spot.ts.
//   3. Add an entry here.
//   4. The recon:fx-supported-currency-no-suspense gate will then require
//      the resolver to provision the new currency (no suspense routing).
//
// Authority: D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase, 2026-06-08)
// ---------------------------------------------------------------------------

export const NOSTRO_REGISTRY: readonly NostroDesignationEntry[] = [
  {
    currency: "ZAR",
    accountId: FX_ACCOUNTS.NOSTRO_ZAR,
    label: "ZAR correspondent nostro (domestic SARB settlement)",
  },
  {
    currency: "USD",
    accountId: FX_ACCOUNTS.NOSTRO_USD,
    label: "USD correspondent nostro (US dollar settlement)",
  },
  {
    currency: "EUR",
    accountId: FX_ACCOUNTS.NOSTRO_EUR,
    label: "EUR correspondent nostro (euro settlement)",
  },
  {
    currency: "GBP",
    accountId: FX_ACCOUNTS.NOSTRO_GBP,
    label: "GBP correspondent nostro (sterling settlement)",
  },
  {
    currency: "JPY",
    accountId: FX_ACCOUNTS.NOSTRO_JPY,
    label: "JPY correspondent nostro (yen settlement)",
  },
  {
    currency: "CHF",
    accountId: FX_ACCOUNTS.NOSTRO_CHF,
    label: "CHF correspondent nostro (Swiss franc settlement)",
  },
  {
    currency: "AUD",
    accountId: FX_ACCOUNTS.NOSTRO_AUD,
    label: "AUD correspondent nostro (Australian dollar settlement)",
  },
] as const;

// ---------------------------------------------------------------------------
// Index by currency code (built once at module load)
// ---------------------------------------------------------------------------

const _byCode = new Map<string, NostroDesignationEntry>(
  NOSTRO_REGISTRY.map((e) => [e.currency, e]),
);

// ---------------------------------------------------------------------------
// resolveNostroAccount
//
// The central routing function. Returns:
//   { ok: true, accountId, label }  — if a designated nostro exists.
//   { ok: false, reason }           — if no nostro is designated (FAIL-CLOSED).
//
// Callers MUST handle the ok:false case. When ok:false, the caller must:
//   1. Emit a NostroDesignationMissing event with the currency + reason.
//   2. Reject the trade at the settlement-routing step (do not route to suspense).
//   3. Notify ops (SubstrateAlert) so the gap can be closed.
//
// The function never throws — failures are typed results, not exceptions.
// ---------------------------------------------------------------------------

export type NostroResolutionResult =
  | { readonly ok: true; readonly accountId: string; readonly label: string }
  | { readonly ok: false; readonly reason: string };

export function resolveNostroAccount(currency: string): NostroResolutionResult {
  const entry = _byCode.get(currency);
  if (entry) {
    return { ok: true, accountId: entry.accountId, label: entry.label };
  }
  return {
    ok: false,
    reason: `no-designated-nostro: currency ${currency} has no designated correspondent nostro account in the registry. To support settlement in ${currency}, provision a correspondent nostro account and add it to the NOSTRO_REGISTRY in platform/markets/fx/nostro-routing-registry.ts.`,
  };
}

// ---------------------------------------------------------------------------
// designatedCurrencies
//
// Returns the set of currencies for which a nostro is designated.
// Useful for coverage checks and tests.
// ---------------------------------------------------------------------------

export function designatedCurrencies(): readonly string[] {
  return NOSTRO_REGISTRY.map((e) => e.currency);
}
