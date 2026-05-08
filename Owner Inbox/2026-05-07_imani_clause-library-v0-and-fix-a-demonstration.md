---
title: Clause library v0 + legal-entity tree v0 + first end-to-end chain (fix-(a) demonstration)
author: Imani (via Scrooge)
date: 2026-05-07
summary: Imani's first build-phase substrate landed — clause library v0, legal-entity tree v0, two stub policies, one full-chain procedure. Demonstrates the Reg→Policy→Procedure→Capability pattern end-to-end so Bea, Yael, Tomas and the rest of the blocked-domain agents can follow the same shape.
decision-required: false
---

# Clause library v0 + legal-entity tree v0 + first end-to-end chain

**Author:** Imani (via Scrooge) · **Date:** 2026-05-07

This is the run report for the Imani thread Marc approved this morning, which sets out to demonstrate how to fix item (a) — finishing the chain artefacts each blocked domain agent needs — by lighting up one full end-to-end thread from regulation to system capability.

The thread landed cleanly. The pattern is replicable for the other blocked domain agents.

## What landed

### 1. Clause library v0 — substrate, schema, one populated entry

- [`prototype/platform/legal/clause-library.schema.json`](../prototype/platform/legal/clause-library.schema.json) — JSON Schema 2020-12 typed shape for a clause: ID, name, category, agreement-types, jurisdictions, version, status, text, parameters, dependencies, and a typed `citations` array (oneOf: `regulation` / `policy` / `isda-protocol` / `statute`). Untyped prose references fail validation by construction.
- [`prototype/platform/legal/_clause-library.md`](../prototype/platform/legal/_clause-library.md) — human-readable index plus the first populated clause, `CL-GVL-001` (Governing law — South Africa). The clause embeds an ECTA "data message" recognition statement directly in its text and carries six typed citations spanning statute, regulation (`ORG-EL-01`, `ORG-EL-02`), policy stubs, and ISDA protocol (`2002 ISDA Master Agreement §13(a)`).
- Coverage table inside `_clause-library.md` names the next slice of clauses (jurisdiction / forum, dispute resolution, electronic execution, set-off, FATCA / CRS, sanctions, calculation agent, force majeure, confidentiality) — they populate at scheduled weekly cadence per Imani spec §6.

### 2. Legal-entity tree v0 — substrate, schema, single-node skeleton

- [`prototype/platform/legal/legal-entity-tree.schema.json`](../prototype/platform/legal/legal-entity-tree.schema.json) — typed shape for a node: stable ID, registered name, jurisdiction, registrar reference, LEI, parent, type, status, regulator instruments (array — Principle 5), currencies (array — Principle 5), statutory officers, semantic version.
- [`prototype/platform/legal/_legal-entity-tree.md`](../prototype/platform/legal/_legal-entity-tree.md) — single node `LE-ZA-BANKNEWCO` (placeholder name pending `D-BANK-NAME-SELECTION`); pre-incorporation status; SARB-PA, FSCA, Information-Regulator licences flagged `pending`; ZAR / USD / EUR / GBP currencies declared at the entity level (no implicit defaults — Principle 5); officers empty by build-phase design.
- Shape supports adding the second of any of {entity, jurisdiction, currency} as a `LegalEntityChange` event without reshaping consumers — adding the second is a configuration, not a project.

### 3. Two stub policies — `STUB`, not `PLANNED`

- [`Owner Inbox/2026-05-07_imani_legal-policies-bundle-v0.md`](2026-05-07_imani_legal-policies-bundle-v0.md) — Contracting Policy v0.1 and Document Execution Policy (ECTA) v0.1. Both deliberately minimal: enough to anchor citations, no more. The bundle is honest about its scope; full BRC-grade policies are on Imani's annual-cycle drafting queue.
- Owen — please flip both register entries from `PLANNED` to `STUB` in [`Owner Inbox/2026-05-06_policy-register.md`](2026-05-06_policy-register.md), with a pointer to this bundle as the canonical source per the canonical-source-registry convention.

### 4. The keystone procedure — `counterparty-governing-law-clause-adoption.md`

- [`Procedures/by-policy/counterparty-governing-law-clause-adoption.md`](../Procedures/by-policy/counterparty-governing-law-clause-adoption.md) — `PROC-LEG-CL-01`. Eight steps; every step names actor and system capability; reconciliation criteria specified; failure modes and escalation cited to Imani spec §10.
- The procedure runs **today** in build-phase scope against Saskia's soft-franchise / negotiations-in-principle pipeline (no live signed agreements yet, but the structured artefact is real). At licence-day it shifts onto live counterparty signings without architectural change.
- Procedures index updated: status summary moved from 10 → 11 populated procedures.

### 5. Imani's spec — change-log entry

- [`Team/Imani.md`](../Team/Imani.md) gained a v1.1 change-log row noting which substrate gaps closed this morning (Substrate Gap §1 — clause-library DSL — markdown+schema slice live, DSL still planned for M1; Substrate Gap §4 — legal-entity tree as live registry — markdown+schema slice live, query API still planned for M1).

## What this demonstrates

The chain reconciles end-to-end:

```
ECTA 25/2002 (statute)
  → ORG-EL-01, ORG-EL-02 (obligations register)
    → Contracting Policy v0.1 §2; Document Execution Policy v0.1 §3 (policy stubs)
      → PROC-LEG-CL-01 — Counterparty governing-law clause adoption (procedure)
        → @platform/legal/clause-library + @platform/legal/legal-entity-registry (system capabilities, today as markdown+schema; M1 as DSL+API)
          → CL-GVL-001 (clause), LE-ZA-BANKNEWCO (entity)
            → NegotiationPositionRecorded event (when fired)
```

You can walk this chain in either direction. Bidirectional resolution is what Principle 6 asks for; this thread shows it land for the first time on Imani's substrate.

## What this unblocks for the other blocked domain agents

The pattern is now concrete enough to copy. The smallest unit of fix-(a) work for each remaining domain agent is:

1. Pick a procedure (highest-leverage scaffolding-slice procedure first).
2. Confirm Mira's obligations register has the regulator citations the procedure discharges (add if missing).
3. Author a stub policy (or stubs) to anchor the procedure under Principle 6.
4. Author the procedure itself using `Procedures/templates/procedure-template.md`.
5. Spec the system capability (markdown + JSON Schema substrate is fine for v0; DSL / API can come later).
6. Update the agent's spec change log noting which substrate gap closed.
7. Drop a short report in Owner Inbox with a chain-walk diagram like the one above.

Ordered by upstream-dependency unblock, the next four threads are:

- **Bea** — chart of accounts + GL→BA-return mapping; one populated procedure (e.g., "Daily GL roll forward and BA-form-line projection refresh"). Unblocks Yael, Rohan, Camille.
- **Rohan** — risk taxonomy + Risk Appetite Statement (Helena co-owner); one populated procedure (e.g., "Daily ECL stage projection refresh on incremental events"). Unblocks Ravi, Helena's appetite framework, Saskia's market-risk warehouse.
- **Niko** — FAIS advice-record schema + suitability questionnaire substrate (paused until licence-day for live use, but scaffolding can land now); one populated procedure ("FAIS advice record capture, structured-form").
- **Tomas** — ISO 20022 message catalogue + sponsor-bank operating-model spec; one populated procedure ("Outbound payment instruction lifecycle (sponsor-bank channel)") — note: this depends on Imani's clause library having the sponsor-bank correspondent-banking clauses, which is its own follow-on slice.

Each is roughly the same shape and weight as today's Imani thread. None requires a full BRC-grade policy first — the stub-policy pattern is sufficient to unblock the chain, and the canonical-source-registry convention keeps the stubs honest.

## Substrate-gap notes (still open)

| Gap | Status today | Owner | Target |
|---|---|---|---|
| Clause-library DSL | Markdown+JSON Schema substrate live; DSL not yet | Imani + Atlas | M1 |
| ECTA-execution engine (HSM integration) | Policy stubs cite the integration; runtime not yet | Imani + Senna + Atlas | Pre-licence |
| Legal-entity registry as queryable API | Markdown+JSON Schema substrate live; query API not yet | Imani + Anya | M1 |
| Agent-runtime substrate (Atlas A0–A3) | Procedure runs against soft-franchise pipeline manually today; event-trigger bus pending | Atlas | Atlas's published roadmap |
| BRC-approved full Contracting and Document Execution policies | Stubs at v0.1 | Imani | Annual policy cycle |
| Vera clause-library / legal-entity-tree recon | Planned (Wave-4 candidate) | Vera | Vera's published wave plan |

These are all roadmap items (per Principle 7), not defects. The fix-(a) work doesn't require them to land first; it requires that the chain reconciles given today's substrate. It does.

## Asks of Marc

None — informational. The thread is the demonstration; if the pattern is right, Scrooge will sequence Bea next, then Rohan, then Niko, then Tomas, on each agent's own cadence.

If Marc wants to inspect the chain in either direction, the most readable entry points are:

- **Top-down (regulation → capability):** [`Regulations/_obligations-register.md` Domain K](../Regulations/_obligations-register.md) → [stub policy](2026-05-07_imani_legal-policies-bundle-v0.md) → [procedure](../Procedures/by-policy/counterparty-governing-law-clause-adoption.md) → [clause library](../prototype/platform/legal/_clause-library.md) → `CL-GVL-001`.
- **Bottom-up (capability → regulation):** [`prototype/platform/legal/_clause-library.md`](../prototype/platform/legal/_clause-library.md) → `CL-GVL-001` citations → ECTA 25/2002 + ISDA §13(a) + the policy stubs.

—Imani (via Scrooge)
