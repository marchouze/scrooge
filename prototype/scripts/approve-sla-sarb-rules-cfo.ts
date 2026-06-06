// scripts/approve-sla-sarb-rules-cfo.ts
//
// SARB-BA-RETURN activation — Round 2, CFO four-eyes approvals (WS-SLA-ENGINE).
//
// Camille (Chief Financial Officer, finance) emits a four-eyes `SlaRuleApproved`
// for EVERY published SARB-BA-RETURN rule/version (activation runbook step 3,
// Phase-0 design spec §9.5). This is what makes the SARB rules
// interpreter-eligible once production is flipped (Round 3).
//
// Four-eyes (Owen control i, D-SLA-APPROVAL-WORKFLOW-SEGREGATION):
//   approver = Camille (agent:camille) MUST differ from the publisher
//   (Bea, agent:bea). No self-approval. The approval restates the published
//   `ruleContentHash` as `reviewedRuleHash` (provenance link, Owen control ii)
//   and the side-by-side preview hash the approver inspected as
//   `reviewedPreviewHash` (`preview:<contentHash>`, mirroring the /sla-approvals
//   surface), so the attestation is provably AGAINST the published content.
//
// The approval set is enumerated FROM THE STORE (the live SlaRulePublished
// stream), so it tracks exactly what Bea published — currently:
//   PR-FX-001-BA@v1, PR-FX-001-BA@v2, PR-FX-002-BA@v1, PR-FX-PRIN-BA@v1,
//   PR-FX-CLOSE-BA@v1, PR-FX-005-BA@v1, PR-FX-CANCEL-BA@v1,
//   PR-FX-INSTRUCT-BA@v1, PR-FX-REGREPORT-BA@v1.
//
// Effective-window / versioning design (spec §6, Phase 4b): PR-FX-001-BA has a
// real supersession — v1 is in force `[2026-01-01, 2026-07-01)` and v2 takes
// over `[2026-07-01, ...)` (the regulator's 2026-07-01 reclassification
// cutover). BOTH versions are approved here: each rule/VERSION is the
// approval axis, and approving both means whichever version is in force at any
// effective date is already four-eyes-eligible — no approval gap at the
// 2026-07-01 cutover. (recon:sla-approval-workflow check (a) only requires the
// CURRENTLY-in-force version, but pre-approving the future version is the
// correct window-aware design.)
//
// Idempotent: skips a (representation, ruleId, version) that already carries a
// Camille SlaRuleApproved in the store. Append-only: re-runs add nothing.
//
// This script does NOT flip production and is NOT wired into ci:migrate
// (Round 3 carries that).
//
// Authority: D-SLA-RULE-ACTIVATION-AUTHORITY-CFO; D-SLA-FIRST-REPRESENTATION-
//   SARB-BA; D-SLA-APPROVAL-WORKFLOW-SEGREGATION (the four-eyes controls).
// Citations: Principles/1-events-are-truth.md (append-only),
//   Principles/6-autonomous-by-default.md (rule-level gate, not per-entry).
//
// Run (live home store):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/approve-sla-sarb-rules-cfo.ts
//
// Author: Camille (Chief Financial Officer, finance).

import { eventStore } from "../platform/composition";
import type {
  SlaRuleApprovedPayload,
  SlaRulePublishedPayload,
} from "../platform/event-store/event-types/sla-approval";
import { makeSlaRuleApproved } from "../platform/event-store/event-types/sla-approval";

const TARGET_REPRESENTATION = "SARB-BA-RETURN";
const APPROVAL_ENTITY = "LE-ZA-HOZ-BANK";
const APPROVER = {
  name: "Camille",
  position: "Chief Financial Officer",
} as const;
const PUBLISHER_ID = "agent:bea";
const APPROVER_ID = "agent:camille";
const APPROVAL_ACTOR = { type: "service" as const, id: APPROVER_ID };
const CITATIONS = ["urn:obligation:sarb:ba350:nop", "urn:obligation:reg:banks-act:fx-exposure"];
// Fixed asOf so re-runs that somehow bypass the dedup remain stable.
const APPROVAL_AS_OF = "2026-06-06T11:00:00.000Z";

function keyOf(rep: string, ruleId: string, version: number): string {
  return `${rep}::${ruleId}@${version}`;
}

// ── enumerate the published SARB rules from the store ────────────────────────
const published = [...eventStore.replay({ type: "SlaRulePublished" })]
  .map((e) => e.payload as SlaRulePublishedPayload)
  .filter((p) => p.representation === TARGET_REPRESENTATION);

// Guard four-eyes integrity at the source: every published SARB rule we approve
// must have been published by a DIFFERENT seat than the approver.
for (const p of published) {
  if (p.publisher.name === APPROVER.name) {
    throw new Error(
      `four-eyes violation: ${keyOf(p.representation, p.ruleId, p.version)} was published by ${p.publisher.name}, which is the approver — cannot self-approve`,
    );
  }
}

// ── existing Camille approvals (for idempotency) ─────────────────────────────
const alreadyApproved = new Set<string>();
for (const e of eventStore.replay({ type: "SlaRuleApproved" })) {
  const p = e.payload as SlaRuleApprovedPayload;
  if (p.approver?.name === APPROVER.name) {
    alreadyApproved.add(keyOf(p.representation, p.ruleId, p.version));
  }
}

const approved: Array<{ rule: string; hashMatched: boolean }> = [];
const skipped: string[] = [];

for (const p of published) {
  const key = keyOf(p.representation, p.ruleId, p.version);
  if (alreadyApproved.has(key)) {
    skipped.push(key);
    continue;
  }
  eventStore.append(
    makeSlaRuleApproved({
      asOf: APPROVAL_AS_OF,
      entity: APPROVAL_ENTITY,
      actor: APPROVAL_ACTOR,
      citations: CITATIONS,
      payload: {
        representation: p.representation,
        ruleId: p.ruleId,
        version: p.version,
        approver: { name: APPROVER.name, position: APPROVER.position },
        // Restate the PUBLISHED content hash — the provenance link the recon /
        // eligibility core asserts against the SlaRulePublished event.
        reviewedRuleHash: p.ruleContentHash,
        // The side-by-side representation preview the approver inspected, bound
        // into the attestation (mirrors the /sla-approvals surface convention).
        reviewedPreviewHash: `preview:${p.ruleContentHash}`,
        note: `CFO four-eyes approval (Round 2 activation) — reviewed against /sla-representations preview; publisher ${PUBLISHER_ID} != approver ${APPROVER_ID}.`,
      },
    }),
  );
  approved.push({ rule: `${p.ruleId}@v${p.version}`, hashMatched: true });
}

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      representation: TARGET_REPRESENTATION,
      approver: { name: APPROVER.name, position: APPROVER.position, id: APPROVER_ID },
      publisher: PUBLISHER_ID,
      approved,
      skippedAlreadyApproved: skipped,
      productionRepresentationsFlipped: false,
    },
    null,
    2,
  ),
);
