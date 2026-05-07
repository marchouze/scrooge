# Procedure — ODP authorisation application (FSCA, Index 1 banks-track)

**Procedure ID:** PROC-MK-ODP-01
**Owner:** Owen (CoSec) · Camille (CFO) · Imani (legal-as-code) · Saskia (Head of Global Markets, substantive front-office accountable)
**Approval:** Board (or Interim Audit Forum until Board sits) — application is a Board-reserved matter under the Governance Framework
**Cadence:** One-shot (lodged at licence-day); pre-assembled during build-phase
**Version:** v0.1 — 2026-05-07 — STUB
**Status:** STUB · system capability `PLANNED` · external counsel (S5) engaged ahead of lodgment

## 1. Source policy

ODP Authorisation Policy (planned, markets bundle).

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-FMA-001` (FMA s.6A) | Be authorised by the FSCA before any live ODP business. |
| `ORG-CS1-001` (CS 1/2018 §3) | Demonstrate operational capital. |
| `ORG-CS1-002` (CS 1/2018 §4) | Fit-and-proper for senior management + controlling body. |
| `ORG-CS1-003` (CS 1/2018 §5) | Risk-management framework. |
| `ORG-CS1-004` (CS 1/2018 §6) | IT and operational capacity. |

## 3. Purpose

Lodge a complete ODP authorisation application (FSCA Application Index 1 — banks-track) at licence-day, immediately after SARB banking-licence grant, to enable live OTC interest-rate-derivative operation for Saskia's franchise.

## 4. Trigger

`SARBLicenceGranted` event (planned). Pre-assembly during build-phase per Saskia's pre-licence go-live readiness gate.

## 5. Steps (planned)

| # | Action | Actor | Notes |
|---|---|---|---|
| 1 | Pre-assemble Application Index 1 packet | Owen (Co-Sec) | Form FM6 B + C; controlling body + senior management details; risk-management framework reference |
| 2 | Capital adequacy demonstration | Camille | Banks Act prudential framework + ICAAP; no incremental ODP overlay |
| 3 | External counsel review | Imani + S5 firm | Pre-lodgment review; soft-franchise boundary check |
| 4 | Board approval to lodge | Owen | Board-reserved per Governance Framework |
| 5 | Lodge with FSCA | Owen + Imani | Two hard copies + memory sticks + application fee |
| 6 | Track FSCA correspondence; respond to RFIs | Owen + Imani | Industry-typical 12–24 months from lodgment to authorisation |
| 7 | Post-authorisation: enable live OTC IRD | Saskia + Helena + Devon | Pre-licence readiness gate flips green |

## 6. Build-phase posture

The application packet is pre-assembled during build-phase. No FSCA lodgment until after SARB banking-licence grant (per the AI-driven-bank reframe). External counsel is engaged 6–9 months pre-lodgment per S5 (which is itself a deferred decision).

## 7. Reconciliation

Vera's `ceo-decision-review` cycle covers the lodgment as a Board-reserved decision. A `ProcedureExecuted { id, version, evidence }` event is emitted on lodgment.
