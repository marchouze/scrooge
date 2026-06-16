// platform/event-store/registry/regulatory-reporting.ts
//
// Event-type registry rows for regulatory reporting events.
//
// Covers:
//   - TradeReportSubmitted — FinSurv cross-border FX trade report submission
//     (build-phase: stub emits "pending"; production: live API)
//   - SarbSubmissionAttempted — BA-return submission attempt to SARB prudential
//     portal (build-phase: local simulator; production: SARB BankServ portal)
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer; FinSurv reporting required)
//   - EXCON-SARB-CIRC-3-2020 (FX reporting obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//   - D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10)
//   - Banks Act 94/1990 §70 + §73; Regulations Relating to Banks Reg 26
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering),
//          Atlas (Core banking platform architect, engineering)

import {
  RwaComputedPayloadSchema,
  SarbSubmissionAttemptedPayloadSchema,
  TradeReportSubmittedPayloadSchema,
} from "../event-types/regulatory-reporting";
import { RwaComputedV2PayloadSchema } from "../event-types/regulatory-reporting-v2";
import { type EventTypeMetadata, RETENTION_ACCOUNTING_7Y, RETENTION_JSE_TRADE_7Y } from "./types";

export const REGULATORY_REPORTING_EVENT_TYPES: readonly EventTypeMetadata[] = [
  {
    type: "TradeReportSubmitted",
    class: "governance",
    payloadSchema: TradeReportSubmittedPayloadSchema,
    issuer: "Mira",
    subscribers: ["Mira", "Zara", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: ["D-FX-AD-STATUS", "EXCON-SARB-CIRC-3-2020", "ORG-EXCON-ODP-001"],
    // Regulatory submissions — 7-year retention per SARB inspection requirements.
    // Cross-reference: EXCON-SARB-CIRC-3-2020 reporting record obligations;
    // FSCA inspection / Banks Act s.91 audit requirements.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "platform/markets/regulatory/finsurv-stub.ts (build-phase); live FinSurv API (post-licence)",
    v2Status: "v2-replaced",
  },
  {
    // D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 — local SARB portal simulator.
    // Emitted by `simulators/sarb-prudential.ts` for every BA-return submission
    // attempt (BA 110 / LCR, BA 100 / Capital Adequacy, and future BA-forms).
    // Both successes and failures are recorded so the audit trail is complete
    // (Principle 1). Mode field disambiguates simulator from live submissions.
    // M8 migration: swaps the simulator implementation for a real HTTPS POST to
    // the SARB BankServ prudential portal; this registry row is unchanged.
    type: "SarbSubmissionAttempted",
    class: "governance",
    payloadSchema: SarbSubmissionAttemptedPayloadSchema,
    issuer: "Atlas",
    subscribers: ["Mira", "Bea", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "Banks Act 94 of 1990 §70",
      "Banks Act 94 of 1990 §73",
      "Regulations Relating to Banks Reg 26",
      "[citation: TBC — SARB portal submission procedure PROC-SARB-SUBMIT-01]",
    ],
    // Regulatory submissions — 7-year retention per SARB inspection requirements.
    // Banks Act §73 + §91 require 7-year record-keeping for regulatory returns.
    retention: RETENTION_JSE_TRADE_7Y,
    source:
      "simulators/sarb-prudential.ts (build-phase simulator); SARB BankServ portal (post-licence)",
    v2Status: "v2-replaced",
  },
  {
    // D-RWA-ENGINE-W2-SLICE-3 — Pillar-1 RWA decomposition emitted at period
    // close, feeding the BA 700 capital-adequacy denominator. Credit + market
    // RWA are event-sourced (CRE20 over readDebtExposures; 12.5 × BA 320
    // market-risk capital incl. Reg 28(3)(a) disallowances); operational RWA is
    // an explicit gross-income-blocked placeholder until licence-day. The
    // `source` field makes the partial-real composition legible.
    type: "RwaComputed",
    class: "governance",
    payloadSchema: RwaComputedPayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-RWA-ENGINE-W2-SLICE-3",
      "D-REGULATORY-READINESS-W2-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 23",
      "Regulations Relating to Banks Reg 28",
      "BCBS Basel III/IV (CRE20, MAR)",
    ],
    // Capital-adequacy basis records — 7-year accounting retention per Banks
    // Act §73/§91 + IFRS audit-trail requirements.
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/risk/rwa-computed-engine.ts (decode-only, replay); runtime/agents/bea-rwa-period-close.ts now emits RwaComputedV2 (V2 sole live path)",
    // FLIP (WS-V2-MIGRATION-BUCKET-A PILOT) — v1-only → v2-replaced,
    // RETIRED-BY-CONSTRUCTION. Basis: D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved
    // 2026-06-16); D-BANK-WIDE-V2-MIGRATION. All four conditions hold and are
    // recorded (asserted on a clean store by recon:rwa-computed-v2-parity):
    //   (1) V1 UN-EMITTABLE: RwaComputedPayloadSchema requires the numeric
    //       `*RwaMinor` fields (creditRwaMinor / marketRwaMinor /
    //       operationalRwaMinor / totalRwaMinor — z.number().int()). Any
    //       emission trips recon:no-residual-minor-encoding (no allowlist) →
    //       un-emittable on main. The live emit path (bea-rwa-period-close.ts)
    //       is re-pointed to RwaComputedV2; makeRwaComputed is retained for
    //       decode/replay only.
    //   (2) V2 SOLE EMITTABLE PATH PRODUCES: bea-rwa-period-close.ts emits
    //       RwaComputedV2 (decimal-native MoneyWire). Verified NON-VACUOUS:
    //       seed:rwa-computed-v2 runs the re-pointed period-close emitter on the
    //       ci:migrate seeded store and produces ≥1 RwaComputedV2 with a decoded
    //       total RWA > 0; recon:rwa-computed-v2-parity asserts the decoded
    //       figure is present and that V1==V2 on decoded decimal value.
    //   (3) V2 HAS OWN TESTS: rwa-computed-engine-v2.test.ts (engine unit) +
    //       recon:rwa-computed-v2-parity (decoded-decimal parity, not byte —
    //       precedent recon:fx-v2-parity, because minor-int vs decimal-string
    //       byte-compare is meaningless across a unit change).
    //   (4) HISTORICAL V1 REPLAY-READABLE: RwaComputedPayloadSchema +
    //       decodeRwaComputed remain registered; historical RwaComputed events
    //       replay + decode unchanged.
    v2Status: "v2-replaced",
  },
  {
    // RwaComputedV2 — decimal-native successor (Bucket A PILOT). The four
    // `*RwaMinor` integer fields are lifted to MoneyWire (MAJOR-unit decimal).
    // V2-parallel: emitted into the SAME authoritative V1 event store by the
    // re-pointed period-close emitter (NOT mirrored into the v2 control-plane
    // store — money-bearing types stay decimal-native in the authoritative
    // store; the control-plane mirror is the money-free reference-data pattern).
    // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
    //   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-RWA-ENGINE-W2-SLICE-3.
    type: "RwaComputedV2",
    class: "governance",
    payloadSchema: RwaComputedV2PayloadSchema,
    issuer: "Bea",
    subscribers: ["Bea", "Camille", "Mira", "Vera", "dashboard"],
    replay: "append-only-audit",
    citationsHint: [
      "D-BANK-WIDE-V2-MIGRATION",
      "D-V1-REMOVAL-FLIP-BASIS-RBC",
      "D-V2-CORE-MONEY-DECIMAL-NATIVE",
      "D-RWA-ENGINE-W2-SLICE-3",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 23",
      "Regulations Relating to Banks Reg 28",
      "BCBS Basel III/IV (CRE20, MAR)",
    ],
    // Capital-adequacy basis records — 7-year accounting retention per Banks
    // Act §73/§91 + IFRS audit-trail requirements.
    retention: RETENTION_ACCOUNTING_7Y,
    source:
      "platform/risk/rwa-computed-engine-v2.ts (emitRwaComputedV2); runtime/agents/bea-rwa-period-close.ts (period-close emitter)",
    v2Status: "v2-parallel",
  },
];
