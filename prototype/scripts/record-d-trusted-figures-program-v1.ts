import { recordDecision } from "../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-TRUSTED-FIGURES-PROGRAM-V1",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Trusted-Figures Program: seed visibility/descope, financial-constants registry, calculations-as-owned-models with derivation-event provenance, and loud failure modes",
    category: "engineering",
    recommendation:
      "Execute a 4-phase program. Phase A: calculation-model spine — CalculationPerformed derivation event + calculation-binding registry binding each calc function to an approved registered model + owning agent; emit per surfaced figure; /api/models + Models page; recon:calc-model-binding. Phase B: failure modes — FinancialInput<T> result type replacing silent ?? 0 collapses; missing inputs set CalculationPerformed.status + emit SubstrateAlert{data-integrity}; expected-event watchdog; data-failure banner; value-unavailable UI badge. Phase C: financial-constants registry with owning-agent + citation per constant, migrating runoff/haircut/caps/minimums/RWA weights/limits/tolerances out of calc files into a UI-visible, owner-editable store; recon:financial-constants-coverage. Phase D: seed management — SeedDescoped + SeedPromotedToSimulated events, seed manifest, bootDerive honors descoping, /api/seeds + Seeds page with Descope and Replace-with-simulated workflows; recon:seed-manifest-parity. Sequence A→D→B→C (A and D both touch the event-types barrel + handlers-metadata, so run sequentially to avoid deterministic collision). Each phase is a Scrooge-coordinated run attributed to its owning agent (Atlas substrate; Rohan/Nadia model registry; Anya projections; CRO/CFO own constants).",
    rationale:
      "The bank is a real SARB-licensed institution-in-formation; at licence-day every surfaced figure must be defensible to a regulator and external auditor. Code review found the substrate has the right bones (events-first store, model-registry, prod/sim ProvenanceTag) but the four objectives are unmet: boot seeds are invisible hardcoded server.ts calls with no descope/replace UI; every financial constant (LCR runoff/haircut/caps/minimum, NSFR factors, RWA weights, capital minimums, risk limits) is buried inline and unowned; calc functions (computeLCR/computeNSFR/computeCapitalMetrics/RWA) are bound to no registered model, owner, or version; and missing values silently collapse to 0 (?? 0 pervasive: 17 in lcr.ts, 21 in nsfr.ts, 8 in rwa-engine; 216 catch blocks in platform/), with the only failure surface being agent CI runs. The existing provenance axis is prod/sim — orthogonal to the calculation-history provenance (which model, which inputs, when) that financial trust requires. Marc selected typed derivation events (full Principle-1 audit trail) as the calc-provenance architecture.",
    sourceDocHashes: [],
    citations: [
      "D-DATA-PROVENANCE-SUBSTRATE",
      "D-PRODUCT-CONSTRUCTION-SLICES-4-8",
      "D-BANK-CONFIG-STORE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  new Date().toISOString(),
);

console.log(JSON.stringify(result, null, 2));
