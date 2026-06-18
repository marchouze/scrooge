// platform/recon/cash-materialisation-integrity.ts
//
// recon:cash-materialisation-integrity — the Slice-3 fail-closed gate for the
// cash FIL asset class (D-CASH-ASSET-CLASS-V1).
//
// TWO INVARIANTS, both FAIL-CLOSED:
//
//   (A) ORIGIN BACK-REF — every `cash` asset-class FIL instance MUST carry a
//       non-empty `economicTerms.originatingInstrument` (the FIL instance URN of
//       the trade/leg that produced it). A cash holding with no originating
//       instrument is an ORPHAN node (Principle 2 violation) — there is nothing
//       to trace the cash back to. Fail.
//
//   (B) MATERIALISATION COMPLETENESS — every SETTLED FX instance whose governing
//       product (the FX OTC NPA) declares `maturityMaterialisation:
//       { materialisesAssetClass: "cash", onLifecycleStage: "settled" }` MUST
//       have at least one matching `cash` instance pointing back at it. A settled
//       FX trade under a cash-materialising NPA with NO successor cash instance
//       means the settlement path failed to run the product rule — the cash
//       holding is real but has no instrument of record (Principle 1). Fail.
//
// Both are non-vacuous on the anchor book (one settled USD fixture position →
// two materialised cash legs). On a flat bench with no settled FX they pass with
// an `info` note (nothing to assert) — the gate still ran.
//
// READ-ONLY: values nothing; asserts structural presence/linkage over the v2
// FIL-instance event stream only.
//
// BOUNDARY: V1-SIDE recon infrastructure (bun:sqlite / node:fs). MAY import
// v2-core (the permitted v1→v2 direction) + platform/markets (the product layer
// that declares the rule). v2-core never reaches back here.
//
// Authority: D-CASH-ASSET-CLASS-V1; prd:bank:fx:otc-vanilla;
//   D-FIL-FRAMEWORK-UNIFICATION; D-ENGINEERING-INTEGRITY-CHARTER (fail-closed);
//   Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import { type FilInstanceLifecycleEvent, foldFilInstances } from "../../v2-core";
import { resolveMaturityMaterialisation } from "../markets/products/maturity-materialisation";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "cash-materialisation-integrity";

// ---------------------------------------------------------------------------
// v2 anchor store resolution (mirrors fx-settlement-continuity.ts).
// ---------------------------------------------------------------------------

function resolveV2AnchorDb(): string {
  const fromEnv = process.env.BANK_V2_ANCHOR_DB;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  return resolve(homedir(), ".local", "share", "bank", "v2-anchor.db");
}

interface V2Row {
  type: string;
  payload: string;
}

function readFilInstanceEvents(dbPath = resolveV2AnchorDb()): FilInstanceLifecycleEvent[] {
  if (!existsSync(dbPath)) return [];
  let db: Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch {
    return [];
  }
  try {
    const tableExists = db
      .query<{ name: string }, []>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='v2_events'`,
      )
      .all();
    if (tableExists.length === 0) return [];
    const rows = db
      .query<V2Row, []>(
        `SELECT type, payload FROM v2_events
         WHERE type IN ('FilInstrumentCreated','FilInstrumentAmended','FilInstrumentTerminated')
         ORDER BY sequence ASC`,
      )
      .all();
    const events: FilInstanceLifecycleEvent[] = [];
    for (const r of rows) {
      const p = JSON.parse(r.payload) as Record<string, unknown>;
      events.push(p as unknown as FilInstanceLifecycleEvent);
    }
    return events;
  } finally {
    db.close();
  }
}

export interface RunOpts {
  /** Override the FIL instance event source — used by tests. */
  filEvents?: FilInstanceLifecycleEvent[];
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const filEvents = opts.filEvents ?? readFilInstanceEvents();
  const register = foldFilInstances(filEvents);

  // Index `cash` instances by their originating FX instance URN, and collect the
  // orphan check in the same pass.
  const cashByOrigin = new Map<string, number>();
  let cashInstances = 0;
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "cash") continue;
    cashInstances += 1;

    // (A) ORIGIN BACK-REF — fail-closed on any cash instance with no originating
    // instrument.
    const origin = row.economicTerms.originatingInstrument;
    result.asserted += 1;
    if (!origin || origin.length === 0) {
      violations.push({
        subject: `cash-orphan:${row.instance}`,
        message: `cash FIL instance ${row.instance} carries NO originatingInstrument back-ref — it is an orphan node (cannot trace the cash holding back to the trade that produced it). Principle 2 / fail-closed (D-CASH-ASSET-CLASS-V1).`,
        severity: "fail",
      });
      continue;
    }
    cashByOrigin.set(origin, (cashByOrigin.get(origin) ?? 0) + 1);
  }

  // (B) MATERIALISATION COMPLETENESS — every settled FX instance under a
  // cash-materialising NPA must have a matching cash instance.
  let settledFxUnderRule = 0;
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "fx") continue;
    if (row.stage !== "settled") continue;

    const rule = resolveMaturityMaterialisation(row.type);
    if (!rule || rule.materialisesAssetClass !== "cash") continue;
    if (rule.onLifecycleStage !== "settled") continue;

    settledFxUnderRule += 1;
    result.asserted += 1;
    const materialised = cashByOrigin.get(row.instance) ?? 0;
    if (materialised === 0) {
      violations.push({
        subject: `unmaterialised:${row.instance}`,
        message: `settled FX instance ${row.instance} is governed by a cash-materialising NPA (${rule.materialisesTypeUrn}) but has NO matching cash instance — the settlement path did not materialise the cash holding. Principle 1 / fail-closed (D-CASH-ASSET-CLASS-V1).`,
        severity: "fail",
      });
    }
  }

  if (cashInstances === 0 && settledFxUnderRule === 0) {
    violations.push({
      subject: "anchor-book",
      message:
        "no cash instances and no settled FX under a cash-materialising NPA in the v2 anchor store — nothing to assert (flat-bench info, not a failure).",
      severity: "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `cash-materialisation-integrity: ${cashInstances} cash instance(s) checked for origin back-ref; ${settledFxUnderRule} settled FX instance(s) under a cash-materialising NPA checked for completeness.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
