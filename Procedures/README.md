# Procedures library

**Curators:** Domain leads (each procedure has a single named owner)
**Cross-cutting governance:** Owen (procedural-discipline custodian) · Mira (citation linkage)
**Created:** 2026-05-06

## Purpose

The procedures library is the **operational expression of Principle 7** — the implementation chain `Reg → Policy → Procedure → System Capability`. Procedures sit between policy (WHAT) and system capability (HOW it actually runs).

A **procedure** specifies:

- **Trigger** — what causes the procedure to run.
- **Steps** — the ordered actions, each naming the **actor** (system / human / service) and the **system capability** the action invokes.
- **Reconciliation** — how we know the procedure was performed correctly (events produced, rec checks, evidence).
- **Evidence / artefacts** — what gets persisted, where, and for how long.

Procedures are preferentially **automated** — manual steps are tracked exceptions, justified under P2.

## Layout

```
/Procedures/
  README.md                       — this file
  _index.md                       — every procedure, by owner and by source policy
  templates/
    procedure-template.md         — canonical template every procedure follows
  by-policy/                      — procedures organised by source policy
    kyc-onboarding.md             — Onboarding KYC (gate before client master entry)
    kyc-recurring.md              — Periodic recurring KYC per FIC GN 7 RBA
    kyc-continuous.md             — Signal-driven re-evaluation (continuous KYC)
    sanctions-screening.md        — Pre-execution sanctions screening
    sanctions-override.md         — MLRO-signed production override
    incident-response.md          — Cyber / operational IR command
    popia-breach-notification.md  — POPIA s.22 breach-notification workflow
    popia-dsar.md                 — Data subject access request
    conflicts-declaration.md      — Director / employee conflicts declaration
    capital-ratio-monitoring.md   — Daily LCR / NSFR / CET1 monitoring
    str-filing.md                 — STR / SAR filing (FIC s.29)
    change-management.md          — Production change approval and deployment
    fit-and-proper-attestation.md — Annual fit-and-proper attestation
    whistleblowing-case.md        — Whistleblowing case intake and routing
    delegation-of-authority.md    — DoA-gated action authorisation
    ...
```

## Reconciliation chain (P7)

Each procedure file carries:

1. **Source policy** — explicit citation to the policy it implements (linking to the policy in `Owner Inbox/2026-05-06_core-policies-*.md`).
2. **Source regulation(s)** — the obligations register entries `ORG-*` it transitively discharges.
3. **System capability** — named platform component(s) under `/prototype/platform/` (and eventually production code).

The chain reconciles **bidirectionally**:

- Given a regulation → find policy → find procedure → find system capability.
- Given a system capability → find every procedure it supports → find every policy → find every regulation it serves.

The procedures index (`_index.md`) renders this mapping in tabular form for fast lookup.

## How to author a procedure

1. Open `templates/procedure-template.md` and copy it.
2. Fill in: owner, source policy, source regulation, trigger, steps, reconciliation, evidence.
3. Each step must name (a) the actor, (b) the system capability it uses, (c) any human discretion involved.
4. Where the system capability does not yet exist, mark it `PLANNED` and identify which platform component will house it.
5. Submit via the policy library's review pathway (Owen runs the procedural-discipline review; the policy owner approves substantively).

## How procedures evolve

- Amendments are typed events: `ProcedureRevised { procedure_id, version, summary, citation }`.
- Decommissioning is also an event: `ProcedureRetired { procedure_id, replaced_by, reason }`.
- Vera (audit) consumes procedure-revision events as continuous-controls evidence.
- Mira's obligations-register row for the underlying regulation is updated when a procedure-fulfilment changes.

## Status today

The library is **scaffolded** with the canonical template and a set of **exemplar procedures** covering high-value cross-domain operational flows. The full coverage (one or more procedures per approved policy — ~41 policies in force after Round 2) is the drafting queue for domain leads under Owen's coordination.
