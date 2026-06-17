// dashboard/obligation-applicability.ts
//
// Shared read-side helper: the LATEST applicability verdict per assessment
// subject, folded from the W8 ApplicabilityAssessment{Requested,Performed,
// Concluded} lifecycle (D-W8-POSTURE-REGISTER-SLICE-1).
//
// The S8 lifecycle carries `subjectRef` ONLY on the Requested event; the
// Concluded payload does not. So we fold the full register (which propagates
// subjectRef from Requested onto each folded assessment) and keep only
// concluded assessments. When a subject has been re-assessed (e.g. a
// re-adoption on a later day against a fresh posture snapshot) we keep the
// LATEST by the Concluded event's `as_of`.
//
// Folds the register ONCE and indexes by subject so callers enriching many
// obligations (the reverse index) don't re-fold per row. `getObligationDetail`
// reuses the single-subject convenience wrapper — previously this logic was
// inlined there (Principle 1: a query over events, never stored state).
//
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../platform/event-store/store";
import { foldAssessmentRegister } from "../v2-core/applicability";

export interface LatestApplicability {
  verdict: "applies" | "partially-applies" | "does-not-apply";
  matchedContexts: string[];
  rationale: string;
}

/**
 * Fold the applicability register once and return the latest concluded verdict
 * for every subject (obligation id or posture id). Latest-wins is keyed on the
 * Concluded event's `as_of`.
 */
export function foldLatestApplicabilityBySubject(
  store: EventStore,
): Map<string, LatestApplicability> {
  // assessmentId → latest Concluded `as_of` (the latest-wins tiebreak basis).
  const concludedAt = new Map<string, string>();
  const payloads: unknown[] = [];

  for (const ev of store.replay({ type: "ApplicabilityAssessmentRequested" })) {
    payloads.push({ kind: "ApplicabilityAssessmentRequested", ...(ev.payload as object) });
  }
  for (const ev of store.replay({ type: "ApplicabilityAssessmentPerformed" })) {
    payloads.push({ kind: "ApplicabilityAssessmentPerformed", ...(ev.payload as object) });
  }
  for (const ev of store.replay({ type: "ApplicabilityAssessmentConcluded" })) {
    payloads.push({ kind: "ApplicabilityAssessmentConcluded", ...(ev.payload as object) });
    const aid = (ev.payload as { assessmentId?: string }).assessmentId;
    const at = ev.as_of ?? "";
    if (aid && (!concludedAt.has(aid) || at > (concludedAt.get(aid) ?? ""))) {
      concludedAt.set(aid, at);
    }
  }

  const register = foldAssessmentRegister(payloads);
  const bySubject = new Map<string, LatestApplicability>();
  const latestAtBySubject = new Map<string, string>();

  for (const a of register.listAssessments()) {
    if (a.stage !== "concluded" || a.verdict === undefined) continue;
    const at = concludedAt.get(a.assessmentId) ?? "";
    const prevAt = latestAtBySubject.get(a.subjectRef);
    if (prevAt !== undefined && at <= prevAt) continue;
    bySubject.set(a.subjectRef, {
      verdict: a.verdict,
      matchedContexts: [...(a.appliesToContexts ?? [])],
      rationale: a.rationale ?? "",
    });
    latestAtBySubject.set(a.subjectRef, at);
  }
  return bySubject;
}

/** The latest applicability verdict for a single subject, or undefined. */
export function latestApplicabilityForSubject(
  store: EventStore,
  subjectRef: string,
): LatestApplicability | undefined {
  return foldLatestApplicabilityBySubject(store).get(subjectRef);
}
