// scripts/file-atlas-v2-bbaas-w2-domain-map.ts
//
// One-shot RMS Phase 3 filing for Atlas's W2 deliverable of the WS-V2-BBAAS
// structural analysis: the full BIAN-aligned domain map of the v2 "Bank
// Backbone as a Service" — per domain the v1 modules realising it, the key
// data store(s) owned (event-type families + projections), the owning
// functional seat, the ontology bindings (internal graph ontology; FINOS CDM,
// ISO 20022, FIBO), the shared/tenant classification, and the subscription
// tier — plus a BIAN adoption-depth recommendation and the v2 gap list.
// Emits a RecordFiled event so the Documents register holds the canonical
// paper. The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W2-W3-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-w2-domain-map] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W2 domain map: BIAN-aligned domains, data-store ownership, ontology bindings

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W2-W3-DISPATCH (CEO-approved 2026-06-12); expands §5 of the
session-1 ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12)
**Audience:** Marc (CEO)
**Status:** W2 analysis deliverable of the WS-V2-BBAAS structural analysis. The domain map is
a proposal for the v2 backbone's domain architecture, not a decision; the BIAN-depth
recommendation at the end is the decision this document tees up.

---

## 1. Method and conventions

This map enumerates **25 domains** of the v2 backbone, grouped by BIAN business area. The
enumeration is grounded bottom-up: every domain is anchored in v1 modules that exist in-tree
today (all paths verified under \`prototype/\` at authoring time), in the event-type families
those modules own (~90 registry definition files under
\`platform/event-store/registry/\` and \`platform/event-store/event-types/\`), and in the
projections derived from them. Where BIAN's service landscape has a fitting service domain we
use its name; where it does not (the agent-dispatch substrate, the event backbone, decision
distillation) we use a justified bespoke name and say so explicitly — per the session-1
working hypothesis, the map borrows BIAN's *carving*, not its middleware.

Each domain entry carries seven attributes:

1. **BIAN service domain** (or justified bespoke name), grouped by business area.
2. **V1 modules** — verified \`prototype/\` paths.
3. **Key data store(s)** — owned event-type families (actual registered event types) and
   projections.
4. **Owning functional seat** — v2 seat names per ideas-paper §3, current persona in
   parentheses (identity discipline: name + position on first mention).
5. **Ontology bindings** — internal graph ontology (the 19 node types / 30+ edge types in
   \`platform/regulatory/graph/types.ts\`: Provision, Obligation, RegulatoryObjective,
   Capability, Policy, Procedure…; DERIVES_FROM, IMPLEMENTED_BY, REALISES, SERVES…) plus
   external standards: FINOS CDM (the existing layer:
   \`platform/markets/cdm/\` and \`platform/event-store/event-types-cdm.ts\`, regenerated via
   CdmBindingsRegenerated), ISO 20022 (existing serialisers under
   \`platform/payments/iso20022/\`), FIBO (concept areas; no v1 code binding yet — proposed).
6. **Shared/tenant classification** — foundational core | shared model library | shared
   reference knowledge | tenant-specific, consistent with the W1 distillation register
   (\`platform/governance/decision-distillation/register.ts\`, dataset
   \`classifications.ts\`: 258 classified decisions, 92 foundational), grounded in
   foundational decision IDs where one anchors the domain.
7. **Subscription tier** — which tier first includes the domain: **C** comprehensive,
   **R** risk-and-reporting, **K** knowledge (tiers nest: C ⊃ R ⊃ K).

Seat-name shorthand used below (current persona in parentheses on first use): Substrate
Architect (Atlas, Core banking platform architect, engineering); Financial Accounting
Engineer (Bea, Accounting & financial reporting engineer, engineering); Risk Engineer (Rohan,
Risk engineer, engineering); Regulatory Knowledge Engineer (Mira, Compliance / RegTech
engineer, engineering); Data Engineer (Anya, Data / analytics engineer, engineering);
Continuous Assurance Engineer (Vera, Internal audit / continuous-assurance engineer,
engineering); Treasurer seat (Eitan, Treasurer, governance); Chief Risk Officer seat (Helena,
Chief Risk Officer, governance); Chief Compliance Officer seat (Zara, Chief Compliance
Officer, governance); Company Secretary seat (Owen, Company Secretary, governance); Chief
Financial Officer seat (Camille, Chief Financial Officer, governance).

### Summary table

| # | Domain (BIAN business area) | Classification | Tier |
|---|---|---|---|
| 1 | Party Reference Data Directory (Reference Data) | Foundational core (mechanism) / tenant (instances) | C |
| 2 | Product Directory (Reference Data) | Shared model library (CDM composition) / tenant (catalogue) | C |
| 3 | Market Data Management (Reference Data) | Foundational core | R |
| 4 | Payment Order & Execution (Payments) | Foundational core (rails) / tenant (flows) | C |
| 5 | Trade Booking, Settlement & Post-Trade (Investment Mgmt / Markets) | Foundational core (lifecycle) / tenant (trades) | C |
| 6 | Position Keeping (Investment Mgmt / Markets) | Foundational core | C |
| 7 | Collateral Administration (Loans & Advances / Markets) | Shared model library | R |
| 8 | Financial Accounting (Finance) | Foundational core (interpreter) / tenant (CoA, postings) | C |
| 9 | Product Control & P&L Attribution (Finance) | Foundational core | C |
| 10 | Market Risk Models (Risk & Compliance) | Shared model library | R |
| 11 | Credit Risk Models (Risk & Compliance) | Shared model library | R |
| 12 | Risk Appetite & Limit Management (Risk & Compliance) | Foundational core (engines) / tenant (calibrations) | R |
| 13 | Asset & Liability Management (Risk & Compliance / Treasury) | Shared model library | R |
| 14 | Liquidity Risk & Funding (Treasury) | Shared model library | R |
| 15 | Capital Adequacy & Stress Testing (Risk & Compliance) | Shared model library / tenant (scenarios, ICAAP) | R |
| 16 | Regulatory Reporting & Returns (Risk & Compliance) | Shared model library (renderers) / tenant (submissions) | R |
| 17 | Regulatory Knowledge & Obligation Management (Risk & Compliance) | Shared reference knowledge / tenant (adoptions) | K |
| 18 | Customer Due Diligence — KYC/AML (Risk & Compliance) | Foundational core (orchestration) / tenant (decisions) | C |
| 19 | Conduct & Market Surveillance (Risk & Compliance) | Shared model library / tenant (calibration) | R |
| 20 | Records & Document Management (Business Support) | Foundational core | K |
| 21 | Decision Governance & Distillation (Business Support) | Foundational core | K |
| 22 | Internal Audit & Continuous Assurance (Business Support) | Foundational core (harness) / split pipelines | K |
| 23 | Event Backbone & Tenant Composition (Business Support / bespoke) | Foundational core | K |
| 24 | Agent Workforce & Dispatch (bespoke) | Foundational core (substrate) / tenant (activation, memory) | C |
| 25 | Data Semantics & Provenance (Business Support) | Foundational core + shared reference knowledge | K |

---

## 2. Reference Data business area

### 2.1 Party Reference Data Directory

- **BIAN:** Party Reference Data Directory (exact BIAN service-domain name).
- **V1 modules:** \`platform/identity/\` (\`party-projection.ts\`, \`entity-short-ids.ts\`,
  \`types.ts\`), the Party register (eighth standing register, D-PARTY-REGISTER);
  \`platform/markets/identity/\` for counterparty identity.
- **Data stores:** PartyRegistered events (registry: \`registry/governance.ts\`); the party
  projection folding the four actor kinds (natural-person, legal-entity, counterparty,
  agent); counterparty lifecycle events (CounterpartyCategorised,
  CounterpartyEligibilityScreened/Breached/Revalidated, ClientAccepted/ClientRejected,
  BeneficialOwnerResolved, FatcaCrsClassified).
- **Seat:** Data Engineer (Anya).
- **Ontology:** internal — RegulatedEntity and the four-actor-kind party model; the
  versioned legal-entity tree (Principle 5). External — **FIBO** is the strongest fit of the
  three standards here: FBC (Financial Business & Commerce) and FND Parties/Agents concept
  areas; LEI as the external identifier scheme for legal-entity and counterparty kinds.
  ISO 20022 party blocks (PartyIdentification135 etc.) bind at the message edge in domain 4.
- **Classification:** foundational core — the actor-kind scheme, short-id discipline
  (D-FINANCIAL-INSTRUMENT-ENTITY anchors instrument-as-entity identity) and projection are
  platform; each tenant's parties are its own events. Entity-identity coherence is already
  recon-gated (\`platform/recon/entity-identity-coherence.ts\`).
- **Tier:** C (R-tier subscribers feed counterparty reference from their own systems but
  still consume the actor-kind scheme).

### 2.2 Product Directory

- **BIAN:** Product Directory (exact BIAN name).
- **V1 modules:** \`platform/markets/products/\` (\`fixtures.ts\`, \`composeProduct.ts\`,
  \`types.ts\` with \`cdmComposition\`, \`npa-gate.ts\`, \`npa-attestation-runner.ts\`,
  dimension-attestation modules, \`rwa-delta.ts\`, \`dcam-mapping.ts\`).
- **Data stores:** product approval / NPA events (ProductDeferredGap and the NPA attestation
  family; \`registry/decision-distillation.ts\`-adjacent product registries under
  \`registry/\`); the products projection (\`platform/projections/products\`). Known v1 debt:
  the catalogue itself lives in code fixtures — ideas-paper §8 marks products-as-events as a
  day-one v2 fix.
- **Seat:** Substrate Architect (Atlas) for the composition machinery; product approvals are
  cross-seat via the 14-dimension NPA gate (D-NEW-PRODUCT-APPROVAL-POLICY-V2, classified
  foundational in W1).
- **Ontology:** internal — ProductInstrument nodes; NPA dimension attestations cite
  Obligation/Policy nodes. External — **FINOS CDM is the defining binding**: products are
  CDM-composed (\`cdmComposition.{primitives, extensions, compositionRule}\` in
  \`platform/markets/products/types.ts\`; primitives in \`platform/markets/cdm/primitives.ts\`
  with per-asset-class modules fx/ird/equity/bond-book/instrument). The ACTUS mapping
  (\`platform/markets/cdm/dcam-actus-mapping.ts\`) adds contract-type semantics. FIBO FBC
  products taxonomy for naming; ISO 20022 not applicable here.
- **Classification:** shared model library for the CDM composition machinery and reference
  product definitions tenants *adopt*; tenant-specific for the adopted catalogue and NPA
  posture (each tenant's approved products, deferred gaps, attestations are its events).
- **Tier:** C.

### 2.3 Market Data Management

- **BIAN:** nearest BIAN names are Market Data Switch Administration / Financial Market
  Analysis; we use the bespoke umbrella **Market Data Management** because v1 unifies
  ingestion, provenance and staleness watching in one module, which BIAN splits.
- **V1 modules:** \`platform/market-data/\`; EOD seeds and rate sources under
  \`platform/markets/eod/\` (\`jibar-curve-seed.ts\`, \`make-jibar-rate-source.ts\`,
  \`forward-rate-seed.ts\`); \`platform/markets/pricing/\` and \`platform/markets/reference/\`.
- **Data stores:** MarketDataIngested, MarketDataOutage, MarketDataStaleAlert events
  (\`registry/market-data.ts\`); rate projections (\`platform/accounting/fx-rate-projection.ts\`).
- **Seat:** Data Engineer (Anya); staleness watchdogs co-owned with Risk Engineer (Rohan).
- **Ontology:** internal — Capability nodes REALISED_BY the ingestion procedures; provenance
  events carry source lineage (D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING, foundational in
  W1; recon gate \`market-data-provenance-gate.ts\`). External — FIBO IND (Indices &
  Indicators) for rate/index concepts; ISO 20022 \`reda\`/\`camt\` reference-data messages are a
  thin fit; CDM observable/asset-payout references bind where marks feed CDM trades.
- **Classification:** foundational core — provenance-gated ingestion is platform machinery;
  feeds and licences are per-tenant config.
- **Tier:** R (model library is unusable without governed market data).

## 3. Payments business area

### 3.1 Payment Order & Execution

- **BIAN:** Payment Order + Payment Execution (two exact BIAN service domains; v1 realises
  them as one module, so the map carries one domain with two BIAN names).
- **V1 modules:** \`platform/payments/\` — \`iso20022/\` (pacs008, pacs009, camt053 serialisers),
  \`swift-mt/\`, \`correspondent-connector.ts\`, \`inbound-simulator.ts\`, \`reconciliation.ts\`,
  \`isda-confirm/\`; correspondent routing in \`platform/markets/correspondent-routing.ts\`;
  settlement under \`platform/markets/settlement/\`.
- **Data stores:** PaymentInitiated, PaymentSettled, InboundMessageReceived,
  FxSettlementInstructed, EquitySettlementInstructed/Confirmed,
  IrsCouponPaymentInstructed/SettlementConfirmed events (\`registry/payments.ts\`,
  \`registry/correspondent-settlement.ts\`); nostro account projections
  (\`platform/projections/accounts\`).
- **Seat:** Operations Engineer (v2 seat; today realised across Bea for nostro accounting and
  Rohan for settlement engines — a seat v1 never formally filled, itself a W2 finding).
- **Ontology:** internal — settlement procedures REALISE payment Capabilities; RAS B2
  settlement/Herstatt feeders cite these events. External — **ISO 20022 is the defining
  binding**: pacs.008/pacs.009 credit transfers, camt.053 statements already serialised in
  v1; camt.052/054 and pain family are the natural v2 extensions. SWIFT MT coexists
  (\`swift-mt/\`). FIBO payments concepts secondary; CDM not applicable.
- **Classification:** foundational core for rails and serialisers; tenant-specific for every
  flow, nostro, and correspondent relationship (tenant events).
- **Tier:** C.

## 4. Investment Management / Markets business area

### 4.1 Trade Booking, Settlement & Post-Trade

- **BIAN:** Market Order Execution + Trade Confirmation Matching; the OTC trade-reporting
  slice maps to BIAN Trade & Price Reporting. One v1 domain because the event lifecycle is
  one chain.
- **V1 modules:** gateways and booking under \`platform/markets/\` (FX gateway with enforcing
  thresholds — \`platform/risk/fx-gateway-thresholds.ts\`; bond gateway; equity booking);
  \`platform/markets/settlement/\`, \`platform/markets/netting-sets/\`,
  \`platform/markets/legal/\` (ISDA/GMRA machinery), \`platform/odp/\` (\`uti-allocator.ts\`,
  \`trade-report-serialiser.ts\`), \`platform/compliance/odp-categorisation.ts\`.
- **Data stores:** trade lifecycle event families per asset class — FxTradeExecuted,
  EquityTradeBooked/Executed, IrsTradeBooked, bond trades (\`registry/markets.ts\`,
  \`registry/bonds.ts\`, \`registry/equities.ts\`, \`registry/ird-swaps.ts\`,
  \`registry/repo-mmd-ibl.ts\`); ODP/UTI events (\`registry/odp-umoja-uti.ts\`,
  \`registry/isda-odp.ts\`); markets projections (\`platform/projections/markets\`).
- **Seat:** Trading Systems Engineer (v2 seat; today Rohan, Risk engineer, doubling on
  markets — another seat-gap finding).
- **Ontology:** internal — trade-lifecycle-parity recon
  (\`platform/recon/trade-lifecycle-parity.ts\`) asserts the chain; PROC/Capability
  REALISES edges for booking procedures. External — **FINOS CDM** event model is the natural
  contract for booked trades (v1's CDM layer already composes the product side); UTI/UPI per
  CPMI-IOSCO for reporting; ISO 20022 \`setr\`/\`sese\` securities messages at settlement edge.
- **Classification:** foundational core for the lifecycle machinery (D-MARKETS-SCHEMA-
  FOUNDATION is the W1-foundational anchor); tenant-specific for every trade and netting set.
- **Tier:** C (R-tier banks keep their own trading systems and feed positions — see 4.2).

### 4.2 Position Keeping

- **BIAN:** Position Keeping (exact BIAN name).
- **V1 modules:** EOD revaluation engines \`platform/markets/eod/\`
  (\`fx-revaluation.ts\`, \`fx-forward-revaluation.ts\`, \`irs-revaluation.ts\`,
  \`bond-revaluation.ts\`, \`equity-revaluation.ts\`); position sourcing in
  \`platform/product-control/position-source.ts\` and \`cross-asset-positions.ts\`;
  \`platform/valuation/mark-adoption-engine.ts\`.
- **Data stores:** revaluation events — IrdSwapPositionRevalued (with dv01ByTenorBucket;
  the converged family per D-IRS-FAMILY-CONVERGE-ACCOUNTING), EquityPositionRevalued,
  BondPositionRevalued, IrsPositionRevalued (legacy family), FX reval events; position
  projections (\`platform/projections/alm-positions.ts\`, markets projections).
- **Seat:** Trading Systems Engineer; valuation marks co-owned with Financial Accounting
  Engineer (Bea).
- **Ontology:** internal — position-revalued-cites-mark recon enforces citation of the
  adopted mark; IPV tolerance (\`platform/markets/ipv-tolerance.ts\`). External — CDM
  valuation/position primitives; FIBO FBC financial instruments for classification. This is
  the **R-tier ingestion seam**: a large bank subscribing risk-and-reporting feeds
  position/trade events into exactly this domain's event contract instead of running 4.1.
- **Classification:** foundational core — the revaluation engines are deterministic
  event-in/event-out machinery every tenant runs identically.
- **Tier:** C natively; R as the position-feed contract.

### 4.3 Collateral Administration

- **BIAN:** Collateral Asset Administration (exact BIAN name).
- **V1 modules:** \`platform/collateral/\` (\`hqla-classifier.ts\`, \`inventory.ts\`);
  ODP collateral segregation engine + recon
  (\`platform/recon/odp-collateral-segregation-engine.ts\`); netting sets
  (\`platform/markets/netting-sets/\`).
- **Data stores:** collateral events (\`registry/collateral.ts\`,
  \`registry/odp-collateral-segregation.ts\`); HQLA stock feeds LCR (domain 14) via
  \`platform/reporting/hqla-stock.ts\`.
- **Seat:** Treasury Engineer (v2 seat; today split Rohan/Eitan-adjacent engineering).
- **Ontology:** internal — segregation obligations DERIVES_FROM ODP provisions; recon gates
  assert breach staleness. External — CDM collateral/margin primitives (the CDM working
  groups' strongest production area); ISO 20022 \`colr\` collateral messages; FIBO
  FBC debt/collateral concepts.
- **Classification:** shared model library — HQLA classification and segregation logic are
  regulation-derived models; inventories are tenant data.
- **Tier:** R.

## 5. Finance business area

### 5.1 Financial Accounting

- **BIAN:** Financial Accounting (exact BIAN name).
- **V1 modules:** \`platform/accounting/\` — GL posting interpreter (sole posting path after
  the SLA cutover arc, enforced by \`platform/recon/posting-engine-single-subscriber.ts\`),
  \`gl-projection.ts\`, \`coa-registry.ts\` + \`chart-of-accounts.json\` (known v1 debt:
  CoA-as-events is a day-one v2 fix), \`posting-rule-registry.ts\`, \`sla/\` (rules-as-data),
  \`period-close-handler.ts\`, \`designated-currency-ledger.ts\`, suspense and write-off
  machinery; IFRS statement renderers \`platform/reporting/ifrs-*.ts\` (balance sheet, income
  statement, cash flow, changes in equity, notes).
- **Data stores:** SubLedgerPostingEmitted (the central accounting event), JournalEntryPosted,
  AccountingPeriodOpened/Closed, BankAccountOpened/Configured/Closed,
  IfrsClassificationApplied (\`registry/balance-sheet.ts\`, \`registry/close-management.ts\`,
  \`registry/ifrs9-staging.ts\`); the GL projection and account projections.
- **Seat:** Financial Accounting Engineer (Bea); CFO seat (Camille) holds the governance
  authority (decision-authority routing table: finance close, AFS, IFRS policy → CFO).
- **Ontology:** internal — posting rules cite policies; SLA rules carry approval-workflow
  events; period-close procedures REALISE close Capabilities. External — **FIBO FBC/LOAN
  accounting and ownership concepts** are the natural semantic anchor for account taxonomy;
  ISO 20022 camt for statement export; IFRS taxonomy (XBRL) for the statement renderers.
- **Classification:** foundational core for the interpreter, projection, period-close and
  SLA machinery (D-BANK-ACCOUNT-SUBSTRATE, D-BALANCE-SHEET-SUBSTANTIATION-POLICY-V1 and
  D-IFRS9-STAGING-V1 are W1-foundational anchors); tenant-specific for CoA, posting-rule
  calibration, and every posting.
- **Tier:** C.

### 5.2 Product Control & P&L Attribution

- **BIAN:** no exact fit — BIAN's Position Management partially covers; bespoke name
  **Product Control** retained (it is the regulator-legible term).
- **V1 modules:** \`platform/product-control/\` (\`daily-pnl.ts\`, \`pnl-attribution.ts\`,
  \`pnl-signoff.ts\`, \`desk-cash-positions.ts\`, \`pnl-data-failures-view.ts\`);
  \`platform/markets/ipv-tolerance.ts\`; spread benchmarking recon.
- **Data stores:** P&L attribution and sign-off events (\`registry/product-control.ts\`);
  daily P&L projections; recon gates \`pnl-attribution-reconciles.ts\`,
  \`pnl-signoff-coverage.ts\`, \`all-asset-pnl-ipv-coverage.ts\`.
- **Seat:** Financial Accounting Engineer (Bea) with CFO-seat sign-off authority.
- **Ontology:** internal — sign-off procedures with P2 citations; attribution reconciles to
  GL events (Principle 1: P&L is a query). External — minimal; FIBO P&L concepts; CDM
  valuation primitives where attribution decomposes by CDM product.
- **Classification:** foundational core — attribution mechanics are tenant-agnostic; desk
  structure and sign-off calibration are tenant config.
- **Tier:** C.

## 6. Risk & Compliance business area

### 6.1 Market Risk Models

- **BIAN:** Market Risk Models (BIAN analytics family name).
- **V1 modules:** \`platform/market-risk/\` (\`var-engine.ts\`, \`cva-engine.ts\`,
  \`valuation-adjustment-engine.ts\`); BA320 computation \`platform/returns/ba320\` +
  \`platform/reporting/ba-320-*.ts\` adapters; IRRBB EVE/NII in \`platform/alm/\` feeds
  domain 13.
- **Data stores:** MarketRiskMeasureComputed, ValuationAdjustmentComputed events
  (\`registry/mtm.ts\`, \`registry/model-risk.ts\`); RwaComputed (market component);
  VaR cron + expected-event watchdog (\`platform/recon/expected-event-watchdog.ts\`).
- **Seat:** Risk Engineer (Rohan); CRO seat (Helena) holds model-approval authority.
- **Ontology:** internal — **IMPLEMENTED_BY / REALISES chains to MAR/BA320 provisions are
  the model library's citation contract**; model-registry nodes
  (\`platform/model-registry/\`) carry tier discipline (RAS B7). External — FIBO DER
  derivatives concepts; CDM product/valuation as model inputs; ISO 20022 not applicable.
- **Classification:** shared model library — the flagship v2 extraction class (ideas-paper
  §2.1): tenant-agnostic computational models binding tenant data at subscription time,
  carrying their provision citations with them.
- **Tier:** R.

### 6.2 Credit Risk Models

- **BIAN:** Credit Risk Models (BIAN analytics family name).
- **V1 modules:** \`platform/risk/\` (\`rwa-computed-engine.ts\`, \`rwa-engine.ts\`,
  \`counterparty-classification.ts\`, \`sa-ccr/\` — \`ead.ts\`, \`pfe-addon.ts\`,
  \`replacement-cost.ts\`, \`compute-and-emit.ts\`); \`platform/accounting/ecl-engine.ts\` +
  \`ifrs9-staging.ts\`; SICR subscriber (\`platform/risk/sicr-subscriber.ts\`).
- **Data stores:** RwaComputed (event-of-record, D-RWA-ENGINE-W2-Slice-3 pattern),
  CcrEadComputed, CcrReplacementCostComputed, CounterpartyBaselClassAssigned
  (\`registry/counterparty-credit-risk.ts\`, \`registry/ifrs9-staging.ts\`); ECL staging
  events; \`platform/projections/rwa-from-positions.ts\`.
- **Seat:** Risk Engineer (Rohan); CRO seat (Helena) for classification approvals.
- **Ontology:** internal — CRE20 risk weights IMPLEMENTED_BY engine Capabilities; the SA↔BCBS
  **EQUIVALENT_TO / CONFLICTS_WITH** obligation-equivalence edges (obligation-divergence
  recon) are unique cross-jurisdiction bindings. External — FIBO BE/FBC counterparty and
  credit concepts; CDM trade representations as SA-CCR inputs; Basel taxonomy
  (D-BASEL-CATALOGUE-PILLAR-1, W1-foundational).
- **Classification:** shared model library; counterparty class *assignments* are tenant
  events.
- **Tier:** R.

### 6.3 Risk Appetite & Limit Management

- **BIAN:** no exact fit (BIAN scatters this across Credit Risk Operations and board
  governance); bespoke name retained — RAS-as-register is a v1 invention worth productising.
- **V1 modules:** \`platform/risk/ras-appetite-register.ts\` (single-source structured
  register: thresholds, measurementBinding, citations), \`ras-b2-calibration.ts\`,
  \`credit-limit-engine/\`, \`liquidity-limit-engine/\`, \`fx-gateway-thresholds.ts\`
  (enforcing); \`platform/risk/taxonomy.ts\`.
- **Data stores:** RasLineCalibrated (the template for all tenant config — already
  event-driven in v1), CreditLimit* and LiquidityLimitBreached/Disposed families
  (\`registry/credit-limit.ts\`, \`registry/liquidity-limit.ts\`); RAS register projection
  (parity-gated: \`ras-register-parity.ts\`).
- **Seat:** CRO seat (Helena) owns calibration authority; Risk Engineer (Rohan) the engines.
- **Ontology:** internal — RAS lines carry typed citations to Obligations and feeder
  Capabilities (ras-cluster-feeder-coverage recon asserts feeder wiring). External — FIBO
  risk-appetite concepts are thin; this domain is mostly internal-ontology-bound, which is
  fine: it is tenant-posture, not shared semantics.
- **Classification:** foundational core for engines and register mechanics; tenant-specific
  for every threshold number (the cleanest existing demonstration of the SAP clean-core
  translation: core = code, tenant = calibration events).
- **Tier:** R.

### 6.4 Asset & Liability Management

- **BIAN:** Asset And Liability Management (exact BIAN name).
- **V1 modules:** \`platform/alm/\` (\`eve.ts\`, \`nii.ts\`, \`repricing-gap.ts\`,
  \`intraday-stress.ts\`); \`platform/ftp/\` (\`curve.ts\`, \`attribution.ts\`,
  \`projection.ts\`); \`platform/alco/\`; BA330 IRRBB return (\`platform/returns/ba330\`,
  \`platform/reporting/ba-330-irrbb.ts\`).
- **Data stores:** FtpCurvePublished, FtpAttributionRecorded events; IRRBB ΔEVE projection
  (\`platform/projections/irrbb-delta-eve.ts\`), ALM positions projection; ALCO events
  (\`registry/alco.ts\`).
- **Seat:** Treasurer seat (Eitan) for governance; Treasury Engineer for the engines.
- **Ontology:** internal — IRRBB obligations DERIVES_FROM BCBS IRRBB standard via PA
  transposition (TRANSPOSES edges proven for PA→BCBS239); RAS irrbb-delta-eve line binds the
  measure. External — FIBO IND interest-rate concepts; CDM payout/schedule primitives as
  repricing inputs.
- **Classification:** shared model library (EVE/NII/repricing engines); tenant-specific for
  FTP curve calibrations and ALCO decisions.
- **Tier:** R.

### 6.5 Liquidity Risk & Funding

- **BIAN:** BIAN places this under Corporate Treasury; bespoke composite name because v1
  unifies LCR/NSFR computation, intraday metrics, and the CFP in one chain.
- **V1 modules:** \`platform/liquidity/\` (\`lcr.ts\`, \`nsfr.ts\`, \`projection.ts\`);
  \`platform/alm/cfp-ewi.ts\`, \`cfp-feed-adapters.ts\`, \`cfp-rehearsal-harness.ts\`,
  \`intraday-liquidity-metrics.ts\`; \`platform/reporting/hqla-stock.ts\`,
  \`ba-300-lcr.ts\`, \`ba-300-nsfr.ts\`; \`platform/ilaap/\`.
- **Data stores:** LCRComputed, NSFRComputed, IntradayLiquidityMetricsComputed,
  LcrRatioBreach, NsfrRatioBreach, LiquiditySnapshot events (\`registry/liquidity.ts\`,
  \`registry/intraday-liquidity.ts\`, \`registry/cfp-triggers.ts\`, \`registry/ilaap.ts\`);
  liquidity projection.
- **Seat:** Treasurer seat (Eitan); 7 CFP triggers + EWI recon ENFORCING (Treasurer Wave-1).
- **Ontology:** internal — LCR/NSFR obligations SERVES the PA's depositor-protection
  objectives (objective layer); CFP triggers cite RAS lines. External — BCBS 248 intraday
  metric definitions; ISO 20022 camt.052/053 as the intraday data source at licence-day;
  FIBO liquidity concepts thin.
- **Classification:** shared model library (the LCR/NSFR/intraday calculators); tenant CFP
  calibration and funding plans are tenant events.
- **Tier:** R.

### 6.6 Capital Adequacy & Stress Testing

- **BIAN:** nearest is Economic Capital; bespoke composite (ICAAP/ILAAP + stress + capital
  return assembly).
- **V1 modules:** \`platform/risk/stress-engine.ts\`, \`stress-scenarios.ts\`,
  \`pillar-2-addon.ts\`, \`icaap-narrative-data.ts\`; \`platform/ilaap/\`;
  BA700 (\`platform/returns/ba700\`, \`platform/reporting/ba-700-*.ts\` incl. leverage ratio);
  capital metrics projection (\`platform/projections/capital-metrics.ts\`,
  \`leverage-ratio-metrics.ts\`).
- **Data stores:** RwaComputed (event-of-record read by BA700 via
  readRwaDecompositionOfRecord), stress events; capital metrics projections.
- **Seat:** Risk Engineer (Rohan) engines; CRO seat (Helena) ICAAP ownership; CFO seat
  (Camille) capital-plan authority.
- **Ontology:** internal — output-floor and buffer constants are semantic-registry entries
  (\`platform/semantic/capital-entries.ts\`) citing provisions — a binding pattern unique to
  v1 worth productising. External — Basel III taxonomy; FIBO capital concepts.
- **Classification:** shared model library for engines and constants; tenant-specific for
  scenarios, ICAAP narrative, and capital plans.
- **Tier:** R.

### 6.7 Regulatory Reporting & Returns

- **BIAN:** Regulatory Reporting (BIAN name: Regulatory Reporting / "Regulatory & Legal
  Authority" area).
- **V1 modules:** \`platform/reporting/\` (BA100/110/120/200/210/300/320/330/400/700
  renderers + events-adapters + XML adapters, Excel-canonical schemas per
  D-BA-RETURN-NUMBERING-EXCEL-CANONICAL — a W1-foundational *lesson* decision);
  \`platform/returns/\` (per-return subscriber wiring incl. climate, cms, conduct,
  counterparty-exposure); \`platform/accounting/ba-return-trigger.ts\`.
- **Data stores:** BAReturnGenerationTriggered (\`registry/regulatory-reporting.ts\`);
  return projections; recon gates \`recon-ba-returns-vs-gl-balances.ts\`,
  \`ba-form-numbering.ts\`, \`recon-rwa-computed-sourcing.ts\`.
- **Seat:** Regulatory Reporting Engineer (v2 seat; today Mira, Compliance / RegTech
  engineer, carries it).
- **Ontology:** internal — **ReportingRequirement nodes and REQUIRES_REPORT edges bind
  return cells to Obligations**; every renderer cell traces to a provision (Principle 2).
  External — ISO 20022/XBRL for submission formats jurisdiction-by-jurisdiction; the
  XML adapters are the seam. FIBO reporting concepts thin.
- **Classification:** shared model library — renderers are per-jurisdiction shared assets
  (all SA tenants share BA renderers); submissions and sign-offs are tenant events.
- **Tier:** R.

### 6.8 Regulatory Knowledge & Obligation Management

- **BIAN:** Regulatory Compliance (BIAN name) — but v1's Plane A goes far beyond BIAN's
  conception; this is the **knowledge-tier product** and the backbone's most defensible
  asset.
- **V1 modules:** \`platform/regulatory/\` (instrument-store, structured-doc-loader,
  extract-quality scorer, obligation-linker, concept-extractor, basel-adoption,
  resolve-applicable-rule); \`platform/regulatory/graph/\` (ontology-schema, seed-projection,
  provision-tree, obligation-policy-fold, query layer); \`platform/obligations/\`;
  \`platform/forward-obligations/\`; the Regulations/ source corpus (155+ instruments,
  6 regulators with mandate/objective layers).
- **Data stores:** ObligationAdopted, ProvisionScopeAdopted (verbatimHash drift anchor),
  obligation lifecycle/review events (\`registry/obligation-lifecycle.ts\`,
  \`registry/obligation-review.ts\`, \`registry/obligation-equivalence.ts\`); graph.db
  seed-projection (Plane A is re-derivable reference data, not events — by design).
- **Seat:** Regulatory Knowledge Engineer (Mira); CCO seat (Zara) for obligation
  interpretation authority.
- **Ontology:** internal — this domain *owns* the ontology: 19 node types and 30+ edge types
  (\`platform/regulatory/graph/types.ts\`) — Provision, Obligation, RegulatoryObjective,
  Policy, Procedure, Capability nodes; DERIVES_FROM, IMPLEMENTED_BY, REALISES/REALISED_BY,
  SERVES, ALIGNS_TO, TRANSPOSES, EQUIVALENT_TO edges. The Plane-A/Plane-B seam (bank-agnostic
  reference vs tenant adoption) **is the shared/tenant boundary** for the whole backbone.
  External — FIBO as a published-ontology citation target for Term nodes; ISO 20022 not
  applicable; source-artifact-first discipline (extract-quality gates) is the product
  integrity requirement.
- **Classification:** shared reference knowledge (Plane A: one copy, all tenants;
  jurisdictions added once — D-OBLIGATION-DECOMPOSITION-PARAGRAPH-LEVEL and
  D-OBLIGATION-REVIEW-SUBSTRATE are W1-foundational anchors); tenant-specific for adoptions
  (ObligationAdopted is each tenant's regulatory posture).
- **Tier:** K — this domain *is* the knowledge tier, with obligation tooling and recon
  patterns.

### 6.9 Customer Due Diligence (KYC/AML)

- **BIAN:** Party Lifecycle Management / Customer Behavior Insights are nearest; we keep the
  regulator-legible bespoke name **Customer Due Diligence**.
- **V1 modules:** \`platform/kyc/\` (\`orchestrator.ts\`, \`risk-rating-engine.ts\`,
  \`screening-adapter.ts\`, \`adapters/\`); FIC obligations in Plane A.
- **Data stores:** KYCIdentityCollected, KYCEDDInitiated/Completed, KYCDecisionMade,
  ClientAccepted/Rejected, BeneficialOwnerChainAsserted events (\`registry/kyc.ts\`);
  KYC projections (\`platform/projections/kyc\`).
- **Seat:** CCO seat (Zara) — MLRO/FIC accountability at licence-day; Operations Engineer
  for the orchestration.
- **Ontology:** internal — EDD procedures DERIVES_FROM FIC Act obligations; screening
  Capabilities. External — FIBO BE beneficial-ownership concepts are a strong fit; ISO 20022
  party identification at the data edge; FATF recommendations as Plane-A source.
- **Classification:** foundational core for orchestration machinery; tenant-specific for
  risk-rating calibration and every decision. Largely **licence-day-activating** for the
  anchor tenant (Niko's lifecycle paused), but the machinery exists and is testable now.
- **Tier:** C.

### 6.10 Conduct & Market Surveillance

- **BIAN:** no BIAN service domain covers conduct surveillance; bespoke, justified.
- **V1 modules:** \`platform/conduct/\` (\`fx-trade-conduct-evaluation.ts\`,
  \`fx-conduct-surveillance-sweep.ts\`, \`fx-bestex-policy-schedule.ts\`,
  \`fx-counterparty-fais-classification.ts\`); conduct returns (\`platform/returns/conduct\`);
  \`platform/compliance/fsca-confirmation-report.ts\`.
- **Data stores:** conduct evaluation events (\`registry/conduct.ts\`),
  CounterpartyFaisClassified; suitability enforcement is fail-closed (2026-06-11 sweep).
- **Seat:** CCO seat (Zara); Regulatory Knowledge Engineer (Mira) for FAIS plane-A content.
- **Ontology:** internal — best-execution obligations DERIVES_FROM FAIS provisions;
  surveillance procedures REALISE sweep Capabilities. External — FIBO conduct concepts
  thin; ISO 20022 not applicable; FSCA/FAIS Plane-A sources.
- **Classification:** shared model library (evaluation rules per jurisdiction); tenant
  calibration and findings are tenant events.
- **Tier:** R.

## 7. Business Support business area (incl. bespoke platform domains)

### 7.1 Records & Document Management

- **BIAN:** Document Directory + Archive Services are the nearest BIAN names; v1's RMS is a
  superset (typed records with retention citations).
- **V1 modules:** \`platform/records/\` (recordFiled helpers, brief-router),
  \`platform/document-store/\` (BLAKE3 content-addressed store, resolve-document-store
  precedence), \`platform/rms-registers/\` (the seven projection-derived registers:
  decisions, correspondence, agent-runs, document, feedback, briefs-dispatches,
  workstreams), \`platform/register/\`.
- **Data stores:** RecordFiled, DocumentRegistered, Correspondence/Feedback event kinds
  (RMS Phase-1 seven); the registers are projections, never stored state (D-RMS-PHASE-4
  proved full markdown retirement). Recon: rms-documents-parity, rms-document-blob-integrity,
  retention-citation-coverage.
- **Seat:** Company Secretary seat (Owen); Substrate Architect (Atlas) for the store.
- **Ontology:** internal — every record carries typed citations (retention cites an
  obligation URN); Document nodes in the graph. External — none load-bearing; ISO 15489
  records-management alignment is a sales-deck note, not a binding.
- **Classification:** foundational core (D-RMS-PHASE-1..4 are the canonical W1-foundational
  arc); register *instances* per tenant.
- **Tier:** K (every tier needs records).

### 7.2 Decision Governance & Distillation

- **BIAN:** no fit (BIAN's Corporate Policies is about policy documents, not decision event
  lifecycles); bespoke, justified — this is the backbone's "constitution + case law"
  machinery.
- **V1 modules:** \`runtime/decisions/record.ts\` (recordDecision / requestDecision);
  \`platform/governance/decision-distillation/\` (register.ts, classifications.ts — the W1
  output: 258 classified decisions, 92 foundational); decision recon suite
  (\`decision-authority-routing.ts\`, \`decision-symmetry.ts\`, \`decision-distillation-
  coverage.ts\`, \`decision-id-hygiene.ts\`…).
- **Data stores:** Decision, DecisionRequested, DecisionComment events (CeoDecision
  deprecated alias); DecisionDistilled events
  (\`event-types/decision-distillation.ts\`) folding into the core-knowledge-base register.
- **Seat:** Company Secretary seat (Owen); decision-authority routing table maps categories
  to seats.
- **Ontology:** internal — decisions cite principles, obligations, and prior decisions;
  the distillation class (foundational/directional/obsolete) *is* the shared/tenant seam
  applied to governance history. External — none; deliberately internal.
- **Classification:** foundational core (D-DECISIONS-FRAMEWORK-REDESIGN is the W1 anchor);
  each tenant's directional decisions are its own; the foundational set ships as shared
  reference knowledge (the platform's case law).
- **Tier:** K.

### 7.3 Internal Audit & Continuous Assurance

- **BIAN:** Internal Audit (exact BIAN name) — realised as something BIAN never imagined:
  a mechanical, continuously-running recon harness.
- **V1 modules:** \`platform/recon/\` — 200+ standing pipelines (one file per gate; harness
  in \`harness.ts\`, types in \`types.ts\`; suites run via \`scripts/run-recon-suite.ts\`
  infra/domain); \`platform/recon/completeness\` (6-class completeness taxonomy);
  \`platform/recon/code-quality\`.
- **Data stores:** AuditFinding, AuditFindingClosed, AuditIssueOpened/Closed events
  (\`registry/cae-governance.ts\`); finding projections; the harness consumes *every* other
  domain's stores read-only — third-line independence expressed architecturally.
- **Seat:** Continuous Assurance Engineer (Vera), functionally reporting to the CAE seat
  (Thandiwe, Chief Audit Executive, governance).
- **Ontology:** internal — gates cite the Obligation/Policy they assert (CLOSES edges);
  completeness taxonomy classifies inertness. External — IIA IPPF alignment for the QAIP
  story; no data-standard binding.
- **Classification:** foundational core for the harness and generic gates; pipelines split —
  gates asserting tenant calibrations are tenant-bound instantiations of shared patterns
  (the recon *pattern library* is shared reference knowledge; D-COMPLETENESS-AUDIT-
  WORKSTREAM and D-CI-GATE-INTEGRITY are W1-foundational anchors).
- **Tier:** K — "are we compliant, right now, provably?" is the product's core promise at
  every tier.

### 7.4 Event Backbone & Tenant Composition

- **BIAN:** no fit (BIAN assumes the integration substrate; nearest is Systems Operations);
  bespoke, justified — this is the platform itself.
- **V1 modules:** \`platform/event-store/\` (store, partitioned-store, registry/ with ~90
  definition files and ~687 types, permission-gate, provenance-for-emit,
  resolve-event-db precedence chain, archive partitions); \`platform/composition.ts\`
  (today the single-bank factory; v2's tenant-composition-factory seam — W3's subject);
  \`platform/scheduler/\`, \`platform/event-trigger-bus/\`, \`platform/escalation/\`
  (decision-required surface), \`platform/observability/\`, \`platform/lifecycle/\`,
  \`platform/core/\`, \`platform/substrate/\`.
- **Data stores:** the store *is* the data store; own control events: SubstrateAlert,
  SubstrateAgentRunFailed, CitationGatePassed/Failed, DashboardProjectionRefreshed.
  Append-only and no-delete-callsite recon gates; SHA-verified archive partitions.
- **Seat:** Substrate Architect (Atlas).
- **Ontology:** internal — the envelope (today \`entity\` axis only; v2 adds \`tenant\` —
  orthogonal axes per Principle 5, W3's envelope proposal). External — CloudEvents as an
  interop wrapper is worth evaluating in v2; otherwise deliberately standard-free: the
  envelope is the product's own contract.
- **Classification:** foundational core — the densest cluster of W1-foundational decisions
  (D-EVENT-STORE-SCALING, D-EVENT-STORE-SELECTIVE-ARCHIVE-EXTRACTION,
  D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-DATA-PROVENANCE-SUBSTRATE slices,
  D-EVENT-VIEW-BOUNDARY-WIRE).
- **Tier:** K (it underlies every tier).

### 7.5 Agent Workforce & Dispatch

- **BIAN:** no fit — BIAN's landscape assumes a human workforce; bespoke, justified. This is
  the backbone's labour layer (Principle 6) and a category-defining product surface.
- **V1 modules:** \`platform/dispatch/\` (briefs, run lifecycle, sync primitive —
  \`sync-primitive-spec.md\`); \`platform/agent-runtime/\` (goal-loop, registry, bus runner,
  spec-parser, world-state); \`platform/agent-identity/\`, \`platform/agent-spec/\`,
  \`platform/agents/\`; Team/ operating specs (17-section template) +
  \`Team/_team-roster.json\`.
- **Data stores:** AgentBriefIssued, AgentRunStarted/AgentRunCompleted,
  AgentFeedbackIssued, AgentPerformanceEvaluated, BriefSuperseded events
  (\`registry/runtime.ts\`, \`registry/governance-seat-runs.ts\`); briefs/agent-runs RMS
  registers; dispatch-sync-integrity recon (reviewer→decider topology,
  D-DISPATCH-SYNC-PRIMITIVE).
- **Seat:** Substrate Architect (Atlas) for the substrate; AgentOps seat (Sade, reshaped)
  for fleet operations.
- **Ontology:** internal — agent Party kind; seat specs as Procedure/Capability bundles;
  run events cite briefs cite decisions (a complete provenance chain unique to v1).
  External — none exist for agent workforces; this is where the platform *sets* the
  standard. Cross-tenant seat memory (ideas-paper §3.1) lives here.
- **Classification:** foundational core for the substrate; tenant-specific for seat
  activation, calibration, and tenant memory (the core/tenant memory split is the W3-adjacent
  design problem).
- **Tier:** C (the full agent workforce); R-tier gets the assurance/reporting seats only.

### 7.6 Data Semantics & Provenance

- **BIAN:** nearest is Information Provision / enterprise-data-management practice (DCAM is
  the EDM Council's framework, not BIAN's); bespoke composite.
- **V1 modules:** \`platform/semantic/\` (registry + typed entries: capital, liquidity,
  market-risk, op-risk, risk-weight, IFRS classification — constants-as-citable-entries);
  \`platform/taxonomies/dcam\`; \`platform/semantic-layer/\`; provenance machinery in
  \`platform/event-store/\` (provenance-for-emit, provenance-category) + provenance recon
  family (\`provenance-emit-discipline.ts\`, \`provenance-lineage-registered.ts\`,
  \`extraction-provenance.ts\`).
- **Data stores:** DataProjectionSnapshot; provenance tags on every emitted event;
  semantic-registry-coverage recon.
- **Seat:** Data Engineer (Anya).
- **Ontology:** internal — semantic entries cite provisions (the "no silent constants" rule:
  \`calc-no-silent-zero.ts\`, \`financial-constants-coverage.ts\`, \`basel-constants-
  coverage.ts\`). External — **DCAM** as the data-management capability frame (D-DCAM,
  W1-foundational); the ACTUS mapping (\`platform/markets/cdm/dcam-actus-mapping.ts\`)
  bridges DCAM↔CDM; FIBO as the long-term concept-URI target for semantic entries.
- **Classification:** foundational core (machinery) + shared reference knowledge (the
  entries themselves — Basel constants are jurisdiction facts, not tenant choices).
- **Tier:** K.

---

## 8. BIAN adoption-depth recommendation

Three candidate depths:

1. **Naming + boundaries only** — use BIAN service-domain names and business-area grouping
   as the catalogue vocabulary; keep v1's event-sourced internals untouched.
2. **Control-record alignment** — additionally map each domain's primary aggregate to the
   BIAN control record (e.g. Position Keeping's "Financial Position Log") and shape register
   APIs around BIAN behaviour qualifiers.
3. **Full service-operation contracts** — implement BIAN's
   Initiate/Update/Retrieve/Control semantic API contracts per domain.

**Recommendation: depth 1, applied selectively — confirming the session-1 working
hypothesis ("adopt the map, not the middleware") — with a deliberate, narrow depth-2 step
for at most three externally-facing domains, and an explicit rejection of depth 3.**

Specifics behind the recommendation:

- **The map fits well but not perfectly.** Of the 25 domains, 14 carry exact or near-exact
  BIAN names; 11 are justified bespoke (the event backbone, agent workforce, decision
  distillation, conduct surveillance, RAS-as-register, and composites where v1 unifies what
  BIAN splits). A 56% direct-fit rate is high enough that the BIAN vocabulary buys real
  legibility with subscriber-bank architects — "we subscribe to your Market Risk Models and
  Regulatory Reporting domains" is a sentence a bank EA can place on their own BIAN-coloured
  landscape map immediately — and low enough to prove that forcing 100% alignment would
  damage the architecture (nobody should shoehorn the agent-dispatch substrate into BIAN's
  human-workforce assumptions).
- **Depth 3 contradicts Principle 1.** BIAN service operations are request/response CRUD
  semantics over control records — mutable-state thinking. The backbone's contract is event
  streams in, projections out; wrapping that in Initiate/Update/Retrieve facades would
  reintroduce exactly the mutable-API surface the event-sourced design eliminates, doubling
  every domain's API surface for zero assurance gain. The recon harness cannot cite a BIAN
  service operation; it cites events and provisions.
- **Depth 2 has a narrow, real use:** at the **R-tier ingestion seam** (domain 6, Position
  Keeping; domain 4.1's trade-feed contract; domain 16's submission edge), subscriber banks
  will integrate from BIAN-modelled estates. Publishing a thin alignment note per seam
  domain — "our position-feed event contract corresponds to BIAN Position Keeping control
  record X; CDM trade representation is the payload standard" — costs days, not months, and
  removes a sales objection. Do this for Position Keeping, Payment Order & Execution, and
  Regulatory Reporting & Returns only.
- **The data standards inside domains do the semantic work BIAN cannot:** FINOS CDM for
  product/trade composition (already production in v1 via \`cdmComposition\` and
  \`platform/markets/cdm/\`), ISO 20022 for payment and statement messages (already
  production via pacs.008/pacs.009/camt.053 serialisers), FIBO as the concept vocabulary for
  party/instrument semantics (proposed, not yet code-bound — candidate v2 work item:
  FIBO URIs on Term and semantic-registry entries). BIAN's own BOM acknowledges these as
  payload standards; we simply skip the middleman.
- **Versioning note:** BIAN's landscape is versioned (v12+); pin the catalogue's BIAN
  vocabulary to a named landscape version in the v2 catalogue artefact, and treat BIAN
  version bumps as catalogue-relabel events, never as code changes.

## 9. Gap list — domains a subscriber bank expects that v1 has no asset for

Honest v2 roadmap items, with BIAN landscape placement. The pattern across all of them: the
*substrate* (events, graph, recon, agents) generalises; what is missing is the domain content
— event families, models, Plane-A obligations, and seat playbooks.

| # | Missing domain | BIAN placement | Notes |
|---|---|---|---|
| G1 | Lending / credit origination & servicing | Loans & Advances (Consumer Loan, Corporate Loan, Loan Origination, Credit Facility) | The largest gap. v1 has credit *risk* models but no loan product, origination workflow, or servicing lifecycle. NCA (SA) Plane-A content also absent (NCR noted low-value in v1 — wrong for a lending tenant). |
| G2 | Deposit products at scale | Deposits (Current Account, Savings Account, Term Deposit) | v1 has bank *accounts* as GL/nostro constructs, not retail/commercial deposit products with interest schedules, statements, dormancy. |
| G3 | Customer channels & onboarding | Channels (Contact Centre, Digital Banking, Branch) + Party Lifecycle | No customer-facing surface exists at all; Niko's lifecycle is paused until licence-day and covers onboarding policy, not channel software. |
| G4 | Card issuing & acquiring | Cards (Card Issuance, Card Transaction Switch, Merchant Acquiring) | Nothing in v1. Scheme certification (Visa/MC) is wall-clock-bound work no agent cadence compresses. |
| G5 | Collections & recoveries | Loans & Advances (Collections, Recoveries) | Downstream of G1. |
| G6 | Fraud detection & resolution | Risk & Compliance (Fraud Detection, Fraud Resolution) | v1's surveillance is conduct-side (FAIS best-ex), not transaction-fraud. |
| G7 | Trade finance | Trade Banking (Letter of Credit, Guarantee Administration) | Nothing in v1. |
| G8 | Custody & securities services at scale | Investment Management (Custody Administration) | v1 settles its own trades; no client custody. |
| G9 | Payments scheme participation | Payments (clearing-house gateways: SAMOS/RTC/PayShap for SA) | v1 has ISO 20022 serialisers and correspondent rails, not scheme membership integrations — licence-day-bound. |
| G10 | HR / payroll | Business Support (HR Management) | Deliberately deferred to licence-day for the anchor tenant (statutory-minimum humans); a subscriber with thousands of employees needs it or integrates an HRIS. Sade's AgentOps reshape covers the agent workforce, not humans. |
| G11 | Procurement & vendor management | Business Support (Procurement) | Vendor-security NPA dimension exists; procurement lifecycle does not. |
| G12 | Treasury dealing (external funding execution) | Treasury (Corporate Treasury dealing) | v1 plans funding (CFP, funding-plan approvals) but has no money-market dealing execution beyond repo/MMD event stubs (\`registry/repo-mmd-ibl.ts\`). |

Tier impact: none of G1–G12 blocks the **K** or **R** tiers — they bind only the
comprehensive tier's claim to be a full core-banking replacement for retail/commercial
banks. The honest v2 sequencing is: sell K and R on what exists; build G1/G2/G3 against the
anchor tenant's licence-day needs; treat G4–G12 as demand-driven.

## 10. Closing observations for W3 and the catalogue

1. **The classification column is remarkably regular.** Almost every domain decomposes as
   *machinery = foundational core; regulation-derived calculation = shared model library;
   regulation itself = shared reference knowledge; calibration + instances = tenant events*.
   That regularity is the strongest evidence yet for the ideas-paper's claim that the
   events-first architecture makes the SAP clean-core doctrine structurally enforceable: the
   seam already runs through every domain in the same place.
2. **Two seat gaps surfaced mechanically:** Operations Engineer (payments/settlement) and
   Trading Systems Engineer / Regulatory Reporting Engineer exist in the v2 seat catalogue
   but map to no dedicated v1 persona — Rohan and Mira carry them as side-loads. Input to
   the seat-catalogue workstream.
3. **For W3:** the per-domain data-store ownership table above is effectively the
   partitioning spec for tenancy Option C — each domain's owned event families are the unit
   at which a tenant-composition factory activates capability; the envelope's tenant axis
   must be orthogonal to \`entity\` in every one of the 25 domains (Principle 5).

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W2 deliverable of the
v2 structural analysis under D-V2-BBAAS-W2-W3-DISPATCH.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W2-W3-DISPATCH"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W2 domain map: BIAN-aligned domains, data-store ownership, ontology bindings",
      path: "2026-06-12_atlas_v2-bbaas-w2-domain-map.md",
      category: "strategy-analysis",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
