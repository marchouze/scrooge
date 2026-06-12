// platform/recon/dsar-sla.ts
//
// Vera recon: dsar-sla (ADVISORY inventory).
//
// Inventories the DSAR SLA state off the event store via the DSAR register
// projection (platform/privacy/dsar-register.ts): every data-subject access
// request (POPIA s.23) is graded against its effective response deadline
// (PAIA s.25(1) 30-day window as applied via POPIA s.25, extensible once per
// PAIA s.26 via DSARExtended).
//
//   - OPEN past deadline ("breached")       → WARN finding.
//   - OPEN within APPROACHING_WINDOW_DAYS   → INFO finding (early warning).
//   - CLOSED but late (closedWithinSla=false) → INFO finding (a late answer
//     is still a s.23 defect even once answered — visible, not forgotten).
//
// 0 open-over-SLA = OK. Mode: ADVISORY (ok:true regardless) — like
// recon:npa-coverage / recon:npa-deferred-gap-tracking it surfaces the
// worklist without blocking CI; on a clean CI store it is trivially green.
// The live alerting path is the DSAR SLA watchdog
// (platform/privacy/dsar-sla-watchdog.ts), which emits
// SubstrateAlert{integrity} per gap; this recon is the read-side inventory.
//
// Surface: `bun run recon:dsar-sla`; wired into ci:recon:domain.
//
// Authority: POPIA 4/2013 ss.23–25; PAIA 2/2000 ss.25–26; ORG-PR(IV)-08;
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11).
// Author: Iris (Information Officer, governance).

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { EventStore } from "@platform/event-store/store";
import { foldDsarRegister } from "../privacy/dsar-register";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "dsar-sla";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

export interface RunOpts {
  dbPath?: string;
  asOf?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");

  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) {
    // No event store — nothing to assert (clean CI runner). OK.
    return result;
  }

  const store = new EventStore(dbPath);
  const asOf = opts.asOf ?? new Date().toISOString(); // wall-clock: SLA clocks are real statutory clocks
  const register = foldDsarRegister(store, asOf);

  result.asserted = register.length;
  const violations: ReconViolation[] = [];

  for (const e of register) {
    if (e.status === "open" && e.slaState === "breached") {
      violations.push({
        subject: e.dsarId,
        message: `OPEN DSAR past its response deadline ${e.responseDeadline.slice(0, 10)} (received ${e.receivedAt.slice(0, 10)}, ${e.requestKind}, age ${e.ageCalendarDays}d${e.extended ? ", already extended" : ""}) — POPIA s.23 / PAIA s.25 statutory clock breached; owner Iris (Information Officer, governance)`,
        severity: "warn",
      });
    } else if (e.status === "open" && e.slaState === "approaching") {
      violations.push({
        subject: e.dsarId,
        message: `open DSAR has ${e.daysToDeadline} day(s) to its response deadline ${e.responseDeadline.slice(0, 10)} (received ${e.receivedAt.slice(0, 10)}, ${e.requestKind}${e.extended ? ", extended" : ""})`,
        severity: "info",
      });
    } else if (e.status !== "open" && e.closedWithinSla === false) {
      violations.push({
        subject: e.dsarId,
        message: `DSAR closed LATE (${e.status} at ${(e.closedAt ?? "").slice(0, 10)}, deadline was ${e.responseDeadline.slice(0, 10)}) — answered, but outside the PAIA s.25 window`,
        severity: "info",
      });
    }
  }

  result.violations = violations;
  // ADVISORY: never blocks CI. The breach path alerts via the live watchdog.
  result.ok = true;
  return result;
}

if (import.meta.main) {
  const result = run();
  const warns = result.violations.filter((v) => v.severity === "warn");
  const infos = result.violations.filter((v) => v.severity === "info");

  for (const v of warns) console.warn(`  WARN  [${v.subject}] ${v.message}`);
  for (const v of infos) console.log(`  info  [${v.subject}] ${v.message}`);

  console.log(
    `recon:${PIPELINE} ${warns.length === 0 ? "OK" : "OK (advisory)"} — ${result.asserted} DSAR(s) on the register, ${warns.length} open-over-SLA, ${infos.length} advisory finding(s)`,
  );
  process.exit(0);
}
