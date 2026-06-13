// scripts/file-mira-v2-s8-applicability-assessment-design-note.ts
//
// One-shot RMS Phase 3 filing for Mira's V2 S8 applicability-assessment design
// note. Records the lifecycle, the engine contract, the pilot verdict, and how
// this composes with the S9 decision-impact sweeps. Idempotent — skips if filed.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-RMS-PHASE-3 (active).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:mira:v2-s8-applicability-assessment-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-mira-v2-s8-applicability-assessment-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 S8 — applicability-assessment lifecycle: design note

**Author:** Mira (Chief Obligations & Regulatory Officer, compliance)
**With input from:** Zara (Chief Compliance Officer, governance) on the conduct/compliance assessment dimension
**Date:** 2026-06-13
**Authority:** D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Atlas (Core banking platform architect, engineering); Helena (Chief Risk Officer, governance)
**Status:** Implemented — PR feat(v2-s8): applicability-assessment lifecycle (WS-V2-BBAAS)

---

## 1. What S8 adds

S3 landed the APPLIES_WHEN seam: the typed \`AppliesToScope\` predicate, the pure
\`evaluateAppliesToScope(scope, context)\` evaluator, \`PostureContext\`, and the
posture register. S8 adds the **applicability-assessment lifecycle** — the typed
process that, when a regulatory change / new obligation / candidate posture
arrives, **assesses which contexts (entities, products, jurisdictions) it applies
to** using the S3 evaluator, and records the assessment + verdict as events.

This turns "here is a new rule" into "here is exactly what it binds, asserted and
replayable" (Principle 1 + Principle 2). S8 reuses the S3 evaluator unchanged —
it adds no new predicate types.

## 2. The lifecycle (event family)

Three typed events, registered across all three sites (event-type registry +
v1-side adapter + provenance-category=governance), retention governance-7y:

| event | meaning |
|---|---|
| \`ApplicabilityAssessmentRequested\` | a trigger opens an assessment, carrying the subject's \`AppliesToScope\`, its \`subjectKind\` (posture / obligation / regulatory-change / decision), \`requestedBy\`, citations |
| \`ApplicabilityAssessmentPerformed\` | the engine ran over the candidate contexts; records \`contextsEvaluated\` (the full input set) + \`matches\` |
| \`ApplicabilityAssessmentConcluded\` | the verdict (\`applies\` / \`does-not-apply\` / \`partially-applies\`) + \`appliesToContexts\` + rationale + \`concludedBy\` |

The register projection (\`v2-core/applicability/projection.ts\`) folds the three
events by \`assessmentId\` and answers \`getAssessment(id)\`, \`listAssessments()\`,
\`assessmentsForSubject(ref)\`. An orphan Performed/Concluded (no opening Requested)
is a fold violation surfaced to the recon gate.

## 3. The engine contract

\`\`\`
assessApplicability(scope: AppliesToScope, candidates: AssessedContext[])
  → { matches: string[], verdict: ApplicabilityVerdict, rationale: string }
\`\`\`

Pure: evaluates each candidate via the S3 \`evaluateAppliesToScope\`, collecting the
\`contextRef\`s whose predicate held (preserving input order). The verdict is
**derived** from the match count over the candidate set, never hand-asserted:
all matched → \`applies\`; none → \`does-not-apply\`; some → \`partially-applies\`. No
I/O, no emission — the caller (a seed script or an autonomous agent run) emits the
lifecycle events around the engine's output.

## 4. Pilot verdict

The pilot (\`scripts/seed-v2-mira-applicability-assessment.ts\`) assesses Helena's
FX trading-book VaR posture \`posture:risk-appetite:fx-var\` (scope: ZA ∧ RT-MK ∧
\`fil:type:fx:*\`, read live from the posture register) against the anchor ZA bank's
three active product books:

| candidate context | product taxonomy | matched? |
|---|---|---|
| FX OTC vanilla | fil:type:fx:spot:otc-vanilla@1.0 | ✅ yes |
| vanilla IRS | fil:type:ir:swap.vanilla:zar-jibar@1.0 | ✗ no |
| SA govt bond | fil:type:ir:bond.govt:sagb@1.0 | ✗ no |

**Verdict: \`partially-applies\` (1/3).** The FX market-risk VaR posture binds only
the FX book — the rates book (IRS, bond) is RT-MK too but its product taxonomy is
\`fil:type:ir:*\`, not \`fx:*\`, so the posture does not bind it. This is the real
regulatory result an applicability assessment exists to assert and replay. The
seed is idempotent (skips if already concluded).

## 5. Recon gate

\`recon:v2-applicability-assessment-integrity\` (advisory, wired into
\`ci:recon:infra\`) asserts:

1. No fold violations (orphan Performed / Concluded).
2. Every concluded verdict is well-formed (closed verdict set).
3. **Engine-consistency** — re-running the pure engine over the recorded
   \`appliesToScope\` + \`contextsEvaluated\` reproduces the recorded verdict and the
   recorded matched-context set. A recorded verdict that disagrees with the
   evaluator over its own recorded scope is a hard finding.

## 6. Composition with S9 decision-impact sweeps

An assessment trigger is typed by \`subjectKind\`, and \`decision\` is one of the four
kinds. A decision-impact sweep (S9) is therefore **one kind of applicability
assessment**: when a Decision lands that changes a posture's scope or introduces a
new obligation, S9 opens an \`ApplicabilityAssessmentRequested{ subjectKind:
"decision" }\` carrying the affected scope, runs the same engine over the anchor
contexts, and concludes which contexts the decision now binds. S8 is the typed
substrate; S9 is the auto-trigger that feeds it (out of scope for S8 — manual /
seeded trigger only this slice).

## 7. Package boundary

All assessment types + the engine + the projection live in
\`v2-core/applicability/\` (no v1 imports). The v1-side adapter
(\`platform/event-store/event-types/applicability-assessment.ts\`) imports FROM
v2-core; this is the permitted direction. \`recon:v2-no-v1-import\` holds.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-W8-POSTURE-REGISTER-SLICE-1",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-RMS-PHASE-3",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:mira:obligations-officer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S8 — applicability-assessment lifecycle: design note",
      path: "2026-06-13_mira_v2-s8-applicability-assessment-design-note.md",
      category: "design-note",
      author: "Mira (Chief Obligations & Regulatory Officer, compliance)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
