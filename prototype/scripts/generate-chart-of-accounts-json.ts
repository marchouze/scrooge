// scripts/generate-chart-of-accounts-json.ts
//
// Generate `platform/accounting/chart-of-accounts.json` from the canonical
// typed CoA source (`v2-core/accounting/chart-of-accounts.ts COA_ACCOUNTS`).
//
// WHY THIS EXISTS (WS-ACCT-FX-COMPLETENESS Slice 1, D-ACCT-SCHEMA-CANONICAL-HOME)
// -----------------------------------------------------------------------------
// The CoA was dual-sourced: the typed Zod registry and this flat JSON drifted.
// The JSON is the seed `gl-projection.ts` reads (it needs `{id,name,category,
// side,currency?}` per account). Rather than retire it and rewrite the reader,
// the JSON is now GENERATED from the single canonical source so the two can
// never diverge again. `recon:accounting-schema-home` (assertion b) asserts the
// id sets are identical; this generator is what keeps them so.
//
// The generated JSON carries the lean reader-facing shape (id, name, category,
// side, currency?). The richer canonical fields (hqlaLevel, capitalTier, …) stay
// in the typed source — the JSON consumers do not read them.
//
// USAGE: bun run scripts/generate-chart-of-accounts-json.ts
//        (writes the file; idempotent — running twice produces the same bytes).
//
// Authority: D-ACCT-SCHEMA-CANONICAL-HOME (CEO-approved 2026-06-18).
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { COA_ACCOUNTS } from "../v2-core/accounting/chart-of-accounts.ts";

interface JsonAccount {
  id: string;
  name: string;
  currency?: string;
  category: string;
  side: "debit" | "credit";
}

function toJsonAccount(a: (typeof COA_ACCOUNTS)[number]): JsonAccount {
  // Field order mirrors the historical JSON shape (id, name, currency, category,
  // side) so the generated file is human-diff-friendly against prior versions.
  const out: JsonAccount = { id: a.id, name: a.name, category: a.category, side: a.side };
  if (a.currency !== undefined) {
    return { id: a.id, name: a.name, currency: a.currency, category: a.category, side: a.side };
  }
  return out;
}

export function generate(): string {
  const accounts = COA_ACCOUNTS.map(toJsonAccount);
  return `${JSON.stringify({ accounts }, null, 2)}\n`;
}

const OUT_PATH = resolve(import.meta.dir, "../platform/accounting/chart-of-accounts.json");

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  const json = generate();
  writeFileSync(OUT_PATH, json, "utf8");
  console.log(
    `✅ generated chart-of-accounts.json from canonical COA_ACCOUNTS (${COA_ACCOUNTS.length} accounts) → ${OUT_PATH}`,
  );
}
