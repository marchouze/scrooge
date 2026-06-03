// platform/recon/trade-lifecycle-parity.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE Phase D — all-product lifecycle
// coherence, generalising the FX-only fx-lifecycle-parity gate.
//
// Using the canonical registry-driven resolver (resolveTradeLifecycle), this
// asserts that every product's lifecycle instances are coherent:
//
//   - FAIL: an orphan terminal — a closure event (matured / settled / cancelled
//     / failed) whose opening event does not exist anywhere in the store. A
//     closure with no opening is a data-integrity break (a settlement/maturity
//     for a trade that was never booked).
//
// It also surfaces a per-product / per-state census (info) so the open vs
// closed population of every registered product is observable in one place.
//
// Authority: D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE;
//   TRADE_LIFECYCLE_REGISTRY. Author: Vera (internal audit engineer) / Scrooge.

import { eventStore } from "../composition";
import { TRADE_LIFECYCLE_REGISTRY } from "../lifecycle/trade-lifecycle-registry";
import { resolveTradeLifecycle } from "../lifecycle/trade-lifecycle-state";
import { type ReconResult, emptyResult } from "./types";

const PIPELINE = "recon:trade-lifecycle-parity";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const index = resolveTradeLifecycle([...eventStore.replay({})]);

  // Per-product / per-state census (info) + orphan-terminal detection (fail).
  const census = new Map<string, number>();
  for (const [instanceId, status] of index) {
    result.asserted += 1;
    census.set(
      `${status.productType}:${status.state}`,
      (census.get(`${status.productType}:${status.state}`) ?? 0) + 1,
    );
    if (status.state !== "live" && status.openingEventId === "") {
      result.violations.push({
        subject: `${status.lifecycleId}:${instanceId}`,
        message: `orphan terminal — instance is ${status.state} (${status.terminalPath ?? "?"}) but has no opening event in the store (a closure for a trade that was never booked)`,
        severity: "fail",
      });
    }
  }

  // Emit the census as info violations so it surfaces in the recon detail.
  for (const def of TRADE_LIFECYCLE_REGISTRY) {
    const states = ["live", "matured", "settled", "cancelled", "failed"] as const;
    const counts = states
      .map((s) => `${s}=${census.get(`${def.productType}:${s}`) ?? 0}`)
      .join(" ");
    const total = states.reduce((n, s) => n + (census.get(`${def.productType}:${s}`) ?? 0), 0);
    if (total > 0) {
      result.violations.push({
        subject: def.lifecycleId,
        message: `census: ${counts}`,
        severity: "info",
      });
    }
  }

  result.ok = result.violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — ${r.asserted} instance(s) across all products; no orphan terminals\n`,
    );
    for (const v of r.violations) {
      if (v.severity === "info") process.stdout.write(`  [info] ${v.subject}: ${v.message}\n`);
    }
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    if (v.severity === "fail") process.stderr.write(`  [fail] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
