// scripts/writeoff-fx-subledger-suspense.ts
//
// FX sub-ledger build-phase residue WRITE-OFF runner
// (D-FX-SUBLEDGER-WRITEOFF-CFO, CFO authority — Bea (Chief Financial Officer,
// governance), 2026-06-07).
//
//   bun run scripts/writeoff-fx-subledger-suspense.ts          # dry-run (default)
//   bun run scripts/writeoff-fx-subledger-suspense.ts --emit   # post the journal
//
// Resolves the open CFO write-off decision-request (D-FX-SUBLEDGER-WRITEOFF-CFO,
// opened `requested` by the legacy reconciliation) to `approved` under CFO
// authority, then posts one balanced clearing ManualJournalEntry moving the
// per-currency ACC-2100-009 remediation-suspense residue to the dedicated FX
// build-phase write-off P&L line (ACC-2105-001). After the journal, ACC-2100-009
// nets to zero across every currency and the FX sub-ledger holds only the live
// trade's footprint.
//
// Idempotent — a re-run skips when the clearing journal id already exists in the
// store (and re-recording the approved decision dedups on identical phase/as_of).
//
// BUILD-PHASE NOTE: the residue is build-phase SYNTHETIC corruption (cancelled /
// orphaned build-phase trades). This is substrate hygiene — the GL must end
// clean — NOT a real financial write-off. No real money moves.
//
// See platform/accounting/fx-subledger-writeoff.ts for the engine.
//
// Dispatch discipline: this script targets the canonical shared store via
// BANK_EVENT_DB; run it as:
//   BANK_EVENT_DB=/Users/marc/.local/share/bank/event.db \
//     bun run scripts/writeoff-fx-subledger-suspense.ts --emit
//
// Author: Bea (Chief Financial Officer, governance — also the accounting &
//   financial reporting engineer who authored the GL posting engine),
//   Scrooge-coordinated run.

import { computeFxSubledgerWriteoff } from "../platform/accounting/fx-subledger-writeoff";
import { buildGlView } from "../platform/accounting/gl-projection";
import { clock, eventStore } from "../platform/composition";
import { makeManualJournalEntry } from "../platform/event-store/event-types/accounting";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { resolveDecision } from "../runtime/decisions/record";

const WRITEOFF_DECISION_ID = "D-FX-SUBLEDGER-WRITEOFF-CFO";
const RECON_DECISION_ID = "D-FX-SUBLEDGER-LEGACY-RECONCILIATION";
const JOURNAL_ID = "FXWRITEOFF-SUSPENSE-20260607";
const SOURCE_LINEAGE = "fx-subledger-writeoff-2026-06-07";
const SCENARIO = "fx-subledger-writeoff";
const SUSPENSE = "ACC-2100-009";

function fmt(minor: number): string {
  return (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function suspenseNet(events: readonly Event[], asOf: string): Map<string, number> {
  const view = buildGlView(events, asOf);
  const out = new Map<string, number>();
  for (const row of view.trialBalance.entries) {
    if (row.accountId !== SUSPENSE) continue;
    out.set(row.currency, row.debitMinor - row.creditMinor);
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

function buildClearingEvent(
  clearingLegs: readonly Parameters<typeof makeManualJournalEntry>[0]["payload"]["legs"][number][],
  now: string,
): Event {
  return makeManualJournalEntry({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:bea:cfo:fx-subledger-writeoff" },
    citations: [WRITEOFF_DECISION_ID],
    payload: {
      journalId: JOURNAL_ID,
      description:
        "FX sub-ledger build-phase residue write-off — clear the un-substantiated per-currency " +
        "ACC-2100-009 remediation suspense to Realised FX P&L (ACC-2100-006); build-phase " +
        "synthetic corruption, substrate hygiene not a real financial write-off (CFO authority)",
      postedBy: "agent:bea:cfo:fx-subledger-writeoff",
      postedAt: now,
      period: now.slice(0, 7),
      legs: [...clearingLegs],
      status: "posted",
      citations: [WRITEOFF_DECISION_ID, RECON_DECISION_ID, "IFRS-9-§3.2.3", "urn:principle:1"],
    },
    provenance: simulatedTag({ scenario: SCENARIO, sourceLineage: SOURCE_LINEAGE }),
  });
}

function main(): void {
  const emit = process.argv.includes("--emit");
  const now = clock.now();
  const events = [...eventStore.replay({})];
  const result = computeFxSubledgerWriteoff(events, now);

  console.log(`\nFX sub-ledger WRITE-OFF — ${emit ? "EMIT" : "DRY-RUN"}`);
  console.log(`Clearing journal legs: ${result.clearingLegs.length}\n`);

  console.log("ACC-2100-009 suspense residue to write off (per currency):");
  if (result.suspenseBefore.length === 0) {
    console.log("  (none — suspense already nets to zero across all currencies)");
  }
  for (const s of result.suspenseBefore) {
    console.log(
      `  ${s.currency}  ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`,
    );
  }

  // Idempotent steady state: suspense already cleared (no residue) → nothing to
  // post. A re-run after the journal landed reaches here.
  if (result.clearingLegs.length === 0) {
    const alreadyPosted = journalExists(events, JOURNAL_ID);
    console.log(
      alreadyPosted
        ? `\nClearing journal ${JOURNAL_ID} already posted — ACC-2100-009 cleared, nothing to do (idempotent).\n`
        : "\nNo clearing legs required — ACC-2100-009 remediation suspense already nets to zero.\n",
    );
    return;
  }

  // Empirical before/after via the real GL projection.
  const before = suspenseNet(events, now);
  const clearingEvent = buildClearingEvent(result.clearingLegs, now);
  const after = suspenseNet([...events, clearingEvent], now);
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  console.log("\nACC-2100-009 — before → after (Dr positive / Cr negative):");
  for (const k of keys) {
    const b = before.get(k) ?? 0;
    const a = after.get(k) ?? 0;
    const mark = b === a ? "   " : " ~ ";
    console.log(`${mark}${k.padEnd(6)}  ${fmt(b).padStart(24)}  →  ${fmt(a).padStart(24)}`);
  }

  if (!emit) {
    console.log("\nDry-run only. Re-run with --emit to resolve the CFO decision and post.\n");
    return;
  }

  // --- EMIT path ---------------------------------------------------------
  if (journalExists(events, JOURNAL_ID)) {
    console.log(`\nClearing journal ${JOURNAL_ID} already posted — nothing to do (idempotent).\n`);
    return;
  }

  // Resolve the CFO write-off decision-request → approved (CFO authority).
  // Idempotent: a matching (decisionId, phase, as_of) triple is deduped.
  resolveDecision(
    {
      decisionId: WRITEOFF_DECISION_ID,
      phase: "approved",
      authority: "CFO",
      authorityRef: "agent:bea:cfo",
      title: "FX sub-ledger build-phase residue write-off",
      category: "finance",
      recommendation:
        "Approve the write-off of the FX sub-ledger build-phase residue quarantined in " +
        "ACC-2100-009 (per currency: CHF Cr 3,317,990.70; GBP Dr 1,687,158.99; JPY Dr " +
        "13,832,311.43; USD Dr 416,557.66; ZAR Dr 23,964,482.81). One balanced clearing " +
        "ManualJournalEntry (FXWRITEOFF-SUSPENSE-20260607) moves each currency's residue out of " +
        "ACC-2100-009 to the dedicated FX build-phase write-off P&L line (ACC-2105-001), leaving " +
        "the suspense at zero across all currencies and the FX sub-ledger holding only the live " +
        "trade's footprint.",
      rationale:
        "The legacy-account reconciliation (D-FX-SUBLEDGER-LEGACY-RECONCILIATION) left the FX " +
        "trading sub-ledger holding only the live trade's footprint and swept the un-reconcilable " +
        "residue into ACC-2100-009 transparently, pending CFO sign-off. None of the residue " +
        "substantiates to a live position — it is the net unreconciled corruption left by the " +
        "cancelled / orphaned build-phase trades. The residue is BUILD-PHASE SYNTHETIC; this " +
        "clearing is substrate hygiene (the GL must end clean), NOT a real financial write-off — " +
        "no real money moves. CFO authority is the natural home for a finance write-off " +
        "(decision-authority routing: finance write-off → CFO).",
      sourceDocHashes: [],
      citations: [RECON_DECISION_ID, "IFRS-9-§3.2.3", "urn:principle:1"],
      recordedVia: "scrooge:session-delegation",
      actor: { type: "service", id: "agent:bea:cfo" },
    },
    now,
  );
  console.log(`\nResolved CFO write-off decision ${WRITEOFF_DECISION_ID} → approved.`);

  eventStore.append(clearingEvent);
  console.log(`Posted clearing journal ${JOURNAL_ID} (${result.clearingLegs.length} legs).`);

  // --- VERIFY against the now-updated store ------------------------------
  const post = computeFxSubledgerWriteoff([...eventStore.replay({})], now);
  console.log(
    post.clearingLegs.length === 0
      ? "\n✓ Post-emit: ACC-2100-009 remediation suspense nets to zero across all currencies.\n"
      : `\n✗ Post-emit: ${post.clearingLegs.length} clearing leg(s) still computed — investigate.\n`,
  );
}

main();
