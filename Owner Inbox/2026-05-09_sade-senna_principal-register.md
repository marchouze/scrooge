---
title: Principal Register — unified identity + mandate base for staff, agents, contractors, customers, counterparties
author: Sade + Senna
date: 2026-05-09
summary: Single canonical authoring location for every actor in the bank — staff, internal agents, contractors, external systems, counterparties, customers, directors/officers — feeding A1.2 identity, HR, vendor management, POPIA records-of-processing, fit-and-proper, sanctions/PEP, and audit. Eight typed substrate slices, single typed-event stream with `type` discriminator, backfill-before-recon-goes-hard.
decision-required: true
decision-id: D-PRINCIPAL-REGISTER
decision-category: substrate-foundational
decision-owner: Sade (substrate; AgentOps today, human-HR slice activates at licence-day) · Senna (identity binding) · Devon (governance line for substrate) · Rashida (governance line for security) — co-curated with Iris (POPIA), Mira+Zara (fit-and-proper, sanctions/PEP), Imani (legal-entity tree linkage), Niko (post-licence customer slice), Owen (director/officer attestations)
decision-for-ceo: Approve the Principal Register design — eight-type taxonomy, single-stream typed-event substrate, sequencing — and authorise Sade + Senna to begin substrate slice 1.
decision-recommendation: Approve as drafted. Single typed-event stream with `type` discriminator; Sade owns the substrate; co-curators by slice; eight substrate slices in §7 ordering; backfill of all existing actors (28 personas + Marc) before Vera principal-actor-resolve recon goes hard.
---

# Principal Register — unified identity + mandate base

**Authors:** Sade (AgentOps engineer / HR engineer at licence-day) · Senna (Security engineer)
**Reports through:** Devon (COO) for substrate ownership · Rashida (CISO) for identity binding
**Co-curators by slice:** Iris (POPIA) · Mira + Zara (fit-and-proper, sanctions/PEP) · Imani (legal-entity tree) · Niko (customer slice, post-licence) · Owen (director/officer attestations) · Atlas (typed-event family, schema review)
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:** CEO question 2026-05-09 ("person register that covers all possible combinations … used as identity base and for HR. also base for permissions etc."). Principles 1, 2, 4, 6, 7. Atlas's A1.1 + A1.2 substrate (`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md`). D-THIN-HUMAN-LAYER-MINIMUM (six humans + Marc + external audit firm at licence-day).
**Status:** **Proposal only — no code in this slice.** Build follows under Sade + Senna + Atlas, sequenced in §7.

> **Derivation note (Principle 6 — downward).** This proposal sits at the *standard* layer (technical specification). It cites the Information Security Policy, the POPIA processing-policy stack (Iris), the (planned) HR / AgentOps Operating Policy, and the Identity-and-Access-Management standard. It implements the operational shape Principle 7 + Principle 4 require; substantive policy is curated upstream.

---

## 1. What the Principal Register is

A1.2's permission-policy publisher reads agent identity from `Team/<Name>.md §11` today (`prototype/platform/agent-identity/permission-policy.ts`). That is correct for one consumer (the substrate) and one principal type (internal agents). It does not extend cleanly to the seven other actor types the bank must identify: staff humans (Sade, at licence-day), counterparty traders (Niko + Imani), counterparty trading agents (Niko + Senna), contractors (Devon + Imani), external systems (Devon + Senna), customers (Niko, post-licence), and directors/officers (Owen + Mira). Each consumer — A1.2, HR, vendor management, POPIA records-of-processing, fit-and-proper, sanctions/PEP, audit — needs the same answer to *"who is this actor."* Splitting that answer across N stores produces N drift. The **Principal Register** is the single canonical authoring location for every actor in the bank, of any type, and the source `Team/<Name>.md §11` is demoted to a *projection* over it at slice 5.

---

## 2. The eight types

For each type: definition, examples, owner who authors entries of this type, build-phase posture.

1. **Internal human** — staff under SA employment contract.
   - *Examples:* future CEO-successor, future CFO, future MLRO/FIC CO/IO triple-hat, future CRO (per D-THIN-HUMAN-LAYER-MINIMUM).
   - *Owner:* Sade.
   - *Build-phase:* paused. Activates at licence-day per CLAUDE.md operating model. Zero entries today.
2. **Internal agent** — autonomous AI agents on bank substrate (Principle 7).
   - *Examples:* the 28 personas under `/Team/` (Atlas, Vera, Mira, Sade herself, etc.).
   - *Owner:* Sade (AgentOps slice).
   - *Build-phase:* **ACTIVE** — 28 live entries on backfill (slice 3). The persona library is the live source.
3. **External human counterparty** — external natural persons the bank engages with substantively but does not employ.
   - *Examples:* counterparty trader at a sponsor bank; SARB / FIC / FSCA inspector; partner-firm external auditor; named external-counsel partner.
   - *Owner:* Niko + Imani jointly (Niko = relationship; Imani = legal-entity context + ECTA execution).
   - *Build-phase:* paused; activates as real engagements land (external counsel engagement on the licence-application path is the first candidate).
4. **External agent counterparty** — counterparty's autonomous trading agent / API client acting on the counterparty's behalf.
   - *Examples:* a sponsor bank's algo-trading agent connecting to our gateway; a market-data vendor's automated client; a counterparty's automated confirmation-matching agent.
   - *Owner:* Niko + Senna jointly (Niko = mandate + relationship; Senna = identity binding + cert provisioning).
   - *Build-phase:* paused; activates at commencement-of-trading for non-anonymous counterparty agents.
5. **Contractor** — bounded-mandate external party engaged under contract for a defined scope.
   - *Examples:* external counsel firm (engagement to land on licence-application path per `2026-05-09_imani_external-counsel-licence-application.md`); external audit firm at licence-day (per D-THIN-HUMAN-LAYER-MINIMUM); hosting vendor; market-data vendor at the human-PoC level.
   - *Owner:* Devon + Imani jointly (Devon = engagement; Imani = contract terms + legal-entity).
   - *Build-phase:* minimal real entries — Anthropic API engagement is the only real cost-incurring contract today; future external counsel + external auditor on the licence-application path.
6. **External system** — third-party SaaS / market-data / cloud principal identified by service-account or API-client cert; no human PoC at the principal level.
   - *Examples:* Anthropic API (system-level principal, distinct from the contract in #5); future Azure subscription principals (M8); future Bloomberg / Reuters market-data API clients; SAMOS-via-sponsor-bank API client.
   - *Owner:* Devon + Senna jointly (Devon = onboarding decision; Senna = cert / authentication binding + zero-trust envelope).
   - *Build-phase:* minimal — Anthropic API at the system level is the live entry; Azure principals enter on M8 cloud lift.
7. **Customer** — institutional client (the bank is institutional-only per `project_strategic_foundation`).
   - *Examples:* asset manager client; corporate treasury client; counterparty bank acting as our client.
   - *Owner:* Niko.
   - *Build-phase:* paused. Activates at commencement-of-trading. Question Q3 below adjudicates the precise activation event.
8. **Director / officer** — humans holding a statutory governance seat under SA banking law.
   - *Examples:* CEO, NEDs (Chair, AC chair, S&E NED, AC members), Company Secretary, MLRO, FIC Compliance Officer, POPIA Information Officer, FAIS Key Individuals, CRO. Today: Marc as CEO + interim Chair + interim IO + interim MLRO + exec director + interim FAIS KI.
   - *Owner:* Owen + Mira jointly (Owen = governance; Mira = fit-and-proper).
   - *Build-phase:* Marc is the single live entry (multi-hatted via `roles[]` per Q2). Six more humans onboard at licence-day per D-THIN-HUMAN-LAYER-MINIMUM.

A director/officer who is also an executive employee (e.g. a future CFO who is both type #1 and type #8) is **one principal** with multiple `roles[]`; the `subType` discriminator records the seat. See Q2.

---

## 3. Schema (every principal carries)

The contract Atlas types in slice 2. All fields specified.

| Field | Type | Notes |
|---|---|---|
| `principalId` | `URN` (`prn:bank:<type>:<slug>`) | Stable; never reused. Slug is human-readable. Examples: `prn:bank:internal-agent:atlas`, `prn:bank:director-officer:marc`, `prn:bank:external-system:anthropic-api`. |
| `type` | enum (the 8 types in §2) | Discriminator. Single typed-event stream selects on this field (Q1). |
| `subType` | optional string | Director/officer: which seat (`ceo`, `chair`, `ac-chair`, `cosec`, `mlro`, `fic-co`, `popia-io`, `fais-ki`, `cro`, `s-e-ned`, `ac-member`, `ned`). Internal agent: governance owner (`devon`, `helena`, `camille`, etc.). Optional for the rest. |
| `status` | enum (`active` / `suspended` / `terminated` / `paused`) | `paused` is the build-phase posture for types with no live entries today. `terminated` is irreversible; `principalId` is not reused. |
| `identityAttestation` | structured | Legal name + identity-document reference + verifier + as-of date. For internal agents: SHA-256 of `Team/<Name>.md` (the operating-spec hash) + verifying agent (Sade / Vera). For external systems: cert thumbprint + issuing CA + provisioning event. |
| `authenticationBinding[]` | array of structured | One or more bindings; one marked `primary`. Schemes: `webauthn` (humans, FIDO2 keys) / `agent-identity-cert` (internal agents, A1.2-issued) / `api-client-cert` (external systems) / `oidc-federation` (external counterparty agents via federation). Each binding carries scheme + key reference + issued-at + expires-at + rotation-policy. |
| `roles[]` | array of strings | Consumed by A1.2 permission-policy. Typed strings (e.g. `agentops-engineer`, `popia-information-officer`, `gateway-trader`). |
| `capabilities[]` | array of strings | Consumed by A1.2 — capability-allow-list contributions. Typed strings (e.g. `event-store.append:AgentRegistered`, `register.write:capability-assignment`). |
| `mandate` | structured | `scope` (string array — what they may act on) + `boundary` (string array — what they may **not** act on; ties to gateway override discipline per Saskia+Kai PR #26 §6 C.5). |
| `lifecycle[]` | array of typed-event references | Audit trail of every typed event the register has emitted for this principal. Derived projection; not authored. |
| `governanceOwner` | `principalId` reference | Points to another principal (line manager / governance seat / relationship owner / engagement lead). For internal agents: their governance line per CLAUDE.md (e.g. Sade → Devon). For contractors: the engagement lead. |
| `legalEntity` | reference into Imani's legal-entity tree | Which entity employs / engages / contracts the principal. Today: tree-of-one (the SA banking entity); design accommodates the plural case from day one (Principle 5). |
| `popiaClassification` | enum (`data-subject` / `controller` / `operator` / `n-a`) | Iris-curated. Required for types #1, #3, #5, #7 (any natural person or organisation processing personal data); `n-a` for the agent / system types. |
| `fitAndProper` | optional structured | Only populated for regulated roles (director/officer subTypes; internal humans in FAIS-rep slots). Fields: SARB attestation reference + last-review date + next-review-due + status (`current` / `overdue` / `pending-initial`). |
| `citations[]` | array of `ObligationUrn` | Principle 2. Employment contract / agent operating-spec / ISDA / vendor agreement / appointment letter / FIC compliance officer designation / etc. Where the obligations register lacks a row: `[register: route to Mira]` placeholder until populated. |

---

## 4. Typed-event family

Five new event types — Atlas-owned future slice (slice 2 below). Naming and one-line schema sketch + the citation chain each must carry.

| Event type | Purpose | Schema sketch | Citation chain |
|---|---|---|---|
| `PrincipalRegistered` | Initial registration; carries identity-attestation + first authentication binding + initial `roles[]` + `capabilities[]` + initial `mandate` + `legalEntity` + `popiaClassification` + initial `citations[]` | `{ principalId, type, subType?, identityAttestation, primaryAuthBinding, roles, capabilities, mandate, governanceOwner, legalEntity, popiaClassification, citations }` | Source authority for the registration: employment contract (type #1) / agent operating-spec hash (type #2) / engagement letter (type #5) / appointment letter (type #8) / etc. |
| `PrincipalRoleAssigned` | Role addition (idempotent on `(principalId, role)`) | `{ principalId, role, effectiveAt, citations }` | The instrument that authorises the role assignment: Board resolution (director/officer roles) / Sade-AgentOps decision per agent-spec (internal agent capabilities) / engagement scope (contractor) |
| `PrincipalCapabilityIssued` | Capability token issuance (Senna A1.2) | `{ principalId, capability, scope, expiresAt?, citations }` | Permission-policy source: agent §12 system-capabilities-called list (internal agent) / role-based access matrix entry (human) / contract scope (contractor) |
| `PrincipalSuspended` / `PrincipalTerminated` | Lifecycle close (suspended is reversible; terminated is not) | `{ principalId, reason, effectiveAt, citations }` | Termination basis: employment-termination notice / agent-retirement decision (Sade) / contract end / disqualification under Banks Act (director/officer) / customer offboarding (Niko, post-licence) |
| `PrincipalAttestationRefreshed` | Periodic attestation pass: fit-and-proper review / POPIA classification update / sanctions screening pass / agent fit-and-proper analogue | `{ principalId, attestationKind, outcome, asOf, nextDue, citations }` | The procedure that authorised the attestation: `Procedures/by-policy/fit-and-proper-attestation.md` (regulated roles) / `Procedures/by-policy/agent-fit-and-proper-cycle.md` (internal agents) / sanctions-screening procedure (Mira, when it lands) |

Schemas freeze under Atlas at slice 2; the citation gate (`@platform/citation/gate.ts`) applies to every emit.

---

## 5. Why one register, not many

The bank already needs the same `(identity, mandate, attestation)` shape eight ways. Splitting it produces N drift and violates Principle 6 (single graph) + Principle 1 (events as truth).

| Consumer | What it consumes from the register |
|---|---|
| **A1.2 identity issuer** (Senna) | `principalId`, `authenticationBinding`, `roles[]`, `capabilities[]` — replaces today's read from `Team/<Name>.md §11`. |
| **HR systems** (Sade, post-licence) | Type #1 entries — `identityAttestation`, `governanceOwner`, `legalEntity`, employment-contract citations, payroll-relevant `roles[]`. |
| **AgentOps** (Sade, today) | Type #2 entries — agent operating-spec hash, governance owner, capability assignment. |
| **Customer onboarding** (Niko, post-licence) | Type #7 entries — KYC artefacts, FAIS suitability records, customer mandate. |
| **Vendor management** (Devon) | Types #5 + #6 — engagement scope, contract citations, authentication bindings. |
| **POPIA records-of-processing** (Iris) | All natural-person + organisation principals — `popiaClassification`, lawful-processing citations, data-subject-rights surfaces. |
| **Fit-and-proper register** (Mira + Zara) | Type #8 + regulated-role internal humans — `fitAndProper` block, attestation cycle. |
| **Sanctions / PEP screening** (Mira) | Types #3 + #4 + #5 + #7 — screening on the `identityAttestation` block; results feed `PrincipalAttestationRefreshed`. |
| **Audit / continuous controls** (Vera) | All entries — `lifecycle[]` is the audit trail; `principal-actor-resolve` recon (slice 7) tests every typed event's `actor` field resolves to a registered principal. |
| **Pre-trade gateway** (Saskia + Kai) | `mandate.boundary` — the gateway's hard-reject discipline reads from the principal's declared boundary, not from local config. |

One register; ten consumers; one source of truth. Principle 6 + Principle 1 hold.

---

## 6. Ownership matrix

Cell content names the persona who is authoritative for that intersection. `—` means not applicable to that type.

| Type | Substrate | Identity | Mandate | Fit-and-proper | POPIA | Sanctions/PEP | Customer relationship | Vendor relationship | Legal entity |
|---|---|---|---|---|---|---|---|---|---|
| #1 Internal human | Sade | Senna | Sade + governance owner | Mira + Zara | Iris | Mira | — | — | Imani |
| #2 Internal agent | Sade | Senna | Sade + governance owner | Sade (analogue) + Vera (audit) | Iris (n-a default) | — | — | — | Imani |
| #3 External human counterparty | Sade | Senna | Niko + Imani | Mira (where regulated) | Iris | Mira | Niko | — | Imani |
| #4 External agent counterparty | Sade | Senna | Niko + Senna | — | Iris (organisation) | Mira (organisation) | Niko | — | Imani |
| #5 Contractor | Sade | Senna | Devon + Imani | Mira (where regulated, e.g. external auditor) | Iris | Mira | — | Devon | Imani |
| #6 External system | Sade | Senna | Devon + Senna | — | Iris (organisation) | Mira (organisation) | — | Devon | Imani |
| #7 Customer | Sade | Senna | Niko | Mira (FAIS suitability) | Iris | Mira | Niko | — | Imani |
| #8 Director/officer | Sade | Senna | Owen + governance line | Mira + Zara + Owen | Iris | Mira | — | — | Imani |

Sade owns the register substrate end-to-end; everyone else co-curates the column they are authoritative for.

---

## 7. Substrate sequencing (eight slices)

Each slice has owner, prerequisites, exit criteria.

### Slice 1 — Type system + register schema
- *Owner:* Sade + Senna co-author; Atlas reviews schema for typed-event consistency.
- *Prerequisites:* this proposal approved (D-PRINCIPAL-REGISTER).
- *Deliverable:* TypeScript types in a new package `prototype/platform/principals/`. Schema follows §3 verbatim. No persistence yet — types only.
- *Exit:* `bun run ci` green; types imported by a placeholder consumer; no behaviour change in production code paths.

### Slice 2 — Typed events
- *Owner:* Atlas (event-store curator), with Sade + Senna review.
- *Prerequisites:* Slice 1.
- *Deliverable:* the five event types in §4 added to `event-types.ts` + `registry.ts`. Citation gate applies to every emit. Anya semantic-layer entries co-authored.
- *Exit:* event-types tests green; semantic layer covers all five; Vera Wave-4 #16 prose-duplication recon passes.

### Slice 3 — Backfill: internal agents (28 entries)
- *Owner:* Sade (AgentOps).
- *Prerequisites:* Slices 1 + 2.
- *Deliverable:* one `PrincipalRegistered` event per `Team/<Name>.md` file. `identityAttestation` carries SHA-256 of the persona file at backfill-time. `governanceOwner` resolves to Devon / Helena / Camille / Eitan / Owen / Saskia / Zara / Iris / Thandiwe / Rashida per CLAUDE.md "Top-of-house reporting".
- *Exit:* 28 internal-agent entries `active`; `lifecycle[]` projection populated; Vera Wave-4 #10 (agent-spec-integrity) cross-references to register.

### Slice 4 — Backfill: directors/officers + Marc
- *Owner:* Owen + Sade co-author.
- *Prerequisites:* Slices 1 + 2.
- *Deliverable:* one `PrincipalRegistered` for Marc, carrying multiple `roles[]` (CEO, interim Chair, interim IO, interim MLRO, exec director, interim FAIS KI). Every existing `Owner Inbox/*ceo-decision-record*.md` `actor: marc@tgv.co.za` reference resolves to this single principal via the sidecar projection (see Q4).
- *Exit:* Marc principal `active`; sidecar projection deployed; six placeholder director/officer principals marked `paused` for the licence-day onboarding queue (per D-THIN-HUMAN-LAYER-MINIMUM).

### Slice 5 — A1.2 re-wire
- *Owner:* Senna.
- *Prerequisites:* Slices 1 + 2 + 3.
- *Deliverable:* A1.2 identity issuer's `permission-policy.ts` reads `roles[]` + `capabilities[]` from the register's typed events rather than from `Team/<Name>.md §11`. The persona file becomes a *projection* over the register, not the source. Migration is single-shot — no dual-source window (the register is canonical from cutover).
- *Exit:* `permission-policy.ts` reads exclusively from register; persona-file derivation produces an identical `PermissionPolicy` for the 28 backfilled agents (golden-test); A1.2 publisher emits no policy diffs at cutover.

### Slice 6 — POPIA classification overlay
- *Owner:* Iris.
- *Prerequisites:* Slices 3 + 4. (Type-#7 customer slice not gated here — it activates at slice 8.)
- *Deliverable:* every type-#1 / #3 / #5 / #7 / #8 principal classified under POPIA (`data-subject` / `controller` / `operator`). Internal agents and external systems carry `n-a` by default unless the agent/system processes personal data on the bank's behalf. Lawful-processing register updated with citations to POPIA s.11 (lawful-processing grounds) and s.13 (purpose specification).
- *Exit:* every relevant principal carries `popiaClassification`; Iris's records-of-processing register cross-references resolve.

### Slice 7 — Vera principal-actor-resolve recon
- *Owner:* Vera (dispatched in parallel to scope the recon pipeline; reference Vera's brief).
- *Prerequisites:* Slices 1–4 (backfill complete).
- *Deliverable:* recon pipeline that asserts every typed event's `actor` field (and any equivalent — `agentId`, `issuedBy`, `verifiedBy`, etc.) resolves to a registered principal in `active` or `suspended` status. Pipeline emits `warn` from slice 2 onwards (typed events exist but backfill in progress); goes hard once slices 3 + 4 land.
- *Exit:* zero unresolved actors across the event store; Vera Wave-4 entry (target #18 or successor) green.

### Slice 8 — Lifecycle slices (rolling, by binding event)
- *Owner:* Niko (customer slice) · Mira + Zara (fit-and-proper slice) · Devon (contractor slice).
- *Prerequisites:* Slices 1–7.
- *Deliverable:* customer slice activates at commencement-of-trading on the binding event (Q3 default: first KYC submission); fit-and-proper slice activates as humans onboard (each licence-day human appointment emits `PrincipalRegistered` + initial `PrincipalAttestationRefreshed`); contractor slice expands as real engagements land (next: external counsel on licence-application path).
- *Exit:* commencement-bind / corporate-bind events trigger the appropriate slice activation; types #3, #4, #5, #7, #8 transition from `paused` to `active` per their bind-status (per `project_rules_bind_at_commencement`).

---

## 8. Build-phase vs licence-day applicability

| Type | Real now (build-phase) | Activates at | Binding event |
|---|---|---|---|
| #1 Internal human | 0 entries; substrate `paused` | Licence-day | First employment contract signed (per D-THIN-HUMAN-LAYER-MINIMUM) |
| #2 Internal agent | 28 entries (slice 3 backfill) | **Active now** | Persona-file authoring |
| #3 External human counterparty | 0 entries; substrate `paused` | Pre-licence (external counsel engagement) → commencement-of-trading | First engagement letter / first counterparty trader registration |
| #4 External agent counterparty | 0 entries; substrate `paused` | Commencement-of-trading | First counterparty agent connecting to gateway |
| #5 Contractor | 1 entry (Anthropic-engagement, contract level) | Pre-licence-application (external counsel + external auditor) | Engagement letter signed |
| #6 External system | 1 entry (Anthropic API) | M8 cloud lift expands (Azure principals) | Service-account / API-client cert provisioned |
| #7 Customer | 0 entries; substrate `paused` | Commencement-of-trading | Q3 default: first KYC submission |
| #8 Director/officer | 1 entry (Marc, multi-hatted) | 6 more at licence-day per D-THIN-HUMAN-LAYER-MINIMUM | Board resolution / appointment letter |

References `project_rules_bind_at_commencement` taxonomy: most types are LICENCE-BIND or COMMENCEMENT-BIND; types #2 + #6 are CORPORATE-BIND (live now); type #5 (external counsel) is CONDITIONAL-BIND on the licence-application path.

---

## 9. Open questions for Marc

Five questions; Sade + Senna recommendation + default-if-no-decision per pack convention.

| # | Question | Sade + Senna's recommendation | Default if no decision |
|---|---|---|---|
| **Q1** | Single typed-event stream with `type` discriminator, OR separate streams per principal-type? | **Single stream.** Cleanest single-graph (Principle 6); same shape across types; type-discrimination is a query concern, not a substrate concern; A1.2 already reads on a single conceptual surface. | Single stream; type discriminator in the payload. |
| **Q2** | Marc's interim multi-hat (CEO + interim Chair + interim IO + interim MLRO + interim FAIS KI + exec director): one principal with multiple `roles[]`, OR one principal per role? | **One principal, multiple `roles[]`.** Marc is one identity attesting to one fit-and-proper status; the role-assignments themselves are the separable lifecycle. When a role transitions to a different principal at licence-day (e.g. CRO seat to a hired human), the suspension is on the `(principalId, role)` pair via `PrincipalRoleAssigned` (idempotent) + `PrincipalRoleRevoked`. | One Marc principal; multiple roles; role-level suspension on transition. |
| **Q3** | Customer slice (type #7) activation event: at first KYC submission, at first onboarded counterparty (post-FAIS suitability), or at first traded order? | **First KYC submission.** The registration is the substrate event; a customer who submits KYC and never trades is still a principal under POPIA + FAIS recordkeeping. Onboarding completion and first-trade are subsequent lifecycle events on the same principal. | First KYC submission triggers `PrincipalRegistered`. |
| **Q4** | Backfill of historical CEO-decision-record `actor: marc@tgv.co.za` references: rewrite events with the new `principalId` reference, OR leave the legacy `actor` field intact and add a typed pointer? | **Leave legacy `actor` intact; add a typed pointer in a sidecar projection.** Principle 1 — events are immutable. The register is the canonical answer to "who is `marc@tgv.co.za`"; the sidecar projection resolves legacy `actor` strings to `principalId` lazily at read time. | Sidecar projection; no event rewrites. |
| **Q5** | Persona-file evolution: keep `Team/<Name>.md §11` as canonical (current state), OR demote it to a projection over the register at slice 5? | **Demote at slice 5.** The register is canonical going forward. The persona file remains the human-authoring surface for sections 1–10 + 12–17; §11 (events emitted / registers maintained) becomes a derivation from the register's `capabilities[]` + `roles[]`. Single source of truth restored. | Demote at slice 5; persona files retain authoring of sections 1–10 + 12–17. |

---

## 10. Substrate gaps surfaced

Surfaced, not hidden. Each gap has owner + sequence target.

- **Vera principal-actor-resolve recon pipeline** — Vera dispatched in parallel to scope; lands in Wave-4 #18 or successor entry. *Owner:* Vera. *Sequence:* slice 7.
- **Iris POPIA processor classification taxonomy** — the typed mapping from principal type → likely POPIA classification is not yet authored as a register. *Owner:* Iris. *Sequence:* gates slice 6.
- **Imani legal-entity tree depth** — currently tree-of-one (the SA banking entity); `legalEntity` field accommodates plural from day one but the tree projection is single-node today. *Owner:* Imani. *Sequence:* expands as plural entities land (post-licence).
- **Niko customer onboarding lifecycle** — type-#7 substrate is paused; activates at commencement-of-trading. *Owner:* Niko. *Sequence:* slice 8.
- **Mira sanctions / PEP screening service** — substrate gap surfaced from Saskia+Kai PR #26 §4.1 (gateway sanctions check). The screening service feeds `PrincipalAttestationRefreshed` for types #3 + #4 + #5 + #7. *Owner:* Mira. *Sequence:* gates type #3 / #4 / #7 entries going `active`.
- **`PrincipalRoleRevoked` event type** — implied by Q2 (role-level suspension on transition); not in the §4 family today. Sade + Senna add to the typed-event family at slice 2 if Marc affirms the recommendation on Q2. *Owner:* Atlas. *Sequence:* slice 2.
- **Sidecar projection runtime for legacy `actor` resolution** (Q4) — the projection itself is a substrate slot; not yet typed. *Owner:* Anya (semantic layer). *Sequence:* slice 4.

---

## 11. Procedure binding (Principle 6)

The procedures that bind to this register. Each cites its parent policy; each policy cites the regulation/objective that justifies it. (Where the obligations register lacks a row: `[register: route to Mira]`.)

- `Procedures/by-policy/principal-registration.md` — *owner: Sade* (planned). The lifecycle procedure: registration trigger → identity attestation → permission policy publication → register entry. Source policy: HR / AgentOps Operating Policy (planned, owner Devon). Source regulation: `[register: route to Mira]` for the licence-day human slice (Banks Act fit-and-proper); Principle 7 for the agent slice (internal authority).
- `Procedures/by-policy/identity-issuance.md` — *owner: Senna* (planned). The A1.2 procedure that consumes registrations and issues identity certificates / WebAuthn keys / API client certs. Source policy: Information Security Policy. Source regulation: PA / FSCA Joint Standard 1 of 2024 (cyber resilience identity controls); POPIA s.19 (security safeguards).
- `Procedures/by-policy/fit-and-proper-attestation.md` — *owner: Mira + Zara* (planned). The attestation procedure for regulated roles. Source policy: Compliance Policy (planned). Source regulation: `[register: route to Mira]` for Banks Act §60–§62 + Reg 39 fit-and-proper.
- `Procedures/by-policy/popia-data-subject-rights.md` — *owner: Iris* (planned). DSR fulfilment over the register. Source policy: Privacy Policy (planned). Source regulation: POPIA s.23–s.25 + s.71 (automated decisioning).
- `Procedures/by-policy/contractor-engagement.md` — *owner: Devon + Imani* (planned). Engagement onboarding for type #5. Source policy: Operating-Model Policy (planned) + Legal-as-Code Standard (Imani-curated).
- `Procedures/by-policy/external-system-onboarding.md` — *owner: Devon + Senna* (planned). Type-#6 onboarding. Source policy: Information Security Policy + Cloud-Computing Standard. Source regulation: PA Directive 3 of 2018 (cloud computing and offshoring) — gates at M8.
- `Procedures/by-policy/customer-onboarding-lifecycle.md` — *owner: Niko* (planned, paused). Type-#7 KYC + FAIS suitability + ECTA execution. Source regulation: FIC Act s.21 (CDD); FAIS Act + General Code of Conduct.
- `Procedures/by-policy/agent-registration.md`, `agent-retirement.md`, `agent-capability-assignment.md`, `agent-fit-and-proper-cycle.md` — *owner: Sade* (planned, per `Team/Sade.md §13`). Type-#2 lifecycle. Source policy: AgentOps Operating Policy (planned). Source: Principle 7.

The register is itself a system capability under Principle 6 — no orphan capability; every capability binds to at least one of the procedures above.

---

## 12. Authority

Citations the proposal stands on:

- **Principles** — P1 (events as truth), P2 (citation discipline), P4 (security designed in — zero-trust + least-privilege), P6 (single-graph + no orphan capabilities), P7 (autonomous-by-default — agents as first-class principals).
- **CLAUDE.md** — "Operating model — what is real, deferred, paused" (Sade reshape; Niko paused; Imani build-phase split). "Top-of-house reporting" (governance owners). Team table (28 personas as type-#2 entries).
- **Existing substrate** — Atlas A1.1 + A1.2 (`Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md` §3.1). Permission-policy publisher today (`prototype/platform/agent-identity/permission-policy.ts`).
- **Decisions** — D-AGENT-RUNTIME-AUTHORIZE (substrate authorised); D-THIN-HUMAN-LAYER-MINIMUM (six humans + Marc + external audit firm at licence-day); D-S7-TARGETED-3-5-OPEN-QUESTIONS C.5 (override discipline ↔ `mandate.boundary` field).
- **Memory** — `project_principle_7_autonomous`, `project_ai_driven_bank`, `project_rules_bind_at_commencement`, `feedback_canonical_source_registry`.
- **Regulations (where citation already on the canonical path)** — POPIA s.19–s.22 (security safeguards); POPIA s.23–s.25 (data-subject rights); PA / FSCA Joint Standard 1 of 2024 (cyber resilience). Banks Act §60–§62 + Reg 39 (fit-and-proper) and FIC Act s.21 (CDD) flagged as `[register: route to Mira]` until obligations-register rows land.

---

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Sade + Senna | Initial proposal authored from CEO question 2026-05-09. Eight principal types named with owner + build-phase posture. Full schema specified (15 fields). Five typed events named with citation chains. Eight substrate slices sequenced. Five open questions surfaced with recommendations + defaults. Procedure binding sketched against Principle 6. |

—Sade + Senna
