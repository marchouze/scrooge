// platform/markets/products/npa-fx-legal-attestation.ts
//
// FX OTC umbrella NPA — legal dimension attestation (Imani verification).
//
// The per-dimension verification pass v2 (#1213) correctly HELD legal
// design-attested: "no ISDA/legal-doc gate on order path; opinion-refresh SLA
// unenforced; FAIS s.45 pending counsel." This pass promotes legal to
// implementation-attested ONLY after the first two gaps are genuinely closed
// at code level:
//
//   1. Legal-documentation gate ENFORCED on the order path — the sync
//      pre-trade gateway (dashboard/markets-fx-gateway.ts) now runs a
//      FAIL-CLOSED "documentation" check (platform/markets/legal/
//      legal-documentation-gate.ts): a counterparty with no
//      LegalDocumentationSigned of record for an ISDA Master / FX-bilateral
//      form is REJECTED, enforcing ORG-CS3-001 (written trading-relationship
//      agreement BEFORE any OTC derivative transaction). Mirrors the
//      credit-limit (#1177) and suitability (#1221) fail-closed posture.
//   2. Opinion-refresh SLA MONITORED — the annual jurisdictional-opinion
//      watchdog (platform/markets/legal/opinion-refresh-watchdog.ts, #1102
//      pattern) asserts every counterparty-with-ISDA has a
//      JurisdictionalOpinionRefreshed within 12 months; missing/stale emits a
//      medium SubstrateAlert{integrity} — a finding, never an order-path
//      block.
//
// FAIS s.45 stays open as a TRACKED deferred gap (counsel opinion at
// licence-application), alongside real ISDA execution, the first real
// jurisdictional-opinion refresh, and CSA margin mechanics — owner + trigger
// + citations enforced at write-time; recon:npa-deferred-gap-tracking
// inventories them. Never hidden.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; ORG-CS3-001 (FSCA Conduct Standard
//   3/2018 §3); Imani G-9 (2026-05-20).
// Author: Imani (Legal-as-code engineer, engineering) — governance owner
//         Devon (COO, interim, pending future GC).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const LEGAL_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the conduct promotion (2026-06-11T20:00) so latest-wins folds
// pick up the promotion.
export const LEGAL_AS_OF = "2026-06-12T08:00:00.000Z";

const LEGAL_ACTOR = {
  type: "service" as const,
  id: "agent:imani:npa-legal-attestation",
};

const LEGAL_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const LEGAL_CITATION_CHAIN: readonly string[] = [
  ...LEGAL_CITATIONS,
  "ORG-CS3-001",
  "ISDA-MASTER-2002",
  "ECTA-25-2002",
  "platform/markets/legal/legal-documentation-gate.ts",
  "platform/markets/legal/opinion-refresh-watchdog.ts",
  "dashboard/markets-fx-gateway.ts",
  "scripts/register-sim-fx-legal-documentation.ts",
];

export const LEGAL_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-fais-s45-counsel-opinion",
    title:
      "FAIS s.45 exemption/licensing analysis for the institutional FX desk is pending an external-counsel opinion; the in-house reading (institutional-only venue, market-counterparty scope) stands un-opined until counsel is engaged.",
    owner:
      "Devon (COO, interim, pending future GC) — discharged via external counsel at engagement",
    targetTrigger: "licence-application external-counsel engagement (FAIS s.45 opinion delivered)",
    citations: ["FAIS-ACT-37-2002", "D-FX-HELD-DIMS-SEAT-SWEEP"],
  },
  {
    gapId: "fx-real-isda-execution",
    title:
      "LegalDocumentationSigned events for the authorised FX counterparties are SIMULATED build-phase fixtures (no executed agreements, no doc-store documentHash); real ISDA Master executions with hashed executed documents replace them at licence-day.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "licence-day counterparty legal onboarding (real ISDA Master + SA Schedule executions, documentHash mandatory)",
    citations: ["ORG-CS3-001", "scripts/register-sim-fx-legal-documentation.ts"],
  },
  {
    gapId: "fx-jurisdictional-opinion-refresh",
    title:
      "No JurisdictionalOpinionRefreshed of record exists yet (the ISDA South Africa netting opinion subscription is a licence-day engagement); the annual-refresh watchdog therefore reports missing-opinion findings (medium, monitoring) until the first real opinion is filed.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "licence-day ISDA opinion subscription — first JurisdictionalOpinionRefreshed filed with doc-store opinionDocumentHash",
    citations: ["ISDA-MASTER-2002", "platform/markets/legal/opinion-refresh-watchdog.ts"],
  },
  {
    gapId: "fx-csa-margin-mechanics",
    title:
      "No CSA margining substrate exists (fixture signings carry csaPresent:false); Imani G-9 §3 makes a CSA mandatory once forward/IRD margin requirements bind, so CSA execution + variation-margin mechanics are deferred to that trigger.",
    owner: "Imani (Legal-as-code engineer, engineering)",
    targetTrigger:
      "CSA execution wave at licence-day legal onboarding (margining substrate build precedes forward/IRD margin go-live)",
    citations: ["ISDA-MASTER-2002", "D-FX-FORWARDS-TRADING-FVTPL"],
  },
];

export interface LegalAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the legal dimension promotion to implementation-attested with the
 * tracked deferred gaps. Idempotent: skips if a legal implementation-attested
 * event at or after LEGAL_AS_OF already exists for the product.
 */
export function runFxLegalAttestation(store: EventStore): LegalAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === LEGAL_PRODUCT_ID &&
      p.dimension === "legal" &&
      p.result === "implementation-attested" &&
      ev.as_of >= LEGAL_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${LEGAL_PRODUCT_ID}:legal:documentation-gate`,
    tags: ["npa-gate", "dimension-upgrade", "legal", LEGAL_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: LEGAL_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: LEGAL_ACTOR,
      citations: [...LEGAL_CITATIONS, "dimension:legal"],
      payload: {
        productId: LEGAL_PRODUCT_ID,
        dimension: "legal",
        result: "implementation-attested",
        citationChain: [...LEGAL_CITATION_CHAIN],
        deferredGaps: LEGAL_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}
