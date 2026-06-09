// platform/recon/fx-supported-currency-no-suspense.ts
//
// recon:fx-supported-currency-no-suspense — Principle-5 per-currency COA gate.
//
// Two assertions, both over the SAME supported-currency universe:
//
//   (A) CONFIG (resolver-level). EVERY supported FX currency resolves each of
//       its per-currency FX logical accounts to a DEDICATED Chart-of-Accounts
//       leaf — never the FX unresolved-currency suspense (ACC-2100-007). In
//       steady state, no booking for a supported currency may land in suspense:
//       suspense routing is reserved for genuinely UNsupported currencies (the
//       permanent last-resort safety net under
//       D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE).
//
//   (B) STORE (ledger-level). The live FX unresolved-currency suspense account
//       (ACC-2100-007) must hold a ZERO net balance for every SUPPORTED
//       currency. A non-zero suspense balance in a supported currency means a
//       posting was stranded there — typically a runtime run that booked
//       against a resolver build pre-dating that currency's provisioning. The
//       config check (A) can be GREEN (the resolver now covers the currency)
//       while a stranded balance still sits in the ledger; (B) closes that gap.
//       Remediation: scripts/rebook-unresolved-currency-suspense.ts --apply.
//       Suspense balances in UNsupported currencies are left untouched (the
//       safety net is permitted to carry them).
//
// "Supported" is data-driven, not hardcoded: the supported currency set is
// derived from the live FX feed universe — the TwelveData target pairs
// (TWELVE_DATA_TARGET_PAIRS, the live ingest universe) plus the simulated
// seed-mid-rate pairs (SEED_MID_RATES). The union of every currency appearing
// on either leg of those pairs IS the supported set. As the feed universe grows,
// this gate automatically requires the new currency to be provisioned — it
// cannot silently regress to suspense.
//
// Per-currency FX logicals checked (each must resolve to a dedicated account for
// every supported currency):
//   - fx.receivable
//   - fx.payable
//   - fx.nostro
//   - fx.settlement_failed_receivable
//
// NOT checked per-currency (ZAR functional-currency only by design — IAS 21
// §23/§28): fx.unrealised_pnl (ZAR row), fx.realised_pnl, fx.ecl_allowance_*,
// fx.credit_loss_expense. These intentionally have a single ZAR home and are
// excluded from the per-currency assertion.
//
// The gate resolves through the production `defaultResolver` (the live SLA
// booking path), so it cannot drift from the interpreter's account resolution.
// The legacy posting-rule helpers (receivableAccountFor / payableAccountFor /
// nostroAccountFor / settlementFailedReceivableAccountFor in fx-spot.ts) carry
// the SAME per-currency mapping and are pinned to it by the interpreter tests.
//
// Authority: D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase,
//   2026-06-08); D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE (CEO-approved 2026-06-05).
// Citations: Principle 5 (multi-currency from day one — currency is data,
//   accounts are per-currency).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { fileURLToPath } from "node:url";

import { TWELVE_DATA_TARGET_PAIRS } from "../../scripts/agents/fx-twelvedata-parse.ts";
import { buildGlView } from "../accounting/gl-projection.ts";
import {
  FX_UNRESOLVED_CURRENCY_SUSPENSE,
  type ResolverKey,
  defaultResolver,
} from "../accounting/sla/resolver.ts";
import { eventStore } from "../composition.ts";
import type { Event } from "../event-store/types.ts";
import { SEED_MID_RATES_KEYS } from "../simulation/fx-sim-rates.ts";

const PIPELINE = "recon:fx-supported-currency-no-suspense";

/** Per-currency FX logicals that MUST resolve to a dedicated account for every
 *  supported currency (no suspense routing in steady state). */
const PER_CURRENCY_FX_LOGICALS = [
  "fx.receivable",
  "fx.payable",
  "fx.nostro",
  "fx.settlement_failed_receivable",
] as const;

const ENTITY = "LE-ZA-HOZ-BANK";
const PRODUCT = "FX-spot";
const JURISDICTION = "ZA";
const REPRESENTATION = "IFRS";

/**
 * Derive the supported FX currency set from the live feed universe + the
 * simulated seed pairs. Every currency on either leg of a target/seed pair is
 * supported. Data-driven — never a hardcoded literal.
 */
export function deriveSupportedCurrencies(): string[] {
  const set = new Set<string>();
  const ingestPair = (pair: string): void => {
    for (const ccy of pair.split("/")) {
      if (ccy) set.add(ccy);
    }
  };
  for (const pair of TWELVE_DATA_TARGET_PAIRS) ingestPair(pair);
  for (const pair of SEED_MID_RATES_KEYS) ingestPair(pair);
  return [...set].sort();
}

export interface Violation {
  readonly subject: string;
  readonly message: string;
}

export function main(): { violations: Violation[]; asserted: number } {
  const currencies = deriveSupportedCurrencies();
  const violations: Violation[] = [];
  let asserted = 0;

  for (const currency of currencies) {
    for (const logical of PER_CURRENCY_FX_LOGICALS) {
      asserted += 1;
      const key: ResolverKey = {
        entity: ENTITY,
        product: PRODUCT,
        currency,
        jurisdiction: JURISDICTION,
        representation: REPRESENTATION,
        logical,
      };
      const outcome = defaultResolver.resolve(key);
      if (!outcome.ok) {
        violations.push({
          subject: `${logical}:${currency}`,
          message: `supported currency ${currency} does NOT resolve ${logical} to a dedicated account (resolver returned '${outcome.reason}') — it would route to the FX unresolved-currency suspense (${FX_UNRESOLVED_CURRENCY_SUSPENSE}). A supported currency must never book to suspense in steady state (D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, Principle 5).`,
        });
        continue;
      }
      if (outcome.physical === FX_UNRESOLVED_CURRENCY_SUSPENSE) {
        violations.push({
          subject: `${logical}:${currency}`,
          message: `supported currency ${currency} resolves ${logical} to the FX unresolved-currency suspense (${FX_UNRESOLVED_CURRENCY_SUSPENSE}) — suspense is reserved for UNsupported currencies only (D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS, Principle 5).`,
        });
      }
    }
  }

  return { violations, asserted };
}

// ---------------------------------------------------------------------------
// (B) STORE-AWARE ASSERTION — no supported currency is stranded in suspense.
// ---------------------------------------------------------------------------

function fmtMinor(minor: number): string {
  return (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

/** Latest event as_of, or a fixed epoch when there are no events. */
function latestAsOf(events: readonly Event[]): string {
  let max = "1970-01-01T00:00:00.000Z";
  for (const e of events) {
    if (e.as_of > max) max = e.as_of;
  }
  return max;
}

/**
 * Assert that the FX unresolved-currency suspense (ACC-2100-007) holds a ZERO
 * net balance for every SUPPORTED currency. A non-zero balance in a supported
 * currency is a stranded posting (FAIL); balances in UNsupported currencies are
 * permitted (the safety net) and ignored.
 *
 * `events` may be injected for tests; otherwise the live shared store is read.
 */
export function storeAware(opts?: { events?: readonly Event[] }): {
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

  const supported = new Set(deriveSupportedCurrencies());
  const violations: Violation[] = [];
  const asOf = latestAsOf(events);
  const view = buildGlView(events, asOf);

  let asserted = 0;
  for (const row of view.trialBalance.entries) {
    if (row.accountId !== FX_UNRESOLVED_CURRENCY_SUSPENSE) continue;
    // Only assert supported currencies: an UNsupported currency legitimately
    // sits in suspense (the permanent last-resort safety net).
    if (!supported.has(row.currency)) continue;
    asserted += 1;
    const net = row.debitMinor - row.creditMinor;
    if (net !== 0) {
      violations.push({
        subject: `${FX_UNRESOLVED_CURRENCY_SUSPENSE}:${row.currency}`,
        message: `supported currency ${row.currency} holds a non-zero balance in the FX unresolved-currency suspense (${FX_UNRESOLVED_CURRENCY_SUSPENSE}): net ${net >= 0 ? "Dr" : "Cr"} ${fmtMinor(Math.abs(net))}. A supported currency must never be stranded in suspense once provisioned — re-book it to its dedicated per-currency account. Run scripts/rebook-unresolved-currency-suspense.ts --apply. Authority: D-SLA-RESOLVER-UNRESOLVED-TO-SUSPENSE; Principle 5.`,
      });
    }
  }

  return { violations, asserted };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const config = main();
  const store = storeAware();
  const violations = [...config.violations, ...store.violations];
  const asserted = config.asserted + store.asserted;
  if (violations.length > 0) {
    console.error(`\n❌ ${PIPELINE}: ${violations.length} violation(s) of ${asserted} asserted:\n`);
    for (const v of violations) console.error(`  - ${v.subject}: ${v.message}`);
    process.exit(1);
  }
  console.log(
    `✅ ${PIPELINE}: ${config.asserted} resolver resolutions + ${store.asserted} ledger suspense balance(s) checked — no supported currency routes to or is stranded in suspense`,
  );
}
