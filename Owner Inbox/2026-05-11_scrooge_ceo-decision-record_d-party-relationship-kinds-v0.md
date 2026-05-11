---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-11T04:16:09.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-PARTY-RELATIONSHIP-KINDS-V0, 2026-05-11

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-PARTY-RELATIONSHIP-KINDS-V0`
- **Title:** Closed v0 enum of Party relationship kinds — typed graph edges between Parties
- **Action:** approve
- **Source proposal:** [`/Users/marc/.claude/plans/the-business-needs-um-bright-boot.md`](file:///Users/marc/.claude/plans/the-business-needs-um-bright-boot.md) §1 "Relationship `kind` enum" + §1 "Intrinsic kind vs relational role"
- **Outcome:** Approve the v0 closed enum of Party relationship kinds — grouped by **semantics**, not by source-kind, because most edges accept either a natural-person or an agent at the source end. New kinds beyond this v0 require a follow-up CEO decision because each encodes regulatory semantics (and therefore citation requirements). The edge schema in `prototype/domains/party/types.ts` enforces source-kind / target-kind constraints at append time via `validatePayload`; an attempt to assert `director-of` from an agent source, or `parent-of` between two counterparties, is rejected at the boundary.

  **v0 kinds:**
  - **Authority / representation** (source: natural-person OR agent; target: any party): `acts-on-behalf-of` (general agency), `signatory-of` (legal signature authority), `authorised-trader-for` (trading mandate), `key-individual-of` (FAIS-defined), `employee-of`, `contractor-of`
  - **Governance / control** (source: natural-person; target: legal-entity OR counterparty): `director-of`, `ubo-of` (natural-person at the bottom of a corporate chain)
  - **Service / commercial** (source: any party; target: any party): `sponsor-bank-for`, `correspondent-bank-for`, `intermediary-for`, `external-counsel-to`, `auditor-of`, `intra-group-counterparty-of`
  - **Org structure** (source: legal-entity; target: legal-entity): `parent-of`
  - **Workforce / oversight** (source: agent; target: agent OR natural-person): `reports-to`, `subject-to-oversight-of` (third-line independence routing)
  - **Personal network — PEP-relevant** (source: natural-person; target: natural-person): `spouse-of`, `parent-of-natural`, `business-associate-of`

- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** Approved as the relationship-kind layer of the unified Party event family — see paired decision `D-PARTY-REGISTER`.
- **Authority chain:** Standing CEO authority over substrate architecture (Principles 2 + 6 in [`CLAUDE.md`](../CLAUDE.md)). Underwrites obligations under Companies Act 71 of 2008 s.69 (`director-of`), FIC Act 38 of 2001 s.21B (`ubo-of` + `BeneficialOwnerChainAsserted`), FAIS Act 37 of 2002 (`key-individual-of`), Banks Act 94 of 1990 fit-and-proper requirements (`director-of`, `key-individual-of`), Banks Act s.77(2) + IAS 24 (`spouse-of`, `parent-of-natural`, `business-associate-of` for related-party detection), Companies Act s.45 + Banks Act intra-group exposure rules (`intra-group-counterparty-of`, `parent-of`).

## Follow-on routes recorded

- Bundled with `D-PARTY-REGISTER`'s follow-on routes; no separate dispatch chain. PR 1 (Atlas, this session) implements the source-kind / target-kind constraint enforcement; PR 3 (Imani + Owen) is the first regular-use of the relationship layer.

## Substrate gaps surfaced

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | Source-kind / target-kind constraint table encoded in `prototype/domains/party/schemas.ts` so `validatePayload` rejects ill-typed edges at the boundary | Atlas (Core banking platform architect; substrate) | PR 1 |
| 2 | Recon pipeline asserting every emitted `PartyRelationshipAsserted` carries a citation appropriate to its `kind` (e.g. `director-of` cites Companies Act s.69; `ubo-of` cites FIC s.21B) | Mira (Compliance / RegTech engineer) | PR 1 or PR 2 |
| 3 | Sub-views on `Regulations/_party-relationships-register.md` — directors-by-entity, signatories-by-counterparty, UBO-chains, agent-reports-to-tree, related-party declarations | Owen (Company Secretary, governance) | PR 2 |

## Change log

- 2026-05-11 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
