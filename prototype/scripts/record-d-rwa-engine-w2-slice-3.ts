// scripts/record-d-rwa-engine-w2-slice-3.ts
//
// One-shot: emit a Decision event of record for D-RWA-ENGINE-W2-SLICE-3 —
// CEO session-delegation authorising the build of the RwaComputed event
// engine that feeds the BA 700 capital-adequacy return's RWA denominator.
//
// Marc (CEO) directed "continue with ba-100 rwa engine" on 2026-06-09,
// explicitly pulling forward the item that D-OPEN-THREADS-CLOSEOUT-2026-06-09
// had deferred. (The return is BA 700 capital adequacy under the
// Excel-canonical numbering; "BA-100 RWA" is the legacy/loose label.)
//
// Scope: define + register a `RwaComputed` event; wire the existing
// `platform/risk/rwa-engine.ts` (CRE20 standardised risk weights already
// coded) to compute and emit credit RWA (from readDebtExposures) + market
// RWA (BA-320 capital × 12.5, including the Reg 28(3)(a) disallowances
// landed in PR #1131); fold RwaComputed into the BA-700 generator's
// RwaDecomposition. Operational RWA (BIA) stays an explicit placeholder —
// it is gross-income-blocked until post-commencement-of-trading + audited
// gross income (licence-day). Because total RWA therefore still carries a
// placeholder op-risk component, the ba700 period-close subscriber is
// expected to remain allowlisted with a corrected, narrower blocker reason
// (honest-allowlist precedent, D-RETURNS-SUBMISSION-WIRING-WORKSTREAM /
// PR #1106) rather than be fully wired.
//
// Risk weights are the standard CRE20 / Reg 23 figures already in the
// engine — not a novel calibration — so no fresh CFO ratification gate is
// required beyond citing the standard; build-phase engineering authority.
//
// Authority: CEO session-delegation (Marc, marc@tgv.co.za). Run once;
// idempotent.

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-RWA-ENGINE-W2-SLICE-3";

function main(): number {
  for (const e of eventStore.replay({ type: "Decision" })) {
    if ((e.payload as Record<string, unknown>).decisionId === DECISION_ID) {
      logger.info({ decisionId: DECISION_ID }, "skipped (event already exists)");
      return 0;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "RwaComputed event engine (W2 Slice 3) — credit + market RWA event-sourced into the BA 700 capital return; op-RWA stays placeholder (D-RWA-ENGINE-W2-SLICE-3)",
      category: "engineering",
      recommendation:
        "Dispatch Bea (Accounting & financial reporting engineer) to define + register a RwaComputed event and wire the existing rwa-engine.ts to compute and emit credit RWA (readDebtExposures × CRE20 standardised risk weights) and market RWA (BA-320 capital × 12.5), folding the result into the BA-700 RwaDecomposition. Operational RWA stays an explicit gross-income-blocked placeholder; the ba700 subscriber stays honestly allowlisted with a corrected narrower reason unless op-RWA materiality is genuinely immaterial.",
      rationale:
        "Marc pulled the RWA engine forward from the deferred set ('continue with ba-100 rwa engine'). Scoping confirmed the numerator (eligible capital, tiers, buffers, leverage) is already wired and the CRE20 risk-weight logic already exists in platform/risk/rwa-engine.ts — the RWA denominator is the sole remaining placeholder, and its credit + market components have real event-sourced data now. Op-RWA is the only genuinely blocked component (no revenue until licence-day) and is kept an honest placeholder rather than fake-fed.",
      supersedes: [],
      citations: [],
      sourceDocHashes: [],
      recordedVia: "scrooge:session-delegation",
    },
    "2026-06-09T14:05:00.000Z",
  );
  logger.info({ decisionId: DECISION_ID }, "Decision event emitted (approved)");
  return 0;
}

process.exit(main());
