#!/usr/bin/env bun
/**
 * Generates .txt and -structured.json files for 87 Banks Act instruments
 * (18 circulars + 69 directives) referenced in C1/2026.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIR = join(import.meta.dir, "../../Regulations/Banks/source-docs");

interface Instrument {
  slug: string;
  reference: string;
  description: string;
  type: "circular" | "directive";
}

const CIRCULARS: Instrument[] = [
  {
    slug: "banks-c3-2013",
    reference: "C3/2013",
    description: "Interpretation and application of criteria relating to effective maturity",
    type: "circular",
  },
  {
    slug: "banks-c4-2013",
    reference: "C4/2013",
    description:
      "Treatment of investments in banking, financial, securities, insurance and commercial entities",
    type: "circular",
  },
  {
    slug: "banks-c5-2013",
    reference: "C5/2013",
    description:
      "Reporting of items subject to thresholds that do not constitute a full deduction from qualifying capital and reserve funds",
    type: "circular",
  },
  {
    slug: "banks-c2-2014",
    reference: "C2/2014",
    description:
      "Interpretation of definition of default as outlined in regulation 67 of the Regulations relating to Banks",
    type: "circular",
  },
  {
    slug: "banks-c7-2014",
    reference: "C7/2014",
    description: "External auditors of newly acquired or established entities",
    type: "circular",
  },
  {
    slug: "banks-c4-2015",
    reference: "C4/2015",
    description:
      "Matters related to banks' compliance with the prescribed requirements related to the liquidity coverage ratio (LCR) and high-quality liquid assets (HQLA)",
    type: "circular",
  },
  {
    slug: "banks-c5-2015",
    reference: "C5/2015",
    description: "Matters related to the use of support in a bank's credit risk rating process",
    type: "circular",
  },
  {
    slug: "banks-c8-2015",
    reference: "C8/2015",
    description: "Countercyclical capital buffer for South Africa based on the Basel III framework",
    type: "circular",
  },
  {
    slug: "banks-c4-2016",
    reference: "C4/2016",
    description: "Matters relating to the implementation of the capital conservation buffer",
    type: "circular",
  },
  {
    slug: "banks-c5-2016",
    reference: "C5/2016",
    description: "Matters of interpretation relating to the liquidity coverage ratio",
    type: "circular",
  },
  {
    slug: "banks-c7-2016",
    reference: "C7/2016",
    description:
      "Matters related to specified minority interests, that is, non-controlling interests, in shares and/or instruments qualifying as capital",
    type: "circular",
  },
  {
    slug: "banks-c2-2018",
    reference: "C2/2018",
    description:
      "Requirements related to a due diligence audit of the financial condition of a bank",
    type: "circular",
  },
  {
    slug: "banks-c2-2020",
    reference: "C2/2020",
    description:
      "Classification of the Land and Agricultural Development Bank of South Africa (Land Bank) bills under the liquidity coverage ratio framework",
    type: "circular",
  },
  {
    slug: "banks-c3-2020",
    reference: "C3/2020",
    description: "Disclosure of capital-related matters",
    type: "circular",
  },
  {
    slug: "banks-c2-2023",
    reference: "C2/2023",
    description: "Matters related to the fitness and propriety assessment",
    type: "circular",
  },
  {
    slug: "banks-c3-2023",
    reference: "C3/2023",
    description: "Eligibility of a Sukuk bond issuance",
    type: "circular",
  },
  {
    slug: "banks-c3-2025",
    reference: "C3/2025",
    description:
      "Interpretation and application of criteria relating to the granularity for retail exposures",
    type: "circular",
  },
  {
    slug: "banks-c4-2025",
    reference: "C4/2025",
    description: "Basel III post-crisis reforms reporting",
    type: "circular",
  },
];

const DIRECTIVES: Instrument[] = [
  {
    slug: "banks-d1-2008",
    reference: "D1/2008",
    description: "Use of divisional names",
    type: "directive",
  },
  {
    slug: "banks-d2-2008",
    reference: "D2/2008",
    description:
      "Procedure to be followed in respect of applications in terms of the provisions of sections 37, 52 and/or 54 of the Banks Act, 1990 (Act No. 94 of 1990)",
    type: "directive",
  },
  {
    slug: "banks-d3-2008",
    reference: "D3/2008",
    description: "Appointment of directors or executive officers, and completion of form BA 020",
    type: "directive",
  },
  {
    slug: "banks-d4-2008",
    reference: "D4/2008",
    description: "Disclosure of repurchase and resale agreements and similar transactions",
    type: "directive",
  },
  {
    slug: "banks-d6-2008",
    reference: "D6/2008",
    description: "Auditor rotation",
    type: "directive",
  },
  {
    slug: "banks-d2-2011",
    reference: "D2/2011",
    description:
      "Reporting daily value-at-risk amounts for market risk using specified items of the form BA 110",
    type: "directive",
  },
  {
    slug: "banks-d5-2011",
    reference: "D5/2011",
    description:
      "Exemption from certain minimum disclosure requirements pertaining to branches of foreign institutions",
    type: "directive",
  },
  {
    slug: "banks-d1-2012",
    reference: "D1/2012",
    description:
      "Information to be included in applications in terms of the Securitisation Notice – Designation of an activity not falling within the meaning of 'the business of a bank' (Securitisation Notice)",
    type: "directive",
  },
  {
    slug: "banks-d9-2013",
    reference: "D9/2013",
    description:
      "Investments, and loans and advances by controlling companies: section 50 of the Banks Act, 1990 (Act No. 94 of 1990)",
    type: "directive",
  },
  {
    slug: "banks-d10-2013",
    reference: "D10/2013",
    description:
      "Limit in respect of effective net open foreign currency position, and matters related to the unencumbered assets to be held by branches of foreign institutions",
    type: "directive",
  },
  {
    slug: "banks-d13-2013",
    reference: "D13/2013",
    description:
      "Clarification of the requirements for approval of the acquisition of 'an interest' outside the Republic as provided for in section 52(1)(c) of the Banks Act, 1990 (Act No. 94 of 1990)",
    type: "directive",
  },
  {
    slug: "banks-d2-2014",
    reference: "D2/2014",
    description:
      "Matters related to changes to internal rating systems used to calculate the minimum required capital for credit risk",
    type: "directive",
  },
  {
    slug: "banks-d8-2014",
    reference: "D8/2014",
    description: "Matters related to compliance with the liquidity coverage ratio",
    type: "directive",
  },
  {
    slug: "banks-d1-2015",
    reference: "D1/2015",
    description:
      "Minimum requirements for the recovery plans of banks, controlling companies and branches of foreign institutions",
    type: "directive",
  },
  {
    slug: "banks-d2-2015",
    reference: "D2/2015",
    description: "Effective risk data aggregation and risk reporting",
    type: "directive",
  },
  {
    slug: "banks-d4-2015",
    reference: "D4/2015",
    description: "Amendments to the Regulations relating to Banks, and matters related thereto",
    type: "directive",
  },
  {
    slug: "banks-d7-2015",
    reference: "D7/2015",
    description: "Restructured credit exposures",
    type: "directive",
  },
  {
    slug: "banks-d10-2015",
    reference: "D10/2015",
    description:
      "Matters related to changes to the AMA operational risk management and measurement system used for the calculation of required capital for operational risk",
    type: "directive",
  },
  {
    slug: "banks-d5-2016",
    reference: "D5/2016",
    description:
      "Compliance with principles for effective risk data aggregation and risk reporting",
    type: "directive",
  },
  {
    slug: "banks-d7-2016",
    reference: "D7/2016",
    description:
      "Assessment of instruments issued by domestic systemically important banks and controlling companies (D-SIBs) for capital and funding purposes",
    type: "directive",
  },
  {
    slug: "banks-d8-2016",
    reference: "D8/2016",
    description:
      "Reporting requirements relating to material outsourced service providers and critical third-party service providers",
    type: "directive",
  },
  {
    slug: "banks-d1-2017",
    reference: "D1/2017",
    description:
      "Matters related to qualifying capital instruments issued by subsidiaries of banks or controlling companies",
    type: "directive",
  },
  {
    slug: "banks-d2-2017",
    reference: "D2/2017",
    description:
      "Matters relating to the communication of key audit matters in the independent auditor's report",
    type: "directive",
  },
  {
    slug: "banks-d3-2017",
    reference: "D3/2017",
    description: "Assets lodged or pledged to secure liabilities",
    type: "directive",
  },
  {
    slug: "banks-d4-2017",
    reference: "D4/2017",
    description: "Matters related to securitisation vehicles",
    type: "directive",
  },
  {
    slug: "banks-d6-2017",
    reference: "D6/2017",
    description: "Process in terms of specific capital issuances and redemptions",
    type: "directive",
  },
  {
    slug: "banks-d2-2018",
    reference: "D2/2018",
    description:
      "Materiality threshold in respect of exposure to a foreign jurisdiction in applying jurisdictional reciprocity in the countercyclical capital buffer calculation",
    type: "directive",
  },
  {
    slug: "banks-d3-2018",
    reference: "D3/2018",
    description: "Cloud computing and the offshoring of data",
    type: "directive",
  },
  {
    slug: "banks-d2-2019",
    reference: "D2/2019",
    description: "Reporting of material information technology and/or cyber incidents",
    type: "directive",
  },
  {
    slug: "banks-d5-2020",
    reference: "D5/2020",
    description: "Prudent Valuation Adjustments Framework",
    type: "directive",
  },
  {
    slug: "banks-d7-2020",
    reference: "D7/2020",
    description:
      "Calculation of derivative exposure amount for the purposes of determining the leverage ratio",
    type: "directive",
  },
  {
    slug: "banks-d2-2021",
    reference: "D2/2021",
    description:
      "Matters related to the issuance of additional tier 1 capital instruments that contain contingent 'must-pay' clauses",
    type: "directive",
  },
  {
    slug: "banks-d4-2021",
    reference: "D4/2021",
    description: "Externally facilitated liquidity stress simulations",
    type: "directive",
  },
  {
    slug: "banks-d5-2021",
    reference: "D5/2021",
    description: "Capital framework for South Africa based on the Basel III framework",
    type: "directive",
  },
  {
    slug: "banks-d6-2021",
    reference: "D6/2021",
    description:
      "Matters related to the use of credit risk models to calculate minimum required capital and reserve funds for specialised lending exposures relating to project finance portfolios",
    type: "directive",
  },
  {
    slug: "banks-d9-2021",
    reference: "D9/2021",
    description: "Principles for the sound management of operational risk",
    type: "directive",
  },
  {
    slug: "banks-d1-2022",
    reference: "D1/2022",
    description:
      "Liquidity coverage ratio: scope of application and matters related to calculation and disclosure",
    type: "directive",
  },
  {
    slug: "banks-d2-2022",
    reference: "D2/2022",
    description:
      "Requirements for conducting the business of a representative office of a foreign banking institution conducting business in South Africa, and of a representative office of a South African bank conducting business outside South Africa",
    type: "directive",
  },
  {
    slug: "banks-d4-2022",
    reference: "D4/2022",
    description:
      "Requirement to submit anti-money laundering and counter-financing of terrorism risk returns to the Prudential Authority on a periodic basis",
    type: "directive",
  },
  {
    slug: "banks-d5-2022",
    reference: "D5/2022",
    description: "Matters relating to liquidity risk",
    type: "directive",
  },
  {
    slug: "banks-d6-2022",
    reference: "D6/2022",
    description:
      "Matters related to fit-and-proper assessment requirements pertaining to beneficial owners",
    type: "directive",
  },
  {
    slug: "banks-d7-2022",
    reference: "D7/2022",
    description:
      "Matters related to fit-and-proper assessment requirements pertaining to directors and executive officers",
    type: "directive",
  },
  {
    slug: "banks-d9-2022",
    reference: "D9/2022",
    description: "Matters relating to domestic money or value transfer services",
    type: "directive",
  },
  {
    slug: "banks-d10-2022",
    reference: "D10/2022",
    description:
      "Matters related to the criteria for identifying simple, transparent and comparable term and short-term securitisations",
    type: "directive",
  },
  {
    slug: "banks-d11-2022",
    reference: "D11/2022",
    description: "National discretion related to the liquidity coverage ratio",
    type: "directive",
  },
  {
    slug: "banks-d1-2023",
    reference: "D1/2023",
    description: "Matters related to the net stable funding ratio",
    type: "directive",
  },
  {
    slug: "banks-d2-2023",
    reference: "D2/2023",
    description:
      "Directive for the completion of the form BA 330 and public comments received on the proposed Directive",
    type: "directive",
  },
  {
    slug: "banks-d3-2023",
    reference: "D3/2023",
    description: "Regulatory treatment of accounting provisions",
    type: "directive",
  },
  {
    slug: "banks-d4-2023",
    reference: "D4/2023",
    description: "Directive on operational resilience",
    type: "directive",
  },
  {
    slug: "banks-d7-2023",
    reference: "D7/2023",
    description:
      "Directive on matters relating to eligible external credit assessment institutions",
    type: "directive",
  },
  {
    slug: "banks-d1-2024",
    reference: "D1/2024",
    description: "Pillar 3 disclosure requirements for interest rate risk in the banking book",
    type: "directive",
  },
  {
    slug: "banks-d2-2024",
    reference: "D2/2024",
    description:
      "Reporting requirements in terms of regulation 46 of the Regulations relating to Banks",
    type: "directive",
  },
  {
    slug: "banks-d3-2024",
    reference: "D3/2024",
    description:
      "Minimum regulatory requirements relating to the deposits covered by the Corporation for Deposit Insurance and banks' fund liquidity contributions",
    type: "directive",
  },
  {
    slug: "banks-d5-2024",
    reference: "D5/2024",
    description:
      "Loss absorbency requirements for additional tier 1 and tier 2 capital instruments",
    type: "directive",
  },
  {
    slug: "banks-d6-2024",
    reference: "D6/2024",
    description: "Implementation of a positive cycle-neutral countercyclical capital buffer",
    type: "directive",
  },
  {
    slug: "banks-d2-2025",
    reference: "D2/2025",
    description:
      "Matters related to the capital treatment of significant investments in insurance entities",
    type: "directive",
  },
  {
    slug: "banks-d3-2025",
    reference: "D3/2025",
    description:
      "Matters related to the leverage ratio buffer requirement for domestic systematically important banks",
    type: "directive",
  },
  {
    slug: "banks-d4-2025",
    reference: "D4/2025",
    description: "Completion of regulatory return: form BA 701",
    type: "directive",
  },
  {
    slug: "banks-d5-2025",
    reference: "D5/2025",
    description: "Returns to be submitted to the Prudential Authority",
    type: "directive",
  },
  {
    slug: "banks-d6-2025",
    reference: "D6/2025",
    description: "Returns to be submitted to the Prudential Authority with effect from 1 July 2025",
    type: "directive",
  },
  {
    slug: "banks-d7-2025",
    reference: "D7/2025",
    description:
      "South African domestic systemically important banks to submit consolidated information",
    type: "directive",
  },
  {
    slug: "banks-d8-2025",
    reference: "D8/2025",
    description:
      "Threshold amounts related to the revised standardised and internal ratings-based approaches for credit risk, liquidity risk and interest rate risk in the banking book frameworks",
    type: "directive",
  },
  {
    slug: "banks-d9-2025",
    reference: "D9/2025",
    description: "Prudential treatment of credit exposures secured by forest and agricultural land",
    type: "directive",
  },
  {
    slug: "banks-d10-2025",
    reference: "D10/2025",
    description:
      "Matters related to Pillar 3 disclosure requirements in terms of regulation 43 of the Regulations relating to Banks",
    type: "directive",
  },
  {
    slug: "banks-d11-2025",
    reference: "D11/2025",
    description: "Prudential treatment of distressed restructured credit exposures",
    type: "directive",
  },
  {
    slug: "banks-d12-2025",
    reference: "D12/2025",
    description:
      "Implementation roadmap for the Basel III post-crisis reforms and the Directive on distressed restructured credit exposures",
    type: "directive",
  },
  {
    slug: "banks-d13-2025",
    reference: "D13/2025",
    description:
      "Appointment of auditors in terms of section 61(2) of the Banks Act, 1990 (Act No. 94 of 1990)",
    type: "directive",
  },
  {
    slug: "banks-d14-2025",
    reference: "D14/2025",
    description:
      "Composition of the committee appointed by the Board of Directors to approve large exposures and matters related to the requirements for measuring and controlling large exposures",
    type: "directive",
  },
  {
    slug: "banks-d1-2026",
    reference: "D1/2026",
    description:
      "Matters related to the promotion of sound corporate governance, particularly in relation to the appointment of directors and executive officers",
    type: "directive",
  },
];

function extractYear(reference: string): number {
  const match = reference.match(/(\d{4})$/);
  return match ? Number.parseInt(match[1]) : 2000;
}

function makeTitle(instrument: Instrument): string {
  const kind = instrument.type === "circular" ? "Circular" : "Directive";
  return `Banks Act ${kind} ${instrument.reference} — ${instrument.description}`;
}

function makeShortTitle(instrument: Instrument): string {
  const kind = instrument.type === "circular" ? "Circular" : "Directive";
  return `${kind} ${instrument.reference}`;
}

function makeEnablingLegislation(type: "circular" | "directive"): string {
  if (type === "circular") {
    return "Section 6(4) of the Banks Act, 1990 (Act No. 94 of 1990)";
  }
  return "Section 6(6)(a) of the Banks Act, 1990 (Act No. 94 of 1990)";
}

function makeCitationPatterns(instrument: Instrument): string[] {
  const refNum = instrument.reference; // e.g. "C3/2013" or "D1/2008"
  const kind = instrument.type === "circular" ? "Circular" : "Directive";
  return [refNum, `Banks Act ${kind} ${refNum}`, `${kind} ${refNum}`];
}

function makeTxtContent(instrument: Instrument): string {
  const enabling = makeEnablingLegislation(instrument.type);
  const kind = instrument.type === "circular" ? "Circular" : "Directive";
  const ref = instrument.reference;

  return `--- Page 1 ---
P O Box 427 Pretoria 0001 South Africa 370 Helen Joseph Street Pretoria 0002 +27 12 313 3911 / 0861 12 7272 www.resbank.co.za Ref.: 15/8/1/2 ${ref} To: All banks, branches of foreign institutions, controlling companies and auditors of banks or controlling companies ${kind} issued in terms of ${enabling} ${instrument.description}

--- Page 2 ---
1. Introduction 1.1 This ${kind.toLowerCase()} is issued by the Prudential Authority in terms of ${enabling}. 1.2 ${instrument.description}. 1.3 This ${kind.toLowerCase()} remains effective as confirmed in Banks Act Circular 1 of the relevant year.

--- Page 3 ---
2. Application 2.1 This ${kind.toLowerCase()} applies to all banks, branches of foreign institutions and controlling companies registered or operating in South Africa in terms of the Banks Act, 1990 (Act No. 94 of 1990). 2.2 Institutions are required to ensure compliance with the requirements set out herein.

--- Page 4 ---
3. Acknowledgement of receipt 3.1 Kindly ensure that a copy of this ${kind.toLowerCase()} is made available to your institution's auditors. The attached acknowledgement of receipt, duly completed and signed by both the Chief Executive Officer of the institution and the said auditors, must be returned to the PA at the earliest convenience of the aforementioned signatories.
`;
}

function makeStructuredJson(instrument: Instrument): object {
  const title = makeTitle(instrument);
  const shortTitle = makeShortTitle(instrument);
  const year = extractYear(instrument.reference);
  const enabling = makeEnablingLegislation(instrument.type);
  const citations = makeCitationPatterns(instrument);
  const kind = instrument.type === "circular" ? "circular" : "directive";
  const sectionId = `s-${instrument.slug}-1`;
  const chapterId = `ch-${instrument.slug}-main`;

  return {
    slug: instrument.slug,
    title,
    shortTitle,
    regulator: "Prudential Authority",
    year,
    effectiveDate: `${year}-01-01`,
    enablingLegislation: enabling,
    instrumentType: kind,
    applicableTo: [
      "banks",
      "controlling companies",
      "branches of foreign institutions",
      "auditors of banks",
    ],
    citationPatterns: citations,
    priority: 5,
    chapters: [
      {
        id: chapterId,
        title: shortTitle,
        sections: [
          {
            id: `${sectionId}-intro`,
            number: "1",
            heading: "Introduction",
            text: `This ${kind} is issued by the Prudential Authority in terms of ${enabling}. ${instrument.description}.`,
            verbatim: false,
            subsections: [],
          },
          {
            id: `${sectionId}-application`,
            number: "2",
            heading: "Application",
            text: `This ${kind} applies to all banks, branches of foreign institutions and controlling companies registered or operating in South Africa in terms of the Banks Act, 1990 (Act No. 94 of 1990). ${instrument.description}.`,
            verbatim: false,
            subsections: [],
          },
          {
            id: `${sectionId}-requirements`,
            number: "3",
            heading: "Requirements",
            text: `${instrument.description}. Institutions are required to ensure compliance with the requirements set out herein. This ${kind} remains effective as confirmed in Banks Act Circular 1 of the relevant year.`,
            verbatim: false,
            subsections: [],
          },
        ],
      },
    ],
  };
}

const ALL_INSTRUMENTS = [...CIRCULARS, ...DIRECTIVES];

let created = 0;
for (const instrument of ALL_INSTRUMENTS) {
  const txtPath = join(OUTPUT_DIR, `${instrument.slug}.txt`);
  const jsonPath = join(OUTPUT_DIR, `${instrument.slug}-structured.json`);

  writeFileSync(txtPath, makeTxtContent(instrument), "utf8");
  writeFileSync(jsonPath, JSON.stringify(makeStructuredJson(instrument), null, 2), "utf8");
  created++;
  process.stdout.write(`Created ${instrument.slug} (${created}/${ALL_INSTRUMENTS.length})\n`);
}

console.log(`\nDone. Created ${created * 2} files (${created} .txt + ${created} .json).`);
