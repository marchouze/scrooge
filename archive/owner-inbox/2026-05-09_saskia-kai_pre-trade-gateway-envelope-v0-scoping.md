---
title: Pre-trade gateway envelope v0 — scoping brief
author: Saskia + Kai
date: 2026-05-09
summary: Scopes the v0 envelope of pre-trade checks every order traverses before it reaches an exchange or counterparty. Names the cross-persona dependencies, the event-type surface, the substrate gaps, and the open questions Marc must adjudicate before code lands. This is the brief, not the gateway.
decision-required: false
for-input-from: Mira, Rohan, Eitan, Senna, Helena, Imani
---

# Pre-trade gateway envelope v0 — scoping brief

**Authors:** Saskia (Head of Global Markets — franchise & governance) · Kai (trading systems engineer — implementation)
**Date:** 2026-05-09
**For:** Marc (CEO), with explicit input requested from Mira, Rohan, Eitan, Senna, Helena, Imani.
**Authority:**
- S7-Targeted critical path, item #5 — `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2.
- Pre-trade gateway is **co-owned Kai + Rohan; non-bypassable** — `Team/Kai.md` §12 (`@platform/markets/pre-trade-gateway`), §10 (override-request escalation), §15 (architectural non-bypassability).
- Saskia's franchise design — `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §1 (institutional-only universe; ZARONIA-aligned IRD; agency-at-outset on equities; market-making on cash bonds and IRD).
- Trading-system architecture — `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §6 (lifecycle event model — pre-trade events sit *before* `TradeProposed` / `TradeExecuted`).
- D-A22-RETIRE-LEGACY Phase 1 — bus-canonical runtime is the dispatch substrate the gateway lands on (`Owner Inbox/2026-05-09_atlas_a22-dispatcher-retire-legacy-spec.md`).
- Principles 1 (events-as-truth), 2 (atomic citations), 5 (multi-currency / -entity / -jurisdiction), 6 (single-graph), 7 (autonomous-by-default).

**Status:** Specification only — *no build*. This brief scopes the v0 envelope, names dependencies, and surfaces open questions. Code lands under a follow-on slice once the open §6 questions are adjudicated.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it specifies the deterministic check chain that every order must traverse before becoming a trade, and the typed-event surface the chain emits. It cites the franchise design, the trading-system architecture, the substrate-completeness budget, and the obligations register's domain entries; it does not author principle-level substance.

---

## 1. What the pre-trade gateway envelope is

The pre-trade gateway is the **deterministic, ordered chain of checks every order traverses before it leaves the bank's perimeter**. It sits between the upstream order-source (sales agent, market-making engine, internal client like the Treasurer's HQLA turnover) and the downstream execution surface (JSE FIX gateway, OTC counterparty FIX session, RFQ response). Architecturally:

- **Non-bypassable.** Per `Team/Kai.md` §15 — Kai cannot disable the gateway without a `PreTradeLimitChanged` event present, and Rohan cannot raise limits without Saskia's RAS-envelope citation. Bypass attempts are Wave-4 audit findings (Vera).
- **Deterministic.** Same order in, same decision out. The gateway is a function of `(order, fleet-state, registers, limits)` to `{approved | rejected[reason]}`. Not opinion-driven.
- **Event-emitting.** Every check emits a typed event (Principle 1). Every rejection carries a typed reason payload (Principle 2: cited to the rule that produced the rejection). Every approval carries the citation chain back to the limits / mandates / policies it was checked against.
- **Composable.** v0 lands the *shape* of the envelope — the dispatch chain, the aggregation rule, the typed-reason taxonomy, the rejection-event surface. Later versions deepen each individual check. The shape is load-bearing; depth is iterative.

The "envelope" is the v0 set of checks. We expect the set to grow (call this v0 a *minimum-credible* envelope for pre-licence rehearsal) but every later expansion is an addition to the same dispatch chain — not a new gateway.

**Saskia's note.** The franchise will be judged at licence-day on whether a counterparty can submit an order and the bank can reject it for the right reason at the right speed. The right reason is "your trade fails this specific limit, here is the citation." The right speed is fast enough not to lose the trade to a competitor and slow enough to mean it. v0 is the rehearsal of that posture.

**Kai's note.** The gateway is engineered as a fan-out / aggregate over the bus-canonical runtime — the dispatch substrate D-A22-RETIRE-LEGACY Phase 1 just landed. Each check is a registered handler. The gateway aggregates handler results under a typed aggregation rule (any `reject` → reject; all `approve` → approve; `timeout` → typed default per §6 question Q2). The architecture is not novel — it is the same pattern as the recon harness, applied to a wire path with a latency budget.

---

## 2. The v0 check list

The envelope's v0 check set is **ten checks**, in the order the gateway dispatches them. Each row names the check, the persona who owns the rule (and so the substrate the check calls), the citation under which the check exists, and the failure mode.

| # | Check | Owner (rule) | Owner (substrate) | Citation | Failure mode |
|---|---|---|---|---|---|
| 1 | **Identity & authorisation** | Senna | Senna (A1.2 identity issuer) | Principle 4 (zero trust + least privilege); A1.2 permission-policy register | `Rejected: identity` — agent / human placing the order does not hold the role + capability that the order requires |
| 2 | **Client suitability** | Mira (FAIS conduct) | Mira + Niko (post-licence) | FAIS Act 37 of 2002; FSCA Conduct Standards on advice / intermediary services; **strategic-foundation institutional-only constraint** (`Owner Inbox/2026-05-06_strategic-foundation.md`); `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §1 | `Rejected: client-suitability` — counterparty is not an institutional client, or product is outside the counterparty's profile, or counterparty's onboarding records are incomplete |
| 3 | **Sanctions & PEP screening** | Mira | Mira (sanctions service substrate, planned) | FIC Act 38 of 2001 ss.21–28 (CDD / EDD / sanctions); Sanctions screening procedure (`Procedures/by-policy/sanctions-screening.md`, planned); UN / OFAC / EU consolidated lists | `Rejected: sanctions` (hard) / `Rejected: pep-review` (soft, escalated) — counterparty / underlier / payment route hits a sanctioned name, or a PEP requires escalation |
| 4 | **Pre-deal credit envelope** | Rohan / Helena | Rohan (pre-deal credit-engine substrate, planned) | RAS § B-credit (calibrated dealer mandates); SA-CCR (BCBS d349); Helena's credit framework | `Rejected: credit-limit` — proposed deal exceeds counterparty pre-deal credit envelope, or insufficient headroom under the dealer mandate |
| 5 | **Market-risk envelope** | Rohan / Helena | Rohan (market-risk projection, under build by Anya / Rohan) | RAS § B-market (sensitivity limits); FRTB SA-MR; dealer mandate working register | `Rejected: market-risk` — trade pushes a sensitivity (delta / gamma / vega / curve / basis) outside the dealer mandate's working numbers |
| 6 | **Funding / liquidity envelope** | Eitan | Eitan + Ravi (funding-envelope API, planned) | LCR / NSFR (BCBS BA325/326); ILAAP; SA Treasurer funding plan; FTP attribution methodology (planned per `ftp-attachment-on-product-event.md`) | `Rejected: funding` — bank cannot fund the trade without breaching LCR / NSFR; or repo financing path unavailable |
| 7 | **Legal-entity routing** | Imani | Imani (legal-entity tree, planned) | Principle 5 (multi-entity by construction); ECTA execution rules; ISDA Master / GMRA jurisdiction matrix | `Rejected: entity-routing` — no legal entity in the bank's tree is permitted to book this trade against this counterparty in this jurisdiction; or the required ISDA / GMRA / GMSLA is not in place |
| 8 | **Operational gate** | Kai | Kai (OMS / EMS health monitor) | JSE rulebook on market-state; SA market-hours; FX-cutoff calendar; system-health SLAs | `Rejected: ops-state` — market closed, FX cutoff passed for the currency leg, OMS / EMS in degraded state, exchange connectivity down |
| 9 | **Capital-impact estimate** | Rohan / Camille | Rohan (RWA delta engine, planned) | RAS § B-capital; BCBS market-risk capital framework (FRTB); BCBS CCR / SA-CCR | `Rejected: capital-headroom` — pre-deal RWA delta breaches RAS § B-capital headroom, or the franchise's allocated capital line is exhausted |
| 10 | **Surveillance flag** | Mira / Saskia | Mira (surveillance feed substrate, partial) | FMA Ch. VIII (market abuse); FSCA market-abuse regulations; insider-list register; Mira's surveillance-typology catalogue | `Rejected: surveillance` (hard) / `Flagged: surveillance` (soft, post-trade review) — pre-trade pattern matches a market-abuse typology (front-running, layering, spoofing, wash-trade, insider-list collision) |

**Ordering rationale.** Cheap and orthogonal checks first; expensive and stateful checks last. Identity is constant-time. Sanctions is an in-memory lookup. Credit is a register read. Market-risk requires evaluating the trade against the live position projection. Capital impact requires running the RWA delta engine. Surveillance is the most context-rich and runs last.

**Saskia's note on suitability (#2).** The franchise's strategic foundation is **institutional-only** at outset (`Owner Inbox/2026-05-06_strategic-foundation.md`; `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` §1). At licence-day the suitability check is "is this counterparty an institutional client of record." Pre-licence, the suitability check has nothing to query against — Niko's onboarding lifecycle activates at licence-day per CLAUDE.md operating-model section. This is a substrate gap, not a check we omit; v0 includes the check with a `Rejected: suitability-no-record` reason that gates everything until Niko's records exist.

**Kai's note on operational gate (#8).** SA market-hours awareness and FX-cutoff awareness are **calendar-data**, not engineering decisions. The gate consumes Anya's calendar substrate (planned) and dispatches the right rejection reason when the calendar says the venue is closed. The OMS / EMS health monitor is engineering; the calendar is a register read.

---

## 3. Architecture sketch

The gateway runs on the bus-canonical runtime (D-A22-RETIRE-LEGACY Phase 1, landed 2026-05-08). The dispatch chain is:

```
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  Upstream order-source                                                   │
   │  ─ Sales agent (RFQ response) · Market-making engine · Internal client   │
   │  ─ Treasurer HQLA turnover · Saskia auto-quote                           │
   └─────────────────────────────┬────────────────────────────────────────────┘
                                 │ emits
                                 ▼
                    ┌────────────────────────────┐
                    │   OrderProposed (event)    │
                    │   • orderId (correlation)  │
                    │   • counterparty (LEI)     │
                    │   • instrument (CDM)       │
                    │   • side / qty / price     │
                    │   • bookingEntity          │
                    │   • requestedActor         │
                    │   • citation slot          │
                    └─────────────┬──────────────┘
                                  │ Pre-trade gateway picks up
                                  │ Bus-canonical fan-out
                                  ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │  GatewayCheckRequested events (10× — one per check, all in parallel)    │
   │  ─ Each handler subscribes to its own check via @platform/runtime/bus    │
   │  ─ Each handler emits a typed GatewayCheckCompleted result event         │
   │  ─ Permission-policy gate scopes each handler to its own check stream    │
   └──────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                  ┌─────────────────────────────────┐
                  │ Aggregator (Kai-owned)          │
                  │ • collects K of K check results │
                  │ • applies aggregation rule:     │
                  │   any reject → reject           │
                  │   all approve → approve         │
                  │   timeout → §6 Q2 default       │
                  └─────────────────────────────────┘
                                  │
                ┌─────────────────┴────────────────┐
                ▼                                  ▼
  ┌─────────────────────────┐         ┌──────────────────────────┐
  │ OrderApprovedAtGateway  │         │ OrderRejectedAtGateway   │
  │ • orderId               │         │ • orderId                │
  │ • approvalCitations[]   │         │ • rejectionReason (typed)│
  │ • passedAt              │         │ • rejectingCheck         │
  │ • next: route to OMS    │         │ • citationToRule         │
  └─────────────────────────┘         │ • next: do NOT route     │
              │                       └──────────────────────────┘
              ▼
   ┌──────────────────────────────┐
   │ OMS / EMS routing (Kai)      │
   │ → JSE FIX or OTC FIX session │
   │ → emits TradeProposed when   │
   │   counterparty acknowledges  │
   │   per architecture §6        │
   └──────────────────────────────┘
```

**Kai's note on dispatch.** Each check handler is a separately-registered runtime handler under `runtime/handlers-metadata.ts`. Per A1.2 permission-policy, each handler's identity scopes its event-stream access — `pretrade-credit-check` cannot read sanctions events, `pretrade-sanctions-check` cannot read credit events. This is not over-engineering; it is Principle 4 (zero trust + least privilege) applied to internal handlers, and it is what allows Vera to test the chain for cross-contamination as a single recon pipeline.

**Saskia's note on the rejection event.** Every `OrderRejectedAtGateway` event is a *first-class business event*. The desk needs to see them in the dashboard, the surveillance feed needs to consume them, the soft-franchise pipeline (Niko + Imani) needs to know if a counterparty's orders are getting rejected for documentation gaps so we can fix the documentation. Rejections are not failures to suppress — they are signal.

**Latency budget.** Per `Team/Kai.md` §7, pre-trade gateway evaluation must complete within **50ms**, routing decision within 200ms. With 10 parallel checks on the bus, the binding constraint is the slowest check (capital-impact estimate is currently the candidate). v0 lands the dispatch surface; latency tuning is iterative.

---

## 4. What each persona owes the gateway

Each check has two ownership lines: who owns the **rule** the check enforces, and who owns the **substrate** the check calls. Below names the deliverable each persona owes the gateway before v0 lands.

### 4.1 Mira (CCO engineering — sanctions, suitability, surveillance)

- **Sanctions service contract.** A typed API contract for `GET /sanctions/screen?name=...&dob=...&jurisdiction=...` returning a typed match-result with confidence score and matched-list reference (UN / OFAC / EU / FIC). v0 wires against a stub returning `no-match` for unknown names; production wires against the live sanctions provider when the substrate lands.
- **Surveillance pre-trade typology catalogue.** The set of patterns the surveillance check evaluates against — front-running, layering, spoofing, wash-trade, insider-list collision. v0 lands the catalogue *shape* with a single typology (insider-list collision); the rest follow as Mira builds them.
- **Suitability rule register.** The rule that defines "institutional client of record." v0 simplifies to `counterparty.classification == "institutional"` against Niko's (post-licence) record store.
- **Citation coverage.** Every rejection emitted by a Mira-owned check carries a citation to FIC / FAIS / FMA / FSCA Conduct Standards.

### 4.2 Rohan (CRO engineering — credit, market-risk, capital-impact)

- **Pre-deal credit-limit API.** Synchronous, typed, reads the counterparty pre-deal credit envelope and returns headroom. Per `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2 item #4 (backtest harness), this is gated on the model-validation discipline. v0 wires against a stub credit envelope keyed on counterparty LEI.
- **Pre-deal market-risk API.** Computes the trade's sensitivities against the live position projection (Anya's substrate) and tests against the dealer mandate working numbers (Helena's substrate). v0 covers delta + curve sensitivity for the M1 product set (equities); deepens with M2 (bonds) and M3 (IRS).
- **Pre-deal RWA delta engine.** Computes the trade's incremental RWA per FRTB SA-MR or BCBS SA-CCR and tests against RAS § B-capital headroom. v0 is approximate; full implementation lands in M5 (`Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §10).
- **Tier classification on the gateway model.** Per Nadia's methodology (`Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §4.2 item #3), the credit-limit and market-risk engines are themselves models requiring tiering and validation. v0 declares the gateway models as Tier-2 / Tier-3 and routes through the model registry.

### 4.3 Eitan (Treasurer — funding / liquidity)

- **Funding-envelope API.** Synchronous, typed, returns LCR / NSFR headroom for the proposed trade's funding profile. Reads from Ravi's ALM substrate. v0 wires against a stub envelope keyed on currency + tenor.
- **FTP attachment methodology.** Per `Procedures/by-policy/ftp-attachment-on-product-event.md` (planned), every product event carries an FTP citation. The gateway check validates the citation slot is populated; full FTP cost computation lands at M2 (when bonds + repo turn on FTP-aware HQLA financing).
- **HQLA classification on the trade.** For trades where the bank is buying a security, returns whether the security is HQLA-eligible and at what haircut. Drives the funding decision.

### 4.4 Imani (legal-as-code engineering — entity routing)

- **Legal-entity tree.** Per Principle 5 (multi-entity by construction), the bank's legal-entity tree is the register that says *which entity may book this trade*. Today the tree is a single SA entity; v0 wires against a tree-of-one but the API shape supports plural entities from day one.
- **Documentation-status register.** For each `(counterparty, product-family)` pair, the register says whether the master agreement (ISDA / GMRA / GMSLA) is in place, in negotiation, or absent. The gateway rejects orders where documentation is absent and an exception isn't registered.
- **Jurisdiction matrix.** For each `(counterparty-jurisdiction, bank-entity-jurisdiction, product)` triple, the register says whether trading is permitted under the matrix of cross-border rules (Excon, FATCA / CRS classification, EMIR equivalence considerations). v0 wires against a one-jurisdiction stub.

### 4.5 Senna (security engineering — identity & authorisation)

- **Identity gate.** The first check in the chain. Reads the requesting actor's identity (A1.2 identity issuer) and verifies the actor holds the role + capability the order requires. v0 wires against the live A1.2 issuer; permission-policy enforcement gate (`BANK_PERMISSION_GATE_ENABLED`) is feature-flagged off (`Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §6.2) but the gateway treats it as advisory in v0 and hard in v1.
- **Threat model.** Per Principle 4, every new event type and every new API contract goes through threat modelling. Senna + Rashida own the threat model gate for the ten new event types and the gateway's external-facing surface (the inbound order ingress and the outbound rejection surface).

### 4.6 Helena (CRO governance — appetite-line authority)

- **RAS-envelope citation contract.** Helena's RAS § B-market, § B-credit, § B-capital are the appetite lines the gateway tests against. The contract Helena owes the gateway is the typed reference to the current calibrated working numbers (which dealer mandates encode), and the change-event protocol when the RAS recalibrates.
- **Approval authority on `PreTradeLimitChanged`.** Per `Team/Kai.md` §15, Kai cannot disable the gateway and Rohan cannot raise limits without Saskia citing Helena's RAS envelope. Helena's authority is the appetite line; Saskia's is the franchise scope; Rohan's is the engine; Kai's is the substrate.

### 4.7 Saskia (front-office governance — franchise scope, conduct, mandate)

- **Mandate envelope citations.** Every dealer-mandate working number cited by the market-risk check resolves to a register entry maintained by Saskia + Helena + Rohan jointly (`Procedures/by-policy/dealer-mandate-issuance.md`, planned).
- **Surveillance posture authority.** Saskia + Mira jointly own the pre-trade-conduct gate procedure (`Procedures/by-policy/pre-trade-conduct-gate.md`, planned). The procedure defines which surveillance flags hard-reject vs. soft-flag-for-review.
- **Approval of v0 envelope scope.** Saskia signs the franchise-scope side of the v0 envelope (which counterparties, which products, which posture); Marc signs the CEO side per §6 Q3.

---

## 5. Substrate gaps surfaced

The brief surfaces the gaps that block a fully-autonomous v0 gateway today. Each gap is a roadmap item — not something to hide. The §6 questions and the §7 sequencing recommendation flow from this list.

### 5.1 Event-type registry gaps

The following event types **do not exist today** in `prototype/platform/event-store/event-types.ts` (verified 2026-05-09):

- `OrderProposed`
- `GatewayCheckRequested`
- `GatewayCheckCompleted`
- `OrderApprovedAtGateway`
- `OrderRejectedAtGateway`
- `PreTradeLimitChanged` (named in `Team/Kai.md` §11 — registered as planned, not yet appended)

Owner: Kai (with Atlas substrate review, Senna + Rashida threat-model gate). Slice size: small — a single PR adding the six event types under the markets-events module per A0 schema-freeze discipline (`Owner Inbox/2026-05-07_atlas-kai_a0-event-schema-freeze.md`). Lands as the first slice of v0 build.

### 5.2 Substrate gaps for individual checks

| Check | Gap | Owner | Workaround for v0 |
|---|---|---|---|
| #1 Identity | A1.2 identity issuer is live; permission-policy enforcement gate feature-flagged off | Senna | v0 wires against live issuer; treats permission-policy as advisory until gate flips |
| #2 Suitability | No institutional-client onboarding records (Niko activates at licence-day) | Niko (post-licence) | v0 wires against synthetic counterparty register; rejects with `suitability-no-record` for unknown counterparties |
| #3 Sanctions | Sanctions service substrate not built | Mira | v0 wires against stub returning `no-match`; flagged to v1 |
| #4 Credit | Pre-deal credit engine not built | Rohan | v0 wires against stub envelope keyed on LEI |
| #5 Market-risk | Position / risk projection under build (Anya / Rohan); dealer mandate register partial | Rohan + Anya + Saskia | v0 covers delta only; v1 deepens |
| #6 Funding | Funding-envelope API not built; FTP methodology planned | Eitan + Ravi | v0 wires against stub envelope |
| #7 Entity routing | Legal-entity tree is tree-of-one; documentation-status register partial | Imani | v0 wires against tree-of-one; documentation register stub |
| #8 Operational | Calendar substrate planned (Anya) | Kai + Anya | v0 hard-codes SA market-hours; v1 reads calendar |
| #9 Capital-impact | RWA delta engine planned (M5 in trading-system architecture) | Rohan + Camille | v0 emits `unknown-rwa` and routes to soft-flag; v1 wires when M5 lands |
| #10 Surveillance | Surveillance feed partial; insider-list register pending; typology catalogue under build | Mira + Saskia | v0 covers insider-list collision only; v1 expands typology coverage |

### 5.3 Cross-cutting substrate gaps

- **Bus-canonical runtime parallel-dispatch divergence** — Vera Wave-4 #13 (`parallel-dispatch-divergence` recon) is ahead of the gateway in the S7-Targeted ordering for exactly this reason: the gateway's correctness depends on the bus-canonical dispatch being demonstrably divergence-free under load. Owner: Vera. Closure: precedes gateway slice 1.
- **Token-spend dashboard surface** — gap `New-T1` in `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §2.4. Lands before or alongside the gateway slice.
- **Citation-gate coverage of the new event types** — the citation gate (`@platform/citation/gate`) must be extended to cover the six new event types so every emission carries the rule it cites. Slice size: small. Owner: Atlas + Vera.
- **Vera recon pipeline for gateway integrity** — independent recon that walks the gateway event chain and asserts: (a) every `OrderProposed` either resolves to `OrderApprovedAtGateway` or `OrderRejectedAtGateway` (no orphans); (b) every `OrderApprovedAtGateway` is preceded by 10× `GatewayCheckCompleted: approve` events; (c) no order routes to OMS without an `OrderApprovedAtGateway`. Owner: Vera. Slice size: medium. Lands after v0 substrate.

---

## 6. Open questions for Marc

These are the questions the brief surfaces that need CEO adjudication before v0 code lands. Each carries a Saskia + Kai recommendation but is not pre-decided.

### Q1 — Hard reject vs soft warn for borderline checks

For the "soft" failure modes named in §2 (PEP-review, surveillance soft-flag, capital-impact `unknown-rwa`), does v0 enforce **hard reject** (the order does not reach the venue) or **soft warn** (the order is flagged, escalated to a human / Saskia, and proceeds if approved within a deadline)?

- **Saskia's recommendation:** hard reject for sanctions, suitability, identity, entity-routing, market-risk, credit, funding. Soft-flag with mandatory human ack within 30 seconds for capital-impact `unknown-rwa`, surveillance soft-flags, and PEP-review. Rationale: the franchise's reputation is built on rejecting trades for the right reason, not on letting a trade through because the engine wasn't sure.
- **Kai's recommendation:** the gateway's *architecture* is hard-reject by default; soft-flag is a configurable overlay per typed reason, recorded in a register Helena owns. v0 carries the overlay; the default for every check on day one is hard-reject; relaxations are explicit register entries with citations.

### Q2 — Synchronous (block-on-every-check) vs asynchronous (timeout-with-default)

If a check handler does not respond within the latency budget, does the gateway **block** (wait for the response, breaking the 50ms SLA) or **timeout-with-default** (proceed with a typed `timeout-default` reason)?

- **Saskia's recommendation:** synchronous within budget; on timeout, the default is *reject* (`Rejected: timeout-{check-name}`). The bank does not approve a trade because a check did not respond. This is the safer side of the failure mode.
- **Kai's recommendation:** synchronous with a per-check timeout (default 25ms; identity is faster, capital-impact is slower); on timeout, `Rejected: timeout-{check-name}` per Saskia's recommendation. Engineering can tune per-check timeouts as we measure.

### Q3 — Asset-class scope for v0

Does v0 cover **all three asset classes** (JSE bonds, JSE equities, OTC IRD per the strategic foundation), or **start with one** (Saskia + Kai's recommended phasing aligns with M1 = listed equities, M2 = bonds + repo, M3 = IRS)?

- **Saskia's recommendation:** start with **JSE listed equities only** (M1 alignment). The franchise's first trade at licence-day will be an equity trade per the agency-at-outset posture. v1 deepens; v0 is the rehearsal.
- **Kai's recommendation:** match M-phase. v0 = equities (M1); v1 = bonds + repo (M2); v2 = IRS (M3). This aligns the gateway depth with the CDM bindings depth and prevents the gateway from being more sophisticated than the trade it gates.

### Q4 — Human-in-the-loop carve-outs

For which exception classes is a human-in-the-loop **required** (vs. typed-agent-decision)? Candidates: PEP escalations, sanctions soft-matches, mandate-breach pre-deal escalation, surveillance hard-flag, override of a hard-reject.

- **Saskia's recommendation:** four cases require human-in-the-loop in v0 — sanctions soft-match (Mira / Zara), surveillance hard-flag (Mira / Zara / Saskia), pre-deal mandate-breach escalation (Helena), override of any hard-reject (CEO via Scrooge per `AgentEscalation`). PEP escalation is a typed agent decision once Mira's PEP review substrate lands; pre-substrate, escalates to Mira.
- **Kai's recommendation:** every human-in-the-loop step is a typed `AgentEscalation` event with the typed escalation channel (Wave-4 #14). v0 supports the four cases above; the substrate is the same; only the routing differs.

### Q5 — Override-path discipline (gateway non-bypassability)

`Team/Kai.md` §10 already names a gateway-override request as an `AgentEscalation` to Rohan + Helena + CEO; §15 states the gateway is non-bypassable by default. The question for v0: is there **any** v0 path that allows an override, or does v0 land *without* override capability and override lands in v1?

- **Saskia's recommendation:** v0 lands **without** override capability. The hard-reject is hard. If the desk needs an override path before v1, that is itself an `AgentEscalation` to the CEO and lands as a follow-on procedure with its own controls. Easier to ship a non-bypassable gateway and add controlled overrides than to ship overrides and tighten them.
- **Kai's recommendation:** agreed. The override path is a separate substrate slice. v0's `OrderRejectedAtGateway` events are terminal for the order; if the desk wants the same trade through, the desk re-submits a *new* order that addresses the rejection reason (different size, different counterparty, different leg-routing). This is clean and auditable.

---

## 7. Recommendation for sequencing

The v0 envelope lands in seven slices. Each slice is bus-canonical, covered by recon, and individually shippable.

| # | Slice | Owner | Gates on |
|---|---|---|---|
| 1 | Six event types appended to `markets-events.ts`; citation-gate coverage; permission-policy entries for the six new event streams | Kai + Atlas + Senna | Vera Wave-4 #13 (parallel-dispatch-divergence) lands first per S7-Targeted ordering |
| 2 | Identity check + Sanctions check (handlers + stubs + dispatch wiring) | Senna (identity) + Mira (sanctions) | Slice 1 |
| 3 | Pre-deal credit envelope check (Tier-1 of Rohan's domain) | Rohan + Helena (RAS) | Slice 2; Nadia methodology spec (S7-Targeted item #3) |
| 4 | Market-risk envelope check + dealer-mandate working register read | Rohan + Anya + Saskia | Slice 3; backtest harness (S7-Targeted item #4) |
| 5 | Capital-impact estimate check (v0 approximation) | Rohan + Camille | Slice 4 |
| 6 | Funding / liquidity envelope check | Eitan + Ravi | Slice 5 |
| 7 | Surveillance flag check (insider-list collision typology only in v0) | Mira + Saskia | Slice 6 |

Entity-routing (#7 in the §2 check list) and operational gate (#8) are split across slices — entity-routing wires alongside slice 1 (the routing decision is a register read; substrate is Imani's tree); operational gate wires alongside slice 1 (calendar lookup is a register read; substrate is Anya's calendar).

**Saskia's note on the ordering.** Identity → Sanctions → Credit → Market-risk → Capital → Funding → Surveillance is the **minimum-credible** ordering for pre-licence rehearsal — the order in which a real institutional counterparty's order would be evaluated and rejected at a real bank. A trade rejected for sanctions before a credit-limit check is the right rejection to surface to the surveillance feed; a trade rejected for credit before the dealer-mandate check is the right rejection for the desk to fix. The ordering is not a UI choice; it is a discipline.

**Kai's note on slice independence.** Each slice is independently green-able under recon. Slice 1 lands without any check handler being live; the gateway just emits `OrderApprovedAtGateway` for every order in that interim state. Slice 2 lands the first two checks; the gateway is now meaningfully restrictive. Slice 7 lands the last check; the envelope is complete. Vera's gateway-integrity recon pipeline (§5.3) lands alongside slice 7 and asserts the whole chain is green.

**v0 does not equal complete.** v0 lands the *shape*. The depth of each individual check deepens iteratively as the substrate it depends on lands (Mira's sanctions service, Rohan's pre-deal credit engine, Anya's position projection, Eitan's funding-envelope API, Imani's legal-entity tree). v0's value is that it forces every persona to publish its check contract in production form before licence-day, and forces the bank to rehearse the full chain with the substrate it actually has rather than the substrate it wishes it had.

---

## 8. Procedure binding (Principle 6 — upward)

The v0 envelope binds to the following procedures, all of which exist or are planned:

- **`Procedures/by-policy/pre-trade-conduct-gate.md`** (planned) — co-owner Saskia + Mira / Zara. Defines the conduct-side rules the gateway enforces (suitability, sanctions, surveillance).
- **`Procedures/by-policy/pre-trade-gateway-governance.md`** (planned) — co-owner Kai + Rohan. Defines the engineering-side rules — non-bypassability, limit-change protocol, threshold tuning, escalation discipline.
- **`Procedures/by-policy/dealer-mandate-issuance.md`** (planned) — co-owner Saskia + Helena + Rohan. Defines how the dealer-mandate working numbers the market-risk check reads against are issued and amended.
- **`Procedures/by-policy/dealer-mandate-breach-handling.md`** (planned) — co-owner Saskia + Helena + Rohan. Defines what happens when a check rejects on a mandate breach (post-trade investigation if a trade slipped through, training implication if the same desk repeats it).
- **`Procedures/by-policy/sanctions-screening.md`** (planned) — owner Mira. Defines the sanctions-screening logic the sanctions check calls.
- **`Procedures/by-policy/oms-ems-change.md`** (planned) — owner Kai. Defines change management for the gateway substrate itself.
- **`Procedures/by-policy/agent-runtime-deploy.md`** (planned) — owner Atlas. Each gateway slice deploys under this procedure.
- **`Procedures/by-policy/event-schema-evolution.md`** (planned) — owner Atlas. The six new event types follow this procedure.

Each procedure cites its parent policy; each policy cites the regulation or bank-objective that justifies it (per `feedback_reg_policy_procedure_capability_chain.md`). The gateway substrate is the system capability that performs these procedures.

---

## 9. Dependencies on other personas

| Dependency | Persona | What we need from them, and by when |
|---|---|---|
| Acceptance of v0 check list and aggregation rule | Mira, Rohan, Eitan, Senna, Helena, Imani | One-line confirmation per persona that the check the brief assigns is owned and the v0 stub-substrate posture is accepted. Before slice 1. |
| Sanctions service contract authoring | Mira | Typed API contract for sanctions screening; v0 stub acceptable. Before slice 2. |
| Pre-deal credit-limit API authoring | Rohan + Helena | Typed API contract for credit headroom check; v0 stub keyed on LEI acceptable. Before slice 3. |
| Pre-deal market-risk API authoring | Rohan + Anya | Typed API contract for sensitivity check; v0 covers delta only. Before slice 4. |
| Funding-envelope API authoring | Eitan + Ravi | Typed API contract for LCR / NSFR headroom. Before slice 6. |
| Legal-entity tree register | Imani | Tree-of-one with the API shape supporting plural entities. Before slice 1. |
| Identity check wiring | Senna | Live A1.2 identity issuer; permission-policy advisory mode. Before slice 2. |
| Threat model gate on six new event types + gateway external surface | Senna + Rashida | One-line confirmation no new attack surface beyond the existing OMS / EMS perimeter. Before slice 1. |
| Dealer-mandate working numbers register | Saskia + Helena + Rohan | Live register the market-risk check can read against. Before slice 4. |
| Vera recon pipeline for gateway integrity | Vera | Recon pipeline asserting orphan-free order chain, approval-only-after-10-approves, no-OMS-route-without-approval. Before final v0 sign-off. |
| Calendar substrate (SA market-hours, FX cutoffs) | Anya | Register read. Slice 1 hard-codes; calendar substrate lands later. |
| CEO-decision lift on §6 questions | Marc (CEO) | Adjudication on Q1–Q5. Before slice 1. |

---

## 10. Open items routed elsewhere

- **To Mira:** confirm sanctions service contract shape; populate suitability rule register (institutional-only); land first surveillance typology (insider-list collision).
- **To Rohan:** confirm pre-deal credit-limit API shape; pre-deal market-risk API shape; declare gateway models for tier classification under Nadia's methodology.
- **To Eitan:** confirm funding-envelope API shape; confirm FTP-attachment methodology timeline against M2.
- **To Senna + Rashida:** threat-model gate on the six new event types and the gateway external-facing surface.
- **To Helena:** confirm RAS-envelope citation contract shape; confirm appetite-line authority on the dealer-mandate working numbers the market-risk check reads against.
- **To Imani:** legal-entity tree (tree-of-one acceptable); documentation-status register (counterparty × product-family); jurisdiction matrix.
- **To Atlas:** confirm bus-canonical runtime is ready for the gateway dispatch pattern (Vera Wave-4 #13 lands first); confirm citation-gate coverage extension for the six new event types is in scope of the next Atlas slice.
- **To Vera:** scope the gateway-integrity recon pipeline; assess slice into Wave-4 ordering.
- **To Anya:** calendar substrate (SA market-hours, FX cutoffs); position projection (under build); semantic-layer entries for the new event types.
- **To Owen:** confirm `pre-trade-conduct-gate.md` and `pre-trade-gateway-governance.md` are in the planned procedures index.
- **To Scrooge:** route the §6 open questions to Marc as part of the next CEO session; this brief is informational (`decision-required: false`) but the questions it surfaces are CEO-adjudication items that resolve through normal decision-record discipline rather than through this brief.
- **To Marc (CEO):** §6 questions Q1–Q5. Adjudication unblocks slice 1.

---

## 11. What v0 is not

v0 is a minimum-credible envelope. Explicitly *not* in v0 (and named so the brief does not over-promise):

- **Override path.** Per Q5; lands as a separate substrate slice with its own controls.
- **Full sanctions-list coverage.** v0 stub is `no-match`; full UN / OFAC / EU / FIC coverage lands when Mira's sanctions service is built.
- **Multi-asset depth.** v0 covers M1 (listed equities) per Q3; v1 = bonds + repo (M2); v2 = IRS (M3).
- **Latency optimisation.** v0 measures end-to-end latency under recon; tuning is iterative.
- **Best-execution evidence integration.** Best-execution is post-trade evidence (`Team/Kai.md` §12); the gateway is pre-trade. The two integrate at v2+ via the venue-comparison surface.
- **Override-event-store discipline for gateway-substrate model parameters.** The gateway models (credit engine, market-risk engine, RWA engine) are themselves models per Nadia's methodology; their parameter changes follow `Procedures/by-policy/event-schema-evolution.md` discipline. v0 wires; the discipline lands as Nadia's methodology lands.
- **Cross-workflow event bus.** Per `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md` §6.1, cross-workflow dispatch is M8 cloud-lift work. v0 runs in-process within the bus-canonical runtime in a single workflow; the gateway and the OMS / EMS share the workflow.

---

## 12. Sign-off

**Saskia (Head of Global Markets).** v0 envelope as scoped is the minimum-credible pre-licence rehearsal. It forces every persona who owes a check to publish a contract in production form, forces the bank to operate the chain end-to-end on the substrate it actually has, and lands the *shape* that licence-day depth fills in. Open questions Q1–Q5 are the right questions for CEO; the recommendations stand as the franchise-side view.

**Kai (trading systems engineer).** The architecture is bus-canonical fan-out / aggregate, ten event-emitting check handlers, one aggregator, two terminal events. Each slice is shippable and independently green under recon. The non-bypassability constraint is preserved. Latency budget (50ms gateway, 200ms routing) is achievable on slice 7 once each check is profiled and tuned. The substrate gaps named in §5 are the gating path; closing them in the §7 sequence delivers v0 inside the substrate-completeness budget Targeted profile.

—Saskia (franchise + governance) · Kai (engineering)
