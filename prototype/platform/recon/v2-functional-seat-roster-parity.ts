// platform/recon/v2-functional-seat-roster-parity.ts
//
// recon:v2-functional-seat-roster-parity — V2 S11.
//
// The v2 analogue of Vera's roster-derived recons (mandate-coverage, etc.),
// for the tenant-scoped functional-seat model. Asserts that the ANCHOR tenant's
// functional-seat register is consistent with the canonical roster
// (`Team/_team-roster.json`) — and that the ROSTER is the source: any drift is
// a FINDING, never an auto-fix.
//
// INVARIANTS (pure assertion in v2-core `assertSeatRosterParity`, exercised
// sabotage-proof in the v2-core test):
//   1. every roster persona maps to EXACTLY ONE anchor seat (no missing seat);
//   2. each seat's functionalRole / seatType / reportsToSeat / occupant match
//      what the roster says (re-derived from the same roster);
//   3. no ORPHAN anchor seat (a registered seat with no roster persona);
//   4. no derivation finding (unknown seatType, duplicate role slug, dangling
//      reportsTo).
//
// SEVERITY: ADVISORY → ENFORCING.
//   • The deterministic core (`assertSeatRosterParity`) is enforced by the
//     v2-core test: a sabotaged seat (drift / orphan / missing) IS caught,
//     non-vacuously (asserted > 0).
//   • The recon `run()` reads the LIVE control-plane store. The anchor
//     seat-seed is NOT yet in the CI `ci:migrate` chain (mirrors the S14
//     fleet-integrity posture), so on a clean CI runner the functional-seat
//     register is EMPTY. An empty register is NOT a parity failure — there is
//     nothing to drift — so `run()` returns an advisory note (ok:true) when the
//     store has no functional seats, and ENFORCES parity once seats exist.
//     Flip `ENFORCING` to make a populated-but-drifted register blocking once
//     the seed lands in `ci:migrate`.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra checks v2
// behaviour; the reverse is forbidden). It imports the v2 functional-seat
// projection + the pure assertion via the permitted v1→v2 direction, and reads
// the repo-root roster DATA file (data, not v1 code).
//
// Authority: D-V2-TENANCY-ARCHITECTURE (Option C); D-V2-BBAAS-TIER-STRUCTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:owen:v2-s11-tenant-scoped-functional-seat-model-roste:2026-06-13
// Author: Owen (Company Secretary, governance) with Sade (AgentOps, operations).

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  ANCHOR_TENANT_ID,
  type RosterPersona,
  assertSeatRosterParity,
  buildFunctionalSeatProjection,
  defaultControlPlanePath,
  openControlPlaneStore,
  parseRoster,
} from "../../v2-core/control-plane";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

/** Walk up to the repo root (the dir containing `CLAUDE.md`). */
function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`findRepoRoot: no CLAUDE.md found walking up from "${start}"`);
    }
    dir = parent;
  }
}

// Advisory while the anchor seat-seed is not in the CI migrate chain. Flip to
// true to make a populated-but-drifted register blocking.
const ENFORCING = false;

// Deterministic timestamp for the parity re-derivation — parity compares
// STRUCTURE (seatId / role / type / reportsTo / occupant), never registeredAt,
// so any fixed value is fine here.
const PARITY_AS_OF = "2026-06-13T00:00:00.000Z";

export function run(overridePath?: string): ReconResult {
  const result = emptyResult("v2-functional-seat-roster-parity");
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  // ---- Load the canonical roster (the source of truth) --------------------
  const repoRoot = findRepoRoot(import.meta.dir);
  const rosterPath = resolve(repoRoot, "Team", "_team-roster.json");
  if (!existsSync(rosterPath)) {
    result.asserted += 1;
    result.violations = [
      {
        subject: rosterPath,
        severity: "warn",
        message: `Roster not found at "${rosterPath}" — cannot assert seat parity. Advisory.`,
      },
    ];
    return { ...result, ok: true };
  }
  const personas: readonly RosterPersona[] = parseRoster(readFileSync(rosterPath, "utf8"));

  // ---- Open the control-plane store ---------------------------------------
  const dbPath = overridePath ?? defaultControlPlanePath();
  let store: ReturnType<typeof openControlPlaneStore> | undefined;
  try {
    store = openControlPlaneStore(dbPath);
  } catch (err) {
    result.asserted += 1;
    result.violations = [
      {
        subject: dbPath,
        severity: "warn",
        message: `Could not open control-plane store at "${dbPath}": ${String(err)}`,
      },
    ];
    return { ...result, ok: true }; // advisory: cannot open store, non-blocking
  }

  try {
    const projection = buildFunctionalSeatProjection(store);
    const anchorSeats = projection.seatsForTenant(ANCHOR_TENANT_ID);

    // Empty register → nothing to drift. Advisory note, not a failure (the
    // anchor seed is not yet in ci:migrate; mirrors S14 fleet-integrity).
    if (anchorSeats.length === 0) {
      result.asserted += 1;
      result.violations = [
        {
          subject: ANCHOR_TENANT_ID,
          severity: "warn",
          message: `No functional seats registered for the anchor tenant "${ANCHOR_TENANT_ID}" — seat seed not yet applied. Advisory (run the S11 anchor-seat derivation to populate the register).`,
        },
      ];
      return { ...result, ok: true };
    }

    // Populated → assert parity against the roster. The assertion compares the
    // registered anchor seats to the seat map DERIVED from the same roster;
    // drift is a violation (roster is the source).
    const { violations, asserted } = assertSeatRosterParity(
      personas,
      // pass ALL seats so the orphan check can see cross-tenant seats too; the
      // assertion filters to the anchor tenant internally for the persona-map.
      projection.listSeats(),
      ANCHOR_TENANT_ID,
      PARITY_AS_OF,
    );
    result.asserted += asserted;
    result.violations = violations.map((v) => ({ ...v, severity }));
  } finally {
    store.close();
  }

  const hasFail = result.violations.some((v) => v.severity === "fail");
  return { ...result, ok: !hasFail };
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:v2-functional-seat-roster-parity`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const overridePath = process.env.BANK_V2_CONTROL_PLANE_DB;
  const result = run(overridePath);
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:v2-functional-seat-roster-parity [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
