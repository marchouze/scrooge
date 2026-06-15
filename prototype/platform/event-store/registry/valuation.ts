// platform/event-store/registry/valuation.ts
//
// Valuation-engine event-type registry rows.
//
// Covers:
//   OfficialMarkAdopted — the deliberate act by which the valuation engine
//     commits to one tick (price / fx-rate / curve-point / vol-point) as
//     the official mark for an instrument at a timestamp, under a named
//     valuation policy version. Distinct from raw market-data ticks (which
//     live in MarketDataStore as reference data). See
//     `platform/event-store/event-types/valuation.ts` for the schema.
//
// Retention classification:
//   RETENTION_JSE_TRADE_7Y — official marks are the load-bearing inputs to
//     daily P&L, IFRS-9 expected-credit-loss, and IFRS-13 fair-value
//     hierarchy disclosures (BA 100). Banks Act 94 of 1990 §7-year
//     retention norm for trading records applies.
//
// Issuer / authority routing:
//   - Issuer: Rohan (Market risk engineer, engineering) — the valuation
//     engine and adoption logic are Rohan's mandate.
//   - Subscribers:
//       Rohan — primary author / IPV pass consumer.
//       Helena (Chief Risk Officer, governance) — valuation policy authority,
//         RAS market-risk monitoring.
//       Bea (Accounting & financial reporting engineer, engineering) — P&L
//         chain; OfficialMarkAdopted feeds *PositionRevalued downstream
//         (until Slice D's reclassification).
//       Mira (Regulatory reporting engineer, engineering) — BA 100 fair-value
//         hierarchy disclosure inputs.
//       Vera (Internal audit engineer, engineering) — recon assertion
//         carrier (`recon:position-revalued-cites-mark` in Slice B.1).
//       Atlas (Core banking platform architect, engineering) — substrate
//         monitoring.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; PR #620 records the decision).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//   - Policies/valuation-policy-v1.md (Helena, 2026-05-19).
//   - IFRS-13 (fair-value hierarchy).
//
// Author: Atlas (Core banking platform architect, engineering).

import { officialMarkAdoptedPayloadSchema } from "../event-types/valuation";
import { RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

export const VALUATION_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "OfficialMarkAdopted",
    class: "markets",
    issuer: "Rohan",
    subscribers: ["Rohan", "Helena", "Bea", "Mira", "Vera", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: officialMarkAdoptedPayloadSchema,
    citationsHint: [
      "D-EVENT-VIEW-BOUNDARY-WIRE",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "Policies/valuation-policy-v1.md",
      "IFRS-13",
    ],
    source: "platform/event-store/event-types/valuation.ts",
    v2Status: "v1-only",
  },
];
