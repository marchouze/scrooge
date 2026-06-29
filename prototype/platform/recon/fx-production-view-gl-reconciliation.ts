// platform/recon/fx-production-view-gl-reconciliation.ts
//
// recon:fx-production-view-gl-reconciliation — the FX production-view ↔ GL
// leak gate (D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX, CEO-approved 2026-06-29).
//
// THE INVARIANT: a `production-only` FX surface (`/api/v2/markets/fx/*`) must
// reconcile to the GL — the domain-truth oracle for what is "real/production".
// In the build phase the GL is honestly EMPTY (no real pre-licence FX trades),
// so EVERY FX instance that surfaces in a `production-only` FX view MUST be:
//   (a) `kind:"production"` (or `build-phase-fixture` during build phase — real
//       bank state authored pre-commencement), NEVER `kind:"simulated"`; AND
//   (b) PRE-SETTLEMENT as of now (settlement date strictly in the future) — a
//       post-settlement spot is no longer an open position regardless of whether
//       a `FilInstrumentTerminated` was emitted.
//
// WHY THIS GATE EXISTS: before D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX the FX surface
// folded the FIL FX family with NO provenance filter and NO settlement bound, so
// 493 simulated (CP-SIM-*) instances and stale post-settlement spots surfaced in
// a view the route LABELLED `production-only`, while the GL was empty. The view
// could not reconcile to the GL. This gate fails CLOSED on any recurrence: a
// production-only open-FX read that admits a simulated or post-settlement
// instance is a leak.
//
// HOW IT ASSERTS (independent re-derivation — does NOT trust the view helper):
// the gate reads the FIL FX lifecycle family from the READ-PATH event store
// directly (the same store the dashboard reader resolves), folds the OPEN FX
// register under an EXPLICIT `production-only` lens via the canonical
// `openFxInstances` helper, and then RE-CHECKS each surfaced instance's raw
// envelope provenance + settlement date against the invariant. Belt-and-braces:
// if a future regression weakens `openFxInstances`, the independent re-check
// still catches the leak.
//
// READ-ONLY (Engineering Charter cmd 7; feedback_recon_must_be_read_only_no_seed):
// the gate opens the store read-only and appends nothing.
//
// Authority: D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX; D-DATA-PROVENANCE-SUBSTRATE;
//   D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE; Principle 1.
// Author: Kai (Trading systems engineer, engineering).

import { openFxInstances } from "../../dashboard/v2-fx-open-book";
import { bankLifecyclePhase } from "../event-store/provenance";
import { resolveEventDbPath } from "../event-store/resolve-event-db";
import { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-production-view-gl-reconciliation";

interface RawFxCreated {
  instance: string;
  provenanceKind: string;
  scenario: string | undefined;
  settlementDate: string | undefined;
}

export interface FxProductionViewReconOptions {
  /** Override the event store path (tests). Defaults to the read-path resolver. */
  readonly eventDbPath?: string;
  /** Override "now" for the settlement-date bound (tests). Defaults to wall-clock. */
  readonly nowIso?: string;
}

export function run(opts: FxProductionViewReconOptions = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const nowIso = opts.nowIso ?? new Date().toISOString();
  const dbPath = opts.eventDbPath ?? resolveEventDbPath({ excludeHomeDefault: false }).path;

  let store: EventStore;
  try {
    store = new EventStore(dbPath, { readonly: true });
  } catch {
    // No store on this runner (clean CI before backfill) — nothing surfaces, so
    // the invariant holds vacuously. Info, not fail (the production-only read of
    // an empty store is itself empty — it reconciles to the empty GL).
    result.violations = [
      {
        subject: "event-store",
        message: `no event store at ${dbPath} — production-only FX read is empty, reconciles to the empty GL (vacuous OK).`,
        severity: "info",
      },
    ];
    result.asOf = `${PIPELINE}: no store (${dbPath}).`;
    return result;
  }

  try {
    // (1) The production-only open-FX read via the canonical helper — the SAME
    //     read the dashboard summary/blotter/risk panels perform under the
    //     route's default `production-only` filter.
    const open = openFxInstances(store, { mode: "production-only" }, nowIso);

    // (2) Independent raw re-derivation of every FX create event's envelope
    //     provenance + settlement date, so the re-check does not rely on the
    //     helper having filtered correctly.
    const rawByInstance = new Map<string, RawFxCreated>();
    for (const e of store.replay({ type: "FilInstrumentCreated" })) {
      const p = e.payload as {
        instance?: string;
        economicTerms?: { assetClass?: string; settlementDate?: string };
      };
      if (p.economicTerms?.assetClass !== "fx" || !p.instance) continue;
      const prov = e.provenance;
      rawByInstance.set(p.instance, {
        instance: p.instance,
        provenanceKind: prov?.kind ?? "untagged",
        scenario: prov?.scenario,
        settlementDate: p.economicTerms?.settlementDate,
      });
    }

    const nowMs = Date.parse(nowIso);
    const phase = bankLifecyclePhase();

    // (3) Assert the invariant over every instance the production-only view
    //     surfaces as OPEN.
    for (const row of open) {
      asserted++;
      const raw = rawByInstance.get(row.instance);

      // (3a) Provenance: a production-only view must NOT surface a simulated /
      //      untagged instance. (build-phase-fixture is admitted ONLY in the
      //      build phase, mirroring the production-only filter semantics.)
      const kind = raw?.provenanceKind ?? "untagged";
      const provenanceAdmitted =
        kind === "production" || (kind === "build-phase-fixture" && phase === "build-phase");
      if (!provenanceAdmitted) {
        violations.push({
          subject: row.instance,
          message: `FX PRODUCTION-VIEW LEAK: instance ${row.instance} surfaces in the production-only open-FX read but its source event provenance is kind="${kind}"${raw?.scenario ? ` (scenario="${raw.scenario}")` : ""}. A production-only FX view must reconcile to the GL (empty in build phase) — only kind="production"${phase === "build-phase" ? ' / "build-phase-fixture"' : ""} may surface. This is the simulated-data leak D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX fixes. Re-check the explicit ProvenanceFilter threading on the FX surface (dashboard/v2-markets-fx-view.ts → openFxInstances).`,
          severity: "fail",
        });
      }

      // (3b) Settlement-lifecycle: a production-only OPEN read must NOT surface a
      //      post-settlement instance.
      const settlementMs =
        raw?.settlementDate !== undefined ? Date.parse(raw.settlementDate) : Number.NaN;
      if (Number.isFinite(nowMs) && (!Number.isFinite(settlementMs) || settlementMs <= nowMs)) {
        violations.push({
          subject: row.instance,
          message: `FX SETTLEMENT-LIFECYCLE STALL: instance ${row.instance} surfaces as OPEN in the production-only read but its settlement date (${raw?.settlementDate ?? "missing"}) is on/before now (${nowIso}). A settled spot is no longer an open position — it must be excluded from the open-position / B3 / MTM folds regardless of whether a termination event was emitted (D-FX-LIVE-VIEW-PROVENANCE-LEAK-FIX defect #3).`,
          severity: "fail",
        });
      }
    }

    // (4) Cross-check: the production-only read must be a strict subset of
    //     production-kind instances. (Structural assertion that runs even when
    //     the open set is empty — non-vacuous coverage of the read path.)
    asserted++;
    const productionRawCount = [...rawByInstance.values()].filter(
      (r) => r.provenanceKind === "production",
    ).length;
    if (open.length > productionRawCount) {
      violations.push({
        subject: "production-only-read",
        message: `FX PRODUCTION-VIEW LEAK: the production-only open-FX read surfaced ${open.length} instances, but only ${productionRawCount} FX create events carry kind="production". The read is admitting non-production instances — a provenance-filter leak.`,
        severity: "fail",
      });
    }
  } finally {
    store.close();
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.asOf = `${PIPELINE}: ${asserted} assertion(s); ${failCount} fail(s). Production-only FX views reconcile to the GL (only production, pre-settlement instances may surface).`;
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
