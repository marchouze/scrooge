// One-shot: emit Decision(approved) for 4 IDs that were approved in docs/PRs
// but never had a corresponding approved event emitted.
// Authority: CEO session-delegation (Marc "y" 2026-05-27).
// Run: BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/record-4-missing-approved-decisions.ts

import { recordDecision } from "../runtime/decisions/record";

const decisions = [
  {
    decisionId: "D-FX-CLS-MEMBERSHIP",
    title: "FX CLS membership pathway: indirect via correspondent",
    category: "risk" as const,
    recommendation:
      "Access CLS settlement indirectly via named correspondent bank; no direct CLS membership required in the build phase.",
    rationale:
      "Approved 2026-05-07 as part of the FX sub-decisions batch in the named-correspondent-pair proposal (Devon, Company Secretary). Direct CLS membership deferred until commencement-of-trading scale justifies it.",
    asOf: "2026-05-07T00:00:00.000Z",
  },
  {
    decisionId: "D-RMS-PHASE-4-ARCHIVE-SCOPE",
    title: "RMS Phase 4: archive scope — all four inbox directories moved to archive/",
    category: "governance" as const,
    recommendation:
      "Move Owner Inbox/, Owner Inbox/actioned/, Team Inbox/, Team Inbox/actioned/ to archive/; retire ownerInboxFeed parser and /api/owner-inbox/:filename route; RMS registers become sole canonical.",
    rationale:
      "CEO-approved 2026-05-17 as part of the D-RMS-PHASE-4 record in the RMS Phase 1 spec. Phase 4 completed via PR #523.",
    asOf: "2026-05-17T00:00:00.000Z",
  },
  {
    decisionId: "D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22",
    title: "IPV tolerance schedule for FX Spot: Tier 1 = 0.75%, Tier 2 = 1.00%",
    category: "risk" as const,
    recommendation:
      "Approve two-tier IPV tolerance schedule for FX Spot positions: Tier 1 (< USD 10M notional) = 0.75%; Tier 2 (≥ USD 10M notional) = 1.00%.",
    rationale:
      "CEO-approved 2026-05-22 on CRO (Helena) recommendation. Embedded in posting rules at platform/accounting/posting-rules/ird-swaps.ts, bonds.ts, equities.ts. Event was never emitted — the record-d-ipv-tolerance-schedule-fx-spot-2026-05-22.ts script only emitted phase:requested.",
    asOf: "2026-05-22T00:00:00.000Z",
  },
  {
    decisionId: "D-TRADE-LIFECYCLE-IFRS-CHAIN",
    title:
      "Trade lifecycle IFRS accounting chain: TRADE_LIFECYCLE_REGISTRY + POSTING_RULE_REGISTRY",
    category: "engineering" as const,
    recommendation:
      "Approve the IFRS-aligned trade lifecycle and accounting chain: TRADE_LIFECYCLE_REGISTRY + POSTING_RULE_REGISTRY + buildTradeLifecycleView; lifecycle and accounting domain separation as implemented in PR #722.",
    rationale:
      "CEO-approved 2026-05-18 as cited in platform/accounting/posting-rules/ird-swaps.ts, bonds.ts, equities.ts. No corresponding Decision(approved) event was ever emitted.",
    asOf: "2026-05-18T00:00:00.000Z",
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
