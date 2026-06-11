// scripts/assign-fx-counterparty-cre20-classifications.ts
//
// CRO counterparty Basel-classification pass (CRE20) — one-shot, idempotent.
//
// The classification substrate (D-FX-COUNTERPARTY-BASEL-CLASSIFICATION) is
// live but the canonical store held ZERO `CounterpartyBaselClassAssigned`
// events: every SA-CCR-exposed counterparty rode the prudent corporate-non-ig
// (100%) fallback, surfaced by recon:counterparty-basel-classification-coverage
// (exposed=2 classified=0 fallback=2 as of 2026-06-11). This script records the
// CRO's authoritative CRE20 class per counterparty as events-of-record — the
// class VALUES live here (a seat judgement, cited per counterparty), NEVER as
// a hardcoded map in engine code (the #1176 design removed exactly that).
//
// Population: all counterparties with live SA-CCR netting sets (CcrEadComputed)
// plus the full authorised FX-trading counterparty set (PartyAttributeChanged
// `authorisedProducts` ∋ fx-*) likely to become exposed. All 18 are banks —
// evidenced by the party register (Banks Act regimeAnchor / PA regulator / BIC
// / legal form "N.A." | "PLC" | "AG" bank licences) — so every assignment is
// `bank` under CRE20.18; the credit differentiation is the ECRA rating bucket:
//
//   - SA banks (PA-regulated, Banks Act 94 of 1990): international-scale FC
//     issuer ratings are sovereign-capped sub-investment-grade (BB bucket)
//     since the 2017 SA sovereign downgrades → ECRA `bb` → 100% long-term.
//     Deliberately NOT left "unrated": SCRA Grade-B (75%) would UNDER-state
//     capital versus the rated-ECRA treatment that actually applies.
//   - Global banks (JPMorgan Chase Bank N.A., Citibank N.A., Deutsche Bank AG,
//     Barclays Bank PLC, HSBC Bank PLC): international-scale issuer ratings
//     sit in the A range (A− to AA−) across the major agencies → ECRA `a`
//     (the conservative bucket within that range; CRE21 multiple-assessment
//     rule could support `aaa-aa` for some — the CRO takes the lower bucket
//     pending an in-store ratings feed) → 30% long-term.
//   - Build-phase sim fixtures (*-sim-*): fictitious institutions ("not a real
//     institution" per their party-register regimeAnchor) — no external credit
//     assessment can exist → `unrated` (SCRA Grade-B default, 75% long-term).
//
// residualMaturity is `long-term` for ALL assignments (conservative: the
// classification is per-counterparty, and netting sets may contain forwards
// with original maturity > 3 months, so the CRE20.18 short-term concession is
// not taken at the counterparty level).
//
// Build-phase caveat: provenance is build-phase-fixture; resulting RWA figures
// are rehearsal, not a production capital claim. Rating buckets cite public
// international-scale issuer ratings as CRO assessment — a curated in-store
// ratings feed (evidence-of-record) is a named follow-on, not improvised here.
//
// Run against the SHARED canonical store (boot shim resolves home default):
//   bun run scripts/assign-fx-counterparty-cre20-classifications.ts
//
// Authority: D-FX-COUNTERPARTY-BASEL-CLASSIFICATION (CEO session-delegation
//   2026-06-10); D-FX-CCR-INTERIM-CONSERVATIVE-RWA; BCBS CRE20.18/CRE20.21;
//   RRB Regulation 38; Policies/credit-risk-policy-v1.md §3;
//   brief:helena:assign-cre20-basel-classifications-for-sa-ccr-ex:2026-06-11.
// Author: Helena (Chief Risk Officer, governance) · Scrooge-coordinated session.

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import {
  type CounterpartyBaselClassAssignedPayload,
  makeCounterpartyBaselClassAssigned,
} from "../platform/event-store/event-types/counterparty-credit-risk";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import { logger } from "../platform/observability/logger";
import { resolveAllCounterpartyClasses } from "../platform/risk/counterparty-classification";

const AS_OF = "2026-06-11T09:00:00.000Z";
const EFFECTIVE_FROM = "2026-06-11T00:00:00.000Z";
const ENTITY = "LE-ZA-HOZ-BANK";
const ASSIGNED_BY = "agent:helena:governance (Helena, Chief Risk Officer)";

const CITATIONS = [
  "D-FX-COUNTERPARTY-BASEL-CLASSIFICATION",
  "BCBS-CRE20",
  "RRB-REG-38",
  "POLICY:credit-risk-policy-v1-S3",
];

type Assignment = Pick<
  CounterpartyBaselClassAssignedPayload,
  | "counterpartyId"
  | "baselClass"
  | "ratingBucket"
  | "residualMaturity"
  | "rationale"
  | "evidenceRef"
>;

const SA_BANK_RATING_BASIS =
  "ECRA bb: international-scale FC issuer ratings sovereign-capped sub-IG (SA sovereign sub-IG since 2017); SCRA-unrated (75%) would under-state capital vs the rated treatment that applies";

const GLOBAL_BANK_RATING_BASIS =
  "ECRA a: international-scale issuer ratings in the A range (A- to AA-) across major agencies; CRO takes the conservative single-A bucket pending an in-store ratings feed";

const SIM_RATING_BASIS =
  "unrated (SCRA Grade-B default): build-phase fictitious institution — no external credit assessment can exist";

// ---------------------------------------------------------------------------
// CRO assessment table — the class values are Helena (Chief Risk Officer,
// governance)'s seat judgement, recorded as events-of-record. Party-register
// evidence (PartyRegistered.regimeAnchor / primaryRegulator / BIC) cited per
// row via evidenceRef.
// ---------------------------------------------------------------------------
const ASSIGNMENTS: ReadonlyArray<Assignment> = [
  // --- SA-registered banks (PA-regulated, Banks Act 94 of 1990) → bank / bb.
  {
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `Investec Bank Limited — SARB-registered bank, PA-regulated (Banks Act 94 of 1990; CIPC 1969/004763/06) per party register; SA-CCR-exposed today. ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:investec-bank-za (regimeAnchor: Banks Act 94 of 1990, primaryRegulator: PA, BIC IVESZAJJXXX) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:4935affc-29eb-4561-b8f8-5676a0860f3f",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `Investec Bank Limited (KYC-onboarded real-name registry entry for the same SARB-registered, PA-regulated bank as investec-bank-za). ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:4935affc-29eb-4561-b8f8-5676a0860f3f (KYC-onboarded; same legal entity as urn:party:legal-entity:investec-bank-za) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `The Standard Bank of South Africa Limited — SARB-registered bank, PA-regulated (Banks Act 94 of 1990) per party register. ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:standard-bank-za (regimeAnchor: Banks Act 94 of 1990, primaryRegulator: PA) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:e7217778-9e68-437b-922d-5f332440bd19",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `Standard Bank of South Africa Ltd (KYC-onboarded real-name registry entry for the same SARB-registered bank as standard-bank-za). ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:e7217778-9e68-437b-922d-5f332440bd19 (KYC-onboarded; same legal entity as urn:party:legal-entity:standard-bank-za) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:a8727de9-c730-4cb9-a6fb-8ca4c9d6d57c",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `ABSA Bank Limited — SARB-registered bank (Banks Act 94 of 1990), KYC-onboarded with bank BIC. ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:a8727de9-c730-4cb9-a6fb-8ca4c9d6d57c (KYC-onboarded SA bank, ZA jurisdiction) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:98b30a8f-c3aa-4b67-a59f-df199c0adedf",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `Nedbank Limited — SARB-registered bank (Banks Act 94 of 1990), KYC-onboarded. ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:98b30a8f-c3aa-4b67-a59f-df199c0adedf (KYC-onboarded SA bank, ZA jurisdiction) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:33538581-3588-418a-849e-a4120c12c128",
    baselClass: "bank",
    ratingBucket: "bb",
    residualMaturity: "long-term",
    rationale: `FirstRand Bank Limited — SARB-registered bank (Banks Act 94 of 1990), KYC-onboarded. ${SA_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:33538581-3588-418a-849e-a4120c12c128 (KYC-onboarded SA bank, ZA jurisdiction) — CRO assessment 2026-06-11",
  },
  // --- Global banks (home-regulator banking licences) → bank / a.
  {
    counterpartyId: "urn:party:legal-entity:0eaca28d-8a93-4e72-98c9-1eb6a8fcbbdd",
    baselClass: "bank",
    ratingBucket: "a",
    residualMaturity: "long-term",
    rationale: `JPMorgan Chase Bank N.A. — US national banking association (OCC-chartered, "N.A." legal form), KYC-accepted low-risk bank counterparty (BIC CHASUS33XXX); SA-CCR-exposed today. ${GLOBAL_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:0eaca28d-8a93-4e72-98c9-1eb6a8fcbbdd (ClientAccepted riskBand low; BIC CHASUS33XXX; LEI 5299000EACA28D8A9300) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:19b37ca2-92dd-4493-bf49-f3a53a53f255",
    baselClass: "bank",
    ratingBucket: "a",
    residualMaturity: "long-term",
    rationale: `Citibank N.A. — US national banking association (OCC-chartered), KYC-onboarded bank counterparty. ${GLOBAL_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:19b37ca2-92dd-4493-bf49-f3a53a53f255 (KYC-onboarded US bank) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:69a00330-30a1-4f02-9f03-6785a19163de",
    baselClass: "bank",
    ratingBucket: "a",
    residualMaturity: "long-term",
    rationale: `Deutsche Bank AG — German credit institution (BaFin/ECB-supervised), KYC-onboarded bank counterparty. ${GLOBAL_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:69a00330-30a1-4f02-9f03-6785a19163de (KYC-onboarded DE bank) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:1e3c17fc-0fb0-4c30-a107-2f9b0854a106",
    baselClass: "bank",
    ratingBucket: "a",
    residualMaturity: "long-term",
    rationale: `Barclays Bank PLC — UK bank (PRA-authorised), KYC-onboarded bank counterparty. ${GLOBAL_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:1e3c17fc-0fb0-4c30-a107-2f9b0854a106 (KYC-onboarded GB bank) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:84b5a946-b2c4-4e98-9724-e3d64c45f30d",
    baselClass: "bank",
    ratingBucket: "a",
    residualMaturity: "long-term",
    rationale: `HSBC Bank PLC — UK bank (PRA-authorised), KYC-onboarded bank counterparty. ${GLOBAL_BANK_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:84b5a946-b2c4-4e98-9724-e3d64c45f30d (KYC-onboarded GB bank) + public international-scale issuer ratings — CRO assessment 2026-06-11",
  },
  // --- Build-phase sim fixtures (fictitious banks) → bank / unrated (SCRA).
  {
    counterpartyId: "urn:party:legal-entity:std-sim-za",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `Standard Simulated Bank SA — build-phase fictitious bank fixture, modelled as a PA-regulated SA bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:std-sim-za (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:absa-sim-za",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `Absa Simulated Bank SA — build-phase fictitious bank fixture, modelled as a PA-regulated SA bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:absa-sim-za (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:nedbank-sim-za",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `Nedbank Simulated SA — build-phase fictitious bank fixture, modelled as a PA-regulated SA bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:nedbank-sim-za (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:barclays-sim-gb",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `Barclays Simulated London — build-phase fictitious bank fixture, modelled as a GB bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:barclays-sim-gb (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:deutsche-sim-de",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `Deutsche Simulated Frankfurt — build-phase fictitious bank fixture, modelled as a DE bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:deutsche-sim-de (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
  {
    counterpartyId: "urn:party:legal-entity:jpm-sim-us",
    baselClass: "bank",
    ratingBucket: "unrated",
    residualMaturity: "long-term",
    rationale: `JPMorgan Simulated New York — build-phase fictitious bank fixture, modelled as a US bank. ${SIM_RATING_BASIS}.`,
    evidenceRef:
      "party-register:urn:party:legal-entity:jpm-sim-us (regimeAnchor: build-phase simulation) — CRO assessment 2026-06-11",
  },
];

// Idempotency: skip counterparties whose latest-effective assignment already
// matches this table (same class + rating bucket + maturity bucket).
const existing = resolveAllCounterpartyClasses(eventStore);

let assigned = 0;
let skipped = 0;
for (const a of ASSIGNMENTS) {
  const current = existing.get(a.counterpartyId);
  if (
    current &&
    current.baselClass === a.baselClass &&
    current.ratingBucket === a.ratingBucket &&
    current.residualMaturity === a.residualMaturity
  ) {
    skipped++;
    continue;
  }
  eventStore.append({
    ...makeCounterpartyBaselClassAssigned({
      asOf: AS_OF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:helena:governance" },
      citations: CITATIONS,
      payload: {
        counterpartyId: a.counterpartyId,
        baselClass: a.baselClass,
        ...(a.ratingBucket ? { ratingBucket: a.ratingBucket } : {}),
        ...(a.residualMaturity ? { residualMaturity: a.residualMaturity } : {}),
        assignedBy: ASSIGNED_BY,
        approverAuthority: "CRO",
        rationale: a.rationale,
        evidenceRef: a.evidenceRef,
        effectiveFrom: EFFECTIVE_FROM,
        assignedAt: AS_OF,
      },
    }),
    provenance: buildPhaseFixtureTag({
      sourceLineage: "script:assign-fx-counterparty-cre20-classifications",
      variant: `cre20-class:${a.counterpartyId}`,
      tags: [
        "cre20",
        "counterparty-classification",
        "cro-assessment",
        a.counterpartyId.includes("-sim-") ? "sim-counterparty" : "real-counterparty",
      ],
    }),
  });
  assigned++;
}

logger.info(
  { assigned, skipped, total: ASSIGNMENTS.length, at: clock.now() },
  "assigned CRE20 Basel counterparty classifications (CRO, event-of-record)",
);
process.exit(0);
