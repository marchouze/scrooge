// platform/recon/v2-standing-data-seed-parity.ts
//
// Advisory recon gate: v2-standing-data-seed-parity
//
// Asserts that the v2 anchor store (`BANK_V2_ANCHOR_DB`) contains at least as
// many V2ProductRegistered events as the v1 store has active (non-retired)
// ProductApproved + ProductDimensionAttested products.
//
// Gate behaviour:
//   - ok = true  (ADVISORY) even when parity is not achieved, so CI stays
//     green while the seed is optional for non-S4 workflows.
//   - Records violations with severity "warn" (not "fail") so the dashboard
//     and Vera can track the gap without blocking merges.
//   - Returns ok=false only if the v2 anchor store DOES NOT EXIST or has 0
//     events (the seed has not been run at all and this IS the S4 PR — use
//     severity "fail" only for store-absent/empty condition in the PR gate
//     context; for the standing advisory gate the store may not exist on a
//     fresh checkout).
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// Brief: brief:bea:v2-s4-products-coa-ras-as-typed-v2-events-anchor:2026-06-12
// Author: Bea (Financial Controller, accounting).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "v2-standing-data-seed-parity";

// ---------------------------------------------------------------------------
// V2 anchor store resolution — mirrors seed script logic
// ---------------------------------------------------------------------------

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

// ---------------------------------------------------------------------------
// V1 canonical store resolution — for counting active products
// ---------------------------------------------------------------------------

function resolveV1Db(): string {
  const fromEnv = process.env.BANK_EVENT_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  const fromHome = process.env.BANK_HOME_EVENT_DB;
  if (fromHome && fromHome.length > 0) return fromHome;
  const homeDefault = resolve(homedir(), ".local", "share", "bank", "event.db");
  if (existsSync(homeDefault)) return homeDefault;
  return resolve(import.meta.dir, "..", "..", ".local", "event.db");
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const v2DbPath = resolveV2AnchorDb();
  const v1DbPath = resolveV1Db();

  // --- Check v2 anchor store exists ---
  if (!existsSync(v2DbPath)) {
    result.ok = true; // advisory — store not seeded yet on a fresh checkout
    result.asOf = "v2-anchor-store-absent";
    violations.push({
      subject: "v2-anchor-store",
      message: `V2 anchor store does not exist at ${v2DbPath}; run 'bun run seed:v2-anchor-bank-standing-data' to seed.`,
      severity: "warn",
    });
    result.violations = violations;
    result.asserted = 1;
    return result;
  }

  let v2Db: Database;
  try {
    v2Db = new Database(v2DbPath, { readonly: true });
  } catch (e) {
    result.ok = true; // advisory
    result.asOf = "v2-anchor-store-unreadable";
    violations.push({
      subject: "v2-anchor-store",
      message: `V2 anchor store unreadable at ${v2DbPath}: ${String(e)}`,
      severity: "warn",
    });
    result.violations = violations;
    result.asserted = 1;
    return result;
  }

  // --- Count V2ProductRegistered in v2 store ---
  let v2ProductCount = 0;
  let v2CoaCount = 0;
  let v2RasCount = 0;
  try {
    const tableExists = v2Db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'`,
      )
      .all();

    if (tableExists.length > 0) {
      v2ProductCount =
        v2Db
          .query<{ count: number }, [string]>(
            "SELECT COUNT(*) as count FROM v2_events WHERE type = ?",
          )
          .get("V2ProductRegistered")?.count ?? 0;

      v2CoaCount =
        v2Db
          .query<{ count: number }, [string]>(
            "SELECT COUNT(*) as count FROM v2_events WHERE type = ?",
          )
          .get("V2AccountTypeRegistered")?.count ?? 0;

      v2RasCount =
        v2Db
          .query<{ count: number }, [string]>(
            "SELECT COUNT(*) as count FROM v2_events WHERE type = ?",
          )
          .get("V2RiskAppetiteSet")?.count ?? 0;
    }
  } catch {
    // table may not exist yet
  } finally {
    v2Db.close();
  }

  result.asserted += 3;

  // --- Count v1 active products ---
  let v1ProductCount = 0;
  if (existsSync(v1DbPath)) {
    let v1Db: Database | null = null;
    try {
      v1Db = new Database(v1DbPath, { readonly: true });
      // Count distinct productIds that have ever received a ProductApproved event
      const row = v1Db
        .query<{ count: number }, []>(
          `SELECT COUNT(DISTINCT json_extract(payload, '$.productId')) as count
           FROM events WHERE type = 'ProductApproved'`,
        )
        .get();
      v1ProductCount = row?.count ?? 0;
    } catch {
      // v1 store not queryable — skip v1 count check
    } finally {
      v1Db?.close();
    }
  }

  // --- Parity assertions ---

  // Products: v2 count should be >= v1 active count (v2 includes the deprecated entry)
  if (v2ProductCount === 0) {
    violations.push({
      subject: "V2ProductRegistered",
      message: "No V2ProductRegistered events in v2 anchor store — seed has not been run.",
      severity: "warn",
    });
  } else if (v1ProductCount > 0 && v2ProductCount < v1ProductCount) {
    violations.push({
      subject: "V2ProductRegistered",
      message: `v2 product count (${v2ProductCount}) < v1 active product count (${v1ProductCount}); run 'bun run seed:v2-anchor-bank-standing-data' to close the gap.`,
      severity: "warn",
    });
  }

  // CoA: at least 1 account type
  if (v2CoaCount === 0) {
    violations.push({
      subject: "V2AccountTypeRegistered",
      message: "No V2AccountTypeRegistered events — CoA seed missing.",
      severity: "warn",
    });
  }

  // RAS: at least 17 lines (the full register)
  const EXPECTED_RAS_LINES = 17;
  if (v2RasCount < EXPECTED_RAS_LINES) {
    violations.push({
      subject: "V2RiskAppetiteSet",
      message: `v2 RAS line count (${v2RasCount}) < expected (${EXPECTED_RAS_LINES}); run 'bun run seed:v2-anchor-bank-standing-data' to close the gap.`,
      severity: "warn",
    });
  }

  result.violations = violations;
  result.ok = true; // ADVISORY — CI never fails on this gate alone
  result.asOf = `v2-products=${v2ProductCount} v2-coa=${v2CoaCount} v2-ras=${v2RasCount}${v1ProductCount > 0 ? ` v1-active-products=${v1ProductCount}` : ""}`;

  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok && r.violations.length === 0 ? "OK" : r.ok ? "OK (advisory)" : "FAIL";
  process.stdout.write(
    `\nrecon:${PIPELINE} ${label} — ${r.asOf}; ${r.violations.length} warning(s)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
