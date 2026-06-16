// platform/recon/dashboard-v2-coverage.ts
//
// recon:dashboard-v2-coverage — ADVISORY gate (V1-removal Phase 4).
//
// Enumerates the dashboard read routes that have a V1↔V2 projection pairing and
// counts how many have a V2 read path wired (under the `useV2Store` flag) versus
// the total. Designed to become ENFORCING once every route is wired — at which
// point the V1-removal cutover can flip useV2Store ON by default and retire V1.
//
// Each route left V1-only carries an explicit `reason` — no silent gaps
// (Engineering Charter command 5; D-V1-REMOVAL-PHASE-4). The human-readable
// inventory lives alongside in dashboard-v2-coverage.notes.md; this gate is the
// machine-checkable counterpart.
//
// The wired/total split is asserted against the actual route handler source so
// the count cannot silently drift from reality: each "wired" entry names a
// marker string that MUST be present in its handler file, and each entry's
// handler file MUST exist. A wired entry whose marker is missing fails the gate
// (it would mean the inventory claims a V2 path that the code no longer has).
//
// Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "dashboard-v2-coverage";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_ROOT = resolve(HERE, "..", "..");

interface RouteEntry {
  /** HTTP route surfaced by the dashboard. */
  readonly route: string;
  /** Handler source file (relative to prototype root) that owns the read. */
  readonly handlerFile: string;
  /** Whether a V2 read path is wired under the useV2Store flag. */
  readonly v2Wired: boolean;
  /**
   * For wired routes: a marker substring that MUST appear in the handler file
   * (the V2 read call). Verified by the gate so the inventory cannot claim a
   * V2 path the code dropped. Empty for V1-only routes.
   */
  readonly wiredMarker: string;
  /** For V1-only routes: the honest reason it is not yet wired. */
  readonly reason: string;
}

// Single source of truth for the route inventory. Mirrors
// dashboard-v2-coverage.notes.md. Keep the two in sync.
const ROUTES: readonly RouteEntry[] = [
  {
    route: "GET /api/gl/trial-balance",
    handlerFile: "dashboard/gl-view.ts",
    v2Wired: true,
    wiredMarker: "computeTrialBalanceV2(",
    reason: "",
  },
  {
    route: "GET /api/gl/entries",
    handlerFile: "dashboard/gl-view.ts",
    v2Wired: false,
    wiredMarker: "",
    reason:
      "No V2 ledger-entry projection exists — the V2 GL fold (computeTrialBalanceV2) emits balance rows, not individually-addressable ledger entries.",
  },
  {
    route: "GET /api/gl/accounts",
    handlerFile: "dashboard/gl-view.ts",
    v2Wired: false,
    wiredMarker: "",
    reason:
      "V2 fold carries (accountCode, currency) balances but not the account-name/category metadata the V1 accounts view surfaces; needs a V2 account-master projection.",
  },
  {
    route: "GET /api/risk/market-risk-measure",
    handlerFile: "dashboard/server.ts",
    v2Wired: true,
    // promoteMarketRiskV2 re-points the headline VaR/SVaR/ES at the folded V2
    // `MarketRiskVarComputed` figure when useV2Store is ON (presentation-boundary
    // promotion; projection untouched). Authority: D-V1-REMOVAL-PHASE-4.
    wiredMarker: "promoteMarketRiskV2(",
    reason: "",
  },
  {
    route: "GET /api/product-control/daily-pnl",
    handlerFile: "dashboard/server.ts",
    v2Wired: true,
    // computeDailyPnLV2 (FilInstrumentCreated/Terminated FX → MarketDataSlice
    // valuation) returns the identical DailyPnLResult shape as V1 and is selected
    // at the route boundary under useV2Store. Authority: D-V1-REMOVAL-PHASE-4.
    wiredMarker: "computeDailyPnLV2(",
    reason: "",
  },
  {
    route: "capital metrics (home/treasury tiles, computeCapitalMetrics)",
    handlerFile: "dashboard/server.ts",
    v2Wired: false,
    wiredMarker: "",
    reason:
      "A V2 BA-700 projection (platform/projections/ba700-v2.ts, #1378) now exists, but at Phase 3e its capital numerator is structurally no-data (no capital-GL posting rules emit GlPostingEmitted yet — GAP-3E-001) and its output shape (BA700ReturnV2) differs from the CapitalMetrics tile shape. Promoting it under the flag would replace real V1 capital figures with zero — a regression, not an equivalent dual-read. Stays V1-only until capital-GL posting rules + a CapitalMetrics-shaped V2 adapter land.",
  },
  {
    route: "ALM positions / LCR / NSFR (treasury tiles, getALMPositionSnapshot)",
    handlerFile: "dashboard/server.ts",
    v2Wired: false,
    wiredMarker: "",
    reason:
      "Phase 3b (#1383) added V2 money-market lifecycle events and the recon:ba300-v2-parity gate folds them into LCR numerator/denominator, but no V2 projection produces the getALMPositionSnapshot shape (HQLA/funding/ASF/RSF position arrays) the treasury route consumes. Needs a snapshot-shaped V2 ALM projection before a route-boundary dual-read is possible.",
  },
  {
    route: "regulatory returns BA-700 / BA-320",
    handlerFile: "dashboard/server.ts",
    v2Wired: false,
    wiredMarker: "",
    reason:
      "V2 BA-700 (ba700-v2.ts, #1378) and BA-320 FX (ba320-fx-v2.ts, #1378) projections now exist and back recon:ba700-v2-parity / recon:ba320-fx-v2-parity, but no dashboard HTTP route surfaces a BA-700/BA-320 return today (the returns are generated by the BA-return generators, not served by a /api route). There is no route boundary to dual-read; this entry tracks the projection availability so the gap is explicit. BA-700 capital is additionally structurally no-data at Phase 3e (GAP-3E-001).",
  },
];

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  result.asserted = ROUTES.length;

  let wiredCount = 0;

  for (const entry of ROUTES) {
    const handlerPath = resolve(PROTOTYPE_ROOT, entry.handlerFile);

    // Every inventoried handler file must exist — a missing file means the
    // inventory has drifted from the route table.
    if (!existsSync(handlerPath)) {
      violations.push({
        subject: `handler-missing:${entry.route}`,
        message: `Handler file "${entry.handlerFile}" for route "${entry.route}" does not exist. The dashboard-v2-coverage inventory has drifted from the actual route table. Authority: D-V1-REMOVAL-PHASE-4.`,
        severity: "fail",
      });
      continue;
    }

    if (entry.v2Wired) {
      const src = readFileSync(handlerPath, "utf-8");
      if (!src.includes(entry.wiredMarker)) {
        // A wired entry whose V2 read call is gone is a real failure: the
        // inventory claims a V2 path that the code no longer has.
        violations.push({
          subject: `wired-marker-missing:${entry.route}`,
          message: `Route "${entry.route}" is marked v2Wired but its V2 read marker "${entry.wiredMarker}" is not present in "${entry.handlerFile}". Either the V2 read path was removed or the marker is stale. Authority: D-V1-REMOVAL-PHASE-4.`,
          severity: "fail",
        });
        continue;
      }
      wiredCount += 1;
    } else {
      // V1-only routes are advisory warnings carrying their explicit reason —
      // no silent gaps (Charter command 5).
      violations.push({
        subject: `v1-only:${entry.route}`,
        message: `Route "${entry.route}" is V1-only (no V2 read path wired). Reason: ${entry.reason}`,
        severity: "warn",
      });
    }
  }

  const total = ROUTES.length;
  const hardFail = violations.some((v) => v.severity === "fail");

  // ADVISORY: warn-only violations (V1-only routes) do NOT fail the gate. Only a
  // genuine drift (missing handler, or a wired marker that disappeared) fails.
  result.ok = !hardFail;
  result.violations = violations;
  result.asOf = `dashboard-v2-coverage [ADVISORY — Phase 4]: ${wiredCount}/${total} read routes wired to V2 under useV2Store. ${total - wiredCount} route(s) V1-only (each with a recorded reason — see warn violations and dashboard-v2-coverage.notes.md). Becomes enforcing once all routes are wired. Authority: D-V1-REMOVAL-PHASE-4.`;

  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const label = r.ok ? "OK (advisory — V1-only routes expected at Phase 4)" : "FAIL";
  process.stdout.write(`\nrecon:${PIPELINE} ${label}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
