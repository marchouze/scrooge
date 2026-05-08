// scripts/resolve-router-escalations-2026-05-07.ts
//
// One-off: resolve the open follow-on-router escalation events by emitting
// CeoDecision records for each. Run after the substrate fix that prevents
// future test-fixture pollution and after the M1 work briefs were staged
// in Team Inbox.
//
// Two cohorts:
//   1. Real M1 handlers (Kai/Anya/Bea/Mira/Senna) — outcome cites the
//      Team Inbox brief; the substantive work continues at the agent.
//   2. Synthetic test fixtures — outcome explains the test-fixture nature
//      and references the substrate fix that prevents recurrence.
//
// Author: Scrooge (orchestration) · Marc (decision actor).

import { recordCeoDecision } from "../runtime/decisions/record";

const asOf = new Date().toISOString();
const ACTOR = "marc@tgv.co.za";
const RECORDED_VIA = "chat:scrooge:resolve-router-escalations-2026-05-07";

interface RealResolution {
  readonly escalationId: string;
  readonly owner: string;
  readonly briefPath: string;
}

const REAL: readonly RealResolution[] = [
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:kai:m1-cdm-typescript-bindings",
    owner: "Kai",
    briefPath: "Team Inbox/2026-05-07_brief_kai_m1-cdm-typescript-bindings.md",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:anya:m1-projection-runtime-mapping",
    owner: "Anya",
    briefPath: "Team Inbox/2026-05-07_brief_anya_m1-projection-runtime-mapping.md",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:bea:m1-ifrs-classification-rules",
    owner: "Bea",
    briefPath: "Team Inbox/2026-05-07_brief_bea_m1-ifrs-classification-rules.md",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:mira:m1-regulator-citation-urns",
    owner: "Mira",
    briefPath: "Team Inbox/2026-05-07_brief_mira_m1-regulator-citation-urns.md",
  },
  {
    escalationId:
      "escalation:scrooge:unresolved-route:D-MARKETS-SCHEMA-FOUNDATION:agent:senna:m1-trading-stack-threat-model",
    owner: "Senna",
    briefPath: "Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md",
  },
];

const FIXTURES: readonly string[] = [
  "escalation:scrooge:unresolved-route:D-ROUTER-TEST-1778174531678:agent:atlas:nonexistent-trigger-for-test",
  "escalation:scrooge:unresolved-route:D-ROUTER-TEST-1778174534850:agent:atlas:nonexistent-trigger-for-test",
  "escalation:scrooge:unresolved-route:D-TEST-FOLLOW-ON-ROUTER-APPROVE:agent:atlas:nonexistent-trigger-for-test",
];

let count = 0;

for (const r of REAL) {
  const result = recordCeoDecision(
    {
      decisionId: r.escalationId,
      action: "approve",
      title: `Build the missing handler — ${r.owner} M1 routed`,
      outcome: `Approved as recommended. Build the missing handler. Substantive work brief staged at \`${r.briefPath}\`; ${r.owner} owns the implementation under the M1 build sequence authorised in D-MARKETS-SCHEMA-FOUNDATION. Handler registers in \`runtime/handlers-metadata.ts\` + \`runtime/handler-callables.ts\` once code lands; chain auto-fires on the next D-MARKETS-SCHEMA-FOUNDATION-class CEO approval.`,
      actor: ACTOR,
      sourceDoc: r.briefPath,
      recordedVia: RECORDED_VIA,
    },
    asOf,
  );
  console.log(`Resolved (real)   ${r.escalationId} → event ${result.eventId}`);
  count++;
}

for (const id of FIXTURES) {
  const result = recordCeoDecision(
    {
      decisionId: id,
      action: "approve",
      title: "Test fixture struck — synthetic router escalation",
      outcome: `Struck. This escalation was emitted by an ad-hoc router test run with a synthetic decisionId, not a real CEO follow-on. The substrate fix in \`prototype/runtime/agents/scrooge-follow-on-router.ts\` (TEST_FIXTURE_DECISION_RE / TEST_FIXTURE_ROUTE_RE guard, 2026-05-07) prevents future test-fixture decisions from polluting the production event log even when run with \`dryRun: false\`. No work to follow up.`,
      actor: ACTOR,
      sourceDoc: "(synthetic test fixture)",
      recordedVia: RECORDED_VIA,
    },
    asOf,
  );
  console.log(`Resolved (fixture) ${id} → event ${result.eventId}`);
  count++;
}

console.log(`\nResolved ${count} escalation(s) in total.`);
