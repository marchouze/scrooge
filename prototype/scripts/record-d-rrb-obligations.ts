// One-shot: promote the two RRB-obligation decisions from their markdown leg
// (authored in a Cowork session without bun/event store) to typed Decision events.
// Authority: CEO session-delegation (Marc, 2026-06-19). Source records:
//   Regulations/SARB-PA/2026-06-19_scrooge_D-RRB-OBLIGATIONS-REVIEW-MERGE.md
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-d-rrb-obligations.ts
//
// New authoring uses recordDecision directly (D-DECISIONS-FRAMEWORK-REDESIGN Slice C).

import { recordDecision } from "../runtime/decisions/record";

const decisions = [
  {
    decisionId: "D-RRB-OBLIGATIONS-REVIEW-MERGE",
    title: "RRB obligations: independent review-and-merge workstream before adoption",
    category: "compliance" as const,
    recommendation:
      "Open a review-and-merge workstream for the 46 LLM-proposed RRB obligations. An independent reviewer (not the authoring seat) triages all rows against the verbatim source, produces a renumbered, _provenance-stripped, merge-ready set continuing from ORG-PR-67, and surfaces every ambiguity needing a CEO call before any ObligationAdopted event is emitted. Adoption proper runs on the engineering substrate gated on resolution of the flagged ambiguities.",
    rationale:
      "Obligations are load-bearing (Principle 1 — they fold into ObligationAdopted events). The proposal is LLM-authored and proposed-llm-unreviewed; a second, independent pass is required before adoption. Marc approved the review-and-merge routing in-session on 2026-06-19.",
    asOf: "2026-06-19T00:00:00.000Z",
  },
  {
    decisionId: "D-RRB-OBLIGATIONS-ADOPT",
    title: "RRB obligations: adoption parameters (45 rows, ORG-PR-067…111)",
    category: "compliance" as const,
    recommendation:
      "Adopt 45 reviewed RRB obligations (ORG-PR-067…111). Owner slug company-secretary confirmed canonical (not cosec). FX net-open-position limit (reg29, ORG-PR-086) and Pillar 2 / systemic add-on % (reg38(8)(a), ORG-PR-097) adopted with their Authority-set values deferred [TBD] and tracked in the deferred-values register. reg31 banking-book equity (BA 340) HELD this phase (equities out of scope) — row dropped. reg35 securitisation (BA 500) and reg36 consolidated supervision (BA 600) adopted as conditional. Two source-override corrections applied: reg24 5% connected-counterparty trigger (ORG-PR-078) and reg38 2.5% conservation buffer (ORG-PR-095), both confirmed verbatim against source.",
    rationale:
      "CEO answers given in-session by Marc on 2026-06-19 against the review memo. Resulting merge-ready set is Regulations/SARB-PA/_obligations.rrb-reviewed.json. Deferred values kept as [TBD] by design (Authority-set); no values invented (Engineering Charter command 4: source, don't hardcode).",
    asOf: "2026-06-19T00:00:00.001Z",
  },
] as const;

let ok = 0;
let failed = 0;
for (const d of decisions) {
  try {
    const result = recordDecision(
      {
        decisionId: d.decisionId,
        phase: "approved",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        title: d.title,
        category: d.category,
        recommendation: d.recommendation,
        rationale: d.rationale,
        sourceDocHashes: [],
        citations: [],
        recordedVia: "scrooge:session-delegation",
        actor: { type: "human", id: "marc@tgv.co.za" },
      },
      d.asOf,
    );
    console.log(`✓ ${d.decisionId}  eventId=${result.eventId}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${d.decisionId}`, err);
    failed++;
  }
}

console.log(`\nDone: ${ok} emitted, ${failed} failed.`);
if (failed > 0) process.exit(1);
