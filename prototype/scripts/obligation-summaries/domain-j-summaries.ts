// prototype/scripts/obligation-summaries/domain-j-summaries.ts
//
// P4-SCALE — Domain J (Markets / JSE exchange-rule / FMA / margin) reviewed
// requirement summaries. SA `ORG-FMA-*`, `ORG-JS2-*`, `ORG-JN2-*`, `ORG-JSE-*`,
// `ORG-MK-*`, `ORG-MK-RPT-*` rows. Source text is `missing` in the live drill-
// down for the thin rows (FMA / Joint-Standard / JSE-rule instruments not graph-
// extracted as Provisions); summaries authored from the citation + existing
// prose, gap noted (not fabricated). Rows already carrying a detailed multi-
// clause requirement (the JSE-rule, ISDA/GMRA, STT, and MK-RPT margin-reporting
// rows) → reviewed-confirmed.
//
// Owning seats preserved from the adopted owner: head-of-global-markets (trading
// / market-conduct / master-agreement rows); treasurer (margin / ZARONIA);
// cco (FMA trade-reporting / FSCA-conduct / margin-reporting); cfo (FMA
// authorisation, JSE debt-listing, STT); company-secretary (FMA penalty /
// insider-information / JSE listing); coo (JN2 margin / JSE Clear).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const MISSING =
  "Source text missing in the drill-down (FMA / Joint Standard / JSE-rule instrument not graph-extracted as a Provision); summary authored from the citation + existing requirement prose.";

export const DOMAIN_J: SummaryModule = {
  "ORG-FMA-001": {
    reviewerSeat: "cfo",
    verdict: "reviewed-modified",
    summary:
      "Obtain FSCA authorisation as an OTC Derivative Provider under section 6A of the Financial Markets Act 19 of 2012 before conducting any ODP business; the authorisation must be in place before any live OTC-derivative principal-side activity. Maintain the authorisation conditions and notify the FSCA of any material change.",
    rationale: `Thin one-liner expanded from the FMA s.6A ODP-authorisation citation. ${MISSING}`,
  },
  "ORG-FMA-002": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Recognise that unauthorised ODP activity or holding-out as an authorised ODP is an offence under FMA s.109, carrying a penalty of up to R10 million and/or up to five years' imprisonment. Operate the authorisation controls so that no OTC-derivative principal activity is conducted, and no holding-out occurs, outside a valid FSCA authorisation.",
    rationale: `Thin one-liner expanded from the FMA s.109 penalty citation. ${MISSING}`,
  },
  "ORG-FMA-003": {
    reviewerSeat: "cco",
    verdict: "reviewed-modified",
    summary:
      "Report OTC-derivative transactions to a licensed Trade Repository (Strate, designated December 2024) under the FMA Regulations (GN R.98/2018) reg 3, populating the 169 prescribed data elements per transaction, with the obligation live from 1 March 2027. Operate the trade-capture, enrichment and submission pipeline that produces complete and timely reports (read across with the ORG-ODP-RPT conduct-standard reporting rows).",
    rationale: `Thin one-liner expanded from the FMA Regulations GN R.98/2018 reg 3 trade-reporting citation. ${MISSING}`,
  },
  "ORG-JN2-2024": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Report margin information to the Prudential Authority under Joint Notice 2 of 2024 read with Joint Standard 2 of 2020, from the 1 April 2025 commencement, covering the prescribed initial- and variation-margin metrics for non-centrally-cleared OTC derivatives. Operate the margin-data aggregation and submission controls the Joint Notice requires (read across with the ORG-MK-RPT rows).",
    rationale: `Thin one-liner expanded from the Joint Notice 2/2024 + JS 2/2020 margin-reporting citation. ${MISSING}`,
  },
  "ORG-JS2-001": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Calculate and exchange Variation Margin daily on a per-counterparty basis against the mark-to-market exposure of non-centrally-cleared OTC derivatives, under Joint Standard 2 of 2020 §4 (as amended). Maintain the daily MTM, margin-call and collateral-settlement process and the supporting collateral agreements.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §4 variation-margin citation. ${MISSING}`,
  },
  "ORG-JS2-002": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Calculate and exchange Initial Margin for non-centrally-cleared OTC derivatives under Joint Standard 2 of 2020 §5, where the bank is in scope by the phased average-aggregate-notional thresholds (final phase from September 2025: > ZAR 100bn average notional). Compute IM by the prescribed standardised schedule or approved model and segregate it as required.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §5 initial-margin citation. ${MISSING}`,
  },
  "ORG-JS2-003": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Accept only eligible collateral for margin under Joint Standard 2 of 2020 §6 (as amended) — cash, gold, South African government bonds, and the 2022-expanded set of certain SA central-government securities — applying the prescribed haircuts. Maintain a collateral-eligibility and haircut schedule consistent with the standard.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §6 eligible-collateral citation. ${MISSING}`,
  },
  "ORG-JS2-004": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Apply a minimum transfer amount such that the aggregate of initial and variation margin requiring transfer does not fall below the threshold before a margin transfer is made, capped at R5 million under Joint Standard 2 of 2020 §7. Configure the margin process so MTAs are applied consistently per counterparty agreement.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §7 minimum-transfer-amount citation. ${MISSING}`,
  },
  "ORG-JS2-005": {
    reviewerSeat: "cro",
    verdict: "reviewed-modified",
    summary:
      "Maintain board-approved policies and procedures sufficient for the relevant non-centrally-cleared OTC-derivative transactions under Joint Standard 2 of 2020 §3, covering margin calculation, collateral management, dispute handling and documentation. Review the policies periodically and on material change to the derivatives book.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §3 board-approved-policies citation. ${MISSING}`,
  },
  "ORG-JS2-006": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Establish margin-specific dispute-resolution procedures before entering into any in-scope non-centrally-cleared OTC-derivative transaction, under Joint Standard 2 of 2020 §8, covering disputes over margin amounts, valuations and collateral. Record and track each dispute to resolution.",
    rationale: `Thin one-liner expanded from the JS 2/2020 §8 margin-dispute-resolution citation. ${MISSING}`,
  },
  "ORG-JSE-IRC-01": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JSE Interest Rate and Currency (IRC) market-participant rules (order submission, pre-trade transparency, trade reporting to the JSE, position limits, market conduct); confirmed without rewrite. Domain J — markets / exchange rule.",
  },
  "ORG-JSE-IRC-02": {
    reviewerSeat: "cfo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JSE Debt Listings Requirements for listed debt (listing application, ongoing disclosure, material-event notification, delisting); confirmed without rewrite. Domain J — markets / exchange rule.",
  },
  "ORG-JSE-IRC-03": {
    reviewerSeat: "coo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JSE Clear CCP clearing rules for centrally-cleared IRC derivatives (margin, default management, CCP-membership obligations or clearing via a clearing member); confirmed without rewrite. Domain J — markets / exchange rule.",
  },
  "ORG-MK-01": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-modified",
    summary:
      "Comply with the market-abuse prohibitions in Chapter X of the Financial Markets Act 19 of 2012 — insider trading, prohibited trading practices (market manipulation) and the making of false, misleading or deceptive statements — across all trading activity. Operate the surveillance, restricted-list and escalation controls that detect and prevent market abuse.",
    rationale: `Thin one-liner expanded from the FMA Ch. X market-abuse citation. ${MISSING}`,
  },
  "ORG-MK-02": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-modified",
    summary:
      "Provide best execution where required under the FMA and the FSCA conduct standards, taking all reasonable steps to obtain the best possible result for clients having regard to price, cost, speed, likelihood of execution and settlement, and other relevant factors. Maintain and review a best-execution policy and the supporting execution-quality monitoring.",
    rationale: `Thin one-liner expanded from the FMA + FSCA conduct-standards best-execution citation. ${MISSING}`,
  },
  "ORG-MK-03": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-modified",
    summary:
      "Record voice and electronic communications of trading personnel as required by the FMA read with the JSE rules, retaining the records for the prescribed period and making them available for surveillance and regulatory inspection. Operate the capture, storage and retrieval controls that ensure completeness of the recordings.",
    rationale: `Thin one-liner expanded from the FMA + JSE-rules communications-recording citation. ${MISSING}`,
  },
  "ORG-MK-04": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-modified",
    summary:
      "Operate within the approved trading mandate — client-driven flow and franchise market-making only, with no proprietary risk-taking outside franchise hedges — per RAS B5 (deferred, under refinement). Enforce the mandate through position, limit and attribution controls so that risk-taking remains within the franchise boundary.",
    rationale: `Thin one-liner expanded from the RAS B5 trading-mandate citation (RAS B5 deferred — under refinement). ${MISSING}`,
  },
  "ORG-MK-05": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-modified",
    summary:
      "Handle inside information in accordance with the insider-trading provisions of FMA Chapter X (and the JSE Listings Requirements where the bank is a listed issuer), restricting and controlling access to price-sensitive information and maintaining insider lists and dealing restrictions. Operate information barriers and pre-clearance controls to prevent insider dealing.",
    rationale: `Thin one-liner expanded from the FMA Ch. X + JSE LR insider-information citation. ${MISSING}`,
  },
  "ORG-MK-06": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-modified",
    summary:
      "Document trading relationships under industry master agreements (ISDA, GMRA, GMSLA) with enforceable close-out netting, supported by netting and collateral legal opinions for the relevant jurisdictions. Maintain the executed agreements, schedules and CSAs so that netting can be relied upon for credit-risk and capital purposes.",
    rationale: `Thin one-liner expanded from the ISDA/GMRA/GMSLA master-agreement-netting citation. ${MISSING}`,
  },
  "ORG-MK-07": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Adopt the ZARONIA conventions per the ZARONIA Market Practice Guide for new ZAR interest-rate products, with a documented JIBAR fall-back for legacy exposures, as part of the JIBAR-to-ZARONIA reference-rate transition. Apply the recommended compounding, lookback and spread conventions consistently across affected products.",
    rationale: `Thin one-liner expanded from the ZARONIA MPG citation. ${MISSING}`,
  },
  "ORG-MK-08": {
    reviewerSeat: "treasurer",
    verdict: "reviewed-modified",
    summary:
      "Conduct FX and other cross-border transactions in accordance with the Authorised-Dealer rules of the Currency and Exchanges Manual (Section A.2 authorised entities; A.3 Authorised-Dealer duties), within the bank's Authorised-Dealer authority. Apply the Excon controls and FinSurv reporting that attach to each cross-border flow (read across with the Domain-C ORG-FX-FIN rows).",
    rationale: `Thin one-liner expanded from the Currency and Exchanges Manual A.2/A.3 Authorised-Dealer citation. ${MISSING}`,
  },
  "ORG-MK-09": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JSE Equities trading-member obligations (order-handling discipline, post-trade obligations, surveillance cooperation, market-making where applicable, fee structure, error-trade handling); confirmed without rewrite. Domain J — markets / exchange rule.",
  },
  "ORG-MK-10": {
    reviewerSeat: "company-secretary",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the conditional obligation to comply with the JSE Listings Requirements as a listed issuer should the bank or a group entity ever list; confirmed without rewrite. Domain J — markets / exchange rule.",
  },
  "ORG-MK-11": {
    reviewerSeat: "cfo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the Securities Transfer Tax obligation (levy, collect and remit STT at 0.25% on in-scope transfers under STT Act ss.2–3; track exemptions; submit STT returns to SARS); confirmed without rewrite. Domain J — markets / tax-on-markets.",
  },
  "ORG-MK-12": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises execution of OTC-derivative CSAs under the ISDA NY-Law (1994) or English-Law (1995 Transfer) form (margin-call mechanics, collateral eligibility, valuation, transfer-of-title); confirmed without rewrite. Domain J — markets / master agreements.",
  },
  "ORG-MK-13": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises execution of repo/reverse-repo under the ICMA GMRA 2011 with the SA jurisdiction schedule (transfer-of-title mechanics, manufactured payments, margin maintenance, default management); confirmed without rewrite. Domain J — markets / master agreements.",
  },
  "ORG-MK-14": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the FSCA Conduct Standard 3/2018 §§3–9 ODP conduct dimensions (trading-relationship agreement, timely confirmation, portfolio reconciliation, dispute resolution, etc.); confirmed without rewrite. Domain J — markets / conduct.",
  },
  "ORG-MK-15": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states the obligation to retain every JSE Equities trade record for a minimum 7-year horizon under the JSE Equities Rules trade-record retention sub-rules; confirmed without rewrite (citation carries an explicit TBC flag pending licence-gate counsel). Domain J — markets / exchange rule.",
  },
  "ORG-MK-16": {
    reviewerSeat: "head-of-global-markets",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JSE Debt Listings Requirements obligations for a JSE Interest Rate Market participant (order-handling, post-trade reporting, surveillance cooperation, settlement, day-count conventions); confirmed without rewrite (citation carries an explicit TBC flag pending licence-gate counsel). Domain J — markets / exchange rule.",
  },
  "ORG-MK-RPT-001": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the obligation to submit regulatory returns containing the JN 2/2024 Appendix-A margin metrics to the Authorities (FSCA + PA) for every non-centrally-cleared OTC derivative (JN 2/2024 §2.1–§2.2); confirmed without rewrite. Domain J — markets / margin reporting.",
  },
  "ORG-MK-RPT-002": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JN 2/2024 §3.1–§3.3 submission-channel obligation (return to the PA via the Umoja portal by Excel upload, in-portal, or machine-to-machine); confirmed without rewrite. Domain J — markets / margin reporting.",
  },
  "ORG-MK-RPT-003": {
    reviewerSeat: "cco",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately summarises the JN 2/2024 Appendix-A (MR Version 1 Schema) metric-population-and-transmission obligation (initial/variation margin posted/received per the schema definitions); confirmed without rewrite. Domain J — markets / margin reporting.",
  },
};
