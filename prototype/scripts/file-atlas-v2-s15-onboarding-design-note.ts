// scripts/file-atlas-v2-s15-onboarding-design-note.ts
//
// One-shot RMS Phase 3 filing for Atlas's V2 S15 design note: tenant onboarding
// mechanics + the onboarding-readiness gate. Emits a RecordFiled event so the
// Documents register holds the canonical design note. Idempotent — skips if
// already filed. The full design note is in-tree at
// v2-core/control-plane/S15-onboarding-design-note.md; this record's body
// mirrors its summary so the register holds the canonical artefact.
//
// Authority: D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-RMS-PHASE-3.
// Brief: brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13
// Author: Atlas (Substrate Architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-s15-onboarding-design-note:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-s15-onboarding-design-note] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 S15 — Tenant onboarding mechanics + onboarding-readiness gate (design note)

**Author:** Atlas (Substrate Architect, engineering)
**Date:** 2026-06-13
**Authority:** D-V2-WAVE4-COMMERCIAL-POSTURE (CEO-approved 2026-06-13); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-TIER-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS
**Brief:** brief:atlas:v2-s15-tenant-onboarding-mechanics-onboarding-re:2026-06-13
**In-tree design note:** v2-core/control-plane/S15-onboarding-design-note.md

## What S15 is

The last Wave-4 slice. It sequences the multi-tenant substrate (S1/S5/S10/S11/S14/S16)
into one typed, replayable, fail-closed onboarding FLOW plus an ENFORCING readiness
gate the platform can refuse against. It invents no new state — it wires what the
prior slices already own.

## The onboarding flow

\`runOnboarding\` provisions a tenant in four typed-event steps: register-tenant (S1
TenantRegistered, tier from S16) → derive-and-grant-seats (S11) → grant-released-surface
(S5/S16 TenantSurfaceGranted) → set-fleet-state (S14 TenantUpgradeLedgerEntry). The
per-tenant store (S10) is bound via a caller hook. FAIL-CLOSED: a full preflight throws
before any emit (bad tenantId / empty roster / dirty derivation / missing timestamp →
zero events, no half-provisioned tenant). NO wall-clock callsite — onboardedAt required.

## The readiness gate (recon:v2-onboarding-readiness, ENFORCING)

A tenant is ready ONLY when every step landed AND its tier preconditions are met. A
C-tier tenant cannot be ready while the S16 C-go-live preconditions (tested
second-provider fallback, cross-tenant CSI gate) are unsatisfied — selling is gated.
The platform can REFUSE incomplete onboarding; the synthetic half-provisioned tenant is
caught sabotage-proof (non-vacuous). Store-optional: vacuously clean on a fresh runner.

## CEO Wave-4 posture honoured

- NO approval-file productised. Onboarding provisions tenancy ONLY; no part of the
  anchor's PA approval-file IP is packaged/shipped (held as internal IP).
- Selling gated. Exercised as a scratch-only rehearsal — no real tenant, no external
  commitment, liveStoreWritten === false.

## Anchor = ready

seed-v2-anchor-tenant now also derives + appends the anchor's S11 seats (idempotent),
so the already-onboarded anchor (K) satisfies the readiness gate without re-provisioning.

## Substrate gap

The Position-Keeping ingestion seam (how a freshly-onboarded tenant's positions flow
into the platform at depth) is noted but not built here — a later slice.
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
      "D-V2-TENANCY-ARCHITECTURE",
      "D-V2-BBAAS-TIER-STRUCTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 S15 — Tenant onboarding mechanics + onboarding-readiness gate (design note)",
      path: "2026-06-13_atlas_v2-s15-onboarding-design-note.md",
      category: "engineering-design",
      author: "Atlas (Substrate Architect, engineering)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    { ok: true, eventId: result.eventId, documentHash: result.documentHash, recordId: RECORD_ID },
    null,
    2,
  ),
);
