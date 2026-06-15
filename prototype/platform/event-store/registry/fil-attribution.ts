// platform/event-store/registry/fil-attribution.ts
//
// Registry rows for the FIL attribution event family (WS-V2-BBAAS, A1 kernel —
// dimensional metric-attribution layer). SITE 2 of the three-site registration.
//
//   InstrumentDimensionAssigned — organisational-dimension assignment (append-only
//     audit: a re-book is a NEW event with its own effectiveFrom; the membership
//     projection folds latest-covering-event-wins).
//   SliceDefined — a named/persistent slice as a stored predicate
//     (latest-wins-per-key on sliceId: a slice may be redefined).
//
// The attribution membership + slice registers are projections over these events
// (v2-core/fil-attribution/membership.ts). These are real anchor-book records
// (class `governance`, production); the registry rows live v1-side because F-032
// requires registration in `platform/event-store/registry/` and the v2-core
// package must not import v1 code.
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL;
//   D-V2-BBAAS-BLUEPRINT-SYNTHESIS. F-032 (event-type registration).
// Author: Atlas (Core banking platform architect, engineering).

import type { z } from "zod";
import {
  instrumentDimensionAssignedPayload,
  orgHierarchyEdgeAssignedPayload,
  sliceDefinedPayload,
} from "../event-types/fil-attribution";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-FIL-ATTRIBUTION-A1-BUILD",
  "D-METRIC-ATTRIBUTION-DIMENSIONAL",
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
] as const;

const SUBSCRIBERS = ["Atlas", "Rohan", "Bea", "Helena", "Vera", "Scrooge"] as const;

export const FIL_ATTRIBUTION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "InstrumentDimensionAssigned",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    // A re-book is a new event; the projection folds latest-covering-event-wins
    // over effectiveFrom — the event stream itself is append-only audit.
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: instrumentDimensionAssignedPayload as unknown as z.ZodType<
      Record<string, unknown>
    >,
    citationsHint: CITATIONS,
    source: "v2-core/fil-attribution/events.ts — InstrumentDimensionAssigned",
    v2Status: "v2-parallel",
  },
  {
    type: "SliceDefined",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    // A named slice may be redefined; the slice register takes latest-wins per
    // sliceId.
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: sliceDefinedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "v2-core/fil-attribution/events.ts — SliceDefined",
    v2Status: "v2-parallel",
  },
  {
    type: "OrgHierarchyEdgeAssigned",
    class: "governance",
    issuer: "Atlas",
    subscribers: [...SUBSCRIBERS],
    // A re-parent (desk move / LE re-parent) is a new edge with its own
    // effectiveFrom; the org-hierarchy projection folds latest-covering-edge-
    // wins — the event stream itself is append-only audit.
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: orgHierarchyEdgeAssignedPayload as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: CITATIONS,
    source: "v2-core/fil-attribution/events.ts — OrgHierarchyEdgeAssigned",
    v2Status: "v1-only",
  },
];
