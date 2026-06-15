// platform/event-store/registry/v2-banking.ts
//
// V1-side F-032 registry rows for the V2 S4 banking standing-data events:
//   V2ProductRegistered     — product enters the anchor-bank catalogue
//   V2ProductDeprecated     — product retired
//   V2AccountTypeRegistered — CoA account type enters the chart
//   V2RiskAppetiteSet       — RAS appetite line recorded as v2 event
//
// These events are emitted ONLY into the v2 anchor store (`BANK_V2_ANCHOR_DB`
// → `$HOME/.local/share/bank/v2-anchor.db`). They NEVER touch the v1
// canonical store (`BANK_EVENT_DB`). The registry rows are on the v1 side
// because F-032 requires registration in `platform/event-store/registry/`
// and this package must not import v1 code (the hard boundary from S0).
//
// Issuer: Bea (Financial Controller, accounting) running the
//   `seed-v2-anchor-bank-standing-data.ts` script.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// brief: brief:bea:v2-s4-products-coa-ras-as-typed-v2-events-anchor:2026-06-12
// Author: Bea (Financial Controller, accounting).

import type { z } from "zod";
import {
  v2AccountTypeRegisteredSchema,
  v2ProductDeprecatedSchema,
  v2ProductRegisteredSchema,
  v2RiskAppetiteSetSchema,
} from "../../../v2-core/banking/events";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

const CITATIONS = [
  "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
  "D-MODEL-BINDING-CONTRACT-V1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
  "P5-MULTI-CURRENCY-ENTITY-COUNTRY",
] as const;

export const V2_BANKING_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "V2ProductRegistered",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Atlas", "Saskia", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: v2ProductRegisteredSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: [...CITATIONS],
    source: "v2-core/banking/events.ts — V2ProductRegistered",
    v2Status: "v1-only",
  },
  {
    type: "V2ProductDeprecated",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Atlas", "Saskia", "Vera", "Scrooge"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: v2ProductDeprecatedSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: [...CITATIONS],
    source: "v2-core/banking/events.ts — V2ProductDeprecated",
    v2Status: "v1-only",
  },
  {
    type: "V2AccountTypeRegistered",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Atlas", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: v2AccountTypeRegisteredSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: [...CITATIONS],
    source: "v2-core/banking/events.ts — V2AccountTypeRegistered",
    v2Status: "v1-only",
  },
  {
    type: "V2RiskAppetiteSet",
    class: "governance",
    issuer: "Bea",
    subscribers: ["Bea", "Atlas", "Helena", "Vera", "Scrooge"],
    replay: "latest-wins-per-key",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: v2RiskAppetiteSetSchema as unknown as z.ZodType<Record<string, unknown>>,
    citationsHint: [...CITATIONS],
    source: "v2-core/banking/events.ts — V2RiskAppetiteSet",
    v2Status: "v1-only",
  },
];
