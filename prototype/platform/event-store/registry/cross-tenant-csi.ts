// platform/event-store/registry/cross-tenant-csi.ts
//
// Registry rows (F-032) for the V2 S12 cross-tenant CSI gate event family:
//   CsiCategoryRegistered        — a CSI category enters the blocklist
//   CsiCategoryRetired           — a CSI category is retired from the blocklist
//   CrossTenantLearningScreened  — a learning flow was screened (cleared / within-tenant)
//   CrossTenantLearningBlocked   — a cross-tenant flow was BLOCKED by the gate
//
// The CSI blocklist register is a projection over the Registered/Retired events
// (`v2-core/cross-tenant/projection.ts`); the gate-outcome events are the
// structured-first surfacing of every screening decision. LATEST state per
// categoryId wins for the blocklist (P1); gate-outcomes are append-only audit.
//
// Retention: governance-7y — the CSI blocklist and every cross-tenant crossing
// are competition-law records (Competition Act 89/1998 s.4(1)); the complete
// crossing history must be producible to the Competition Commission on demand
// (Owen W7 note §5.1). Schemas are imported FROM the v2 package (v1→v2).
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE;
// D-V2-BBAAS-BLUEPRINT-SYNTHESIS. F-032 (event-type registration).
// Author: Atlas (Substrate Architect, engineering).

import type { z } from "zod";
import {
  crossTenantLearningBlockedPayloadSchema,
  crossTenantLearningScreenedPayloadSchema,
  csiCategoryRegisteredPayloadSchema,
  csiCategoryRetiredPayloadSchema,
} from "../event-types/cross-tenant-csi";
import { type EventTypeMetadata, RETENTION_GOVERNANCE_7Y } from "./types";

const CITATIONS = [
  "D-W7-VENDOR-ENTITY-STRUCTURE",
  "D-V2-TENANCY-ARCHITECTURE",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

const SOURCE =
  "brief:atlas:v2-s12-cross-tenant-learning-gate-csi-blocklist-:2026-06-13";

export const CROSS_TENANT_CSI_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "CsiCategoryRegistered",
    class: "governance",
    issuer: "Zara",
    subscribers: ["Zara", "Vera", "Atlas", "Owen", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: csiCategoryRegisteredPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: SOURCE,
  },
  {
    type: "CsiCategoryRetired",
    class: "governance",
    issuer: "Zara",
    subscribers: ["Zara", "Vera", "Atlas", "Owen", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: csiCategoryRetiredPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: SOURCE,
  },
  {
    type: "CrossTenantLearningScreened",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Zara", "Vera", "Atlas", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: crossTenantLearningScreenedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: SOURCE,
  },
  {
    type: "CrossTenantLearningBlocked",
    class: "governance",
    issuer: "Atlas",
    subscribers: ["Zara", "Vera", "Atlas", "Owen", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: crossTenantLearningBlockedPayloadSchema as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: SOURCE,
  },
];
