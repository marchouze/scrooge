// platform/recon/fx-agreement-quad-integrity.ts
//
// recon:fx-agreement-quad-integrity — the cutover fail-closed gate for the
// symmetric FX agreement quad (D-FX-INSTRUMENT-BUYSELL-QUAD).
//
// THE INVARIANT (fail-closed): every LIVE `fx` asset-class FIL instance MUST
// carry `economicTerms.fxAgreement` — the symmetric {buy: Money, sell: Money}
// quad that makes the instrument self-describing (it states BOTH currencies of
// the agreement, not only the single SA-CCR notional + direction). An `fx`
// instance with NO quad cannot answer "what did we buy and sell" from its own
// terms — it relies on joining the capture / settlement events (Principle 1 /
// Principle 2 under-served). Fail.
//
// COHERENCE: the quad is additionally re-parsed through `filEconomicTermsSchema`
// (the `.superRefine` ties quad ↔ notional / direction / hedgingSetTag), so a
// present-but-incoherent quad is also caught here — not silently accepted.
//
// SCOPE: only `fx`-asset-class instances are gated. `cash` (post-settlement),
// `ir`, `capital` etc. legitimately carry no FX agreement and are skipped — they
// have their own gates (cash-materialisation-integrity, capital-materialisation-
// integrity). Settled/terminated FX instances are still gated (the quad is a
// static term of the agreement; it does not disappear on settlement).
//
// Non-vacuous on the anchor book (the fixture / backfilled FX positions carry the
// quad). On a flat bench with no FX instances it passes with an `info` note —
// the gate still ran. The CLI path REQUIRES a non-vacuous population (fail-closed
// vacuity guard), mirroring cash-materialisation-integrity.
//
// READ-ONLY: asserts structural presence + coherence over the v2 FIL-instance
// event stream only; values nothing, touches no v1 number.
//
// BOUNDARY: V1-SIDE recon infrastructure (bun:sqlite / node:fs). MAY import
// v2-core (the permitted v1→v2 direction); v2-core never reaches back here.
//
// Authority: D-FX-INSTRUMENT-BUYSELL-QUAD (CEO-approved 2026-06-24);
//   D-FIL-CONSUMER-SURFACE-ARCHITECTURE; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed); Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering) ·
//         Vera (Internal audit engineer, third line — recon shape).

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { Database } from "bun:sqlite";

import {
  type FilInstanceLifecycleEvent,
  filEconomicTermsSchema,
  foldFilInstances,
} from "../../v2-core";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-agreement-quad-integrity";

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
   * When TRUE (the production / on-anchor CLI path), an anchor book with NO `fx`
   * instances FAILS the gate (fail-closed vacuity guard — the on-anchor quad
   * proof must be exercised over a non-zero population). When FALSE (unit tests
   * probing a specific fixture), an empty book is a flat-bench info note.
   * Defaults to FALSE; the CLI entrypoint passes TRUE.
   */
  requireNonVacuousAnchor?: boolean;
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const filEvents = opts.filEvents ?? readFilInstanceEvents();
  const register = foldFilInstances(filEvents);

  let fxInstances = 0;
  for (const row of register.values()) {
    if (row.economicTerms.assetClass !== "fx") continue;
    fxInstances += 1;
    result.asserted += 1;

    // (A) PRESENCE — fail-closed on any fx instance with no quad.
    const quad = row.economicTerms.fxAgreement;
    if (quad === undefined) {
      violations.push({
        subject: `no-quad:${row.instance}`,
        message: `fx FIL instance ${row.instance} carries NO fxAgreement quad — it cannot state what the bank bought/sold from its own terms (under-serves the model's canonical statement of an FX trade). Fail-closed (D-FX-INSTRUMENT-BUYSELL-QUAD).`,
        severity: "fail",
      });
      continue;
    }

    // (B) COHERENCE — re-parse the economic terms through the refined schema so a
    // present-but-incoherent quad (notional/direction/pair mismatch) is caught.
    const parsed = filEconomicTermsSchema.safeParse(row.economicTerms);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => i.message).join("; ");
      violations.push({
        subject: `incoherent-quad:${row.instance}`,
        message: `fx FIL instance ${row.instance} carries an INCOHERENT fxAgreement quad: ${detail}. Fail-closed (D-FX-INSTRUMENT-BUYSELL-QUAD coherence superRefine).`,
        severity: "fail",
      });
    }
  }

  if (fxInstances === 0) {
    violations.push({
      subject: "anchor-book",
      message: opts.requireNonVacuousAnchor
        ? `VACUOUS on-anchor proof: NO fx instances in the v2 anchor store (${resolveV2AnchorDb()}) — the gate asserted nothing about the live FX quad path. Fail-closed: materialise at least one FX instance carrying fxAgreement into the anchor store.`
        : "no fx instances in the v2 anchor store — nothing to assert (flat-bench info, not a failure).",
      severity: opts.requireNonVacuousAnchor ? "fail" : "info",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  result.asOf = `fx-agreement-quad-integrity: ${fxInstances} fx instance(s) checked for the symmetric buy/sell quad (presence + coherence).`;
  return result;
}

if (import.meta.main) {
  // CLI / CI path: read the real anchor store and REQUIRE a non-vacuous
  // population (fail-closed on an empty anchor book).
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
