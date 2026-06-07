// scripts/reconcile-fx-subledger-legacy.ts
//
// FX sub-ledger LEGACY-ACCOUNT reconciliation runner
// (D-FX-SUBLEDGER-LEGACY-RECONCILIATION, CEO session-delegation 2026-06-07).
//
//   bun run scripts/reconcile-fx-subledger-legacy.ts          # dry-run (default)
//   bun run scripts/reconcile-fx-subledger-legacy.ts --emit   # post the journal
//
// Retires the orphaned legacy ACC-2100-001..004 balances and the duplicate
// per-currency gross (ACC-2100-010..024) left by the build-phase trade history,
// retaining ONLY the live FX trade's footprint (USD on ACC-2100-002/004, GBP on
// ACC-2100-010/011), and parking the un-reconcilable residue in the build-phase
// remediation suspense (ACC-2100-009) as a CFO write-off proposal. One balanced
// ManualJournalEntry. Idempotent — a re-run skips when the closing journal id
// already exists in the store.
//
// On `--emit` it ALSO opens (does NOT approve) a CFO write-off decision-request
// (`D-FX-SUBLEDGER-WRITEOFF-CFO`, phase: requested) so Bea (Chief Financial
// Officer, governance) can sign off the final move of the suspense residue to a
// write-off line. The reconciliation NEVER self-approves the write-off — the
// residue sits transparently in suspense until the CFO Decision authorises it.
//
// See platform/accounting/fx-subledger-legacy-reconciliation.ts for the engine.
//
// Dispatch discipline: this script targets the canonical shared store via
// BANK_EVENT_DB; run it as:
//   BANK_EVENT_DB=/Users/marc/.local/share/bank/event.db \
//     bun run scripts/reconcile-fx-subledger-legacy.ts --emit
//
// Author: Atlas (Core banking platform architect, engineering),
//   Scrooge-coordinated run.

import { computeFxSubledgerLegacyReconciliation } from "../platform/accounting/fx-subledger-legacy-reconciliation";
import { buildGlView } from "../platform/accounting/gl-projection";
import { clock, eventStore } from "../platform/composition";
import { makeManualJournalEntry } from "../platform/event-store/event-types/accounting";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FX-SUBLEDGER-LEGACY-RECONCILIATION";
const WRITEOFF_DECISION_ID = "D-FX-SUBLEDGER-WRITEOFF-CFO";
const JOURNAL_ID = "FXRECON-LEGACY-20260607";
const SOURCE_LINEAGE = "fx-subledger-legacy-reconciliation-2026-06-07";
const SCENARIO = "fx-subledger-legacy-reconciliation";

function fmt(minor: number): string {
  return (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function acc2100Net(events: readonly Event[], asOf: string): Map<string, number> {
  const view = buildGlView(events, asOf);
  const out = new Map<string, number>();
  for (const row of view.trialBalance.entries) {
    if (!row.accountId.startsWith("ACC-2100-")) continue;
    out.set(`${row.accountId}|${row.currency}`, row.debitMinor - row.creditMinor);
  }
  return out;
}

function journalExists(events: readonly Event[], journalId: string): boolean {
  for (const e of events) {
    if (e.type !== "ManualJournalEntry") continue;
    if ((e.payload as { journalId?: unknown }).journalId === journalId) return true;
  }
  return false;
}

function buildClosingEvent(
  closingLegs: readonly Parameters<typeof makeManualJournalEntry>[0]["payload"]["legs"][number][],
  now: string,
): Event {
  return makeManualJournalEntry({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:atlas:fx-subledger-legacy-reconciliation" },
    citations: [DECISION_ID],
    payload: {
      journalId: JOURNAL_ID,
      description:
        "FX sub-ledger legacy-account reconciliation — retire orphaned ACC-2100-001..004 + " +
        "duplicate per-currency gross to the live-trade-only footprint; quarantine residue to " +
        "ACC-2100-009 suspense (CFO write-off pending)",
      postedBy: "agent:atlas:fx-subledger-legacy-reconciliation",
      postedAt: now,
      period: now.slice(0, 7),
      legs: [...closingLegs],
      status: "posted",
      citations: [
        DECISION_ID,
        "D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING",
        "IFRS-9-§3.2.3",
        "urn:principle:1",
      ],
    },
    provenance: simulatedTag({ scenario: SCENARIO, sourceLineage: SOURCE_LINEAGE }),
  });
}

function main(): void {
  const emit = process.argv.includes("--emit");
  const now = clock.now();
  const events = [...eventStore.replay({})];
  const result = computeFxSubledgerLegacyReconciliation(events, now);

  console.log(`\nFX sub-ledger LEGACY reconciliation — ${emit ? "EMIT" : "DRY-RUN"}`);
  console.log(`Live trade(s): ${result.liveTradeIds.join(", ") || "(none)"}`);
  console.log(`Closing journal legs: ${result.closingLegs.length}\n`);

  console.log("Canonical target (live-trade footprint only):");
  for (const t of [...result.target].sort((a, b) => a.accountId.localeCompare(b.accountId))) {
    console.log(
      `  ${t.accountId}|${t.currency}  ${t.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(t.netDebitMinor))}`,
    );
  }

  console.log("\nWrite-off residue parked in ACC-2100-009 suspense (CFO sign-off pending):");
  if (result.suspenseResidue.length === 0) {
    console.log("  (none — everything reconciled to live or net-zero)");
  }
  for (const s of result.suspenseResidue) {
    console.log(
      `  ${s.currency}  ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`,
    );
  }

  // Empirical before/after via the real GL projection.
  const before = acc2100Net(events, now);
  const closingEvent = buildClosingEvent(result.closingLegs, now);
  const after = acc2100Net([...events, closingEvent], now);
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  console.log("\nACC-2100 trial balance — before → after (Dr positive / Cr negative):");
  for (const k of keys) {
    const b = before.get(k) ?? 0;
    const a = after.get(k) ?? 0;
    const mark = b === a ? "   " : " ~ ";
    console.log(`${mark}${k.padEnd(20)}  ${fmt(b).padStart(24)}  →  ${fmt(a).padStart(24)}`);
  }

  if (!emit) {
    console.log("\nDry-run only. Re-run with --emit to post the closing journal.\n");
    return;
  }

  // --- EMIT path ---------------------------------------------------------
  if (journalExists(events, JOURNAL_ID)) {
    console.log(`\nClosing journal ${JOURNAL_ID} already posted — nothing to do (idempotent).\n`);
    return;
  }

  // Record the (CEO session-delegated) reconciliation decision. Idempotent: a
  // matching (decisionId, phase, as_of) triple is deduped by recordDecision.
  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "FX sub-ledger legacy-account reconciliation",
      category: "finance",
      recommendation:
        "Retire the orphaned legacy ACC-2100-001..004 balances and the duplicate per-currency " +
        "gross (ACC-2100-010..024) via one balanced closing ManualJournalEntry that leaves the " +
        "FX trading sub-ledger holding ONLY the live trade's footprint (USD on ACC-2100-002/004, " +
        "GBP on ACC-2100-010/011); quarantine the un-reconcilable residue in the ACC-2100-009 " +
        "remediation suspense pending CFO write-off sign-off.",
      rationale:
        "The FX trading sub-ledger carried gross postings from the entire simulated trade history " +
        "(1 live / 21 cancelled / 13 settled). Cancellation/settlement reversals and the prior " +
        "per-currency provisioning re-posted contras to NEW account ids instead of contra-ing the " +
        "legacy lines, so AUD/EUR net to zero but show gross, and CHF/GBP/JPY/USD/ZAR carry a " +
        "stranded residual. None of the residual substantiates to a live position, so it is a " +
        "build-phase write-off (CFO sign-off required) parked transparently in suspense, never " +
        "hidden. The live posting path (SLA interpreter) already reverses cancellations " +
        "correctly; this is pre-strangulation history cleanup.",
      sourceDocHashes: [],
      citations: [
        "D-SLA-FX-PER-CURRENCY-ACCOUNT-PROVISIONING",
        "D-FX-SUBLEDGER-REBUILD",
        "IFRS-9-§3.2.3",
        "urn:principle:1",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    now,
  );

  eventStore.append(closingEvent);
  console.log(`\nPosted closing journal ${JOURNAL_ID} (${result.closingLegs.length} legs).`);

  // Open (do NOT approve) the CFO write-off decision-request. Authored for
  // Bea (Chief Financial Officer, governance); left in `requested` phase.
  const residueLines = result.suspenseResidue
    .map((s) => `${s.currency} ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`)
    .join("; ");
  if (result.suspenseResidue.length > 0 && !hasRequestedWriteoff(events)) {
    requestDecision(
      {
        decisionId: WRITEOFF_DECISION_ID,
        authority: "CFO",
        authorityRef: "agent:bea:cfo",
        title: "FX sub-ledger build-phase residue write-off",
        category: "finance",
        recommendation:
          "Approve the write-off of the FX sub-ledger build-phase residue currently quarantined " +
          `in ACC-2100-009 (per currency: ${residueLines}). On approval, post a closing journal ` +
          "moving the residue out of ACC-2100-009 to a P&L / equity write-off line. The residue " +
          "is the net unreconciled corruption left by the cancelled/orphaned build-phase trades; " +
          "none of it substantiates to a live position.",
        rationale:
          "The legacy-account reconciliation (D-FX-SUBLEDGER-LEGACY-RECONCILIATION) left the FX " +
          "trading sub-ledger holding only the live trade's footprint; the residual swept into " +
          "ACC-2100-009 is build-phase corruption (cancelled wrong-notional trades + orphaned " +
          "remediation postings) with no live-position backing. CFO authority is required to " +
          "authorise the final write-off out of suspense (decision-authority routing: finance " +
          "write-off → CFO).",
        sourceDocHashes: [],
        citations: [DECISION_ID, "IFRS-9-§3.2.3", "urn:principle:1"],
        recordedVia: "scrooge:session-delegation",
      },
      now,
    );
    console.log(
      `Opened CFO write-off decision-request ${WRITEOFF_DECISION_ID} (phase: requested) for Bea.`,
    );
  }

  // --- VERIFY against the now-updated store ------------------------------
  const post = computeFxSubledgerLegacyReconciliation([...eventStore.replay({})], now);
  const residualLegs = post.closingLegs.length;
  console.log(
    residualLegs === 0
      ? "\n✓ Post-emit: FX trading sub-ledger reconciled to live-trade-only + suspense residue.\n"
      : `\n✗ Post-emit: ${residualLegs} closing leg(s) still computed — investigate.\n`,
  );
}

function hasRequestedWriteoff(events: readonly Event[]): boolean {
  for (const e of events) {
    if (e.type !== "Decision") continue;
    const p = e.payload as { decisionId?: unknown };
    if (p.decisionId === WRITEOFF_DECISION_ID) return true;
  }
  return false;
}

main();
