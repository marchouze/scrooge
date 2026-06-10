// prototype/scripts/obligation-summaries/domain-c-summaries.ts
//
// P4-SCALE — Domain C (Exchange control / cross-border FinSurv reporting)
// reviewed requirement summaries. SA `ORG-EXCON-*` / `ORG-FX-FIN-*` rows. Every
// row already carries a richly-authored requirement that accurately states the
// Authorised-Dealer FinSurv reporting obligation for its balance-of-payments
// class, grounded in the Currency and Exchanges Manual section cited (with the
// precise FinSurv BoP category code explicitly flagged TBC pending licence-gate
// counsel — a deliberate, documented gap, not a requirement-text defect). All
// rows → reviewed-confirmed (no rewrite).
//
// Owning seats preserved from the adopted owner: cco for the FX-FIN reporting
// rows; treasurer for ORG-EXCON-ODP-001 (ODP forward-cover).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

function confirm(seat: string, what: string): {
  reviewerSeat: string;
  verdict: "reviewed-confirmed";
  summary: undefined;
  rationale: string;
} {
  return {
    reviewerSeat: seat,
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale: `Existing requirement is already an accurate plain-English summary of ${what}, grounded in the cited Currency and Exchanges Manual section; confirmed without rewrite (the precise FinSurv BoP category code is explicitly flagged TBC pending licence-gate counsel — a documented gap, not a requirement-text defect). Domain C — exchange control.`,
  };
}

export const DOMAIN_C: SummaryModule = {
  "ORG-EXCON-ODP-001": confirm(
    "treasurer",
    "the Authorised-Dealer FinSurv reporting + SARB-approval obligation for OTC derivative transactions with non-resident counterparties (Excon Manual D.2 / A.3)",
  ),
  "ORG-FX-FIN-01": confirm(
    "cco",
    "merchandise-trade (import/export) cross-border payment FinSurv reporting with trade-document verification (Excon Manual B.1 / B.18)",
  ),
  "ORG-FX-FIN-02": confirm(
    "cco",
    "cross-border services-payment FinSurv reporting by service type (Excon Manual B.10/B.13/B.14)",
  ),
  "ORG-FX-FIN-03": confirm(
    "cco",
    "cross-border investment-income (interest/dividends/earnings/rent) FinSurv reporting (Excon Manual B.3)",
  ),
  "ORG-FX-FIN-04": confirm(
    "cco",
    "cross-border current-account transfer FinSurv reporting with Excon allowance limits (Excon Manual B.4/B.5/B.7)",
  ),
  "ORG-FX-FIN-05": confirm(
    "cco",
    "cross-border foreign-direct-investment FinSurv reporting with SARB approval gates and the ≥10% equity threshold (Excon Manual B.2 / A.1)",
  ),
  "ORG-FX-FIN-06": confirm(
    "cco",
    "cross-border portfolio-investment FinSurv reporting (Excon Manual B.2(H) / Section G)",
  ),
  "ORG-FX-FIN-07": confirm(
    "cco",
    "cross-border other-investment (loans/deposits/trade-credit) FinSurv reporting with approval gates (Excon Manual Section I / E)",
  ),
  "ORG-FX-FIN-08": confirm(
    "cco",
    "cross-border financial-derivative cash-flow FinSurv reporting as a stand-alone obligation separate from ODP trade/margin reporting (Excon Manual Section D)",
  ),
  "ORG-FX-FIN-09": confirm(
    "cco",
    "the conditional reserve-asset cross-border FinSurv reporting obligation where the bank acts as agent/custodian on SARB's reserves account",
  ),
  "ORG-FX-FIN-10": confirm(
    "cco",
    "cross-border gold-account flow FinSurv reporting (Excon Manual Section C; Wave-2 deferral per D-M4-FX-SUB-DECISIONS)",
  ),
  "ORG-FX-FIN-11": confirm(
    "cco",
    "cross-border gift/donation/inheritance flow FinSurv reporting (Excon Manual B.17/B.7; Wave-2 deferral)",
  ),
  "ORG-FX-FIN-12": confirm(
    "cco",
    "SARB-approved asset-swap FinSurv reporting (institutional outward-investment dispensation; Excon Manual B.2(H); Wave-2 deferral)",
  ),
  "ORG-FX-FIN-13": confirm(
    "cco",
    "Excon-exempt-category flow FinSurv reporting (travel allowance/personal effects/diplomatic; Excon Manual B.4/B.6; Wave-2 deferral)",
  ),
  "ORG-FX-FIN-14": confirm(
    "cco",
    "no-charge/nil-value cross-border flow FinSurv reporting (samples/replacement/correspondent adjustments; Excon Manual B.19; Wave-2 deferral)",
  ),
};
