// platform/markets/products/npa-fx-oprisk-attestation.ts
//
// FX OTC umbrella NPA — operational-risk dimension attestation (Tomas
// verification; governance owner Devon, Chief Operating Officer, governance).
//
// The per-dimension verification pass v2 (#1213) correctly HELD operational-
// risk design-attested: "no loss-distribution/BIC engine; identity check stub."
// Exploration grounded this:
//   - op-RWA itself is GENUINELY gross-income-blocked — BIA/TSA needs three
//     years of audited gross income (platform/reporting/ba-400-op-risk.ts;
//     revenue-start, Camille CFO). That stays a tracked deferred gap; a hollow
//     gross-income fixture would be a fabrication.
//   - But two things ARE buildable now, and this pass builds both:
//       1. operational loss-event CAPTURE — the OperationalLossEvent type
//          (registered, F-032) + a projection (open/closed by business line +
//          BCBS event-type category). This is the internal-loss data set every
//          bank must collect; it is a precondition for a future loss-
//          distribution approach, not a capital number.
//       2. the gateway `identity` check — previously approve-always, now
//          FAIL-CLOSED (platform/markets/identity/counterparty-identity-gate.ts):
//          a counterparty must be a KYC-accepted party of record
//          (CounterpartyEligibilityScreened party-of-record AND
//          SanctionsClearancePassed / ClientAccepted KYC acceptance) or the
//          order is REJECTED at position 1.
//
// Promotion to implementation-attested is gated in code (runFxOpRiskAttestation
// refuses unless BOTH the loss-capture substrate is present AND the identity
// check genuinely enforces in an isolated probe). Over-attestation is the
// failure mode: if either gate fails, the dimension HOLDS design-attested.
//
// The op-RWA capital block and the loss-distribution / LDA model are carried as
// tracked ProductDeferredGap entries (owner + trigger + citations enforced at
// write-time; recon:npa-deferred-gap-tracking inventories them) — never hidden.
//
// Authority: D-FX-HELD-DIMS-SEAT-SWEEP (CEO session-delegation 2026-06-11);
//   D-FX-NPA-VERIFICATION-PASS-2-DISPATCH; D-FX-OTC-NPA-SCOPE-EXPANSION;
//   D-NEW-PRODUCT-APPROVAL-POLICY §5; Basel II Annex 9 / BCBS D196 §644; Reg 33.
// Author: Tomas (Operations & payments engineer, engineering) — governance
//   owner Devon (Chief Operating Officer, governance; op-risk seat).

import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import { isOperationalLossEventRegistered, probeIdentityEnforcement } from "./oprisk-attestation-gates";

export const OPRISK_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the conduct/legal/infosec promotions (2026-06-12T08:00) so latest-
// wins folds pick up this promotion alongside them.
export const OPRISK_AS_OF = "2026-06-12T09:00:00.000Z";

const OPRISK_ACTOR = {
  type: "service" as const,
  id: "agent:tomas:npa-oprisk-attestation",
};

const OPRISK_CITATIONS = [
  "D-FX-HELD-DIMS-SEAT-SWEEP",
  "D-FX-OTC-NPA-SCOPE-EXPANSION",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const OPRISK_CITATION_CHAIN: readonly string[] = [
  ...OPRISK_CITATIONS,
  "BCBS-D196-§644",
  "REG-33",
  "FIC-ACT-38-2001",
  "platform/event-store/event-types/operational-risk.ts",
  "platform/reporting/operational-loss-projection.ts",
  "platform/markets/identity/counterparty-identity-gate.ts",
  "dashboard/markets-fx-gateway.ts",
  "platform/reporting/ba-400-op-risk.ts",
];

export const OPRISK_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-op-rwa-gross-income",
    title:
      "op-RWA capital (BIA/TSA per BCBS D196 §645–654 / Reg 33) is gross-income-blocked: it requires three fiscal years of audited gross income, which do not exist in the build phase. The BA 400 engine (platform/reporting/ba-400-op-risk.ts) is rehearsal-grade against synthetic fixtures; no hollow gross-income figure is fabricated.",
    owner:
      "Camille (Chief Financial Officer, governance) + Bea (Accounting & financial reporting engineer, engineering)",
    targetTrigger:
      "revenue-start + three fiscal years of audited gross income (post-licence-day) feed the BA 400 op-RWA computation",
    citations: ["BCBS-D196-§644", "REG-33", "platform/reporting/ba-400-op-risk.ts"],
  },
  {
    gapId: "fx-op-risk-loss-distribution",
    title:
      "No loss-distribution / LDA (or SMA internal-loss-multiplier) capital model exists; OperationalLossEvent is the CAPTURE substrate (the internal-loss data set) only. A loss-distribution approach needs a multi-year loss-data history and is a licence-day model build, not a build-phase artefact.",
    owner: "Tomas (Operations & payments engineer, engineering)",
    targetTrigger:
      "licence-day op-risk model build — multi-year internal-loss data history accumulates, then the LDA/SMA model is calibrated and validated (Helena, CRO methodology owner)",
    citations: ["BCBS-D196-§644", "platform/event-store/event-types/operational-risk.ts"],
  },
  {
    gapId: "fx-op-risk-real-counterparty-onboarding",
    title:
      "The identity gate's party-of-record + KYC-acceptance records for the authorised FX counterparties are SIMULATED build-phase fixtures (CounterpartyEligibilityScreened + SanctionsClearancePassed via scripts/register-sim-fx-counterparty-identity.ts, no hashed CDD evidence). Real institutional onboarding (full Niko 21-phase lifecycle) replaces them at licence-day.",
    owner: "Niko (Client lifecycle, sales)",
    targetTrigger:
      "licence-day counterparty onboarding (real KYC/CDD with hashed evidence; Niko lifecycle activates at licence-day)",
    citations: ["FIC-ACT-38-2001", "scripts/register-sim-fx-counterparty-identity.ts"],
  },
];

export interface OpRiskAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
  readonly blockedReason?: string;
  /** Diagnostics from the genuine-enforcement gates. */
  readonly lossCaptureStands: boolean;
  readonly identityEnforces: boolean;
}

/**
 * Promote the operational-risk dimension of prd:bank:fx:otc-vanilla to
 * implementation-attested with the tracked deferred gaps. FAIL-CLOSED on two
 * genuine-enforcement gates:
 *
 *   GATE 1 (loss capture): the OperationalLossEvent type is registered (F-032)
 *     — a captured loss round-trips through the registered schema. Verified by
 *     a real append + projection read on an isolated probe store.
 *
 *   GATE 2 (identity enforces): in an isolated probe store, a non-party-of-
 *     record counterparty REJECTS at the gateway identity check, and a KYC-
 *     accepted party of record (with the other gates seeded) APPROVES. Proves
 *     the identity check genuinely fails closed and is not reject-always.
 *
 * If either gate fails, the dimension HOLDS design-attested and nothing is
 * emitted (over-attestation is the failure mode). Idempotent: skips if an
 * operational-risk implementation-attested event at or after OPRISK_AS_OF
 * already exists.
 */
export function runFxOpRiskAttestation(store: EventStore): OpRiskAttestationResult {
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === OPRISK_PRODUCT_ID &&
      p.dimension === "operational-risk" &&
      p.result === "implementation-attested" &&
      ev.as_of >= OPRISK_AS_OF
    ) {
      return { promoted: false, skipped: true, lossCaptureStands: true, identityEnforces: true };
    }
  }

  // GATE 1 — loss-capture substrate genuinely stands.
  const lossCaptureStands = isOperationalLossEventRegistered();
  // GATE 2 — identity check genuinely enforces (fail-closed + not reject-always).
  const identityProbe = probeIdentityEnforcement();
  const identityEnforces = identityProbe.ok;

  if (!lossCaptureStands || !identityEnforces) {
    return {
      promoted: false,
      skipped: false,
      lossCaptureStands,
      identityEnforces,
      blockedReason: [
        "operational-risk promotion refused —",
        `loss-capture stands: ${lossCaptureStands};`,
        `identity enforces: ${identityEnforces}`,
        identityProbe.detail ? `(${identityProbe.detail})` : "",
        ". The dimension HOLDS design-attested (over-attestation is the failure mode).",
      ]
        .join(" ")
        .replace(/\s+\./g, "."),
    };
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${OPRISK_PRODUCT_ID}:operational-risk:loss-capture+identity-gate`,
    tags: ["npa-gate", "dimension-upgrade", "operational-risk", OPRISK_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: OPRISK_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: OPRISK_ACTOR,
      citations: [...OPRISK_CITATIONS, "dimension:operational-risk"],
      payload: {
        productId: OPRISK_PRODUCT_ID,
        dimension: "operational-risk",
        result: "implementation-attested",
        citationChain: [...OPRISK_CITATION_CHAIN],
        deferredGaps: OPRISK_DEFERRED_GAPS.map((g) => ({ ...g, citations: [...g.citations] })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false, lossCaptureStands, identityEnforces };
}
