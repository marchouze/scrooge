// scripts/seed-bcbs-enrichment-posture.ts
//
// BCBS posture enrichment: declare 3 new posture dimensions the BCBS import
// could not express (the distill left the affected obligations at jurisdiction-ZA
// "applies" with rationales noting "no valid dimension exists for G-SIB/D-SIB
// status", etc.), and RE-SCOPE the obligations that bind ONLY a status/activity
// the bank lacks → does-not-apply. Correct-but-coarse → precise. Not a
// correctness fix; the prior verdicts were conservatively safe.
//
// Confirmed dimensions (CEO per-dimension confirmation 2026-06-15):
//   • entity.systemic-status        = neither (bank is not a G-SIB or D-SIB)
//   • activity.cryptoasset-exposure = none    (no cryptoasset exposure/activity)
//   • activity.securitisation       = none    (no securitisation exposures, build phase)
//
// Re-scope appends fresh ApplicabilityAssessment events (distinct assessmentId
// `:bcbs-enrichment`, later as-of) that supersede the import's applies verdict;
// obligation events are never mutated (Principle 1). Direction-aware: only
// obligations binding ONLY the lacked status/activity flip; general rules that
// merely mention securitisation (and the non-G-SIB TLAC rule) STAY applies.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-bcbs-enrichment-posture.ts [--dry-run]
//
// Authority: D-BCBS-POSTURE-ENRICHMENT-BUILD-PHASE (recorded here); D-W8-POSTURE-REGISTER-SLICE-1.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance), elections confirmed by Marc (CEO).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import {
  makePostureActivated,
  makePostureRegistered,
} from "../platform/event-store/event-types/posture";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  buildBankPostureContexts,
  readPostureRegister,
} from "../platform/obligations/applicability";
import { recordDecision } from "../runtime/decisions/record";
import { assessApplicability } from "../v2-core/applicability";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import type { AppliesToScope } from "../v2-core/posture";

const dryRun = process.argv.includes("--dry-run");

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:obligations-officer" };
const ASSESS_ACTOR = { type: "service" as const, id: "agent:mira:obligation-applicability" };
const DECISION_ID = "D-BCBS-POSTURE-ENRICHMENT-BUILD-PHASE";
const CITATIONS = [
  DECISION_ID,
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

const SCOPE_ZA_BANK: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "entity-type", entityType: "bank" },
  ],
};

// ── Dimensions to seed: held value + the gating values an obligation may require. ──
interface DimSeed {
  key: string;
  held: string; // bank's posture (held=true)
  gating: string[]; // values an obligation may require (held=false)
  description: string;
}
const DIMS: DimSeed[] = [
  {
    key: "entity.systemic-status",
    held: "neither",
    gating: ["g-sib", "d-sib"],
    description:
      "Systemic-importance designation (BCBS SCO40/SCO50). The bank is neither a G-SIB nor a D-SIB. Held value: neither.",
  },
  {
    key: "activity.cryptoasset-exposure",
    held: "none",
    gating: ["present"],
    description:
      "Cryptoasset exposure/activity (BCBS SCO60). The bank holds no cryptoassets and conducts no crypto activity. Held value: none.",
  },
  {
    key: "activity.securitisation",
    held: "none",
    gating: ["active"],
    description:
      "Securitisation exposures/activity (BCBS CRE40-series, SEC framework). The build-phase bank originates/holds no securitisation exposures. Held value: none.",
  },
];

// ── Re-scope lists (direction-aware, conservative). Each entry: obligation id,
//    dimension key, and the gating value it requires (bank does not hold it). ──
interface ReScope {
  id: string;
  key: string;
  gating: string;
}
const RESCOPES: ReScope[] = [
  // entity.systemic-status — binds only G-SIBs / D-SIBs
  { id: "ORG-RBC-32", key: "entity.systemic-status", gating: "g-sib" },
  { id: "ORG-RBC-33", key: "entity.systemic-status", gating: "d-sib" },
  { id: "ORG-LEV-21", key: "entity.systemic-status", gating: "g-sib" },
  { id: "ORG-LEV-22", key: "entity.systemic-status", gating: "g-sib" },
  { id: "ORG-LEV-23", key: "entity.systemic-status", gating: "g-sib" },
  { id: "ORG-LEX-23", key: "entity.systemic-status", gating: "g-sib" },
  // activity.cryptoasset-exposure — binds only banks with cryptoasset exposure
  ...[
    "ORG-SCO-06",
    "ORG-SCO-07",
    "ORG-SCO-08",
    "ORG-SCO-09",
    "ORG-SCO-10",
    "ORG-SCO-11",
    "ORG-SCO-12",
    "ORG-SCO-13",
    "ORG-SCO-14",
    "ORG-DIS-28",
  ].map((id) => ({ id, key: "activity.cryptoasset-exposure", gating: "present" })),
  // activity.securitisation — binds only banks with securitisation exposure
  ...[
    "ORG-CAP-27",
    "ORG-CRE-039",
    "ORG-CRE-041",
    "ORG-CRE-043",
    "ORG-CRE-044",
    "ORG-CRE-045",
    "ORG-CRE-046",
    "ORG-CRE-047",
    "ORG-CRE-048",
    "ORG-CRE-049",
    "ORG-CRE-051",
    "ORG-CRE-052",
    "ORG-CRE-053",
    "ORG-CRE-054",
    "ORG-CRE-056",
    "ORG-CRE-057",
    "ORG-LEV-09",
    "ORG-LEV-20",
    "ORG-SRP-46",
    "ORG-SRP-47",
    "ORG-DIS-21",
  ].map((id) => ({ id, key: "activity.securitisation", gating: "active" })),
];

const asOf = clock.now();
console.log(
  `${dryRun ? "[DRY-RUN] " : ""}BCBS posture enrichment — store: ${process.env.BANK_EVENT_DB ?? "(default)"} | as-of ${asOf}`,
);
console.log(`dimensions: ${DIMS.length} | re-scopes: ${RESCOPES.length}`);

// ---------------------------------------------------------------------------
// 1. Record the Decision (idempotent)
// ---------------------------------------------------------------------------
let decisionAlready = false;
for (const ev of eventStore.replay({ type: "Decision" })) {
  const p = ev.payload as { decisionId?: string; phase?: string };
  if (p.decisionId === DECISION_ID && p.phase === "approved") decisionAlready = true;
}
if (!dryRun && !decisionAlready) {
  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Build-phase BCBS posture enrichment: entity.systemic-status=neither, activity.cryptoasset-exposure=none, activity.securitisation=none",
      category: "risk",
      recommendation:
        "Declare three BCBS posture dimensions the import could not express and re-scope the obligations that bind only the lacked status/activity to does-not-apply: G-SIB/D-SIB higher-loss-absorbency & buffer rules (entity.systemic-status=neither), SCO60 cryptoasset rules (activity.cryptoasset-exposure=none), and the securitisation framework (activity.securitisation=none). General rules that merely mention securitisation, and the non-G-SIB TLAC deduction rule, stay applies.",
      rationale:
        "The BCBS import was conservatively scoped to jurisdiction-ZA wherever the restricted dimension vocabulary could not express a condition (the distill rationales explicitly note 'no valid dimension exists for G-SIB/D-SIB status'). These three facts are unambiguous for a small build-phase ZA bank, so the bound obligations do not apply; recording them as posture + re-scoping makes the position auditable and automatically reversible (flip the posture if the bank is later designated a SIB or starts securitising/holding cryptoassets). Direction-aware + conservative: only obligations binding ONLY the lacked status/activity flip; no obligation is wrongly excluded.",
      sourceDocHashes: [],
      citations: [
        "D-W8-POSTURE-REGISTER-SLICE-1",
        "P1-EVENTS-AS-TRUTH",
        "P2-SINGLE-GRAPH-DISCIPLINE",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    asOf,
  );
  console.log(`[decision] ${DECISION_ID} recorded`);
} else {
  console.log(
    `[decision] ${DECISION_ID} ${decisionAlready ? "already approved — skip" : "(dry-run)"}`,
  );
}

// ---------------------------------------------------------------------------
// 2. Seed the dimensions (held + gating values), idempotent
// ---------------------------------------------------------------------------
const activePostures = new Set<string>();
for (const ev of eventStore.replay({ type: "PostureActivated" })) {
  const id = (ev.payload as { postureId?: string }).postureId;
  if (id) activePostures.add(id);
}
const postureBatch: Event[] = [];
function queuePosture(key: string, value: string, held: boolean, description: string): void {
  const postureId = `posture:${key}:${value}`;
  if (activePostures.has(postureId)) {
    console.log(`  [skip] ${postureId} — already active`);
    return;
  }
  postureBatch.push(
    makePostureRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        postureId,
        postureClass: "compliance-stance",
        description,
        appliesToScope: SCOPE_ZA_BANK,
        appliesToTier: "all",
        proposedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
        citations: CITATIONS as unknown as CitationRef[],
        parameters: { dimensionKey: key, dimensionValue: value, held },
      },
    }),
  );
  postureBatch.push(
    makePostureActivated({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        postureId,
        appliesToScope: SCOPE_ZA_BANK,
        activatedAt: asOf as unknown as Instant,
        authority: DECISION_ID,
        citations: CITATIONS as unknown as CitationRef[],
      },
    }),
  );
  console.log(`  [queue] ${postureId} (held=${held})`);
}
for (const d of DIMS) {
  queuePosture(d.key, d.held, true, d.description);
  for (const g of d.gating)
    queuePosture(d.key, g, false, `${d.description} (gating value '${g}' — not held).`);
}
if (!dryRun) {
  for (const ev of postureBatch)
    eventStore.append(ev, { provenance: provenanceForEmit("PostureRegistered") });
}
console.log(
  `[postures] ${dryRun ? "would emit" : "emitted"} ${postureBatch.length} events (${postureBatch.length / 2} postures)`,
);

// ---------------------------------------------------------------------------
// 3. Re-scope the listed obligations (after seeding, so the live context holds the new dims)
// ---------------------------------------------------------------------------
const adoptedIds = new Set<string>();
for (const ev of eventStore.replay({ type: "ObligationAdopted" })) {
  const id = (ev.payload as { obligationId?: string }).obligationId;
  if (id) adoptedIds.add(id);
}
const concludedIds = new Set<string>();
for (const ev of eventStore.replay({ type: "ApplicabilityAssessmentConcluded" })) {
  const id = (ev.payload as { assessmentId?: string }).assessmentId;
  if (id) concludedIds.add(id);
}
const contexts = buildBankPostureContexts(readPostureRegister(eventStore));
const liveDims = contexts[0]?.context.dimensions ?? {};
console.log(
  `[context] new dims: ${JSON.stringify(Object.fromEntries(Object.entries(liveDims).filter(([k]) => k === "entity.systemic-status" || k.startsWith("activity."))))}`,
);

let rescoped = 0;
const missing: string[] = [];
const tally: Record<string, number> = {};
const rescopeBatch: Event[] = [];
for (const r of RESCOPES) {
  if (!adoptedIds.has(r.id)) {
    missing.push(r.id);
    continue;
  }
  const assessmentId = `assessment:obligation:${r.id.toLowerCase()}:${asOf.slice(0, 10)}:bcbs-enrichment`;
  if (concludedIds.has(assessmentId)) continue;
  const scope: AppliesToScope = {
    kind: "and",
    conditions: [
      { kind: "jurisdiction", jurisdiction: "ZA" },
      { kind: "dimension", dimensionKey: r.key, dimensionValue: r.gating },
    ],
  };
  const result = assessApplicability(scope, contexts);
  tally[result.verdict] = (tally[result.verdict] ?? 0) + 1;
  rescoped++;
  if (dryRun) continue;
  for (const ev of [
    makeApplicabilityAssessmentRequested({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        subjectRef: r.id,
        subjectKind: "obligation",
        appliesToScope: scope,
        requestedBy: ASSESS_ACTOR.id,
        citations: CITATIONS,
      },
    }),
    makeApplicabilityAssessmentPerformed({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        contextsEvaluated: contexts,
        matches: result.matches,
        performedBy: ASSESS_ACTOR.id,
        performedAt: asOf,
      },
    }),
    makeApplicabilityAssessmentConcluded({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        verdict: result.verdict,
        appliesToContexts: result.matches,
        rationale: result.rationale,
        concludedBy: ASSESS_ACTOR.id,
        concludedAt: asOf,
        citations: CITATIONS,
      },
    }),
  ]) {
    rescopeBatch.push(ev);
  }
}
if (!dryRun) {
  for (const ev of rescopeBatch) eventStore.append(ev);
}
console.log(
  `[re-scope] ${dryRun ? "would re-scope" : "re-scoped"} ${rescoped} obligations → ${JSON.stringify(tally)}`,
);
if (missing.length) console.log(`  ⚠ MISSING (not adopted, skipped): ${missing.join(", ")}`);
console.log(`${dryRun ? "[DRY-RUN] " : ""}done.`);
