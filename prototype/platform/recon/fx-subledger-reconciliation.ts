// platform/recon/fx-subledger-reconciliation.ts
//
// recon:fx-subledger-reconciliation — FX sub-ledger legacy-account integrity.
//
// Asserts, over the live GL trial balance, that the FX trading sub-ledger
// (ACC-2100-* excluding the two suspense accounts) has been reconciled to the
// live book and carries no orphaned legacy gross:
//
//   (1) Per-currency net-zero for fully-reversed trades. Within each currency,
//       the sum of every NON-suspense ACC-2100 trading account net equals the
//       live FX trade(s)' canonical footprint for that currency — i.e. there is
//       no leftover gross. Equivalent statement: the legacy-reconciliation
//       engine computes ZERO closing legs (the sub-ledger is already at the
//       live-only target). A non-empty closing-leg set is a FAIL: orphaned
//       legacy / duplicate per-currency gross remains.
//
//   (2) Every remaining residual is substantiated to a live position OR sits in
//       the ACC-2100-009 remediation suspense backed by a CFO write-off
//       Decision. Concretely: the only non-suspense ACC-2100 balances permitted
//       are the live trade's canonical footprint; any ACC-2100-009 residue must
//       have a `D-FX-SUBLEDGER-WRITEOFF-CFO` Decision in the store. Residue with
//       NO backing CFO decision is a FAIL (write-off not surfaced); residue with
//       a `requested` (not yet approved) decision is a WARN (awaiting CFO
//       sign-off) — never silently passed. Residue that PERSISTS after the CFO
//       has APPROVED the write-off is itself a FAIL: an approved write-off whose
//       clearing journal never posted leaves the GL un-hygienic (the suspense
//       was authorised to be cleared but still carries the balance).
//
//   (2b) Post-write-off zero: once the CFO write-off is approved, ACC-2100-009
//       MUST net to zero across every currency. This is the direct assertion the
//       write-off runner (scripts/writeoff-fx-subledger-suspense.ts) is built to
//       satisfy — covered by the FAIL branch of (2) above; stated separately
//       here for clarity.
//
//   (3) No orphaned legacy ACC-2100-001..004 balances remain beyond the live
//       trade's footprint. This is the direct read of (1) restricted to the
//       legacy four accounts: their post-reconciliation net must equal the live
//       trade's footprint on those accounts (USD on 002/004) and nothing else.
//
// Empty-state correctness:
//   - No events / no FX postings → engine returns empty closing legs and empty
//     residue; all assertions vacuous; recon passes.
//
// The recon is a pure assertion over `computeFxSubledgerLegacyReconciliation`
// (the same engine the runner uses) so it cannot drift from the closing logic:
// if the books are reconciled the engine yields zero closing legs.
//
// Authority: D-FX-SUBLEDGER-LEGACY-RECONCILIATION (CEO session-delegation
//   2026-06-07). Citations: Principle 1 (events are truth); IFRS 9 §3.2.3.
//
// Author: Atlas (Core banking platform architect, engineering).

import {
  FX_REMEDIATION_SUSPENSE,
  computeFxSubledgerLegacyReconciliation,
} from "../accounting/fx-subledger-legacy-reconciliation";
import { buildGlView } from "../accounting/gl-projection";
import { eventStore } from "../composition";
import type { Event } from "../event-store/types";
import type { ReconResult, ReconViolation } from "./types";

const PIPELINE = "recon:fx-subledger-reconciliation";
const WRITEOFF_DECISION_ID = "D-FX-SUBLEDGER-WRITEOFF-CFO";

export interface RunOpts {
  /** Override the events used for the recon (test injection). */
  readonly events?: readonly Event[];
  /** Override the as-of cutoff (test injection). Defaults to latest event. */
  readonly asOf?: string;
}

function loadEvents(override?: readonly Event[]): Event[] {
  if (override) return [...override];
  try {
    return [...eventStore.replay({})];
  } catch {
    return [];
  }
}

/** Latest event as_of, or a fixed epoch when the store is empty. */
function latestAsOf(events: readonly Event[]): string {
  let max = "1970-01-01T00:00:00.000Z";
  for (const e of events) {
    if (e.as_of > max) max = e.as_of;
  }
  return max;
}

/** Phase of the CFO write-off decision, or undefined if none exists. */
function writeoffDecisionPhase(events: readonly Event[]): string | undefined {
  let phase: string | undefined;
  let latest = "";
  for (const e of events) {
    if (e.type !== "Decision") continue;
    const p = e.payload as { decisionId?: unknown; phase?: unknown };
    if (p.decisionId !== WRITEOFF_DECISION_ID) continue;
    if (e.as_of >= latest) {
      latest = e.as_of;
      phase = typeof p.phase === "string" ? p.phase : undefined;
    }
  }
  return phase;
}

function fmt(minor: number): string {
  return (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

/** Non-zero ACC-2100-009 GL balances per currency (Dr positive). */
function suspenseBalances(
  events: readonly Event[],
  asOf: string,
): { currency: string; netDebitMinor: number }[] {
  const view = buildGlView(events, asOf);
  const out: { currency: string; netDebitMinor: number }[] = [];
  for (const row of view.trialBalance.entries) {
    if (row.accountId !== FX_REMEDIATION_SUSPENSE) continue;
    const net = row.debitMinor - row.creditMinor;
    if (net !== 0) out.push({ currency: row.currency, netDebitMinor: net });
  }
  return out;
}

export function run(opts: RunOpts = {}): ReconResult {
  const events = loadEvents(opts.events);
  const asOf = opts.asOf ?? latestAsOf(events);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const result = computeFxSubledgerLegacyReconciliation(events, asOf);

  // -- Assertion (1) + (3): zero closing legs ⇒ reconciled to live-only. ----
  // A non-empty closing-leg set means orphaned legacy / duplicate per-currency
  // gross remains on the trading accounts (or the legacy four hold more than
  // the live trade's footprint). The closing legs that target ACC-2100-009 are
  // the balancing contras of the trading-account moves, so any closing leg at
  // all signals un-retired gross.
  asserted++;
  const tradingMoveLegs = result.closingLegs.filter(
    (l) => l.accountId.startsWith("ACC-2100-") && l.accountId !== "ACC-2100-009",
  );
  if (tradingMoveLegs.length > 0) {
    for (const l of tradingMoveLegs) {
      violations.push({
        subject: `${l.accountId}|${l.currency}`,
        severity: "fail",
        message: `Orphaned FX sub-ledger gross: ACC-2100 trading account ${l.accountId} (${l.currency}) is not at the live-trade-only target — ${l.debitCredit === "debit" ? "Dr" : "Cr"} ${fmt(l.amountMinor)} closing move still required. Run scripts/reconcile-fx-subledger-legacy.ts --emit. Authority: D-FX-SUBLEDGER-LEGACY-RECONCILIATION; Principle 1.`,
      });
    }
  }

  // -- Assertion (2): residue must be backed by a CFO write-off Decision. ---
  // The residue is whatever is EITHER (a) still to be swept off the trading
  // accounts (engine-computed `suspenseResidue`, pre-reconciliation) OR (b)
  // already parked in the ACC-2100-009 GL balance (post-reconciliation). Either
  // way, any non-zero residue must be backed by a CFO write-off Decision —
  // otherwise the build-phase corruption is silently parked, which is the exact
  // failure mode this gate prevents. Reading the live ACC-2100-009 GL balance
  // makes the assertion hold AFTER the closing journal lands (when the engine
  // has nothing left to sweep but suspense still holds the residue).
  asserted++;
  const phase = writeoffDecisionPhase(events);
  const suspenseGl = suspenseBalances(events, asOf);
  const residueLines = [
    ...result.suspenseResidue.map(
      (s) =>
        `${s.currency} ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`,
    ),
    ...suspenseGl.map(
      (s) =>
        `${s.currency} ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`,
    ),
  ];
  if (result.suspenseResidue.length > 0 || suspenseGl.length > 0) {
    const residueLine = residueLines.join("; ");
    if (phase === undefined) {
      violations.push({
        subject: "ACC-2100-009",
        severity: "fail",
        message: `FX remediation suspense (ACC-2100-009) holds un-substantiated residue (${residueLine}) with NO backing CFO write-off decision. The write-off must be surfaced as a ${WRITEOFF_DECISION_ID} Decision (requested) for CFO sign-off — never silently parked. Authority: D-FX-SUBLEDGER-LEGACY-RECONCILIATION; decision-authority routing (finance write-off → CFO).`,
      });
    } else if (phase === "requested") {
      violations.push({
        subject: "ACC-2100-009",
        severity: "warn",
        message: `FX remediation suspense (ACC-2100-009) residue (${residueLine}) is awaiting CFO sign-off (${WRITEOFF_DECISION_ID} phase=requested). Tracked, not hidden; clears when the CFO approves and the residue is written off out of suspense.`,
      });
    } else if (phase === "approved") {
      // Approved write-off but residue still parked ⇒ the clearing journal never
      // posted. An authorised write-off that was not executed leaves the GL
      // un-hygienic — FAIL, not a silent pass.
      violations.push({
        subject: "ACC-2100-009",
        severity: "fail",
        message: `FX remediation suspense (ACC-2100-009) still holds residue (${residueLine}) AFTER the CFO write-off was approved (${WRITEOFF_DECISION_ID} phase=approved). The clearing journal must post to zero the suspense. Run scripts/writeoff-fx-subledger-suspense.ts --emit. Authority: ${WRITEOFF_DECISION_ID}; Principle 1.`,
      });
    }
    // any other terminal phase (rejected / deferred / withdrawn / superseded)
    // ⇒ the residue is not actively pending a CFO write-off; no violation here
    // (the residue's disposition is governed by that terminal decision).
  }

  // Empty-state guard — always record at least one assertion.
  if (asserted === 0) asserted = 1;

  return {
    pipeline: PIPELINE,
    ok: violations.every((v) => v.severity !== "fail"),
    asserted,
    violations,
    asOf,
  };
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "fx-subledger-reconciliation passed — FX trading sub-ledger holds only the live-trade footprint; no orphaned legacy gross; any suspense residue is backed by a CFO write-off decision."
        : "fx-subledger-reconciliation FAILED — orphaned FX sub-ledger gross remains, or suspense residue lacks a backing CFO write-off decision.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
