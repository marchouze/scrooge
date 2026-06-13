// scripts/seed-v2-mira-applicability-assessment.ts
//
// Pilot seed (V2 S8): one real applicability assessment.
//
// Subject: Helena's (Chief Risk Officer, governance) FX trading-book VaR posture
//   `posture:risk-appetite:fx-var` (seeded in S3), whose APPLIES_WHEN scope is
//   ZA ∧ RT-MK ∧ fil:type:fx:* (RAS §B4).
//
// We assess this posture against the anchor ZA bank's three active product
// contexts (FX OTC vanilla / vanilla IRS / SA government bond). The engine
// (`assessApplicability`, pure) evaluates the posture's scope over each
// candidate via the S3 `evaluateAppliesToScope` evaluator and derives the
// verdict + matched contexts. We then emit the full lifecycle:
//   ApplicabilityAssessmentRequested → ...Performed → ...Concluded
//
// Expected verdict: `partially-applies` — the FX product matches (RT-MK +
// fil:type:fx:* scope); the IRS and bond products are RT-MK but their product
// taxonomy is fil:type:ir:* (not fx:*), so the FX-VaR posture does NOT bind them.
// This is the real regulatory result: an FX market-risk posture binds only the
// FX book, not the rates book — exactly what an applicability assessment exists
// to assert and replay (Principle 1 + Principle 2).
//
// Idempotent: re-running when the assessment is already concluded is a no-op.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-mira-applicability-assessment.ts
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
//   D-RAS (CRO-approved 2026-05-06). Principle 1 (events are truth).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance),
//         with input from Zara (Chief Compliance Officer, governance) on the
//         conduct/compliance assessment dimension.

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  type AssessedContext,
  assessApplicability,
} from "../v2-core/applicability";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import type { AppliesToScope } from "../v2-core/posture";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:obligations-officer" };

const ASSESSMENT_ID = "assessment:posture:fx-var-vs-anchor-products:2026-06-13";
const SUBJECT_POSTURE_ID = "posture:risk-appetite:fx-var";

const CITATIONS = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-RAS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// ---------------------------------------------------------------------------
// Resolve the subject's APPLIES_WHEN scope from the live posture register.
// We read the canonical PostureRegistered event for the FX-VaR posture rather
// than hardcoding the predicate — the assessment is OF the real posture as it
// stands in the register (Principle 1).
// ---------------------------------------------------------------------------

function resolveSubjectScope(): AppliesToScope {
  let scope: AppliesToScope | null = null;
  for (const ev of eventStore.replay({ type: "PostureRegistered" })) {
    const p = ev.payload as { postureId?: string; appliesToScope?: AppliesToScope };
    if (p.postureId === SUBJECT_POSTURE_ID && p.appliesToScope) {
      scope = p.appliesToScope; // latest-wins
    }
  }
  if (scope === null) {
    // Fall back to the seeded predicate if the posture register has not been
    // seeded in this store (keeps the pilot runnable on a fresh install).
    process.stderr.write(
      `[warn] ${SUBJECT_POSTURE_ID} not found in PostureRegistered; using the canonical S3 seed predicate.\n`,
    );
    return {
      kind: "and",
      conditions: [
        { kind: "jurisdiction", jurisdiction: "ZA" },
        { kind: "risk-class", riskClass: "RT-MK" },
        { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
      ],
    };
  }
  return scope;
}

// ---------------------------------------------------------------------------
// Candidate contexts: the anchor ZA bank's three active product books.
// All three are ZA + market-risk (RT-MK); they differ only in product taxonomy.
// ---------------------------------------------------------------------------

const CANDIDATES: readonly AssessedContext[] = [
  {
    contextRef: "product:fx-otc-vanilla@LE-ZA-HOZ-BANK",
    context: {
      jurisdiction: "ZA",
      entityType: "bank",
      riskClass: "RT-MK",
      filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
    },
  },
  {
    contextRef: "product:ir-swap-vanilla@LE-ZA-HOZ-BANK",
    context: {
      jurisdiction: "ZA",
      entityType: "bank",
      riskClass: "RT-MK",
      filTaxonomyScope: "fil:type:ir:swap.vanilla:zar-jibar@1.0",
    },
  },
  {
    contextRef: "product:bond-govt-sagb@LE-ZA-HOZ-BANK",
    context: {
      jurisdiction: "ZA",
      entityType: "bank",
      riskClass: "RT-MK",
      filTaxonomyScope: "fil:type:ir:bond.govt:sagb@1.0",
    },
  },
];

// ---------------------------------------------------------------------------
// Idempotency: skip if this assessment is already concluded.
// ---------------------------------------------------------------------------

const alreadyConcluded = [
  ...eventStore.replay({ type: "ApplicabilityAssessmentConcluded" }),
].some((e) => (e.payload as { assessmentId?: string }).assessmentId === ASSESSMENT_ID);

if (alreadyConcluded) {
  process.stdout.write(
    `seed:v2-mira-applicability-assessment — ${ASSESSMENT_ID} already concluded; nothing to emit\n`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Run the engine (pure) and emit the lifecycle.
// ---------------------------------------------------------------------------

const subjectScope = resolveSubjectScope();
const asOf = clock.now();
const result = assessApplicability(subjectScope, CANDIDATES);

const citations = CITATIONS.map((c) => c as string);

const batch: Event[] = [];

batch.push(
  makeApplicabilityAssessmentRequested({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations,
    payload: {
      assessmentId: ASSESSMENT_ID,
      subjectRef: SUBJECT_POSTURE_ID,
      subjectKind: "posture",
      appliesToScope: subjectScope,
      requestedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
      citations: citations as unknown as CitationRef[],
    },
  }),
);

batch.push(
  makeApplicabilityAssessmentPerformed({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations,
    payload: {
      assessmentId: ASSESSMENT_ID,
      contextsEvaluated: CANDIDATES,
      matches: result.matches,
      performedBy: "agent:mira:obligations-officer",
      performedAt: asOf as unknown as Instant,
    },
  }),
);

batch.push(
  makeApplicabilityAssessmentConcluded({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations,
    payload: {
      assessmentId: ASSESSMENT_ID,
      verdict: result.verdict,
      appliesToContexts: result.matches,
      rationale: result.rationale,
      concludedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
      concludedAt: asOf as unknown as Instant,
      citations: citations as unknown as CitationRef[],
    },
  }),
);

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit("ApplicabilityAssessmentRequested") });
}

process.stdout.write(
  `seed:v2-mira-applicability-assessment — emitted ${batch.length} events\n` +
    `  subject:  ${SUBJECT_POSTURE_ID}\n` +
    `  verdict:  ${result.verdict}\n` +
    `  matched:  ${result.matches.length}/${CANDIDATES.length} — [${result.matches.join(", ")}]\n` +
    `  rationale: ${result.rationale}\n`,
);
