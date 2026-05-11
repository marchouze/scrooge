---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-11T04:16:09.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-PARTY-REGISTER, 2026-05-11

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-PARTY-REGISTER`
- **Title:** Unified Party event family — single identity axis across natural persons, legal entities, counterparties, and agents
- **Action:** approve
- **Source proposal:** [`/Users/marc/.claude/plans/the-business-needs-um-bright-boot.md`](file:///Users/marc/.claude/plans/the-business-needs-um-bright-boot.md) (planning session 2026-05-11; CEO-approved at exit)
- **Outcome:** Establish a unified `Party` event family in `prototype/domains/party/` covering all four actor kinds (`natural-person`, `legal-entity`, `counterparty`, `agent`) under a single discriminated `PartyRegistered` event with kind-specific `kindAttributes`. Identity-axis events (registration, attribute change, classification, screening, deactivation) are unified; kind-specific *business* events (KYC tier, intra-group arrangement, mandate, agent dispatch) stay in their existing domains and reference Party URNs as foreign keys. Existing registration event types (`LegalEntityRegistered`, `CounterpartySoundingOpened`, `CounterpartyProspectRegistered`, `agentRegistered`, `AuthorisedSignatoryAdded`/`Removed`, `CounterpartyActivated`, `CounterpartyOffboarded`) are deprecated; legacy events keep replaying; idempotent boot-time backfill emits `PartyRegistered` shadow events keyed to source-event IDs (per `feedback_phase0_record_to_event_backfill.md`). PII discipline: PII-grade fields (DOB, ID number, residential address, ID-doc scan, source-of-funds) live in the BLAKE3 doc store with the event holding only the doc hash (Principle 4 + POPIA s.19–22). The intrinsic kind vs. relational role distinction is binding: `kind` describes *what* the actor is and is stable; `signatory-of` / `acts-on-behalf-of` / `director-of` / `ubo-of` are typed `PartyRelationshipAsserted` edges. The same natural person or agent can have many edges to many counterparties simultaneously without changing kind. Build-phase data scope: substrate is built now; only Marc (CEO seat), directors as fit-and-proper clears, signatories on counterparties past KYC, and the licence-day statutory-minimum humans get registered as data before licence-day. Sade's HR slice and Niko's customer onboarding stay paused per their `buildPhaseStatus`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "Unified Party event family" + "Include as Party (Recommended)" — AskUserQuestion responses 2026-05-11; plan exited approved with one user edit clarifying the worked example for counterparty-acting-through-humans-plus-external-agent.
- **Authority chain:** Standing CEO authority over substrate architecture (Principles 1, 2, 5, 6 in [`CLAUDE.md`](../CLAUDE.md)). Closes the Principle 6 orphan that natural-person references currently create (free-string `personId`, `reviewerId`). Underwrites obligations under Banks Act 94 of 1990 (fit-and-proper for directors + key individuals), FIC Act 38 of 2001 ss.21–21H + s.21B (CDD + beneficial-owner recursion), Companies Act 71 of 2008 s.69 (director registry), POPIA Act 4 of 2013 ss.19–22 (PII storage + minimisation), FAIS Act 37 of 2002 (key-individual identification), IAS 24 (related-party disclosure), and Banks Act s.77(2) (insider lending). Closes 10 of the 14 remaining F-032 event-type registry-coverage gaps as a downstream effect.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect; substrate)` — **PR 1 (substrate)** — new `prototype/domains/party/` event family: 10 event types, factories, Zod schemas, registry rows in `prototype/platform/event-store/registry.ts`, recon-pass green for `event-type-registry-coverage`. Dispatch this session in an isolated worktree.
- `agent:Imani (Legal-as-code engineer; reports to Devon, Chief Operating Officer, governance)` — **PR 2 (backfill + projection)** — boot-time idempotent backfill from existing legal-entity / counterparty / agent events into Party events; multi-stream party-projection read-model; `Regulations/_party-register.md` + `prototype/seeds/party-register.json` materialised; dashboard tile renders four sub-counts. Sequenced after PR 1 merges.
- `agent:Imani (Legal-as-code engineer)` + `agent:Owen (Company Secretary, governance)` — **PR 3 (NaturalPerson activation)** — first natural-person Party (Marc, kind=natural-person, role=CEO seat) registered with `acts-on-behalf-of` edge to Hoz Bank; `signatory-of` edges backfilled for any active counterparty signatories; `PartyRelationshipAsserted` family in regular use. Sequenced after PR 2.
- `agent:Atlas (Core banking platform architect)` — **PR 4 (deprecation)** — mark legacy registration event types `status: "deprecated"` in registry; recon asserts no new emissions; field-tightening on `prototype/domains/customer/types.ts` (`personId: string` → `PartyId`; `reviewerId: string` → `PartyId`). Sequenced after PR 3.
- `agent:Imani (Legal-as-code engineer)` + `agent:Mira (Compliance / RegTech engineer; reports to Zara, Chief Compliance Officer, governance)` — **PR 5 (UBO + related-party)** — `BeneficialOwnerChainAsserted` event live; FIC s.21B sub-procedure update in `Procedures/by-policy/kyc-onboarding.md`; first UBO chain asserted as a worked example. Sequenced after PR 4.

## Substrate gaps surfaced

| # | Gap | Owner(s) | Trigger |
|---|---|---|---|
| 1 | Party-projection multi-stream projector that builds `Party` read-model + relationships graph from four source streams | Atlas (Core banking platform architect; substrate) | PR 2 |
| 2 | Idempotent boot-time backfill from legacy registration events to `PartyRegistered` shadow events (keyed by source-event ID) | Imani (Legal-as-code engineer) | PR 2; pattern from `feedback_phase0_record_to_event_backfill.md` |
| 3 | Append-time citation enforcement in `validatePayload` for kind-specific + purpose-specific citation requirements (e.g. `purpose = "ubo"` requires FIC s.21B citation) | Atlas + Mira (Compliance / RegTech engineer) | PR 1; recon-side enforcement |
| 4 | Edge schema source-kind / target-kind constraint enforcement (e.g. reject `director-of` from agent source) | Atlas | PR 1 |
| 5 | BLAKE3 doc-store wrapper for natural-person PII (DOB, ID number, address, ID-doc scan) — RMS Phase 1 doc-store pattern | Owen (Company Secretary, governance) + Atlas | PR 3 |
| 6 | Dashboard Party tile with four kind sub-counts + relationships sub-count + drill-down to per-Party graph view | Bea (Dashboard / observability engineer) | PR 2 |
| 7 | New scenario `prototype/scenarios/05-party-graph-roundtrip.ts` exercising register → assert relationship → query graph | Atlas | PR 2 |
| 8 | `BeneficialOwnerChainAsserted` purpose-built event family for FIC s.21B recursion | Imani + Mira | PR 5 |
| 9 | `Procedures/by-policy/party-registration.md` — owning procedure (Imani; Mira reviewer; PartyIntake agent as actor) | Imani | PR 3 |
| 10 | Dispatch authority binding: agent dispatches need to assert `acts-on-behalf-of` Party URN at runtime (not just persona name); ties into Atlas's permission-policy generator (A2 work) | Atlas | Post-PR 5; not blocking initial ship |

## Change log

- 2026-05-11 — Initial record. Author: Scrooge (Chief of Staff / Orchestrator).
