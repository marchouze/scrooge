// platform/event-store/event-types/ciso-governance.ts
//
// CISO (Chief Information Security Officer) quarterly governance event-payload
// schemas.
//
// Covers:
//   - CisoJs2AttestationFiled — PA/FSCA Joint Standard 2 periodic attestation
//   - SbomReviewCompleted — Software Bill of Materials quarterly review
//   - ThreatModelGateCompleted — quarterly threat-model gate
//   - KeyCeremonyAttested — HSM / key-ceremony attestation
//   - GovernanceSeatRunCompleted — re-exported from governance-seat-runs.ts (canonical)
//
// Authority:
//   - PA/FSCA Joint Standard 2 of 2024 (JS-2) — information and cybersecurity
//   - POPIA s.19–22 (technical and organisational security measures)
//   - Principle 4 — Security designed in from the start
//   - Principle 6 — Autonomous by default
//
// Author: Senna (Chief Information Security Officer, governance)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// GovernanceSeatRunCompleted
//
// Canonical shared type defined in governance-seat-runs.ts (CCO delivery).
// Re-exported here for backward-compat import paths used by ciso-periodic-run.ts
// and ciso-periodic-run.test.ts.
// ---------------------------------------------------------------------------

export {
  GovernanceSeatRunCompletedPayloadSchema as governanceSeatRunCompletedPayloadSchema,
  type GovernanceSeatRunCompletedPayload,
  makeGovernanceSeatRunCompleted,
} from "./governance-seat-runs";

// ---------------------------------------------------------------------------
// CisoJs2AttestationFiled
//
// Emitted each quarter when Senna (CISO) files the PA/FSCA Joint Standard 2
// periodic attestation. JS-2 requires a formal assessment of all cybersecurity
// controls with a signed attestation from the information security function.
//
// Regulatory chain:
//   PA/FSCA Joint Standard 2 of 2024 → POL-SECURITY-001 → PROC-CISO-JS2-01
//   → CisoJs2AttestationFiled
// ---------------------------------------------------------------------------

export const cisoJs2AttestationFiledPayloadSchema = z.object({
  /** Run identifier linking this attestation to the quarterly run. */
  runId: z.string().min(1),
  /** Reporting period (YYYY-QN). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be in YYYY-QN format (e.g. 2026-Q2)",
  }),
  /** Agent that attested — always "Senna" for the CISO seat. */
  attestedBy: z.literal("Senna"),
  /** JS-2 version that governs this attestation cycle (e.g. "JS2-2024"). */
  js2Version: z.string().min(1),
  /** Total number of JS-2 controls assessed this period. */
  controlsAssessed: z.number().int().nonnegative(),
  /** Open findings from the assessment (not yet remediated). */
  findingsOpen: z.number().int().nonnegative(),
  /** Findings resolved since the previous attestation. */
  findingsResolved: z.number().int().nonnegative(),
  /**
   * Overall JS-2 control rating this period.
   *   green  — all controls effective; no material exceptions.
   *   amber  — one or more findings but no critical control failures.
   *   red    — critical control failure(s); escalation required.
   */
  overallRating: z.enum(["green", "amber", "red"]),
  /** ISO 8601 UTC timestamp when the attestation was filed. */
  attestedAt: z.string().min(1),
});

export type CisoJs2AttestationFiledPayload = z.infer<typeof cisoJs2AttestationFiledPayloadSchema>;

export function makeCisoJs2AttestationFiled(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: CisoJs2AttestationFiledPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "CisoJs2AttestationFiled",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: cisoJs2AttestationFiledPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SbomReviewCompleted
//
// Emitted each quarter when Senna (CISO) completes the Software Bill of
// Materials review. The SBOM review inventories all third-party components,
// checks against known-vulnerability feeds (CVE/NVD), and classifies
// findings by severity.
//
// Regulatory chain:
//   PA/FSCA Joint Standard 2 of 2024 §4.3 (supply-chain security)
//   → POL-SECURITY-001 → PROC-CISO-SBOM-01
//   → SbomReviewCompleted
// ---------------------------------------------------------------------------

export const sbomReviewCompletedPayloadSchema = z.object({
  /** Run identifier linking this SBOM review to the quarterly run. */
  runId: z.string().min(1),
  /** Reporting period (YYYY-QN). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be in YYYY-QN format (e.g. 2026-Q2)",
  }),
  /** Total number of third-party components scanned. */
  componentsScanned: z.number().int().nonnegative(),
  /** Total number of vulnerabilities found (all severities combined). */
  vulnerabilitiesFound: z.number().int().nonnegative(),
  /** Count of critical-severity vulnerabilities (CVSS ≥ 9.0). */
  criticalCount: z.number().int().nonnegative(),
  /** Count of high-severity vulnerabilities (CVSS 7.0–8.9). */
  highCount: z.number().int().nonnegative(),
  /** ISO 8601 date by which critical/high vulnerabilities must be remediated. */
  remediationDeadline: z.string().min(1),
  /** ISO 8601 UTC timestamp when the SBOM review was completed. */
  reviewedAt: z.string().min(1),
});

export type SbomReviewCompletedPayload = z.infer<typeof sbomReviewCompletedPayloadSchema>;

export function makeSbomReviewCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SbomReviewCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SbomReviewCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sbomReviewCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// ThreatModelGateCompleted
//
// Emitted each quarter when Senna (CISO) completes the threat-model gate
// review. The gate verifies that all material systems have a current threat
// model, all identified threats have assigned controls, and controls are
// assessed as adequate for the current threat landscape.
//
// Regulatory chain:
//   PA/FSCA Joint Standard 2 of 2024 §4.1 (threat identification)
//   → POL-SECURITY-001 → PROC-CISO-THREAT-GATE-01
//   → ThreatModelGateCompleted
// ---------------------------------------------------------------------------

export const threatModelGateCompletedPayloadSchema = z.object({
  /** Run identifier linking this gate to the quarterly run. */
  runId: z.string().min(1),
  /** Reporting period (YYYY-QN). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be in YYYY-QN format (e.g. 2026-Q2)",
  }),
  /** Number of material systems for which threat models were reviewed. */
  systemsReviewed: z.number().int().nonnegative(),
  /** Total threats identified across all reviewed systems. */
  threatsIdentified: z.number().int().nonnegative(),
  /**
   * Whether all identified threats have controls assessed as adequate.
   * false implies at least one unmitigated high-risk threat.
   */
  controlsAdequate: z.boolean(),
  /**
   * Overall gate status:
   *   passed       — all systems reviewed; controls adequate; no escalation.
   *   conditional  — minor gaps; remediation plan in place; no blocker.
   *   failed       — critical gaps; escalation to CEO required.
   */
  gateStatus: z.enum(["passed", "conditional", "failed"]),
  /** ISO 8601 UTC timestamp when the gate was completed. */
  completedAt: z.string().min(1),
});

export type ThreatModelGateCompletedPayload = z.infer<typeof threatModelGateCompletedPayloadSchema>;

export function makeThreatModelGateCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ThreatModelGateCompletedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ThreatModelGateCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: threatModelGateCompletedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// KeyCeremonyAttested
//
// Emitted each quarter when Senna (CISO) attests that the HSM key-ceremony
// was performed correctly. Key ceremonies rotate cryptographic key material
// in the FIPS-Level-3 HSMs and require independent witnessing to prevent
// single-point compromise.
//
// Regulatory chain:
//   PA/FSCA Joint Standard 2 of 2024 §5.2 (cryptographic controls)
//   → POL-SECURITY-001 → PROC-CISO-KEY-CEREMONY-01
//   → KeyCeremonyAttested
// ---------------------------------------------------------------------------

export const keyCeremonyAttestedPayloadSchema = z.object({
  /** Run identifier linking this attestation to the quarterly run. */
  runId: z.string().min(1),
  /** Reporting period (YYYY-QN). */
  period: z.string().regex(/^\d{4}-Q[1-4]$/, {
    message: "period must be in YYYY-QN format (e.g. 2026-Q2)",
  }),
  /** Type of ceremony (e.g. "quarterly-rotation", "emergency-rotation", "initial-keying"). */
  ceremonyType: z.string().min(1),
  /** Number of quorum participants who attended the ceremony. */
  participantCount: z.number().int().positive(),
  /** Agent or person who independently witnessed the ceremony. */
  witnessedBy: z.string().min(1),
  /** Whether all key material was confirmed intact and correctly rotated. */
  keyMaterialIntact: z.boolean(),
  /** ISO 8601 UTC timestamp when the ceremony was completed. */
  completedAt: z.string().min(1),
});

export type KeyCeremonyAttestedPayload = z.infer<typeof keyCeremonyAttestedPayloadSchema>;

export function makeKeyCeremonyAttested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: KeyCeremonyAttestedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "KeyCeremonyAttested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: keyCeremonyAttestedPayloadSchema.parse(args.payload),
  });
}

export const CISO_GOVERNANCE_TYPED_EVENT_TYPES = [
  "CisoJs2AttestationFiled",
  "SbomReviewCompleted",
  "ThreatModelGateCompleted",
  "KeyCeremonyAttested",
] as const;

export type CisoGovernanceEventType = (typeof CISO_GOVERNANCE_TYPED_EVENT_TYPES)[number];
