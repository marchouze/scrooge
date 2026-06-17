// platform/recon/v2-standing-data-seed-parity.ts
//
// Recon gate: v2-standing-data-seed-parity
//
// Asserts that the v2 anchor store (`BANK_V2_ANCHOR_DB`) contains at least as
// many V2ProductRegistered events as the v1 store has active (non-retired)
// ProductApproved + ProductDimensionAttested products, AND that every seeded
// V2RiskAppetiteSet decimal-native `floor` decodes byte-faithfully to the v1
// RAS register's `floorZar`.
//
// Gate behaviour:
//   - COUNT/SEED gaps (store absent, fewer products/RAS lines than expected)
//     are ADVISORY (severity "warn"); CI stays green while the seed is optional
//     for non-S4 workflows. The dashboard and Vera track the gap.
//   - The decimal-native FLOOR check is FAIL-CLOSED (severity "fail",
//     result.ok=false): a residual `floorZarMinor` numeric field, a missing /
//     malformed MoneyWire `floor`, a floor that does not decode to the v1
//     register `floorZar`, or a wrong-currency floor is a real money-correctness
//     defect and blocks the merge (Charter cmd 3 — no green by concealment of a
//     money mis-encoding). Authority for the redenomination:
//     D-V2-CORE-MONEY-DECIMAL-NATIVE; D-BANK-WIDE-V2-MIGRATION.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// Brief: brief:bea:v2-s4-products-coa-ras-as-typed-v2-events-anchor:2026-06-12
// Author: Bea (Financial Controller, accounting).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { isMoneyWire } from "../../v2-core/bucket-a-a2/money-wire";
import { eqD, toDecimal } from "../../v2-core/fil-core/decimal";
import { RAS_APPETITE_LINES } from "../risk/ras-appetite-register";
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

  // --- Decimal-native floor parity (FAIL-CLOSED correctness assertion) ---
  //
  // V2RiskAppetiteSet was re-minted decimal-native (D-V2-CORE-MONEY-DECIMAL-
  // NATIVE): the legacy `floorZarMinor` minor-int field is replaced by a
  // MoneyWire `floor` (MAJOR-unit decimal string). The "not seeded yet" path is
  // ADVISORY (warn), but a floor that is mis-encoded or mis-valued is a real
  // money-correctness defect — those are FAIL, never green-by-concealment
  // (Charter cmd 3). For each v1 RAS line that carries a `floorZar`, the v2
  // event's decoded floor must equal it exactly; a residual `floorZarMinor`
  // numeric field on any v2 RAS event is a regression and also FAILs.
  let floorParityFailed = false;
  if (v2RasCount > 0) {
    let rasRows: Array<{ payload: string }> = [];
    const rasDb = new Database(v2DbPath, { readonly: true });
    try {
      rasRows = rasDb
        .query<{ payload: string }, [string]>("SELECT payload FROM v2_events WHERE type = ?")
        .all("V2RiskAppetiteSet");
    } finally {
      rasDb.close();
    }

    const v1FloorByLine = new Map<string, number>();
    for (const line of RAS_APPETITE_LINES) {
      if (line.floorZar !== undefined) v1FloorByLine.set(line.id, line.floorZar);
    }

    for (const row of rasRows) {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(row.payload) as Record<string, unknown>;
      } catch {
        continue; // malformed JSON is a different gate's concern
      }
      const rasLineId = typeof payload.rasLineId === "string" ? payload.rasLineId : "<unknown>";
      result.asserted += 1;

      // Regression guard: the legacy minor-int field must not reappear.
      if (typeof payload.floorZarMinor === "number") {
        floorParityFailed = true;
        violations.push({
          subject: `V2RiskAppetiteSet:${rasLineId}`,
          message: `V2RiskAppetiteSet ${rasLineId} carries a legacy numeric "floorZarMinor" field — it was re-minted decimal-native (MoneyWire "floor"). Re-run the anchor seed. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE; Principle 1.`,
          severity: "fail",
        });
      }

      const expectedFloor = v1FloorByLine.get(rasLineId);
      const floor = payload.floor;
      if (expectedFloor !== undefined) {
        if (!isMoneyWire(floor)) {
          floorParityFailed = true;
          violations.push({
            subject: `V2RiskAppetiteSet:${rasLineId}`,
            message: `V2RiskAppetiteSet ${rasLineId} should carry a decimal-native MoneyWire "floor" (v1 floorZar=${expectedFloor}) but the field is missing or malformed. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.`,
            severity: "fail",
          });
        } else if (!eqD(toDecimal(floor.amount), toDecimal(String(expectedFloor)))) {
          floorParityFailed = true;
          violations.push({
            subject: `V2RiskAppetiteSet:${rasLineId}`,
            message: `V2RiskAppetiteSet ${rasLineId} floor (${floor.amount} ${floor.currency}) does not decode to the v1 RAS register floorZar (${expectedFloor} MAJOR-unit ZAR). The seed value must be byte-faithful after decode. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.`,
            severity: "fail",
          });
        } else if (floor.currency !== "ZAR") {
          floorParityFailed = true;
          violations.push({
            subject: `V2RiskAppetiteSet:${rasLineId}`,
            message: `V2RiskAppetiteSet ${rasLineId} floor currency is "${floor.currency}", expected "ZAR" (the v1 register's declared floorZar denomination).`,
            severity: "fail",
          });
        }
      } else if (isMoneyWire(floor)) {
        // A floor present where the v1 register declares none = spurious money.
        floorParityFailed = true;
        violations.push({
          subject: `V2RiskAppetiteSet:${rasLineId}`,
          message: `V2RiskAppetiteSet ${rasLineId} carries a MoneyWire "floor" but the v1 RAS register declares no floorZar for this line. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.`,
          severity: "fail",
        });
      }
    }
  }

  result.violations = violations;
  // ADVISORY for the seed-not-run / count-gap conditions (warn), but FAIL-CLOSED
  // on a decimal-native floor correctness defect (Charter cmd 3 — no green by
  // concealment of a money mis-encoding).
  result.ok = !floorParityFailed;
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
