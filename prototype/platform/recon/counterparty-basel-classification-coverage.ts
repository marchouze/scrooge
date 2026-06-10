// platform/recon/counterparty-basel-classification-coverage.ts
//
// Vera recon: counterparty-basel-classification-coverage (ADVISORY inventory).
//
// SA-CCR derivative exposures attract a standardised credit risk weight that
// depends on the counterparty's Basel class (CRE20). That class is a CRO
// credit judgement, held as a `CounterpartyBaselClassAssigned` event-of-record
// (D-FX-COUNTERPARTY-BASEL-CLASSIFICATION). A counterparty with a live
// `CcrEadComputed` exposure but NO authoritative class falls back in
// `rwa-from-positions` to the prudent interim (corporate-non-ig, 100% RW) — a
// safe over-statement of capital, but one the CRO must see so the residual
// gets classified rather than silently riding the floor forever.
//
// This recon inventories every counterparty carrying a (latest, ZAR) SA-CCR
// EAD and reports, per counterparty, whether it is authoritatively classified
// (info) or still on the conservative fallback (warn). Advisory — never blocks
// CI; the fallback is safe, so this is a worklist for the CRO, not a gate.
//
// Surface: `bun run recon:counterparty-basel-classification-coverage`;
//   wired into ci:recon:domain.
//
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION (CEO session-delegation);
//   BCBS CRE20; Policies/credit-risk-policy-v1.md §3.
// Author: Scrooge-coordinated session for marc@tgv.co.za.

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { CcrEadComputedPayload } from "@platform/event-store/event-types/counterparty-credit-risk";
import { EventStore } from "@platform/event-store/store";
import { resolveAllCounterpartyClasses } from "@platform/risk/counterparty-classification";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "counterparty-basel-classification-coverage";
const FUNCTIONAL_CURRENCY = "ZAR";

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
  if (!existsSync(dbPath)) return result; // no store — nothing to assert

  const store = new EventStore(dbPath);

  // Population: counterparties with a latest (ZAR) SA-CCR EAD — the exposures
  // whose risk weight depends on the counterparty class.
  const latestEadByNettingSet = new Map<string, CcrEadComputedPayload>();
  const eadReplayOpts = opts.asOf
    ? { type: "CcrEadComputed" as const, asOf: opts.asOf }
    : { type: "CcrEadComputed" as const };
  for (const ev of store.replay(eadReplayOpts)) {
    const p = ev.payload as unknown as CcrEadComputedPayload;
    if (!p.nettingSetId || p.currency !== FUNCTIONAL_CURRENCY) continue;
    const prev = latestEadByNettingSet.get(p.nettingSetId);
    if (prev && prev.computationDate >= p.computationDate) continue;
    latestEadByNettingSet.set(p.nettingSetId, p);
  }
  const exposedCounterparties = new Set<string>();
  for (const p of latestEadByNettingSet.values()) {
    if (p.ead > 0) exposedCounterparties.add(p.counterpartyId);
  }

  const classes = resolveAllCounterpartyClasses(store, opts.asOf);

  const violations: ReconViolation[] = [];
  let classified = 0;
  let fallback = 0;
  for (const counterpartyId of [...exposedCounterparties].sort()) {
    result.asserted++;
    const assigned = classes.get(counterpartyId);
    if (assigned) {
      classified++;
      violations.push({
        subject: counterpartyId,
        message: `authoritatively classified ${assigned.baselClass} (CRO-assigned ${assigned.sourceEventId}, effective ${assigned.effectiveFrom})`,
        severity: "info",
      });
    } else {
      fallback++;
      violations.push({
        subject: counterpartyId,
        message:
          "SA-CCR exposure on the prudent interim fallback (corporate-non-ig, 100%) — no authoritative Basel class; CRO classification pending",
        severity: "warn",
      });
    }
  }

  result.ok = true; // advisory — the fallback is safe; this is a CRO worklist
  result.violations = violations;
  result.asOf = `exposed=${result.asserted} classified=${classified} fallback=${fallback}`;
  return result;
}

if (import.meta.main) {
  const result = run();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  const fallbackCount = result.violations.filter((v) => v.severity === "warn").length;
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf}; ${fallbackCount} counterparty(ies) on conservative fallback`,
  );
}
