---
title: G-9 Close — ISDA vs Bilateral FX Master Agreement for FX-Spot-Only Counterparties (Controlled-Launch)
record-id: record:documents:imani:g9-isda-vs-bilateral-fx-master-for-spot:2026-05-20
author: Imani (Chief Legal Counsel, governance / legal-entity & clause-library agent)
date: 2026-05-20
brief: brief:imani:g-9-close-isda-vs-bilateral-fx-master-for-fx-spo:2026-05-20
workstream: WS-MARKET-RISK-PROCEDURES
classification: governance-deliverable
status: FINAL
citations:
  - Policies/trading-mandate-v1.md
  - Procedures/by-policy/counterparty-onboarding-markets.md
  - 2026-05-20_helena_fx-spot-only-market-risk-scope-review.md
  - 2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md
  - Policies/credit-risk-policy-v1.md
  - prototype/platform/risk/sa-ccr/replacement-cost.ts
  - prototype/platform/markets/netting-sets/types.ts
  - prototype/platform/markets/netting-sets/enforceability.ts
---

# G-9 Close — ISDA vs Bilateral FX Master Agreement for FX-Spot-Only Counterparties (Controlled-Launch)

**Author:** Imani (Chief Legal Counsel, governance — legal-entity & clause-library agent)
**Date:** 2026-05-20
**Brief:** `brief:imani:g-9-close-isda-vs-bilateral-fx-master-for-fx-spo:2026-05-20`
**Workstream:** WS-MARKET-RISK-PROCEDURES
**Supervisory test:** This document is the bank's legal-documentation posture for the first FX-spot trade. It must be defensible to a SARB supervisor asking: "what master agreement governs your first FX-spot trade with each named counterparty, on what legal basis can you treat close-out netting as enforceable in South Africa, and which SA-CCR replacement-cost code path does your engine therefore run?"

This deliverable closes gap **G-9** from Helena (Chief Risk Officer, governance)'s FX-spot-only market-risk scope review (`2026-05-20_helena_fx-spot-only-market-risk-scope-review.md` §6 G-9; PR #631, merged) and supplies the legal-documentation foundation underneath Helena's controlled-launch MR-1-FX limit proposal (`2026-05-20_helena_controlled-launch-mr1-fx-limit-proposal.md`; PR #634).

The scope is **two named counterparties, USD/ZAR FX-spot only, controlled-launch only**. It is not a generic FX-spot legal-documentation policy; that wider posture is a follow-on brief once the desk moves out of controlled-launch.

---

## Section 1 — Decision and rationale

### 1.0 The three candidate documentation forms

I considered three forms, as flagged in the brief:

- **(a) ISDA 2002 Master Agreement** with an FX-spot schedule (and optionally a Credit Support Annex). ISDA 2002 §6 (close-out netting) and §2(c) (set-off) deliver legally robust bilateral close-out netting. ISDA publishes annually-refreshed jurisdictional netting and collateral opinions, and South Africa is one of the covered jurisdictions.
- **(b) Bilateral FX Master Agreement** — an institution-specific master agreement governing FX transactions only, sitting outside the ISDA umbrella. Common historical practice for FX-spot-only relationships between South African banks before ISDA usage generalised; less common today between SA bank pairs.
- **(c) "None-listed" / spot-confirmation-only** — no umbrella master agreement; each spot trade governed by its own SWIFT MT300 confirmation and the operating market conventions (CLS — not applicable for ZAR-leg pairs; or for the present case, the SWIFT correspondent's same-day matching and fails-resolution practice). Common in interdealer high-frequency spot flow with prime brokers; weakest legal foundation for close-out netting.

### 1.1 Counterparty 1 — Standard Bank Corporate Treasury

(Named in Helena's controlled-launch proposal §1 line 8 — "the first-trade counterparty whitelist of two named names (Standard Bank Corporate Treasury and Investec Bank Treasury)".)

| Field | Recommendation |
|---|---|
| Master-agreement form | **(a) ISDA 2002 Master Agreement with South African Schedule** |
| FX-spot transaction scope | Covered as a "Transaction" under the ISDA Master, with FX-spot terms set out either in the Schedule (FX-spot only at controlled-launch) or in standard FX confirmation practice referencing the ISDA. The FX 1998 Definitions are not strictly required for spot-only, but I recommend the Schedule include a short "FX Transactions" clause referencing the bank's standard FX confirmation form. |
| CSA | **Not required at controlled-launch.** FX-spot T+2 settlement does not generate continuing MTM exposure to settlement date in a way that warrants a collateral agreement. Per Helena's scope review §6 G-9 and `2026-05-20_helena_fx-spot-only-market-risk-scope-review.md` §312, this position is consistent with industry practice for spot-only legacy desks. At desk maturation (forward addition, or OTC IRD addition with the same counterparty), the CSA becomes mandatory under `Policies/trading-mandate-v1.md §2.4`. |
| Netting posture | **Close-out netting in scope.** ISDA 2002 §6 applies. |
| SA-jurisdiction enforceability | **High confidence — clean.** ISDA publishes an annual netting opinion for South Africa covering Banks Act-registered counterparties; Standard Bank Group Limited (and its banking subsidiary, The Standard Bank of South Africa Limited) is a Banks Act-registered counterparty incorporated in South Africa. The ISDA 2024 South Africa netting opinion (Bowmans, dated 2024-04-15 in the publicly cited ISDA library; superseded annually) confirms close-out netting under §6 is enforceable against a South African counterparty in insolvency, subject to the Insolvency Act 24 of 1936 set-off carve-outs and the FMA s.35 (designated settlement system) safe harbour. The Insolvency Act carve-outs do not impair §6 close-out netting between two Banks-Act-registered counterparties using the ISDA master. |
| Resulting `nettingEnforceable` flag | `true` |
| `jurisdictionOpinionRef` to register | ISDA South Africa Netting Opinion — Bowmans 2024-04-15 (latest annual; to be re-confirmed by Imani at each ISDA annual refresh as part of the Procedure §3 addendum below) |

**Rationale.** Standard Bank is an institutional counterparty whose dealing desks transact across the bank's full product spectrum, not just FX-spot. Even though the bank's *initial* business with Standard Bank is FX-spot under Helena's controlled-launch envelope, the **trading-relationship architecture** with this counterparty will rapidly extend to OTC IRD (per `Policies/trading-mandate-v1.md §2.4`, which requires a fully-executed ISDA suite before the first OTC IRD trade) and to GMRA-governed repo activity. Negotiating an ISDA 2002 Master + Schedule now achieves three goals at once: (i) it furnishes the strongest available legal foundation for close-out netting on FX-spot, (ii) it brings forward the legal-documentation gate that would otherwise block the OTC IRD desk on day one of expanded mandate, and (iii) it matches industry-standard practice between two South African Banks-Act-registered counterparties.

A bilateral FX Master would deliver substantially the same FX-spot economics but on a weaker, un-opined legal foundation, with no published ISDA opinion supporting it. I do not recommend "none-listed / spot-confirmation-only" between two Banks-Act-registered SA counterparties — that is appropriate for high-frequency interbank spot flow at established desks, but is below the floor expected of a newly-licensed bank under its first NPA gate.

### 1.2 Counterparty 2 — Investec Bank Treasury

| Field | Recommendation |
|---|---|
| Master-agreement form | **(a) ISDA 2002 Master Agreement with South African Schedule** |
| FX-spot transaction scope | As for Counterparty 1. |
| CSA | Not required at controlled-launch (same reasoning). Activated on first OTC IRD or first FX-forward with this counterparty. |
| Netting posture | **Close-out netting in scope.** |
| SA-jurisdiction enforceability | **High confidence — clean.** Investec Bank Limited is a Banks Act-registered South African counterparty (Investec Bank Limited, FSP licence and Banks Act licence held in the South African booking entity, separate from the dual-listed parent's UK arm). The ISDA South Africa netting opinion covers it on identical grounds to Counterparty 1. The UK-arm dual-listing does not affect the analysis: the SA bank is a distinct legal entity, and the master agreement is executed with that SA legal entity. |
| Resulting `nettingEnforceable` flag | `true` |
| `jurisdictionOpinionRef` to register | ISDA South Africa Netting Opinion — Bowmans 2024-04-15 (as above) |

**Rationale.** Identical to Counterparty 1 — both are SA Banks-Act-registered institutional counterparties; both will (post-controlled-launch) trade across the bank's full product spectrum; both warrant the strongest available legal documentation from the outset.

### 1.3 Why not bilateral FX Master for either counterparty?

I considered (b) for both counterparties and rejected it on three grounds:

1. **No published netting opinion supports a bespoke bilateral FX Master.** ISDA's South Africa netting opinion is scoped to the ISDA 2002 Master Agreement (and 1992 Multicurrency Cross-Border, where applicable). A non-ISDA bilateral master would carry no published netting opinion, requiring either (i) a bespoke opinion from external counsel (cost + delay + arguably weaker than the ISDA opinion which incorporates ten-plus years of SA case-law commentary) or (ii) conservative treatment of netting as not enforceable, which would route both counterparties to the per-trade gross SA-CCR path (see Section 2).
2. **The OTC IRD/desk maturation roadmap forces an ISDA either way.** `Policies/trading-mandate-v1.md §2.4` requires ISDA + Schedule + CSA before any OTC IRD trade. Negotiating a bilateral FX Master first, then an ISDA second, is documentation duplication. The clean path is one master, executed once, covering FX-spot at controlled-launch and adding products as they pass NPA.
3. **Investec and Standard Bank both run ISDA-based legal-documentation pipelines.** As large SA banks, both have standard ISDA paper internal to their treasuries; their negotiation cost is lower starting from ISDA than from a bespoke bilateral form they would have to read fresh.

### 1.4 Why not none-listed spot-confirmation-only for either counterparty?

Considered for both counterparties and rejected because: (i) neither counterparty is a prime broker arrangement; both are direct bilateral dealer-to-dealer relationships where ISDA practice is the standard; (ii) absence of any master agreement leaves SA-jurisdiction netting unaccompanied by an opinion, which is a self-imposed regulatory weakness on a first-licensed bank's first FX-spot trade; (iii) the bank's posture under `Policies/trading-mandate-v1.md §1.1` is to operate at SA-Banks-Act-and-FRTB-aligned standard, not at the floor of street practice.

### 1.5 What about urgency — can the desk trade before ISDA is signed?

This is the practical question Helena's controlled-launch proposal raises by implication. ISDA negotiation between two SA Banks-Act counterparties typically takes 2–6 weeks once both legal departments are engaged with the same draft Schedule template. The Standard Bank and Investec legal teams are well-resourced and ISDA-fluent. I expect the gating event for first-trade to be ISDA execution for both counterparties.

I do not recommend trading any FX-spot under a "documentation-pending" posture. If commercial timing pressure arises (e.g. a client mandate the bank wants to honour before ISDA execution completes), the proper escalation is: Helena + Saskia (Head of Global Markets, governance) + me, raising whether to (a) wait for ISDA, (b) onboard a third counterparty whose ISDA is already in place, or (c) accept a temporary none-listed spot-confirmation-only posture with the SA-CCR engine flipped to the per-trade gross path for that counterparty. Option (c) is permitted but should be a deliberate, recorded Helena-CRO decision per the procedure addendum in Section 3.

---

## Section 2 — Implication for SA-CCR replacement cost

The SA-CCR engine's replacement-cost path is implemented at `prototype/platform/risk/sa-ccr/replacement-cost.ts` and selected at the netting-set boundary (`prototype/platform/markets/netting-sets/types.ts` + `prototype/platform/markets/netting-sets/enforceability.ts`).

The relevant decision points in the code are:

- `NettingSet.nettingEnforceable: boolean` — when `true`, the netting set's MTM is computed across the constituent trades and fed to `computeReplacementCost` as a single `vMtm`. When `false`, the engine must compute SA-CCR trade-by-trade with no netting benefit (see `enforceability.ts` line 6–14 and the policy citation at `Policies/credit-risk-policy-v1.md §3 line 136`).
- `NettingSet.csaPresent: boolean` — when `true`, the **margined** RC branch fires (`RC = max(V − C, MTA + TH, 0)`). When `false`, the **unmargined** RC branch fires (`RC = max(V, 0)`).

### 2.1 Code path for both controlled-launch counterparties

Given Section 1's recommendations (ISDA executed; no CSA; netting enforceable), the configuration for each counterparty's USD/ZAR netting set is:

| Counterparty | `nettingSetId` (convention `NS-<counterpartyId>-<ccy>`) | `csaPresent` | `nettingEnforceable` | RC formula |
|---|---|---|---|---|
| Standard Bank Corporate Treasury | `NS-<sb-party-id>-USD` (Party register ID to be assigned at counterparty onboarding) | `false` | `true` | Unmargined: `RC = max(V, 0)` per `replacement-cost.ts` line 94 |
| Investec Bank Treasury | `NS-<investec-party-id>-USD` | `false` | `true` | Unmargined: `RC = max(V, 0)` per `replacement-cost.ts` line 94 |

The `vMtm` fed into `computeReplacementCost` is the netting-set-aggregated MTM across the (single, at controlled-launch) FX-spot trade(s) outstanding with that counterparty. For an FX-spot trade between trade date and T+2 settlement, `vMtm` is the present-value of the future-dated leg from the bank's perspective, marked to current spot.

### 2.2 What Rohan (Head of Market Risk Measurement, engineering) must confirm

Rohan needs to confirm the following before the first trade fires the SA-CCR engine:

1. **Netting-set register enrolment for both counterparties.** A `ISDACSAAssessmentCompleted` event must be emitted for each counterparty's USD-denominated netting set, with:
   - `csaPresent: false` (ISDA executed but no CSA)
   - `nettingEnforceable: true`
   - `jurisdictionOpinionRef` set to the RMS document-store ID of the ISDA SA netting opinion (Bowmans 2024-04-15 or whatever is the latest at the moment of the assessment)
   - `currency: "USD"` (the netting-set currency — Credit Risk Policy §3 line 132 requires one netting set per counterparty per currency at v0)
2. **No CSA fields supplied.** Because `csaPresent: false`, neither `threshold` nor `mta` should be supplied; `replacement-cost.ts` line 82–86 explicitly throws if a margined netting set is missing either field, but it does not require the fields when unmargined — confirm the event-emission path matches.
3. **Currency invariant.** USD netting set means `vMtm` and `collateralHeld` (zero, because no CSA) must both arrive in USD. The current `assertCurrency` calls at `replacement-cost.ts` lines 66–67 will throw if there is drift. Since FX-spot trades are intrinsically two-currency, Rohan's MTM resolver must compute the per-counterparty USD-denominated MTM correctly (the bank's standard approach is to mark the USD leg's PV against current USD/ZAR spot).
4. **Note for v1 cross-product netting.** At v0, the netting set is single-currency. When FX-forwards and OTC IRD with the same counterparty land in later phases, cross-product netting (FX-spot + FX-forward + IRS in the same ISDA Master) is technically supported by ISDA §6 but **not recognised** by the bank's engine at v0 per `Policies/credit-risk-policy-v1.md §3 line 132`. Each currency / product class will form its own netting set until the v1 cross-product netting upgrade.

### 2.3 If Helena ever recommends none-listed posture (Section 1.5 escalation)

For completeness — should the Section 1.5 commercial-pressure escalation ever lead to a none-listed spot-confirmation-only posture for one counterparty, Rohan must enrol that counterparty's netting set with `nettingEnforceable: false`. The engine then computes SA-CCR trade-by-trade: each trade is its own degenerate netting set with `csaPresent: false`, `nettingEnforceable: false`, and `vMtm = max(per-trade MTM, 0)` per `replacement-cost.ts` line 94. There is no formal change to `replacement-cost.ts` to support this — the existing unmargined branch is correct; only the upstream aggregation changes (per-trade instead of per-counterparty).

---

## Section 3 — Procedure addendum (text only — do not edit `Procedures/by-policy/counterparty-onboarding-markets.md` in this run)

The current procedure `Procedures/by-policy/counterparty-onboarding-markets.md` Step 4 (Gate 2 — Legal documentation) is written as if ISDA is universally required for OTC derivatives and silent on the FX-spot-only case (Helena's scope review §6 G-9 and §312). Below is the **proposed addendum text** for that step; Saskia and I will author the formal procedure rewrite as a follow-on brief.

> **Step 4 — Gate 2 (Legal documentation), FX product extension.**
>
> **For FX-spot-only counterparties (no OTC IRD, no FX forward, no repo activity contemplated at onboarding):**
>
> - The default and recommended documentation form is the **ISDA 2002 Master Agreement with a South African Schedule**, covering FX transactions as "Transactions" within the meaning of ISDA §1(c). A Credit Support Annex (CSA) is not required for FX-spot-only at controlled-launch (no continuing MTM exposure beyond T+2 settlement window).
> - A **bilateral FX Master Agreement** (non-ISDA umbrella) is permitted only by explicit Imani (Chief Legal Counsel, governance) approval, justified by a written legal-opinion memorandum confirming SA-jurisdiction close-out netting enforceability for that specific bilateral form.
> - A **none-listed posture** (spot confirmation only, no umbrella master) is permitted only by explicit joint Helena (CRO, governance) + Saskia (Head of Global Markets, governance) + Imani (Chief Legal Counsel, governance) decision, recorded as a typed `Decision(approved)` event, on commercial-pressure grounds. When invoked, the corresponding netting set is enrolled with `nettingEnforceable: false`, forcing trade-by-trade SA-CCR per Credit Risk Policy §3 line 136.
>
> **Gate 2 pass condition (FX-spot extension).** Gate 2 passes for an FX-spot-only counterparty when either:
> 1. an ISDA 2002 Master Agreement with SA Schedule has been executed (the default), evidenced by a `LegalDocumentationSigned { agreementType: "isda" }` typed event; OR
> 2. a bilateral FX Master Agreement has been executed with Imani sign-off memorandum, evidenced by a `LegalDocumentationSigned { agreementType: "fx-bilateral" }` typed event (note: this `agreementType` value is a substrate addition — see Section 5 gap-2 below); OR
> 3. a recorded joint Helena + Saskia + Imani `Decision(approved)` event authorising the none-listed posture for the specified counterparty, with the corresponding `ISDACSAAssessmentCompleted` event emitted with `nettingEnforceable: false`.
>
> **Annual refresh.** Imani re-confirms ISDA SA netting opinion validity annually (the ISDA published opinion is refreshed annually by external counsel; the bank's `jurisdictionOpinionRef` on each affected netting set must point at the current opinion). A `JurisdictionalOpinionRefreshed` event (planned — see Section 5 gap-1) records the annual confirmation.

---

## Section 4 — Trading Mandate §3 amendment proposal (text only — do not edit `Policies/trading-mandate-v1.md` in this run)

`Policies/trading-mandate-v1.md §3` ("Client-Driven Mandate") is currently silent on the FX-spot legal-documentation choice — it covers eligible-counterparty categorisation (§3.1) and franchise / proprietary distinction (§3.2 / §3.3) but does not address the master-agreement form per product. The OTC IRD section at §2.4 line 116 mandates "fully executed ISDA suite" before any OTC IRD trade, but no analogous statement exists for FX-spot (§2.5).

Helena and Saskia own the policy. I propose the following amendment to §3 — inserted as a new §3.4 — to make the FX-spot master-agreement choice explicit:

> **§3.4 Legal-documentation defaults per product class.**
>
> Every counterparty enabled under §3.1 must execute the master-agreement form below before any trade is booked against that counterparty in the listed product class. The default forms are:
>
> | Product class | Default master-agreement form | CSA / collateral annex requirement | Authority for non-default form |
> |---|---|---|---|
> | OTC IRD (§2.4) | ISDA 2002 Master Agreement with South African Schedule + Credit Support Annex | CSA mandatory before any trade | None — ISDA + CSA is non-negotiable |
> | FX-spot only (§2.5 — FX-spot rows) | ISDA 2002 Master Agreement with South African Schedule | CSA not required at controlled-launch; mandatory once FX-forward, OTC IRD or repo activity is added with the same counterparty | Bilateral FX Master Agreement permitted with Imani (Chief Legal Counsel, governance) approval; none-listed permitted only by joint Helena + Saskia + Imani `Decision(approved)` event |
> | FX-forward / FX-swap (§2.5 — non-spot rows) | ISDA 2002 Master Agreement with South African Schedule + Credit Support Annex | CSA mandatory before any trade | None |
> | Repo / Reverse-repo (§2.3 — repo row) | GMRA 2011 with South African Annex | Per GMRA collateral schedule | None — GMRA + SA Annex is non-negotiable |
> | Bond / Equity cash secondary-market (§2.2, §2.3) | None bespoke; ECMA / JSE Rules govern; trading-relationship terms via standard onboarding documents | n/a | n/a |
>
> The same counterparty trading multiple product classes executes the strictest applicable master-agreement form. An ISDA covering both FX and IRD is the dominant case for institutional counterparties; the entry above is per-product to make the **floor** explicit, not to imply per-product duplication.
>
> Netting enforceability per executed master is recorded in the netting-set register (`@platform/markets/netting-sets`) via `ISDACSAAssessmentCompleted` events. The SA-CCR engine reads the resulting `nettingEnforceable` and `csaPresent` flags to select the replacement-cost code path per `prototype/platform/risk/sa-ccr/replacement-cost.ts` and Credit Risk Policy §3 lines 129 and 136.

The amendment is purely additive (a new §3.4 in §3); it does not modify any existing §3.1–§3.3 text and does not create new obligations beyond what is already implicit in `§2.4` and `Procedures/by-policy/counterparty-onboarding-markets.md`. It is a documentation-discipline upgrade, not a substantive change.

---

## Section 5 — Gaps

The following gaps remain after this decision. None is papered over.

| # | Gap | Impact | Owner | Priority |
|---|---|---|---|---|
| 1 | **`JurisdictionalOpinionRefreshed` typed event not defined.** The bank requires an annual confirmation that ISDA's South Africa netting opinion has been refreshed by external counsel; in the absence of a typed event, the annual confirmation lives only in the markdown procedure. Principle 1 says the event log is the source of truth — the refresh confirmation must become a typed event so Vera (Internal Audit, governance) can run a recon over staleness. | Annual refresh confirmation lives outside the event log; cannot be programmatically asserted. | Atlas (Core banking platform architect, engineering) + Imani | Next compliance-substrate slice. |
| 2 | **`LegalDocumentationSigned.agreementType` enum lacks `"fx-bilateral"`.** The current procedure (`Procedures/by-policy/counterparty-onboarding-markets.md` Step 5) defines `agreementType: 'isda' \| 'csa' \| 'gmra' \| 'gmra-sa-annex'`. The procedure addendum in Section 3 references `agreementType: "fx-bilateral"` to cover the non-default bilateral FX Master path. The enum widening is a substrate edit on the markets CDM event catalogue. | The non-default bilateral FX Master path cannot be expressed in the event log today; an Imani sign-off memorandum approving that path would have no corresponding typed event until the enum widens. | Atlas + Imani | When first non-ISDA FX-spot counterparty is contemplated (likely never under controlled-launch, but the substrate gap should be queued). |
| 3 | **ISDA SA netting opinion document not yet stored in RMS document store.** This deliverable cites the Bowmans 2024-04-15 ISDA SA netting opinion by reference, but the document itself is not yet in the RMS document store with a content-addressed hash. Without a stored copy, the `jurisdictionOpinionRef` on the `ISDACSAAssessmentCompleted` event cannot be a substantive content-hash reference; it would be a placeholder string. | The netting-set register's `jurisdictionOpinionRef` field carries a string identifier with no backing content-hash; Vera's downstream recon cannot verify the opinion is actually on file. | Imani (file retrieval) + Atlas (RMS ingestion path) | Before first counterparty onboarding under this procedure addendum. |
| 4 | **Standard Bank and Investec Party register IDs not yet assigned.** The Party register at `Regulations/_party-register.md` does not currently carry rows for either counterparty (search confirms zero hits as of 2026-05-20). The `nettingSetId` convention `NS-<counterpartyId>-<ccy>` cannot be computed until those Party register IDs exist. | The netting-set register cannot be populated until the Party register is populated. Counterparty-onboarding procedure (`PROC-MK-CO-01` Gate 1) is expected to handle this, but I flag it explicitly because Helena's controlled-launch proposal (PR #634) and this deliverable both assume Party register coverage will land before first trade. | Saskia + Imani (Party register authoring) | Before first counterparty onboarding under PROC-MK-CO-01. |
| 5 | **Annual ISDA SA netting opinion refresh discipline not codified.** Section 3's procedure addendum says I will re-confirm validity annually, but no recon pipeline asserts that I actually have done so. The substrate primitive is a `recon:jurisdictional-opinion-staleness` pipeline tracking the gap between the latest `JurisdictionalOpinionRefreshed` event and the present moment, with a threshold (e.g. 13 months — one month after the expected annual refresh) at which Vera surfaces a finding. | Without the recon, the bank could drift past an ISDA opinion refresh year unnoticed; an old opinion might no longer reflect SA case-law developments. | Vera + Imani | After gap-1 is closed (the recon depends on the event existing). |
| 6 | **Cross-product netting v1 upgrade — sequencing question.** Credit Risk Policy §3 line 132 limits the engine to single-currency, single-product netting at v0. Once the bank adds FX-forward (still under the same ISDA Master as FX-spot), economically the close-out netting should apply across spot and forward with the same counterparty under the same ISDA. The engine's current `nettingSetId = NS-<counterpartyId>-<ccy>` granularity treats spot and forward as separate netting sets even though one ISDA governs both. This is a v1 upgrade item, not a gap in this deliverable, but it is the next legal-engine alignment question once FX-forward goes live. | Conservative SA-CCR overstates exposure until cross-product netting v1 lands (no understatement risk; this is a capital-efficiency item, not a regulatory-breach item). | Imani + Rohan | Sequenced for the FX-forward NPA-gate work-pack, not before. |

---

*Imani (Chief Legal Counsel, governance — legal-entity & clause-library agent)*
