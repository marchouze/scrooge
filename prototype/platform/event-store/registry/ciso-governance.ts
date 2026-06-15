// platform/event-store/registry/ciso-governance.ts
//
// Event-type registry rows for CISO (Chief Information Security Officer)
// quarterly governance events.
//
// Covers:
//   - CisoJs2AttestationFiled — PA/FSCA Joint Standard 2 periodic attestation
//   - SbomReviewCompleted — Software Bill of Materials quarterly review
//   - ThreatModelGateCompleted — quarterly threat-model gate
//   - KeyCeremonyAttested — HSM / key-ceremony attestation
//
// Authority:
//   - PA/FSCA Joint Standard 2 of 2024 (JS-2) — information and cybersecurity
//   - POPIA s.19–22 (technical and organisational security measures)
//   - Principle 4 — Security designed in from the start
//   - Principle 6 — Autonomous by default; governance seats are standing agents
//   - Banks Act 94/1990 §73 (record-keeping obligations)
//
// Author: Senna (Chief Information Security Officer, governance)

import {
  cisoJs2AttestationFiledPayloadSchema,
  keyCeremonyAttestedPayloadSchema,
  sbomReviewCompletedPayloadSchema,
  threatModelGateCompletedPayloadSchema,
} from "../event-types/ciso-governance";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

export const CISO_GOVERNANCE_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    // CisoJs2AttestationFiled — PA/FSCA Joint Standard 2 attestation.
    // Filed quarterly by Senna (CISO). Captures the aggregate result of
    // the full JS-2 control assessment cycle, including open findings
    // and the overall green/amber/red rating.
    //
    // JS-2 §4 requires the responsible function to maintain and periodically
    // attest to all cybersecurity controls. This event is the formal
    // record of that attestation.
    type: "CisoJs2AttestationFiled",
    class: "governance",
    payloadSchema: cisoJs2AttestationFiledPayloadSchema,
    issuer: "Senna",
    subscribers: ["Owen", "Helena", "Vera", "dashboard", "audit"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    citationsHint: [
      "PA-FSCA-JS2-2024",
      "PA-FSCA-JS2-2024-§4",
      "POPIA-s19-22",
      "Banks Act 94/1990 §73",
    ],
    source: "scripts/governance/ciso-periodic-run.ts (CISO quarterly run)",
    v2Status: "v1-only",
  },
  {
    // SbomReviewCompleted — Software Bill of Materials quarterly review.
    // Filed quarterly by Senna (CISO). Records the results of scanning all
    // third-party components for known vulnerabilities (CVE/NVD), with
    // severity breakdown and remediation deadline.
    //
    // JS-2 §4.3 (supply-chain security) mandates periodic SBOM review.
    // Zero critical findings is the target; any critical finding triggers
    // an immediate remediation sprint.
    type: "SbomReviewCompleted",
    class: "governance",
    payloadSchema: sbomReviewCompletedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Owen", "Devon", "Vera", "dashboard", "audit"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    citationsHint: ["PA-FSCA-JS2-2024-§4.3", "POPIA-s19-22", "Banks Act 94/1990 §73"],
    source: "scripts/governance/ciso-periodic-run.ts (CISO quarterly run)",
    v2Status: "v1-only",
  },
  {
    // ThreatModelGateCompleted — quarterly threat-model gate.
    // Filed quarterly by Senna (CISO). Confirms that all material systems
    // have current threat models, all threats have assigned controls, and
    // controls are adequate for the current threat landscape.
    //
    // JS-2 §4.1 requires periodic threat identification and risk
    // assessment. The gate "passed" status is the CISO's sign-off that
    // no unmitigated critical threats remain open.
    type: "ThreatModelGateCompleted",
    class: "governance",
    payloadSchema: threatModelGateCompletedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Owen", "Helena", "Devon", "Vera", "dashboard", "audit"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    citationsHint: [
      "PA-FSCA-JS2-2024-§4.1",
      "POPIA-s19-22",
      "Banks Act 94/1990 §73",
      "Principle-4-security-designed-in",
    ],
    source: "scripts/governance/ciso-periodic-run.ts (CISO quarterly run)",
    v2Status: "v1-only",
  },
  {
    // KeyCeremonyAttested — HSM / key-ceremony attestation.
    // Filed quarterly by Senna (CISO). Attests that the FIPS-Level-3 HSM
    // key ceremony was performed correctly, with quorum participation and
    // independent witnessing. Key material integrity is confirmed.
    //
    // JS-2 §5.2 mandates cryptographic key management controls. The
    // quarterly ceremony rotates all operational key material; the
    // attestation event is the formal record of the ceremony.
    type: "KeyCeremonyAttested",
    class: "governance",
    payloadSchema: keyCeremonyAttestedPayloadSchema,
    issuer: "Senna",
    subscribers: ["Owen", "Vera", "audit"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    citationsHint: [
      "PA-FSCA-JS2-2024-§5.2",
      "Principle-4-security-designed-in",
      "Banks Act 94/1990 §73",
    ],
    source: "scripts/governance/ciso-periodic-run.ts (CISO quarterly run)",
    v2Status: "v1-only",
  },
];
