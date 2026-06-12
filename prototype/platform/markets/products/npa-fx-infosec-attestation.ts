// platform/markets/products/npa-fx-infosec-attestation.ts
//
// FX OTC umbrella NPA — infosec dimension: CISO threat-model ratification +
// attestation.
//
// The per-dimension verification pass v2 (#1213) correctly HELD infosec
// design-attested: the trading-stack threat model was registered (four
// `ThreatModelDimensionRegistered` dimensions + one `SecurityGateRegistered`
// M2 gate, emitted by `senna-m1-trading-stack-threat-model` on 2026-05-08)
// but its ratification is a CISO seat-owned decision (decision-authority
// routing table) that had never been taken as an event-of-record.
//
// This module takes that seat decision. Two functions, both idempotent and
// both fail-closed:
//
//   1. `runFxThreatModelRatification` — Rashida (Chief Information Security
//      Officer, governance) ratifies the registered trading-stack threat
//      model APPROVED-WITH-CONDITIONS as a `ThreatModelGateDecision` event
//      (existing registered type — registry/missing-types.ts, issuer Rashida;
//      no new event type needed). The emit is REFUSED unless all four
//      registered dimensions AND the M2 gate are present in the store the
//      decision is being recorded against — a ratification of an absent
//      model would be a rubber stamp.
//
//   2. `runFxInfosecAttestation` — promotes the infosec dimension of
//      `prd:bank:fx:otc-vanilla` to implementation-attested ONLY if the
//      ratification event-of-record stands (approved or
//      approved-with-conditions) in the same store. Every accepted-open item
//      from the ratification conditions is carried as a tracked
//      `ProductDeferredGap` (owner + trigger + citations enforced at
//      write-time; recon:npa-deferred-gap-tracking inventories them) — never
//      hidden.
//
// CISO ratification basis (reviewed at code level against the canonical
// store and today's gateway, 2026-06-12):
//
//   - The four registered dimensions still cover the right surfaces. The
//     order path TODAY is the synchronous pre-trade gateway
//     (dashboard/markets-fx-gateway.ts): 7 sequential checks of which SIX
//     enforce — sanctions fail-on-hit (screenCounterpartySanctions),
//     suitability fail-closed on unclassified + retail-reject (FAIS §8D),
//     counterparty-eligibility, credit-limit FAIL-CLOSED (checkHeadroom,
//     D-FX-GATEWAY-CREDIT-LIMIT-FAIL-CLOSED), capital-impact + funding
//     fail-closed against the CRO-ratified threshold schedule
//     (D-FX-GATEWAY-CAPITAL-FUNDING-THRESHOLDS). The event-append substrate
//     is permission-gated by default (T-01,
//     D-T-01-PERMISSION-GATE-SECURE-DEFAULT) and the store is append-only
//     with as-of replay (Principle 1 tamper evidence).
//   - CONDITION 1 — the gateway `identity` check is the sole remaining
//     approve-always stub; it must enforce (fail-closed workload /
//     counterparty identity) before the FIX-gateway perimeter dimension's
//     ingress controls can be considered live on the order path.
//   - CONDITION 2 — the gateway-zero-trust dimension models an async
//     aggregator + check fan-out with per-check workload identity and
//     capability tokens; the LIVE path is a synchronous in-process pipeline
//     where one gateway actor runs all checks as function calls. The
//     enforcement VALUES hold but the zero-trust separation control is
//     structurally different from what was modelled. The threat model must
//     be refreshed against the as-built synchronous gateway at the next
//     quarterly threat-model gate (ThreatModelGateCompleted cadence).
//   - CONDITION 3 — HSM key custody (FIPS 140-2/3 L3) remains unprovisioned
//     (Senna spec §16); placeholder keys are wire-compatible. Accepted with
//     tracking to the licence-day / Azure cloud-lift (SARB PA Directive
//     3 of 2018, ORG-CY-06).
//   - CONDITION 4 — runtime detection (SIEM/EDR/XDR) + SOAR are posture
//     only; live detection lights up pre-licence (ORG-CY-05 / ORG-CY-08).
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; PA/FSCA Joint Standard 2 of 2024
//   (ORG-CY-01/03/05); CLAUDE.md Principle 4 (security designed in).
// Author: Rashida (Chief Information Security Officer, governance).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { makeThreatModelGateDecision } from "../../event-store/event-types/security-devops-extended";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";

export const INFOSEC_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the conduct promotion (2026-06-11T20:00) and the pass-2 holds
// (2026-06-11T18:00) so latest-wins folds pick these up.
export const INFOSEC_AS_OF = "2026-06-12T08:00:00.000Z";

const INFOSEC_ACTOR = {
  type: "service" as const,
  id: "agent:rashida:npa-infosec-attestation",
};

/** The ratification decision id — idempotency key for the seat decision. */
export const RATIFICATION_DECISION_ID = "TMGD-RASHIDA-TRADING-STACK-M1-2026-06-12";

/** The M2 security gate the ratification discharges. */
export const RATIFIED_GATE_ID = "gate:senna:m1-trading-stack-threat-model:m2-precondition";

/** The four registered dimensions the ratification covers (gatedDimensionIds). */
export const RATIFIED_DIMENSION_IDS = [
  "tm:senna:trading-stack:fix-gateway-stride",
  "tm:senna:trading-stack:gateway-zero-trust",
  "tm:senna:trading-stack:hsm-order-signing",
  "tm:senna:trading-stack:oms-ems-ops-security",
] as const;

/** The CISO's named conditions — one line each, carried on the decision. */
export const RATIFICATION_CONDITIONS = [
  "(1) gateway `identity` check must enforce fail-closed (sole remaining approve-always stub on the order path);",
  "(2) threat model refreshed against the AS-BUILT synchronous in-process gateway at the next quarterly threat-model gate — the registered zero-trust dimension models an async fan-out with per-check workload identity that is not the live architecture;",
  "(3) HSM key custody accepted-open to licence-day / Azure cloud-lift (placeholder keys wire-compatible; SARB PA Directive 3 of 2018, ORG-CY-06);",
  "(4) runtime detection pipeline (SIEM/EDR/XDR + SOAR) accepted-open to the pre-licence detection substrate (ORG-CY-05 / ORG-CY-08).",
].join(" ");

const RATIFICATION_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
  "ORG-CY-01",
  "ORG-CY-03",
  "ORG-CY-05",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

const ATTESTATION_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const INFOSEC_CITATION_CHAIN: readonly string[] = [
  ...ATTESTATION_CITATIONS,
  "ORG-CY-01",
  "ORG-CY-03",
  "ORG-CY-05",
  "ORG-CY-09",
  "ORG-CY-12",
  "ORG-PR(IV)-06",
  "dashboard/markets-fx-gateway.ts",
  "platform/event-store/permission-gate.ts",
  "platform/markets/regulatory/sanctions-screen.ts",
  "platform/risk/credit-limit-engine/pre-deal-check.ts",
  "platform/risk/fx-gateway-thresholds.ts",
  "runtime/agents/senna-m1-trading-stack-threat-model.ts",
];

/**
 * Accepted-open items from the ratification conditions, tracked as deferred
 * gaps on the infosec attestation. Every field mandatory (write-time schema);
 * recon:npa-deferred-gap-tracking inventories them.
 */
export const INFOSEC_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-gateway-identity-check-enforcement",
    title:
      "Gateway `identity` check is the sole remaining approve-always stub on the synchronous order path; it must verify workload / counterparty identity fail-closed (ratification condition 1).",
    owner: "Kai (Trading systems engineer, engineering)",
    targetTrigger:
      "gateway identity slice enforces fail-closed identity verification on the order path",
    citations: ["tm:senna:trading-stack:gateway-zero-trust", "ORG-CY-03"],
  },
  {
    gapId: "fx-threat-model-sync-gateway-refresh",
    title:
      "Registered zero-trust dimension models an async aggregator + check fan-out (per-check workload identity, capability tokens); the live path is a synchronous in-process pipeline. Refresh the threat model against the as-built gateway (ratification condition 2).",
    owner: "Senna (Security engineer, engineering)",
    targetTrigger:
      "next quarterly threat-model gate (ThreatModelGateCompleted cadence, PROC-CISO-THREAT-GATE-01)",
    citations: ["tm:senna:trading-stack:gateway-zero-trust", "ORG-CY-01", "ORG-CY-03"],
  },
  {
    gapId: "fx-hsm-key-custody",
    title:
      "HSM substrate (FIPS 140-2/3 Level 3 key custody for order-signing / trade-confirmation paths) is not provisioned; build phase uses wire-compatible placeholder keys (ratification condition 3).",
    owner: "Atlas (Core banking platform architect, engineering)",
    targetTrigger: "licence-day / Azure cloud-lift provisions the managed cloud HSM",
    citations: ["tm:senna:trading-stack:hsm-order-signing", "ORG-CY-06"],
  },
  {
    gapId: "fx-runtime-detection-pipeline",
    title:
      "Runtime detection (SIEM/EDR/XDR) and SOAR orchestration on the trading stack are registered posture only; live detection + rehearsed response light up pre-licence (ratification condition 4).",
    owner: "Senna (Security engineer, engineering)",
    targetTrigger: "pre-licence detection-pipeline substrate lands (Senna spec §16)",
    citations: ["tm:senna:trading-stack:oms-ems-ops-security", "ORG-CY-05", "ORG-CY-08"],
  },
];

export interface RatificationResult {
  readonly ratified: boolean;
  readonly skipped: boolean;
  /** Registered dimension ids found in the store at decision time. */
  readonly dimensionsFound: readonly string[];
  /** Dimension ids the ratification requires but the store lacks. */
  readonly missingDimensionIds: readonly string[];
  readonly gatePresent: boolean;
  readonly blockedReason?: string;
}

/**
 * Emit the CISO ratification of the M1 trading-stack threat model as a
 * `ThreatModelGateDecision` event-of-record (outcome:
 * approved-with-conditions). Fail-closed: refuses to emit unless every
 * registered dimension AND the M2 gate are present in the store. Idempotent
 * on RATIFICATION_DECISION_ID.
 */
export function runFxThreatModelRatification(store: EventStore): RatificationResult {
  // Idempotency: a decision with this id already stands.
  for (const ev of store.replay({ type: "ThreatModelGateDecision" })) {
    const p = ev.payload as { decisionId?: string };
    if (p.decisionId === RATIFICATION_DECISION_ID) {
      return {
        ratified: false,
        skipped: true,
        dimensionsFound: [...RATIFIED_DIMENSION_IDS],
        missingDimensionIds: [],
        gatePresent: true,
      };
    }
  }

  // Ground the decision: the model being ratified must exist in this store.
  const found = new Set<string>();
  for (const ev of store.replay({ type: "ThreatModelDimensionRegistered" })) {
    const p = ev.payload as { dimensionId?: string };
    if (typeof p.dimensionId === "string") found.add(p.dimensionId);
  }
  const missing = RATIFIED_DIMENSION_IDS.filter((d) => !found.has(d));

  let gatePresent = false;
  for (const ev of store.replay({ type: "SecurityGateRegistered" })) {
    const p = ev.payload as { gateId?: string };
    if (p.gateId === RATIFIED_GATE_ID) {
      gatePresent = true;
      break;
    }
  }

  if (missing.length > 0 || !gatePresent) {
    return {
      ratified: false,
      skipped: false,
      dimensionsFound: [...found].filter((d) =>
        (RATIFIED_DIMENSION_IDS as readonly string[]).includes(d),
      ),
      missingDimensionIds: missing,
      gatePresent,
      blockedReason: [
        "ratification refused — registered threat model incomplete in this store",
        `(missing dimensions: ${missing.length === 0 ? "none" : missing.join(", ")};`,
        `gate present: ${gatePresent}). A ratification of an absent model is a rubber stamp.`,
      ].join(" "),
    };
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `ciso-threat-model-ratification:${RATIFICATION_DECISION_ID}`,
    tags: ["ciso-governance", "threat-model-ratification", INFOSEC_PRODUCT_ID],
  });

  store.append({
    ...makeThreatModelGateDecision({
      asOf: INFOSEC_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: INFOSEC_ACTOR,
      citations: [...RATIFICATION_CITATIONS],
      payload: {
        decisionId: RATIFICATION_DECISION_ID,
        threatModelRef: RATIFIED_GATE_ID,
        decidedBy: "Rashida (Chief Information Security Officer, governance)",
        decidedAt: INFOSEC_AS_OF,
        outcome: "approved-with-conditions",
        conditions: RATIFICATION_CONDITIONS,
      },
    }),
    provenance,
  });

  return {
    ratified: true,
    skipped: false,
    dimensionsFound: [...RATIFIED_DIMENSION_IDS],
    missingDimensionIds: [],
    gatePresent: true,
  };
}

export interface InfosecAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
  readonly blockedReason?: string;
}

/**
 * Promote the infosec dimension of prd:bank:fx:otc-vanilla to
 * implementation-attested with the tracked deferred gaps. Fail-closed: the
 * ratification event-of-record (approved / approved-with-conditions for
 * RATIFIED_GATE_ID) must stand in the same store, else the dimension HOLDS
 * design-attested and nothing is emitted. Idempotent: skips if an infosec
 * implementation-attested event at or after INFOSEC_AS_OF already exists.
 */
export function runFxInfosecAttestation(store: EventStore): InfosecAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === INFOSEC_PRODUCT_ID &&
      p.dimension === "infosec" &&
      p.result === "implementation-attested" &&
      ev.as_of >= INFOSEC_AS_OF
    ) {
      return { promoted: false, skipped: true };
    }
  }

  // GATE: the CISO ratification must stand in this store.
  let ratificationStands = false;
  for (const ev of store.replay({ type: "ThreatModelGateDecision" })) {
    const p = ev.payload as { threatModelRef?: string; outcome?: string };
    if (
      p.threatModelRef === RATIFIED_GATE_ID &&
      (p.outcome === "approved" || p.outcome === "approved-with-conditions")
    ) {
      ratificationStands = true;
      break;
    }
  }
  if (!ratificationStands) {
    return {
      promoted: false,
      skipped: false,
      blockedReason: [
        "infosec promotion refused — no standing CISO ratification",
        `(ThreatModelGateDecision approved/approved-with-conditions for ${RATIFIED_GATE_ID})`,
        "in this store. The dimension HOLDS design-attested (over-attestation is the failure mode).",
      ].join(" "),
    };
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${INFOSEC_PRODUCT_ID}:infosec:ciso-ratification`,
    tags: ["npa-gate", "dimension-upgrade", "infosec", INFOSEC_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: INFOSEC_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: INFOSEC_ACTOR,
      citations: [...ATTESTATION_CITATIONS, "dimension:infosec"],
      payload: {
        productId: INFOSEC_PRODUCT_ID,
        dimension: "infosec",
        result: "implementation-attested",
        citationChain: [...INFOSEC_CITATION_CHAIN],
        deferredGaps: INFOSEC_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false };
}
