// scripts/file-atlas-v2-s16-tier-entitlement-design-note.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S16 design note: K/R/C flat-tier
// packaging + the tier-entitlement coherence gate. Emits a RecordFiled event so
// the Documents register holds the canonical design note. Idempotent — skips if
// already filed. The full design note is in-tree at
// v2-core/S16-tier-entitlement-design-note.md; this record's body mirrors its
// summary so the register holds the canonical artefact.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-BBAAS-TIER-STRUCTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Author: Atlas (Substrate Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s16-tier-entitlement-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-s16-tier-entitlement-design-note] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 S16 — K/R/C flat-tier packaging + tier-entitlement coherence gate (design note)

**Author:** Atlas (Substrate Architect, engineering), with PAX (Research) input on tier-content mapping
**Date:** 2026-06-13
**Authority:** D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13); D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:atlas:v2-s16-k-r-c-flat-tier-packaging-tier-entitlemen:2026-06-13
**In-tree design note:** v2-core/S16-tier-entitlement-design-note.md

## What S16 is

S5 defined the **technical** tier boundary (RELEASED_SURFACE; C ⊆ R ⊆ K, enforced
by recon:v2-released-surface-clean-core). S16 adds the **commercial packaging**: a
typed K/R/C **flat-tier** entitlement table mapped to those S5 surface scopes, plus
an ENFORCING coherence gate. **The tier boundary IS the surface boundary** — tier
capabilities are DERIVED from the manifest, never hand-maintained.

## CEO Wave-4 posture honoured

- **Flat tiered subscription** — every entitlement carries \`subscriptionModel: "flat-tier"\`. NO per-seat / metered axis (S14 metering stays ops-internal, the billing *basis* not a billing axis).
- **Build mechanics now; selling gated** — STRUCTURE + entitlements only. NO price fields / rate-cards / external commitments; the gate fails CI on any price-shaped key.
- **K → R → C** sequencing; **anchor = K** (\`tenant:za-bank\`, S14 fleet state).
- PA approval-file untouched (internal IP).

## The model (v2-core/tier-entitlement.ts)

A \`TierEntitlement\` = \`{ tier, surfaceScope, capabilities, subscriptionModel: "flat-tier" }\`.

| Tier | Surface scope | Capabilities derived from |
|---|---|---|
| K (anchor) | K — full internal access | R.exports ∪ C.exports ∪ K.kOnlyExports |
| R (regulated tenant) | R | RELEASED_SURFACE.R.exports |
| C (commercial SaaS) | C | RELEASED_SURFACE.C.exports |

\`surfaceScope === tier\` always. No price field exists on the type.

## C-tier go-live preconditions (standing constraints, gated to C)

Typed \`CTierGoLivePrecondition\` records, \`satisfied: false\` in the build phase:

1. **second-provider-fallback** (Wave-4 decision #5) — C cannot go live without a **tested second-provider (model/inference) fallback** so a primary-provider outage does not take a commercial tenant dark. Precondition + gate ONLY (implementation is a separate workstream).
2. **cross-tenant-csi-gate-cleared** (D-W7) — cross-tenant learning is not in the C surface until the CSI gate clears.

\`isCTierGoLiveReady()\` is a pure derivation: true only when every precondition is satisfied. Build-phase = false (selling gated).

## The gate (recon:v2-tier-entitlement-coherence, ENFORCING)

Asserts: surfaceScope==tier; every capability resolves + is within scope; C ⊆ R ⊆ K;
flat-tier marker + no price field; anchor==K; C-go-live preconditions present (incl.
second-provider fallback) + gate go-live. The pure assertion is exercised
sabotage-proof in the regression test — the **synthetic over-grant** (C entitling the
K-only \`cross-tenant\` token) is **caught** (non-vacuous). Live run asserts 82 checks,
0 violations. Wired into ci:recon:infra.

## What S16 is NOT

No pricing / rate-cards / external commitments (structure only); no per-seat / metered
billing; no second-provider-fallback *implementation* (precondition + gate only); PA
approval-file untouched; onboarding is S15; no v1 imports under v2-core; no wall-clock
callsite added in v2-core (pure data + pure functions).

## Files

- v2-core/tier-entitlement.ts — the entitlement model + C-go-live preconditions.
- v2-core/index.ts — @tier R export of the packaging model.
- platform/recon/v2-tier-entitlement-coherence.ts — the ENFORCING gate.
- platform/recon/v2-tier-entitlement-coherence.test.ts — sabotage-proof tests (12).
- package.json + scripts/run-recon-suite.ts — gate wiring (infra suite).
- v2-core/S16-tier-entitlement-design-note.md — the in-tree design note.
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-V2-WAVE4-COMMERCIAL-POSTURE",
      "D-V2-BBAAS-TIER-STRUCTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S16 — K/R/C flat-tier packaging + tier-entitlement coherence gate (design note)",
      path: "2026-06-13_atlas_v2-s16-tier-entitlement-design-note.md",
      category: "engineering-design",
      author: "Atlas (Substrate Architect, engineering)",
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
