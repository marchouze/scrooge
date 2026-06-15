// platform/event-store/registry/isda-odp.ts
//
// WS-ODP-ISDA-ANNEXURES — event-type registry rows for ISDA Master Agreement
// Schedule + CSA elections + non-IRS OTC confirmation events.
//
// Events registered:
//   IsdaScheduleElected   — ISDA MA Schedule elected terms (governing law,
//                           termination currency, cross-default, AET, calc agent)
//   IsdaCsaElected        — CSA elected terms (thresholds, MTA, IA, eligible
//                           collateral, valuation agent/time, haircuts)
//   IsdaCsaSuperseded     — audit-trail for CSA termination/replacement
//   FraTradeBooked        — Forward Rate Agreement booking
//   SwaptionTradeBooked   — Swaption (option on IRS) booking
//   BasisSwapTradeBooked  — Basis swap (float-float) booking
//   CrossCurrencySwapTradeBooked — Cross-currency swap booking
//
// Authority:
//   ORG-ODP-COND-005 (Derivatives Counterparty obligation)
//   urn:regulation:odp:cs-2-2018 — ODP Conduct Standard 2 of 2018 §§ 3, 7, 14
//   ISDA 2002 Master Agreement §§ 5–6
//   ISDA 1994/2016 VM/2018 IM CSA
//   ISDA 2006 Definitions (FRA, swaption)
//   ISDA 2000 Definitions (cross-currency swap)
//   BCBS d317 (SA-CCR §§ 5–7) — CSA + netting-set terms
//   Principle 1 (events-are-truth)
//   Principle 5 (multi-currency)
//
// Retention:
//   Legal documentation events (Schedule/CSA) → RETENTION_ACCOUNTING_7Y
//   (ISDA master agreements are financial contracts; Companies Act s.24 +
//    SARB CS 3/2018 §12 require 7-year retention of financial-contract records.)
//   Trade confirmation events → RETENTION_JSE_TRADE_7Y
//   (OTC derivatives documented under ISDA MA; retention mirrors JSE trade
//    retention per RETENTION_JSE_TRADE_7Y policy.)
//
// Author: Imani (General Counsel, legal)

import {
  isdaCsaElectedPayloadSchema,
  isdaCsaSupersededPayloadSchema,
  isdaScheduleElectedPayloadSchema,
} from "../event-types/isda-schedule-csa";
import {
  basisSwapTradeBookedPayloadSchema,
  crossCurrencySwapTradeBookedPayloadSchema,
  fraTradeBookedPayloadSchema,
  swaptionTradeBookedPayloadSchema,
} from "../event-types/otc-confirmations";
import { RETENTION_ACCOUNTING_7Y, RETENTION_JSE_TRADE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * ISDA Schedule + CSA election event-type registry rows.
 *
 * Primary consumers:
 *   Imani (General Counsel, legal) — clause library and contract register.
 *   Rohan (Market risk engineer, engineering) — SA-CCR CSA terms input.
 *   Helena (Chief Risk Officer, governance) — netting-set enforceability.
 *   Owen (Company Secretary, governance) — governance/compliance register.
 *   Atlas (Core banking platform architect, engineering) — substrate.
 */
export const ISDA_SCHEDULE_CSA_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "IsdaScheduleElected",
    class: "governance",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Helena", "Owen", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: isdaScheduleElectedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018", "ISDA-2002-MA"],
    source: "platform/event-store/event-types/isda-schedule-csa.ts",
    v2Status: "v1-only",
  },
  {
    type: "IsdaCsaElected",
    class: "governance",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Helena", "Owen", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: isdaCsaElectedPayloadSchema,
    citationsHint: [
      "ORG-ODP-COND-005",
      "urn:regulation:odp:cs-2-2018",
      "ISDA-CSA-1994-NY",
      "ISDA-CSA-2016-VM",
      "BCBS-D317",
    ],
    source: "platform/event-store/event-types/isda-schedule-csa.ts",
    v2Status: "v1-only",
  },
  {
    type: "IsdaCsaSuperseded",
    class: "governance",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Helena", "Owen", "Atlas"],
    replay: "idempotent-terminal",
    retention: RETENTION_ACCOUNTING_7Y,
    payloadSchema: isdaCsaSupersededPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018"],
    source: "platform/event-store/event-types/isda-schedule-csa.ts",
    v2Status: "v1-only",
  },
];

/**
 * Non-IRS OTC confirmation event-type registry rows.
 *
 * Primary consumers:
 *   Imani (General Counsel, legal) — confirmation and clause library.
 *   Rohan (Market risk engineer, engineering) — SA-CCR asset-class dispatch.
 *   Eitan (IRRBB / derivatives engineer, engineering) — IRD trade lifecycle.
 *   Helena (Chief Risk Officer, governance) — market risk coverage.
 *   Atlas (Core banking platform architect, engineering) — substrate.
 */
export const OTC_CONFIRMATIONS_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "FraTradeBooked",
    class: "markets",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Eitan", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: fraTradeBookedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018", "ISDA-2006-DEFINITIONS"],
    source: "platform/event-store/event-types/otc-confirmations.ts",
    v2Status: "v1-only",
  },
  {
    type: "SwaptionTradeBooked",
    class: "markets",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Eitan", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: swaptionTradeBookedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018", "ISDA-2006-DEFINITIONS"],
    source: "platform/event-store/event-types/otc-confirmations.ts",
    v2Status: "v1-only",
  },
  {
    type: "BasisSwapTradeBooked",
    class: "markets",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Eitan", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: basisSwapTradeBookedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018", "ISDA-2006-DEFINITIONS"],
    source: "platform/event-store/event-types/otc-confirmations.ts",
    v2Status: "v1-only",
  },
  {
    type: "CrossCurrencySwapTradeBooked",
    class: "markets",
    issuer: "Imani",
    subscribers: ["Imani", "Rohan", "Eitan", "Helena", "Atlas"],
    replay: "cumulative-fold",
    retention: RETENTION_JSE_TRADE_7Y,
    payloadSchema: crossCurrencySwapTradeBookedPayloadSchema,
    citationsHint: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018", "ISDA-2000-DEFINITIONS"],
    source: "platform/event-store/event-types/otc-confirmations.ts",
    v2Status: "v1-only",
  },
];
