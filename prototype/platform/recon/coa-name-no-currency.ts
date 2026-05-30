// platform/recon/coa-name-no-currency.ts
//
// Recon: coa-name-no-currency
//
// Asserts that no Chart-of-Accounts account NAME embeds a currency token or the
// wrong "(SARB" descriptor. Currency is a SEPARATE first-class dimension (the
// `currency` field on each COA entry), never part of the human-readable name.
//
// This makes D-COA-CURRENCY-DECOUPLING (CEO-approved 2026-05-30) non-regressable:
// the four defects Marc raised (mis-named SARB nostro; ZAR-as-base baked into
// names; currency tokens embedded in names; the same for FX/customer/suspense/
// settlement accounts) cannot silently creep back in.
//
// Sources scanned (both canonical COA forms):
//   - platform/accounting/coa-registry.ts  → COA_ACCOUNTS (typed registry)
//   - platform/accounting/chart-of-accounts.json → accounts[] (flat seed)
//
// Violation rules (applied to each account `name`):
//   1. Name must NOT match ` — (ZAR|USD|EUR|GBP|JPY|CHF|AUD|CNY)\b`
//      (a trailing/embedded currency token after an em-dash separator).
//   2. Name must NOT contain "(SARB"  (the SARB is a custodian Party, identified
//      by `custodianPartyId`, never named in an account title).
//
// Authority: D-COA-CURRENCY-DECOUPLING (CEO-approved 2026-05-30).
// Citations: Principle 5 (multi-currency from day one — reporting currency is
//            presentation, not data).
// Author: Bea (General Ledger Engineer, engineering).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { COA_ACCOUNTS } from "../accounting/coa-registry.ts";

const CURRENCY_TOKEN_RE = / — (ZAR|USD|EUR|GBP|JPY|CHF|AUD|CNY)\b/;
const SARB_DESCRIPTOR = "(SARB";

interface NamedAccount {
  readonly id: string;
  readonly name: string;
}

function nameViolations(accounts: readonly NamedAccount[], source: string): string[] {
  const violations: string[] = [];
  for (const acc of accounts) {
    if (CURRENCY_TOKEN_RE.test(acc.name)) {
      violations.push(
        `${source}: ${acc.id} name "${acc.name}" embeds a currency token — currency is a separate field, not part of the name (D-COA-CURRENCY-DECOUPLING).`,
      );
    }
    if (acc.name.includes(SARB_DESCRIPTOR)) {
      violations.push(
        `${source}: ${acc.id} name "${acc.name}" contains "(SARB" — the SARB is a custodian Party (custodianPartyId), never named in an account title (D-COA-CURRENCY-DECOUPLING).`,
      );
    }
  }
  return violations;
}

function loadJsonAccounts(): NamedAccount[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const jsonPath = resolve(here, "../accounting/chart-of-accounts.json");
  const parsed = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    accounts?: Array<{ id?: unknown; name?: unknown }>;
  };
  const accounts = parsed.accounts ?? [];
  return accounts
    .filter((a): a is { id: string; name: string } => typeof a.id === "string" && typeof a.name === "string")
    .map((a) => ({ id: a.id, name: a.name }));
}

export function main(): { violations: string[] } {
  const violations: string[] = [
    ...nameViolations(COA_ACCOUNTS, "coa-registry.ts"),
    ...nameViolations(loadJsonAccounts(), "chart-of-accounts.json"),
  ];
  return { violations };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const result = main();
  const total = result.violations.length;
  if (total > 0) {
    console.error(`\n❌ coa-name-no-currency: ${total} violation(s):\n`);
    for (const v of result.violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log("✅ coa-name-no-currency: no violations");
}
