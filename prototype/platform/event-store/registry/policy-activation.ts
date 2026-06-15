// platform/event-store/registry/policy-activation.ts
//
// Policy-version-in-force event-type registry rows.
//
// Covers:
//   PolicyVersionActivated — the act by which a named policy version is
//     placed in force at a stated effective date. Generic umbrella with
//     `payload.policyDomain` discriminating valuation / accounting-IFRS /
//     fx-translation today; new domains extend the discriminator (no
//     schema or registry-row proliferation).
//
// Retention classification:
//   RETENTION_GOVERNANCE_7Y — policy activation is a governance/director-
//     decision-level act per Companies Act ss.24 + 66 + 71 + 73 + 75
//     read together with Banks Act s.60. The activation chain is the
//     load-bearing audit trail for "which policy version governed at
//     time T?" — replay determinism for CFO-attested statements depends
//     on it. 7-year archive-tier retention.
//
// Issuer / authority routing:
//   Subscribers list intentionally broad — every consumer of the
//   policy-in-force chain reads this stream:
//     - Helena (Chief Risk Officer, governance) — valuation domain
//       authority + RAS monitoring across all domains.
//     - Camille (CFO, governance) — accounting-IFRS authority + close
//       attestation consumer (Slice C).
//     - Rohan (Market risk engineer, engineering) — valuation engine
//       consumer (Slice B: OfficialMarkAdopted carries policyVersionRef).
//     - Bea (Accounting & financial reporting engineer, engineering) —
//       close-handler consumer.
//     - Vera (Internal audit engineer, engineering) — recon assertion
//       carrier (market-data-provenance-gate, period-close-replay-
//       determinism in Slice C).
//     - Atlas (substrate) — substrate monitoring.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; recorder script in PR #620).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//
// Author: Atlas (Core banking platform architect, engineering)

import { policyVersionActivatedPayloadSchema } from "../event-types/policy-activation";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

export const POLICY_ACTIVATION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "PolicyVersionActivated",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["Helena", "Camille", "Rohan", "Bea", "Vera", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: policyVersionActivatedPayloadSchema,
    citationsHint: [
      "D-EVENT-VIEW-BOUNDARY-WIRE",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "P1-EVENTS-AS-TRUTH",
    ],
    source: "platform/event-store/event-types/policy-activation.ts",
    v2Status: "v1-only",
  },
];
