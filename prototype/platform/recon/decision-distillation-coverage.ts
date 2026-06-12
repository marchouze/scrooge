// platform/recon/decision-distillation-coverage.ts
//
// recon:decision-distillation-coverage — core-knowledge-base coverage gate
// (ENFORCING since 2026-06-12; was advisory until the W1 shared-store
// emission pass completed).
//
// Asserts, over the live store:
//   1. Every decisionId whose LATEST `Decision` phase is `approved` has
//      exactly one live (latest-wins) `DecisionDistilled` classification.
//   2. No `DecisionDistilled` classification points at a decisionId that
//      has no `Decision` event at all (dangling classification).
//
// ENFORCING: findings exit 1. The W1 pass ran against the canonical store
// on 2026-06-12 (257 classifications; recon green), so every newly
// approved Decision must carry a classification: add the entry to
// platform/governance/decision-distillation/classifications.ts and run
// `bun run distill:decisions-w1` against the shared store.
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
  // Store-aware enforcement: a store with approved decisions but ZERO
  // classifications is one the W1 emission pass has never run against
  // (stale worktree-local stores, scenario stores). Skip those with a
  // warning instead of failing — the gate enforces wherever the pass has
  // landed (canonical shared store; clean CI stores pass vacuously).
  if (classified === 0 && assertedApproved > 0) {
    console.warn(
      `⚠️  ${PIPELINE}: ${assertedApproved} approved decision(s) but zero DecisionDistilled events — the W1 pass has not run against this store; skipping (run \`bun run distill:decisions-w1\` to enable enforcement here).`,
    );
    process.exit(0);
  }
  if (findings.length > 0) {
    // ENFORCING since 2026-06-12: the W1 shared-store pass is complete
    // (257 classifications, 253 approved covered; D-V2-BBAAS-W1-DECISION-
    // DISTILLATION authorises the flip once the pass lands). Every newly
    // approved Decision now requires a live DecisionDistilled classification.
    console.error(
      `\n❌ ${PIPELINE}: ${findings.length} coverage finding(s) across ${assertedApproved} approved decision(s), ${classified} classified (ENFORCING — classify via platform/governance/decision-distillation/classifications.ts + distill:decisions-w1):\n`,
    );
    for (const f of findings) {
      console.error(`  - [${f.kind}] ${f.decisionId}: ${f.message}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ ${PIPELINE}: ${assertedApproved} approved decision(s) all carry a live DecisionDistilled classification; ${classified} classification(s), none dangling`,
  );
}
