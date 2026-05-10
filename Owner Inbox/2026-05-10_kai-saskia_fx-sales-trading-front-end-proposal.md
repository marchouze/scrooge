---
title: FX sales & trading front-end v1 — build proposal + slice decomposition
author: Kai (Trading systems engineer) · Saskia (Head of Global Markets)
date: 2026-05-10
summary: Scopes a v1 FX sales & trading front-end as a rehearsal artefact over the existing FX backend substrate (CDM, pre-trade gateway, correspondent routing, product-construction layer). UI is a thin presentation over already-typed events — sales RFQ + quote, trader pricer + blotter, risk-officer read-view, CEO oversight. Eight slices, Slices 1-3 buildable pre-M2 under the Targeted budget; trade booking, confirmation, settlement deferred to v2 behind named triggers.
decision-required: true
decision-id: D-FX-SALES-TRADING-FRONTEND
decision-category: medium-term
decision-owner: Kai (Trading systems engineer) · Saskia (Head of Global Markets)
decision-for-ceo: Approve scope of FX sales & trading front-end v1 (eight named slices) and authorise Slices 1-3 pre-M2 under the Targeted budget; recommended answers to five open questions adopted in one go per the no-pause rule.
decision-recommendation: Approve as drafted. v1 is the institutional-dealer FX sales + trader UI layered over existing backend; v1 is rehearsal-only (no live trading, no live counterparties — D-INTERIM-OPERATING-POSTURE binds); booking + settlement defer to v2 when the product-instance lifecycle ships.
---

# FX sales & trading front-end v1 — build proposal

**Authors:** Kai (Trading systems engineer, engineering — reports to Saskia) · Saskia (Head of Global Markets, governance — reports to CEO)
**Reports through:** Saskia → CEO; Kai → Saskia.
**Date:** 2026-05-10
**For:** Marc (CEO).
**Authority:**
- CEO directive 2026-05-10 (this dispatch): "build an FX sales & trading front-end".
- `D-INTERIM-OPERATING-POSTURE` (CEO-approved 2026-05-06; `Owner Inbox/2026-05-06_ceo-decision_interim-operating-posture.md`) — build-only, no live trading until SARB licence.
- Testing strategy — `Owner Inbox/2026-05-09_scrooge_testing-strategy-simulated-data.md` — synthetic data through licence-day; every event carries `synthetic: true`.
- `D-MARKETS-SCHEMA-FOUNDATION` (PR #49) — FX Spot/Forward/Swap/NDF typed shapes + `bookType` discriminator; `prototype/platform/markets/cdm/fx.ts`.
- `D-FX-CORRESPONDENT-PAIR-NAMING` (PR #58, #59, #64) — Standard Bank ZA primary / FirstRand-RMB ZA backup; switch-test event family; `prototype/platform/markets/correspondent-routing.ts`.
- `D-PRODUCT-CONSTRUCTION-SUBSTRATE` (PRs #113-115) — typed Product layer + 12-event lifecycle family + `composeProduct`; `prototype/platform/markets/products/`.
- Pre-trade gateway envelope v0 — `Owner Inbox/2026-05-09_saskia-kai_pre-trade-gateway-envelope-v0-scoping.md`; aggregator slice 1 live at `prototype/runtime/agents/kai-pre-trade-gateway-aggregator.ts`; events `OrderProposed`, `GatewayCheckRequested`, `GatewayCheckCompleted`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway`, `PreTradeLimitChanged`.
- Counterparty institutional-eligibility screening v0 (PR #77; FAIS-KI handover gate-(a)) — events `CounterpartyEligibilityScreened`, `CounterpartyEligibilityRevalidated`, `CounterpartyEligibilityBreached`.
- Helena (Chief Risk Officer, governance) B-cluster FX-settlement-concentration appetite lines (PR #60).
- FinSurv URN cluster wave-1 (PR #56) — current-account + capital-account citations available to UI's FX-control layer.
- Bank UI shell — `prototype/dashboard/public/` (`home.html` launcher, `_shell.css/_shell.js`, `_brand.css`; PR #52).
- Saskia's markets-franchise design — `Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md` (in flight as `WS-MARKETS-FRANCHISE`, ~2 weeks; this proposal is **complementary**, not subsumed).
- `D-NEW-PRODUCT-APPROVAL-POLICY` (in-flight; Saskia leading) — NPA attestation seam this UI consumes for the per-product attestation surface.
- CLAUDE.md Principles 1 (events as truth), 2 (citation discipline), 3 (cloud-native), 4 (security designed-in), 5 (multi-currency / -entity / -country), 6 (single-graph), 7 (autonomous by default).
- Memory: `project_ai_driven_bank.md` (rehearsal-not-go-live framing); `project_rules_bind_at_commencement.md` (commencement-bind status of FAIS conduct rules); `project_strategic_foundation.md` (institutional-only).

**Status:** Specification only — no build code lands on this PR. Approval governs the slice ordering in §6. After approval, Slice 1 has a dispatch-ready brief embedded at §11.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer. It cites the approved schema foundation, the pre-trade gateway, the product-construction substrate, the counterparty-eligibility screen, the correspondent routing-policy projection, the bank UI shell, and the franchise design; it authors no principle-level substance. The UI is a presentation over events the substrate already emits; new events introduced by this brief are explicitly named in §9 as substrate-gap follow-ons (Atlas-owned).

---

## 1. Purpose + non-goals

### Purpose

Land an institutional FX sales & trading front-end as a **rehearsal artefact** over the existing FX backend substrate. Marc — and, at licence-day, the FAIS key individual + the Head of Global Markets — must be able to:

- Watch an institutional counterparty submit an FX RFQ and see the request, the counterparty-eligibility status, the pre-trade-gate evaluation, and the quote response — all in one screen.
- Watch a trader price a Spot / Forward / Swap / NDF request, see their book position and limit headroom against Helena's RAS lines, and respond.
- See a CEO-oversight read-view that aggregates the day's RFQs, fills (when v2 lands), open positions (when v2 lands), and live limit utilisation.

The front-end is the **first end-to-end demonstration that the FX backend hangs together as a workflow**, not just as isolated event types. It is the visible artefact for the pre-licence go-live readiness gate (Saskia + Rashida + Devon).

### Non-goals (v1)

- **Not go-live.** Per `D-INTERIM-OPERATING-POSTURE`, no live trading until SARB licence. Every event the UI emits carries `synthetic: true` per the testing strategy. The UI refuses to run against any backend whose composition root reports a non-build mode.
- **Not multi-asset.** Equities, bonds, IRS get separate lanes once their backends mature (M1 listed equities is closer; M2/M3 are scoped but not built). FX is the deepest substrate today, hence Marc's choice.
- **Not a market-data terminal.** No Bloomberg-grade ticking grid, no chart library, no greeks surface. Spot is a stub price (Q3 below); forward points are a stub curve. Real market-data wiring is a v3 problem (after Saskia's franchise design lands).
- **Not the booking / confirmation / settlement chain (v1).** v1 stops at `OrderApprovedAtGateway`. Trade-booking → confirmation → settlement → recon comes in v2 (§7), behind the named trigger that the product-instance lifecycle ships under `D-PRODUCT-CONSTRUCTION-SUBSTRATE` Slice 6+.
- **Not a policy author.** This is engineering scope. Where new policy is implied (e.g. trader-vs-sales segregation), this brief flags the policy gap and routes to Saskia + Imani (Legal & contracts engineer); it does not draft.
- **Not the franchise design.** Saskia's `WS-MARKETS-FRANCHISE` (~2 weeks) covers product mix + appetite + counterparty mix. This brief covers the trading-systems UI on top. The two are complementary; this brief consumes the franchise design's outputs (via decision records and projections) but does not replace any decision in it.

---

## 2. User personas — what each sees

| Persona | Identity (build phase) | What they see | Authoring rights | Notes |
|---|---|---|---|---|
| **Sales rep** | `agent:niko:sales-desk` (build-phase autonomous; human FAIS rep at licence-day) | Counterparty list (institutional, eligibility-screened); RFQ intake form (Spot / Fwd / Swap / NDF); quote-request → quote-response thread; per-counterparty workflow history. | Emit `OrderProposed`; emit `RfqRequested` / `QuoteResponded` (see §9 — substrate gap, new events). | Niko's eligibility screen (PR #77) is the gate — only passing counterparties surface in the picker. |
| **Trader** | `agent:kai:fx-pricer` (build-phase autonomous; human dealer at licence-day) | Pricer / quote screen (Spot / Fwd / Swap / NDF — fields per `cdm/fx.ts` schema); intraday blotter (own RFQs, own quotes, own provisional fills); position + limit-headroom panel (read-only projection); hedge-ticket workflow (also routes through pre-trade gateway). | Respond to `RfqRequested` with `QuoteResponded`; emit `OrderProposed` for hedge tickets; cannot author limits. | Limits authored by Helena/Rohan via `PreTradeLimitChanged`; trader sees them as headroom only. |
| **Risk officer** | `agent:helena:ras-watch` + `agent:rohan:risk-engine` (read-view human at licence-day) | Live limit utilisation across RAS B-cluster (FX-settlement-concentration, market-risk envelopes, credit envelopes); rejection feed (every `OrderRejectedAtGateway` with cited reason); switch-test status; correspondent-routing live tag. | Read-only on the front-end. Limit changes happen via `PreTradeLimitChanged` outside the UI (Helena/Rohan substrate). | Risk officer view has no "intervene" buttons in v1 — interventions are typed events, not UI clicks. |
| **CEO oversight** | `human:marc@tgv.co.za` | Day's RFQs + quotes + approvals + rejections (counts + selected detail); top-N counterparties by activity; B-cluster utilisation summary; substrate-mode banner ("BUILD — synthetic"); link-out to underlying registers. | Read-only; can record `CeoDecision` events via the existing decision modal (no new path). | Aggregates only; not a per-trade approval surface. |
| **(Implicit) Compliance** | `agent:mira:gateway-watch`, `agent:zara:mlro` | Same data the risk officer sees, plus the sanctions / PEP rejection feed when slice 4 of the gateway lands. | Read-only in v1. | Mira's gateway-coverage tile is a v2 add — flagged §9. |

All personas pair name + position on first mention per CLAUDE.md identity discipline.

---

## 3. Functional scope v1 — named user journeys

J1. **Sales-side RFQ intake.** Sales rep selects an eligibility-passing institutional counterparty, picks a product family (Spot / Fwd / Swap / NDF), fills a typed RFQ form (currency pair, notional, value date, settlement convention), submits. UI emits `RfqRequested` (new event — §9). Counterparty-eligibility status is displayed inline (live read of `CounterpartyEligibilityScreened` projection); a non-passing counterparty is not selectable.

J2. **Trader pricer + quote response.** Trader sees the inbound `RfqRequested` in the blotter, opens the pricer pre-filled from the RFQ, sees the indicative spot stub + forward-points stub (Q3), enters a quote (bid/offer, size, validity window), submits. UI emits `QuoteResponded` (new event — §9), threaded back to the RFQ.

J3. **Counterparty accepts → order proposed.** Sales rep relays the quote; counterparty (simulated in v1 — synthetic acceptance button) accepts. UI emits `OrderProposed` per existing schema (`prototype/platform/event-store/event-types.ts:1547`), threaded to the RFQ + quote. Pre-trade gateway picks it up via the existing aggregator (`runtime/agents/kai-pre-trade-gateway-aggregator.ts`). Sales rep + trader watch the `GatewayCheckRequested` / `GatewayCheckCompleted` fan-out resolve to either `OrderApprovedAtGateway` or `OrderRejectedAtGateway`. **v1 stops here.** Booking is v2.

J4. **Trader limit-headroom view.** Trader sees a live read of their book's limit utilisation against the Helena RAS B-cluster lines (FX-settlement-concentration; market-risk envelope; credit-envelope per counterparty). Headroom is a projection over the existing event log (a Kai-owned projection landing in Slice 3 — extends Anya's pattern). Read-only; intent of view is "do not propose an order that will be rejected."

J5. **Risk-officer rejection + switch-test feed.** Risk officer sees a live feed of `OrderRejectedAtGateway` events with cited reason, and a tile showing whether a `SwitchTestActivated` window is currently open + the resolved correspondent (per `correspondent-routing.ts`). Rejections are sortable by reason taxonomy.

J6. **CEO oversight tile-deck.** CEO sees a tile-deck card on `home.html` (launcher) titled "FX desk — today" with: RFQ count, quote count, approval count, rejection count, top-3 counterparties by RFQ count, current correspondent (resolved via routing-policy projection). Card is a tile that links to the desk view. Read-only.

J7. **Substrate-mode banner.** Every screen in the front-end shows a banner: `BUILD MODE — SYNTHETIC DATA — NO REAL COUNTERPARTIES`. The UI refuses to render if the backend reports `mode: live`. Banner colour + copy per Linnea brand tokens (`_brand.css`).

Out of v1: J-future-1 booking (`ProductInstanceTraded` per Slice 6 of `D-PRODUCT-CONSTRUCTION-SUBSTRATE`); J-future-2 confirmation (Imani / Tomas); J-future-3 settlement routing (Tomas — already wired at the routing-policy layer); J-future-4 recon + cut-off + intraday P&L close (Tomas + Bea, accounting engineer); J-future-5 multi-asset (equities, bonds, IRS).

---

## 4. Architectural sketch

### 4.1 Where the UI sits

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser (Sales / Trader / Risk / CEO views)                     │
│   prototype/dashboard/public/markets/fx/{desk,pricer,risk}.html │
│   Existing shell: _shell.css, _shell.js, _brand.css (PR #52)    │
└───────────────────────────────────┬─────────────────────────────┘
                                    │ /api/markets/fx/* (new)
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard server: prototype/dashboard/server.ts (extends)       │
│   - Reads projections (counterparty list, blotter, headroom)    │
│   - Posts new events through the runtime emit-and-dispatch path │
└───────────────────────────────────┬─────────────────────────────┘
                                    │ event-store + projections
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Existing FX backend substrate (DO NOT REBUILD)                  │
│ • CDM:           prototype/platform/markets/cdm/fx.ts           │
│ • Products:      prototype/platform/markets/products/           │
│ • Routing:       prototype/platform/markets/correspondent-      │
│                  routing.ts                                     │
│ • Pre-trade GW:  runtime/agents/kai-pre-trade-gateway-          │
│                  aggregator.ts (slice 1 live, default-approve)  │
│ • Eligibility:   tests/counterparty-eligibility.test.ts +       │
│                  the screening event family                     │
│ • Events:        platform/event-store/event-types.ts            │
│                  (OrderProposed, Gateway*, Switch*, Counterparty│
│                  Eligibility*, Product*, etc.)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Events the UI emits (v1)

| Event | Source | Status | Notes |
|---|---|---|---|
| `RfqRequested` | UI (sales) | **NEW — substrate gap §9** | Routes to Atlas; Owen+Atlas RMS Slice 2 is currently in flight on `event-types.ts`, so Kai files the type addition as a follow-on after RMS Slice 2 lands (per CLAUDE.md "don't touch event-types.ts"). |
| `QuoteResponded` | UI (trader) | **NEW — substrate gap §9** | Same as above. |
| `OrderProposed` | UI (sales rep, on counterparty acceptance) | **EXISTING** (`event-types.ts:1547`) | Reuses the existing schema. UI populates `requestedActor: agent:niko:sales-desk` (build-phase). |

### 4.3 Events the UI consumes (v1)

`OrderProposed`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway`, `GatewayCheckRequested`, `GatewayCheckCompleted` (gateway visualisation); `CounterpartyEligibilityScreened`, `CounterpartyEligibilityRevalidated`, `CounterpartyEligibilityBreached` (counterparty picker); `PreTradeLimitChanged` (limit-headroom projection); `SwitchTestActivated`, `SwitchTestEnded`, `SwitchTestReport` (correspondent-routing tile); plus the new `RfqRequested` / `QuoteResponded` (UI's own writeback for blotter rendering).

### 4.4 Procedures triggered

- `Procedures/by-policy/counterparty-institutional-eligibility-screening.md` — read-side only; UI surfaces the screen result, does not trigger.
- Pre-trade gateway dispatch chain (per Kai.md §12) — triggered by `OrderProposed` emission as today; UI is upstream.
- Correspondent routing-policy resolution — read-side; UI displays `ResolvedCorrespondent` from the projection at quote-time as informational.

### 4.5 Projections the UI reads

- `CounterpartyEligibilityScreened` projection (counterparty picker source).
- New: **FX blotter projection** (Slice 2) — fold over `RfqRequested`, `QuoteResponded`, `OrderProposed`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway` keyed by `rfqId`, partitioned by trader / sales rep.
- New: **FX limit-headroom projection** (Slice 3) — fold over `PreTradeLimitChanged` + the running open-order set per counterparty + per RAS line; computes "headroom" as `limit − aggregated-utilisation`.
- Existing: correspondent routing-policy projection (`platform/markets/correspondent-routing.ts`).

### 4.6 Multi-currency, multi-entity, multi-country (Principle 5)

Every UI form carries `currencyPair` (six-char ISO 4217), `bookingEntity` (legal-entity-tree node — defaults to `entity:hoz-bank-limited` in v1; selectable when M1 legal-entity tree expands), and `jurisdiction` (defaults to ZA). All emitted events carry these per existing schema. Reporting-currency conversion is presentation-only and out of v1 (no FX rate carriage in the UI yet).

---

## 5. Pre-trade compliance gates

The UI does not author pre-trade checks — it surfaces the existing pre-trade gateway. v1 wires UI visibility for the slice-1 default-approve aggregator and ships the front-end for the gates the gateway will deepen in slices 2-7. Each gate is named, the substrate it invokes is cited, and the UX failure-handling is specified.

| Gate | Substrate | UX (pass) | UX (fail) | Notes |
|---|---|---|---|---|
| **G1 — Counterparty eligibility** | Niko PR #77 — `CounterpartyEligibilityScreened` | Counterparty selectable in the RFQ form. | Counterparty hidden from picker; if a previously-passed counterparty is now `Breached`, RFQs against them refuse to submit, with the breach-reason surfaced and a link to the screening record. | Live re-check on every RFQ submission (not just at picker load). |
| **G2 — Pre-trade gateway envelope** | `runtime/agents/kai-pre-trade-gateway-aggregator.ts` (slice 1 live; slices 2-7 add the actual checks) | UI shows fan-out tiles for each `GatewayCheckRequested` resolving to `Completed[approve]` → `OrderApprovedAtGateway`. | UI shows the rejecting check's `checkKind` + cited reason + link to the obligation that produced the reject. **No override path** — per the gateway scoping brief Q5, override is deferred entirely from v0. | UI emits no `OrderProposed` until the eligibility check (G1) passes locally; this is belt-and-braces. |
| **G3 — NPA Policy attestation (informational v1)** | `D-NEW-PRODUCT-APPROVAL-POLICY` (in flight); `ProductApproved` / `ProductWithheld` events under the product-construction substrate (`event-types.ts:3120`, `:3151`) | Pricer screen displays the active product's NPA-attestation status as a badge ("NPA-attested 2026-mm-dd"). | If the active product has no `ProductApproved` event, pricer shows a yellow "NPA pre-attestation" banner; in v1 the trader can still quote (per Q4 — informational, not gating). | Q4 below: gate-or-informational. Recommend informational v1 → gating v2 once NPA + product instances are wired. |
| **G4 — Sanctions / PEP** | Mira / Zara hooks — pre-trade gateway slice 2-3 (planned; not in slice 1) | Implicit pass (slice 1 aggregator default-approves). | When slice 2-3 of the gateway lands, the UI will surface the rejection like any other gateway reject — no special UX in v1 beyond the generic rejection-handling above. | UI is forward-compatible without code changes (the rejection-feed component renders any `OrderRejectedAtGateway`). |
| **G5 — Limit pre-check** | Helena RAS B-cluster + Rohan risk-engine — pre-trade gateway slices 4-7 (planned) | Implicit pass; trader sees headroom in the trader headroom panel (J4). | Same as G4 — UI surfaces the rejection generically. The headroom panel is the *informational* surrogate that lets a trader avoid proposing an order that the gateway would reject. | The headroom panel is the v1 deliverable for this gate's UX (Slice 3). |

**No bypass path in v1.** Per Kai.md §15 (architectural non-bypassability) and the gateway scoping brief Q5. The only exits from "rejected" are (a) re-propose with a smaller / different order, or (b) raise an `AgentEscalation` per the standard channel. UI does not include an "override" button.

---

## 6. Slice decomposition

Eight slices, modelled on `D-PRODUCT-CONSTRUCTION-SUBSTRATE` and `D-EVENT-STORE-SCALING` shape. Slices 1-3 fit the Targeted budget pre-M2; Slices 4-8 sequence after the parallel-stream NPA Policy lands and v2 work begins.

| # | Slice | One-line scope | Engineering owner | Effort (sessions) | Exit criterion | Dependencies |
|---|---|---|---|---|---|---|
| **1** | **UI shell + counterparty picker** | New `markets/fx/desk.html` page using existing shell; counterparty picker reads `CounterpartyEligibilityScreened` projection; substrate-mode banner. | Kai (UI) · Atlas (Core banking platform architect — composition-root mode flag) | 1.5 | Page renders at `/markets/fx/desk.html`; counterparty list shows only eligibility-passing counterparties; banner shows on every FX-namespaced page. | Bank UI shell PR #52; Niko eligibility screen PR #77; composition-root mode flag (substrate gap §9 #1 — Atlas to land prerequisite). |
| **2** | **RFQ intake + blotter projection** | RFQ form (Spot/Fwd/Swap/NDF) emitting `RfqRequested`; blotter projection foldable over RFQ + Quote + Order events; blotter view rendering open RFQs per sales rep + per trader. | Kai (UI + projection) · Anya (Projections engineer — projection registration pattern) | 2 | Submitting an RFQ form persists `RfqRequested` to the event store; blotter view renders the new RFQ; recon test asserts blotter projection re-derives bit-identically from the event log. | Slice 1; new event types `RfqRequested` (substrate gap §9 #2 — Atlas/Owen RMS Slice 2 first). |
| **3** | **Trader pricer + headroom panel** | Pricer screen (per-family field set from `cdm/fx.ts`); trader emits `QuoteResponded`; headroom projection over `PreTradeLimitChanged` + open-order set; headroom panel renders per-counterparty + per-RAS-line. | Kai (UI + pricer + headroom projection) · Rohan (Risk-engine engineer — limit-fold methodology) | 2 | Trader can respond to a Slice-2 RFQ with a typed quote; quote appears threaded in blotter; headroom panel updates after the trader's submit; recon test on headroom projection. | Slices 1-2; `QuoteResponded` event (substrate gap §9 #2); headroom projection methodology sign-off from Rohan + Helena. |
| 4 | **Order acceptance + gateway visualisation** | Counterparty-acceptance click (synthetic in v1) emits `OrderProposed` per existing schema; UI subscribes to `GatewayCheckRequested` / `Completed` and renders fan-out tiles; final `OrderApprovedAtGateway` / `OrderRejectedAtGateway` rendered with cited reason. | Kai (UI) · co-ordinated with whoever owns gateway slices 2-7 at the time. | 2 | A v1-acceptance click produces an `OrderProposed`; the existing aggregator default-approves; UI shows the approval tile and the (slice-1) trivial citation chain. When gateway slice 2 lands, UI renders the new check tile without code change. | Slices 1-3; pre-trade gateway slice 1 (live). |
| 5 | **Risk-officer view + rejection feed** | Read-view page `markets/fx/risk.html`; live RAS B-cluster utilisation (reuses Slice-3 headroom projection); rejection feed; correspondent routing-policy tile (resolved party + switch-test status). | Kai (UI) · Helena (CRO — sign-off on what surfaces) · Tomas (Operations & payments engineer — routing-policy tile) | 1 | Risk-officer page renders all three panels live; recon test on the rejection-feed source. | Slices 1-3-4; correspondent routing-policy projection (live); switch-test event family (live). |
| 6 | **CEO oversight tile on `home.html`** | Tile-deck card "FX desk — today" with the counts from §3 J6; click-through to `markets/fx/desk.html`. | Kai (UI) · Atlas (launcher tile registration pattern) | 0.5 | Tile renders on `home.html` for `human:marc@tgv.co.za` identity; numbers reconcile against the underlying projections. | Slices 1-5. |
| 7 | **NPA-attestation badge surface** | Per-product attestation badge on the pricer; reads `ProductApproved` / `ProductWithheld` projection. | Kai (UI) · Saskia (NPA Policy authority) | 1 | Pricer shows attestation badge per FX product family; informational-only (no gate, per Q4). | `D-PRODUCT-CONSTRUCTION-SUBSTRATE` Slices 1-2 (typed Product + lifecycle events); `D-NEW-PRODUCT-APPROVAL-POLICY` landed. |
| 8 | **Vera UI-integrity recon** | Recon pipeline asserting (a) UI never emits `OrderProposed` for a `Breached` counterparty, (b) UI never emits an order outside the substrate-mode flag, (c) blotter + headroom projections re-derive bit-identically from the event log, (d) every UI emission carries `synthetic: true`. | Vera (Internal-audit / continuous-assurance engineer) | 1 | All four assertions green for 7 consecutive autonomous Vera runs. | Slices 1-7. |

**Total Slices 1-3 effort: ~5.5 sessions.** Targeted budget per `Owner Inbox/2026-05-09_atlas_substrate-completeness-budget.md`. Slices 4-8 add ~5.5 more, paced by NPA + v2 booking enablers.

**Recommendation:** Approve all 8 slice scopes; authorise build of Slices 1-3 immediately; Slices 4-8 fire on the named triggers above without further pause (per the no-pause rule).

---

## 7. Out of scope (v1) — with named next-trigger

| Deferred capability | Why deferred from v1 | Next-trigger that fires the v2 work |
|---|---|---|
| **Trade booking** (`ProductInstanceTraded` or equivalent) | Product-instance lifecycle events do not exist yet — `D-PRODUCT-CONSTRUCTION-SUBSTRATE` Slices 1-3 land the Product *type* + 12-event *Product-lifecycle* family, but the *instance-trade* event is Slice 6+ of that substrate. | When `D-PRODUCT-CONSTRUCTION-SUBSTRATE` Slice 6 lands, this is unblocked → fire as **v2 Slice A**. |
| **Trade confirmation** | Confirmation generation is Imani (Legal & contracts engineer) + Tomas; no confirmation substrate yet. | When Imani's clause-library + ECTA confirmation generator lands, fire as **v2 Slice B**. |
| **Settlement routing** | Settlement is wired at the routing-policy layer (live) but the trade-settlement pipeline (PSSA / SAMOS via correspondent rails) is Tomas-owned and not yet built end-to-end. | When Tomas's FX-settlement pipeline (correspondent BIC + nostro instruction generator) lands, fire as **v2 Slice C**. |
| **Recon, cut-off, intraday P&L close** | Bea's accounting close + Tomas's recon are partial; intraday P&L is a projection problem that needs a settled base. | When v2 Slices A-C land + Bea's close-projection lands, fire as **v2 Slice D**. |
| **Multi-asset (equities, bonds, IRS)** | Backends not deep enough; M1 listed equities is closer than M2/M3. | When M1 equities backend reaches parity with FX (CDM + pre-trade-gateway integration + routing), fire as a **separate `D-EQ-SALES-TRADING-FRONTEND`** decision pack (Kai+Saskia author). |
| **Bloomberg-grade ticking market data** | No internal market-data substrate; Saskia's franchise design (~2 weeks) will frame the question of internal vs external feed. | When `WS-MARKETS-FRANCHISE` resolves the market-data sourcing decision, fire as a **separate market-data substrate** brief (Kai + Saskia + Atlas). |
| **Voice-to-trade ticket capture** | Institutional desks rarely click-and-trade for size, but voice integration is a separate substrate (transcription + structured extraction + attestation). | When the bank's communications-surveillance substrate lands (Mira-owned, post-licence-day necessity), fire as a **v3 Slice**. |
| **Pre-trade-gateway override path** | Per gateway scoping Q5, deferred entirely from v0. | If/when CEO + Saskia + Helena agree an override-with-attestation path is needed (post-licence evidence-based decision); not in v1 or v2 by default. |

---

## 8. Substrate dependencies consumed (cite-not-rebuild)

This proposal depends on the following already-built substrate. Each line names the dependency, the PR / commit / file, and the slice that consumes it.

1. **CDM FX primitives** — `prototype/platform/markets/cdm/fx.ts` (PR #49, `D-MARKETS-SCHEMA-FOUNDATION`). Consumed by Slices 2-3 (RFQ form fields + pricer fields).
2. **Pre-trade gateway aggregator + event family** — `runtime/agents/kai-pre-trade-gateway-aggregator.ts`; `event-types.ts:1498-1860` (`OrderProposed`, `GatewayCheck*`, `OrderApprovedAtGateway`, `OrderRejectedAtGateway`, `PreTradeLimitChanged`). Consumed by Slices 4-5.
3. **Counterparty institutional-eligibility screening v0** — PR #77; `event-types.ts:2244-2430` (`CounterpartyEligibilityScreened`, `Revalidated`, `Breached`); `tests/counterparty-eligibility.test.ts`. Consumed by Slice 1 + Slice 8 recon.
4. **Correspondent routing-policy projection + switch-test event family** — `prototype/platform/markets/correspondent-routing.ts`; `event-types.ts:2430-2589` (`SwitchTestActivated`, `Ended`, `Report`); PR #58, #59, #64, `D-FX-CORRESPONDENT-PAIR-NAMING`. Consumed by Slice 5 (risk-officer view tile).
5. **Product-construction substrate** — `prototype/platform/markets/products/` (PRs #113-115, `D-PRODUCT-CONSTRUCTION-SUBSTRATE`); `event-types.ts:2870-3370` (12-event product-lifecycle family). Consumed by Slice 7 (NPA badge) and v2 Slice A (booking).
6. **Bank UI shell + brand tokens** — `prototype/dashboard/public/_shell.css`, `_shell.js`, `_brand.css`, `home.html` launcher (PR #52). Consumed by Slices 1, 2, 3, 5, 6.
7. **Helena RAS B-cluster FX-settlement-concentration appetite lines** — PR #60; consumed by Slice 3 (headroom projection) + Slice 5 (risk-officer view).
8. **FinSurv URN cluster wave-1** — PR #56 (current-account + capital-account citations); consumed by Slice 4 (citation rendering on approval / rejection chain).
9. **Ravi (Treasury / ALM engineer) ALM-readiness substrate** — `runtime/agents/ravi-alm-readiness.ts`; consumed by Slice 3's funding-headroom (when the funding gate lands in pre-trade gateway slice 6).
10. **Composition root + event store** — `prototype/platform/composition.ts`, `prototype/platform/event-store/`. Consumed by every slice.

---

## 9. Substrate gaps surfaced (so they don't surprise Atlas)

| # | Gap | Proposed follow-on | Owner |
|---|---|---|---|
| 1 | **Composition-root mode flag** (`build` vs `live`) — UI needs a backend signal to refuse to render outside build mode. The `synthetic: true` event flag exists per the testing strategy, but the *system-mode* signal at the composition root is not yet typed. | Atlas adds `compositionMode: "build" | "live"` to the composition root; UI reads it from a `/api/system/mode` endpoint. Out-of-scope follow-on. | Atlas (Core banking platform architect) |
| 2 | **`RfqRequested` + `QuoteResponded` event types** — the institutional FX workflow needs an RFQ → quote thread distinct from `OrderProposed` (an order is the *result* of an accepted quote; the RFQ + quote thread is upstream). Owen + Atlas RMS Slice 2 is in flight on `event-types.ts`, so this addition queues *behind* RMS Slice 2 to avoid the three-way clash documented in `feedback_handlers_metadata_three_way_clash`. | After RMS Slice 2 lands, Kai + Atlas land `RfqRequested` (Spot/Fwd/Swap/NDF payload + `rfqId` correlator) and `QuoteResponded` (`rfqId` ref + bid/offer + validity window). Pair-coupled on `rfqId`. | Kai (schema author) · Atlas (substrate authority). |
| 3 | **FX blotter + FX limit-headroom projections** — both are net-new projections; no existing pattern in `prototype/platform/projections/markets/` covers them. | Slices 2 + 3 land them; Anya (Projections engineer) reviews against the projection-registration pattern; Vera (Slice 8) reconciles bit-identical re-derive. | Kai (build) · Anya (pattern review). |
| 4 | **`/api/markets/fx/*` server endpoints** — dashboard server today exposes `/api/state` and `/api/decide`; FX-specific endpoints (counterparty picker, blotter read, headroom read, RFQ submit, quote submit) do not exist. | Kai extends `prototype/dashboard/server.ts` per Slice 1-3. | Kai. |
| 5 | **Niko eligibility-projection read API** — PR #77 lands the screening events + service-side test, but no projection-as-read-API surface. | Niko's persona is paused (build phase) per `_team-roster.json`; Kai builds the read-projection inline in Slice 1 (small) and it surfaces as a Niko-substrate gap when Niko activates at licence-day. | Kai (build) · Niko (eventual owner — handover at licence-day). |
| 6 | **Synthetic-counterparty corpus + synthetic-order generator** — needed to drive the v1 demo; the testing strategy frames the discipline but the corpus does not exist as a seed. | Scrooge dispatches Niko's persona spec author (who?) — actually Kai authors the FX-only synthetic corpus + a `seeds/markets/fx-synthetic-counterparties.json` + `seeds/markets/fx-synthetic-rfqs.json` as part of Slice 2. Broader cross-domain synthetic corpus is a separate substrate brief. | Kai (FX-only) · later: a cross-domain synthetic-data substrate (Atlas / Anya). |

---

## 10. Risks, opens, regulatory hooks

### Regulatory hooks

- **FAIS Act 37/2002** — pre-trade-gateway G2 carries the conduct citations (per Kai aggregator's slice-1 citation chain). UI surfaces them on rejection. **COMMENCEMENT-BIND** per `project_rules_bind_at_commencement.md` — the obligation binds at commencement-of-trading, not in build phase, but the UI rehearses it now so licence-day go-live is uncontroversial.
- **FIC Act 38/2001** — sanctions / PEP gate G4 will fire in pre-trade-gateway slice 2-3; UI is forward-compatible (Slice 4's gateway-visualisation renders any reject reason without code change).
- **Banks Act 94/1990 + Reg Bank** — capital + funding gates G5 land via pre-trade-gateway slices 4-7; UI consumes via headroom panel (Slice 3) and risk-officer view (Slice 5).
- **JSE rulebook, FMA s.5 market integrity** — already cited in pre-trade-gateway slice 1; UI surfaces.
- **ECTA execution rules** — relevant at booking + confirmation (v2), not v1.

### Risks

R1. **Gateway slice 1 is default-approve.** Until gateway slices 2-7 land, every `OrderProposed` becomes `OrderApprovedAtGateway` regardless of the cited check. The UI rehearsal is *of the workflow shape*, not *of the policy enforcement*. Risk-officer view (Slice 5) shows zero rejections initially; this is correct but visually under-whelming. Mitigation: synthetic-order generator (gap §9 #6) seeds known-rejecting orders against limit + eligibility breaches that ARE wired (G1, G3, G5-headroom).

R2. **Saskia's franchise design (`WS-MARKETS-FRANCHISE`) may revise product mix.** If the franchise design (~2 weeks) decides FX is agency-only or restricts NDFs, Slice 2-3 product-family list contracts. Mitigation: the CDM module is the source of truth — the UI lists product families from the CDM, not a hard-coded list, so contraction is a backend change with no UI rebuild.

R3. **NPA Policy (`D-NEW-PRODUCT-APPROVAL-POLICY`) timing.** Slice 7 depends on the NPA Policy landing. If NPA slips past v1 close-out, Slice 7 deliberately blocks until NPA exists; the rest of v1 is unaffected.

R4. **Three-way clash on `event-types.ts`.** RMS Slice 2 (Owen+Atlas) is on `event-types.ts`. Per `feedback_handlers_metadata_three_way_clash`, parallel handler-builds collide deterministically. Mitigation: gap §9 #2 explicitly queues the `RfqRequested` + `QuoteResponded` additions *behind* RMS Slice 2.

R5. **Saskia / Kai capacity for the trader-rule sign-off in Slice 3.** Slice 3 needs Rohan (Risk-engine engineer) sign-off on the headroom-fold methodology. Mitigation: Slice 3 dispatch waits for Rohan's sign-off as a hard precondition; if Rohan is queued, Slice 3 slips by a session.

### Saskia franchise overlap (call-out, not conflict)

This proposal **assumes** Saskia's franchise design will resolve in favour of FX as a market-making + agency family (per the v0 framing in `markets-franchise-design-proposal.md` §1). If the franchise design later restricts FX to agency-only, Slice 2's pricer view morphs from "trader makes a quote" to "trader displays an external quote"; the slice-decomposition does not change shape but Slice 3's headroom semantics simplify (no market-making position to hedge). This is a v1 contraction, not a v1 invalidation.

### Compliance hooks

- **Mira (Compliance / RegTech engineer) gateway-coverage tile** — proposed as a v2 add (the rejection feed exists in Slice 5, but a Mira-owned coverage view is separate).
- **Zara (MLRO) sanctions-rejection surface** — automatically picked up by Slice 4's gateway-visualisation when gateway slice 2-3 lands; no separate UI work.

---

## 11. Open questions for CEO

Each question with a recommended answer. Default per the no-pause rule: approve recommendations.

**Q1. Trader role separation — single composite UI or separate sales / trader pages?**
- **Recommendation: separate pages** (`markets/fx/desk.html` for sales; `markets/fx/pricer.html` for trader; `markets/fx/risk.html` for risk officer; `home.html` tile for CEO).
- **Why:** Front-office segregation-of-duty is a real licence-day requirement (FAIS conduct + JSE rulebook + Saskia's franchise design). Better to design for it from v1 even though build-phase agents are the same identity-issuer instance behind the scenes.

**Q2. Voice-to-trade vs click-and-trade — which workflow is canonical for v1?**
- **Recommendation: click-and-trade for v1.** Voice integration deferred to v3 (per §7).
- **Why:** Voice integration needs a transcription + structured-extraction substrate that does not exist; click-and-trade exercises every backend event today. Saskia's note: the UI doesn't claim to be the canonical trading surface — it claims to be the rehearsal artefact for the workflow.

**Q3. Real-time market-data source — internal (Saskia's franchise design pending) or substrate-stub?**
- **Recommendation: substrate-stub for v1.** Spot price is a deterministic stub (e.g. ZARUSD = 18.5000 with a noise term seeded from the RFQ id); forward points are a deterministic stub curve.
- **Why:** Real market-data wiring is contingent on the franchise-design decision (internal market-making vs external feed) and on commercial market-data agreements that are post-licence. Stub satisfies the rehearsal goal.

**Q4. NPA Policy attestation — gate or informational in v1?**
- **Recommendation: informational v1, gating v2.** Slice 7 lands the badge as informational; gating fires when v2 booking lands (because gating only matters at booking, not at quote).
- **Why:** Pre-trade gateway G2 is the actual block; the NPA badge is a UX cue to the trader. v2 booking introduces the gating point naturally (`ProductInstanceTraded` is gated by `ProductApproved`).

**Q5. Intraday P&L computation — projection from event store or live calc?**
- **Recommendation: deferred entirely from v1.** Intraday P&L is part of v2 (after booking + confirmation land) and the headroom panel (Slice 3) is the v1 substitute for the trader's positioning awareness.
- **Why:** P&L without booked trades is meaningless; the headroom panel covers the trader's "do not propose what will be rejected" need.

**Approve all five recommendations** — Slice-1 dispatch is unblocked the moment this approves.

---

## 12. Slice-1 dispatch-ready brief (embedded — fires on approval)

> **DRAFT — DO NOT DISPATCH UNTIL D-FX-SALES-TRADING-FRONTEND APPROVED.**
>
> ### Brief: Slice 1 — UI shell + counterparty picker (FX desk page)
>
> **Owner:** Kai (Trading systems engineer). Reports through Saskia.
> **Authority:** D-FX-SALES-TRADING-FRONTEND Slice 1 (CEO-approved [date]).
> **Effort estimate:** 1.5 sessions.
> **Prerequisite blocker:** Atlas substrate gap §9 #1 (composition-mode flag) — if not yet landed, Kai inlines a stub `getCompositionMode(): "build"` in Slice 1 and the substrate-gap follow-on lands later. Do **not** block Slice 1 on the substrate flag.
>
> **Scope:**
> 1. Add `prototype/dashboard/public/markets/fx/desk.html` using the existing shell (`_shell.css`, `_shell.js`, `_brand.css`).
> 2. Add a counterparty picker that reads `CounterpartyEligibilityScreened` events from the event store and shows only counterparties whose latest screen result is `pass` (i.e. not `Breached`).
> 3. Add the substrate-mode banner: yellow banner with copy `BUILD MODE — SYNTHETIC DATA — NO REAL COUNTERPARTIES` rendered at the top of every `markets/fx/*.html` page.
> 4. Add a small `/api/markets/fx/counterparties` GET endpoint to `prototype/dashboard/server.ts` that returns the eligibility-passing counterparty list as JSON.
> 5. Add a launcher tile on `home.html` that links to `markets/fx/desk.html` (per Atlas's launcher-tile pattern).
>
> **Out of scope (Slice 1):** RFQ form (Slice 2). Pricer (Slice 3). Risk-officer view (Slice 5). NPA badge (Slice 7).
>
> **Exit criterion:**
> - `bun run ci` green from `prototype/`.
> - Page renders at `/markets/fx/desk.html`.
> - Counterparty list shows only eligibility-passing counterparties (verifiable against `tests/counterparty-eligibility.test.ts` fixtures).
> - Banner appears on the page.
> - Launcher tile appears on `home.html` and links through.
> - Smoke test in `prototype/tests/markets-fx-desk-shell.test.ts` asserts the API returns the expected counterparty count for the seeded test corpus.
>
> **Worktree isolation discipline (CLAUDE.md "Dispatch discipline"):** isolated worktree; never `cd` to `/Users/marc/code/Bank`; scaffold-commit + push within ~10 min; push-retry on rejection (5 attempts); `bun run citation-gate` from `prototype/` before push; identity discipline pairs name + position on first mention.
>
> **PR title:** `slice: Kai — FX sales front-end Slice 1 (UI shell + counterparty picker) — D-FX-SALES-TRADING-FRONTEND`.

---

## 13. What we are asking the CEO to do

1. **Approve the v1 scope** as drafted in §3, §6 (eight slices), §7 (out-of-scope deferrals).
2. **Authorise Slices 1-3 for immediate build** under the Targeted budget (~5.5 sessions). Slices 4-8 fire on the named triggers in §6 without further pause.
3. **Adopt the recommended answers to Q1-Q5** in §11 in one go (per the no-pause rule).
4. **Acknowledge the substrate gaps** in §9 (six items) — these route as Atlas / Anya / Niko / Owen substrate follow-ons; Kai builds Slices 1-3 against the existing surface and the gaps are visible in the dashboard's substrate-gap register.

The decision is **medium-term**: it commits engineering capacity for ~5.5 sessions immediately and ~5.5 more across the rest of v1, and it scopes the v2 trigger set. It does not commit to a go-live posture (`D-INTERIM-OPERATING-POSTURE` continues to bind).

---

## 14. Change log

- 2026-05-10 — Initial draft. Authors: Kai (Trading systems engineer) + Saskia (Head of Global Markets). Dispatched by Scrooge (Chief of Staff / Orchestrator).
