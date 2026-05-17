---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T07:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-FX-CORRESPONDENT-PAIR-NAMING, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-FX-CORRESPONDENT-PAIR-NAMING`
- **Title:** FX-settlement correspondent pair — primary + backup naming
- **Action:** approve
- **Outcome:** Approved as recommended by Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer) in PR #58.
  - **Primary correspondent: Standard Bank.** Largest SA correspondent footprint, Tier-1 ZAR FX market-maker, mature ISO 20022 posture.
  - **Backup correspondent: FirstRand (RMB).** Different parent group from the primary; RMB is the dominant institutional FX desk in the bank's franchise; comparable ISO 20022 readiness.
  - **Held in reserve as future tertiaries:** Absa, Nedbank.
  - **Switch-test cadence:** quarterly (±2 weeks tolerance) plus three additional triggers — resilience (primary correspondent material incident), concentration (RAS B-cluster appetite breach), manual (Devon / Tomas discretion). Live test routes 5–10% of daily flow through the backup; T+0 reconciliation; Tomas files a typed `SwitchTestReport`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "D-FX-CORRESPONDENT-PAIR-NAMING go with recommendation" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_devon-tomas_named-correspondent-pair-proposal.md` (PR #58)
- **Authority chain:** Extends `D-M4-FX-SUB-DECISIONS` (resolved 2026-05-09, PR #54) under Sub-1 (backup correspondent identity); which extends `D-FX-CLS-MEMBERSHIP` (resolved 2026-05-07; correspondent routing for FX settlement); which extends `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07).

## Concentration read-back to risk

The named-pair posture implies concentration figures Helena (Chief Risk Officer, governance) must calibrate the RAS B-cluster appetite lines against:

- **Single-counterparty intraday FX-settlement notional under steady-state:** ~95% (Standard Bank as primary).
- **Top-2 cumulative:** ~100% (Standard Bank + FirstRand-RMB by design).
- **Switch-test windows (quarterly + triggered):** 90–95% during the 5–10% backup-routing live test; design-by-construction.

Helena recalibrates the RAS B-cluster appetite line(s) jointly with Rohan (Risk engineer) — this concentration is intentional under the indirect-participant operating posture (memory: `project_indirect_participant_posture.md`), but the appetite line must be set explicitly so a future drift triggers Vera (Internal-audit / continuous-assurance engineer)'s continuous-controls finding rather than a silent normalisation.

## Follow-on routes recorded

- `agent:Helena (Chief Risk Officer, governance) + agent:Rohan (Risk engineer)` — calibrate RAS B-cluster appetite lines for FX-settlement single-counterparty + top-2 cumulative concentrations, given the named-pair posture. Update `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` (or the canonical RAS file Helena curates) with the calibrated lines (`X%` for single-counterparty; `Y%` for top-2 cumulative). Cross-reference D-FX-CORRESPONDENT-PAIR-NAMING + D-FX-CLS-MEMBERSHIP. Cite Helena's risk-appetite framework + the indirect-participant operating posture memory.
- `agent:Saskia (Head of Global Markets, governance) + agent:Kai (Trading-systems engineer) + agent:Atlas (Core banking platform architect)` — author the routing-policy projection (primary-vs-backup dispatcher logic). The substrate field `correspondent` on `FxSettlementInstructed` (PR #49) is a string; the dispatcher needs to resolve "primary" → "Standard Bank" and "backup" → "FirstRand (RMB)" with explicit override semantics for the switch-test 5–10% live-traffic case. Land at M4 substrate-readiness; gate on the named-pair contract execution.
- `agent:Tomas (Operations & payments engineer)` — operational integration kick-off. ISO 20022 connector mapping for both correspondents; GLEIF LEI registration for Standard Bank + FirstRand-RMB; primary + backup credentials provisioning (under Senna (Security engineer)'s zero-trust posture, HSM key material for the credential signing). Output: `Owner Inbox/<date>_tomas_correspondent-integration-readiness.md` at substrate-readiness.
- `agent:Mira (Compliance / RegTech engineer)` — register entries: `urn:obligation:bank:gv:third-party:correspondent-primary:v1` (Standard Bank) and `urn:obligation:bank:gv:third-party:correspondent-backup:v1` (FirstRand-RMB) under Domain GV (governance — third party). Cite the named-pair decision record + the SARB PA outsourcing directive + Directive 3 of 2018. Status: `corporate-bind` (the contract bind, not commencement). Consolidate the [citation: TBC] items Devon + Tomas surfaced.
- `agent:Devon (Chief Operating Officer, governance)` — populate `Procedures/by-policy/operational-resilience.md` (currently does not exist) with the switch-test runbook from PR #58 §4. v1 STUB acceptable; full procedure ahead of M4 commencement-of-trading.
- `agent:Senna (Security engineer)` — threat-model the correspondent-credential plumbing under the zero-trust posture. Output: a one-page security note referencing Joint Standard 1 of 2024 + POPIA s.19–22 + the HSM Level-3 requirement for credential signing.
- `agent:Vera (Internal-audit / continuous-assurance engineer)` — Wave-4 backlog item: continuous-controls recon on the named-pair contract status (in-place / lapsed / under-renewal); RAS B-cluster appetite breach detection; switch-test cadence compliance. Plan, do not implement now.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring gap; Atlas (Core banking platform architect) v1.
2. **Routing-policy projection** — primary-vs-backup dispatcher logic owed at M4 substrate-readiness; Saskia + Kai + Atlas.
3. **`Procedures/by-policy/operational-resilience.md`** — does not exist; Devon (COO, governance) v0 stub owed.
4. **Domain GV-third-party register section** — if not yet a structured domain in `Regulations/_obligations-register.md`, the named-correspondent URNs may need a new section header. Mira (Compliance / RegTech engineer) curation call.
5. **GLEIF LEI substrate** — Tomas (Operations & payments engineer) v0; manual LEI lookup acceptable for v0.
6. **HSM Level-3 credential plumbing** — Senna (Security engineer) v1; cloud-managed HSM required at substrate-readiness per Principle 4.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
