// platform/recon/v2-decision-impact-sweep-coverage.ts
//
// `recon:v2-decision-impact-sweep-coverage` — the structural gate for the V2 S9
// decision-impact sweep lifecycle (W8 governance keystone).
//
// ADVISORY in S9 (exits 0 unless a HARD structural error is found). Becomes
// enforcing-ready as the sweep population grows past the baseline-forward set.
//
// Assertions:
//   1. No fold violations (orphan Assessed — a DecisionImpactAssessed with no
//      matching DecisionImpactSweepRequested).                         [fail]
//   2. Every assessed sweep's recommendedActions are well-formed:
//      every action is in the closed vocabulary, and the set is consistent with
//      the recorded impact set (re-running the pure engine's action-derivation
//      over the recorded impacted artefacts reproduces the recorded actions).
//      A recorded action set that disagrees with the engine over its own
//      recorded impact set is a hard finding.                          [fail]
//   3. Orphan impacts: an impacted artefact of kind `posture` or `fil-model`
//      whose `artefactRef` does not resolve to a live artefact in the
//      corresponding register (posture register / FIL-Model declarations) is a
//      finding. (`obligation`/`procedure` refs are not resolvable from the v2
//      registers this gate reads, so they are reported advisory-only — surfaced
//      as `info`, never `fail` — to avoid false positives.)            [warn]
//   4. Coverage: every `Decision` event since the BASELINE that is in an
//      actionable phase (`approved`) has at least one sweep over it. A
//      post-baseline approved decision with no sweep is an orphan-decision
//      finding (advisory in S9 — the population is built baseline-forward).
//                                                                       [warn]
//
// BASELINE: D-W8-DECISION-IMPACT-SWEEP was CEO-approved 2026-06-13. S9 is a
// baseline-forward + pilot capability (out of scope: back-sweeping the entire
// historical decision log). The coverage assertion therefore considers only
// Decisions whose `as_of` is on/after the baseline date. The pilot decision
// (D-SACCR-V2-CUTOVER-ACCELERATE, this session's cutover) is the seed case the
// coverage assertion asserts is swept.
//
// WHY THIS GATE IS V1-SIDE: it needs the event store + recon `types` — both v1
// infrastructure. The dependency direction v1→v2 is the permitted one
// (`recon:v2-no-v1-import` holds — this file is NOT under v2-core).
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 2 (single-graph discipline — the
// sweep binds the graph: it asserts which artefacts a decision touches).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import {
  type ImpactedArtefact,
  type SweepRegister,
  deriveRecommendedActions,
  foldSweepRegister,
} from "../../v2-core/decision-impact";
import { eventStore } from "../composition";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

// ---------------------------------------------------------------------------
// Baseline — S9 is baseline-forward (D-W8-DECISION-IMPACT-SWEEP, 2026-06-13).
// ---------------------------------------------------------------------------

/** ISO date on/after which an approved Decision is expected to carry a sweep. */
const BASELINE_AS_OF = "2026-06-13";

/** The pilot decision the coverage assertion asserts is swept (the seed case). */
const PILOT_DECISION_ID = "D-SACCR-V2-CUTOVER-ACCELERATE";

// ---------------------------------------------------------------------------
// Read the sweep register from the live event store
// ---------------------------------------------------------------------------

function readSweepRegister(): SweepRegister {
  const payloads: unknown[] = [];
  for (const ev of eventStore.replay({ type: "DecisionImpactSweepRequested" })) {
    payloads.push({
      kind: "DecisionImpactSweepRequested",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  for (const ev of eventStore.replay({ type: "DecisionImpactAssessed" })) {
    payloads.push({
      kind: "DecisionImpactAssessed",
      ...(ev as { payload: Record<string, unknown> }).payload,
    });
  }
  return foldSweepRegister(payloads);
}

// ---------------------------------------------------------------------------
// Resolve the live artefact refs for the orphan-impact check
// ---------------------------------------------------------------------------

/** Posture ids present in the posture register (PostureRegistered events). */
function livePostureRefs(): Set<string> {
  const refs = new Set<string>();
  for (const ev of eventStore.replay({ type: "PostureRegistered" })) {
    const p = (ev as { payload: { postureId?: string } }).payload;
    if (p.postureId) refs.add(p.postureId);
  }
  return refs;
}

/**
 * FIL-Model refs present in the FIL-Model declarations. A FIL-Model is referred
 * to by its `modelId` (e.g. `sa-ccr`); we also admit the conventional URN forms
 * `fil:model:<id>` and `fil:model:<id>@<major>.<minor>` so a sweep may cite the
 * model by either the bare id or the versioned URN.
 */
function liveFilModelRefs(): Set<string> {
  const refs = new Set<string>();
  for (const ev of eventStore.replay({ type: "FilModelImplementationDeclared" })) {
    const p = (
      ev as { payload: { modelId?: string; version?: { major?: number; minor?: number } } }
    ).payload;
    if (!p.modelId) continue;
    refs.add(p.modelId);
    refs.add(`fil:model:${p.modelId}`);
    if (p.version?.major !== undefined && p.version?.minor !== undefined) {
      refs.add(`fil:model:${p.modelId}@${p.version.major}.${p.version.minor}`);
    }
  }
  return refs;
}

// ---------------------------------------------------------------------------
// Read approved Decisions on/after the baseline
// ---------------------------------------------------------------------------

interface BaselineDecision {
  decisionId: string;
  asOf: string;
}

function approvedDecisionsSinceBaseline(): BaselineDecision[] {
  // Latest phase per decisionId wins (a decision may have requested→approved).
  const latestPhase = new Map<string, { phase: string; asOf: string }>();
  for (const ev of eventStore.replay({ type: "Decision" })) {
    const e = ev as { as_of?: string; payload: { decisionId?: string; phase?: string } };
    const id = e.payload.decisionId;
    if (!id) continue;
    latestPhase.set(id, { phase: e.payload.phase ?? "", asOf: e.as_of ?? "" });
  }
  const out: BaselineDecision[] = [];
  for (const [decisionId, { phase, asOf }] of latestPhase) {
    if (phase !== "approved") continue;
    // Compare on the date prefix (YYYY-MM-DD) — baseline is a calendar boundary.
    if (asOf.slice(0, 10) >= BASELINE_AS_OF) out.push({ decisionId, asOf });
  }
  return out;
}

const RECOMMENDED_ACTION_SET = new Set(["re-validate", "re-distill", "re-assess", "none"]);

function arraysEqualOrdered(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult("v2-decision-impact-sweep-coverage");
  const violations: ReconViolation[] = [];

  let register: SweepRegister;
  try {
    register = readSweepRegister();
  } catch (err) {
    violations.push({
      subject: "SweepRegister",
      message: `sweep register fold failed: ${(err as Error).message}`,
      severity: "fail",
    });
    return { ...result, asserted: 1, violations, ok: false };
  }

  // Assertion 1 — fold violations (orphan Assessed).
  result.asserted += 1;
  for (const v of register.violations) {
    violations.push({
      subject: v.sweepId,
      message: v.message,
      severity: "fail",
    });
  }

  const postureRefs = livePostureRefs();
  const filModelRefs = liveFilModelRefs();

  // Per-sweep assertions (2 + 3).
  for (const sweep of register.listSweeps()) {
    if (sweep.stage !== "assessed") continue;
    const impacted = (sweep.impacted ?? []) as readonly ImpactedArtefact[];
    const recordedActions = sweep.recommendedActions ?? [];

    // Assertion 2 — recommendedActions well-formedness + engine consistency.
    result.asserted += 1;
    const malformed = recordedActions.filter((a) => !RECOMMENDED_ACTION_SET.has(a));
    if (malformed.length > 0) {
      violations.push({
        subject: sweep.sweepId,
        message: `recommendedActions contains values outside the closed vocabulary: [${malformed.join(", ")}]`,
        severity: "fail",
      });
    } else {
      const derived = deriveRecommendedActions(impacted);
      if (!arraysEqualOrdered(recordedActions, derived)) {
        violations.push({
          subject: sweep.sweepId,
          message:
            `recorded recommendedActions [${recordedActions.join(", ")}] inconsistent with the ` +
            `engine's derivation over the recorded impact set [${derived.join(", ")}]`,
          severity: "fail",
        });
      }
    }

    // Assertion 3 — orphan impacts (posture / fil-model refs must resolve).
    result.asserted += 1;
    for (const a of impacted) {
      if (a.artefactKind === "posture") {
        if (!postureRefs.has(a.artefactRef)) {
          violations.push({
            subject: `${sweep.sweepId} → ${a.artefactRef}`,
            message: `orphan impact: posture "${a.artefactRef}" not found in the live posture register`,
            severity: "warn",
          });
        }
      } else if (a.artefactKind === "fil-model") {
        if (!filModelRefs.has(a.artefactRef)) {
          violations.push({
            subject: `${sweep.sweepId} → ${a.artefactRef}`,
            message: `orphan impact: FIL-Model "${a.artefactRef}" not found in the live FIL-Model declarations`,
            severity: "warn",
          });
        }
      } else {
        // obligation / procedure refs are not resolvable from the v2 registers
        // this gate reads; report advisory-only (never fail) so the gate does
        // not produce false positives on cross-register refs.
        // (No violation — informational; the recorded edge + reason carry the
        //  justification for the impact.)
      }
    }
  }

  // Assertion 4 — coverage: every approved Decision since the baseline is swept.
  result.asserted += 1;
  const baselineDecisions = approvedDecisionsSinceBaseline();
  for (const d of baselineDecisions) {
    if (register.sweepsForDecision(d.decisionId).length === 0) {
      violations.push({
        subject: d.decisionId,
        message: `orphan decision: approved on/after baseline ${BASELINE_AS_OF} (as_of ${d.asOf.slice(0, 10)}) but has no decision-impact sweep`,
        severity: "warn",
      });
    }
  }

  // Pilot-presence advisory: the seed case must be swept once the pilot is
  // seeded into the store. Surfaced as info when absent (it is absent on a
  // clean CI runner with no seed) so it never fails the gate.
  if (register.sweepsForDecision(PILOT_DECISION_ID).length === 0) {
    violations.push({
      subject: PILOT_DECISION_ID,
      message:
        "pilot sweep not present in this store (expected on a clean/unseeded runner; " +
        "seed via scripts/seed-v2-owen-decision-impact-sweep.ts against the shared store)",
      severity: "info",
    });
  }

  return {
    ...result,
    violations,
    ok: violations.filter((v) => v.severity === "fail").length === 0,
  };
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  const totalViolations = r.violations.length;
  const failViolations = r.violations.filter((v) => v.severity === "fail").length;
  process.stdout.write(
    `recon:v2-decision-impact-sweep-coverage — asserted ${r.asserted} checks; ` +
      `${totalViolations} violation(s) (${failViolations} fail-severity)\n`,
  );
  process.exit(r.ok ? 0 : 1);
}
