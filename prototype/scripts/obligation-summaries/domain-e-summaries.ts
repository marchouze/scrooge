// prototype/scripts/obligation-summaries/domain-e-summaries.ts
//
// P4-SCALE — Domain E (Cybersecurity / IT governance / operational resilience)
// reviewed requirement summaries. SA `ORG-CY-*` rows. Source text is `missing`
// in the live drill-down for the thin rows (Joint Standards / SARB Directives /
// reference frameworks not graph-extracted as Provisions); summaries are
// authored from the citation + existing prose, gap noted (not fabricated).
//
// Verdict split:
//   - reviewed-modified: the thin one-liner rows (CY-01..14) expanded.
//   - reviewed-confirmed: rows whose existing requirement is already an accurate
//     multi-clause summary (CY-02-RECON-CRO-INDEPENDENCE, CY-15, CY-16, CY-17).
//
// Owning seats preserved from the adopted owner: coo (governance/outsourcing/
// resilience framework rows) and ciso (security-control / SDLC / incident rows).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { SummaryModule } from "./summary-types";

const MISSING = "Source text missing in the drill-down (Joint Standard / SARB Directive / reference framework not graph-extracted as a Provision); summary authored from the citation + existing requirement prose.";

export const DOMAIN_E: SummaryModule = {
  "ORG-CY-01": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Establish and maintain a cybersecurity and cyber-resilience framework under Joint Standard 2 of 2024, with named board and executive accountability, covering governance, risk identification, protective controls, detection, response and recovery. The framework must be board-approved, proportionate to the bank's risk profile, and reviewed on a regular cycle.",
    rationale: `Thin one-liner expanded from the Joint Standard 2/2024 citation. ${MISSING}`,
  },
  "ORG-CY-02": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Designate an accountable executive (the 'responsible person') for cybersecurity and cyber-resilience under Joint Standard 2 of 2024, with sufficient authority, independence and resources to discharge the role and direct access to the board or its delegated committee. The designation and the responsible person's mandate must be documented and kept current.",
    rationale: `Thin one-liner expanded from the Joint Standard 2/2024 responsible-person citation. ${MISSING}`,
  },
  "ORG-CY-02-RECON-CRO-INDEPENDENCE": {
    reviewerSeat: "coo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement already accurately states that the JS 2/2024 §6 cyber responsible-person designation and the CRO operational-independence obligation each bind independently (JS 2/2024 §§6–7; BCBS Corporate Governance Principles 2015 §3); confirmed without rewrite. Domain E — cyber.",
  },
  "ORG-CY-03": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Perform cyber threat modelling and risk assessment and maintain a controls catalogue mapped to identified threats under Joint Standard 2 of 2024, so that protective and detective controls are selected and calibrated against the bank's actual threat landscape. Review the threat model and controls on a regular cycle and on material change to systems or threats.",
    rationale: `Thin one-liner expanded from the Joint Standard 2/2024 citation. ${MISSING}`,
  },
  "ORG-CY-04": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Report material cyber incidents to the Prudential Authority and FSCA within the timelines stipulated by Joint Standard 2 of 2024, providing the prescribed initial notification and follow-up information. Maintain an incident-classification scheme and escalation procedure so reportable incidents are identified and notified promptly.",
    rationale: `Thin one-liner expanded from the Joint Standard 2/2024 incident-reporting citation. ${MISSING}`,
  },
  "ORG-CY-05": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Maintain a tested cyber-incident-response capability with rehearsed runbooks under Joint Standard 2 of 2024 and the BCBS operational-resilience principles, covering detection, containment, eradication, recovery and post-incident review. Exercise the response plan periodically (including severe-but-plausible scenarios) and update it from the lessons learned.",
    rationale: `Thin one-liner expanded from the Joint Standard 2/2024 + BCBS Op-Resilience citation. ${MISSING}`,
  },
  "ORG-CY-06": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Assess and register cloud-computing and data-offshoring arrangements under SARB PA Directive 3 of 2018, treating material outsourcing as a board-reserved matter, and ensure data sovereignty, exit and oversight requirements are met before adoption. Maintain the outsourcing register and the supporting risk assessments.",
    rationale: `Thin one-liner expanded from the SARB PA Directive 3/2018 citation. ${MISSING}`,
  },
  "ORG-CY-07": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Notify the Prudential Authority in advance of any material outsourcing arrangement as required by SARB Directive 3 of 2018, providing the prescribed information on the service, the provider and the risk controls before the arrangement takes effect. Maintain ongoing oversight of material outsourcing throughout its life.",
    rationale: `Thin one-liner expanded from the SARB Directive 3/2018 material-outsourcing citation. ${MISSING}`,
  },
  "ORG-CY-08": {
    reviewerSeat: "coo",
    verdict: "reviewed-modified",
    summary:
      "Identify the bank's Important Business Services, set impact tolerances for each, and test resilience against severe-but-plausible disruption scenarios under the BCBS operational-resilience principles. Remediate any service that cannot remain within its impact tolerance and report the resilience position to the board.",
    rationale: `Thin one-liner expanded from the BCBS Operational-Resilience citation. ${MISSING}`,
  },
  "ORG-CY-09": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Operate an information-security management system aligned to ISO/IEC 27001:2022 (used as a reference framework), covering the ISMS scope, risk assessment and treatment, the Annex A control set, and continual improvement. Maintain the Statement of Applicability and the supporting risk-treatment records.",
    rationale: `Thin one-liner expanded from the ISO/IEC 27001:2022 reference citation. ${MISSING}`,
  },
  "ORG-CY-10": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Align the bank's cybersecurity controls to the NIST Cybersecurity Framework 2.0 functions — Govern, Identify, Protect, Detect, Respond and Recover (used as a reference framework) — and map implemented controls to the framework so coverage and maturity can be assessed. Track and remediate gaps against the target profile.",
    rationale: `Thin one-liner expanded from the NIST CSF 2.0 reference citation. ${MISSING}`,
  },
  "ORG-CY-11": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Operate the board-approved cyber severity-tier model (T1–T4) per RAS B6, classifying each cyber event by severity and triggering Regulator notification at the T3 and T4 thresholds. Calibrate the tier definitions and notification triggers to the JS 2/2024 incident-reporting obligation and review them as the appetite is refined.",
    rationale: `Thin one-liner expanded from the RAS B6 (CEO-approved) severity-tier citation. ${MISSING}`,
  },
  "ORG-CY-12": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Operate a secure software-development lifecycle aligned to NIST SP 800-218 (SSDF v1.1, used as a reference) across its four practice groups — Prepare the Organisation, Protect the Software, Produce Well-Secured Software, and Respond to Vulnerabilities. Embed the SSDF practices into the bank's engineering pipeline and evidence their operation.",
    rationale: `Thin one-liner expanded from the NIST SP 800-218 (SSDF v1.1) reference citation. ${MISSING}`,
  },
  "ORG-CY-13": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Produce build-provenance attestations and signed artefacts from hermetic, non-falsifiable builds, targeting SLSA v1.0 Build Level 3 (used as a reference) so that the integrity and origin of deployed software can be verified. Maintain the provenance records and the verification controls in the deployment pipeline.",
    rationale: `Thin one-liner expanded from the SLSA v1.0 reference citation. ${MISSING}`,
  },
  "ORG-CY-14": {
    reviewerSeat: "ciso",
    verdict: "reviewed-modified",
    summary:
      "Apply the secure-development-lifecycle controls of ISO/IEC 27001:2022 Annex A.8.25–A.8.34 (used as a reference) — secure coding, application security requirements, secure system architecture and engineering principles, separation of development/test/production environments, outsourced-development governance, and system acceptance and security testing. Evidence these controls across the SDLC.",
    rationale: `Thin one-liner expanded from the ISO/IEC 27001:2022 Annex A.8.25–A.8.34 reference citation. ${MISSING}`,
  },
  "ORG-CY-15": {
    reviewerSeat: "coo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement is already an accurate multi-clause summary of the Joint Standard 1 of 2023 IT-governance discipline-cluster (board-level IT governance, IT-strategy alignment, IT risk-management framework integration); confirmed without rewrite. Domain E — cyber / IT governance.",
  },
  "ORG-CY-16": {
    reviewerSeat: "coo",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement is already an accurate multi-clause summary of the Joint Standard 1 of 2023 IT-risk-management discipline-cluster (IT-risk taxonomy, IT-control catalogue, IT third-party risk-management); confirmed without rewrite. Domain E — cyber / IT governance.",
  },
  "ORG-CY-17": {
    reviewerSeat: "ciso",
    verdict: "reviewed-confirmed",
    summary: undefined,
    rationale:
      "Existing requirement is already an accurate summary of Joint Standard 2 of 2024 (governance, security controls, resilience capabilities, regulatory reporting of cyber incidents) with the detailed §-level citation preserved; confirmed without rewrite. Domain E — cyber.",
  },
};
