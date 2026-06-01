// scripts/restate-fx-cash-leg.ts
//
// FX cash-leg restate — ACC-1100-001 (CEO direction 2026-06-01).
//
//   bun run scripts/restate-fx-cash-leg.ts          # dry-run (default)
//   bun run scripts/restate-fx-cash-leg.ts --emit   # post the restate journal
//
// Completes the FX sub-ledger rebuild: sweeps the FX-postingType residue that
// was mis-routed onto the Central Bank Reserve account (ACC-1100-001, a
// D-COA-CURRENCY-DECOUPLING violation) into the ACC-2100-009 suspense. Because
// that residue is the exact mirror of the suspense ZAR balance, the move
// collapses the suspense toward zero. One balanced ManualJournalEntry.
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   Scrooge-coordinated run.

import { computeFxMisroutedCashRestate } from "../platform/accounting/fx-subledger-trade-reconciliation";
import { buildGlView } from "../platform/accounting/gl-projection";
import { clock, eventStore } from "../platform/composition";
import { makeManualJournalEntry } from "../platform/event-store/event-types/accounting";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FX-SUBLEDGER-REBUILD";
const JOURNAL_ID = "FXRECON-CASHLEG-20260601";
const SOURCE_LINEAGE = "fx-subledger-cashleg-restate-2026-06-01";
const SCENARIO = "fx-subledger-rebuild";
const WATCH = ["ACC-1100-001", "ACC-2100-009"];

function fmt(minor: number): string {
  return (minor / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 });
}

function watchNet(events: readonly Event[], asOf: string): Map<string, number> {
  const view = buildGlView(events, asOf);
  const out = new Map<string, number>();
  for (const row of view.trialBalance.entries) {
    if (!WATCH.some((a) => row.accountId.startsWith(a))) continue;
    out.set(`${row.accountId}|${row.currency}`, row.debitMinor - row.creditMinor);
  }
  return out;
}

function main(): void {
  const emit = process.argv.includes("--emit");
  const now = clock.now();
  const events = [...eventStore.replay({})];
  const { residue, restateLegs } = computeFxMisroutedCashRestate(events);

  console.log(`\nFX cash-leg restate (ACC-1100-001) — ${emit ? "EMIT" : "DRY-RUN"}`);
  if (restateLegs.length === 0) {
    console.log("No FX residue on ACC-1100-001 — nothing to restate.\n");
    return;
  }
  console.log("Mis-routed FX residue on ACC-1100-001 (swept to ACC-2100-009 suspense):");
  for (const r of residue) {
    console.log(
      `  ${r.currency}  ${r.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(r.netDebitMinor))}`,
    );
  }

  const provenance = simulatedTag({ scenario: SCENARIO, sourceLineage: SOURCE_LINEAGE });
  const period = now.slice(0, 7);
  const restateEvent = makeManualJournalEntry({
    asOf: now,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "service", id: "agent:bea:fx-subledger-rebuild" },
    citations: ["D-FX-SUBLEDGER-REBUILD"],
    payload: {
      journalId: JOURNAL_ID,
      description:
        "FX sub-ledger rebuild (cash leg) — sweep FX residue mis-routed onto ACC-1100-001 (Central Bank Reserve) into ACC-2100-009 suspense (D-COA-CURRENCY-DECOUPLING)",
      postedBy: "agent:bea:fx-subledger-rebuild",
      postedAt: now,
      period,
      legs: [...restateLegs],
      status: "posted",
      citations: ["D-FX-SUBLEDGER-REBUILD", "D-COA-CURRENCY-DECOUPLING", "urn:principle:1"],
    },
    provenance,
  });

  const before = watchNet(events, now);
  const after = watchNet([...events, restateEvent], now);
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  console.log("\nBefore → after (Dr positive / Cr negative):");
  for (const k of keys) {
    console.log(
      `  ${k.padEnd(20)}  ${fmt(before.get(k) ?? 0).padStart(20)}  →  ${fmt(after.get(k) ?? 0).padStart(20)}`,
    );
  }

  if (!emit) {
    console.log("\nDry-run only. Re-run with --emit to post.\n");
    return;
  }

  for (const e of events) {
    if (
      e.type === "ManualJournalEntry" &&
      (e.payload as { journalId?: unknown }).journalId === JOURNAL_ID
    ) {
      console.log(`\nCash-leg journal ${JOURNAL_ID} already posted — nothing to do.\n`);
      return;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "FX sub-ledger rebuild — cash leg (ACC-1100-001)",
      category: "finance",
      recommendation:
        "Sweep the FX-postingType residue mis-routed onto ACC-1100-001 (Central Bank Reserve) " +
        "into the ACC-2100-009 suspense; FX must settle through the ACC-1200 nostros only.",
      rationale:
        "The ACC-2100 rebuild left the FX cash leg untouched; ACC-1100-001 held the mirror half " +
        "of the same orphan corruption (R382.94M), violating D-COA-CURRENCY-DECOUPLING. Sweeping " +
        "it to suspense collapses the ZAR suspense to zero and zeroes the reserve account's FX " +
        "contribution.",
      sourceDocHashes: [],
      citations: ["D-COA-CURRENCY-DECOUPLING", "urn:principle:1"],
      recordedVia: "scrooge:session-delegation",
    },
    now,
  );

  eventStore.append(restateEvent);
  console.log(`\nPosted cash-leg journal ${JOURNAL_ID} (${restateLegs.length} legs).`);

  const post = watchNet([...eventStore.replay({})], now);
  const reserve = post.get("ACC-1100-001|ZAR") ?? 0;
  console.log(
    reserve === 0
      ? "✓ Post-emit ACC-1100-001 ZAR = 0 (FX residue removed)."
      : `✗ ACC-1100-001 ZAR = ${fmt(reserve)} (expected 0) — investigate.`,
  );
  console.log(`  ACC-2100-009 ZAR suspense now: ${fmt(post.get("ACC-2100-009|ZAR") ?? 0)}\n`);
}

main();
