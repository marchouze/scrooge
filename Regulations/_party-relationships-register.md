---
title: Party relationships register — typed graph edges across the Party graph
authors:
  - Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance)
  - Owen (Company Secretary, governance; reports to CEO)
  - Atlas (Core banking platform architect; substrate)
date: 2026-05-11
source: D-PARTY-REGISTER (CEO approved 2026-05-11) + D-PARTY-RELATIONSHIP-KINDS-V0 (CEO approved 2026-05-11)
proposal: /Users/marc/.claude/plans/the-business-needs-um-bright-boot.md
---

# Party relationships register

Canonical, citable list of every typed graph edge between Parties in the
unified Party graph. Each edge is a `PartyRelationshipAsserted` event
(or its scope-narrowed / scope-widened / evidence-refreshed variant via
`PartyRelationshipChanged`); a terminal `PartyRelationshipRevoked`
removes the edge from the live graph.

The substrate seed at
[`prototype/seeds/party-relationships-register.json`](../prototype/seeds/party-relationships-register.json)
is a typed mirror of this register; **this register here is the canonical
authoring location** and the substrate seed is its derived form (per
`feedback_canonical_source_registry.md`).

## v0 relationship kinds

Per D-PARTY-RELATIONSHIP-KINDS-V0, the v0 enum is closed at 20 kinds
grouped by semantics. New kinds beyond v0 require a follow-up CEO
decision because each encodes regulatory semantics. The source-kind /
target-kind constraint table is enforced at append time via the
`partyRelationshipAssertedPayloadSchema.superRefine(...)` against
`RELATIONSHIP_KIND_CONSTRAINTS` in
[`prototype/domains/party/schemas.ts`](../prototype/domains/party/schemas.ts).

| Semantic group | Kind | Source kinds | Target kinds |
|---|---|---|---|
| Authority / representation | `acts-on-behalf-of`, `signatory-of`, `authorised-trader-for`, `key-individual-of`, `employee-of`, `contractor-of` | natural-person, agent | any |
| Governance / control | `director-of`, `ubo-of` | natural-person | legal-entity, counterparty |
| Service / commercial | `sponsor-bank-for`, `correspondent-bank-for`, `intermediary-for`, `external-counsel-to`, `auditor-of`, `intra-group-counterparty-of` | any | any |
| Org structure | `parent-of` | legal-entity | legal-entity |
| Workforce / oversight | `reports-to`, `subject-to-oversight-of` | agent | agent, natural-person |
| Personal network — PEP-relevant | `spouse-of`, `parent-of-natural`, `business-associate-of` | natural-person | natural-person |

## Live edges (as-of 2026-05-11)

### Totals by kind

| Kind | Count |
|---|---:|
| `parent-of` | 2 |
| `reports-to` | 27 |
| `acts-on-behalf-of` | 3 |
| **Total** | **32** |

As of PR 3 of D-PARTY-REGISTER, all 27 personas have a resolved
`reports-to` edge: 17 in-fleet edges (persona → manager-persona) and 10
top-of-house edges into Marc's natural-person Party. The 3
`acts-on-behalf-of` edges from Marc to the three Hoz legal-entity
Parties are also live (per the shared-board v0 model under
D-LEGAL-ENTITY-TREE-V0).

### `parent-of` edges (org-structure — legal-entity → legal-entity)

| Relationship ID | From | To |
|---|---|---|
| `relationship:parent-of:urn:party:legal-entity:hoz-group->urn:party:legal-entity:hoz-bank` | Hoz Group | Hoz Bank |
| `relationship:parent-of:urn:party:legal-entity:hoz-group->urn:party:legal-entity:hoz-securities` | Hoz Group | Hoz Securities |

### `reports-to` edges (workforce — agent → agent OR agent → natural-person)

Derived from `Team/_team-roster.json` `reportsTo` field per persona.
Two shapes:

- **In-fleet edges (17)** — the source persona's roster `reportsTo` is
  another persona. Examples:
  - `urn:party:agent:pax` → `urn:party:agent:devon` (PAX reports-to Devon)
  - `urn:party:agent:bea` → `urn:party:agent:camille` (Bea reports-to Camille)
  - `urn:party:agent:mira` → `urn:party:agent:zara` (Mira reports-to Zara)
  - `urn:party:agent:kai` → `urn:party:agent:saskia` (Kai reports-to Saskia)
  - `urn:party:agent:rohan` → `urn:party:agent:helena` (Rohan reports-to Helena)

- **Top-of-house edges into Marc (10)** — the source persona's roster
  `reportsTo` is the literal string "CEO" or "Marc"; the
  `backfillCeoSeat` step in
  [`prototype/scripts/party-backfill.ts`](../prototype/scripts/party-backfill.ts)
  resolves both labels to `urn:party:natural-person:marc`. The 10
  edges:
  - `urn:party:agent:helena` → `urn:party:natural-person:marc` (Helena, CRO)
  - `urn:party:agent:owen` → `urn:party:natural-person:marc` (Owen, CoSec)
  - `urn:party:agent:zara` → `urn:party:natural-person:marc` (Zara, CCO)
  - `urn:party:agent:iris` → `urn:party:natural-person:marc` (Iris, IO)
  - `urn:party:agent:devon` → `urn:party:natural-person:marc` (Devon, COO)
  - `urn:party:agent:camille` → `urn:party:natural-person:marc` (Camille, CFO)
  - `urn:party:agent:eitan` → `urn:party:natural-person:marc` (Eitan, Treasurer)
  - `urn:party:agent:saskia` → `urn:party:natural-person:marc` (Saskia, Head of Global Markets)
  - `urn:party:agent:thandiwe` → `urn:party:natural-person:marc` (Thandiwe, CAE — administrative line; functional into AC / Interim Audit Forum)
  - `urn:party:agent:rashida` → `urn:party:natural-person:marc` (Rashida, CISO)

The full `reports-to` chain can be walked via the projection helper
`walkReportsToChain` in
[`prototype/platform/identity/party-projection.ts`](../prototype/platform/identity/party-projection.ts).
Walking from any of the 27 personas converges at Marc.

### Acts-on-behalf-of (CEO authority)

Per D-LEGAL-ENTITY-TREE-V0 shared-board v0 model, Marc as the founding
CEO acts on behalf of all three Hoz legal entities. The three edges are
emitted by the `backfillCeoSeat` step.

| Relationship ID | From | To |
|---|---|---|
| `relationship:acts-on-behalf-of:urn:party:natural-person:marc->urn:party:legal-entity:hoz-group` | Marc | Hoz Group Limited |
| `relationship:acts-on-behalf-of:urn:party:natural-person:marc->urn:party:legal-entity:hoz-bank` | Marc | Hoz Bank Limited |
| `relationship:acts-on-behalf-of:urn:party:natural-person:marc->urn:party:legal-entity:hoz-securities` | Marc | Hoz Securities Limited |

Citations on each edge: D-PARTY-RELATIONSHIP-KINDS-V0,
D-LEGAL-ENTITY-TREE-V0, Companies Act 71 of 2008 § 66 (director / CEO
authority), CLAUDE.md identity (`Owner: Marc (marc@tgv.co.za)`).

### Other relationship kinds

Empty at v0 — see substrate gaps below.

## Sub-views

### Directors by entity (governance / control)

Empty at v0 (no `director-of` edges yet). Directors land via
`LegalEntityChanged{changeType: "director-added"}` events as fit-and-
proper assessments clear; the substrate path is wired but no
appointments are formal pre-licence-day.

### Signatories by counterparty (authority / representation)

Empty at v0 (no `signatory-of` edges yet — no counterparty has KYC-
cleared and progressed to authorised-signatory step). The substrate
path is wired: `AuthorisedSignatoryAdded` events fold into
`PartyRelationshipAsserted{kind: "signatory-of"}` + a minted natural-
person Party for the signatory.

### UBO chains (governance / control — FIC Act s.21B)

Empty at v0 — `BeneficialOwnerChainAsserted` worked example lands in
PR 5 of D-PARTY-REGISTER.

### Agent reports-to tree (workforce / oversight)

27 live edges in the workforce graph (17 in-fleet + 10 top-of-house
into Marc); see the by-kind totals above. Full tree query via
`walkReportsToChain(projection, startPartyId)`. The tree converges at
`urn:party:natural-person:marc` (the founding CEO seat) for every
persona; example walk: `urn:party:agent:pax → urn:party:agent:devon →
urn:party:natural-person:marc`.

### Related-party declarations

Empty at v0 — `intra-group-counterparty-of` edges between Hoz Bank and
Hoz Securities follow `IntraGroupArrangementSigned` events; per the
legal-entity-tree v0 register §"Intra-group arrangements" all v0
arrangements are `not-yet-executed`.

## Source-kind / target-kind constraint table (canonical)

Single source-of-truth for the v0 enum's source/target groups. The Zod
schema enforces this at append time — an attempt to assert `director-of`
from an agent source, or `parent-of` between two counterparties, is
rejected at the boundary.

The full constraint table lives in code at
[`prototype/domains/party/schemas.ts`](../prototype/domains/party/schemas.ts)
(`RELATIONSHIP_KIND_CONSTRAINTS`); the rendered summary is the table at
"v0 relationship kinds" above. Drift between this register and the code
table is a Vera finding (recon pipeline to land — see substrate gaps).

## Substrate gaps surfaced

Per Principle 7.

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | ~~Top-of-house `reports-to` edges (Devon → CEO, Owen → CEO, …)~~ | Imani + Owen | **CLOSED PR 3** — 10 edges into `urn:party:natural-person:marc` are now live; full agent reports-to tree converges at Marc. |
| 2 | First `signatory-of` / `director-of` / `key-individual-of` edges land when the first counterparty progresses past KYC and the first board appointments clear fit-and-proper | Imani + Owen + Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) | First counterparty KYC clear / first director appointment |
| 3 | `BeneficialOwnerChainAsserted` worked example | Imani + Mira | PR 5 of D-PARTY-REGISTER |
| 4 | Recon pipeline asserting `RELATIONSHIP_KIND_CONSTRAINTS` table matches this register's rendered table | Vera (Internal audit / continuous-assurance engineer) | Wave-5 |
| 5 | `intra-group-counterparty-of` edges between Hoz Bank ↔ Hoz Securities follow `IntraGroupArrangementSigned` events; activate when arrangements are executed (currently all `not-yet-executed`) | Imani + Bea (Accounting & financial reporting engineer) | Each `IntraGroupArrangementSigned` emission |

## Citation chain

- **Principle 1** ([`CLAUDE.md`](../CLAUDE.md)) — events as source of truth; the relationships register is a projection.
- **Principle 6** ([`CLAUDE.md`](../CLAUDE.md)) — single-graph discipline; edges are first-class citizens of the citable graph.
- **D-PARTY-REGISTER** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md)).
- **D-PARTY-RELATIONSHIP-KINDS-V0** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md)).
- **D-PARTY-REGISTER-CORRECTION** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md)).
- **Canonical-source registry rule** (`feedback_canonical_source_registry.md`) — this file is the canonical authoring location; `prototype/seeds/party-relationships-register.json` is its derived cache.
- Per-edge statutory anchors (P2): Companies Act 71 of 2008 s.66 (signatory authority), s.69 (directors); FIC Act 38 of 2001 s.21B (UBO recursion); FAIS Act 37 of 2002 (key individuals); Banks Act 94 of 1990 s.60 (controlling-company / parent-of edges).
