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
identity axis across all three intrinsic actor kinds (`natural-person`,
`legal-entity`, `agent`). Each Party is born by a
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
`natural-person | legal-entity | agent` and `<slug>` is URL-safe.

Note: `"counterparty"` is **not** a kind — it describes a *relationship* between
two Parties (the bank's trading/business relationship with an external organisation),
not what the actor intrinsically is. Institutional clients (asset managers, banks,
broker-dealers) register as `legal-entity`; the counterparty relationship is
recorded as a `PartyRelationshipAsserted` edge. Per D-PARTY-REGISTER correction
(CEO-approved 2026-05-12).

Examples:

- `urn:party:legal-entity:hoz-bank`
- `urn:party:legal-entity:acme-am` (institutional client — counterparty is a relationship edge, not a kind)
- `urn:party:agent:scrooge`
- `urn:party:natural-person:np-<8-hex>` (deterministic-hash slug for PII discipline)

## Active Parties (as-of 2026-05-20)

### By kind — totals

| Kind | Count |
|---|---:|
| Legal entity | 5 |
| Agent | 27 |
| Natural person | 1 |
| **Total** | **33** |

`"counterparty"` is not a kind — it is a relationship (D-PARTY-REGISTER correction,
CEO-approved 2026-05-12). Institutional clients register as `legal-entity` with a
`counterparty-of` relationship edge. The legal-entity count of 5 covers the bank's
own three entities (Hoz Group, Hoz Bank, Hoz Securities) plus the first two
institutional counterparties added 2026-05-20 for the FX-spot controlled-launch —
**Standard Bank Corporate Treasury** (`urn:party:legal-entity:standard-bank-za`) and
**Investec Bank Treasury** (`urn:party:legal-entity:investec-bank-za`) — registered
as `legal-entity` per D-PARTY-REGISTER correction (kind is intrinsic; counterparty
is a relationship). Authority for the additions: Helena (Chief Risk Officer,
governance) controlled-launch MR-1-FX limit proposal (PR #634) + Imani (Chief
Legal Counsel, governance) G-9 close on ISDA vs bilateral FX Master (PR #637).
The natural-person count is **1** as of PR 3 of D-PARTY-REGISTER (Marc as
the founding CEO seat); subsequent natural persons land at licence-day
when the statutory human roster (directors, MLRO, CISO, CAE, auditor)
is appointed and signatory natural persons land per `signatory-of`
edges as institutional clients progress past KYC.

### Legal-entity Parties

URNs project from `LegalEntityRegistered` events; Party URN slug is the
entity-slug component of the source URN
(`urn:legal-entity:hoz:hoz-bank:v1` → `urn:party:legal-entity:hoz-bank`).

| Party URN | Display name | Form | Jurisdictions | Primary regulator | LEI | Notes |
|---|---|---|---|---|---|---|
| `urn:party:legal-entity:hoz-group` | Hoz Group Limited | Ltd | ZA | none-companies-act-only | — | Bank's controlling company |
| `urn:party:legal-entity:hoz-bank` | Hoz Bank Limited | Ltd | ZA | PA | — | Bank's banking entity. Event-store short-id: `LE-ZA-HOZ-BANK` (registered in `prototype/platform/identity/entity-short-ids.ts` per the entity-identity unification, Atlas + Imani 2026-05-21; supersedes the legacy `BANK-ZA-001` placeholder) |
| `urn:party:legal-entity:hoz-securities` | Hoz Securities Limited | Ltd | ZA | JSE | — | Bank's JSE-member entity |
| `urn:party:legal-entity:investec-bank-za` | Investec Bank Treasury | Ltd | ZA | PA | `549300RH5FFHO48FXT69` | Institutional counterparty — legal name "Investec Bank Limited"; CIPC 1969/004763/06; FX-spot controlled-launch whitelist (PR #634, PR #637); SARB Banks Act bank-licence number TBC |
| `urn:party:legal-entity:standard-bank-za` | Standard Bank Corporate Treasury | Ltd | ZA | PA | `QFC8ZCW3Q5PRXU1XTM60` | Institutional counterparty — legal name "The Standard Bank of South Africa Limited"; CIPC 1962/000738/06; FSP 11287; FX-spot controlled-launch whitelist (PR #634, PR #637); SARB Banks Act bank-licence number TBC |

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

### Institutional counterparty Parties (registered as `legal-entity`)

Two institutional counterparties registered 2026-05-20 for the FX-spot
controlled-launch (per CLAUDE.md "Build phase vs licence-day" — these two
counterparties sit in the legal-entity table above; the wider institutional
client lifecycle still activates at licence-day per Niko (Customer onboarding
engineer)'s `buildPhaseStatus`):

| Party URN | Legal name | LEI | CIPC reg # | Role |
|---|---|---|---|---|
| `urn:party:legal-entity:standard-bank-za` | The Standard Bank of South Africa Limited | `QFC8ZCW3Q5PRXU1XTM60` | 1962/000738/06 | FX-spot controlled-launch whitelist counterparty |
| `urn:party:legal-entity:investec-bank-za` | Investec Bank Limited | `549300RH5FFHO48FXT69` | 1969/004763/06 | FX-spot controlled-launch whitelist counterparty |

Authority chain:

- `D-PARTY-REGISTER` (CEO-approved 2026-05-11) — Party register as unified
  identity axis; counterparties register as `legal-entity` with a
  `counterparty-of` relationship edge (per the 2026-05-12 correction).
- Helena (Chief Risk Officer, governance) — controlled-launch MR-1-FX limit
  proposal (PR #634) names the two-counterparty whitelist, USD/ZAR only,
  per-counterparty notional cap USD 500k/day.
- Imani (Chief Legal Counsel, governance) — G-9 close (PR #637) decides
  ISDA 2002 + South African Schedule for both counterparties, no CSA at
  controlled-launch, anchored on the Bowmans 2024-04-15 SA netting opinion.

The `counterparty-of` `PartyRelationshipAsserted` edges from each counterparty
to Hoz Bank, the operational FX-spot scope classification, and the netting-set
register rows (`NS-standard-bank-za-USD`, `NS-investec-bank-za-USD`) land in
follow-on PRs from Imani + Helena (out of scope here per the brief — this PR
is the Party register row only).

Legacy backfill path: `CounterpartySoundingOpened` /
`CounterpartyProspectRegistered` / `CounterpartyActivated` /
`CounterpartyOffboarded` folds into `PartyRegistered{kind: "legal-entity"}` +
`PartyClassified` for the current lifecycle status.

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
Institutional counterparty lifecycle status (`Sounding`, `Prospect`, `KycPassed`,
`Active`, `Offboarded`) is a classification, not a kind — the Party's kind stays
`legal-entity` for its lifetime. The `counterparty-of` relationship edge records
the business relationship; the `PartyClassified` events track the onboarding
lifecycle stage.

At v0 there are no active classifications projected from `PartyClassified`
events yet. The `fx-spot-controlled-launch-whitelist` classification for
`urn:party:legal-entity:standard-bank-za` and `urn:party:legal-entity:investec-bank-za`
lands in the follow-on PR from Imani (Chief Legal Counsel, governance) that
emits the `PartyClassified` + `PartyRelationshipAsserted{kind:
"counterparty-of"}` events; the registration rows above are the prerequisite
seed for that work.

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
| 9 | SARB Banks Act bank-licence number for `urn:party:legal-entity:standard-bank-za` and `urn:party:legal-entity:investec-bank-za` is currently `TBC` in the `regimeAnchor` text — sourced manually from the SARB BA110 register. The `LegalEntityAttrs` schema in `prototype/domains/party/types.ts` has no dedicated field for it; either the schema grows a `bankLicenceNumber?: string` field (preferred) or the value lives inside `regimeAnchor`. Resolve before first trade in the controlled-launch run. | Imani + Atlas | Pre-first-trade |
| 10 | `counterparty-of` `PartyRelationshipAsserted` edges from `urn:party:legal-entity:standard-bank-za` and `urn:party:legal-entity:investec-bank-za` to `urn:party:legal-entity:hoz-bank`; `fx-spot-controlled-launch-whitelist` `PartyClassified` events for both — emitted as a follow-on PR from Imani so the netting-set register and counterparty-onboarding procedure can fire. The `counterparty-of` kind is not currently in `RELATIONSHIP_KINDS` in `prototype/domains/party/types.ts` (v0 enum); it must be added under a follow-on `D-PARTY-RELATIONSHIP-KINDS-V0` extension (or mapped onto an existing kind) before the relationship can be asserted. | Imani + Atlas | Pre-first-trade |

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
