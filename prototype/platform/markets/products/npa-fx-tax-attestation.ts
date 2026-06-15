// platform/markets/products/npa-fx-tax-attestation.ts
//
// FX OTC umbrella NPA — tax dimension attestation (Yael, Tax engineer,
// engineering; governance owner Camille, CFO).
//
// Product scope v1.0: prd:bank:fx:otc-vanilla, counterpartyEligibility:
// "institutional" (D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY).
//
// ─────────────────────────────────────────────────────────────────────────────
// SOUTH AFRICAN TAX ANALYSIS — FX FORWARDS AND SWAPS
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. SECURITIES TRANSFER TAX (STT Act 25 of 2007)
// ─────────────────────────────────────────────────
// STT applies to "securities" as defined in s1 of the STT Act. The definition
// covers: (a) shares in a company; (b) member interests in a close corporation;
// (c) any depository receipts in respect of shares or member interests; and
// (d) any interest or right to participate in the income or assets of any
// juristic person or partnership. The definition does NOT extend to derivative
// instruments on currencies.
//
// The STT Act further defines "derivative instruments" in s1 to include
// "instruments whose price is derived from an underlying asset". However,
// s1's definition of "securities" does not include currency derivatives —
// it excludes derivatives that do not confer a right to receive a "security"
// upon exercise or settlement (cf. STT Act s7, which taxes transfers of
// securities, not notional transactions in currency markets).
//
// FX forwards and swaps are obligations to exchange currency amounts at agreed
// rates on agreed future dates. They are currency derivatives, not equity
// derivatives or instruments giving rise to a right to receive shares or member
// interests. SARS practice is consistent with this interpretation: STT returns
// filed by authorised dealers (ADs) routinely exclude FX forward and swap
// settlements. No SARS Interpretation Note or Practice General Note asserts
// STT applicability to FX forwards or swaps.
//
// CONCLUSION: FX forward contracts and FX swap transactions (near and far legs)
// are NOT securities as defined in STT Act s1 and are NOT subject to STT.
// No STT withholding, reporting or payment obligation arises on execution,
// settlement or any intermediate event.
//
// Citations: STT Act 25 of 2007 ss1, 7; SARS IT Act s24J (see §3 below);
//   no SARS PN or IN asserts STT applicability to FX instruments.
//
// ─────────────────────────────────────────────────────────────────────────────
// 2. VALUE ADDED TAX (VAT Act 89 of 1991)
// ─────────────────────────────────────────────────
// VAT Act s2(1)(f) provides that "financial services" are exempt from VAT.
// Schedule 1, item 1(f) defines "financial services" to include "the exchange
// of currency" and "the management of any deposit, savings, or other account".
// Schedule 1, item 1(g) further includes "the supply of any forward exchange
// contract or forward rate agreement" in the definition of financial services.
//
// 2.1 FX SPOT — clearly VAT-exempt under Sch 1 item 1(f) (exchange of currency).
//
// 2.2 FX FORWARD — VAT Act Sch 1 item 1(g) explicitly extends the exemption to
// forward exchange contracts. A FX forward is therefore a financial service and
// VAT-exempt as a whole, including the forward points component (the interest-rate
// differential embedded in the forward rate). The forward points are not a
// separately identifiable "fee for service" — they are integral to the pricing
// of the forward exchange contract itself (cf. SARS VAT 419 Guide for Banks
// §6.2, which confirms that amounts arising from the exchange or purchase of
// foreign currency at spot or forward rates are exempt from VAT). A separate
// fee charged for arranging or advising on a FX forward would be subject to
// VAT (Sch 1 item 1 proviso); but the spread earned on the forward rate itself
// is exempt.
//
// 2.3 FX SWAP — a FX swap comprises a near leg (spot or near-spot exchange) and
// a far leg (forward exchange). Both legs are VAT-exempt:
//   - Near leg: exchange of currency (Sch 1 item 1(f)).
//   - Far leg: forward exchange contract (Sch 1 item 1(g)).
// The swap is treated as a single composite financial-service supply. No VAT
// arises on the forward points differential between the near and far leg rates;
// those points are part of the forward exchange rate, not a fee for services.
//
// 2.4 DEFERRED GAP — SARS private ruling. SARS VAT 419 Guide for Banks is
// administrative guidance, not a binding ruling. For a production trading desk
// handling material volumes, a binding private ruling (SARS BPR) confirming
// VAT-exempt treatment of FX forward/swap forward-points should be obtained
// before go-live. This is a TRACKED DEFERRED GAP (see below).
//
// CONCLUSION: FX forward contracts and FX swaps (including the forward points
// component) are VAT-exempt financial services under VAT Act Sch 1 items 1(f)
// and 1(g). No output VAT is chargeable to institutional counterparties; no
// input-tax adjustment is required on the pure exchange-rate spread. A binding
// private ruling from SARS confirming this treatment is deferred to
// licence-day / first-material-volume threshold.
//
// Citations: VAT Act 89 of 1991 s2(1)(f), Sch 1 items 1(f)–(g);
//   SARS VAT 419 Guide for Banks §6.2; VAT Act Sch 1 item 1 proviso;
//   ORG-TX-01 (VAT policy).
//
// ─────────────────────────────────────────────────────────────────────────────
// 3. INCOME TAX — s24J (financial instruments; accrual)
// ─────────────────────────────────────────────────────
// Income Tax Act 58 of 1962, s24J governs the timing of income and deductions
// for "financial instruments" (which includes forward exchange contracts per
// s24J(1) definition). Under s24J, yield or interest on a financial instrument
// accrues on an effective-interest basis (yield-to-maturity method) regardless
// of actual cash settlement dates.
//
// For the bank as the trading party (holding FX positions as FVTPL, IAS 39/IFRS 9
// designation), the mark-to-market movements are recognised immediately in the
// income statement (IFRS 9). For income tax purposes, the accruals methodology
// under s24J determines the timing of taxable income/deductible expenditure on
// the interest-rate differential component of forward contracts.
//
// This is a build-phase scope: until the bank has taxable income (revenue starts
// at licence-day), no s24J computations need to be filed. The substrate tracks
// that s24J applies and flags the obligation for activation at revenue-start.
//
// ─────────────────────────────────────────────────────────────────────────────
// 4. FATCA / CRS — Institutional counterparties
// ─────────────────────────────────────────────────
// 4.1 FATCA (Foreign Account Tax Compliance Act / SA-US FATCA IGA Model 1):
// The bank's v1.0 counterparties are institutional (SARB-licensed banks,
// regulated financial institutions, corporates). Under FATCA and the SA-US IGA
// (signed 2014, Tax Administration Act 28 of 2011 s70 implementation):
//   - Counterparties that are "Financial Institutions" (FIs) under FATCA are
//     themselves responsible for their own FATCA compliance (passthrough-entity
//     treatment or Participating FFI status). The bank, as a withholding agent,
//     must obtain W-8BEN-E / W-8IMY certifications from non-US institutional
//     counterparties to confirm their FATCA status before making payments.
//   - Payments from the bank to institutional FI counterparties in settlement of
//     FX transactions are NOT "withholdable payments" under FATCA because:
//     (a) they are settlement payments for a financial contract (not "FDAP income"
//         or "gross proceeds" within the FATCA definition), and
//     (b) grandfathered instrument rules and the ECI exemption further narrow
//         FATCA's reach on swap settlement flows.
//   - DEFERRED GAP: W-8BEN-E / W-8IMY collection from real counterparties at
//     first real counterparty onboarding (not applicable in the build phase to
//     fixture counterparties).
//
// 4.2 CRS (Common Reporting Standard, OECD; SA implementation via Tax
// Administration Laws Amendment Act 39 of 2013 and SARS BRS-CRS 2017):
//   - CRS reportable accounts are "financial accounts" held by "account holders"
//     who are tax-resident in a participating jurisdiction. For FX dealing
//     counterparties, the "account" is the FX dealing relationship.
//   - Institutional counterparties (banks, regulated investment entities) that
//     are "Financial Institutions" (Active NFEs or FI themselves) are
//     non-reportable under CRS (they self-certify their FI / Active NFE status).
//   - Corporate counterparties that are passive NFEs (NFE with passive income)
//     require CRS due-diligence and, if controlling persons are tax-resident in
//     a CRS-participating jurisdiction, CRS reporting to SARS.
//   - DEFERRED GAP: CRS classification and self-certification collection from
//     real counterparties activates at first real counterparty onboarding.
//
// CONCLUSION: For v1.0 institutional counterparties, FATCA and CRS impose
// certification / due-diligence obligations that activate on real counterparty
// onboarding (not in the build phase). No immediate withholding obligation
// exists on FX settlement flows to institutional FI counterparties. Tracking
// gaps below.
//
// Citations: FATCA IRC §§1471–1474; SA-US FATCA IGA 2014 (Model 1);
//   Income Tax Act 58 of 1962 s70; OECD CRS (2014); SARS BRS-CRS 2017;
//   Tax Administration Laws Amendment Act 39 of 2013.
//
// ─────────────────────────────────────────────────────────────────────────────
// ATTESTATION OUTCOME
// ─────────────────────────────────────────────────────────────────────────────
// STT: NOT APPLICABLE — FX forwards/swaps are currency instruments, not
//   securities within STT Act s1.
// VAT: EXEMPT — FX forwards and swaps are financial services under VAT Act
//   Sch 1 items 1(f) and 1(g); forward-points component is integral to the
//   forward rate, not a separately taxable supply. Binding SARS BPR deferred.
// Income Tax s24J: APPLIES AT REVENUE-START — s24J accrual methodology governs
//   the interest-rate differential component of forward contracts; deferred to
//   first taxable year.
// FATCA/CRS: APPLIES ON REAL-COUNTERPARTY ONBOARDING — W-8BEN-E / W-8IMY and
//   CRS self-certification collection deferred to licence-day.
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15, withdrawing
//   prd:bank:fx:otc-vanilla pending re-approval under the withdrawal decision);
//   D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5 row 14.
// Author: Yael (Tax engineer, engineering); governance owner Camille (CFO).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const TAX_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the last held-dims-sweep attestations (2026-06-12T08:00Z) so
// latest-wins folds pick this up as the current tax attestation.
export const TAX_AS_OF = "2026-06-15T08:00:00.000Z";

const TAX_ACTOR = {
  type: "service" as const,
  id: "agent:yael:npa-tax-attestation",
};

const TAX_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY",
];

export const TAX_CITATION_CHAIN: readonly string[] = [
  ...TAX_CITATIONS,
  // STT analysis
  "urn:reg:za:stt-act-25-2007:s1",
  "urn:reg:za:stt-act-25-2007:s7",
  // VAT analysis
  "urn:reg:za:vat-act-89-1991:s2(1)(f)",
  "urn:reg:za:vat-act-89-1991:sch1-item1(f)",
  "urn:reg:za:vat-act-89-1991:sch1-item1(g)",
  "SARS-VAT-419-GUIDE-FOR-BANKS",
  // Income tax s24J
  "urn:reg:za:income-tax-act-58-1962:s24j",
  // FATCA / CRS
  "FATCA-IRC-S1471-1474",
  "SA-US-FATCA-IGA-2014",
  "urn:reg:za:income-tax-act-58-1962:s70",
  "OECD-CRS-2014",
  "SARS-BRS-CRS-2017",
];

/**
 * Accepted-open items from the tax analysis, tracked as deferred gaps on the
 * tax attestation. All fields mandatory (write-time schema);
 * recon:npa-deferred-gap-tracking inventories them.
 */
export const TAX_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-vat-sars-binding-private-ruling",
    title:
      "VAT exemption for FX forward/swap (including forward-points component) is supported by " +
      "VAT Act Sch 1 items 1(f)–(g) and SARS VAT 419 Guide for Banks §6.2, but these are " +
      "administrative guidance, not a binding ruling. A SARS binding private ruling (BPR) " +
      "confirming VAT-exempt treatment for the bank's FX dealing activity should be obtained " +
      "before the desk reaches material notional volumes at licence-day.",
    owner: "Yael (Tax engineer, engineering)",
    targetTrigger:
      "SARS binding private ruling obtained OR first material FX notional threshold " +
      "reached at licence-day (whichever is earlier)",
    citations: [
      "urn:reg:za:vat-act-89-1991:s2(1)(f)",
      "urn:reg:za:vat-act-89-1991:sch1-item1(g)",
      "SARS-VAT-419-GUIDE-FOR-BANKS",
    ],
  },
  {
    gapId: "fx-income-tax-s24j-accrual-activation",
    title:
      "Income Tax Act s24J accrual methodology governs the timing of taxable income and " +
      "deductible expenditure on the interest-rate differential component of FX forward " +
      "contracts. No s24J computations are required in the build phase (no taxable income). " +
      "The s24J substrate (yield-accrual engine, provisional-tax instalment calculations, " +
      "IT14 return integration) must be built and filed from the first taxable year " +
      "(licence-day revenue-start).",
    owner: "Yael (Tax engineer, engineering)",
    targetTrigger:
      "revenue-start at licence-day (first taxable year — s24J accrual engine + " +
      "provisional-tax instalments + IT14 return integration)",
    citations: ["urn:reg:za:income-tax-act-58-1962:s24j", "D-FX-OTC-NPA-SCOPE-EXPANSION"],
  },
  {
    gapId: "fx-fatca-w8-certification-collection",
    title:
      "FATCA compliance requires W-8BEN-E / W-8IMY self-certifications from each non-US " +
      "institutional counterparty before the bank makes payments to them. Build-phase " +
      "counterparties are fixtures (no real certifications). W-8BEN-E / W-8IMY collection " +
      "must be part of the counterparty legal-onboarding workflow at licence-day.",
    owner: "Yael (Tax engineer, engineering)",
    targetTrigger:
      "first real counterparty onboarding at licence-day (W-8BEN-E / W-8IMY " +
      "certification collection in the legal-onboarding workflow)",
    citations: [
      "FATCA-IRC-S1471-1474",
      "SA-US-FATCA-IGA-2014",
      "urn:reg:za:income-tax-act-58-1962:s70",
    ],
  },
  {
    gapId: "fx-crs-counterparty-classification-and-reporting",
    title:
      "CRS compliance requires self-certification (Active NFE / FI / Passive NFE " +
      "classification) from each institutional counterparty and, for counterparties " +
      "classified as Passive NFEs with reportable controlling persons, annual CRS " +
      "reporting to SARS. Build-phase counterparties are fixtures; CRS due-diligence " +
      "and the annual SARS BRS-CRS submission activate on first real counterparty " +
      "onboarding at licence-day.",
    owner: "Yael (Tax engineer, engineering)",
    targetTrigger:
      "first real counterparty onboarding at licence-day (CRS self-certification " +
      "collection + SARS BRS-CRS annual-reporting substrate)",
    citations: ["OECD-CRS-2014", "SARS-BRS-CRS-2017", "urn:reg:za:income-tax-act-58-1962:s70"],
  },
];

export interface TaxAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
}

/**
 * Emit the tax dimension promotion for prd:bank:fx:otc-vanilla to
 * implementation-attested with tracked deferred gaps. Idempotent: skips if a
 * tax implementation-attested event at or after TAX_AS_OF already exists for
 * the product.
 *
 * Statutory basis (verified against SA tax law, 2026-06-15):
 *   - STT: NOT applicable — FX forwards/swaps are not "securities" under STT
 *          Act s1; no STT obligation arises.
 *   - VAT: EXEMPT — VAT Act Sch 1 items 1(f) and 1(g); forward-points are
 *          integral to the forward rate, not a separately taxable supply.
 *          Binding SARS BPR deferred to licence-day (tracked gap).
 *   - Income Tax s24J: DEFERRED to revenue-start (first taxable year).
 *   - FATCA/CRS: DEFERRED to real-counterparty onboarding at licence-day.
 *
 * Over-attestation is the failure mode: gaps are never hidden, always tracked.
 */
export function runFxTaxAttestation(store: EventStore): TaxAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === TAX_PRODUCT_ID &&
      p.dimension === "tax" &&
      p.result === "implementation-attested" &&
      ev.as_of >= TAX_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${TAX_PRODUCT_ID}:tax:stt-vat-fatca-crs-analysis`,
    tags: ["npa-gate", "dimension-upgrade", "tax", TAX_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: TAX_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: TAX_ACTOR,
      citations: [...TAX_CITATIONS, "dimension:tax"],
      payload: {
        productId: TAX_PRODUCT_ID,
        dimension: "tax",
        result: "implementation-attested",
        citationChain: [...TAX_CITATION_CHAIN],
        deferredGaps: TAX_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}
