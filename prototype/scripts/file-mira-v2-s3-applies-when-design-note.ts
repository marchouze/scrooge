// scripts/file-mira-v2-s3-applies-when-design-note.ts
//
// One-shot RMS Phase 3 filing for Mira's V2 S3 APPLIES_WHEN design note.
// Records the design rationale for the typed AppliesToScope discriminated union
// and the structured-first posture register (W8 Slice 1). Idempotent — skips
// if already filed.
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-RMS-PHASE-3 (active).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:mira:v2-s3-applies-when-design-note:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-mira-v2-s3-applies-when-design-note] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S3 — APPLIES_WHEN posture seam: structured-first design note

**Author:** Mira (Chief Obligations & Regulatory Officer, compliance)
**Date:** 2026-06-12
**Authority:** D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Audience:** Marc (CEO); Atlas (Core banking platform architect, engineering)
**Status:** Implemented — PR feat(v2-s3): posture register + APPLIES_WHEN seam

---

## 1. Design intent

The posture register (W8 Slice 1) applies a **structured-first discipline**: learned
model weights MAY propose posture changes, but only typed events DISPOSE them. No weight
silently mutates a posture. Every posture change is:

- **Typed** — one of four event kinds (PostureRegistered / PostureActivated /
  PostureDeactivated / PostureRevised)
- **Citable** — every event carries upward citations (at minimum the authorising
  decision + RAS section for appetite postures)
- **Replayable** — the PostureRegister projection is a pure fold; any state can be
  reconstructed from the event log

This satisfies Principle 1 (events are the only source of truth) and Principle 2
(single-graph discipline) for the posture layer.

## 2. APPLIES_WHEN discriminated union

\`AppliesToScope\` is a typed discriminated union with eight arms:

| kind | field | meaning |
|---|---|---|
| \`always\` | — | matches every context (bank-wide) |
| \`jurisdiction\` | jurisdiction | ISO 3166-1 alpha-2 |
| \`entity-type\` | entityType | e.g. "bank", "counterparty" |
| \`product-scope\` | filTaxonomyScope | fil:type:… pattern (wildcard suffix) |
| \`regulatory-regime\` | regimeId | e.g. "BCBS-BASEL-III" |
| \`risk-class\` | riskClass | e.g. "RT-MK", "RT-LQ", "RT-IRRBB" |
| \`and\` | conditions | recursive conjunction |
| \`or\` | conditions | recursive disjunction |

The evaluator (\`evaluateAppliesToScope\`) is a pure function:
\`AppliesToScope × PostureContext → boolean\`. No side effects; no database calls.

## 3. Pilot postures seeded

The seed script (\`scripts/seed-v2-helena-ras-postures.ts\`) emits
PostureRegistered + PostureActivated pairs for five anchor-bank RAS §B3/B4 postures:

| postureId | rasLineId | scope |
|---|---|---|
| posture:risk-appetite:fx-var | appetite:market:trading-var | ZA ∧ RT-MK ∧ fil:type:fx:* |
| posture:risk-appetite:fx-svar | appetite:market:trading-var | ZA ∧ RT-MK ∧ fil:type:fx:* |
| posture:risk-appetite:fx-es | appetite:market:trading-var | ZA ∧ RT-MK ∧ fil:type:fx:* |
| posture:risk-appetite:irrbb-delta-eve | appetite:irrbb:delta-eve-outlier | ZA ∧ RT-IRRBB |
| posture:risk-appetite:lcr-floor | appetite:liquidity:lcr | ZA ∧ RT-LQ |

RAS thresholds are read from \`platform/risk/ras-appetite-register.ts\` (read-only;
never modified by the seed). The seed is idempotent: re-running when postures are
already active is a no-op.

## 4. Recon gate

\`recon:v2-posture-register-integrity\` (wired into \`ci:recon:infra\`) asserts:

1. Zero fold violations (no malformed posture events)
2. The APPLIES_WHEN evaluator returns a bool for a broad multi-dimensional context
   (structural validity of posture predicates)
3. All five pilot posture IDs are present and active in the register (post-seed)

The gate is advisory in S3; it will transition to enforcing once the seed has run
against the canonical home store.

## 5. Package boundary

All posture types live in \`v2-core/posture/\` (no v1 imports). The v1-side adapter
(\`platform/event-store/event-types/posture.ts\`) imports FROM \`v2-core\`; this is
the permitted direction. The \`recon:v2-no-v1-import\` gate enforces the boundary.

The S4 \`banking/events.ts\` placeholder \`AppliesToScope\` (a simple object) has been
superseded by this production-grade discriminated union in the same PR.
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
      title: "V2 S3 — APPLIES_WHEN posture seam: structured-first design note",
      path: "2026-06-12_mira_v2-s3-applies-when-design-note.md",
      category: "design-note",
      author: "Mira (Chief Obligations & Regulatory Officer, compliance)",
      date: "2026-06-12",
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
