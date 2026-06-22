// platform/recon/fx-cash-reverse-coherence.ts
//
// recon:fx-cash-reverse-coherence — the fail-closed REVERSE-cascade gate for the
// cash FIL asset class (D-FIL-CONSUMER-SURFACE-ARCHITECTURE, under
// D-CASH-ASSET-CLASS-V1).
//
// WHY THIS GATE EXISTS
// --------------------
// The materialisation link is FORWARD-ONLY: a settled FX FIL instance produces a
// separate `cash` FIL instance carrying `economicTerms.originatingInstrument`
// back at the FX (`v2-core/fil-instances/cash-materialisation.ts`). The existing
// gates assert FORWARD completeness (settled FX → cash exists,
// `recon:cash-materialisation-integrity`) and the GL recognition tie
// (`recon:fx-cash-gl-recognition-integrity`). NONE of them asserts REVERSE
// coherence: when the parent FX is CANCELLED / TERMINATED, the derived cash must
// no longer be effectively live. Without this gate a cancel leaves a phantom cash
// holding standing (the defect this workstream fixes).
//
// THE INVARIANT (single, FAIL-CLOSED)
// -----------------------------------
//   REVERSE COHERENCE — for every FX FIL instance with
//   `stage ∈ {cancelled, terminated}`, NO `cash` instance linked to it by
//   `originatingInstrument` may be EFFECTIVELY LIVE. The cascade
//   (`effectiveLiveCashInstances`) must have voided every such cash. A cancelled
//   parent with a still-effectively-live derived cash is a phantom holding —
//   fail-closed (Principle 1: the GL / risk read of that cash has no standing
//   trade behind it).
//
// NON-VACUITY GUARD (MV-CASH-002): the on-anchor CLI path REQUIRES at least one
// cancelled-/terminated-parent FX that materialised at least one cash instance —
// the case the gate exists to police. An anchor book with no such case asserts
// nothing about the reverse cascade, so the CLI path FAILS (mirrors
// `requireNonVacuousAnchor` in the sibling cash gates). Unit tests probing a
// specific fixture pass an empty book as a flat-bench info note.
//
// READ-ONLY: asserts the reverse cascade over the v2 FIL-instance event stream;
// values nothing and touches no production number.
//
// BOUNDARY: V1-SIDE recon infrastructure (bun:sqlite / node:fs). MAY import
// v2-core (the permitted v1→v2 direction). v2-core never reaches back here.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed); Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  type FilInstanceLifecycleEvent,
  type FilInstanceRow,
  foldFilInstances,
  isEffectivelyLiveCash,
  isLiveStage,
  isParentTerminalStage,
} from "../../v2-core";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-cash-reverse-coherence";

// ---------------------------------------------------------------------------
// v2 anchor store resolution (mirrors cash-materialisation-integrity.ts).
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
  /**
   * When TRUE (the production / on-anchor CLI path), an anchor book with NO
   * cancelled-/terminated-parent FX carrying materialised cash FAILS the gate
   * (fail-closed vacuity guard — MV-CASH-002): there is no reverse cascade to
   * assert, so a pass asserts nothing. When FALSE (unit tests), an empty book is a
   * flat-bench info note. Defaults to FALSE; the CLI entrypoint passes TRUE.
   */
  requireNonVacuousAnchor?: boolean;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const filEvents = opts.filEvents ?? readFilInstanceEvents();
  const register = foldFilInstances(filEvents);

  // Index `cash` instances by their originating FX instance URN (ALL cash, by
  // origin — the cascade decides liveness; here we want every link so we can
  // assert none stays effectively live under a terminal parent).
  const cashByOrigin = new Map<string, FilInstanceRow[]>();
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "cash") continue;
    const origin = row.economicTerms.originatingInstrument;
    if (!origin || origin.length === 0) continue; // orphans are the sibling gate's concern.
    const list = cashByOrigin.get(origin) ?? [];
    list.push(row);
    cashByOrigin.set(origin, list);
  }

  // Non-vacuity bookkeeping: count terminal-parent FX that actually carry cash —
  // the case the gate polices.
  let terminalParentsWithCash = 0;

  for (const fx of register.values()) {
    if (fx.economicTerms.assetClass !== "fx") continue;
    if (!isParentTerminalStage(fx.stage)) continue; // only cancelled / terminated parents.

    const cashLegs = cashByOrigin.get(fx.instance) ?? [];
    if (cashLegs.length === 0) continue; // no derived cash → nothing to cascade.

    terminalParentsWithCash += 1;

    for (const cash of cashLegs) {
      result.asserted += 1;

      // SAFETY INVARIANT (must always hold): the cascade MUST void this cash —
      // `effectiveLiveCashInstances` / `isEffectivelyLiveCash` are the read surface
      // every consumer binds to, so this can only be true if the cascade itself
      // regressed (`isParentTerminalStage` no longer voids the link). Fail-closed
      // hard if it ever does.
      if (isEffectivelyLiveCash(cash, register)) {
        violations.push({
          subject: `cascade-leak:${cash.instance}`,
          message: `FX FIL instance ${fx.instance} is ${fx.stage} (terminal) but its materialised cash ${cash.instance} is STILL returned by the derived-liveness cascade (effectiveLiveCashInstances) — the cascade regressed. A terminal parent must void every derived cash. Principle 1 / fail-closed (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).`,
          severity: "fail",
        });
        continue;
      }

      // PHANTOM DETECTION (the defect this gate exists to catch): the cash record
      // in the EVENT STORE is still live by its OWN stage under a terminal parent.
      // The cascade hides it from compliant consumers, but the booking-level truth
      // is that a cancelled/terminated parent's cash should itself be terminated
      // (the manual reconcile this workstream replaces). A raw-live phantom under a
      // terminal parent means a consumer that does NOT route through the cascade
      // (or any raw-stage read) would see a holding with no standing trade behind
      // it. Fail-closed — the cash must be terminated alongside its parent.
      if (isLiveStage(cash.stage)) {
        violations.push({
          subject: `phantom-cash:${cash.instance}`,
          message: `FX FIL instance ${fx.instance} is ${fx.stage} (terminal) but its materialised cash ${cash.instance} is still LIVE by its own stage ('${cash.stage}') in the event store — a phantom holding with no standing trade behind it. A cancelled/terminated parent's derived cash must itself be terminated (no manual reconcile, no derived phantom). The cascade voids it for compliant consumers, but the record must not stay live. Principle 1 / fail-closed (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).`,
          severity: "fail",
        });
      }
    }
  }

  if (terminalParentsWithCash === 0) {
    violations.push({
      subject: "anchor-book",
      message: opts.requireNonVacuousAnchor
        ? `VACUOUS on-anchor proof: NO cancelled/terminated FX instance with materialised cash in the v2 anchor store (${resolveV2AnchorDb()}) — there is no reverse cascade to assert. Fail-closed (MV-CASH-002): the gate exists to police cancelled-parent-with-cash; with none present it asserted nothing.`
        : "no cancelled/terminated FX with materialised cash in the v2 anchor store — no reverse cascade to assert (flat-bench info, not a failure).",
      severity: opts.requireNonVacuousAnchor ? "fail" : "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-cash-reverse-coherence: ${terminalParentsWithCash} cancelled/terminated FX instance(s) with materialised cash checked — no derived cash may stay effectively live under a terminal parent.`;
  return result;
}

if (import.meta.main) {
  // CLI / CI path: read the real anchor store and REQUIRE a non-vacuous
  // population (fail-closed on an empty reverse-cascade population — MV-CASH-002).
  const r = run({ requireNonVacuousAnchor: true });
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const failCount = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:${PIPELINE} ${r.ok ? "OK" : "FAIL"} — ${r.asOf}; ${r.violations.length} violation(s) (${failCount} fail)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
