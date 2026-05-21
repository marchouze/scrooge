// runtime/agents/atlas-product-narrative-fulfilment.ts
//
// Event-driven handler that fulfils `ProductDimensionNarrativeRequested`
// events emitted by the /products page (or any other workflow) by
// authoring and recording a `ProductDimensionNarrativeRecorded` event
// on behalf of the requested agent.
//
// Subscribed event:
//   ProductDimensionNarrativeRequested
//
// Behaviour:
//   For each requested narrative, the handler:
//     1. Resolves the Product record (fixture or proposal-synthesised).
//     2. Looks up the dimension's policy metadata (owner, artefact,
//        fail rule, citations) and the dimension-specific slice of the
//        Product record.
//     3. Generates a deterministic prose narrative answering the two
//        policy questions ("how does this product impact my domain?
//        what do I need to do to support it?") from those inputs.
//     4. Emits `ProductDimensionNarrativeRecorded` with the requested
//        agent's name + position as authorAgentName/authorAgentPosition.
//
// Substrate-gap note (transparent labelling, per Principle 6):
//   This is the build-phase substrate stand-in. The full operating model
//   has each dimension owner's *own* event-triage handler subscribe to
//   ProductDimensionNarrativeRequested and produce a Tier-1 narrative
//   citing the agent's real-time read of the registers it owns. That
//   slice (one handler per dimension owner) is a future improvement; the
//   bus fan-out shape this handler uses is already the correct contract,
//   so the slice is purely a refactor.
//
// Authority chain (Principle 2 upward):
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5.
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10).
//   - CLAUDE.md Principle 1 (narrative-as-event), Principle 6 (autonomous).
//
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore, logger } from "../../platform/composition";
import { makeProductDimensionNarrativeRecorded } from "../../platform/event-store/event-types/product";
import type { Product } from "../../platform/markets/products";
import {
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
  M4_FX_SPOT_FIXTURE,
} from "../../platform/markets/products/fixtures";
import type { AgentRunContext, AgentRunOutput } from "../types";

const SUBSCRIBED_EVENTS = ["ProductDimensionNarrativeRequested"] as const;

const FIXTURES: readonly Product[] = [
  M1_JSE_EQUITY_CASH_FIXTURE,
  M2_SAGB_FIXED_COUPON_FIXTURE,
  M4_FX_SPOT_FIXTURE,
];

// ---------------------------------------------------------------------------
// Dimension citation chains (mirrors dashboard/products-detail.ts metadata).
// Kept here so the runtime handler is self-contained and doesn't pull a
// dashboard module into the agent-runtime import graph.
// ---------------------------------------------------------------------------

const DIMENSION_CITATIONS: Record<string, readonly string[]> = {
  "market-risk": ["BCBS-d352", "BCBS-d457", "RAS § B-market", "ORG-PR-19"],
  "credit-risk": ["BCBS-Large-Exposures", "Banks-Act-94-1990", "ORG-PR-09", "ORG-PR-16"],
  "liquidity-funding": ["BCBS-d295", "BCBS-d335", "ORG-PR-06", "ORG-PR-07", "ORG-PR-08"],
  "operational-risk": ["BCBS-OpRisk-2021", "BCBS-OpResilience-2021", "ORG-PR-17", "ORG-PR-18"],
  "operational-readiness": ["CLAUDE.md-P1", "CLAUDE.md-P3", "D-PRODUCT-CONSTRUCTION-SUBSTRATE"],
  accounting: ["IFRS-9", "IFRS-13", "IAS-21", "ORG-AC-15"],
  capital: ["Banks-Act-Reg-39", "Basel-III-IV", "ORG-PR-02", "ORG-PR-03", "ORG-PR-05"],
  "conduct-suitability": [
    "FAIS-Act-37-2002",
    "FSCA-Conduct-Standard-1-2018",
    "FSCA-Conduct-Standard-3-2018",
    "ORG-CD-01",
  ],
  "aml-sanctions-pep": ["FIC-Act-38-2001", "UN-OFAC-EU-UK-HMT", "ORG-AML", "ORG-SAN"],
  "model-risk": ["SR-11-7", "SS-1-23", "BCBS-CG-Principles", "RAS § B7"],
  "legal-documentation": ["ECTA-25-2002", "ISDA-Master", "GMRA", "ORG-MK-06", "ORG-CS3-001"],
  "information-security": ["Joint-Standard-1-2024", "POPIA-s19-22", "CLAUDE.md-P4", "ORG-CY"],
  privacy: ["POPIA-4-2013", "SARB-Directive-3-2018", "ORG-PR-PRIV"],
  tax: ["Income-Tax-Act", "VAT-Act", "FATCA-IGA", "CRS"],
};

const HANDLER_CITATIONS = [
  "D-NEW-PRODUCT-APPROVAL-POLICY",
  "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
  "CLAUDE.md-P1",
];

// ---------------------------------------------------------------------------
// Product resolution.
// ---------------------------------------------------------------------------

function resolveProduct(productId: string): Product | null {
  for (const fx of FIXTURES) {
    if (fx.productId === productId) return fx;
  }
  // Fallback: walk ProductProposalRegistered events for a minimal record.
  // (Handler keeps a defensive copy of the projection logic so it doesn't
  // pull dashboard/products-view.ts into the runtime import graph.)
  let latest: { payload: Record<string, unknown>; asOf: string } | null = null;
  for (const ev of eventStore.replay({ type: "ProductProposalRegistered" })) {
    const p = ev.payload as Record<string, unknown>;
    if (String(p.productId ?? "") !== productId) continue;
    if (latest && latest.asOf >= ev.as_of) continue;
    latest = { payload: p, asOf: ev.as_of };
  }
  if (!latest) return null;
  return {
    productId,
    family: String(latest.payload.family ?? "unknown") as Product["family"],
    version: "0.1.0",
    name: String(latest.payload.name ?? productId),
    description: String(latest.payload.description ?? ""),
    franchiseScope: "institutional",
    legalEntityId: "LE-BANK-SA",
    currency: String(latest.payload.currency ?? "ZAR"),
    jurisdiction: String(latest.payload.jurisdiction ?? "ZA"),
    cdmComposition: {
      primitives: [
        {
          module: "@platform/markets/cdm/primitives",
          symbol: "instrumentSchema",
          role: "placeholder — composition not yet attested",
        },
      ],
      extensions: [],
      compositionRule: "TBD — composition not yet attested",
    },
    lifecycleEventFamily: [],
    riskProfile: {
      marketRiskDimensions: [],
      creditRiskShape: "no-counterparty",
      liquidityClassification: "non-hqla",
      fundingProfile: "cash-funded",
      modelRiskTier: "tier-3",
    },
    accountingClassification: {
      ifrs9Family: "fvtpl",
      ifrs13FairValueHierarchy: "level-3",
      ias21FxTreatment: "n/a",
      baReturnLineMapping: [],
    },
    legalDocumentation: {
      masterAgreement: "none-listed",
      ectaExecutionPath: "electronic-default",
      jurisdictionMatrix: [String(latest.payload.jurisdiction ?? "ZA")],
    },
    operationalReadiness: {
      settlementPath: "TBD",
      reconciliationCadence: "daily",
      substrateCompletenessGate: "TBD",
    },
    securityProfile: {
      threatModelRef: "ORG-CY-01",
      hsmCustodyRequired: false,
      zeroTrustPosture: "default",
    },
    policyAttestations: [],
    lifecycle: "proposed",
    citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
  };
}

// ---------------------------------------------------------------------------
// Narrative generation — per dimension. Deterministic, drawn from the
// Product record + policy gate. No fabrication beyond what's encoded in
// the typed record.
// ---------------------------------------------------------------------------

function generateNarrative(product: Product, dimension: string): string {
  const rp = product.riskProfile;
  const ac = product.accountingClassification;
  const ld = product.legalDocumentation;
  const or_ = product.operationalReadiness;
  const sp = product.securityProfile;

  switch (dimension) {
    case "market-risk":
      return [
        `Impact: ${product.name} carries market-risk dimensions [${rp.marketRiskDimensions.join(", ") || "none declared"}] at the type level; pricing tier is ${rp.modelRiskTier}.`,
        "Support: I need a sensitivity envelope sized against RAS § B-market, a pricing model validated at the declared tier, and ongoing FRTB NMRF screening for any non-modellable factors introduced by this product. The pre-deal envelope check must pass before the first trade clears.",
      ].join("\n\n");
    case "credit-risk":
      return [
        `Impact: ${product.name} introduces a credit-risk shape of "${rp.creditRiskShape}" against counterparties in [${ld.jurisdictionMatrix.join(", ")}].`,
        "Support: I need SA-CCR coverage for the product class, counterparty-rating coverage across the target universe, and the pre-deal credit-engine + concentration check (ORG-PR-09) live before any trade. Limit headroom must be visible to the gateway.",
      ].join("\n\n");
    case "liquidity-funding":
      return [
        `Impact: ${product.name} is classified ${rp.liquidityClassification}; funding profile is ${rp.fundingProfile}.`,
        "Support: I need an LCR/NSFR contribution computation for the product, an HQLA classification I can defend, and an FTP attribution. RAS § B-liquidity envelope check must pass at expected book size.",
      ].join("\n\n");
    case "operational-risk":
      return [
        `Impact: ${product.name} settles on path "${or_.settlementPath}" with a ${or_.reconciliationCadence} reconciliation cadence.`,
        "Support: I need the process-readiness checklist signed, a severe-but-plausible scenario set rehearsed, and vendor-concentration mapped against Important Business Services. Resilience gaps must be mitigated before launch (ORG-PR-17/18).",
      ].join("\n\n");
    case "operational-readiness":
      return [
        `Impact: ${product.name} declares lifecycle events [${product.lifecycleEventFamily.join(", ") || "none declared"}]; substrate completeness gate is "${or_.substrateCompletenessGate}".`,
        "Support: I need every declared lifecycle event type registered with handlers, the reconciliation harness covering this product class, and the settlement path live (or simulator-equivalent during build phase). Missing handlers / posting rules surface on the /products page as substrate gaps.",
      ].join("\n\n");
    case "accounting":
      return [
        `Impact: ${product.name} classifies as IFRS 9 ${ac.ifrs9Family}, IFRS 13 ${ac.ifrs13FairValueHierarchy}, IAS 21 ${ac.ias21FxTreatment}. BA-return mapping: [${ac.baReturnLineMapping.join(", ") || "none declared"}].`,
        "Support: I need a posting rule for every lifecycle event in the product family (Dr/Cr legs balancing per currency), a fair-value revaluation rule consistent with the declared IFRS 13 level, and BA-return cell coverage so each posting routes to the right regulatory line. Missing posting rules surface as substrate gaps on the /products page.",
      ].join("\n\n");
    case "capital":
      return [
        `Impact: ${product.name} routes to BA-return lines [${ac.baReturnLineMapping.join(", ") || "none declared"}]; funding profile is ${rp.fundingProfile}.`,
        "Support: I need a pre-deal RWA delta engine output for the product class at expected book size and a capital-headroom check against RAS § B-capital. Pillar 2A add-on must be quantified where the product introduces idiosyncratic risk not captured by the standardised approach.",
      ].join("\n\n");
    case "conduct-suitability":
      return [
        `Impact: ${product.name} targets ${product.franchiseScope} counterparties in [${ld.jurisdictionMatrix.join(", ")}].`,
        "Support: I need the FAIS conduct treatment determination on record (institutional-only is FAIS-exempt per s.44 for FSP-to-FSP), FSCA Conduct Standard 1–3/2018 dimensional mapping complete, and the TCF posture attested. Any retail or non-FSP counterparty class entering scope requires a strategic-foundation amendment cycle first.",
      ].join("\n\n");
    case "aml-sanctions-pep":
      return [
        `Impact: ${product.name} extends counterparty CDD to jurisdictions [${ld.jurisdictionMatrix.join(", ")}].`,
        `Support: I need the CDD pathway extended to every targeted counterparty class, sanctions-screening service coverage for the new jurisdictions, PEP detection live, and a transaction-monitoring rule set covering this product's transaction shape before first trade (FIC Act 38/2001).`,
      ].join("\n\n");
    case "model-risk":
      return [
        `Impact: ${product.name} requires model-risk tier ${rp.modelRiskTier} (Nadia methodology).`,
        "Support: I need Tier-classification of every pricing, risk, and classification model used by this product, validation appropriate to the declared tier, and a challenger/shadow model for tier-1 dependencies. Any tier-classification disagreement between first line and second line halts the product at the gate.",
      ].join("\n\n");
    case "legal-documentation":
      return [
        `Impact: ${product.name} requires ${ld.masterAgreement} as the master agreement; ECTA path is ${ld.ectaExecutionPath}; jurisdictions [${ld.jurisdictionMatrix.join(", ")}].`,
        "Support: I need master-agreement coverage executed with every in-scope counterparty class before first trade, ECTA execution path verified, and a dispute-resolution procedure in place per Conduct Standard 3/2018 §6. Any missing master agreement halts the product at the gate.",
      ].join("\n\n");
    case "information-security":
      return [
        `Impact: ${product.name} carries threat-model ref "${sp.threatModelRef}"; HSM custody ${sp.hsmCustodyRequired ? "required" : "not required"}; zero-trust posture ${sp.zeroTrustPosture}.`,
        "Support: I need a threat model covering every wire path the product introduces (FIX, RFQ, confirmation, settlement instruction), HSM key custody specified for any product-signing path, and a zero-trust pattern for any new external integration. The threat-model gate must close before launch (Joint Standard 1/2024).",
      ].join("\n\n");
    case "privacy":
      return [
        `Impact: ${product.name} touches counterparty + bank-employee personal data within the institutional-wholesale boundary; jurisdictions [${ld.jurisdictionMatrix.join(", ")}].`,
        `Support: I need POPIA classification of every personal-data field the product touches, a cross-border transfer determination if any counterparty data crosses ZA boundaries (POPIA s.72), and a retention-schedule mapping aligned with the bank's records-management policy.`,
      ].join("\n\n");
    case "tax":
      return [
        `Impact: ${product.name} settles in ${product.currency}; jurisdictions [${ld.jurisdictionMatrix.join(", ")}].`,
        "Support: I need VAT classification (financial-services exemption check), STT classification where listed-equity transfers are involved, FATCA/CRS classification of every counterparty class targeted, and transfer-pricing methodology for any inter-entity flow. Section-24J binding-instrument treatment applies to any debt instrument introduced.",
      ].join("\n\n");
    default:
      return `Impact + support narrative not yet templated for dimension "${dimension}".`;
  }
}

// ---------------------------------------------------------------------------
// Handler.
// ---------------------------------------------------------------------------

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  // Two invocation paths:
  //   (1) Bus-dispatched: `ctx.trigger.triggeringEvents` lists the specific
  //       request(s) that fired this run.
  //   (2) On-request / direct: triggeringEvents is empty (this is how
  //       runAgent invokes the handler when called via the bus-tick
  //       hook from the dashboard, or via `bun run agent:atlas-...`).
  //       Fall back to scanning the event store for any unfulfilled
  //       `ProductDimensionNarrativeRequested` (latest-by-asOf per
  //       (productId, dimension), recorded narrative missing or older).
  // Both paths converge on the same fulfilment loop below.
  type RequestEvent = NonNullable<typeof ctx.trigger.triggeringEvents>[number];
  const triggering = ctx.trigger.triggeringEvents ?? [];
  let relevant: RequestEvent[] = triggering.filter((e) =>
    (SUBSCRIBED_EVENTS as readonly string[]).includes(e.type),
  );

  if (relevant.length === 0) {
    const latestRequest = new Map<string, { asOf: string; event: RequestEvent }>();
    const latestRecorded = new Map<string, string>();
    for (const ev of eventStore.replay({ type: "ProductDimensionNarrativeRequested" })) {
      const p = ev.payload as Record<string, unknown>;
      const key = `${String(p.productId ?? "")}|${String(p.dimension ?? "")}`;
      const prev = latestRequest.get(key);
      if (prev && prev.asOf >= ev.as_of) continue;
      latestRequest.set(key, { asOf: ev.as_of, event: ev });
    }
    for (const ev of eventStore.replay({ type: "ProductDimensionNarrativeRecorded" })) {
      const p = ev.payload as Record<string, unknown>;
      const key = `${String(p.productId ?? "")}|${String(p.dimension ?? "")}`;
      const prev = latestRecorded.get(key);
      if (prev && prev >= ev.as_of) continue;
      latestRecorded.set(key, ev.as_of);
    }
    relevant = [];
    for (const [key, { event, asOf }] of latestRequest) {
      const recordedAt = latestRecorded.get(key);
      if (!recordedAt || recordedAt < asOf) relevant.push(event);
    }
  }

  if (relevant.length === 0) {
    return {
      eventsEmitted: 0,
      summary: "atlas:product-narrative-fulfilment — no unfulfilled narrative requests",
      ok: true,
    };
  }

  let emitted = 0;
  const fulfilled: string[] = [];
  const skipped: string[] = [];

  for (const ev of relevant) {
    const payload = ev.payload as Record<string, unknown>;
    const productId = String(payload.productId ?? "");
    const dimension = String(payload.dimension ?? "");
    const authorAgentName = String(payload.requestedFromAgentName ?? "");
    const authorAgentPosition = String(payload.requestedFromAgentPosition ?? "");

    if (!productId || !dimension || !authorAgentName || !authorAgentPosition) {
      skipped.push(`${productId}|${dimension} — incomplete payload`);
      continue;
    }

    const product = resolveProduct(productId);
    if (!product) {
      skipped.push(`${productId}|${dimension} — product not found`);
      continue;
    }

    const citationChain = [
      ...HANDLER_CITATIONS,
      ...(DIMENSION_CITATIONS[dimension] ?? []),
      ...product.citations,
    ];

    const narrative = generateNarrative(product, dimension);

    try {
      const narrativeEvent = makeProductDimensionNarrativeRecorded({
        asOf: ctx.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas:product-narrative-fulfilment" },
        citations: citationChain,
        payload: {
          productId,
          dimension,
          authorAgentName,
          authorAgentPosition,
          narrative,
          citationChain,
        },
      });
      eventStore.append(narrativeEvent);
      emitted += 1;
      fulfilled.push(`${productId}|${dimension}|${authorAgentName}`);
    } catch (e) {
      skipped.push(`${productId}|${dimension} — emit failed: ${(e as Error).message}`);
    }
  }

  const ok = skipped.length === 0;
  const summary = `atlas:product-narrative-fulfilment — fulfilled=${emitted} skipped=${skipped.length}${
    skipped.length > 0 ? ` [${skipped.join("; ")}]` : ""
  }`;

  logger.info({ emitted, fulfilled, skipped }, summary);

  return { eventsEmitted: emitted, summary, ok };
};

export default handler;
