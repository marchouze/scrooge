// scripts/file-owen-v2-s9-decision-impact-sweep-design-note.ts
//
// One-shot RMS Phase 3 filing for Owen's V2 S9 decision-impact sweep design
// note. Records the sweep contract, how impact is computed (citation graph +
// scope overlap), the pilot result over D-SACCR-V2-CUTOVER-ACCELERATE, and how
// this closes the W8 loop (posture register S3 → applicability S8 →
// decision-impact S9). Idempotent — skips if filed.
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3 (active).
// Author: Owen (Company Secretary, governance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:owen:v2-s9-decision-impact-sweep-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-owen-v2-s9-decision-impact-sweep-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 S9 — decision-impact sweeps: design note

**Author:** Owen (Company Secretary, governance)
**With:** Atlas (Substrate Architect, engineering) on the sweep engine
**Date:** 2026-06-13
**Authority:** D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13); D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Helena (Chief Risk Officer, governance); Mira (Chief Obligations & Regulatory Officer, compliance); Nadia (model validation)
**Status:** Implemented — PR feat(v2-s9): decision-impact sweeps — W8 governance keystone (WS-V2-BBAAS)

---

## 1. What S9 is — the governance keystone of W8

When a \`Decision\` event lands, its downstream impact today lives in an agent's
working memory and a prose follow-on list — exactly the implicit linkage
Principle 2 exists to eliminate. S9 turns **"what does this decision touch?"**
into a query over the graph: an automated sweep computes which downstream
artefacts a decision affects — postures, FIL-Models, obligations, procedures —
and emits a typed impact record surfacing what must be re-validated,
re-distilled, or re-assessed. An orphaned impact becomes a recon finding.

Structured-first (D-W8-DECISION-IMPACT-SWEEP): the sweep **RECOMMENDS**;
agents / decisions **dispose**. S9 never auto-executes a recommended action and
never mutates an impacted artefact.

## 2. The event family

Two typed events, registered across all three sites (event-type registry +
v1-side adapter + provenance-category=governance), retention governance-7y:

| event | meaning |
|---|---|
| \`DecisionImpactSweepRequested\` | a Decision triggers a sweep (\`sweepId\`, \`decisionId\`, \`sweptAt\`, \`triggeredBy\`, citations) |
| \`DecisionImpactAssessed\` | the result: \`impacted: [{ artefactKind: posture\\|fil-model\\|obligation\\|procedure, artefactRef, reason, edge }]\` + \`recommendedActions: [re-validate \\| re-distill \\| re-assess \\| none]\` + rationale |

The register projection (\`v2-core/decision-impact/projection.ts\`) folds the two
events by \`sweepId\` and answers \`getSweep(id)\`, \`listSweeps()\`,
\`sweepsForDecision(id)\`, \`impactsForDecision(id)\`. An orphan Assessed (no opening
Requested) is a fold violation surfaced to the recon gate.

## 3. The sweep engine contract

\`\`\`
computeDecisionImpact(decision: SweptDecision, candidates: CandidateArtefact[])
  → { impacted: ImpactedArtefact[], recommendedActions: RecommendedAction[], rationale: string }
\`\`\`

Pure, deterministic, idempotent (no I/O, no emission, no mutation). The caller
reads the candidate artefacts from the live registers, runs the engine, and
emits the lifecycle around its output (Principle 1). Impact is computed from two
dimensions — every edge is an **explicit, citable graph link** (Principle 2):

1. **Citation graph**
   - artefacts that cite the decision (downstream consumers) → edge \`cites-decision\`
   - artefacts the decision cites that propagate → edge \`cited-by-decision\`
   - artefacts citing a decision THIS decision supersedes → edge \`supersedes\`
2. **Scope overlap** — artefacts whose APPLIES_WHEN scope intersects the
   decision's subject scope → edge \`scope-overlap\`. This **reuses the S3
   \`evaluateAppliesToScope\` evaluator** — the same evaluator the S8 assessment
   engine uses (a decision is one S8 \`subjectKind\`).

An artefact appears under at most one edge — the most-direct in precedence
(\`cites-decision\` > \`supersedes\` > \`cited-by-decision\` > \`scope-overlap\`).
\`recommendedActions\` is **derived** from the impact set (fil-model → re-validate;
obligation → re-distill; posture/procedure → re-assess; empty set → \`none\`),
never hand-asserted — the recon gate re-runs the derivation to confirm.

## 4. Pilot — sweep over D-SACCR-V2-CUTOVER-ACCELERATE

The pilot (\`scripts/seed-v2-owen-decision-impact-sweep.ts\`) sweeps this session's
SA-CCR alias-flip cutover decision. It reads the candidate graph from the live
store and produces:

| edge | kind | artefact | recommended |
|---|---|---|---|
| cites-decision | fil-model | \`sa-ccr\` | re-validate (done by Nadia) |
| cites-decision | obligation | \`urn:reg:bcbs:cre52:sa-ccr\` | re-distill |
| cites-decision | procedure | \`proc:ba-700-rwa-consumers\` | re-assess |
| cites-decision | procedure | \`proc:sa-ccr-daily-cadence\` | re-assess |
| scope-overlap | posture | \`posture:risk-appetite:fx-var\` | re-assess |

**recommendedActions: \`[re-validate, re-distill, re-assess]\`.** This is exactly
the set the brief calls for: the SA-CCR FIL-Model (re-validate — already done by
Nadia's independent validation), the RAS/posture line (the FX-VaR posture, found
by scope overlap with the cutover's FX subject), the BA-700/RWA consumers, and
the SA-CCR obligation/procedures. The seed is idempotent (skips if assessed).

## 5. Recon gate + baseline

\`recon:v2-decision-impact-sweep-coverage\` (advisory, wired into
\`ci:recon:infra\`) asserts:

1. No fold violations (orphan Assessed). [fail]
2. \`recommendedActions\` are well-formed AND consistent with the engine's
   derivation over the recorded impact set. [fail]
3. Orphan impacts — a \`posture\` / \`fil-model\` impact ref that does not resolve
   to a live artefact in the corresponding register. [warn]
4. Coverage — every approved \`Decision\` on/after the **baseline (2026-06-13,
   D-W8-DECISION-IMPACT-SWEEP approval date)** has a sweep. [warn]

**Baseline-forward + pilot only** — back-sweeping the entire historical decision
log is out of scope; the coverage assertion considers only post-baseline
approved decisions, and surfaces those without a sweep as advisory \`warn\`.

## 6. How this closes the W8 loop

S9 is the third leg of the W8 governance learning substrate:

- **S3 — posture register**: the typed APPLIES_WHEN seam (\`AppliesToScope\`,
  \`evaluateAppliesToScope\`, the posture register).
- **S8 — applicability assessment**: when a rule / obligation / candidate posture
  arrives, assess which contexts it binds (reusing the S3 evaluator).
- **S9 — decision-impact sweep**: when a *decision* lands, sweep which artefacts
  it touches and recommend the re-work. A decision is one S8 \`subjectKind\`; S9
  records a richer multi-artefact-kind impact family + recommended actions and
  cites the decision upward.

Together: a decision can no longer change the bank's posture silently — its
downstream blast radius is a typed, replayable, citable record, and an
unswept post-baseline decision or an orphan impact is a recon finding.

## 7. Package boundary

All sweep types + the engine + the projection live in
\`v2-core/decision-impact/\` (no v1 imports). The v1-side adapter
(\`platform/event-store/event-types/decision-impact-sweep.ts\`) imports FROM
v2-core; the recon gate (\`platform/recon/\`) reads the v1 event store and folds
the v2 projection. This is the permitted direction; \`recon:v2-no-v1-import\` holds.
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
      "D-W8-DECISION-IMPACT-SWEEP",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-SACCR-V2-CUTOVER-ACCELERATE",
      "D-RMS-PHASE-3",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
    ],
    actor: {
      type: "service",
      id: "agent:owen:company-secretary",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S9 — decision-impact sweeps: design note",
      path: "2026-06-13_owen_v2-s9-decision-impact-sweep-design-note.md",
      category: "design-note",
      author: "Owen (Company Secretary, governance)",
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
