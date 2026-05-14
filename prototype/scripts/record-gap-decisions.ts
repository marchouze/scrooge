// One-time script: record historical CEO decisions that were only ever captured
// via the backfill heuristic (backfill:owner-inbox-records) and are therefore
// filtered out of eventStore.replay() in production mode.

import { recordDelegatedDecision } from "../runtime/decisions/record";

const decisions = [
  {
    decisionId: "D-AGENT-RUNTIME-AUTHORIZE",
    title: "Agent-runtime substrate — authorise build (A0–A3)",
    action: "approve" as const,
    outcome:
      "Build of the agent-runtime substrate (phases A0–A3) authorised. A0 schema-freeze immediate; A1–A3 sequenced. M8 cloud-lift deferred post-licence. Superseded by D-AGENT-AUTONOMY-OPERATIONAL when fleet rollout sequencing was confirmed.",
    sourceDoc:
      "Owner Inbox/actioned/2026-05-07_atlas_agent-runtime-substrate-spec_[SUPERSEDED-BY-D-AGENT-AUTONOMY-OPERATIONAL].md",
    asOf: "2026-05-07T13:00:00.000Z",
  },
  {
    decisionId: "D-THIN-HUMAN-LAYER-MINIMUM",
    title: "Thin human layer — minimum possible composition at licence-day",
    action: "approve" as const,
    outcome:
      "Approved: six separate humans plus Marc plus external audit firm. The sixth human is a separate CRO appointed before licence-application lodgment. MLRO-alternate = AC-Chair NED. FAIS KI is Saskia steady-state, Marc interim until counsel confirms FSP licensing scope.",
    sourceDoc: "Owner Inbox/actioned/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md",
    asOf: "2026-05-08T12:48:00.000Z",
  },
  {
    decisionId: "D-FSP-LICENCE-NECESSITY",
    title: "FSP-licence necessity under FAIS — steady-state posture",
    action: "approve" as const,
    outcome:
      "Confirmed Posture A as steady-state: bank pursues FSP licence under FAIS 37/2002. Saskia is steady-state FAIS KI; Marc interim through licence-day. FAIS Categories I and II sufficient for institutional-only product set pending counsel ratification at licence-application gate.",
    sourceDoc:
      "Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md",
    asOf: "2026-05-09T08:00:00.000Z",
  },
  {
    decisionId: "D-NPA-APPROVAL-POLICY",
    title: "New Product Approval policy — gate-dimension framework",
    action: "approve" as const,
    outcome:
      "Approved the NPA gate-dimension framework. Atlas and Devon co-own the NPA substrate; Camille (CFO) owns the capital-impact gate (dimension #7 RWA-delta); Helena (CRO) owns the risk-assessment gate (dimensions #1–6, #8–#9). Cross-references ORG-PR-26 (BCBS PSMOR §27).",
    sourceDoc:
      "Regulations/_obligations-register.md (v1.19 requirement-cell cleanup, ORG-OP-06 note)",
    asOf: "2026-05-10T09:00:00.000Z",
  },
];

let count = 0;
for (const d of decisions) {
  const { asOf, ...rest } = d;
  const result = recordDelegatedDecision(rest, asOf);
  console.log(`✓ ${d.decisionId} → event_id=${result.eventId}`);
  count++;
}
console.log(`\nRecorded ${count} decisions via scrooge:session-delegation.`);
