---
title: Peer review — IFRS quantitative thresholds (§3.2.2 SICR, §3.5.2 Materiality)
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-21
record-kind: policy-peer-review
workstream: WS-IFRS-POLICY-VALIDATION
brief: brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21
authority: D-TRADE-LIFECYCLE-IFRS-CHAIN
citations:
  - "FIN-ACCT-01 v1.2 (Accounting Policies — IFRS)"
  - "IFRS 9 §§5.5.9–5.5.11 (SICR)"
  - "IFRS 9 §5.5.17 (forward-looking ECL)"
  - "IFRS 9 IG B5.5.1–B5.5.6 (SICR Implementation Guidance)"
  - "IAS 1 §§7, 29–31 (materiality)"
  - "IAS 8 §§5, 41 (errors and omissions)"
  - "IFRS Practice Statement 2 (Making Materiality Judgements)"
  - "ISA 320 (Materiality in Planning and Performing an Audit)"
  - "PR #649 (Owen — top-5 policy gaps; v1.2 of FIN-ACCT-01)"
  - "D-RAS (Risk Appetite Statement v1; Helena RAS Governance Schedule v1)"
decision-required: true
decision-id: D-IFRS-THRESHOLDS-V13
recommendation: amend
summary: |
  Peer review of two IFRS quantitative thresholds inserted by Owen (Company
  Secretary, governance) in FIN-ACCT-01 v1.2: §3.2.2 SICR PD trigger
  (relative 100% OR absolute 50 bp, whichever first); §3.5.2 IAS 1
  materiality threshold (5% PBT OR 0.5% total assets, whichever lower).
  Both drafted values fall inside the defensible range of IFRS-9 / IAS-1
  peer practice, but both contain construction defects that should be
  fixed before BAC presentation. §3.2.2 contains an internal logical
  contradiction between rule and rationale. §3.5.2 omits an equity-based
  floor and has no behaviour for loss-making or near-zero-PBT periods —
  a near-certain state for a bank in build phase and early years of
  trading. Recommendation: AMEND both sections; promote to v1.3 with the
  changes set out in §3 below; CFO (Camille) ratification required at
  next ICAAP review cycle per Camille's standing accounting-policy
  authority.
---

# Peer review — IFRS quantitative thresholds (§3.2.2 SICR, §3.5.2 Materiality)

**Reviewer:** Bea (Accounting & financial reporting engineer, engineering)
**Author under review:** Owen (Company Secretary, governance) — v1.2 of `Policies/accounting-policies-ifrs-v1.md`
**Workstream:** WS-IFRS-POLICY-VALIDATION
**Brief:** `brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21`
**Decision authority:** CFO (Camille) per CLAUDE.md routing table; CEO session-delegation in build phase pending CFO seat operational status.

---

## §1 Scope of review

Owen (Company Secretary, governance) closed two `[X]/[Y]` placeholders in v1.2 of `Policies/accounting-policies-ifrs-v1.md` per brief `brief:owen:complete-top-5-policy-gaps-from-2026-05-21-audit:2026-05-21` (PR #649):

| § | Threshold | Owen's draft |
|---|---|---|
| **3.2.2** | SICR PD trigger | Relative **100%** increase in lifetime PD **OR** absolute **50 bp** PD increase, **whichever first** — with the absolute test framed as a "floor so that a doubling of a very small PD (e.g. 5 bp → 10 bp) does not over-state SICR flow." |
| **3.5.2** | IAS 1 quantitative materiality | **5% of profit before tax (PBT)** **OR** **0.5% of total assets**, **whichever lower**. Annual review against external-audit overall materiality benchmark. |

The review covers (i) coherence with IFRS / IAS / Implementation Guidance, (ii) coherence with SA Big-5 peer-bank IFRS-9 / IAS-1 disclosures, (iii) coherence with Helena's RAS Governance Schedule v1, (iv) internal logical coherence between the rule and its stated rationale, (v) behaviour at the boundaries (very small PDs; loss-making periods).

Per dispatch brief, no other field of the policy is touched.

---

## §2 Findings

### §2.1 — §3.2.2 SICR PD trigger: **AMEND**

#### §2.1.1 Standards basis

IFRS 9 §5.5.9 ("At each reporting date, an entity shall assess whether the credit risk on a financial instrument has increased significantly since initial recognition") does **not** prescribe a single quantitative threshold. IFRS 9 IG B5.5.1–B5.5.6 (Implementation Guidance) gives latitude:

- Multi-criterion staging is permitted and is the dominant peer-bank practice;
- A combination of relative *and* absolute PD movement is explicitly contemplated (IG B5.5.6 example);
- The standard requires the threshold to be calibrated to portfolio characteristics, not picked from a catalogue.

The drafted **100% relative / 50 bp absolute** pair therefore sits inside the IFRS-9-defensible range. Big-4 SA banking peer practice (Standard Bank, Absa, Nedbank, FirstRand, Investec — taken from each bank's most recent annual report IFRS-9 staging policy note):

| Bank | Relative-PD trigger (wholesale) | Absolute floor |
|---|---|---|
| Standard Bank | doubling of lifetime PD | absolute floor present (segment-calibrated) |
| Absa | 50–100% lifetime PD increase | absolute floor per segment |
| Nedbank | doubling of lifetime PD | 2-notch downgrade backstop |
| FirstRand | 2-notch credit-rating downgrade + relative-PD backstop | implicit through rating notch step |
| Investec | doubling of lifetime PD | qualitative overlay |

A "100% relative + 50 bp absolute" composite is in-range for institutional/wholesale portfolios. It is not the precise number any of the Big-5 publishes verbatim, but it is in the same family. This is the correct *direction* for a wholesale-only institutional dealer (the bank's target portfolio per `project_strategic_foundation.md`).

#### §2.1.2 Logical contradiction between rule and rationale (Construction defect)

The rule as drafted ("**whichever first**") commits to the more conservative trigger — Stage 2 fires whenever **either** the relative test **or** the absolute test breaches. This is **OR semantics**.

The rationale in the same paragraph ("the absolute test acting as a floor so that a doubling of a very small PD (e.g. 5 bp → 10 bp) does not over-state SICR flow") describes the **opposite** behaviour — the absolute test acting as a *filter* that *prevents* Stage 2 when the relative test fires on a very small PD. That is **AND semantics with a de-minimis floor on the absolute leg**.

Worked example with Owen's "whichever first" rule:

- Counterparty A: initial-recognition PD = 5 bp; reporting-date PD = 10 bp. Relative change = +100%; absolute change = +5 bp. Under **OR** ("whichever first"), the relative leg fires → Stage 2. Under the rationale Owen states, the absolute leg should suppress staging → Stage 1.

The rule and the rationale flatly contradict each other on this case. Either the rule is wrong or the rationale is wrong. Both readings are defensible IFRS-9 positions; what is **not** defensible is to publish a policy whose rule and worked example disagree.

#### §2.1.3 Recommended amendment

Replace the rule with one of the two coherent forms below; recommend (a) on conservatism grounds and on consistency with how the absolute-test rationale is written:

**(a) [recommended] Relative-100% AND absolute-50bp, with backstops.** Stage 2 fires when **both** the relative PD-change ≥ +100% **and** the absolute PD-change ≥ +50 bp. The 30-days-past-due backstop continues to override. Watchlist / forbearance / covenant-breach qualitative triggers also continue to override (Stage 2 fires regardless of the PD test on any qualitative trigger). This matches the rationale Owen wrote ("absolute test acts as a floor"); it is in the conservative end of the Big-5 peer range; and it is robust at very small PDs.

**(b) [alternative — more conservative] Relative-100% OR absolute-50bp with absolute de-minimis floor on the relative leg.** Stage 2 fires when (relative PD-change ≥ +100% AND absolute PD-change ≥ +5 bp) OR (absolute PD-change ≥ +50 bp). The relative leg is filtered by a 5 bp de-minimis (kills the 5 bp → 10 bp false positive); the absolute leg is a stand-alone trigger that catches large absolute moves on already-elevated PDs. This matches the literal "whichever first" framing while restoring coherence with the rationale.

**Build-phase context.** The bank has no live credit exposure (CLAUDE.md "build phase vs licence-day"). The threshold is a placeholder until commencement of trading; live-portfolio calibration replaces it at first portfolio bookings. The immediate financial harm of mis-calibration is therefore zero. The reason to fix the wording now is policy hygiene — a policy presented to BAC at licence-day with a rule that contradicts its own worked example is a quality risk to the audit-committee paper trail.

**RAS coherence.** Helena's RAS Governance Schedule v1 (H-08, CET1 measurement substrate) does not directly bind a SICR threshold — RAS appetite lines and SICR staging are different metrics. No conflict either way.

### §2.2 — §3.5.2 IAS 1 quantitative materiality: **AMEND**

#### §2.2.1 Standards basis

IAS 1 §7 defines materiality qualitatively; IAS 8 §41 frames the threshold around influence on user decisions; IFRS Practice Statement 2 (Making Materiality Judgements, IASB 2017) confirms that no single quantitative benchmark is mandated. The benchmarks Owen has imported are taken from **ISA 320 (audit) practice** — which the policy explicitly acknowledges ("The external auditor sets its own audit materiality independently per ISA 320; this policy threshold governs preparation and disclosure, not audit scope").

ISA 320 typical benchmark ranges:

| Benchmark base | Typical range (per IAASB technical guidance and Big-4 audit-methodology manuals) |
|---|---|
| Profit before tax | 5–10% |
| Total revenue | 0.5–1% |
| Total assets | 0.5–2% |
| Total equity | 1–5% |

The drafted **5% of PBT** and **0.5% of total assets** numbers are at the conservative end of ISA-320 typical practice. So far so good.

#### §2.2.2 SA banking peer practice

External-auditor "key audit matters" sections (Big-5 SA banks, most recent annual reports) consistently report **total-asset-based** or **CET1-based** materiality as the primary benchmark, because:

- Bank PBT is volatile across the cycle and dominated by impairment swings (IFRS-9 ECL movement), making PBT-based materiality unstable;
- Bank PBT can go negative (any major credit cycle; bank in early years of trading);
- Bank users (PA; depositors; rating agencies) read the balance sheet and capital position before they read the P&L.

For a build-phase bank with no real revenue and a future loss-making early-trading window, **PBT is not a fit primary benchmark**. The drafted "5% PBT OR 0.5% total assets, whichever lower" makes PBT the **dominant** constraint (it will almost always be the lower of the two during build phase and early trading), and PBT is the **least stable** of the available benchmarks.

#### §2.2.3 Behaviour at boundaries (Construction defect)

Three boundary cases the drafted threshold handles badly:

| Case | PBT | Total assets | 5% PBT | 0.5% TA | Whichever lower | Comment |
|---|---|---|---|---|---|---|
| Build-phase year-end (no trading) | ≈ R0 | ≈ R300m founding capital | ≈ R0 | R1.5m | **≈ R0** | Threshold collapses to zero — every item is "material". |
| Early-trading loss year | -R50m | R5bn | undefined / negative | R25m | undefined | "5% of a loss" is ill-defined; policy has no fallback. |
| Steady-state profit year | R200m | R20bn | R10m | R100m | R10m | Reasonable. |
| Boom year | R600m | R30bn | R30m | R150m | R30m | Reasonable. |

In two of four common-scenario rows, the drafted threshold either collapses to near-zero or is mathematically undefined. The policy has no escape clause for either case.

#### §2.2.4 Missing benchmark — equity / CET1

The bank's primary regulatory benchmark is **CET1** (RAS Schedule §B3; Helena RAS Governance Schedule v1 line CET1 buffer over PA minimum, Tier-1 appetite). For a bank, **0.5% – 1% of CET1** is a stable, regulator-relevant materiality benchmark used as primary by several SA peer auditors. Its absence from the policy is a gap.

#### §2.2.5 Recommended amendment

Replace the drafted rule with a three-leg construct:

**Primary leg:** **0.5% of total assets** (stable; user-decision-relevant for a bank; matches SA peer-auditor practice).

**Secondary leg:** **5% of normalised PBT** — defined as the 3-year trailing average of PBT, computed using only profit-making years (years with PBT ≤ 0 excluded from the average). During the build phase and the first 36 months of trading (before three profit-making years exist), the secondary leg is **inactive** and substituted by the tertiary leg below.

**Tertiary leg / floor:** **1% of CET1**.

**Application rule:** materiality = lowest of the three legs **whose denominator is defined and positive**.

This:

- Has a defined value in every period including build phase and loss years;
- Keeps the primary benchmark (total assets) stable and regulator-relevant;
- Retains a PBT-based test for steady-state operation;
- Floors the threshold against CET1, which is the binding economic capacity for a bank.

**Qualitative override** wording is unchanged from Owen's draft and is correct.

**Camille (CFO, governance) annual review** wording is unchanged (correct: CFO sets the live calibration; external auditor sets independent audit materiality per ISA 320).

#### §2.2.6 Worked example with the recommended construct

- **Build-phase year-end:** TA = R300m → 0.5% = R1.5m. PBT leg inactive. CET1 ≈ R280m → 1% = R2.8m. Lowest defined positive = **R1.5m**.
- **Early-trading loss year:** TA = R5bn → 0.5% = R25m. PBT leg inactive (no 3-year profit history). CET1 = R450m → 1% = R4.5m. Lowest = **R4.5m**.
- **Steady-state profit year:** TA = R20bn → 0.5% = R100m. Normalised PBT R150m → 5% = R7.5m. CET1 R2.0bn → 1% = R20m. Lowest = **R7.5m**.
- **Boom year:** TA = R30bn → 0.5% = R150m. Normalised PBT R450m (3-year avg) → 5% = R22.5m. CET1 R3.0bn → 1% = R30m. Lowest = **R22.5m**.

All four scenarios produce a defined, defensible, regulator-relevant number.

---

## §3 Recommended amendment text (clean drafts)

### §3.1 Replacement text for §3.2.2 SICR quantitative trigger

> **Quantitative:** The lifetime probability of default (PD) at the reporting date is significantly higher than the PD at initial recognition. The Bank classifies an instrument as Stage 2 when **both**:
>
> - the relative change in lifetime PD is **≥ +100%** since initial recognition, **and**
> - the absolute change in lifetime PD is **≥ +50 basis points** since initial recognition.
>
> Either qualitative trigger (watchlist, adverse business / financial / economic condition change, covenant breach, forbearance) or the 30-days-past-due backstop independently triggers Stage 2 regardless of the PD test.
>
> Both PD parameters are reviewed annually by Helena (CRO, governance) and Camille (CFO, governance) in the ICAAP and ratified by the BRC; any change is recorded as a `SicrThresholdApproved` event (planned) before becoming the active threshold. The build-phase initial calibration uses these defaults; live model calibration replaces them at commencement of trading.

### §3.2 Replacement text for §3.5.2 IAS 1 quantitative materiality

> - **Quantitative threshold:** materiality is set as the **lowest of**:
>   - **0.5% of total assets** (primary benchmark; always defined); and
>   - **5% of normalised profit before tax** — where normalised PBT is the 3-year trailing average computed using only profit-making years. This leg is **inactive** during the build phase and for any period before three profit-making years exist in the trailing window; and
>   - **1% of CET1 capital** (floor; always defined).
>
>   The threshold is the lowest of the legs whose denominator is **defined and positive** in the reporting period. The benchmark legs and weights are reviewed annually by Camille (CFO, governance) against the Bank's loss-absorbing capacity, risk appetite, and the prior year's external-audit overall materiality benchmark, and are documented in the close-cycle working papers. The external auditor sets its own audit materiality independently per ISA 320; this policy threshold governs preparation and disclosure, not audit scope.

### §3.3 Change log entry (proposed for v1.3)

| Version | Date | Author | Note |
|---|---|---|---|
| v1.3 | 2026-05-21 | Bea (Accounting & financial reporting engineer, engineering) on peer review of Owen (Company Secretary, governance) v1.2 | Peer-review amendment of two quantitative thresholds inserted in v1.2: (a) §3.2.2 SICR — replaced "whichever first" OR-rule with "both legs must trigger" AND-rule, resolving internal contradiction with the rationale paragraph and aligning with the conservative end of SA Big-5 peer practice; qualitative and 30-DPD overrides preserved. (b) §3.5.2 materiality — replaced two-leg "whichever lower" with three-leg "lowest of defined positive denominators" (0.5% total assets / 5% normalised PBT / 1% CET1), removing the threshold-collapses-to-zero pathology in build-phase and loss years; introduced normalised-PBT definition; introduced CET1 floor. No other substantive content change. Authority: peer review under brief `brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21`; CFO (Camille) ratification expected at next ICAAP review cycle. |

---

## §4 Verdict

| § | Verdict |
|---|---|
| §3.2.2 SICR | **Amend** — values defensible, construction broken (rule contradicts rationale). |
| §3.5.2 Materiality | **Amend** — values defensible in normal years, construction broken in build phase / loss years; equity-based floor missing. |

Both amendments are policy hygiene, not substantive disagreement with Owen's direction. Both are non-blocking for build phase (no real bookings, no real audit). Both should be in place before the policy graduates DRAFT → IN-FORCE at BAC constitution.

---

## §5 Substrate gaps surfaced

- **SicrThresholdApproved event type** — referenced in §3.2.2 but not yet registered in the event registry. Owner: Bea + Atlas. Target: pre-licence.
- **MaterialityBenchmarkApproved event type** — should be registered alongside `SicrThresholdApproved` so that the annual Camille review surfaces a typed event. Currently the policy is silent on how the annual review is recorded. Owner: Bea. Target: pre-licence.
- **Normalised PBT computation capability** — needs a derivation step in the projection layer once trading commences and a multi-year PBT history exists. Owner: Bea + Anya. Target: post first audited reporting cycle.
- **Recon coverage** — `recon:materiality-threshold-currency` and `recon:sicr-threshold-currency` are not on the recon manifest. Both should assert that the policy holds a current-year `MaterialityBenchmarkApproved` / `SicrThresholdApproved` event. Owner: Vera. Target: post-first-ICAAP cycle (H-11).

---

## §6 Provenance

- **Brief:** `brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21` (event-id 403c6e5d-5630-47d8-8995-57458c495250).
- **Subject:** `Policies/accounting-policies-ifrs-v1.md` v1.2 (PR #649 by Owen, Company Secretary, governance, merged 2026-05-21).
- **Authority (downstream Decision event):** CFO (Camille) per CLAUDE.md routing table — finance / IFRS accounting policy. CEO session-delegation in the build phase pending CFO seat operational status.
- **Coherence checks performed:** IFRS 9 §§5.5.9–5.5.11; IFRS 9 IG B5.5.1–B5.5.6; IAS 1 §§7, 29–31; IAS 8 §§5, 41; IFRS Practice Statement 2; ISA 320; SA Big-5 peer-bank IFRS-9 disclosures (most recent annual reports); Helena (Chief Risk Officer, governance) RAS Governance Schedule v1 (no direct binding either way).
- **Filed via:** RMS Phase 3 (`RecordFiled` event emitted by `dispatch:close-run`).

`[citation: IFRS 9 §5.5.9]` `[citation: IFRS 9 IG B5.5.1]` `[citation: IAS 1 §29]` `[citation: IFRS Practice Statement 2]` `[citation: ISA 320]` `[citation: D-RAS]` `[citation: D-TRADE-LIFECYCLE-IFRS-CHAIN]`
