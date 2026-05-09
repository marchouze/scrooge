---
title: Named correspondent pair + switch-test cadence — FX settlement (D-M4-FX-SUB-1 follow-on)
author: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
date: 2026-05-09
summary: Names the primary + backup CLS-Settlement-Member correspondents that will carry FX settlement instructions on `FxSettlementInstructed`; sets a quarterly switch-test cadence; proposes Standard Bank (primary) + FirstRand (backup); reads back the implied concentration appetite to Helena's RAS B-cluster; flags two procedure stubs landed alongside.
decision-required: true
decision-id: D-FX-CORRESPONDENT-PAIR-NAMING
decision-category: near-term
decision-for-ceo: Approve the named correspondent pair (primary + backup) and the quarterly switch-test cadence.
decision-recommendation: Standard Bank as primary; FirstRand as backup; quarterly live switch-test; Helena recalibrates RAS B-cluster concentration line on confirmation.
decision-owner: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
---

# Named correspondent pair + switch-test cadence

**Authors:** Devon (Chief Operating Officer, governance) · Tomas (Operations & payments engineer)
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority chain:** `D-FX-CLS-MEMBERSHIP` (resolved 2026-05-07, `Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md`) → `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-1 (resolved 2026-05-09, `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-m4-fx-sub-decisions.md` — PR #54).
**Source proposal:** `Owner Inbox/2026-05-09_saskia-kai_m4-sub-decisions.md` § D-M4-FX-SUB-1.
**Status:** Pair recommended; commercial terms TBC at engagement; concentration appetite read-back routed to Helena.

> **Derivation note (Principle 6 — downward).** This card sits at the *standard / procedure* layer. It cites the resolved `D-M4-FX-SUB-DECISIONS` decision record, the `D-FX-CLS-MEMBERSHIP` correction (correspondent-routing approved), the FX product-family proposal, and SARB Directive 3 of 2018 [`citation: TBC` — full URN]. It authors no new substance — it names the pair under the approved pattern (two CLS Settlement Members; one of {Standard Bank, FirstRand, Absa, Nedbank} primary; one of the remaining three backup; quarterly switch-test).

> **Pair-with-position naming (memory `feedback_agent_name_with_position.md`).** First reference of every agent / governance seat carries the position; subsequent references may be name-only.

---

## 1. Why this card now

The CEO approved the **standard pattern** under `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-1 (resolved 2026-05-09): two CLS Settlement Members both holding South African correspondent relationships; quarterly switch-test cadence; Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer) draft the named pair under their respective mandates (third-party-risk governance + payments-readiness).

The substrate carries the named pair through the `correspondent` field on `FxSettlementInstructed` (`prototype/platform/markets/cdm/fx.ts`, landed on PR #49 branch); Helena's (Chief Risk Officer, governance) RAS B-cluster concentration appetite line cannot be calibrated until the named pair is fixed.

This card:
1. Proposes the named pair (primary + backup) with a candidate matrix.
2. Codifies the quarterly switch-test cadence (trigger conditions, runbook outline, rollback).
3. Reads the implied concentration % back to Helena.
4. Flags the two Devon-mandate procedure stubs landed in the same PR.

## 2. Candidate matrix — six pairs across {Standard Bank, FirstRand, Absa, Nedbank}

The four candidates are South African Big-Four banks, each a CLS Settlement Member via parent-group membership and each holding meaningful South African correspondent relationships. The six unordered pairs and their primary/backup orientation are scored below. Commercial terms (fee tiers, intraday-credit lines, custody pricing) are marked `[commercial: TBC]` rather than invented — Devon + Tomas open commercial discussions on CEO approval of this card.

| Dim | Standard Bank | FirstRand (RMB / FNB) | Absa | Nedbank |
|---|---|---|---|---|
| **CLS Settlement Member status** | Yes — via Standard Bank Group [`citation: TBC` — CLS member directory URN] | Yes — via FirstRand Bank Limited [`citation: TBC`] | Yes — via Absa Bank Limited (formerly Barclays Africa CLS line) [`citation: TBC`] | Yes — via Nedbank Limited [`citation: TBC`] |
| **SA-correspondent strength** | Strongest. Largest African bank by assets; deep correspondent footprint across SADC + sub-Saharan Africa. | Strong. RMB is the dominant institutional FX house in SA; FNB carries the corporate-banking franchise. | Strong. Pan-African platform via Barclays Africa legacy; deep ZAR liquidity. | Solid. Smaller correspondent footprint than Standard / FirstRand; stronger in domestic SME / corporate. |
| **FX-clearing volume (institutional ZAR)** | Tier-1 ZAR FX market-maker; very large daily volume. [`commercial: TBC` — exact volumes are not public.] | Tier-1 ZAR FX market-maker; RMB historically the dominant institutional desk. | Tier-1 ZAR FX market-maker. | Tier-2; smaller institutional FX-clearing volume. |
| **Operational-resilience track record** | No public material outage on FX-settlement instruction processing in recent years [`citation: TBC` — SARB resilience report]. Joint Standard 1 of 2024 expectations apply equally to all four. | Comparable to Standard Bank; well-rehearsed BCP. | Notable IT incidents in retail-banking layer over recent years [`citation: TBC` — SARB published incidents]; institutional-FX desk resilience track record is separate and not publicly material. | Comparable to peers; smaller scale means smaller blast-radius. |
| **Third-party-risk profile (PA-supervised entity)** | PA-supervised SA bank; reciprocal regulatory standing. | PA-supervised SA bank. | PA-supervised SA bank. | PA-supervised SA bank. All four equally satisfy Directive 3 of 2018 [`citation: TBC`] outsourcing-to-a-regulated-entity test. |
| **BCBS-239 data-aggregation interop** | Mature ISO 20022 migration path; pacs.009 readiness consistent with SARB's domestic ISO 20022 track. [`citation: TBC` — BankservAfrica RPP roadmap.] | Mature; FirstRand has been an early ISO 20022 adopter on RPP. | Mature; comparable. | Mature; smaller engineering team but compliant. |
| **Fees / commercial terms** | `[commercial: TBC]` — opens on CEO approval of this card. | `[commercial: TBC]` | `[commercial: TBC]` | `[commercial: TBC]` |
| **Regulatory standing (PA Directives, sanctions, conduct findings)** | No active PA Directive against the FX-settlement business [`citation: TBC` — PA enforcement register]. | No active PA Directive against FX-settlement business [`citation: TBC`]. | One historical IT-resilience finding [`citation: TBC`]; resolved. | No active PA Directive [`citation: TBC`]. |

### Pair scoring (primary → backup)

| # | Primary | Backup | Aggregate strength | Diversification | Switch-test feasibility |
|---|---|---|---|---|---|
| 1 | **Standard Bank** | **FirstRand** | Highest (two strongest SA correspondents) | Good — different parent groups, different IT stacks | High — both maintain mature SWIFT FIN-Y / SCORE infrastructure |
| 2 | Standard Bank | Absa | High | Good | High |
| 3 | Standard Bank | Nedbank | High primary, lower backup | Good | High primary; smaller institutional-FX backup operationally adequate |
| 4 | FirstRand | Standard Bank | Highest (mirror of #1) | Good | High |
| 5 | FirstRand | Absa | High | Good | High |
| 6 | Absa | Nedbank | Mid (Standard + FirstRand both excluded) | Good | Mid |

## 3. Recommendation

**Primary correspondent: Standard Bank.**
**Backup correspondent: FirstRand (RMB).**
**Switch-test cadence: quarterly (every 3 months from go-live, ±2 weeks tolerance).**

### Why Standard Bank as primary

- Largest SA bank by assets; deepest African correspondent footprint covers the institutional-client segment Saskia (Head of Global Markets, governance) is targeting.
- Tier-1 ZAR FX market-maker with high daily clearing volume — a single CLS-member counterparty with deep flow reduces the bank's intraday credit consumption against the correspondent.
- Mature ISO 20022 migration posture (pacs.009 ready) consistent with SARB's domestic ISO 20022 track on BankservAfrica RPP [`citation: TBC` — BankservAfrica ISO 20022 roadmap].
- No active PA Directive against the FX-settlement business [`citation: TBC` — PA enforcement register].

### Why FirstRand as backup

- Different parent group (FirstRand Limited vs Standard Bank Group) — diversifies parent-credit and parent-IT-stack concentration risk.
- RMB is the historically-dominant institutional FX desk in SA — backup capacity is genuinely capable, not nominal.
- Comparable ISO 20022 readiness; the operational switch-test is feasible without bespoke wiring.
- Holding *two* of the strongest SA correspondents preserves capacity if either Standard or FirstRand experiences a material incident.

### Why not Absa as primary or backup at this stage

- Equally regulated; equally CLS-member; aggregate strength is high.
- Held in reserve as a *future tertiary* if the bank scales beyond the dual-correspondent comfortable cap, or if either named correspondent's resilience deteriorates and triggers re-evaluation per `D-FX-CLS-MEMBERSHIP` cross-cutting follow-up #5 (re-evaluation cadence).

### Why not Nedbank at this stage

- Smaller institutional-FX clearing volume than Standard / FirstRand / Absa; backup-capacity test is mid rather than high.
- Held in reserve as a future tertiary alongside Absa.

## 4. Quarterly switch-test cadence — runbook outline

The substrate accepts both primary and backup paths via the `correspondent` field on `FxSettlementInstructed` (the field is `partySchema.optional()`, but `correspondent` is required when `settlementPath = "correspondent"` per the cross-field rule in `prototype/platform/markets/cdm/fx.ts`). The switch-test exercises the *backup* path under live conditions to validate that fallback is operational, not nominal.

### Trigger conditions

A switch-test is triggered by **any one** of:

1. **Cadence trigger** — quarterly (Q1 / Q2 / Q3 / Q4), ±2 weeks tolerance from the calendar quarter-end. Default actor: Tomas (Operations & payments engineer); event: `SwitchTestRequested { cycle: "quarterly", testId, plannedAt }`.
2. **Resilience trigger** — primary correspondent posts a material public incident (Joint Standard 1 of 2024 reportable level, or PA Directive issued); event: `SwitchTestRequested { cycle: "incident", incidentRef }`.
3. **Concentration trigger** — Helena's RAS B-cluster concentration appetite line breaches threshold (see § 5); event: `SwitchTestRequested { cycle: "appetite-breach", appetiteRef }`.
4. **Manual trigger** — Devon or Tomas at their discretion; event: `SwitchTestRequested { cycle: "manual" }`.

### Test runbook (named steps)

| # | Action | Default actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Pre-test communication to backup (FirstRand) ops desk | Tomas (Operations & payments engineer) | `@platform/markets/correspondent-ops` (`PLANNED`) | T-2 business days; coordinates wallet pre-funding window |
| 2 | Reduce primary intraday limit to nominal; raise backup to operational | Tomas | `@platform/markets/correspondent-ops` (`PLANNED`) | Pre-test posture; reverses on test completion |
| 3 | Route a *real* set of FX settlement instructions through the backup (controlled volume — 5–10% of daily flow) | Saskia (Head of Global Markets, governance) initiates; Tomas executes | `@platform/markets/fx-settlement-dispatcher` (`PLANNED`) | Live test, not synthetic. The bank only knows the path works under live conditions. |
| 4 | Reconcile against backup correspondent's confirmation messages | Tomas + Anya (Data / analytics engineer, semantic layer for reconciliation) | `@platform/markets/settlement-reconciliation` (`PLANNED`) | T+0 reconciliation; breaks raised as `ReconciliationBreak` events |
| 5 | Roll back to primary at switch-test conclusion | Tomas | `@platform/markets/correspondent-ops` (`PLANNED`) | Limits reset to steady-state; backup posture lowered |
| 6 | File switch-test report — outcome, latency observations, breaks, lessons learned | Tomas → Devon | (artefact: `SwitchTestReport` event) | Devon files into the third-party-risk register |
| 7 | If material issue surfaced → escalate to D-FX-CLS-MEMBERSHIP re-evaluation | Devon → Helena → CEO | (escalation channel) | Per `D-FX-CLS-MEMBERSHIP` re-evaluation cadence trigger (b) |

### Rollback path

If the switch-test detects a material issue with the backup (settlement failure, message-format incompatibility, latency outside SLA, sanctions-screening failure, or operational-readiness gap):

1. Tomas halts further test traffic and rolls primary back to full operational limits.
2. Devon (Chief Operating Officer, governance) opens a third-party-risk finding against the backup; Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) re-run cyber due diligence on the backup if the issue is cyber-adjacent.
3. The named-pair proposal is reopened: backup may need to be rotated to Absa per § 3 reserve.
4. The CEO is notified via Scrooge; appetite line is recalibrated by Helena pending resolution.

### Procedure binding

The switch-test runbook lives in **`Procedures/by-policy/operational-resilience.md`** (planned — Devon-owned, mandate-substantive deepening required). The procedure file is **not yet authored** as a stand-alone v1; this card flags the gap as a follow-on to be authored alongside the broader Operational Resilience Policy procedure set. In the interim, this § 4 stands as the v0 runbook outline with the same status as the two stubs landed in this PR.

[`citation: TBC` — `Procedures/by-policy/operational-resilience.md` to be linked from `Procedures/_index.md` Operations & technology section once authored.]

## 5. Concentration-appetite read-back to Helena

The named pair (Standard Bank primary + FirstRand backup) implies the following exposure concentrations on FX settlement, expressed as the proportion of the bank's *intraday* aggregate FX-settlement notional flowing through each:

- **Single-counterparty (Standard Bank, primary):** ~95% of intraday FX-settlement notional under steady-state operation (≥99% on non-test days; drops to 90–95% during quarterly switch-test windows when 5–10% of flow routes through FirstRand).
- **Top-2 cumulative (Standard Bank + FirstRand):** ~100% of intraday FX-settlement notional. By design — these are the only two named correspondents until the bank scales beyond the dual-correspondent posture.
- **Single point-of-failure exposure:** Standard Bank's failure during operational hours would translate immediately into FirstRand backup capacity; FirstRand's failure leaves the bank reliant on Standard Bank only (no additional failover until Absa is added as tertiary).

### Implications for RAS B-cluster

These concentration figures are higher than typical bank correspondent concentrations because:

- The bank is small-by-design (~R300m capital target at licence-day, per strategic foundation); a single primary correspondent is operationally sufficient for the institutional-FX flow profile.
- The two-correspondent design is a deliberate trade-off accepted under `D-FX-CLS-MEMBERSHIP` (cost-effective vs CLS Settlement Membership; correspondent-routing preserves PvP via the correspondent's own CLS line).
- The intraday window confines exposure (the correspondent's intraday-credit window is short — typically minutes-to-hours, not days), so concentration as % of *settlement notional* maps to a much smaller % of *credit exposure at any instant*.

**Routed to Helena (Chief Risk Officer, governance):**
- Set RAS B-cluster appetite line: aggregate intraday exposure to a single correspondent (Standard Bank) ≤ X% of CET1 [`X: TBC` — Helena calibrates with Rohan (Risk engineer) on counterparty-exposure model].
- Set RAS B-cluster cumulative top-2 line: aggregate intraday exposure to top-2 correspondents (Standard + FirstRand) ≤ Y% of CET1 [`Y: TBC`].
- Trigger thresholds for switch-test § 4 condition (3) — concentration trigger — derive from these lines.
- The named pair is the *current realisation* of the appetite; if the bank scales such that the dual-correspondent posture stresses the appetite line, Helena triggers `D-FX-CLS-MEMBERSHIP` re-evaluation cadence trigger (a) — direct CLS Settlement Membership becomes commercially attractive.

[`citation: TBC` — RAS B-cluster current iteration; will be updated in `Owner Inbox/2026-05-07_helena_ras-recalibration-v1.md` follow-on.]

## 6. Substrate read-back from M4 FX foundation slice (PR #49)

The `correspondent` party field on `FxSettlementInstructed` is typed as `partySchema.optional()` in `prototype/platform/markets/cdm/fx.ts` (PR #49, currently OPEN). The schema accepts the named-pair shape proposed here **without requiring a schema amendment**, because:

- `partySchema` carries `partyId` (stable identifier — LEI preferred), `name` (display), `role` (enum including `settlement-agent`), and `jurisdiction` (ISO-3166-1 alpha-2). The named pair fits cleanly:
  - Standard Bank: `{ partyId: "<Standard-Bank-LEI>", name: "The Standard Bank of South Africa Limited", role: "settlement-agent", jurisdiction: "ZA" }`. [LEI: `citation: TBC` — to be populated from GLEIF on engagement.]
  - FirstRand: `{ partyId: "<FirstRand-Bank-LEI>", name: "FirstRand Bank Limited", role: "settlement-agent", jurisdiction: "ZA" }`. [LEI: `citation: TBC`.]
- The cross-field rule (correspondent required when `settlementPath = "correspondent"`) is satisfied — the named pair always supplies a `correspondent`.
- The primary-vs-backup distinction is **not** carried in the substrate today — the substrate only knows which correspondent was used at instruction time. That is the right separation of concerns: routing decisions (primary vs backup) live in the operational layer (Tomas's dispatcher; per `Procedures/by-policy/operational-resilience.md` planned); the event-store layer records the *actual* correspondent that received the instruction.

### Substrate gap *not* surfaced (no schema amendment required)

No schema amendment is required for the named-pair proposal. **Substrate gap** to flag separately for Saskia (Head of Global Markets, governance) + Kai (Trading systems engineer):

- **Routing-policy projection** — a derived projection that, given the primary/backup pair and the current operational posture (steady-state vs switch-test), tells the dispatcher which correspondent to use. This is not a schema shape but a runtime/projection capability. Roadmap item for Atlas (Core banking platform architect) + Kai at M4 substrate-readiness.

This is **not** a `D-FX-CORRESPONDENT-PAIR-NAMING` blocker; the named pair lands on the substrate as event-time data without amendment.

## 7. Procedure stubs landed alongside this PR

Two Devon-owned procedure stubs are landed in the same PR per the `D-FX-CLS-MEMBERSHIP` cross-cutting follow-up:

1. **`Procedures/by-policy/outsourcing-due-diligence.md`** (v0 STUB) — pre-engagement third-party due diligence; required before correspondent goes live; cites SARB PA outsourcing directive [`citation: TBC` — full URN].
2. **`Procedures/by-policy/directive-3-pa-notification.md`** (v0 STUB) — PA notification for material correspondent for cross-border functions under SARB Directive 3 of 2018 [`citation: TBC` — full URN]; cadence + format + signatories.

Both procedures are STUB-form (named, structured, with citations + actor + reconciliation field; substantive depth in v1 follow-on). Cross-linked from `Procedures/_index.md` under "Operations & technology / Outsourcing & Third-Party Risk".

## 8. Cross-cutting routings

| To | Action |
|---|---|
| Helena (Chief Risk Officer, governance) | RAS B-cluster recalibration: single-counterparty + top-2 cumulative concentration appetite lines on the named pair; trigger thresholds for switch-test § 4 condition (3). |
| Tomas (Operations & payments engineer) | Open commercial discussions with Standard Bank (primary) and FirstRand (backup) on CEO approval; design the operational dispatcher; populate the routing-policy projection (substrate gap). |
| Devon (Chief Operating Officer, governance) | Author v1 of `outsourcing-due-diligence.md` and `directive-3-pa-notification.md` ahead of M4 commencement-of-trading; author `operational-resilience.md` to host the switch-test runbook in v1 form; track the third-party-risk register. |
| Imani (Legal-as-code engineer) | Contract the correspondent agreements (ISDA-Master-class bilateral + operational SLAs + indemnities + exit conditions) for both Standard Bank and FirstRand. |
| Senna (Security engineer) + Rashida (Chief Information Security Officer, governance) | Cyber + operational due diligence on both named correspondents (connectivity, credential isolation, key custody, IR cooperation, supply-chain posture; Joint Standard 1 of 2024 third-party extensions). |
| Mira (Compliance / RegTech engineer) | FIC / sanctions due diligence on both named correspondents; reputational-exposure register entry; populate the `[citation: TBC]` URN slots above as the obligations register curation cadence permits. |
| Atlas (Core banking platform architect) + Kai (Trading systems engineer) | Routing-policy projection design at M4 substrate-readiness (substrate gap surfaced § 6). |
| Owen (Company Secretary, governance) | Sequence the Directive-3 notification into the governance calendar (lodged ahead of M4 commencement). |
| Vera (Internal audit / continuous-assurance engineer) | Open the third-party-risk pipeline (Wave-4 catalogue) covering the named-pair switch-test execution, reconciliation, and Directive-3 notification chain. |

## 9. Build-phase posture

Per memory `project_rules_bind_at_commencement.md`: the binding correspondent-agreement obligations apply at M4 commencement-of-trading, not during the build phase. The named pair is **proposed** here; commercial engagement opens on CEO approval; the contracted relationships go live at M4 commencement. The procedure stubs' substantive depth (v1) lands ahead of M4 commencement, not at this card.

## 10. Citation chain — this card's coverage

Per Principle 6 (upward chain):

| Layer | Citation |
|---|---|
| Regulation | SARB Directive 3 of 2018 — Cloud Computing and Offshoring of Data [`citation: TBC` — full URN]; SARB PA outsourcing directive [`citation: TBC` — Banks Act regulations on outsourcing material business activities]; Joint Standard 1 of 2024 (third-party-risk extensions) [`citation: TBC`]; CLS Bank rulebook (correspondent-routed via D-FX-CLS-MEMBERSHIP). |
| Policy | Outsourcing & Third-Party Risk Policy (planned — Devon); Operational Resilience Policy (planned — Devon); RAS B-cluster (in-force; concentration appetite line `[X% TBC]`, `[Y% TBC]`). |
| Procedure | `outsourcing-due-diligence.md` (this PR — STUB v0); `directive-3-pa-notification.md` (this PR — STUB v0); `operational-resilience.md` (planned — Devon, hosts switch-test runbook v1). |
| System capability | `correspondent` field on `FxSettlementInstructed` (PR #49 branch); routing-policy projection (planned — Atlas + Kai, substrate gap §6); `@platform/markets/correspondent-ops` (planned — Tomas); `@platform/markets/settlement-reconciliation` (planned — Tomas + Anya). |

## 11. Decision sought

CEO to:
1. Approve **Standard Bank** as primary correspondent and **FirstRand** as backup correspondent.
2. Approve the **quarterly switch-test cadence** with the four trigger conditions in § 4.
3. Note Helena's appetite-line recalibration as an action item; the `[X% TBC]` and `[Y% TBC]` numbers come back through Helena's RAS B-cluster v2 follow-on.
4. Note the two procedure stubs (`outsourcing-due-diligence.md`, `directive-3-pa-notification.md`) landed at v0 STUB level in this PR; v1 substantive depth lands ahead of M4 commencement.
5. Note the routing-policy projection substrate gap (§ 6) — surfaced to Saskia + Kai for M4 substrate-readiness.

—Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
