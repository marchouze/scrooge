// platform/event-store/registry/close-management.ts
//
// Close-management event-type registry rows.
//
// Covers:
//   PeriodClosed — the CFO attestation closing a financial period. Carries
//     the policy-activation set, code SHA, and statement hashes needed to
//     prove replay determinism (Atlas §3.2, 2026-05-20 source record).
//     Supersedes/extends AccountingPeriodClosed for the attestation role;
//     both co-exist during the Slice C migration window.
//
// Retention classification:
//   RETENTION_GOVERNANCE_7Y — CFO attestation is a director-level act per
//   Companies Act 71 of 2008 §29 + §30 + §61 read with Banks Act 94 of
//   1990 s60 (books and records). The close chain is the load-bearing audit
//   trail for "what did the CFO attest to and under which policy version?"
//   — replay determinism for BA returns and IFRS statements depends on it.
//   7-year archive-tier retention.
//
// Subscribers:
//   Broad subscription — every consumer of the close chain reads this stream:
//   - Camille (CFO, governance) — issuer + attestation authority.
//   - Helena (Chief Risk Officer, governance) — BA-350 + BA-600 gate
//     consumer; risk policy version pinned in policyVersionRefs.
//   - Bea (Accounting & financial reporting engineer, engineering) —
//     BA-return trigger consumer; close-handler emitter.
//   - Eitan (Treasury / ALM engineer, engineering) — BA-325 LCR consumer.
//   - Mira (Compliance / obligations engineer, engineering) — regulatory
//     submission consumer (close event gates BA filing window).
//   - Vera (Internal audit engineer, engineering) — recon:period-close-
//     replay-determinism assertion carrier; hash-divergence finder.
//   - Atlas (substrate) — substrate monitoring.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; PR #620 records the decision).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//   - IFRS IAS 1 §29; Companies Act 71 of 2008 §29.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//         Atlas (Core banking platform architect, engineering)

import { periodClosedPayloadSchema } from "../event-types/close-management";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

export const CLOSE_MANAGEMENT_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "PeriodClosed",
    class: "governance",
    issuer: "Camille",
    subscribers: ["Camille", "Helena", "Bea", "Eitan", "Mira", "Vera", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: periodClosedPayloadSchema,
    citationsHint: [
      "D-EVENT-VIEW-BOUNDARY-WIRE",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "P1-EVENTS-AS-TRUTH",
      "IFRS-IAS-1-§29",
      "Companies-Act-71-2008-§29",
    ],
    source: "platform/event-store/event-types/close-management.ts",
    status: "active",
  },
];
