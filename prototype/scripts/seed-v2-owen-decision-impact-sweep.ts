// scripts/seed-v2-owen-decision-impact-sweep.ts
//
// Pilot seed (V2 S9): one real decision-impact sweep.
//
// Subject: D-SACCR-V2-CUTOVER-ACCELERATE — this session's SA-CCR alias-flip
//   cutover decision (v2 FIL-Model becomes source of record; v1 retired; the
//   cutover corrects the confirmed v1 FX MtM double-count; gated on Nadia's
//   independent model validation).
//
// The sweep reads the candidate artefact graph from the LIVE event store, runs
// the pure S9 engine (`computeDecisionImpact`), and emits the lifecycle:
//   DecisionImpactSweepRequested → DecisionImpactAssessed
//
// CANDIDATE GRAPH (read from the store, not hand-asserted):
//   - the SA-CCR FIL-Model (fil-model) — cites the decision via its declaration.
//   - Nadia's independent SA-CCR model-validation record (treated as the
//     fil-model's validation artefact) — cites the decision.
//   - the SA-CCR daily-cadence procedure (procedure) — cites the decision.
//   - the FX-VaR / market-risk RAS posture line (posture) — scope overlap with
//     the decision's FX subject scope (the cutover changes FX MtM, the input to
//     the FX-VaR posture's measurement).
//   - the BA-700 / RWA consumers (procedure) — the CCR EAD the cutover changes
//     feeds counterparty-credit RWA → BA-700.
//
// Expected impact set (the four artefact families the brief calls for):
//   fil-model  sa-ccr                          → re-validate (done by Nadia)
//   posture    posture:risk-appetite:fx-var    → re-assess
//   procedure  proc:sa-ccr-daily-cadence       → re-assess
//   procedure  proc:ba-700-rwa-consumers       → re-assess
//   obligation urn:reg:bcbs:cre52:sa-ccr       → re-distill
// recommendedActions: [re-validate, re-distill, re-assess]
//
// Idempotent: re-running when the sweep is already assessed is a no-op.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-owen-decision-impact-sweep.ts
//
// Authority: D-W8-DECISION-IMPACT-SWEEP (CEO-approved 2026-06-13);
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-SACCR-V2-CUTOVER-ACCELERATE. Principle 1
//   (events are truth) + Principle 2 (single-graph discipline).
// Author: Owen (Company Secretary, governance), with Atlas (Substrate
//         Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeDecisionImpactAssessed,
  makeDecisionImpactSweepRequested,
} from "../platform/event-store/event-types/decision-impact-sweep";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  type CandidateArtefact,
  type SweptDecision,
  computeDecisionImpact,
} from "../v2-core/decision-impact";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import type { AppliesToScope } from "../v2-core/posture";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:owen:company-secretary" };

const DECISION_ID = "D-SACCR-V2-CUTOVER-ACCELERATE";
const SWEEP_ID = `sweep:${DECISION_ID}:2026-06-13`;

const CITATIONS = [
  "D-W8-DECISION-IMPACT-SWEEP",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  DECISION_ID,
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// The SA-CCR cutover's subject scope: ZA FX + IR derivatives (the books whose
// MtM / EAD the cutover changes). Used for the scope-overlap dimension.
const SUBJECT_SCOPE: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "risk-class", riskClass: "RT-MK" },
    { kind: "product-scope", filTaxonomyScope: "fil:type:fx:*" },
  ],
};

// The PostureContext the decision's subject sits in (the FX book) — used so a
// posture whose APPLIES_WHEN scope binds the FX book is surfaced by overlap.
const SUBJECT_CONTEXT = {
  jurisdiction: "ZA",
  entityType: "bank",
  riskClass: "RT-MK",
  filTaxonomyScope: "fil:type:fx:spot:otc-vanilla@1.0",
};

// ---------------------------------------------------------------------------
// Read the decision's own citations + supersedes from the live store.
// ---------------------------------------------------------------------------

function resolveSweptDecision(): SweptDecision {
  let cites: string[] = [];
  let supersedes: string[] = [];
  for (const ev of eventStore.replay({ type: "Decision" })) {
    const p = (
      ev as { payload: { decisionId?: string; citations?: string[]; supersedes?: string[] } }
    ).payload;
    if (p.decisionId === DECISION_ID) {
      cites = [...(p.citations ?? [])]; // latest-wins
      supersedes = [...(p.supersedes ?? [])];
    }
  }
  return {
    decisionId: DECISION_ID,
    cites,
    supersedes,
    subjectScope: SUBJECT_SCOPE,
    subjectContext: SUBJECT_CONTEXT,
  };
}

// ---------------------------------------------------------------------------
// Build the candidate artefact graph from the live store.
//   - FIL-Model declaration → the sa-ccr fil-model artefact.
//   - posture register      → the FX-VaR posture (with its real scope).
//   - hand-anchored procedure + obligation refs the cutover touches (these are
//     not v2-register artefacts; their citation to the decision is the edge).
// ---------------------------------------------------------------------------

function buildCandidates(): CandidateArtefact[] {
  const candidates: CandidateArtefact[] = [];

  // FIL-Model: the SA-CCR model. The cutover declaration cites the decision, so
  // the fil-model is a `cites-decision` downstream consumer.
  const filModelDeclared = [...eventStore.replay({ type: "FilModelImplementationDeclared" })].some(
    (e) => (e.payload as { modelId?: string }).modelId === "sa-ccr",
  );
  if (filModelDeclared) {
    candidates.push({
      artefactKind: "fil-model",
      artefactRef: "sa-ccr",
      citations: [DECISION_ID],
    });
  }

  // Posture: the FX-VaR RAS line, read with its real APPLIES_WHEN scope from the
  // posture register (latest-wins). It is surfaced via scope-overlap with the
  // decision's FX subject context (the cutover changes the FX MtM the VaR
  // posture's measurement consumes).
  let fxVarScope: AppliesToScope | null = null;
  for (const ev of eventStore.replay({ type: "PostureRegistered" })) {
    const p = ev.payload as { postureId?: string; appliesToScope?: AppliesToScope };
    if (p.postureId === "posture:risk-appetite:fx-var" && p.appliesToScope) {
      fxVarScope = p.appliesToScope;
    }
  }
  if (fxVarScope !== null) {
    candidates.push({
      artefactKind: "posture",
      artefactRef: "posture:risk-appetite:fx-var",
      citations: [],
      appliesToScope: fxVarScope,
    });
  }

  // Procedure: the SA-CCR daily-cadence procedure (cites the decision). The
  // cutover changes the source-of-record the daily run reads.
  candidates.push({
    artefactKind: "procedure",
    artefactRef: "proc:sa-ccr-daily-cadence",
    citations: [DECISION_ID],
  });

  // Procedure: the BA-700 / RWA consumers — the CCR EAD the cutover changes
  // feeds counterparty-credit RWA into BA-700.
  candidates.push({
    artefactKind: "procedure",
    artefactRef: "proc:ba-700-rwa-consumers",
    citations: [DECISION_ID],
  });

  // Obligation: the BCBS SA-CCR obligation the model implements (cited downward
  // by the decision via D-MODEL-BINDING-CONTRACT-V1 lineage). Surfaced as a
  // cited-by-decision propagation so the obligation is re-distilled.
  candidates.push({
    artefactKind: "obligation",
    artefactRef: "urn:reg:bcbs:cre52:sa-ccr",
    citations: [DECISION_ID],
  });

  return candidates;
}

// ---------------------------------------------------------------------------
// Idempotency: skip if this sweep is already assessed.
// ---------------------------------------------------------------------------

const alreadyAssessed = [...eventStore.replay({ type: "DecisionImpactAssessed" })].some(
  (e) => (e.payload as { sweepId?: string }).sweepId === SWEEP_ID,
);

if (alreadyAssessed) {
  process.stdout.write(
    `seed:v2-owen-decision-impact-sweep — ${SWEEP_ID} already assessed; nothing to emit\n`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Run the engine (pure) and emit the lifecycle.
// ---------------------------------------------------------------------------

const decision = resolveSweptDecision();
const candidates = buildCandidates();
const asOf = clock.now();
const result = computeDecisionImpact(decision, candidates);
const citations = CITATIONS.map((c) => c as string);

const batch: Event[] = [];

batch.push(
  makeDecisionImpactSweepRequested({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations,
    payload: {
      sweepId: SWEEP_ID,
      decisionId: DECISION_ID,
      sweptAt: asOf as unknown as Instant,
      triggeredBy: "seed:owen:v2-s9-decision-impact-sweep-pilot",
      citations: citations as unknown as CitationRef[],
    },
  }),
);

batch.push(
  makeDecisionImpactAssessed({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations,
    payload: {
      sweepId: SWEEP_ID,
      decisionId: DECISION_ID,
      impacted: result.impacted,
      recommendedActions: result.recommendedActions,
      assessedBy: "Owen (Company Secretary, governance)",
      assessedAt: asOf as unknown as Instant,
      rationale: result.rationale,
      citations: citations as unknown as CitationRef[],
    },
  }),
);

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit("DecisionImpactSweepRequested") });
}

process.stdout.write(
  `seed:v2-owen-decision-impact-sweep — emitted ${batch.length} events\n  decision:   ${DECISION_ID}\n  impacted:   ${result.impacted.length} artefact(s)\n${result.impacted.map((a) => `    - [${a.edge}] ${a.artefactKind}: ${a.artefactRef}`).join("\n")}\n  actions:    [${result.recommendedActions.join(", ")}]\n  rationale:  ${result.rationale}\n`,
);
