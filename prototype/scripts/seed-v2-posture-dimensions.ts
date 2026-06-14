// scripts/seed-v2-posture-dimensions.ts
//
// W8 Slice B — structural-applicability dimension postures for the V2 posture
// register. Extends the pilot RAS appetite postures (seed-v2-helena-ras-postures.ts)
// with the entity / approach / permission dimensions extracted from BCBS CRE +
// MAR and the PA capital framework.
//
// These postures encode the *structural facts* an agent needs to resolve the
// correct supervisory approach and entity classification for every capital/RWA
// computation:
//   - entity.class                — what kind of regulated entity the anchor is
//   - approach.credit-rwa         — SA vs F-IRB vs A-IRB (BCBS CRE)
//   - approach.market-risk        — simplified-SA vs SA vs IMA (BCBS MAR)
//   - approach.counterparty-credit— SA-CCR vs IMM (BCBS CRE52/53)
//   - entity.consolidation-level  — solo / sub-consolidated / consolidated
//   - permission.supervisory      — IRB / IMA supervisory permissions held
//
// BUILD-PHASE STANCE: the anchor bank uses STANDARDISED approaches by default.
// IRB / IMA supervisory permissions are NOT held in the build phase. Each
// posture's `parameters.held` flag records whether the value is true for the
// anchor today: `held=true` for SA approaches + entity facts that hold;
// `held=false` for IRB/IMA approaches + permissions not yet granted.
//
// Postures live in the SHARED event store (BANK_EVENT_DB=$HOME/.local/share/bank/event.db),
// exactly like the pilot RAS postures — NOT in any separate anchor DB.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-v2-posture-dimensions.ts
//
// Idempotent: re-running when a posture is already active is a no-op (skip).
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-W8-PARAMETRIC-TRAINING-POSITION;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. Principle 1 (events are truth);
//   Principle 2 (single-graph discipline).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  makePostureActivated,
  makePostureRegistered,
} from "../platform/event-store/event-types/posture";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import type { AppliesToScope } from "../v2-core/posture/applies-when";
import type { PostureClass, PostureTier } from "../v2-core/posture/events";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:obligations-officer" };

const EVENT_CITATIONS = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "D-W8-PARAMETRIC-TRAINING-POSITION",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// Scope predicates reused across families.
const SCOPE_ZA: AppliesToScope = { kind: "jurisdiction", jurisdiction: "ZA" };
const SCOPE_ZA_CR: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "risk-class", riskClass: "RT-CR" },
  ],
};
const SCOPE_ZA_MK: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "risk-class", riskClass: "RT-MK" },
  ],
};
const SCOPE_ZA_BANK: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "entity-type", entityType: "bank" },
  ],
};

// ---------------------------------------------------------------------------
// Dimension posture definitions
// ---------------------------------------------------------------------------

interface DimensionPostureSpec {
  postureId: string;
  dimensionKey: string;
  dimensionValue: string;
  /** True iff this value is the anchor bank's actual posture in the build phase. */
  held: boolean;
  postureClass: PostureClass;
  appliesToTier: PostureTier;
  appliesToScope: AppliesToScope;
  description: string;
  citations: string[];
}

const ANCHOR_NOTE =
  "Anchor bank uses standardised approaches by default in the build phase; " +
  "IRB/IMA supervisory permissions are NOT held.";

const SPECS: DimensionPostureSpec[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. entity.class (jurisdiction-flag, tier "all") — ZA
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:entity.class:bank",
    dimensionKey: "entity.class",
    dimensionValue: "bank",
    held: true,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Entity-class posture: the anchor is a 'bank' as defined under the Banks Act 94 of 1990 and the PA capital framework. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:za:banks-act-94-1990:s1", "BANKS-ACT-94-1990"],
  },
  {
    postureId: "posture:entity.class:controlling-company",
    dimensionKey: "entity.class",
    dimensionValue: "controlling-company",
    held: false,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Entity-class posture: 'controlling company' classification (Banks Act s1; consolidated supervision). Not held by the anchor operating-bank entity in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:za:banks-act-94-1990:s1", "BANKS-ACT-94-1990"],
  },
  {
    postureId: "posture:entity.class:foreign-branch",
    dimensionKey: "entity.class",
    dimensionValue: "foreign-branch",
    held: false,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Entity-class posture: 'branch of a foreign institution' (Banks Act s18A). Not the anchor's classification (locally-incorporated bank). ${ANCHOR_NOTE}`,
    citations: ["urn:reg:za:banks-act-94-1990:s18a", "BANKS-ACT-94-1990"],
  },
  {
    postureId: "posture:entity.class:eligible-institution",
    dimensionKey: "entity.class",
    dimensionValue: "eligible-institution",
    held: false,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Entity-class posture: 'eligible institution' (BCBS CRE22 credit-risk-mitigation counterparty eligibility / PA framework). Used to classify counterparties, not the anchor's own class. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:22", "BCBS-CRE"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. approach.credit-rwa (compliance-stance, tier "R") — ZA ∧ RT-CR — BCBS CRE
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:approach.credit-rwa:standardised-approach",
    dimensionKey: "approach.credit-rwa",
    dimensionValue: "standardised-approach",
    held: true,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_CR,
    description: `Credit-RWA approach posture: STANDARDISED approach (BCBS CRE20–22). This IS the anchor's credit-RWA approach in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:20", "urn:reg:bcbs:cre:21", "urn:reg:bcbs:cre:22", "BCBS-CRE"],
  },
  {
    postureId: "posture:approach.credit-rwa:foundation-irb",
    dimensionKey: "approach.credit-rwa",
    dimensionValue: "foundation-irb",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_CR,
    description: `Credit-RWA approach posture: FOUNDATION IRB (BCBS CRE30–36). NOT held — requires IRB supervisory permission not granted in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:30", "urn:reg:bcbs:cre:31", "urn:reg:bcbs:cre:36", "BCBS-CRE"],
  },
  {
    postureId: "posture:approach.credit-rwa:advanced-irb",
    dimensionKey: "approach.credit-rwa",
    dimensionValue: "advanced-irb",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_CR,
    description: `Credit-RWA approach posture: ADVANCED IRB (BCBS CRE30–36). NOT held — requires A-IRB supervisory permission not granted in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:30", "urn:reg:bcbs:cre:32", "urn:reg:bcbs:cre:36", "BCBS-CRE"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. approach.market-risk (compliance-stance, tier "R") — ZA ∧ RT-MK — BCBS MAR
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:approach.market-risk:simplified-sa",
    dimensionKey: "approach.market-risk",
    dimensionValue: "simplified-sa",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_MK,
    description: `Market-risk approach posture: SIMPLIFIED standardised approach (BCBS MAR40). Available to small trading books; the anchor uses the full SA for the FX OTC book, so not the active approach. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:mar:40", "BCBS-MAR"],
  },
  {
    postureId: "posture:approach.market-risk:standardised-approach",
    dimensionKey: "approach.market-risk",
    dimensionValue: "standardised-approach",
    held: true,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_MK,
    description: `Market-risk approach posture: STANDARDISED approach — sensitivities-based method (BCBS MAR20–23). This IS the anchor's market-risk approach in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:mar:20", "urn:reg:bcbs:mar:21", "urn:reg:bcbs:mar:23", "BCBS-MAR"],
  },
  {
    postureId: "posture:approach.market-risk:internal-models",
    dimensionKey: "approach.market-risk",
    dimensionValue: "internal-models",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_MK,
    description: `Market-risk approach posture: INTERNAL MODELS approach (BCBS MAR30–33). NOT held — requires IMA supervisory permission not granted in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:mar:30", "urn:reg:bcbs:mar:31", "urn:reg:bcbs:mar:33", "BCBS-MAR"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. approach.counterparty-credit (compliance-stance, tier "R") — ZA ∧ RT-CR — BCBS CRE52
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:approach.counterparty-credit:sa-ccr",
    dimensionKey: "approach.counterparty-credit",
    dimensionValue: "sa-ccr",
    held: true,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_CR,
    description: `Counterparty-credit approach posture: SA-CCR — standardised approach to counterparty credit risk (BCBS CRE52). This IS the anchor's CCR approach in the build phase (SA-CCR pilot is the v2 CCR engine of record). ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:52", "BCBS-CRE"],
  },
  {
    postureId: "posture:approach.counterparty-credit:internal-model-method",
    dimensionKey: "approach.counterparty-credit",
    dimensionValue: "internal-model-method",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_CR,
    description: `Counterparty-credit approach posture: IMM — internal models method for CCR (BCBS CRE53). NOT held — requires IMM supervisory permission not granted in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:53", "BCBS-CRE"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. entity.consolidation-level (jurisdiction-flag, tier "all") — ZA
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:entity.consolidation-level:solo",
    dimensionKey: "entity.consolidation-level",
    dimensionValue: "solo",
    held: true,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Consolidation-level posture: SOLO (single-entity) basis. The anchor reports on a solo basis in the build phase (no subsidiaries / banking group yet). ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:sco:10", "BCBS-SCO"],
  },
  {
    postureId: "posture:entity.consolidation-level:sub-consolidated",
    dimensionKey: "entity.consolidation-level",
    dimensionValue: "sub-consolidated",
    held: false,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Consolidation-level posture: SUB-CONSOLIDATED basis (BCBS SCO scope of application). Not applicable in the build phase (no sub-group). ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:sco:10", "BCBS-SCO"],
  },
  {
    postureId: "posture:entity.consolidation-level:consolidated",
    dimensionKey: "entity.consolidation-level",
    dimensionValue: "consolidated",
    held: false,
    postureClass: "jurisdiction-flag",
    appliesToTier: "all",
    appliesToScope: SCOPE_ZA,
    description: `Consolidation-level posture: fully CONSOLIDATED (banking-group) basis (BCBS SCO scope of application). Not applicable in the build phase (no controlling company / group). ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:sco:10", "BCBS-SCO"],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. permission.supervisory (compliance-stance, tier "R") — ZA ∧ entity-type bank
  // ─────────────────────────────────────────────────────────────────────────
  {
    postureId: "posture:permission.supervisory:irb-permission",
    dimensionKey: "permission.supervisory",
    dimensionValue: "irb-permission",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_BANK,
    description: `Supervisory-permission posture: IRB permission for credit risk (BCBS CRE36 minimum requirements; PA approval). NOT held — the anchor has no IRB permission in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:cre:36", "BCBS-CRE"],
  },
  {
    postureId: "posture:permission.supervisory:ima-permission",
    dimensionKey: "permission.supervisory",
    dimensionValue: "ima-permission",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_BANK,
    description: `Supervisory-permission posture: IMA permission for market risk (BCBS MAR30/31 model requirements; PA approval). NOT held — the anchor has no IMA permission in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:mar:30", "urn:reg:bcbs:mar:31", "BCBS-MAR"],
  },
  {
    postureId: "posture:permission.supervisory:ima-permission-fx",
    dimensionKey: "permission.supervisory",
    dimensionValue: "ima-permission-fx",
    held: false,
    postureClass: "compliance-stance",
    appliesToTier: "R",
    appliesToScope: SCOPE_ZA_BANK,
    description: `Supervisory-permission posture: IMA model-eligible-desk permission for the FX trading desk (BCBS MAR31 trading-desk eligibility). NOT held — the FX OTC book is on the SA in the build phase. ${ANCHOR_NOTE}`,
    citations: ["urn:reg:bcbs:mar:31", "BCBS-MAR"],
  },
];

// ---------------------------------------------------------------------------
// Idempotency: check existing active postures
// ---------------------------------------------------------------------------

const existingActive = new Set<string>();
for (const ev of eventStore.replay({ type: "PostureActivated" })) {
  const p = ev.payload as { postureId?: string };
  if (p.postureId) existingActive.add(p.postureId);
}
for (const ev of eventStore.replay({ type: "PostureDeactivated" })) {
  const p = ev.payload as { postureId?: string };
  if (p.postureId) existingActive.delete(p.postureId);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const batch: Event[] = [];
const asOf = clock.now();

for (const spec of SPECS) {
  if (existingActive.has(spec.postureId)) {
    process.stdout.write(`[skip] ${spec.postureId} — already active\n`);
    continue;
  }

  const citations = [...EVENT_CITATIONS, ...spec.citations];

  const parameters: Record<string, unknown> = {
    dimensionKey: spec.dimensionKey,
    dimensionValue: spec.dimensionValue,
    held: spec.held,
  };

  batch.push(
    makePostureRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        postureId: spec.postureId,
        postureClass: spec.postureClass,
        description: spec.description,
        appliesToScope: spec.appliesToScope,
        appliesToTier: spec.appliesToTier,
        proposedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
        citations: citations as unknown as CitationRef[],
        parameters,
      },
    }),
  );

  batch.push(
    makePostureActivated({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations,
      payload: {
        postureId: spec.postureId,
        appliesToScope: spec.appliesToScope,
        activatedAt: asOf as unknown as Instant,
        authority: "D-W8-POSTURE-REGISTER-SLICE-1",
        citations: citations as unknown as CitationRef[],
      },
    }),
  );

  process.stdout.write(`[queue] ${spec.postureId}\n`);
}

if (batch.length === 0) {
  process.stdout.write(
    "seed:v2-posture-dimensions — all dimension postures already active; nothing to emit\n",
  );
  process.exit(0);
}

for (const ev of batch) {
  eventStore.append(ev, { provenance: provenanceForEmit("PostureRegistered") });
}

process.stdout.write(
  `seed:v2-posture-dimensions — emitted ${batch.length} events (${batch.length / 2} postures registered + activated)\n`,
);
