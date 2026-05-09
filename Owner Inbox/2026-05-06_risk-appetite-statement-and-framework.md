# Risk Appetite Statement and Framework

**Author:** Helena (CRO — lead)
**Contributors:** Rohan (risk engineer), Zara (CCO), Eitan (Treasurer), Senna (security), Camille (CFO), Imani, Vera
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Note on derivation (Principle 6).** The RAS is the *policy* layer. The RAF is the *standard* layer that codifies how the RAS is operated, monitored, and breached. Operational limits and KRIs sit at the standard layer; live limits and breaches are *data*. Board RAS document (this) is a **summary** of the operational stack — never the original.

---

# Part A — Risk Appetite Statement (Board-level)

## A1. Overarching statement

The bank takes risk **only to deliver its strategy** — to be a fully-coded, regulator-credible, customer-respected South African bank operating to BCBS and King IV standards. The bank prefers measured returns built on disciplined risk-taking, transparent reporting, and resilient operations to faster returns built on uncontrolled exposures or operational shortcuts.

The bank operates under a **zero-tolerance** appetite for: regulatory breach, financial-crime facilitation, material misstatement of financial position, customer harm caused by the bank's conduct, and material data breach. Wherever risk is taken, it is taken within explicit limits, with explicit ownership, and against citable authority.

## A2. Appetite by risk category

### Credit risk
- Appetite for **measured** lending activity, primarily SA, with concentration limits per single name, sector, and geography.
- IFRS 9 ECL stage migrations within calibrated tolerances; significant unexpected migration triggers RAS review.
- Counterparty credit (markets) appetite calibrated to the trading franchise; dispatched via Helena's policy and operated by Saskia / Eitan.

### Market risk
- Appetite for **client-driven and franchise** market-making in FX, rates, money markets initially; expansion subject to BRC approval.
- VaR, sensitivities, and concentration limits set by Helena, operated by Saskia.
- No proprietary risk-taking outside warehoused franchise hedge positions.

### Liquidity and funding risk
- Appetite for stable, **textured funding**: wholesale + deposit + capital, no thin reliance on any single counterparty or tenor.
- LCR target buffer **above PA-set minimum** (target buffer set in RAF §B3).
- NSFR target buffer **above PA-set minimum** (target buffer set in RAF §B3).
- Intraday liquidity discipline at SAMOS-funding scale; zero-tolerance for end-of-day overdraft except under contingency-funding plan.

### IRRBB
- Appetite calibrated to a **conservative** EVE and NII sensitivity profile relative to capital and earnings.
- Hedging is the default; un-hedged behavioural assumptions documented and BRC-approved.

### Operational and cyber risk
- Appetite for **operational disruption tolerable but recoverable within stated impact tolerances** (set per BCBS Operational Resilience principles).
- Zero-tolerance for: avoidable material data breach; settlement failure caused by internal action; payments outage outside resilience windows.
- Cyber: aligned with Joint Standard 1 of 2024; severity tiers (RAF §B6).

### Conduct risk
- **Zero appetite** for treating customers unfairly, mis-selling, fee opacity, conflicts of interest unmanaged, or market abuse.

### Financial-crime / AML / sanctions risk
- **Zero appetite** for facilitating financial crime; entering into sanctioned-entity relationships; or onboarding without satisfying CDD.
- Calibrated appetite for residual financial-crime risk after controls (typology-based — see RAF §B5).

### Legal and regulatory risk
- Zero appetite for known regulatory breach.
- Calibrated appetite for legal-positions uncertainty in evolving areas (e.g., COFI, climate disclosure) provided positions are documented, register-linked, and reviewed.

### Strategic and reputational risk
- Risk-taking aligned to strategy; no off-strategy adventures; reputation is treated as a leading indicator of all other risks.

### Model risk
- Appetite for modelled decisioning provided models are tier-classified, validated, monitored, and challenged (RAF §B7).
- Tier-1 models (regulatory capital, IFRS 9 ECL, AML) have stricter validation; tier-3 (operational analytics) lighter touch.

### Climate risk
- Aligned with PA Guidance Note 1 of 2024.
- Climate dispatched through credit, operational, strategic, and conduct lenses.
- Initial appetite: **assess**, **disclose**, **avoid clearly inconsistent exposures**.

## A3. Appetite multipliers across P5

The appetite levels above apply **per legal entity** and, where currency-sensitive, **per significant currency**. As entities or jurisdictions are added (P5), the RAS is replicated by template; absolute amounts are jurisdiction-specific.

---

# Part B — Risk Appetite Framework (Standard layer)

## B1. Operational limits and KRIs

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

- Single-name large-exposure limit aligned to BCBS large-exposures framework, capped below regulatory ceiling.
- Sector concentration: no sector >25% of exposure without BRC approval.
- Geographic concentration: SA majority by design; cross-border exposure capped per RAS multiplier.

## B3. Defaults — liquidity and capital buffers

- **LCR buffer:** target operate at **120% of PA minimum** in normal conditions; trigger management action below 110%; mandatory BRC escalation below 105%.
- **NSFR buffer:** target operate at **115% of PA minimum**; trigger at 108%; escalate at 103%.
- **Capital buffer:** target operate above **all PA-set minima + Pillar 2A + capital conservation buffer + 1.5pp management buffer** in CET1; trigger at PA minimum + 0.75pp; escalate at PA minimum + 0.25pp.

(Specific numerical buffers calibrated by Helena and Camille in the ICAAP / ILAAP cycle; values above are the policy floor.)

## B4. Defaults — market risk

- VaR limits per desk (initially: FX, rates, money markets) calibrated against franchise size; reviewed monthly until stable, then quarterly.
- Stress losses capped at a fraction of capital buffer.
- Position concentration and tenor concentration limits per asset class.

## B5. Defaults — financial-crime / sanctions

- **Sanctions matching:** all true-positive matches blocked end-to-end pre-execution. Any production override is a Zara-signed event with concurrence, and a register-linked exception.
- **PEP / EDD onboarding:** documented EDD before activation.
- **Continuous-KYC restriction default (CEO-deferred decision):** **restrict-on-review** for medium-confidence triggers (adverse media, behavioural anomaly, registry-change); **restrict-immediately** for high-confidence triggers (sanctions hit, court order, beneficial-ownership change crossing a control threshold). The two-tier default is set here; Mira's pipeline implements both branches as already designed.
- **STR filing:** Zara's judgement, no internal override.

## B6. Defaults — cyber-incident severity tiers

Aligned with Joint Standard 1 of 2024 and Senna's IR programme.

| Tier | Description | Notification | Authority |
|---|---|---|---|
| 1 | Minor — internal only, no customer impact | Internal log only | Senna |
| 2 | Moderate — limited customer impact, contained | Internal escalation + Iris pre-screen | Senna + Devon |
| 3 | Major — material customer impact or external dependency | POPIA pre-screen; Regulator pre-notification | Devon + CRO + IO |
| 4 | Critical — systemic impact, breach material | Regulator notification; customer notification | CEO + CRO + IO + (interim) CISO |

Decision criteria coded; uplift always permitted; downgrade requires CRO concurrence.

## B7. Defaults — model risk tiers

| Tier | Examples | Validation |
|---|---|---|
| Tier 1 | Regulatory capital RWA models; IFRS 9 ECL; AML monitoring core models | Independent validation pre-deployment; annual revalidation; monitoring continuous |
| Tier 2 | Pricing engines; risk sensitivities; behavioural-deposit models | Independent validation pre-deployment; biennial revalidation |
| Tier 3 | Operational analytics; customer-segmentation; non-decisioning models | Internal review; sample audit |

Rohan develops; an **independent validation function** reports to Helena. Validators do not also build (segregation).

## B8. Defaults — concentration & counterparty (markets)

- Per-counterparty exposure caps; netted under enforceable ISDA / GMRA where Imani's opinions support netting.
- Sovereign / government concentration: SA government acceptable; other-sovereign caps per BRC.

## B8a. Defaults — FX-settlement & correspondent-bank concentration (B-cluster)

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

- **RAS:** Annual board approval; ad-hoc updates only on material change (new product, new entity, new jurisdiction, material loss, regulatory change). Each update is a versioned event with a register citation.
- **Limits / KRIs:** Reviewed quarterly by BRC; live recalibration permitted within RAS bounds.
- **Defaults set here (§§B5–B7):** Reviewed at least annually by BRC and after any material incident.

## B11. Reporting

- **Board RAS pack** — generated quarterly. Standing items: RAS coverage, breaches, near-misses, emerging risks. (P6 — generated, not assembled.)
- **BRC pack** — generated monthly. Standing items: limits dashboard, breach summary, KRI heatmap, regulatory-engagement log, model-risk inventory, climate-risk progress.
- **ALCO pack** — Eitan-chaired weekly; standing items: liquidity dashboard, IRRBB sensitivities, FX position, FTP attribution.
- All packs are **summarised derivations** of the live limit and event data — Principle 6.

## B12. Governance over the RAS / RAF

- Helena owns the RAS / RAF as a policy artefact.
- Owen runs the Board pathway.
- Mira ensures every appetite line and every limit is register-linked.
- Vera audits the framework's effectiveness independently.
- The RAS / RAF is itself a register entry, citing Banks Act, BCBS principles, FIC Act, FAIS, POPIA, Joint Standard 1 of 2024, King IV, Companies Act, IFRS 9 — among others.

## B13. Co-dependence with the Governance Framework

This RAS / RAF is intentionally co-tabled with the **governance framework** (`Owner Inbox/2026-05-06_governance-framework.md`). The governance framework provides the *structures* (Board, BRC, AC, ALCO, S&E, RemCo, NomCo, three lines of defence). This RAS / RAF provides the *content* those structures govern. Approvals must be congruent; changes to one require review of the other.

---

## Appendix — Specific defaults set today (decision log)

For convenient reference by other teams:

1. **Continuous-KYC default:** two-tier (restrict-on-review for medium-confidence; restrict-immediately for high-confidence). [§B5]
2. **LCR buffer floor:** PA minimum + 20pp normal; +10pp management trigger; +5pp escalation. [§B3]
3. **NSFR buffer floor:** PA minimum + 15pp normal; +8pp trigger; +3pp escalation. [§B3]
4. **CET1 management buffer:** 1.5pp above all PA-set minima + Pillar 2A + capital conservation buffer. [§B3]
5. **Sanctions:** zero appetite; production override = signed Zara event with register-linked exception. [§B5]
6. **Model risk tiers:** three-tier; Tier 1 = independent validation pre-deployment + annual revalidation. [§B7]
7. **Cyber severity:** four-tier with Regulator-notification thresholds at T3/T4. [§B6]
8. **Sector concentration:** ≤25% without BRC approval. [§B2]
9. **Trading mandate:** client-driven and franchise market-making; no proprietary risk-taking outside franchise hedges. [§A2 Market]
10. **Climate:** assess, disclose, avoid clearly inconsistent exposures (initial). [§A2 Climate]
11. **B-cluster FX-settlement concentration (CEO ratification pending — D-RAS-B-CLUSTER-CONCENTRATION-LINES, 2026-05-09):** single-counterparty intraday FX-settlement notional ≤ 97% steady-state / ≤ 99% switch-test window; top-2 cumulative observational at 100% by design (drift below 100% = `Critical` breach signalling unsanctioned third correspondent); switch-test window override; backup-readiness ≤ 100 days; reserve-correspondents active-but-dormant. Calibrated at the named-pair structural posture (D-FX-CORRESPONDENT-PAIR-NAMING) so drift away from the design fires Vera continuous-controls findings. [§B8a]

These are the **operational defaults** other teams can now build against. They are policy-layer decisions; standards (limit code) and processes (workflows) derive from them; presentations (board packs) summarise them.
