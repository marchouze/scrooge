# Risk Appetite Statement and Framework

**Author:** Helena (CRO — lead)
**Contributors:** Rohan (risk engineer), Zara (CCO), Eitan (Treasurer), Senna (security), Camille (CFO), Imani, Vera
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Note on derivation (Principle 6).** The RAS is the *policy* layer. The RAF is the *standard* layer that codifies how the RAS is operated, monitored, and breached. Operational limits and KRIs sit at the standard layer; live limits and breaches are *data*. Board RAS document (this) is a **summary** of the operational stack — never the original.

> **Note on entity-scope of this RAS (added 2026-05-09 by Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) under CEO decision `D-REGULATORY-PERIMETER`, approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` / PR #85).** This RAS is a **`Hoz Bank Limited` document**, not a `Hoz Group Limited` document. The risk appetite is set, governed, and reported at the **bank-entity** level. The SARB Prudential Authority's consolidated-supervision powers under **Banks Act 94 of 1990 § 60+** `[citation: TBC — exact § 60-series sub-section index for parent-of-bank designation, group capital adequacy, group large-exposures, group recovery-plan]` operate as a **look-through** *via* the bank entity — the PA does not separately license, supervise, or set prudential ratios on `Hoz Group Limited` as a stand-alone, but the PA may require certain metrics to be **assessed on a consolidated basis** (group-wide capital, group-wide liquidity, group-wide concentration). The bank therefore reports both entity-level and consolidated-basis figures for the metrics the PA assesses on a consolidated basis; the **appetite line itself is set at the entity level**, with the consolidated view monitored, not separately appetite-bound. See §A4 ("Entity scope of this RAS") and §B14 ("PA look-through framing in RAS / ICAAP / ILAAP") below.

---

# Part A — Risk Appetite Statement (Board-level)

## A1. Overarching statement

The bank takes risk **only to deliver its strategy** — to be a fully-coded, regulator-credible, customer-respected South African bank operating to BCBS and King IV standards. The bank prefers measured returns built on disciplined risk-taking, transparent reporting, and resilient operations to faster returns built on uncontrolled exposures or operational shortcuts.

The bank operates under a **zero-tolerance** appetite for: regulatory breach, financial-crime facilitation, material misstatement of financial position, customer harm caused by the bank's conduct, and material data breach. Wherever risk is taken, it is taken within explicit limits, with explicit ownership, and against citable authority.

## A2. Appetite by risk category

### Credit risk
*`riskTaxonomy: RT-CR`*

- Appetite for **measured** lending activity, primarily SA, with concentration limits per single name, sector, and geography.
- IFRS 9 ECL stage migrations within calibrated tolerances; significant unexpected migration triggers RAS review.
- Counterparty credit (markets) appetite calibrated to the trading franchise; dispatched via Helena's policy and operated by Saskia / Eitan.

### Market risk
*`riskTaxonomy: RT-MK`*

- Appetite for **client-driven and franchise** market-making in FX, rates, money markets initially; expansion subject to BRC approval.
- VaR, sensitivities, and concentration limits set by Helena, operated by Saskia.
- No proprietary risk-taking outside warehoused franchise hedge positions.

### Liquidity and funding risk
*`riskTaxonomy: RT-LQ`*

- Appetite for stable, **textured funding**: wholesale + deposit + capital, no thin reliance on any single counterparty or tenor.
- LCR target buffer **above PA-set minimum** (target buffer set in RAF §B3).
- NSFR target buffer **above PA-set minimum** (target buffer set in RAF §B3).
- Intraday liquidity discipline at SAMOS-funding scale; zero-tolerance for end-of-day overdraft except under contingency-funding plan.

### IRRBB
*`riskTaxonomy: RT-IRRBB`*

- Appetite calibrated to a **conservative** EVE and NII sensitivity profile relative to capital and earnings.
- Hedging is the default; un-hedged behavioural assumptions documented and BRC-approved.

### Operational and cyber risk
*`riskTaxonomy: RT-OP` (cyber clauses tag `RT-OP.CY`; resilience clause tags `RT-OP.RE`; settlement-processing clause tags `RT-OP.PA`)*

- Appetite for **operational disruption tolerable but recoverable within stated impact tolerances** (set per BCBS Operational Resilience principles).
- Zero-tolerance for: avoidable material data breach; settlement failure caused by internal action; payments outage outside resilience windows.
- Cyber: aligned with Joint Standard 1 of 2024; severity tiers (RAF §B6).

### Conduct risk
*`riskTaxonomy: RT-CD`*

- **Zero appetite** for treating customers unfairly, mis-selling, fee opacity, conflicts of interest unmanaged, or market abuse.

### Financial-crime / AML / sanctions risk
*`riskTaxonomy: RT-FC` (sanctions-specific clauses tag `RT-FC.SA`; AML clauses tag `RT-FC.ML`)*

- **Zero appetite** for facilitating financial crime; entering into sanctioned-entity relationships; or onboarding without satisfying CDD.
- Calibrated appetite for residual financial-crime risk after controls (typology-based — see RAF §B5).

### Legal and regulatory risk
*`riskTaxonomy: RT-LR`*

- Zero appetite for known regulatory breach.
- Calibrated appetite for legal-positions uncertainty in evolving areas (e.g., COFI, climate disclosure) provided positions are documented, register-linked, and reviewed.

### Strategic and reputational risk
*`riskTaxonomy: RT-ST` (strategic) + `RT-RP` (reputational) — decomposed per register §6 mapping rules: the strategic-alignment clause anchors at `RT-ST`; the reputation-as-leading-indicator clause anchors at `RT-RP` as the second-order shadow axis across all first-order nodes.*

- Risk-taking aligned to strategy; no off-strategy adventures; reputation is treated as a leading indicator of all other risks.

### Model risk
*`riskTaxonomy: RT-OP.MD` (per-tier sub-classification at level 3: `RT-OP.MD.T1` / `RT-OP.MD.T2` / `RT-OP.MD.T3` per model)*

- Appetite for modelled decisioning provided models are tier-classified, validated, monitored, and challenged (RAF §B7).
- Tier-1 models (regulatory capital, IFRS 9 ECL, AML) have stricter validation; tier-3 (operational analytics) lighter touch.

### Climate risk
*`riskTaxonomy: RT-CL` (transverse risk per register §3 — manifests through `RT-CR`, `RT-MK`, `RT-OP`, `RT-LQ`, `RT-ST`, `RT-RP`; per-exposure tagging at level 2: `RT-CL.PH` / `RT-CL.TR` / `RT-CL.LI` / `RT-CL.NA` / `RT-CL.SO`)*

- Aligned with PA Guidance Note 1 of 2024.
- Climate dispatched through credit, operational, strategic, and conduct lenses.
- Initial appetite: **assess**, **disclose**, **avoid clearly inconsistent exposures**.

## A3. Appetite multipliers across P5

The appetite levels above apply **per legal entity** and, where currency-sensitive, **per significant currency**. As entities or jurisdictions are added (P5), the RAS is replicated by template; absolute amounts are jurisdiction-specific.

## A4. Entity scope of this RAS

> *Added 2026-05-09 by Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) under CEO decision `D-REGULATORY-PERIMETER` (approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` / PR #85). The framing refines `D-LEGAL-ENTITY-TREE-V0` (PR #82) at the regulatory-perimeter layer.*

The bank is structured as a three-entity group (`Hoz Group Limited` non-operating parent; `Hoz Bank Limited` regulated bank; `Hoz Securities Limited` JSE-member / FSP-OTC-Derivative-Provider). The CEO has codified the **regulatory perimeter per entity**: `Hoz Bank Limited` is supervised by the SARB Prudential Authority under the Banks Act; `Hoz Securities Limited` is supervised primarily by the JSE (FSCA / FAIS secondarily); `Hoz Group Limited` is **not separately regulated** as a stand-alone — it sits under Companies Act 71 of 2008 only, with the SARB PA exercising consolidated-supervision powers via **look-through** through the bank.

This RAS therefore binds at the **bank-entity level**. The risk appetite — every line in §A2, every default in Part B — is set, governed, monitored, and breach-reported at `Hoz Bank Limited`. There is no separate group-level RAS; there is no separate group-level appetite line. Where the PA requires a metric on a consolidated basis (group-wide capital, group-wide liquidity, group-wide concentration, consolidated cyber-resilience programme, consolidated recovery plan), that metric is the **bank's RAS metric measured on a consolidated basis** — not a separate group RAS line. See §B14 for the per-metric pattern.

**Implications for related documents.**

- The **B-cluster appetite lines (L-B8a-1..5)** introduced under `D-RAS-B-CLUSTER-CONCENTRATION-LINES` (CEO ratified 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-ras-b-cluster-concentration-lines.md` / PR #67) are bank-entity appetite lines, measured at the entity level. The named-pair correspondent posture (Standard Bank + FirstRand primary; Absa + Nedbank reserve) binds on `Hoz Bank Limited`'s SARB Authorised Dealer relationships under the Currency and Exchanges Manual. **No change to the numerical lines.**
- **Hoz Securities Limited** has its own risk taxonomy under JSE Membership Rules + FSCA conduct + FMA / Joint Standard 2 of 2020 (ODP). A separate Securities-entity risk-appetite document is a future deliverable, scoped under Saskia (Head of Global Markets, governance) + Kai (Trading systems engineer) when Hoz Securities Limited's M-phase build approaches commencement-of-trading. Until then, trading-franchise risk-taking on the bank's balance sheet is governed by this RAS at the bank-entity level.
- **Hoz Group Limited** does **not** have its own RAS. As a Companies Act-only entity its risk profile is constituted by its participation in the bank and securities entities and the related-party regime under IFRS 10 / IAS 24 — the consolidated-supervision metrics the PA may assess are bank-RAS metrics measured on a consolidated basis (per §B14), not group-RAS metrics.

**Authority and citations.**

- **Banks Act 94 of 1990 § 60+** (parent-of-bank / controlling-company / consolidated-supervision regime) `[citation: TBC — exact § 60-series sub-section index]`.
- **BCBS Corporate Governance Principles for Banks** (2015 revision) — Principle 1 ("Board's overall responsibilities") and Principle 5 ("Governance of group structures") `[citation: TBC — exact Principle 5 paragraphs on parent-board oversight of subsidiaries; Principle 1 paragraphs on bank-board RAS ownership]`.
- **BCBS 144** (Principles for the home-host supervisor relationship; consolidated-supervision context) `[citation: TBC — exact paragraph index]` — used as a reference for the look-through pattern, even though Hoz is single-jurisdiction at this stage (P5 multi-jurisdiction expansion would activate the home-host dimension).
- **BCBS D295** (Corporate governance principles for banks — earlier edition) and **BCBS D335** (Guidelines on Corporate governance principles for banks) `[citation: TBC — paragraph indexes for risk-appetite and group-governance principles]` — referenced for the discipline that risk appetite is owned at the regulated-bank level under board accountability, not at the unregulated parent.
- CLAUDE.md **Principle 5 — multi-entity from day one**.
- CLAUDE.md **Principle 2 — every action traces to a source**.

---

# Part B — Risk Appetite Framework (Standard layer)

## B1. Operational limits and KRIs

*`riskTaxonomy: RT-OP`*

The RAS cascades into **operational limits and KRIs** which the platform enforces in real time. Limits are not documents; they are coded events.

Structure:
```
Limit { id, category, scope (entity, currency, counterparty, product),
        threshold, breach_event_type, owner, citation, version }
```

KRI structure:
```
KRI { id, category, definition, projection_query, threshold_amber, threshold_red,
      owner, citation, breach_event_type, version }
```

Live limit values are queries over the event log + RAS-in-force. Breaches are events; escalation is automated.

## B2. Defaults — credit & concentration

*`riskTaxonomy: RT-CR.CC`*

- Single-name large-exposure limit aligned to BCBS large-exposures framework, capped below regulatory ceiling.
- Sector concentration: no sector >25% of exposure without BRC approval.
- Geographic concentration: SA majority by design; cross-border exposure capped per RAS multiplier.

## B3. Defaults — liquidity and capital buffers

*`riskTaxonomy: RT-LQ.FN`*

- **LCR buffer:** target operate at **120% of PA minimum** in normal conditions; trigger management action below 110%; mandatory BRC escalation below 105%.
- **NSFR buffer:** target operate at **115% of PA minimum**; trigger at 108%; escalate at 103%.
- **Capital buffer:** target operate above **all PA-set minima + Pillar 2A + capital conservation buffer + 1.5pp management buffer** in CET1; trigger at PA minimum + 0.75pp; escalate at PA minimum + 0.25pp.

(Specific numerical buffers calibrated by Helena and Camille in the ICAAP / ILAAP cycle; values above are the policy floor.)

## B4. Defaults — market risk

*`riskTaxonomy: RT-MK`*

- VaR limits per desk (initially: FX, rates, money markets) calibrated against franchise size; reviewed monthly until stable, then quarterly.
- Stress losses capped at a fraction of capital buffer.
- Position concentration and tenor concentration limits per asset class.

## B5. Defaults — financial-crime / sanctions

*`riskTaxonomy: RT-FC`*

- **Sanctions matching:** all true-positive matches blocked end-to-end pre-execution. Any production override is a Zara-signed event with concurrence, and a register-linked exception.
- **PEP / EDD onboarding:** documented EDD before activation.
- **Continuous-KYC restriction default (CEO-deferred decision):** **restrict-on-review** for medium-confidence triggers (adverse media, behavioural anomaly, registry-change); **restrict-immediately** for high-confidence triggers (sanctions hit, court order, beneficial-ownership change crossing a control threshold). The two-tier default is set here; Mira's pipeline implements both branches as already designed.
- **STR filing:** Zara's judgement, no internal override.

## B6. Defaults — cyber-incident severity tiers

*`riskTaxonomy: RT-OP.CY`*

Aligned with Joint Standard 1 of 2024 and Senna's IR programme.

| Tier | Description | Notification | Authority |
|---|---|---|---|
| 1 | Minor — internal only, no customer impact | Internal log only | Senna |
| 2 | Moderate — limited customer impact, contained | Internal escalation + Iris pre-screen | Senna + Devon |
| 3 | Major — material customer impact or external dependency | POPIA pre-screen; Regulator pre-notification | Devon + CRO + IO |
| 4 | Critical — systemic impact, breach material | Regulator notification; customer notification | CEO + CRO + IO + (interim) CISO |

Decision criteria coded; uplift always permitted; downgrade requires CRO concurrence.

## B7. Defaults — model risk tiers

*`riskTaxonomy: RT-OP.MD`*

| Tier | Examples | Validation |
|---|---|---|
| Tier 1 | Regulatory capital RWA models; IFRS 9 ECL; AML monitoring core models | Independent validation pre-deployment; annual revalidation; monitoring continuous |
| Tier 2 | Pricing engines; risk sensitivities; behavioural-deposit models | Independent validation pre-deployment; biennial revalidation |
| Tier 3 | Operational analytics; customer-segmentation; non-decisioning models | Internal review; sample audit |

Rohan develops; an **independent validation function** reports to Helena. Validators do not also build (segregation).

## B8. Defaults — concentration & counterparty (markets)

*`riskTaxonomy: RT-CR.CP`*

- Per-counterparty exposure caps; netted under enforceable ISDA / GMRA where Imani's opinions support netting.
- Sovereign / government concentration: SA government acceptable; other-sovereign caps per BRC.

## B8a. Defaults — FX-settlement & correspondent-bank concentration (B-cluster)

*`riskTaxonomy: RT-OP.PA` for all five lines (operational payments-and-settlement processing; per register §4.5 — loss from failed or mis-routed payments and settlements in the operational pipeline, distinct from `RT-CR.SL` Herstatt settlement-credit risk). Secondary axes noted per line in the table: `RT-OP.TP.MS` (third-party-market-services concentration) on L-B8a-1 / L-B8a-2 / L-B8a-5; `RT-OP.RE` (operational-resilience readiness) on L-B8a-4; `RT-CR.SL.FX` (Herstatt-credit) attaches at incident time only if a settlement actually fails. Reconciliation with §B8 counterparty-credit `RT-CR.CP` / `RT-CR.CC` is preserved by the "Reconciliation with §B8" paragraph in the body.*


> *Added 2026-05-09 by Helena (CRO, governance lead) and Rohan (Risk engineer) under decision **D-RAS-B-CLUSTER-CONCENTRATION-LINES** (proposed; CEO ratification pending), derived downward (Principle 6) from CEO decision **D-FX-CORRESPONDENT-PAIR-NAMING** (approved 2026-05-09; record at `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fx-correspondent-pair-naming.md`). The structural posture — single primary correspondent + single live backup, no direct CLS / SAMOS membership during the build phase — comes from the operating-model memory `project_indirect_participant_posture.md`. The appetite lines below are calibrated **at** that posture, not above it: they exist to detect drift away from the named-pair design (e.g., a third unsanctioned correspondent emerging, or the backup atrophying so the bank slips to 100% single-counterparty in non-test conditions), so that Vera (Internal-audit / continuous-assurance engineer) raises a continuous-controls finding rather than the figure being silently normalised.*

The lines apply to **intraday FX-settlement notional routed through correspondent-bank rails** (i.e., the population of `FxSettlementInstructed` events in a UTC settlement-day window, grouped by `correspondent` party). They do not apply to non-settlement counterparty exposure (covered at §B8) or to credit-concentration to the same banking groups as wholesale-funding counterparties (covered at §B2 / treasury appetite).

| Line | Threshold (steady-state) | Threshold (switch-test window) | Severity at breach | Citation |
|---|---|---|---|---|
| **L-B8a-1** Single-counterparty intraday FX-settlement notional, % of daily total routed via correspondent rails | ≤ 97% | ≤ 99% | `Hard` (mandatory action: Tomas + Eitan investigate; if not within window within 2 settlement days, escalate to BRC) | `D-FX-CORRESPONDENT-PAIR-NAMING` · `project_indirect_participant_posture.md` · BCBS Principles for Sound Management of Operational Risk (2021) — concentration of operational dependencies [citation: TBC — BCBS instrument section] |
| **L-B8a-2** Top-2 cumulative intraday FX-settlement notional, % of daily total | ≤ 100% by design | ≤ 100% | Structural — line is **observational**, not breach-triggering. A drift below 100% means routing has leaked to an unsanctioned third correspondent → `Critical` breach (immediate escalation to CEO + CRO + COO) | `D-FX-CORRESPONDENT-PAIR-NAMING` · Indirect-participant posture memo |
| **L-B8a-3** Switch-test window override — single-counterparty cap is widened to **L-B8a-1 switch-test column** during a Tomas-filed `SwitchTestWindow` event covering quarterly + triggered tests; 5–10% backup-routing live test runs inside the override | n/a (override) | window-bounded | n/a — the override exists so the test itself does not fire L-B8a-1 | Tomas's switch-test runbook in proposal `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md` |
| **L-B8a-4** Backup-readiness (FirstRand-RMB) — last successful switch-test ≤ 100 days ago | ≤ 100 days | n/a | `Hard` (a stale backup means the named-pair posture is not actually two-deep; routing-policy projection must show backup-live state within 30 days or escalate) | `D-FX-CORRESPONDENT-PAIR-NAMING` · BCBS Principles for Operational Resilience (2021) [citation: TBC — BCBS instrument section] |
| **L-B8a-5** Reserve-correspondents (Absa, Nedbank) contract-status drift — held-in-reserve contracts must remain at "active-but-dormant" (signed master, no live volume) | active-but-dormant | n/a | `Soft` (monitor; if reserve-correspondent contract lapses, BRC reviews whether the held-in-reserve list still satisfies the operational-resilience expectation) | `D-FX-CORRESPONDENT-PAIR-NAMING` · BCBS Operational Resilience [citation: TBC] |

**Structural rationale (load-bearing).** The bank is an **indirect participant** in CLS and SAMOS during the build phase: it accesses these critical market infrastructures via sponsor / correspondent banks, not directly. That is a deliberate operating-model choice (memory `project_indirect_participant_posture.md`), not a gap in risk discipline. Combined with the named-pair correspondent decision (one primary, one backup, two reserves, no extra-pair routing), it produces the ~95% single-counterparty / ~100% top-2 concentration figures recorded in PR #58. Setting the appetite lines **at** that posture (97% / 100%) — rather than at a wider headroom that would imply we expect to fan out across more counterparties — codifies the structural reality and ensures any drift away from the named-pair design **breaches** rather than silently normalising. The switch-test window override (L-B8a-3) is designed so the very mechanism that *proves* the backup is alive does not itself fire L-B8a-1.

**Reconciliation with §B8.** §B8 governs **counterparty-credit** concentration (loss given default of a trading counterparty); §B8a governs **operational-settlement-rail** concentration (loss / disruption from a single payments correspondent failing or being unavailable). They share counterparties (Standard Bank's group is a credit counterparty *and* a payments correspondent) but score them differently. Aggregation across both lenses is reviewed by BRC at each cycle.

**Continuous-controls hookup.** A new register row `urn:obligation:bank:risk:b-cluster-fx-settlement-concentration:v1` (Mira, in `Regulations/_obligations-register.md`) anchors these lines as obligations the recon harness must test. The v0 substrate is a register-only entry with a typed stub; the real recon will compute daily concentration over `FxSettlementInstructed` events grouped by `correspondent` and emit a `LimitBreach` event when any of L-B8a-1 / L-B8a-2 / L-B8a-4 is breached. Substrate gap captured at §"Substrate gaps" in the handover note.

**Review cadence.** L-B8a lines are reviewed at every BRC tick alongside §B8; reviewed in-flight after any `SwitchTestReport` Tomas files; and re-calibrated at the next M-phase milestone if D-FX-CORRESPONDENT-PAIR-NAMING is itself revisited (e.g., if a third correspondent is added to the live-routing set, or if direct-participant access to CLS / SAMOS is approved).

## B9. Breach event taxonomy

*`riskTaxonomy: RT-OP.PR`*

```
LimitBreach { limit_id, threshold_value, observed_value, severity, owner,
              detected_at, citation, escalation_path }
```

Severity levels: `Soft` (within tolerance band, monitor), `Hard` (mandatory action), `Critical` (immediate escalation to CEO + CRO).

For each breach severity:
- Mandatory action set in the limit definition.
- Escalation path coded — Soft → first-line owner; Hard → second line; Critical → BRC + CEO.
- Closure requires either restoration within mandated time or a register-linked policy variance approved at the right authority.
- Breach events are immutable; "fixes" are restoration events with full lineage.

## B10. Review and update cadence

*`riskTaxonomy: RT-LR.RC`*

- **RAS:** Annual board approval; ad-hoc updates only on material change (new product, new entity, new jurisdiction, material loss, regulatory change). Each update is a versioned event with a register citation.
- **Limits / KRIs:** Reviewed quarterly by BRC; live recalibration permitted within RAS bounds.
- **Defaults set here (§§B5–B7):** Reviewed at least annually by BRC and after any material incident.

## B11. Reporting

*`riskTaxonomy: RT-LR.RC`*

- **Board RAS pack** — generated quarterly. Standing items: RAS coverage, breaches, near-misses, emerging risks. (P6 — generated, not assembled.)
- **BRC pack** — generated monthly. Standing items: limits dashboard, breach summary, KRI heatmap, regulatory-engagement log, model-risk inventory, climate-risk progress.
- **ALCO pack** — Eitan-chaired weekly; standing items: liquidity dashboard, IRRBB sensitivities, FX position, FTP attribution.
- All packs are **summarised derivations** of the live limit and event data — Principle 6.

## B12. Governance over the RAS / RAF

*`riskTaxonomy: RT-ST.GV`*

- Helena owns the RAS / RAF as a policy artefact.
- Owen runs the Board pathway.
- Mira ensures every appetite line and every limit is register-linked.
- Vera audits the framework's effectiveness independently.
- The RAS / RAF is itself a register entry, citing Banks Act, BCBS principles, FIC Act, FAIS, POPIA, Joint Standard 1 of 2024, King IV, Companies Act, IFRS 9 — among others.

## B13. Co-dependence with the Governance Framework

*`riskTaxonomy: RT-ST.GV`*

This RAS / RAF is intentionally co-tabled with the **governance framework** (`Owner Inbox/2026-05-06_governance-framework.md`). The governance framework provides the *structures* (Board, BRC, AC, ALCO, S&E, RemCo, NomCo, three lines of defence). This RAS / RAF provides the *content* those structures govern. Approvals must be congruent; changes to one require review of the other.

## B14. PA look-through framing in RAS / ICAAP / ILAAP

*`riskTaxonomy: RT-LR.RC`*

> *Added 2026-05-09 by Helena (Chief Risk Officer, governance) + Rohan (Risk engineer) under CEO decision `D-REGULATORY-PERIMETER` (record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` / PR #85). Companion to §A4. Substrate gap #5 from the decision record ("PA look-through framing in RAS / ICAAP / ILAAP — Helena + Rohan substrate work; v1") is closed at the framing layer; the consolidated-basis metric **computation** is the v1 substrate task.*

The SARB Prudential Authority's consolidated-supervision regime under **Banks Act 94 of 1990 § 60+** `[citation: TBC — exact § 60-series sub-section index]` requires the PA to be able to assess prudential metrics on a **consolidated basis** across the banking group (the bank entity plus subsidiaries / structured entities consolidated under IFRS 10), even where those subsidiaries are not themselves prudentially licensed. The legal obligation, however, **binds on `Hoz Bank Limited`** as the regulated entity — the bank produces the consolidated metric, the bank is held to PA expectations on it, and the bank's RAS is the document under which the metric is governed.

Operationally, this means: for each prudential metric the PA assesses on a consolidated basis, the bank reports the metric **at two scopes** — entity-level (`Hoz Bank Limited` stand-alone) and consolidated-basis (`Hoz Bank Limited` + `Hoz Securities Limited` + any future consolidated entity, with IFRS 10 consolidation eliminations and IAS 27 minority-interest treatment where applicable). The **appetite line is set at the entity level** (per §A4); the **consolidated view is monitored** as part of the PA look-through dialogue, but is not itself a separate RAS line. If the consolidated view drifts in a direction the PA flags or the BRC views as material, the response is either (a) a tightening of the entity-level appetite line under §B10 review cadence, or (b) a structural change at the subsidiary level (e.g. capping Hoz Securities Limited's balance-sheet usage) — never the creation of a parallel group-RAS line.

### B14.1 Capital metrics

*`riskTaxonomy: RT-CR`*

For each capital metric the bank reports both entity-level and consolidated-basis figures:

| Metric | Entity-level appetite line | Consolidated-basis monitoring | Citation |
|---|---|---|---|
| **CET1 ratio** | RAS §B3 — PA minimum + Pillar 2A + capital conservation buffer + 1.5pp management buffer; trigger PA min + 0.75pp; escalate PA min + 0.25pp. **Set at `Hoz Bank Limited`.** | Consolidated CET1 computed under IFRS 10 consolidation (eliminate intra-group exposures, recognise minority interests per IAS 27); reported alongside entity CET1 in BRC pack §B11; PA assesses both. | Banks Act § 60+ `[citation: TBC]`; BCBS Basel III/IV consolidated-capital framework `[citation: TBC — exact paragraph index]` |
| **Tier 1 ratio** | RAS §B3 — same buffer pattern as CET1 with AT1 stack. **Set at `Hoz Bank Limited`.** | Same — consolidated Tier 1 reported as monitored metric. | Same as CET1 |
| **Total capital ratio** | RAS §B3 — entity-level. | Same — consolidated Total Capital reported as monitored metric. | Same as CET1 |
| **Leverage ratio** | RAS §B3 — entity-level above PA-set minimum. | Consolidated leverage ratio under BCBS leverage-ratio framework `[citation: TBC — exact BCBS paragraph index]`; reported as monitored metric. | BCBS leverage ratio framework `[citation: TBC]` |

The PA assesses both scopes; the appetite line is entity-level (the consolidated view is monitored, not separately appetite-bound) per §A4.

### B14.2 Liquidity metrics

*`riskTaxonomy: RT-LQ`*

| Metric | Entity-level appetite line | Consolidated-basis monitoring | Citation |
|---|---|---|---|
| **LCR** | RAS §B3 — 120% of PA minimum normal; 110% trigger; 105% escalate. **Set at `Hoz Bank Limited`.** | Consolidated LCR aggregating HQLA and net cash outflows across `Hoz Bank Limited` + consolidated subsidiaries with restricted-cash adjustments per BCBS LCR §50 et seq. `[citation: TBC — exact BCBS LCR paragraph for consolidated treatment]`; reported alongside entity LCR in ALCO pack §B11. | Regs Relating to Banks LCR provisions `[citation: TBC]`; BCBS LCR consolidated-treatment paragraphs `[citation: TBC]` |
| **NSFR** | RAS §B3 — 115% of PA minimum normal; 108% trigger; 103% escalate. **Set at `Hoz Bank Limited`.** | Consolidated NSFR aggregating ASF and RSF across consolidated entities; reported as monitored metric. | BCBS NSFR consolidated-treatment paragraphs `[citation: TBC]` |
| **IRRBB** | RAS §A2 IRRBB — conservative EVE and NII sensitivity profile relative to capital and earnings. **Set at `Hoz Bank Limited`.** Hedging is the default. | IRRBB on a consolidated banking-book basis where Hoz Securities Limited carries banking-book exposures (in practice unlikely under the institutional-trading mandate; trading-book exposures stay outside IRRBB and inside market-risk warehouse). | BCBS Standards on IRRBB `[citation: TBC — exact paragraph for consolidated banking-book scope]` |

### B14.3 Concentration metrics

*`riskTaxonomy: RT-CR.CC`*

| Metric | Entity-level appetite line | Consolidated-basis monitoring | Citation |
|---|---|---|---|
| **Single-counterparty large-exposure** | RAS §B2 / §B8 — single-name large-exposure capped below regulatory ceiling. **Set at `Hoz Bank Limited`.** | Consolidated single-counterparty exposure aggregating `Hoz Bank Limited` + `Hoz Securities Limited` exposures to the same counterparty / connected-counterparty group per BCBS Large Exposures framework consolidated-treatment paragraphs `[citation: TBC — exact paragraph index for consolidated single-counterparty treatment]`; reported as monitored metric. The consolidated view tightens economic exposure where the same counterparty appears on both balance sheets. | BCBS Supervisory Framework for measuring and controlling large exposures (D283) `[citation: TBC — exact paragraph index]`; Regs Relating to Banks large-exposures provisions `[citation: TBC]` |
| **Top-N cumulative concentration** | RAS §B2 — sector ≤25% without BRC approval; geographic concentration capped. **Set at `Hoz Bank Limited`.** | Consolidated top-N concentration computed as monitored metric. | Same as single-counterparty |
| **B-cluster FX-settlement concentration** (L-B8a-1..5) | RAS §B8a — single-counterparty intraday FX-settlement notional ≤ 97% steady-state / ≤ 99% switch-test window; top-2 cumulative ≤ 100% by design; backup-readiness ≤ 100 days; reserve-correspondents active-but-dormant. **Set at `Hoz Bank Limited`** (the named-pair posture binds to the bank's SARB Authorised Dealer relationships under the Currency and Exchanges Manual). | The B-cluster lines are **not** currently consolidated — `Hoz Securities Limited` does not maintain its own correspondent-bank rails for FX settlement during the build phase; trading-franchise FX flows route through `Hoz Bank Limited`'s Authorised Dealer rails. A consolidated B-cluster view becomes meaningful only if Hoz Securities Limited acquires its own settlement-rail relationships, at which point a v2 line is added to §B8a. | `D-FX-CORRESPONDENT-PAIR-NAMING` · `D-RAS-B-CLUSTER-CONCENTRATION-LINES` · BCBS Principles for Sound Management of Operational Risk (2021) — concentration of operational dependencies `[citation: TBC]` |

The B-cluster lines are explicitly **entity-level** by design under §A4 — the named-pair posture is a `Hoz Bank Limited` operating-model choice, not a group-level discipline.

### B14.4 Other consolidated-basis programmes the PA assesses (not appetite-bound)

*`riskTaxonomy: RT-LR.RC`*

Some PA expectations are consolidated-basis programmes that are **not** appetite-line metrics — they are governance-and-reporting deliverables the bank produces on a consolidated basis as part of the PA look-through dialogue. These include:

- **ICAAP** (Internal Capital Adequacy Assessment Process) — produced at consolidated-basis with entity-level breakdown; the bank's ICAAP is the document.
- **ILAAP** (Internal Liquidity Adequacy Assessment Process) — same pattern.
- **Recovery Plan** — produced at consolidated-basis with entity-level recovery options; a single `Hoz Bank Limited` recovery plan, not a separate group recovery plan.
- **Cyber-resilience programme** under **Joint Standard 1 of 2024** `[citation: TBC — exact JS 1 of 2024 clause distinguishing group programme from entity controls]` — group-level programme + per-entity controls. The bank's RAS §A2 (operational and cyber risk) and §B6 (cyber severity tiers) are the appetite reference; the consolidated programme is governance-and-reporting.
- **BCBS Corporate Governance Principles for Banks** Principle 5 (group structure governance) `[citation: TBC]` — group governance discharge sits in `Owner Inbox/2026-05-06_governance-framework.md` under the bank's board-of-directors structure.

These are recorded on the **obligations register** (`Regulations/_obligations-register.md`) under Mira (Compliance / RegTech engineer)'s `applies-at: consolidated` annotation pattern (PR #84 / D-LEGAL-ENTITY-TREE-V0 follow-on). They are not separate RAS lines.

### B14.5 Reconciliation and substrate gaps

- **Reconciliation rule.** Every consolidated-basis figure reported in BRC / ALCO / Board packs must reconcile to entity-level figures via documented IFRS 10 consolidation eliminations and IAS 27 minority-interest treatment. The reconciliation is itself a derived-projection (Principle 1) — not a hand-assembled spreadsheet (Principle 6 downward).
- **Substrate gaps.**
  - **Consolidated-basis metric computation** — no projection today computes consolidated CET1 / LCR / NSFR / large-exposure across the three legal entities. v1 substrate task (Anya (Data / analytics engineer) projection-runtime + Bea (Accounting & financial reporting engineer) consolidation logic + Rohan instrument). Surfaced as decision-record substrate gap #5.
  - **PA reporting cadence** — once consolidated metrics are computed, the cadence at which the bank reports them to the PA (BA returns annex? separate consolidated-supervision return? Pillar 3 disclosure cycle?) is a v1 decision. Likely confirmed at the licence-application gate via Imani (Legal-as-code engineer) + external counsel.
  - **Future group-level recon under PA look-through** — Vera (Internal audit / continuous-assurance engineer) Wave-4 substrate gap; the recon harness must compare entity-reported figures to consolidated-derived figures and surface drift as a finding. Not yet scheduled; planned alongside the consolidated-basis projection work.

---

## Appendix — Specific defaults set today (decision log)

For convenient reference by other teams. Each line tags at level 2 per `Regulations/_risk-taxonomy.md` §8 (RAS line tagging convention). Where a line spans two terminal nodes, the dominant binding constraint is named first and the secondary noted; per register §6 mapping rules, true dual-classification is prohibited and decomposition is performed at the event-tag layer.

1. **Continuous-KYC default:** two-tier (restrict-on-review for medium-confidence; restrict-immediately for high-confidence). [§B5] · *`riskTaxonomy: RT-FC.ML`* (money-laundering is the dominant trigger framing; secondary `RT-FC.SA` attaches at incident-tag time for sanctions-triggered restrictions).
2. **LCR buffer floor:** PA minimum + 20pp normal; +10pp management trigger; +5pp escalation. [§B3] · *`riskTaxonomy: RT-LQ.FN`* (funding-liquidity ratio; per register §8 explicit example).
3. **NSFR buffer floor:** PA minimum + 15pp normal; +8pp trigger; +3pp escalation. [§B3] · *`riskTaxonomy: RT-LQ.FN`* (per register §8 explicit example).
4. **CET1 management buffer:** 1.5pp above all PA-set minima + Pillar 2A + capital conservation buffer. [§B3] · *`riskTaxonomy: RT-CR.OB`* (capital floor frames Pillar 1 obligor-default loss-absorption under Banks Act §72 + Reg 23; secondary `RT-MK` / `RT-OP` Pillar-1 components captured downstream at the per-component RWA-event layer per Bea's RWA engine spec, not at the RAS line).
5. **Sanctions:** zero appetite; production override = signed Zara event with register-linked exception. [§B5] · *`riskTaxonomy: RT-FC.SA`* (direct match — sanctions are level 2 under financial-crime risk).
6. **Model risk tiers:** three-tier; Tier 1 = independent validation pre-deployment + annual revalidation. [§B7] · *`riskTaxonomy: RT-OP.MD`* (level-3 `RT-OP.MD.T1` / `RT-OP.MD.T2` / `RT-OP.MD.T3` applies per model).
7. **Cyber severity:** four-tier with Regulator-notification thresholds at T3/T4. [§B6] · *`riskTaxonomy: RT-OP.CY`* (level-3 `RT-OP.CY.CF` / `.IN` / `.AV` / `.RS` applies per incident).
8. **Sector concentration:** ≤25% without BRC approval. [§B2] · *`riskTaxonomy: RT-CR.CC`* (direct match — per register §8 explicit example).
9. **Trading mandate:** client-driven and franchise market-making; no proprietary risk-taking outside franchise hedges. [§A2 Market] · *`riskTaxonomy: RT-MK`* (level 1; the mandate spans multiple level-2 nodes — `RT-MK.IR` / `.FX` / `.EQ` / `.CS` — so the stable classification is level-1. Per-desk VaR limits placeholder under RAS B5 / `2026-05-11_kai-helena-devon_trading-mandate-v1.md` will tag at level 2 when calibrated.)
10. **Climate:** assess, disclose, avoid clearly inconsistent exposures (initial). [§A2 Climate] · *`riskTaxonomy: RT-CL`* (level 1; transverse-risk classification per register §3; per-exposure tagging at level 2 — `RT-CL.PH` / `RT-CL.TR` — attaches at exposure / incident event time).
11. **B-cluster FX-settlement concentration (CEO ratification pending — D-RAS-B-CLUSTER-CONCENTRATION-LINES, 2026-05-09):** single-counterparty intraday FX-settlement notional ≤ 97% steady-state / ≤ 99% switch-test window; top-2 cumulative observational at 100% by design (drift below 100% = `Critical` breach signalling unsanctioned third correspondent); switch-test window override; backup-readiness ≤ 100 days; reserve-correspondents active-but-dormant. Calibrated at the named-pair structural posture (D-FX-CORRESPONDENT-PAIR-NAMING) so drift away from the design fires Vera continuous-controls findings. [§B8a] · *`riskTaxonomy: RT-OP.PA`* (operational payments-and-settlement processing concentration; per register §4.5 — distinct from `RT-CR.SL` Herstatt settlement-credit risk. Secondary `RT-OP.TP.MS` (third-party-market-services) shadow on lines L-B8a-1 / -2 / -5; `RT-OP.RE` (operational-resilience) shadow on L-B8a-4; `RT-CR.SL.FX` attaches at incident-tag time only if a settlement actually fails. §B8 counterparty-credit concentration `RT-CR.CP` / `RT-CR.CC` is separately scored — see "Reconciliation with §B8" in the §B8a body.)

These are the **operational defaults** other teams can now build against. They are policy-layer decisions; standards (limit code) and processes (workflows) derive from them; presentations (board packs) summarise them.
