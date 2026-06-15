// scripts/run-fx-tax-attestation.ts
//
// One-shot tax-dimension attestation driver for prd:bank:fx:otc-vanilla.
// (Yael, Tax engineer, engineering; governance owner Camille, CFO.)
//
// This script emits ProductDimensionAttested for the "tax" dimension of
// prd:bank:fx:otc-vanilla with result "implementation-attested" and four
// tracked deferred gaps (VAT SARS BPR, s24J revenue-start, FATCA W-8
// certification, CRS classification/reporting).
//
// Statutory analysis summary:
//   STT   — NOT applicable (FX forwards/swaps not "securities" under STT Act s1).
//   VAT   — EXEMPT (VAT Act Sch 1 items 1(f) and 1(g); forward-points are
//            integral to the forward rate, not a separately taxable supply).
//            Binding SARS BPR deferred to licence-day (tracked gap).
//   s24J  — APPLIES AT REVENUE-START (deferred to first taxable year).
//   FATCA — W-8BEN-E / W-8IMY certification collection deferred to real
//            counterparty onboarding at licence-day.
//   CRS   — Self-certification and SARS BRS-CRS reporting deferred to real
//            counterparty onboarding at licence-day.
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/run-fx-tax-attestation.ts
//
// Or via package.json:
//   bun run npa:fx-tax-attestation
//
// Authority: D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO 2026-06-15);
//            D-FX-HELD-DIMS-SEAT-SWEEP (CEO 2026-06-11);
//            D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY;
//            D-NEW-PRODUCT-APPROVAL-POLICY §5 row 14.

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { runFxTaxAttestation } from "../platform/markets/products/npa-fx-tax-attestation";

if (import.meta.main) {
  const asOf = clock.now();

  const result = runFxTaxAttestation(eventStore);

  console.log(
    JSON.stringify(
      {
        ok: true,
        asOf,
        attestation: {
          taxPromoted: result.promoted,
          taxSkippedIdempotent: result.skipped,
          productId: "prd:bank:fx:otc-vanilla",
          dimension: "tax",
          result: "implementation-attested",
        },
        analysis: {
          stt: "NOT APPLICABLE — FX forwards/swaps are currency instruments, not securities under STT Act s1",
          vat: "EXEMPT — VAT Act Sch 1 items 1(f) and 1(g); forward-points integral to forward rate; binding SARS BPR deferred (tracked gap)",
          incomeTaxS24J:
            "DEFERRED — activates at revenue-start (first taxable year); build phase has no taxable income",
          fatca:
            "DEFERRED — W-8BEN-E/W-8IMY certification collection activates at first real counterparty onboarding",
          crs: "DEFERRED — CRS self-certification and SARS BRS-CRS annual reporting activates at first real counterparty onboarding",
        },
        deferredGapsCount: 4,
        deferredGaps: [
          "fx-vat-sars-binding-private-ruling",
          "fx-income-tax-s24j-accrual-activation",
          "fx-fatca-w8-certification-collection",
          "fx-crs-counterparty-classification-and-reporting",
        ],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
