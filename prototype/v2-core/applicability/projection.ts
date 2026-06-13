// v2-core/applicability/projection.ts
//
// Applicability-assessment register projection (V2 S8) — a pure fold over the
// three lifecycle events that produces the canonical assessment register.
//
//   getAssessment(id)            — a single assessment record (latest fold state)
//   listAssessments()            — all assessments (any lifecycle stage)
//   assessmentsForSubject(ref)   — all assessments whose subjectRef matches
//
// PRINCIPLE 1 INVARIANT: the register is a query over events, not stored state.
// The fold is deterministic and replayable from any suffix of the event log.
// Every Concluded folds onto its Requested (an orphan Concluded — one with no
// matching Requested — is a fold violation surfaced for the recon gate).
//
// Mirrors the posture register projection pattern (`posture/projection.ts`):
// tolerant fold, violations accumulated rather than thrown, latest-wins per key.
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { AppliesToScope } from "../posture";
import type {
  ApplicabilitySubjectKind,
  ApplicabilityVerdict,
  AssessedContext,
} from "./events";

// ---------------------------------------------------------------------------
// Assessment record — the projected state of a single assessment
// ---------------------------------------------------------------------------

/** The lifecycle stage an assessment has reached, derived from folded events. */
export type AssessmentStage = "requested" | "performed" | "concluded";

/**
 * The projected state of a single applicability assessment. A fold output —
 * never stored directly; always derived from events (Principle 1).
 */
export interface Assessment {
  readonly assessmentId: string;
  readonly subjectRef: string;
  readonly subjectKind: ApplicabilitySubjectKind;
  readonly appliesToScope: AppliesToScope;
  readonly requestedBy: string;
  readonly citations: readonly string[];
  /** The furthest lifecycle stage reached. */
  readonly stage: AssessmentStage;
  // --- Performed fields (present once Performed has folded) ---
  readonly contextsEvaluated?: readonly AssessedContext[];
  readonly matches?: readonly string[];
  readonly performedBy?: string;
  // --- Concluded fields (present once Concluded has folded) ---
  readonly verdict?: ApplicabilityVerdict;
  readonly appliesToContexts?: readonly string[];
  readonly rationale?: string;
  readonly concludedBy?: string;
}

// ---------------------------------------------------------------------------
// Internal mutable state
// ---------------------------------------------------------------------------

interface AssessmentState {
  assessmentId: string;
  subjectRef: string;
  subjectKind: ApplicabilitySubjectKind;
  appliesToScope: AppliesToScope;
  requestedBy: string;
  citations: readonly string[];
  stage: AssessmentStage;
  contextsEvaluated: readonly AssessedContext[] | undefined;
  matches: readonly string[] | undefined;
  performedBy: string | undefined;
  verdict: ApplicabilityVerdict | undefined;
  appliesToContexts: readonly string[] | undefined;
  rationale: string | undefined;
  concludedBy: string | undefined;
}

// ---------------------------------------------------------------------------
// Raw event shapes understood by the fold
// ---------------------------------------------------------------------------

interface RawRequested {
  kind: "ApplicabilityAssessmentRequested";
  assessmentId: string;
  subjectRef: string;
  subjectKind: ApplicabilitySubjectKind;
  appliesToScope: AppliesToScope;
  requestedBy: string;
  citations: readonly string[];
}

interface RawPerformed {
  kind: "ApplicabilityAssessmentPerformed";
  assessmentId: string;
  contextsEvaluated: readonly AssessedContext[];
  matches: readonly string[];
  performedBy: string;
}

interface RawConcluded {
  kind: "ApplicabilityAssessmentConcluded";
  assessmentId: string;
  verdict: ApplicabilityVerdict;
  appliesToContexts: readonly string[];
  rationale: string;
  concludedBy: string;
  citations: readonly string[];
}

type RawAssessmentEvent = RawRequested | RawPerformed | RawConcluded;

// ---------------------------------------------------------------------------
// Register surface
// ---------------------------------------------------------------------------

export interface AssessmentRegister {
  /** A single assessment by id, or `null` if no Requested with that id folded. */
  getAssessment(assessmentId: string): Assessment | null;
  /** All assessments in the register. */
  listAssessments(): Assessment[];
  /** All assessments whose `subjectRef` equals `ref`. */
  assessmentsForSubject(ref: string): Assessment[];
  /** Structural integrity findings surfaced during fold (for the recon gate). */
  readonly violations: readonly AssessmentRegisterViolation[];
  /** Total number of events folded. */
  readonly eventCount: number;
}

export interface AssessmentRegisterViolation {
  readonly assessmentId: string;
  readonly kind: "orphan-performed" | "orphan-concluded";
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

class AssessmentRegisterAccumulator {
  private readonly byId = new Map<string, AssessmentState>();
  readonly violations: AssessmentRegisterViolation[] = [];
  eventCount = 0;

  fold(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) return;
    const ev = raw as Partial<RawAssessmentEvent>;
    if (typeof ev.kind !== "string") return;

    switch (ev.kind as string) {
      case "ApplicabilityAssessmentRequested": {
        const e = ev as RawRequested;
        if (!e.assessmentId || !e.subjectRef || !e.appliesToScope) return;
        this.eventCount += 1;
        // Latest-wins for idempotent reseeds: a duplicate Requested overwrites
        // the request fields but preserves any later-stage progress already
        // folded only if it arrives first; in practice the seed is idempotent
        // so re-requests carry identical fields.
        const existing = this.byId.get(e.assessmentId);
        this.byId.set(e.assessmentId, {
          assessmentId: e.assessmentId,
          subjectRef: e.subjectRef,
          subjectKind: e.subjectKind,
          appliesToScope: e.appliesToScope,
          requestedBy: e.requestedBy ?? "",
          citations: e.citations ?? [],
          stage: existing?.stage ?? "requested",
          contextsEvaluated: existing?.contextsEvaluated,
          matches: existing?.matches,
          performedBy: existing?.performedBy,
          verdict: existing?.verdict,
          appliesToContexts: existing?.appliesToContexts,
          rationale: existing?.rationale,
          concludedBy: existing?.concludedBy,
        });
        break;
      }
      case "ApplicabilityAssessmentPerformed": {
        const e = ev as RawPerformed;
        if (!e.assessmentId) return;
        this.eventCount += 1;
        const state = this.byId.get(e.assessmentId);
        if (!state) {
          this.violations.push({
            assessmentId: e.assessmentId,
            kind: "orphan-performed",
            message: `ApplicabilityAssessmentPerformed for un-requested assessmentId: ${e.assessmentId}`,
          });
          return;
        }
        state.contextsEvaluated = e.contextsEvaluated;
        state.matches = e.matches;
        state.performedBy = e.performedBy;
        if (state.stage === "requested") state.stage = "performed";
        break;
      }
      case "ApplicabilityAssessmentConcluded": {
        const e = ev as RawConcluded;
        if (!e.assessmentId) return;
        this.eventCount += 1;
        const state = this.byId.get(e.assessmentId);
        if (!state) {
          this.violations.push({
            assessmentId: e.assessmentId,
            kind: "orphan-concluded",
            message: `ApplicabilityAssessmentConcluded for un-requested assessmentId: ${e.assessmentId}`,
          });
          return;
        }
        state.verdict = e.verdict;
        state.appliesToContexts = e.appliesToContexts;
        state.rationale = e.rationale;
        state.concludedBy = e.concludedBy;
        state.stage = "concluded";
        break;
      }
      default:
        // Unknown event kind — skip silently (forward-compat). Not counted.
        break;
    }
  }

  toRegister(): AssessmentRegister {
    const snapshot = new Map(this.byId);
    const violations = [...this.violations];
    const eventCount = this.eventCount;

    return {
      getAssessment(assessmentId: string): Assessment | null {
        const s = snapshot.get(assessmentId);
        return s ? stateToAssessment(s) : null;
      },
      listAssessments(): Assessment[] {
        return Array.from(snapshot.values()).map(stateToAssessment);
      },
      assessmentsForSubject(ref: string): Assessment[] {
        return Array.from(snapshot.values())
          .filter((s) => s.subjectRef === ref)
          .map(stateToAssessment);
      },
      violations,
      eventCount,
    };
  }
}

function stateToAssessment(s: AssessmentState): Assessment {
  return {
    assessmentId: s.assessmentId,
    subjectRef: s.subjectRef,
    subjectKind: s.subjectKind,
    appliesToScope: s.appliesToScope,
    requestedBy: s.requestedBy,
    citations: s.citations,
    stage: s.stage,
    ...(s.contextsEvaluated !== undefined ? { contextsEvaluated: s.contextsEvaluated } : {}),
    ...(s.matches !== undefined ? { matches: s.matches } : {}),
    ...(s.performedBy !== undefined ? { performedBy: s.performedBy } : {}),
    ...(s.verdict !== undefined ? { verdict: s.verdict } : {}),
    ...(s.appliesToContexts !== undefined ? { appliesToContexts: s.appliesToContexts } : {}),
    ...(s.rationale !== undefined ? { rationale: s.rationale } : {}),
    ...(s.concludedBy !== undefined ? { concludedBy: s.concludedBy } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** An empty assessment register. */
export function emptyAssessmentRegister(): AssessmentRegister {
  return new AssessmentRegisterAccumulator().toRegister();
}

/**
 * Fold a sequence of raw event payloads into an assessment register. The
 * primary projection entry point. Tolerant fold: unknown shapes skipped;
 * structural violations accumulated rather than thrown.
 */
export function foldAssessmentRegister(rawEvents: unknown[]): AssessmentRegister {
  const acc = new AssessmentRegisterAccumulator();
  for (const ev of rawEvents) {
    acc.fold(ev);
  }
  return acc.toRegister();
}
