// scripts/regulatory/golden-source-integrity-tick.ts
//
// Scheduled shared-store recon tick for golden-source integrity.
//
// WHY THIS EXISTS
// ---------------
// `recon:regulatory-golden-source-integrity` is a SHARED-STORE assertion, not
// a clean-CI gate (D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION). Golden-source
// bytes and the `goldenSourceHash` linkage live in the shared/home store BY
// DESIGN (Principle 1): the hash is never committed to git, and
// `data/documents/*` is gitignored. On a clean CI runner the regulatory graph
// is unseeded and the in-repo store has no blobs, so the gate reads zero nodes
// → warns-clean. That is correct and intentional, but it means the REAL
// dangling-hash assertion runs NOWHERE in the pipeline.
//
// This tick is the place it actually runs. On a cadence (launchd LaunchAgent
// `com.scrooge.golden-source-integrity-tick`, daily) it:
//   1. Seeds the regulatory graph from the POPULATED shared store (the boot
//      shim resolves BANK_EVENT_DB / BANK_DOCUMENT_STORE to the home pair;
//      BANK_GRAPH_DB is the home graph.db).
//   2. Runs the same `run()` the gate exposes, against the seeded graph + the
//      resolved (home) document store.
//   3. Emits a `SubstrateAlert{alertClass:"integrity"}` for every dangling
//      golden-source node (a Document node citing a `goldenSourceHash` whose
//      blob is missing from every reachable store) — so a genuinely missing
//      blob in the shared store is escalated to the cross-page data-failure
//      banner, not silent. Idempotent on a stable alertId per node hash
//      (append-only audit trail; no daily re-spam).
//
// `warn`-severity violations (blob only in the legacy in-repo store; or a
// pre-enforcement advisory miss) do NOT raise an alert — they are a pending-
// migration / still-populating signal, not an integrity breach. Only `fail`
// violations (dangling everywhere, post-enforcement) escalate.
//
// SHARED-STORE PARITY (D-CROSS-WORKTREE-EVENT-STORE-SYNC): the boot-shim
// import MUST be first so BANK_EVENT_DB / BANK_DOCUMENT_STORE are resolved to
// the home pair before `composition.ts` reads them at module-load. Without it
// the tick would seed from the per-worktree `.local/event.db` (empty) and
// assert nothing — the same structural inertness it exists to cure.
//
// Invocation:
//   bun run scripts/regulatory/golden-source-integrity-tick.ts
//   bun run recon:golden-source-integrity-tick        (package.json script)
//
// Exit code: 0 always (a scheduled monitoring tick records its finding as an
// event; it does not fail the host). The integrity SIGNAL is the emitted
// SubstrateAlert, surfaced by Vera's escalation recon + the dashboard banner.
//
// Authority: D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13);
//            D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11);
//            D-CROSS-WORKTREE-EVENT-STORE-SYNC (boot-shim shared-store posture).
// Backing brief: brief:mira:golden-source-integrity-re-document-as-shared-st:2026-06-13.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — must be the FIRST import so
// BANK_EVENT_DB / BANK_DOCUMENT_STORE are resolved to the home pair before
// composition.ts loads its event store + document store at module-load time.
import "../dispatch/resolve-event-db-boot";

import { clock, eventStore, logger } from "../../platform/composition";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import type { Actor } from "../../platform/event-store/types";
import { run as runGoldenSourceIntegrity } from "../../platform/recon/regulatory-golden-source-integrity";
import { runSeed } from "../../platform/regulatory/graph/seed-projection";

const ENTITY = "LE-ZA-HOZ-BANK";
const TICK_ACTOR: Actor = {
  type: "service",
  id: "agent:mira:golden-source-integrity-tick",
};
const CITATIONS = ["D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION", "D-REGULATORY-LIBRARY-V1"];

/** SubstrateAlert alertId must match /^alert:[a-z]+:[a-z0-9-]+$/. */
function slug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return s.length > 0 ? s : "unidentified";
}

/**
 * Stable, idempotent alertId per dangling golden-source subject. Keyed on the
 * `<nodeId> → <hash>` subject so two distinct dangles raise two alerts but the
 * same dangle on successive ticks raises exactly once.
 */
export function danglingAlertId(subject: string): string {
  return `alert:integrity:golden-source-dangling-${slug(subject)}`;
}

async function main(): Promise<void> {
  const asOf = clock.now();

  // ── Step 1: seed the graph from the populated shared store ───────────────
  const seedStats = await runSeed();

  // ── Step 2: run the gate against the seeded graph + resolved store ───────
  const result = runGoldenSourceIntegrity();

  // ── Step 3: escalate each FAIL (dangling everywhere, post-enforcement) ───
  const failures = result.violations.filter((v) => v.severity === "fail");

  const existingAlertIds = new Set<string>();
  for (const ev of eventStore.replay({ type: "SubstrateAlert" })) {
    const id = (ev.payload as { alertId?: string }).alertId;
    if (id) existingAlertIds.add(id);
  }

  const emitted: string[] = [];
  const skipped: string[] = [];
  for (const v of failures) {
    const alertId = danglingAlertId(v.subject);
    if (existingAlertIds.has(alertId)) {
      skipped.push(v.subject);
      continue;
    }
    eventStore.append(
      makeSubstrateAlert({
        asOf,
        entity: ENTITY,
        actor: TICK_ACTOR,
        citations: CITATIONS,
        payload: {
          alertId,
          alertClass: "integrity",
          details: `DANGLING GOLDEN SOURCE in the shared store: ${v.message} Owner: Mira (Chief Obligations & Regulatory Officer, compliance).`,
          severity: "high",
        },
      }),
    );
    emitted.push(v.subject);
  }

  const warnings = result.violations.filter((v) => v.severity === "warn").length;

  logger.info(
    {
      pipeline: "golden-source-integrity-tick",
      seededNodes: seedStats.totalNodes,
      asserted: result.asserted,
      failures: failures.length,
      warnings,
      alertsEmitted: emitted.length,
      alertsSkipped: skipped.length,
      ok: result.ok,
    },
    result.ok
      ? "golden-source-integrity-tick — done (shared store clean)"
      : "golden-source-integrity-tick — done (dangling golden source(s) escalated as SubstrateAlert{integrity})",
  );
}

if (import.meta.main) {
  await main();
}
