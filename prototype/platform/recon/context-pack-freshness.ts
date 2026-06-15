// platform/recon/context-pack-freshness.ts
//
// `recon:context-pack-freshness` — ADVISORY gate for the W8 Slice D per-seat
// context pack builder.
//
// ADVISORY (exits 0 even with violations; surfaces findings as "warn" severity).
// Becoming ENFORCING after the pack-builder has been running for a full 30-day
// cycle (planned gate hardening in a future W8 slice).
//
// Assertions:
//   1. For each seat that has at least one PostureRegistered event (with a
//      `proposedBy` prefix matching the seat name), assert that a
//      ContextPackBuilt event exists for that seat with `asOf` within the last
//      30 days.
//      If no pack exists, surface a warn-severity finding.
//
// WHY THIS GATE IS V1-SIDE: it reads the event store and needs the recon
// `types` — both v1 infrastructure. The dependency direction v1→v2 is the
// permitted one.
//
// Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// The five seats built in Slice D — extend as new seats gain postures.
// ---------------------------------------------------------------------------
const SEATS_WITH_POSTURES = ["helena", "mira", "vera", "atlas", "rohan"] as const;

// ---------------------------------------------------------------------------
// Freshness window
// ---------------------------------------------------------------------------

/** Number of days within which a ContextPackBuilt must exist for each seat. */
const FRESHNESS_DAYS = 30;

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("context-pack-freshness");
  const violations: ReconViolation[] = [];

  const freshnessCutoff = daysAgo(FRESHNESS_DAYS);

  // --- Collect latest ContextPackBuilt per seatId ---
  const latestPackAsOf = new Map<string, string>();
  for (const ev of eventStore.replay({ type: "ContextPackBuilt" })) {
    const p = (ev as { payload: Record<string, unknown> }).payload;
    const seatId = String(p.seatId ?? "");
    const asOf = String(p.asOf ?? "");
    if (!seatId || !asOf) continue;
    const existing = latestPackAsOf.get(seatId);
    if (!existing || asOf > existing) {
      latestPackAsOf.set(seatId, asOf);
    }
  }

  // --- Collect seats that have PostureRegistered events ---
  const seatsWithPostures = new Set<string>();
  for (const ev of eventStore.replay({ type: "PostureRegistered" })) {
    const p = (ev as { payload: Record<string, unknown> }).payload;
    const proposedBy = String(p.proposedBy ?? "").toLowerCase();
    for (const seat of SEATS_WITH_POSTURES) {
      if (proposedBy.startsWith(seat)) {
        seatsWithPostures.add(seat);
      }
    }
  }

  // --- Assert freshness for each seat with postures ---
  result.asserted += seatsWithPostures.size;
  for (const seat of seatsWithPostures) {
    const latestAsOf = latestPackAsOf.get(seat);
    if (!latestAsOf) {
      violations.push({
        subject: seat,
        message: `seat "${seat}" has PostureRegistered events but no ContextPackBuilt event — run \`bun run scripts/build-context-pack.ts --seat ${seat} --emit\``,
        severity: "warn",
      });
      continue;
    }
    if (latestAsOf < freshnessCutoff) {
      violations.push({
        subject: seat,
        message: `seat "${seat}" last context pack built on ${latestAsOf}, older than freshness window (${FRESHNESS_DAYS} days, cutoff ${freshnessCutoff}) — re-run \`bun run scripts/build-context-pack.ts --seat ${seat} --emit\``,
        severity: "warn",
      });
    }
  }

  return {
    ...result,
    violations,
    // Advisory: ok=true even with warn-severity violations.
    ok: true,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const warnCount = r.violations.filter((v) => v.severity === "warn").length;
  process.stdout.write(
    `recon:context-pack-freshness (advisory) — asserted ${r.asserted} seat(s); ` +
      `${warnCount} freshness finding(s)\n`,
  );
  // Advisory gate: always exit 0.
  process.exit(0);
}
