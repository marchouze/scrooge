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
`PartyDeactivated`). Per Principle 2 every actor — human, organisation,
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
| Natural person | 1 |
| **Total** | **31** |

The 0 counts for counterparty are the build-phase default (per CLAUDE.md
"Build phase vs licence-day" — no real customers yet). The
natural-person count is **1** as of PR 3 of D-PARTY-REGISTER (Marc as
the founding CEO seat); subsequent natural persons land at licence-day
when the statutory human roster (directors, MLRO, CISO, CAE, auditor)
is appointed and signatory natural persons land per `signatory-of`
edges as counterparties progress past KYC.

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
register. As of PR 3, all 27 personas resolve up the chain to Marc's
natural-person Party — top-of-house personas whose roster `reportsTo`
is "CEO" / "Marc" emit a direct edge into Marc; the remaining 17
personas resolve via in-fleet edges to a top-of-house persona.

### Counterparty Parties

Empty at v0 — counterparty lifecycle activates at licence-day per Niko
(Customer onboarding engineer)'s `buildPhaseStatus`. The substrate path
is wired (the backfill folds
`CounterpartySoundingOpened` / `CounterpartyProspectRegistered` /
`CounterpartyActivated` / `CounterpartyOffboarded` into
`PartyRegistered{kind: "counterparty"}` + `PartyClassified` for the
current lifecycle status). When the first sounding lands, the row appears.

### Natural-person Parties

As of PR 3, the founding **CEO seat** is registered. Subsequent
natural-person Parties land as the build phase advances and at
licence-day per CLAUDE.md "Build phase vs licence-day".

| Party URN | Display name | Legal name | Purpose roles | Jurisdictions / tax residencies | Source |
|---|---|---|---|---|---|
| `urn:party:natural-person:marc` | Marc | Marc Hou | `ceo` | ZA / ZA | Founding CEO seat (PR 3) — see [`prototype/scripts/party-backfill.ts`](../prototype/scripts/party-backfill.ts) `backfillCeoSeat` step (`MARC_CEO_SEED_ID = "seed:ceo-marc:v1"`). |

Per CLAUDE.md identity (`Owner: Marc (marc@tgv.co.za)`) and the
`marchouze` git identity memory. Citations on the registration event:
Companies Act 71 of 2008 § 66 (board / CEO statutory director slot),
Banks Act 94 of 1990 § 60 + Reg 36 (controlling-company governance),
D-LEGAL-ENTITY-TREE-V0 (CEO seat sits across all three Hoz entities
under the shared-board v0 model), D-PARTY-REGISTER, POPIA Act 4 of
2013 s.19–22.

Subsequent natural-person Parties land as:

- Directors as fit-and-proper assessments clear (per Owen, Company
  Secretary).
- Signatories on any counterparty that progresses past KYC (auto-minted
  by the substrate from `AuthorisedSignatoryAdded` events).
- The human MLRO / Information Officer / CAE / CISO / auditor at
  licence-day (statutory humans only — Marc remains CEO).

PII discipline (Principle 4 + POPIA s.19–22) — Marc's record carries
only minimisation-safe fields (`displayName`, `legalName`,
`nationalities`, `taxResidencies`, `purposeRoles`); `dobHashRef` and
`piiDocumentRef` are unset pre-licence-day. The full PII bundle (DOB,
ID number, residential address, source-of-funds documentation)
registers via the BLAKE3 document store at licence-day.

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

Per Principle 6 (substrate-gap inventory transparency).

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | ~~First natural-person Party — Marc as CEO seat~~ | Imani + Owen | **CLOSED PR 3** — `urn:party:natural-person:marc` registered with `purposeRoles: ["ceo"]`; backfill step `backfillCeoSeat` keyed by `MARC_CEO_SEED_ID = "seed:ceo-marc:v1"`. |
| 2 | Field-tightening on `customer/types.ts` (`personId: string` → `PartyId`); deprecation flags on legacy registration event types | Atlas | PR 4 of D-PARTY-REGISTER |
| 3 | `BeneficialOwnerChainAsserted` worked example (FIC Act s.21B UBO chain through to natural-person) | Imani + Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance) | PR 5 of D-PARTY-REGISTER |
| 4 | ~~Top-of-house `reports-to` edges (e.g. Devon → CEO; Owen → CEO)~~ | Imani + Owen | **CLOSED PR 3** — 10 top-of-house personas now emit `reports-to` edges into Marc's natural-person Party via the agent-step's `topOfHousePartyId` resolution. |
| 5 | `Party*` event types not yet in any agent's `eventEmitAllowList` — backfill runs as `system` actor by design (substrate-side seed-loader, not autonomous-agent emit). When agents start emitting Party events directly (post-PR 4), their permission policies need extending. | Atlas + Senna (Security engineer) | PR 4 / PR 5 |
| 6 | Deprecated event types (`LegalEntityRegistered` / `agentRegistered` / `CounterpartySoundingOpened` / `…ProspectRegistered` / `AuthorisedSignatoryAdded` / `…Removed` / `CounterpartyActivated` / `CounterpartyOffboarded`) need `status: "deprecated"` in the registry so Vera catches new emissions | Atlas | PR 4 of D-PARTY-REGISTER |
| 7 | Marc's PII bundle (DOB, ID number, residential address, source-of-funds documentation) registers via the BLAKE3 document store with `piiDocumentRef` + `dobHashRef` populated | Imani + Iris (Information Officer, governance) | Licence-day |
| 8 | `purposeRoles` enum should grow a dedicated `ceo-seat` value distinct from licence-day `ceo` to surface the build-phase founding seat in audit views (currently both collapse to `ceo`) | Atlas + Imani | Wave-5 / PR 4+ |

## Citation chain

- **Principle 1** ([`CLAUDE.md`](../CLAUDE.md)) — events as source of truth; the Party graph is materialised in the event log.
- **Principle 5** ([`CLAUDE.md`](../CLAUDE.md)) — multi-jurisdiction from day one.
- **Principle 2** ([`CLAUDE.md`](../CLAUDE.md)) — single-graph discipline; the Party register is the identity-axis projection.
- **Principle 6** ([`CLAUDE.md`](../CLAUDE.md)) — autonomous-by-default; agent Parties are first-class.
- **D-PARTY-REGISTER** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md)).
- **D-PARTY-RELATIONSHIP-KINDS-V0** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md)).
- **D-PARTY-REGISTER-CORRECTION** ([`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md`](../Owner%20Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md)).
- **Records Management Substrate Phase 1 doc-store pattern** for `piiDocumentRef` (BLAKE3 hashes; HSM-managed at Azure-day) — [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](../Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md).
- **Canonical-source registry rule** (`feedback_canonical_source_registry.md`) — this file is the canonical authoring location; `prototype/seeds/party-register.json` is its derived cache.
- Statutory anchors (per-payload, P2): Companies Act 71 of 2008 (incorporation, s.66 signatories, s.69 directors), Banks Act 94 of 1990 (s.7 banking licence, s.11 form, s.60 controlling-company, fit-and-proper), FIC Act 38 of 2001 (s.21 CDD, s.21B UBO recursion, s.22 records), POPIA Act 4 of 2013 (s.19–22 minimum-necessary), FAIS Act 37 of 2002 (key individuals).
