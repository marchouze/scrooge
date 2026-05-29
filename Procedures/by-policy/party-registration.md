---
id: PROC-ID-01
policy-parent: 
last-reviewed: 2026-05-11
status: Approved
---
# Procedure — Party registration (unified identity axis across all four actor kinds)

**Procedure ID:** PROC-ID-01
**Owner:** Owen (Company Secretary) · Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance)
**Compliance reviewer:** Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance)
**Runtime actor (steady-state):** PartyIntake (future agent persona — see substrate gaps)
**Approval:** CEO (per `D-PARTY-REGISTER` 2026-05-11)
**Cadence:** Per-event (each new Party candidate)
**Version:** v1.0 — 2026-05-11
**Status:** Approved (PR 3 of D-PARTY-REGISTER; PartyIntake runtime substrate `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register.md`
+ `Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-relationship-kinds-v0.md`
+ `Owner Inbox/2026-05-11_scrooge_ceo-decision-record_d-party-register-correction.md`
— Unified identity-axis policy approving the Party event family + the
v0 closed enum of relationship kinds.

## 2. Source regulation(s) / authority

| Citation | Requirement |
|---|---|
| `D-PARTY-REGISTER` | Single identity axis across natural-person / legal-entity / counterparty / agent kinds; substrate authority. |
| `D-PARTY-RELATIONSHIP-KINDS-V0` | Closed v0 enum of 20 relationship kinds; new kinds need a follow-up CEO decision. |
| Companies Act 71 of 2008 § 66 | Board / signatory authority — anchor for `signatory-of`, `director-of`, `acts-on-behalf-of` edges. |
| Companies Act 71 of 2008 § 69 | Director ineligibility — fit-and-proper anchor. |
| Banks Act 94 of 1990 § 7 + § 11 | Banking-licence governance — legal-entity registration anchor. |
| Banks Act 94 of 1990 § 60 + Reg 36 | Controlling-company governance — director-roster + CEO-seat anchor at licence-day. |
| FIC Act 38 of 2001 § 21 | Customer due diligence — counterparty-kind registration anchor. |
| FIC Act 38 of 2001 § 21B | Beneficial-ownership recursion — anchor for `BeneficialOwnerChainAsserted` (PR 5). |
| FAIS Act 37 of 2002 | Key-individual authority — anchor for `key-individual-of` edges. |
| POPIA Act 4 of 2013 § 19–22 | Minimum-necessary security safeguards — natural-person PII discipline. |
| Joint Standard 2 of 2024 (PA/FSCA) | Cybersecurity / IT-risk; Principle 4 anchor for the document-store layer. |

## 3. Purpose

Ensure every actor the bank deals with — human, organisation, artificial
— is born by a single typed `PartyRegistered` event into the unified
identity axis, with stable `urn:party:<kind>:<slug>` URN, the correct
discriminated `kindAttributes`, and per-kind regulatory citations. The
register is the canonical answer to "who do we deal with?" across the
four kinds, and the foundation for every typed graph edge
(`PartyRelationshipAsserted`) that records authority, governance,
service, org-structure, workforce, or PEP-network relationships.

## 4. Trigger

One of the four kind-specific triggers:

| Kind | Trigger event / condition |
|---|---|
| `legal-entity` | CIPC reservation execution + board incorporation (per D-LEGAL-ENTITY-TREE-V0). Build-phase: seed-driven from `prototype/seeds/legal-entity-tree.json`. |
| `counterparty` | `CounterpartySoundingOpened` (Niko's onboarding flow) — folded by `party-backfill.ts` into `PartyRegistered{kind: "counterparty"}`. |
| `agent` | `AgentRegistered` (fleet rollout in `register-fleet.ts`) — folded into `PartyRegistered{kind: "agent"}`. |
| `natural-person` | (a) Founding CEO seat (PR 3 — Marc); (b) director appointment clears fit-and-proper; (c) signatory on a counterparty progressing past KYC (auto-minted from `AuthorisedSignatoryAdded`); (d) statutory human appointment at licence-day (MLRO, Information Officer, CAE, CISO, auditor). |

## 5. Steps

Per Principle 6, the default actor in every step is an agent. Steps
that are by definition CEO-authored (e.g. the founding CEO-seat
registration) carry P2 citations to the relevant CEO decision.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Resolve the source-of-truth for the candidate Party (kind-specific): roster, seed, source-event, or licence-day human appointment record | `agent` (PartyIntake `PLANNED`) → at build-phase: `agent:imani` for legal-entity / counterparty backfill; `agent:atlas` for agent-fleet backfill; **`Marc (CEO)`** for the founding CEO-seat registration (PR 3) | `@scripts/party-backfill` ✓ (built in PR 2 + PR 3) | The candidate's source determines the slug rule and idempotency key. |
| 2 | Determine the URN slug per kind | `agent` (PartyIntake `PLANNED`) | `@scripts/party-backfill` `slugifyForPartyUrn` ✓ + `naturalPersonSlugFromPersonId` ✓ | Slug rule is `/^[a-z0-9][a-z0-9._-]*$/` per `partyIdSchema`. |
| 3 | Build the discriminated `kindAttributes` payload per kind | `agent` (PartyIntake `PLANNED`) | `@domains/party/factories` ✓ | Outer `kind` must equal `kindAttributes.kind` and the URN's `<kind>` slot — schema enforces. |
| 4 | Attach per-payload citations (P2) appropriate to the kind + purpose | `agent` (PartyIntake `PLANNED`) | `@platform/citations` (`PLANNED`) | Citations are non-empty per `citationsSchema`. |
| 5 | Append `PartyRegistered` event (idempotent per `backfillSourceEventId`) | `agent` (PartyIntake `PLANNED`) → at build-phase: `system:party-backfill:<lineage>` | `@platform/event-store` ✓ | First-write wins on `partyId`; second-pass is a skip. |
| 6 | Emit kind-specific relationship edges via `PartyRelationshipAsserted` | `agent` (PartyIntake `PLANNED`) → at build-phase: `system:party-backfill:<lineage>` | `@platform/event-store` ✓ | Source-kind / target-kind constraints enforced by `partyRelationshipAssertedPayloadSchema`. |
| 7 | (Counterparty only) Emit `PartyClassified` for the current lifecycle state (`Sounding`, `Prospect`, `KycPassed`, `Active`, `Offboarded`) | `agent` (PartyIntake `PLANNED`) | `@platform/event-store` ✓ | Lifecycle is a classification, not a kind change. |
| 8 | (Natural-person only, post-licence-day) Reference the BLAKE3 PII bundle in the document store via `piiDocumentRef` + `dobHashRef` | `agent` (PartyIntake) → `human` (Iris, Information Officer, governance) for build-phase override | `@platform/doc-store` (`PLANNED` until RMS Phase 1 doc-store lands at Azure-day) | Pre-licence-day: `piiDocumentRef` / `dobHashRef` left unset (per CLAUDE.md "Build phase vs licence-day"). |
| 9 | (Natural-person only, post-licence-day) Schedule first `PartyScreeningCompleted` runs (sanctions, PEP, adverse-media, fit-and-proper, KYC-tier as applicable) | `agent` (PartyIntake — `PLANNED`) → `agent` (Mira / Vera for fit-and-proper; Senna / Rashida for cybersecurity-relevant key individuals) | `@platform/screening` (`PLANNED`) | Build-phase: not applicable (no real customers; statutory humans pending). |
| 10 | Update the Party register (`Regulations/_party-register.md`) and the relationships register (`Regulations/_party-relationships-register.md`) | `agent` (Owen / Imani for build-phase markdown-mirror; PartyIntake autogen at steady-state) | `@scripts/derive-registers` (`PLANNED`) — registers are projections | The substrate seeds at `prototype/seeds/party-register.json` + `prototype/seeds/party-relationships-register.json` are derived caches, not authored. |

## 6. Reconciliation

- **Events produced:**
  - `PartyRegistered` (1 per Party — birth)
  - `PartyRelationshipAsserted` (N per Party — typed edges)
  - `PartyClassified` (counterparties: 1 per lifecycle stage)
  - `PartyScreeningCompleted` (natural-persons + counterparties post-licence-day)
- **Reconciliation checks:**
  - Every `AgentRegistered` event has a corresponding `PartyRegistered{kind: "agent"}` with `backfillSourceEventId` matching the source event_id (idempotent fold).
  - Every `LegalEntityRegistered` (or seed-driven equivalent) has a corresponding `PartyRegistered{kind: "legal-entity"}` and the parent-of edges resolve.
  - Every `CounterpartySoundingOpened` / `…ProspectRegistered` has a corresponding `PartyRegistered{kind: "counterparty"}` plus a current-lifecycle `PartyClassified`.
  - Every `AuthorisedSignatoryAdded` mints (or reuses) a natural-person Party plus a `signatory-of` (or `authorised-trader-for`) relationship edge.
  - The 27 in-house agent Parties + Marc resolve `reports-to` chains converging at `urn:party:natural-person:marc` (per PR 3); the chain walk via `walkReportsToChain` terminates without cycles.
  - The 3 `acts-on-behalf-of` edges from Marc to the Hoz entities are present (per D-LEGAL-ENTITY-TREE-V0 shared-board v0 model).
  - Source-kind / target-kind constraints in `RELATIONSHIP_KIND_CONSTRAINTS` (`prototype/domains/party/schemas.ts`) match the rendered table in `Regulations/_party-relationships-register.md` (Vera Wave-5 recon — per substrate gap #4).
- **Failure mode:** procedure stuck → escalates to Imani on the case-management dashboard at the relevant SLA threshold; constraint-violation at append boundary is a Vera finding (the schema rejects, but the *attempt* is the record).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `PartyRegistered` events (all kinds) | Event log | Permanent (P1) | Variable: high for natural-person; medium for the rest |
| `PartyRelationshipAsserted` events | Event log | Permanent (P1) | Medium |
| Natural-person PII bundles (DOB, ID, address, source-of-funds) | BLAKE3 document store; HSM-managed at Azure-day (per Joint Standard 2 of 2024 + POPIA s.19–22) | 5 years post-relationship (FIC Act s.22) | High (PII) — HSM key access required |
| Relationship-evidence snapshots (mandate refs, board-resolution scans) | BLAKE3 document store | 5 years post-relationship | High |
| Backfill source-event lineage (`backfillSourceEventId`, `backfillSourceType`) | Event log (in payload) | Permanent (P1) | Low |

## 8. Manual steps

- **Step 1 (CEO-seat registration only)** is by definition CEO-authored at build-phase. The seed `MARC_CEO_SEED_ID = "seed:ceo-marc:v1"` carries the citation chain to D-PARTY-REGISTER + Companies Act § 66 + Banks Act § 60 + D-LEGAL-ENTITY-TREE-V0; Marc is the actor. Subsequent statutory-human registrations at licence-day are similarly CEO-authored.
- **Step 8 (post-licence-day natural-person PII bundle)** requires Iris (Information Officer, governance) approval per POPIA processing-purpose framework.
- **Step 9 (fit-and-proper screening)** requires human judgement for ambiguous cases — Vera signs off third-line independence assessments on agent / governance Parties; Mira on counterparty KYC tiers.

These manual steps are tracked exceptions under P2; each is a typed
event with the actor identity recorded.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `PartyRegistered` rejected at append (URN-kind-slot mismatch, missing citations, `kindAttributes.kind` ≠ outer `kind`) | Schema-validation failure at the boundary | Imani immediately (substrate fix) |
| `PartyRelationshipAsserted` rejected at append (source-kind / target-kind constraint violation) | `RELATIONSHIP_KIND_CONSTRAINTS` violation | Imani + Owen (relationship-kind enum needs CEO decision if missing) |
| Backfill double-emission (idempotency key collision) | `buildBackfilledIndex` would skip; the recon catches if a Party has two `PartyRegistered` events with different source IDs | Atlas + Imani |
| Natural-person Party registered without licence-day-required PII bundle | `PartyScreeningCompleted` schedule scan; the absence of `piiDocumentRef` post-licence-day | Iris + Imani; escalate to Helena (CRO) if systemic |
| Top-of-house chain walk does not converge at Marc | Vera continuous-controls recon (planned) | Imani; refresh the agent backfill |

## 10. Related procedures

- `kyc-onboarding.md` — counterparty-side KYC; Step 4 (UBO resolution) becomes a `BeneficialOwnerChainAsserted` event from PR 5 of D-PARTY-REGISTER onward.
- `fais-ki-fit-and-proper.md` — key-individual fit-and-proper screening; targets natural-person Parties with `key-individual-of` edges.
- `agent-runtime-deploy.md` — agent registration / retirement lifecycle; `AgentRegistered` is the upstream trigger for agent-kind Parties.
- `naming-pre-clearance.md` — legal-entity naming / CIPC reservation; precedes legal-entity Party registration at licence-day proper.
- `popia-io-designation.md` — Iris's Information-Officer-designation procedure; intersects with natural-person PII bundle handling.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-11 | Imani (Legal-as-code engineer) + Owen (Company Secretary, governance) | Initial draft for PR 3 of D-PARTY-REGISTER. Owns NaturalPerson + LegalEntity + Counterparty + Agent registration; references PR 3 Marc-CEO-seat backfill step. |

## 12. Audit / assurance

Vera consumes Party-event lineage (`backfillSourceEventId`,
`backfillSourceType`) as continuous-controls evidence. Quarterly
sample-test by Vera: 30 random `PartyRegistered` events across all
four kinds; trace back through the source-event chain to confirm every
required citation, kind-attribute, and edge is present and the
idempotency key is intact. The `RELATIONSHIP_KIND_CONSTRAINTS` table in
`prototype/domains/party/schemas.ts` is recon-checked against the
rendered table in `Regulations/_party-relationships-register.md` (Wave-5
recon — see relationships-register substrate gap #4). Findings reported
to AC.

## 13. Substrate gaps

- **PartyIntake agent persona** (Step 1–7 default actor at steady-state) is `PLANNED` — currently realised by `system:party-backfill:imani` / `system:party-backfill:atlas` lineage tags from `prototype/scripts/party-backfill.ts`. PR 4+ when the agent persona spec lands.
- **PII bundle / BLAKE3 document store** (Step 8) is `PLANNED` until the RMS Phase 1 doc-store lands at Azure-day (per `D-RMS-PHASE-1`).
- **`PartyScreeningCompleted` runner** (Step 9) is `PLANNED` — substrate fixture for fit-and-proper / sanctions / PEP screening providers integrates post-licence-day.
- **`Party*` event types in agent permission policies** — backfill runs as `system` actor by design; when agents start emitting Party events directly, their `eventEmitAllowList` needs extending. Atlas + Senna (Security engineer) own.
- **Vera recon** asserting `RELATIONSHIP_KIND_CONSTRAINTS` matches the rendered relationships-register table — Wave-5 recon pipeline (planned).
