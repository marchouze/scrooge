// platform/event-store/registry/ifrs-policy-thresholds.ts
//
// IFRS quantitative-threshold approval event-type registry rows.
//
// Covers:
//   - SicrThresholdApproved — §3.2.2 of FIN-ACCT-01 v1.3.
//   - MaterialityBenchmarkApproved — §3.5.2 of FIN-ACCT-01 v1.3.
//
// Both events ratify policy parameters that drive downstream IFRS-9 ECL
// staging (SICR) and IAS-1 materiality threshold computations. They form
// a per-policy-version supersession chain (`supersedes` field) so replay
// at as-of < latest yields the prior threshold value.
//
// Retention classification:
//   RETENTION_ACCOUNTING_7Y — accounting-policy ratification is an
//     accounting-record act per Companies Act 71/2008 s.24 read together
//     with Banks Act s.60. The chain is load-bearing audit trail for
//     "which threshold governed at time T?" — replay determinism for
//     CFO-attested statements depends on it.
//
// Replay-fold: latest-wins-per-key, keyed by `policyVersionId`. At any
// point in time the active threshold is the latest event for the active
// policy version; back-dated changes form an explicit supersession chain.
//
// Issuer / authority routing:
//   - Issuer is the CFO seat in steady state (`agent:camille:cfo`); CEO
//     session-delegation during the build phase before the CFO seat is
//     operational. The registry's `issuer` field is `any-agent` because
//     the actual emitter is the dispatch handler (script or recordDecision
//     downstream); the permission-gate's per-agent allow-list constrains
//     who may legitimately emit.
//   - Subscribers list intentionally broad — every consumer of the
//     IFRS-9 threshold chain reads this stream:
//       - Camille (CFO, governance) — ratification authority + close
//         attestation consumer.
//       - Helena (Chief Risk Officer, governance) — ICAAP / SICR
//         calibration consumer.
//       - Bea (Accounting & financial reporting engineer, engineering) —
//         IFRS-9 ECL engine + materiality-threshold computation
//         consumer; close-handler consumer.
//       - Rohan (Market risk engineer, engineering) — IFRS-9 staging
//         co-consumer where market-risk-driven PD movements interact.
//       - Vera (Internal audit engineer, engineering) — recon assertion
//         carrier (planned: `recon:sicr-threshold-currency`,
//         `recon:materiality-threshold-currency`).
//       - Atlas (substrate) — substrate monitoring.
//
// Authority:
//   - FIN-ACCT-01 v1.3 §3.2.2 (SICR), §3.5.2 (Materiality).
//   - brief:bea:register-sicrthresholdapproved-materialitybenchm:2026-05-21.
//   - 2026-05-21_bea_ifrs-thresholds-peer-review.md.
//   - D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18) — parent.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import {
  materialityBenchmarkApprovedPayloadSchema,
  sicrThresholdApprovedPayloadSchema,
} from "../event-types/ifrs-policy-thresholds";
import { RETENTION_ACCOUNTING_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

export const IFRS_POLICY_THRESHOLDS_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "SicrThresholdApproved",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["Camille", "Helena", "Bea", "Rohan", "Vera", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: sicrThresholdApprovedPayloadSchema,
    citationsHint: [
      "FIN-ACCT-01-v1.3-§3.2.2",
      "IFRS-9-§5.5.9",
      "IFRS-9-§5.5.10",
      "IFRS-9-§5.5.11",
      "IFRS-9-IG-B5.5.1",
      "IFRS-9-IG-B5.5.6",
      "D-TRADE-LIFECYCLE-IFRS-CHAIN",
      "brief:bea:register-sicrthresholdapproved-materialitybenchm:2026-05-21",
      "P1-EVENTS-AS-TRUTH",
    ],
    source: "platform/event-store/event-types/ifrs-policy-thresholds.ts",
    v2Status: "v1-only",
  },
  {
    type: "MaterialityBenchmarkApproved",
    class: "governance",
    issuer: "any-agent",
    subscribers: ["Camille", "Bea", "Vera", "Atlas"],
    replay: "latest-wins-per-key",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: materialityBenchmarkApprovedPayloadSchema,
    citationsHint: [
      "FIN-ACCT-01-v1.3-§3.5.2",
      "IAS-1-§7",
      "IAS-1-§29",
      "IAS-1-§31",
      "IFRS-PRACTICE-STATEMENT-2",
      "ISA-320",
      "D-TRADE-LIFECYCLE-IFRS-CHAIN",
      "brief:bea:register-sicrthresholdapproved-materialitybenchm:2026-05-21",
      "P1-EVENTS-AS-TRUTH",
    ],
    source: "platform/event-store/event-types/ifrs-policy-thresholds.ts",
    v2Status: "v1-only",
  },
];
