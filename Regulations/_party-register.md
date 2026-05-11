---
title: Party register — unified identity axis across all four actor kinds
authors:
  - Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance)
  - Owen (Company Secretary, governance; reports to CEO)
  - Atlas (Core banking platform architect; substrate)
date: 2026-05-11
source: D-PARTY-REGISTER (CEO approved 2026-05-11; PR 1 substrate landed scrooge#203; PR 2 backfill + projection)
proposal: /Users/marc/.claude/plans/the-business-needs-um-bright-boot.md
---

# Party register

Canonical, citable list of every Party the bank deals with — the single
identity axis across all four actor kinds (`natural-person`,
`legal-entity`, `counterparty`, `agent`). Each Party is born by a
`PartyRegistered` event in the unified Party event family
([`prototype/domains/party/`](../prototype/domains/party/types.ts)) and
projected into a typed read-model by the Party projection
([`prototype/platform/identity/party-projection.ts`](../prototype/platform/identity/party-projection.ts)).

The substrate seed at
[`prototype/seeds/party-register.json`](../prototype/seeds/party-register.json)
is a typed mirror of this register; **this register here is the canonical
authoring location** and the substrate seed is its derived form (per
`feedback_canonical_source_registry.md` — single canonical authoring
location per fact-type; cross-references are typed citations, never
prose copies).

Per CLAUDE.md Principle 1 the Party graph is materialised in the event
log via the 10 Party event types
(`PartyRegistered`, `PartyAttributeChanged`, `PartyClassified`,
`PartyDeclassified`, `PartyScreeningCompleted`,
`PartyRelationshipAsserted`, `PartyRelationshipChanged`,
`PartyRelationshipRevoked`, `BeneficialOwnerChainAsserted`,
`PartyDeactivated`). Per Principle 6 every actor — human, organisation,
artificial — sits in one citable graph; the Party register is the
identity-axis projection of that graph.

The unified Party choice supersedes the previously-separate
legal-entity-tree, counterparty, and agent registers as the *identity*
authority. Kind-specific *business* events (KYC tier, intra-group
arrangement, mandate, agent dispatch) stay in their existing domains
and reference Party URNs as foreign keys.

## URN scheme

Stable surface key: `urn:party:<kind>:<slug>` where `<kind>` is one of
`natural-person | legal-entity | counterparty | agent` and `<slug>` is
URL-safe. Examples:

- `urn:party:legal-entity:hoz-bank`
- `urn:party:counterparty:acme-am` (worked example, scenario only at v0)
- `urn:party:agent:scrooge`
- `urn:party:natural-person:np-<8-hex>` (deterministic-hash slug for PII discipline)

## Active Parties (as-of 2026-05-11)

### By kind — totals

| Kind | Count |
|---|---:|
| Legal entity | 3 |
| Counterparty | 0 |
| Agent | 27 |
| Natural person | 0 |
| **Total** | **30** |

The 0 counts for counterparty + natural person are the build-phase
default (per CLAUDE.md "Build phase vs licence-day" — no real customers
yet; signatory natural persons activate when a counterparty progresses
past KYC). PR 3 of D-PARTY-REGISTER mints Marc as the first
natural-person Party (CEO seat), at which point the count becomes ≥ 1.

### Legal-entity Parties

URNs project from `LegalEntityRegistered` events; Party URN slug is the
entity-slug component of the source URN
(`urn:legal-entity:hoz:hoz-bank:v1` → `urn:party:legal-entity:hoz-bank`).

| Party URN | Display name | Form | Jurisdictions | Primary regulator |
|---|---|---|---|---|
| `urn:party:legal-entity:hoz-group` | Hoz Group Limited | Ltd | ZA | none-companies-act-only |
| `urn:party:legal-entity:hoz-bank` | Hoz Bank Limited | Ltd | ZA | PA |
| `urn:party:legal-entity:hoz-securities` | Hoz Securities Limited | Ltd | ZA | JSE |

The `parent-of` edges between these Parties are in the relationships
register; see
[`Regulations/_party-relationships-register.md`](_party-relationships-register.md).

### Agent Parties (in-house workforce — 27 personas)

URNs project from `AgentRegistered` events; Party URN slug is the lower-
cased persona slug (`agent:scrooge` → `urn:party:agent:scrooge`).

The full 27-persona list is the canonical roster at
[`Team/_team-roster.json`](../Team/_team-roster.json) — each
persona name corresponds to a `urn:party:agent:<lowercased-name>` Party
URN. The roster is the structured source of truth; this register
projects from the AgentRegistered events emitted by the fleet rollout
on dashboard boot
([`prototype/scripts/register-fleet.ts`](../prototype/scripts/register-fleet.ts)).

The `reports-to` edges across the workforce are in the relationships
register. Edges where the source persona reports to a non-Party label
("CEO", "Marc") do not currently resolve in the graph; they activate in
PR 3 when the natural-person CEO seat is registered.

### Counterparty Parties

Empty at v0 — counterparty lifecycle activates at licence-day per Niko
(Customer onboarding engineer)'s `buildPhaseStatus`. The substrate path
is wired (the backfill folds
`CounterpartySoundingOpened` / `CounterpartyProspectRegistered` /
`CounterpartyActivated` / `CounterpartyOffboarded` into
`PartyRegistered{kind: "counterparty"}` + `PartyClassified` for the
current lifecycle status). When the first sounding lands, the row appears.

### Natural-person Parties

Empty at v0 — pre-licence-day data scope per CLAUDE.md "Build phase vs
licence-day". The first natural-person Party will be Marc (CEO seat,
PR 3). Subsequent natural-person Parties land as:

- Directors as fit-and-proper assessments clear (per Owen, Company
  Secretary).
- Signatories on any counterparty that progresses past KYC (auto-minted
  by the substrate from `AuthorisedSignatoryAdded` events).
- The human CEO / MLRO / Information Officer / CAE / auditor at
  licence-day (statutory humans only).

PII discipline (Principle 4 + POPIA s.19–22): natural-person events
carry only minimisation-safe fields (`displayName`, `legalName`,
`nationalities`, `taxResidencies`, `purposeRoles`); date-of-birth, ID
number, residential address, and source-of-funds documentation live in
the BLAKE3 document store referenced by `piiDocumentRef` (RMS Phase 1
doc-store pattern).

## By jurisdiction

All v0 Parties are ZA-jurisdiction. The Party register is multi-
jurisdiction-from-day-one (Principle 5) — the schema accepts a list of
ISO 3166-1 alpha-2 codes per Party.

## By classification

`PartyClassified` events project into per-Party classification sets.
Counterparty lifecycle status (`Sounding`, `Prospect`, `KycPassed`,
`Active`, `Offboarded`) is a classification, not a kind change — the
kind stays `counterparty` for the Party's lifetime.

At v0 there are no active classifications because no counterparties
exist yet.

## Substrate gaps surfaced

Per Principle 7 (substrate-gap inventory transparency).

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | First natural-person Party — Marc as CEO seat | Imani + Owen | PR 3 of D-PARTY-REGISTER (queues behind PR 2) |
| 2 | Field-tightening on `customer/types.ts` (`personId: string` → `PartyId`); deprecation flags on legacy registration event types | Atlas | PR 4 of D-PARTY-REGISTER |
| 3 | `BeneficialOwnerChainAsserted` worked example (FIC Act s.21B UBO chain through to natural-person) | Imani + Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) | PR 5 of D-PARTY-REGISTER |
| 4 | Top-of-house `reports-to` edges (e.g. Devon → CEO; Owen → CEO) — currently labelled "CEO" / "Marc" in the roster, not a Party URN; resolve when PR 3 activates the CEO seat | Imani + Owen | PR 3 |
| 5 | `Party*` event types not yet in any agent's `eventEmitAllowList` — backfill runs as `system` actor by design (substrate-side seed-loader, not autonomous-agent emit). When agents start emitting Party events directly (post-PR 4), their permission policies need extending. | Atlas + Senna (Security engineer) | PR 4 / PR 5 |
| 6 | Deprecated event types (`LegalEntityRegistered` / `agentRegistered` / `CounterpartySoundingOpened` / `…ProspectRegistered` / `AuthorisedSignatoryAdded` / `…Removed` / `CounterpartyActivated` / `CounterpartyOffboarded`) need `status: "deprecated"` in the registry so Vera catches new emissions | Atlas | PR 4 of D-PARTY-REGISTER |

## Citation chain

- **Principle 1** ([`CLAUDE.md`](../CLAUDE.md)) — events as source of truth; the Party graph is materialised in the event log.
- **Principle 5** ([`CLAUDE.md`](../CLAUDE.md)) — multi-jurisdiction from day one.
- **Principle 6** ([`CLAUDE.md`](../CLAUDE.md)) — single-graph discipline; the Party register is the identity-axis projection.
- **Principle 7** ([`CLAUDE.md`](../CLAUDE.md)) — autonomous-by-default; agent Parties are first-class.
- **D-PARTY-REGISTER** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md)).
- **D-PARTY-RELATIONSHIP-KINDS-V0** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md)).
- **D-PARTY-REGISTER-CORRECTION** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md)).
- **Records Management Substrate Phase 1 doc-store pattern** for `piiDocumentRef` (BLAKE3 hashes; HSM-managed at Azure-day) — [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](../Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md).
- **Canonical-source registry rule** (`feedback_canonical_source_registry.md`) — this file is the canonical authoring location; `prototype/seeds/party-register.json` is its derived cache.
- Statutory anchors (per-payload, P2): Companies Act 71 of 2008 (incorporation, s.66 signatories, s.69 directors), Banks Act 94 of 1990 (s.7 banking licence, s.11 form, s.60 controlling-company, fit-and-proper), FIC Act 38 of 2001 (s.21 CDD, s.21B UBO recursion, s.22 records), POPIA Act 4 of 2013 (s.19–22 minimum-necessary), FAIS Act 37 of 2002 (key individuals).
