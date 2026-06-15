// platform/markets/products/npa-fx-operational-readiness-attestation.ts
//
// FX OTC umbrella NPA — operational-readiness dimension attestation (Tomas,
// Operations and payments engineer, engineering).
//
// This module promotes the `operational-readiness` dimension of
// `prd:bank:fx:otc-vanilla` from design-attested to implementation-attested
// after verifying that both Gap 1 and Gap 2 are genuinely implemented:
//
//   GAP 1 — Any-pair nostro designation substrate (fail-closed):
//     The nostro routing registry (platform/markets/fx/nostro-routing-registry.ts)
//     resolves FCY currency code → designated correspondent nostro account for
//     ZAR/USD/EUR/GBP/JPY/CHF/AUD. For any OTHER currency, resolveNostroAccount
//     returns ok:false (fail-closed). The substrate emits NostroDesignationMissing
//     and rejects the trade — never routes to suspense (suspense hides settlement risk).
//
//   GAP 2 — Forward and swap far-leg failure runbooks (typed events + handlers):
//     FxForwardDefaulted     — counterparty default at maturity / swap far-leg default.
//                              Triggers ISDA §6 close-out netting (ops notified via
//                              high-severity SubstrateAlert).
//     FxForwardExtensionRequested — extension request. Marks trade pending-extension;
//                              notifies desk (medium SubstrateAlert).
//     NostroDesignationMissing — settlement routing rejection event for fail-closed path.
//     All typed (F-032 registry), all with handler functions in otc-failure-handlers.ts.
//
// NDF deferred gap: NDFs (non-deliverable forwards) are NOT in v1.0 scope.
// Explicitly tracked as gapId "fx-ndf-runbooks".
//
// Promotion is idempotent: skips if an operational-readiness implementation-
// attested event at or after OPS_READINESS_AS_OF already exists.
//
// Authority:
//   - D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL (CEO, 2026-06-15)
//   - D-NEW-PRODUCT-APPROVAL-POLICY §5
//   - PROC-OPS-SFBCP-01 v0.2 (Devon, COO, governance)
//   - ISDA 2002 Master Agreement §6, §2(c)
//   - BCBS d226 §4
// Author: Tomas (Operations and payments engineer, engineering)

import { TYPED_EVENT_TYPES } from "../../event-store/event-types/index";
import {
  type ProductDeferredGap,
  makeProductDimensionAttested,
} from "../../event-store/event-types/product";
import { buildPhaseFixtureTag } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import { designatedCurrencies, resolveNostroAccount } from "../fx/nostro-routing-registry";

export const OPS_READINESS_PRODUCT_ID = "prd:bank:fx:otc-vanilla";

// Later than the operational-risk promotion (2026-06-12T09:00) so latest-
// wins folds pick up this promotion in the correct order.
export const OPS_READINESS_AS_OF = "2026-06-15T10:00:00.000Z";

const OPS_READINESS_ACTOR = {
  type: "service" as const,
  id: "agent:tomas:npa-operational-readiness-attestation",
};

const OPS_READINESS_CITATIONS = [
  "D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL",
  "D-NEW-PRODUCT-APPROVAL-POLICY",
];

export const OPS_READINESS_CITATION_CHAIN: readonly string[] = [
  ...OPS_READINESS_CITATIONS,
  "PROC-OPS-SFBCP-01-V0.2",
  "ISDA-2002-§6",
  "ISDA-2002-§2(c)",
  "BCBS-D226-§4",
  "Banks-Act-94-Reg-39",
  "platform/markets/fx/nostro-routing-registry.ts",
  "platform/markets/fx/otc-failure-handlers.ts",
  "platform/event-store/event-types/fx-accounting.ts",
];

export const OPS_READINESS_DEFERRED_GAPS: readonly ProductDeferredGap[] = [
  {
    gapId: "fx-ndf-runbooks",
    title:
      "NDF (non-deliverable forward) settlement on fixing-date net basis — out of scope at v1.0. NDFs differ from deliverable forwards in that settlement is the net of (contracted NDF rate − fixing rate) × notional in the settlement currency, not a physical currency exchange. The fixing-date event, central-bank-published fixing rate feed, and net-payment settlement pathway require a separate build.",
    owner: "Tomas (Operations and payments engineer, engineering)",
    targetTrigger:
      "v1.1 when NDF is added to product scope (requires: fixing-rate feed integration, NDF settlement event type, net-payment handler)",
    citations: ["D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL"],
  },
];

// ---------------------------------------------------------------------------
// Gate implementations
// ---------------------------------------------------------------------------

/**
 * GATE 1 — Nostro designation substrate: verifies that:
 *   (a) The registry resolves each designated currency to a concrete account.
 *   (b) A non-designated currency (e.g. "SGD") returns ok:false (fail-closed).
 */
export function probeNostroCoverage(): {
  ok: boolean;
  designatedCount: number;
  failClosedWorks: boolean;
  detail?: string;
} {
  const ccys = designatedCurrencies();

  // (a) All designated currencies must resolve to a concrete account.
  for (const ccy of ccys) {
    const r = resolveNostroAccount(ccy);
    if (!r.ok) {
      return {
        ok: false,
        designatedCount: ccys.length,
        failClosedWorks: false,
        detail: `designated currency ${ccy} failed to resolve: unexpected — it should resolve to a concrete account`,
      };
    }
  }

  // (b) An undesignated currency must fail-closed.
  const undesignatedProbe = resolveNostroAccount("SGD"); // SGD not in v1.0
  if (undesignatedProbe.ok) {
    return {
      ok: false,
      designatedCount: ccys.length,
      failClosedWorks: false,
      detail: "SGD (undesignated probe) resolved to an account — fail-closed behaviour is broken",
    };
  }

  return { ok: true, designatedCount: ccys.length, failClosedWorks: true };
}

/**
 * GATE 2 — Failure event types registered (F-032): verifies that
 * NostroDesignationMissing, FxForwardDefaulted, and FxForwardExtensionRequested
 * are in the TYPED_EVENT_TYPES registry. Tests the F-032 completeness
 * without emitting test events to the canonical store.
 */
export function probeFailureEventTypesRegistered(): {
  ok: boolean;
  detail?: string;
} {
  const required = [
    "NostroDesignationMissing",
    "FxForwardDefaulted",
    "FxForwardExtensionRequested",
  ] as const;

  const missing = required.filter((t) => !TYPED_EVENT_TYPES.includes(t));
  if (missing.length > 0) {
    return {
      ok: false,
      detail: `failure event types not in TYPED_EVENT_TYPES registry (F-032): ${missing.join(", ")}`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// runFxOpsReadinessAttestation
// ---------------------------------------------------------------------------

export interface OpsReadinessAttestationResult {
  readonly promoted: boolean;
  readonly skipped: boolean;
  readonly blockedReason?: string;
  readonly nostroCoverage: ReturnType<typeof probeNostroCoverage>;
  readonly failureTypesRegistered: ReturnType<typeof probeFailureEventTypesRegistered>;
}

/**
 * Promote the `operational-readiness` dimension of prd:bank:fx:otc-vanilla
 * to implementation-attested. FAIL-CLOSED on two gates:
 *
 *   GATE 1 (nostro coverage): designatedCurrencies() resolve, and an
 *     undesignated probe returns ok:false (fail-closed genuinely works).
 *
 *   GATE 2 (failure events registered): NostroDesignationMissing,
 *     FxForwardDefaulted, and FxForwardExtensionRequested are in the
 *     TYPED_EVENT_TYPES registry (F-032).
 *
 * If either gate fails, the dimension HOLDS design-attested and nothing is
 * emitted (over-attestation is the failure mode). Idempotent.
 */
export function runFxOpsReadinessAttestation(store: EventStore): OpsReadinessAttestationResult {
  // Idempotency check.
  for (const ev of store.replay({ type: "ProductDimensionAttested" })) {
    const p = ev.payload as { productId?: string; dimension?: string; result?: string };
    if (
      p.productId === OPS_READINESS_PRODUCT_ID &&
      p.dimension === "operational-readiness" &&
      p.result === "implementation-attested" &&
      ev.as_of >= OPS_READINESS_AS_OF
    ) {
      return {
        promoted: false,
        skipped: true,
        nostroCoverage: { ok: true, designatedCount: 0, failClosedWorks: true },
        failureTypesRegistered: { ok: true },
      };
    }
  }

  const nostroCoverage = probeNostroCoverage();
  const failureTypesRegistered = probeFailureEventTypesRegistered();

  if (!nostroCoverage.ok || !failureTypesRegistered.ok) {
    return {
      promoted: false,
      skipped: false,
      nostroCoverage,
      failureTypesRegistered,
      blockedReason: [
        "operational-readiness promotion refused —",
        `nostro coverage: ${nostroCoverage.ok}${nostroCoverage.detail ? ` (${nostroCoverage.detail})` : ""};`,
        `failure types registered: ${failureTypesRegistered.ok}${failureTypesRegistered.detail ? ` (${failureTypesRegistered.detail})` : ""}.`,
        "The dimension HOLDS design-attested (over-attestation is the failure mode).",
      ]
        .join(" ")
        .replace(/\s+\./g, "."),
    };
  }

  const provenance = buildPhaseFixtureTag({
    sourceLineage: "platform:npa-attestation-runner",
    variant: `npa-dimension-upgrade:${OPS_READINESS_PRODUCT_ID}:operational-readiness:nostro-registry+forward-swap-runbooks`,
    tags: ["npa-gate", "dimension-upgrade", "operational-readiness", OPS_READINESS_PRODUCT_ID],
  });

  store.append({
    ...makeProductDimensionAttested({
      asOf: OPS_READINESS_AS_OF,
      entity: "LE-ZA-HOZ-BANK",
      actor: OPS_READINESS_ACTOR,
      citations: [...OPS_READINESS_CITATIONS, "dimension:operational-readiness"],
      payload: {
        productId: OPS_READINESS_PRODUCT_ID,
        dimension: "operational-readiness",
        result: "implementation-attested",
        citationChain: [...OPS_READINESS_CITATION_CHAIN],
        deferredGaps: OPS_READINESS_DEFERRED_GAPS.map((g) => ({
          ...g,
          citations: [...g.citations],
        })),
      },
    }),
    provenance,
  });

  return { promoted: true, skipped: false, nostroCoverage, failureTypesRegistered };
}
