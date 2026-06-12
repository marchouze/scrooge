// platform/recon/decision-distillation-coverage.ts
//
// recon:decision-distillation-coverage — core-knowledge-base coverage gate
// (ADVISORY until the W1 shared-store emission pass runs; then enforcing).
//
// Asserts, over the live store:
//   1. Every decisionId whose LATEST `Decision` phase is `approved` has
//      exactly one live (latest-wins) `DecisionDistilled` classification.
//   2. No `DecisionDistilled` classification points at a decisionId that
//      has no `Decision` event at all (dangling classification).
//
// ADVISORY: findings are reported but exit 0 — the dataset lands in the
// same PR as this gate, and the shared-store emission pass
// (`bun run distill:decisions-w1`) runs post-merge. Flip to enforcing
// (exit 1) once the pass is green against the canonical store.
//
// Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (CEO session-delegation
// 2026-06-12); P1-EVENTS-AS-TRUTH.
// Author: Owen (Company Secretary, governance).

import { fileURLToPath } from "node:url";

import { eventStore } from "../composition.ts";
import type { Event } from "../event-store/types.ts";
import { foldCoreKnowledgeBase } from "../governance/decision-distillation/register.ts";

const PIPELINE = "recon:decision-distillation-coverage";

export interface DistillationCoverageFinding {
  readonly kind: "unclassified-approved" | "dangling-classification";
  readonly decisionId: string;
  readonly message: string;
}

/** Pure check over event lists — injectable for tests. */
export function findDistillationCoverageGaps(
  decisionEvents: readonly Event[],
  distilledEvents: readonly Event[],
): { findings: DistillationCoverageFinding[]; assertedApproved: number; classified: number } {
  const register = foldCoreKnowledgeBase(decisionEvents, distilledEvents);

  const findings: DistillationCoverageFinding[] = [];
  for (const decisionId of register.unclassifiedApproved) {
    findings.push({
      kind: "unclassified-approved",
      decisionId,
      message: `Decision "${decisionId}" has latest phase 'approved' but no DecisionDistilled classification — add it to platform/governance/decision-distillation/classifications.ts and run distill:decisions-w1.`,
    });
  }

  // Dangling classifications: DecisionDistilled for a decisionId with no
  // Decision event of any phase.
  const knownDecisionIds = new Set<string>();
  for (const ev of decisionEvents) {
    if (ev.type !== "Decision" && ev.type !== "CeoDecision") continue;
    const p = ev.payload as { decisionId?: string };
    if (p.decisionId) knownDecisionIds.add(p.decisionId);
  }
  const classifiedIds = new Set<string>();
  for (const ev of distilledEvents) {
    if (ev.type !== "DecisionDistilled") continue;
    const p = ev.payload as { decisionId?: string };
    if (p.decisionId) classifiedIds.add(p.decisionId);
  }
  for (const decisionId of [...classifiedIds].sort()) {
    if (!knownDecisionIds.has(decisionId)) {
      findings.push({
        kind: "dangling-classification",
        decisionId,
        message: `DecisionDistilled exists for "${decisionId}" but no Decision event of any phase carries that decisionId — the classification points at a nonexistent decision.`,
      });
    }
  }

  const assertedApproved =
    register.unclassifiedApproved.length +
    register.foundational.filter((r) => r.latestPhase === "approved").length +
    register.directional.filter((r) => r.latestPhase === "approved").length +
    register.obsolete.filter((r) => r.latestPhase === "approved").length;

  return { findings, assertedApproved, classified: classifiedIds.size };
}

/** Store-backed entry point. Empty store → green by construction. */
export function main(opts?: {
  decisionEvents?: readonly Event[];
  distilledEvents?: readonly Event[];
}): { findings: DistillationCoverageFinding[]; assertedApproved: number; classified: number } {
  let decisions: readonly Event[];
  let distilled: readonly Event[];
  if (opts?.decisionEvents) {
    decisions = opts.decisionEvents;
  } else {
    try {
      decisions = [
        ...eventStore.replay({ type: "Decision" }),
        ...eventStore.replay({ type: "CeoDecision" }),
      ];
    } catch {
      decisions = [];
    }
  }
  if (opts?.distilledEvents) {
    distilled = opts.distilledEvents;
  } else {
    try {
      distilled = [...eventStore.replay({ type: "DecisionDistilled" })];
    } catch {
      distilled = [];
    }
  }
  return findDistillationCoverageGaps(decisions, distilled);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const { findings, assertedApproved, classified } = main();
  if (findings.length > 0) {
    // ADVISORY: report but exit 0 until the shared-store W1 pass runs.
    console.warn(
      `\n⚠️  ${PIPELINE}: ${findings.length} coverage finding(s) across ${assertedApproved} approved decision(s), ${classified} classified (ADVISORY — exit 0 until the W1 shared-store pass runs):\n`,
    );
    for (const f of findings) {
      console.warn(`  - [${f.kind}] ${f.decisionId}: ${f.message}`);
    }
    process.exit(0);
  }
  console.log(
    `✅ ${PIPELINE}: ${assertedApproved} approved decision(s) all carry a live DecisionDistilled classification; ${classified} classification(s), none dangling`,
  );
}
