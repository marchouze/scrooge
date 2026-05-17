---
title: Named correspondent pair + procedure stubs — completion note (D-M4-FX-SUB-1 follow-on)
author: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
date: 2026-05-09
summary: Single-PR completion note tying together the named-pair proposal (Standard Bank primary + FirstRand backup; quarterly switch-test), the two Devon-owned procedure stubs landed at v0 (outsourcing-due-diligence + directive-3-pa-notification), the procedures-index update, and the substrate read-back to PR #49.
decision-required: false
---

# Named correspondent pair + procedure stubs — completion note

**Authors:** Devon (Chief Operating Officer, governance) · Tomas (Operations & payments engineer)
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority chain:** `D-FX-CLS-MEMBERSHIP` (resolved 2026-05-07) → `D-M4-FX-SUB-DECISIONS` § D-M4-FX-SUB-1 (resolved 2026-05-09, decision record on PR #54). This PR delivers the named pair the resolved decision called for.
**Decision lift:** This PR carries one new decision-required card — `D-FX-CORRESPONDENT-PAIR-NAMING` — for CEO approval of the recommended pair. The stubs and index changes are downward-derivation; they do not lift.

> **Derivation note (Principle 6 — downward).** Everything in this PR derives downward from the approved `D-M4-FX-SUB-DECISIONS`; no new substance is authored at the presentation layer. The named pair is the operational realisation of the approved standard pattern; the procedure stubs are scaffolds for v1 substantive depth ahead of M4 commencement.

## What landed in this single PR

### 1. Named-pair proposal (decision-required)

`Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md` — `D-FX-CORRESPONDENT-PAIR-NAMING`.

- **Primary correspondent:** **Standard Bank**.
- **Backup correspondent:** **FirstRand (RMB)**.
- **Switch-test cadence:** **quarterly** (every 3 months from go-live, ±2 weeks tolerance), with three additional trigger conditions (resilience trigger; concentration trigger; manual trigger).
- Six-pair candidate matrix scoring all permutations across {Standard Bank, FirstRand, Absa, Nedbank} on SA-correspondent strength, CLS Settlement Member status, FX-clearing volume, operational-resilience track record, third-party-risk profile, BCBS-239 interop, fees (`[commercial: TBC]`), and regulatory standing.
- Switch-test runbook outline (named steps, default actors, system capabilities) — hosts inside `Procedures/by-policy/operational-resilience.md` (planned v1; currently absent — flagged as procedure-gap follow-on for Devon).
- Concentration-appetite read-back to Helena (Chief Risk Officer, governance): single-counterparty concentration ~95% of intraday FX-settlement notional under steady-state; top-2 cumulative ~100% by design.

### 2. Procedure stubs at v0 STUB level

- `Procedures/by-policy/outsourcing-due-diligence.md` — pre-engagement DD across regulatory standing, financial viability, operational resilience, cyber, AML/sanctions, data protection, contracting, materiality-based approval routing.
- `Procedures/by-policy/directive-3-pa-notification.md` — PA notification for material cross-border arrangements under SARB Directive 3 of 2018; companion of the DD procedure; Owen-sequenced into the governance calendar.

Both stubs:
- Carry citations (every step has a `[citation: TBC]` rather than fabricated URN where the URN is not yet curated).
- Name actors per Principle 7 (default actor is an agent / governance seat; first reference pairs name + position).
- Carry a reconciliation field (Vera continuous-controls assurance pipeline placeholder).
- Name evidence / artefact event-shapes.
- Cross-applied to the FX correspondent pair as the v0 build-phase application.

### 3. Procedures index update

`Procedures/_index.md` — Operations & technology / Outsourcing & Third-Party Risk rows updated from PLANNED to STUB, with linked file paths, expanded owner sets (Mira added to DD; Owen + Rashida + Imani + Iris added to Directive 3).

## Substrate read-back from PR #49 (Saskia + Kai's M4 FX foundation slice)

The `correspondent` party field on `FxSettlementInstructed` (`prototype/platform/markets/cdm/fx.ts`, on PR #49 branch — currently OPEN) is typed as `partySchema.optional()` with a cross-field rule that requires it when `settlementPath = "correspondent"`. **The named pair shape lands on the substrate without a schema amendment.** Standard Bank and FirstRand fit cleanly into the `partySchema` shape with `role: "settlement-agent"` and `jurisdiction: "ZA"`.

### Substrate gap surfaced (NOT amended in this PR)

A **routing-policy projection** is needed: given the primary/backup pair and the current operational posture (steady-state vs switch-test), compute which correspondent the dispatcher should route an `FxSettlementInstructed` event through. This is a runtime/projection capability, not a schema shape. Surfaced to:

- **Saskia (Head of Global Markets, governance)** + **Kai (Trading systems engineer)** — owners of the markets-side substrate.
- **Atlas (Core banking platform architect)** — owner of the projection runtime.

Routing-policy projection is M4 substrate-readiness scope; it does not block `D-FX-CORRESPONDENT-PAIR-NAMING` approval.

## Decisions surfaced (single)

- **`D-FX-CORRESPONDENT-PAIR-NAMING`** — CEO approve Standard Bank (primary) + FirstRand (backup) + quarterly switch-test cadence; or amend.

## Cross-cutting routings (named on the proposal, repeated here for the action board)

| To | Action |
|---|---|
| Helena (CRO) | RAS B-cluster recalibration (single-counterparty + top-2 cumulative concentration appetite lines on the named pair). |
| Tomas (Operations & payments engineer) | Open commercial discussions with Standard Bank + FirstRand on CEO approval; design the operational dispatcher; populate the routing-policy projection. |
| Devon (CoO) | Author v1 of `outsourcing-due-diligence.md`, `directive-3-pa-notification.md`, and `operational-resilience.md` (new — hosts the switch-test runbook v1) ahead of M4 commencement. |
| Imani (Legal-as-code engineer) | Contract both correspondent agreements (ISDA-Master-class + operational SLAs + indemnities + exit conditions). |
| Senna + Rashida (CISO) | Cyber + operational due diligence on both correspondents (Joint Standard 1 of 2024 third-party extensions). |
| Mira (Compliance / RegTech engineer) | FIC / sanctions due diligence; populate the `[citation: TBC]` URN slots as obligations register curation cadence permits. |
| Saskia + Kai | Routing-policy projection design at M4 substrate-readiness (substrate gap). |
| Owen (CoSec) | Sequence the Directive-3 notifications into the governance calendar (lodged ahead of M4 commencement). |
| Vera | Open the third-party-risk pipeline (Wave-4 catalogue) covering switch-test execution, reconciliation, and Directive-3 notification chain. |

## `[citation: TBC]` and substrate gaps surfaced (consolidated)

### Citations TBC (to be populated by Mira via obligations register curation)

- SARB Directive 3 of 2018 full URN.
- SARB PA outsourcing directive (Banks Act regulations) URN.
- Joint Standard 1 of 2024 third-party-risk extensions URN.
- POPIA s.21 operator-agreement URN.
- POPIA s.72 cross-border transfer URN.
- FIC Act third-party AML/CFT exposure URN.
- BankservAfrica RPP ISO 20022 roadmap reference.
- PA enforcement register reference.
- CLS member directory URN.
- GLEIF LEIs for Standard Bank and FirstRand (populate at engagement).
- RAS B-cluster current iteration (`X% TBC`, `Y% TBC` calibrations from Helena).

### Substrate gaps surfaced (not amended in this PR)

1. **Routing-policy projection** — Saskia + Kai + Atlas (M4 substrate-readiness).
2. **`Procedures/by-policy/operational-resilience.md`** — does not exist; switch-test runbook lives at v0 in the named-pair proposal § 4 pending v1 procedure file. Devon-owned follow-on.
3. **System capabilities named in the procedure stubs** are all `(PLANNED)`: `@platform/third-party-risk/intake`, `@platform/operations/resilience-assessment`, `@platform/security/third-party-cyber-dd`, `@platform/governance/d3-notification-packet`, etc. These are roadmap items consistent with the broader operations/governance substrate.
4. **PA notification submission channel** — whether Directive 3 notifications go through PA ePortal vs hardcopy is `(PLANNED)` for Owen to confirm with PA secretariat.

—Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
