// scripts/rebuild-fx-subledger.ts
//
// FX sub-ledger REBUILD (CEO direction 2026-06-01).
//
//   bun run scripts/rebuild-fx-subledger.ts          # dry-run (default)
//   bun run scripts/rebuild-fx-subledger.ts --emit   # post the restate journal
//
// Restates ACC-2100-001..006 to the canonical target derived from the
// non-cancelled simulated trades' PR-FX-001 bookings (receivable = −payable per
// currency; reval/realised reset to zero), and quarantines the un-reconcilable
// build-phase residue into ACC-2100-009 (a labelled suspense). One balanced
// ManualJournalEntry. Dry-run shows the exact before/after through the real GL
// projection (buildGlView); nothing is appended without --emit.
//
// Background: the per-trade reconciliation (reconcile-fx-subledger.ts) proved
// the displayed anomalies are NOT caused by the cancelled trades — they are
// orphan + reval corruption that cannot be corrected per-trade. See
// platform/accounting/fx-subledger-trade-reconciliation.ts.
//
// Author: Bea (Accounting & financial reporting engineer, engineering),
//   Scrooge-coordinated run.

import { computeFxSubledgerRebuild } from "../platform/accounting/fx-subledger-trade-reconciliation";
import { buildGlView } from "../platform/accounting/gl-projection";
import { clock, eventStore } from "../platform/composition";
import { makeManualJournalEntry } from "../platform/event-store/event-types/accounting";
import { simulatedTag } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { recordDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-FX-SUBLEDGER-REBUILD";
const JOURNAL_ID = "FXRECON-REBUILD-20260601";
const SOURCE_LINEAGE = "fx-subledger-rebuild-2026-06-01";
const SCENARIO = "fx-subledger-rebuild";

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

function main(): void {
  const emit = process.argv.includes("--emit");
  const now = clock.now();
  const events = [...eventStore.replay({})];
  const current = acc2100Net(events, now);
  const rebuild = computeFxSubledgerRebuild(events, current);

  console.log(`\nFX sub-ledger REBUILD — ${emit ? "EMIT" : "DRY-RUN"}`);
  console.log(`Canonical trades (non-cancelled): ${rebuild.canonicalTradeIds.length}`);
  console.log(`Restate journal legs: ${rebuild.restateLegs.length}\n`);

  console.log("Canonical target (ACC-2100-001..004; 005/006 reset to 0):");
  for (const t of [...rebuild.target].sort((a, b) => a.accountId.localeCompare(b.accountId))) {
    console.log(
      `  ${t.accountId}|${t.currency}  ${t.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(t.netDebitMinor))}`,
    );
  }
  console.log("\nQuarantined to ACC-2100-009 suspense:");
  for (const s of rebuild.suspenseResidue) {
    console.log(
      `  ${s.currency}  ${s.netDebitMinor >= 0 ? "Dr" : "Cr"} ${fmt(Math.abs(s.netDebitMinor))}`,
    );
  }

  // Empirical before/after via the real GL projection.
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
        "FX sub-ledger rebuild — restate ACC-2100-001..006 to canonical live-trade bookings; quarantine build-phase residue to ACC-2100-009",
      postedBy: "agent:bea:fx-subledger-rebuild",
      postedAt: now,
      period,
      legs: [...rebuild.restateLegs],
      status: "posted",
      citations: ["D-FX-SUBLEDGER-REBUILD", "D-CANCEL-WRONG-COUNTER-NOTIONAL", "urn:principle:1"],
    },
    provenance,
  });

  const after = acc2100Net([...events, restateEvent], now);
  const keys = [...new Set([...current.keys(), ...after.keys()])].sort();
  console.log("\nACC-2100 trial balance — before → after (Dr positive / Cr negative):");
  for (const k of keys) {
    const b = current.get(k) ?? 0;
    const a = after.get(k) ?? 0;
    const mark = b === a ? "   " : " ~ ";
    console.log(`${mark}${k.padEnd(20)}  ${fmt(b).padStart(22)}  →  ${fmt(a).padStart(22)}`);
  }

  if (!emit) {
    console.log("\nDry-run only. Re-run with --emit to post the rebuild journal.\n");
    return;
  }

  // Idempotency: skip if this rebuild journal already exists.
  for (const e of events) {
    if (
      e.type === "ManualJournalEntry" &&
      (e.payload as { journalId?: unknown }).journalId === JOURNAL_ID
    ) {
      console.log(`\nRebuild journal ${JOURNAL_ID} already posted — nothing to do.\n`);
      return;
    }
  }

  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "FX sub-ledger rebuild from canonical live trades",
      category: "finance",
      recommendation:
        "Restate ACC-2100-001..006 to the canonical target derived from the non-cancelled " +
        "simulated trades' bookings; quarantine the un-reconcilable build-phase residue to a " +
        "labelled suspense (ACC-2100-009). One balanced ManualJournalEntry.",
      rationale:
        "The per-trade reconciliation proved the ACC-2100 anomalies are not attributable to the " +
        "cancelled trades (they self-net) but to ~R0.8bn orphan postings (mis-tagged remediation) " +
        "plus offsetting reval/reversal churn — none of it correctable per-trade. A rebuild from " +
        "the canonical trade set is the only provably-correct fix; the residue is parked " +
        "transparently in suspense, not hidden.",
      sourceDocHashes: [],
      citations: ["D-CANCEL-WRONG-COUNTER-NOTIONAL", "urn:principle:1", "IFRS-9-§3.2.3"],
      recordedVia: "scrooge:session-delegation",
    },
    now,
  );

  eventStore.append(restateEvent);
  console.log(`\nPosted rebuild journal ${JOURNAL_ID} (${rebuild.restateLegs.length} legs).`);

  // Verify against the now-updated store.
  const post = acc2100Net([...eventStore.replay({})], now);
  const targetMap = new Map(
    rebuild.target.map((t) => [`${t.accountId}|${t.currency}`, t.netDebitMinor]),
  );
  let mismatches = 0;
  for (const acct of [
    "ACC-2100-001",
    "ACC-2100-002",
    "ACC-2100-003",
    "ACC-2100-004",
    "ACC-2100-005",
    "ACC-2100-006",
  ]) {
    for (const [k, v] of post) {
      if (!k.startsWith(acct)) continue;
      const want = targetMap.get(k) ?? 0;
      if (v !== want) {
        console.log(`  MISMATCH ${k}: got ${fmt(v)} want ${fmt(want)}`);
        mismatches++;
      }
    }
  }
  console.log(
    mismatches === 0
      ? "✓ Post-emit ACC-2100-001..006 matches canonical target exactly.\n"
      : `✗ ${mismatches} post-emit mismatch(es) — investigate before relying on the GL.\n`,
  );
}

main();
