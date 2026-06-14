// v2-core/eval/posture-exam-set.ts
//
// V2 S13 (W8 Slice B) — the PILOT posture exam-set + its citations.
//
// The exam-set is the assurance battery for the FX VaR risk-appetite posture
// `posture:risk-appetite:fx-var`, whose APPLIES_WHEN scope is
//   ZA  ∧  RT-MK (market risk)  ∧  fil:type:fx:*   (Helena's RAS §B4 posture).
//
// The exams pin the posture's scope-evaluation behaviour:
//   1. positive match  — the in-scope FX/ZA/market-risk context APPLIES.
//   2. wrong jurisdiction (GB) — does NOT apply (the ZA conjunct fails).
//   3. wrong risk-class (RT-CR) — does NOT apply (the RT-MK conjunct fails).
//   4. ADVERSARIAL: an IR product (fil:type:ir:swap) in the otherwise-valid
//      ZA/RT-MK context — does NOT apply (the fil:type:fx:* prefix-wildcard does
//      not match an IR scope). This is the known-negative the posture must
//      correctly reject; D-W8-EXAM-GOVERNANCE mandates ≥1 adversarial exam.
//   5. posture-active — a valid in-scope context: the registered+activated
//      posture is ACTIVE (the live getActivePostures reading).
//
// OWNERSHIP (D-W8-EXAM-GOVERNANCE): Helena (Chief Risk Officer, governance) OWNS
// posture exam-sets — the exam-set's registeredBy/owner on the ExamSetRegistered
// event is Helena. Vera (Internal Audit Engineer, governance) authors the exam
// STANDARD code (this file), mirroring the SA-CCR precedent.
//
// The scenario tokens (riskClass "RT-MK", filTaxonomyScope "fil:type:fx:..." and
// "fil:type:ir:swap", jurisdiction "ZA"/"GB") match the EXACT predicate scope
// `posture:risk-appetite:fx-var` is seeded with in
// `scripts/seed-v2-helena-ras-postures.ts` — else the positive exam would not
// match.
//
// PACKAGE BOUNDARY: no v1 imports. Intra-package relatives only.
//
// Authority: D-W8-EXAM-GOVERNANCE; D-W8-POSTURE-REGISTER-SLICE-1;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RAS (RAS §B4). Principle 1; Principle 2.
// Author: Vera (Internal Audit Engineer, governance), exam standard;
//         owner Helena (Chief Risk Officer, governance).

import type { CitationRef } from "../fil-core/primitives";
import type { Exam, ExamSet } from "./exam";

// The subject posture this set evaluates.
export const POSTURE_PILOT_POSTURE_ID = "posture:risk-appetite:fx-var";

/** The owning seat for posture exam-sets (D-W8-EXAM-GOVERNANCE). */
export const POSTURE_EXAM_SET_OWNER = "Helena (Chief Risk Officer, governance)";

const C = (s: string) => s as CitationRef;

// ---------------------------------------------------------------------------
// The pilot posture exam-set
// ---------------------------------------------------------------------------

/**
 * The FX VaR posture pilot exam-set (`examset:posture:risk-appetite:fx-var`).
 * Five exams over the `posture:risk-appetite:fx-var` scope (ZA ∧ RT-MK ∧
 * fil:type:fx:*), including the mandated adversarial exam.
 */
export const POSTURE_PILOT_EXAM_SET: ExamSet = {
  examSetId: "examset:posture:risk-appetite:fx-var",
  subjectKind: "posture",
  subjectScope: POSTURE_PILOT_POSTURE_ID,
  version: "1.0",
  citations: [
    C("D-W8-EXAM-GOVERNANCE"),
    C("D-W8-POSTURE-REGISTER-SLICE-1"),
    C("D-V2-BBAAS-BLUEPRINT-SYNTHESIS"),
    C("D-RAS"),
  ],
  exams: buildPostureExams(),
};

function buildPostureExams(): Exam[] {
  return [
    // ── Exam 1: positive match — in-scope FX/ZA/market-risk context ──────────
    {
      examId: "exam:posture:fx-var:positive-match",
      subjectKind: "posture",
      subjectScope: POSTURE_PILOT_POSTURE_ID,
      description:
        "The FX VaR posture APPLIES in its native scope: jurisdiction ZA, risk-class " +
        "RT-MK, FIL taxonomy fil:type:fx:spot:otc-vanilla@1.0 — all three conjuncts of " +
        "the APPLIES_WHEN predicate hold, so the posture applies.",
      scenario: {
        jurisdiction: "ZA",
        riskClass: "RT-MK",
        filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
      },
      expectation: { kind: "equals", field: "applies", value: true },
      citation: C("D-RAS"),
    },
    // ── Exam 2: wrong jurisdiction (GB) — does not apply ─────────────────────
    {
      examId: "exam:posture:fx-var:wrong-jurisdiction",
      subjectKind: "posture",
      subjectScope: POSTURE_PILOT_POSTURE_ID,
      description:
        "A GB jurisdiction context does NOT match the ZA-scoped posture: the " +
        "jurisdiction conjunct fails, so the posture does not apply.",
      scenario: {
        jurisdiction: "GB",
        riskClass: "RT-MK",
        filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
      },
      expectation: { kind: "equals", field: "applies", value: false },
      citation: C("D-W8-POSTURE-REGISTER-SLICE-1"),
    },
    // ── Exam 3: wrong risk-class (RT-CR) — does not apply ────────────────────
    {
      examId: "exam:posture:fx-var:wrong-risk-class",
      subjectKind: "posture",
      subjectScope: POSTURE_PILOT_POSTURE_ID,
      description:
        "A credit-risk (RT-CR) context does NOT match the market-risk (RT-MK) posture: " +
        "the risk-class conjunct fails, so the posture does not apply.",
      scenario: {
        jurisdiction: "ZA",
        riskClass: "RT-CR",
        filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
      },
      expectation: { kind: "equals", field: "applies", value: false },
      citation: C("D-W8-POSTURE-REGISTER-SLICE-1"),
    },
    // ── Exam 4: ADVERSARIAL — IR product in otherwise-valid context ──────────
    // The product-scope conjunct is fil:type:fx:* (a prefix wildcard); an IR
    // swap (fil:type:ir:swap) is NOT under that prefix. The posture must reject
    // it even though jurisdiction + risk-class match. This is the known-negative
    // the posture's scope-evaluation must get right (D-W8-EXAM-GOVERNANCE
    // adversarial-pass rule).
    {
      examId: "exam:posture:fx-var:adversarial-ir-product",
      adversarial: true,
      subjectKind: "posture",
      subjectScope: POSTURE_PILOT_POSTURE_ID,
      description:
        "ADVERSARIAL: an interest-rate product (fil:type:ir:swap) in an otherwise-valid " +
        "ZA/RT-MK context must NOT match the FX posture — the fil:type:fx:* prefix " +
        "wildcard does not cover an IR scope. The posture must correctly reject a " +
        "product outside its taxonomy even when the other conjuncts pass.",
      scenario: {
        jurisdiction: "ZA",
        riskClass: "RT-MK",
        filTaxonomyScope: "fil:type:ir:swap",
      },
      expectation: { kind: "equals", field: "applies", value: false },
      citation: C("D-W8-EXAM-GOVERNANCE"),
    },
    // ── Exam 5: posture-active — valid context, posture is live/active ────────
    {
      examId: "exam:posture:fx-var:posture-active",
      subjectKind: "posture",
      subjectScope: POSTURE_PILOT_POSTURE_ID,
      description:
        "In its native scope (ZA ∧ RT-MK ∧ fil:type:fx:*), the registered + activated " +
        "FX VaR posture is ACTIVE — the live getActivePostures reading a real evaluation " +
        "would act on (active AND in-scope).",
      scenario: {
        jurisdiction: "ZA",
        riskClass: "RT-MK",
        filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
      },
      expectation: { kind: "equals", field: "postureActive", value: true },
      citation: C("D-RAS"),
    },
  ];
}
