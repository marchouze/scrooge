// platform/markets/products/npa-fx-privacy-attestation.ts
//
// FX OTC umbrella NPA — privacy dimension attestation (Information Officer
// verification).
//
// The per-dimension verification pass v2 (#1213) correctly HELD privacy
// design-attested: "POPIA snapshot visibility only, no DSAR SLA". This pass
// promotes privacy to implementation-attested ONLY after that gap is genuinely
// closed at code level:
//
//   1. DSAR event substrate stands — DSARClosed (POPIA ss.23–25 disposition,
//      refusal grounds enforced at write-time per s.23(4)(a)) and DSARExtended
//      (PAIA s.26 one-time extension) are typed + REGISTERED in
//      event-store/registry (F-032), converging on the pre-existing
//      DSARReceived family rather than forking a parallel one.
//   2. The DSAR register projection (platform/privacy/dsar-register.ts) grades
//      every open request against its effective deadline (PAIA s.25(1) 30-day
//      window via POPIA s.25; latest-wins extension).
//   3. The 30-day SLA watchdog (platform/privacy/dsar-sla-watchdog.ts —
//      expected-event-watchdog pattern) emits SubstrateAlert{integrity, high}
//      for any breached open DSAR, {medium} approaching, idempotently —
//      proven firing in tests/dsar-sla-watchdog.test.ts.
//   4. recon:dsar-sla inventories the SLA state (advisory; wired into
//      ci:recon:domain).
//
// Institutional posture (Iris — Information Officer, governance):
//   POPIA protects juristic persons (s.1 "person" includes an existing
//   juristic person), so the bank's institutional FX counterparties ARE data
//   subjects and their information IS personal information under POPIA. The
//   DSAR right (s.23), correction right (s.24) and the s.72 cross-border
//   transfer conditions all bind on the institutional-only FX product —
//   "institutional-only" is NOT a privacy exemption. Residuals that cannot
//   honestly stand yet (s.72 per-transfer assessment on fixtures; licence-day
//   intake channel + PAIA manual) are tracked ProductDeferredGap entries —
//   never hidden.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; POPIA 4/2013 ss.1, 11, 23–25, 72;
//   PAIA 2/2000 ss.25–26.
// Author: Iris (Information Officer, governance).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const PRIVACY_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the conduct promotion (2026-06-11T20:00) so latest-wins folds
// pick this up as the current privacy attestation.
export const PRIVACY_AS_OF = "2026-06-12T08:00:00.000Z";

const PRIVACY_ACTOR = {
  type: "service" as const,
  id: "agent:iris:npa-privacy-attestation",
};

const PRIVACY_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const PRIVACY_CITATION_CHAIN: readonly string[] = [
  ...PRIVACY_CITATIONS,
  "ORG-PR(IV)-01",
  "ORG-PR(IV)-08",
  "ORG-PR(IV)-09",
  "ORG-PR(IV)-15",
  "urn:reg:za:popia:s23",
  "urn:reg:za:popia:s25",
  "urn:reg:za:popia:s72",
  "platform/event-store/event-types/aml-popia-extended.ts",
  "platform/privacy/dsar-register.ts",
  "platform/privacy/dsar-sla-watchdog.ts",
  "platform/recon/dsar-sla.ts",
];

export const PRIVACY_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-popia-s72-cross-border-assessment",
    title:
      "POPIA s.72 cross-border transfer condition is not yet assessed per counterparty jurisdiction. The global-bank FX counterparties are juristic-person data subjects, so any transfer of their personal information outside SA needs a recorded s.72(1) basis (adequacy / binding rules / consent / contractual necessity). In the build phase the counterparties are fixtures and no actual cross-border transfer of personal information occurs; the per-transfer assessment substrate activates with real counterparties.",
    owner: "Iris (Information Officer, governance)",
    targetTrigger:
      "licence-day onboarding of real cross-border counterparties (first actual transfer of personal information outside SA)",
    citations: ["urn:reg:za:popia:s72", "ORG-PR(IV)-15"],
  },
  {
    gapId: "fx-dsar-intake-channel-paia-manual",
    title:
      "DSAR intake is event-substrate only: there is no public-facing intake channel, no published PAIA s.51 manual, and no prescribed-fee schedule. These bind when real data subjects exist; the lifecycle substrate (events, register, SLA watchdog, recon) stands now and the intake channel plugs into it without schema change.",
    owner: "Iris (Information Officer, governance)",
    targetTrigger: "licence-day (real data subjects; PAIA manual publication obligation activates)",
    citations: ["urn:reg:za:popia:s25", "ORG-PR(IV)-08"],
  },
  {
    gapId: "fx-popia-consent-phase-gate-activation",
    title:
      "The onboarding phase-8 popia-recorded gate (PopiaConsentRecorded, domains/customer/onboarding.ts) has emitted zero events on the canonical store — the live KYC path evidences the s.11 lawful-basis control via LawfulProcessingRegistered instead (26 on the canonical store). Converging the two consent-evidence paths (one lawful-basis event family over the live onboarding flow) is tracked, not hidden.",
    owner: "Iris (Information Officer, governance)",
    targetTrigger:
      "21-phase onboarding orchestrator runs over the live counterparty flow (first live PopiaConsentRecorded), or a deliberate convergence decision retires one family",
    citations: ["urn:reg:za:popia:s11", "ORG-PR(IV)-01"],
  },
];

export interface PrivacyAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the privacy dimension promotion to implementation-attested with the
 * tracked deferred gaps. Idempotent: skips if a privacy implementation-attested
 * event at or after PRIVACY_AS_OF already exists for the product.
 *
 * The substrate gate (events registered, 0 breached DSARs on the canonical
 * store, lawful-basis evidence present) lives in the driver
 * (scripts/run-fx-privacy-attestation.ts) — over-attestation is the failure
 * mode, so the driver refuses to call this when the gate fails.
 */
export function runFxPrivacyAttestation(store: EventStore): PrivacyAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === PRIVACY_PRODUCT_ID &&
      p.dimension === "privacy" &&
      p.result === "implementation-attested" &&
      ev.as_of >= PRIVACY_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${PRIVACY_PRODUCT_ID}:privacy:dsar-sla-substrate`,
    tags: ["npa-gate", "dimension-upgrade", "privacy", PRIVACY_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: PRIVACY_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: PRIVACY_ACTOR,
      citations: [...PRIVACY_CITATIONS, "dimension:privacy"],
      payload: {
        productId: PRIVACY_PRODUCT_ID,
        dimension: "privacy",
        result: "implementation-attested",
        citationChain: [...PRIVACY_CITATION_CHAIN],
        deferredGaps: PRIVACY_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}
