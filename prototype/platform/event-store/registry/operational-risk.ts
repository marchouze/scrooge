// platform/event-store/registry/operational-risk.ts
//
// Operational-risk loss-event registry rows (F-032: every typed event MUST be
// registered).
//
// Covers:
//   OperationalLossEvent — capture of an internal operational loss (event date,
//     gross loss minor + currency, Basel business line, BCBS loss-event-type
//     category, recovery, status). Capture substrate ONLY — the op-RWA capital
//     computation (BIA/TSA/LDA) stays gross-income-blocked (revenue-start,
//     Camille CFO; platform/reporting/ba-400-op-risk.ts).
//
// Retention classification:
//   - OperationalLossEvent → RETENTION_GOVERNANCE_7Y. Internal loss data is a
//     risk-governance record retained for the loss-data history that future
//     loss-distribution approaches require (Banks Act 94 of 1990; Reg 33).
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; Basel II Annex 9 / BCBS D196 §644;
//   Reg 33 (operational risk).
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import {
  operationalLossEventPayloadSchema,
  operationalLossEventV2PayloadSchema,
} from "../event-types/operational-risk";
import { RETENTION_GOVERNANCE_7Y } from "./types";
import type { EventTypeMetadata } from "./types";

/**
 * Operational-risk loss-event registry rows.
 *
 * Subscribers:
 *   Tomas (Operations & payments engineer, engineering) — primary author / capture.
 *   Devon (Chief Operating Officer, governance) — op-risk seat owner.
 *   Helena (Chief Risk Officer, governance) — op-risk methodology / loss-data oversight.
 *   Bea (Accounting & financial reporting engineer, engineering) — BA 400 / capital linkage.
 *   Atlas (Core banking platform architect, engineering) — substrate monitoring.
 */
export const OPERATIONAL_RISK_EVENT_TYPES_REGISTRY: readonly EventTypeMetadata[] = [
  {
    type: "OperationalLossEvent",
    class: "governance",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: operationalLossEventPayloadSchema,
    citationsHint: ["D-FX-HELD-DIMS-SEAT-SWEEP", "BCBS-D196-§644", "REG-33"],
    source:
      "platform/event-store/event-types/operational-risk.ts (decode/replay only); platform/markets/products/oprisk-attestation-gates.ts now captures OperationalLossEventV2 (V2 sole live path)",
    // FLIP (WS-V2-MIGRATION-BUCKET-A batch A3, the FINAL batch — closes bucket A)
    // — v1-only → v2-replaced, RETIRED-BY-CONSTRUCTION. Basis:
    // D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16); D-BANK-WIDE-V2-MIGRATION.
    // All four conditions hold and are recorded (asserted by
    // recon:operational-loss-v2-parity):
    //   (1) V1 UN-EMITTABLE: operationalLossEventPayloadSchema requires the
    //       numeric `grossLossMinor` / `recoveryMinor` fields (z.number().int()).
    //       Any emission trips recon:no-residual-minor-encoding (no allowlist) →
    //       un-emittable on main. The live capture/probe path
    //       (oprisk-attestation-gates.ts) is re-pointed to OperationalLossEventV2;
    //       makeOperationalLossEvent is retained for decode/replay only.
    //   (2) V2 SOLE EMITTABLE PATH PRODUCES: oprisk-attestation-gates.ts captures
    //       OperationalLossEventV2 (decimal-native MoneyWire). The op-loss data
    //       set is legitimately empty in the build phase (capture-only; no real
    //       loss history) — PASS-on-empty, exactly like recon:rwa-computed-v2-parity.
    //       The positive-figure proof is the engine/probe UNIT TEST
    //       (operational-risk.test.ts), NOT a seeded forbidden `*Minor` event.
    //   (3) V2 HAS OWN TESTS: operational-risk.test.ts (round-trip + decoded
    //       parity) + recon:operational-loss-v2-parity (decoded-decimal parity,
    //       not byte — precedent recon:rwa-computed-v2-parity).
    //   (4) HISTORICAL V1 REPLAY-READABLE: operationalLossEventPayloadSchema +
    //       decodeOperationalLossEvent remain registered; historical
    //       OperationalLossEvent events replay + decode unchanged.
    v2Status: "v2-replaced",
  },
  {
    // OperationalLossEventV2 — decimal-native successor (Bucket A batch A3). The
    // two `*Minor` integer money fields are lifted to MoneyWire (MAJOR-unit
    // decimal); the standalone `currency` field is folded inside each MoneyWire.
    // V2-parallel: emitted into the SAME authoritative V1 event store (NOT the v2
    // control-plane store — money-bearing types stay decimal-native in the
    // authoritative store; the control-plane mirror is the money-free
    // reference-data pattern).
    // Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
    //   D-V2-CORE-MONEY-DECIMAL-NATIVE; D-FX-HELD-DIMS-SEAT-SWEEP.
    type: "OperationalLossEventV2",
    class: "governance",
    issuer: "Tomas",
    subscribers: ["Tomas", "Devon", "Helena", "Bea", "Atlas"],
    replay: "append-only-audit",
    retention: RETENTION_GOVERNANCE_7Y,
    payloadSchema: operationalLossEventV2PayloadSchema,
    citationsHint: [
      "D-BANK-WIDE-V2-MIGRATION",
      "D-V1-REMOVAL-FLIP-BASIS-RBC",
      "D-V2-CORE-MONEY-DECIMAL-NATIVE",
      "BCBS-D196-§644",
      "REG-33",
    ],
    source: "platform/event-store/event-types/operational-risk.ts (makeOperationalLossEventV2)",
    v2Status: "v2-parallel",
  },
];
