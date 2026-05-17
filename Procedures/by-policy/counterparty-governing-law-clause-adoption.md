---
status: POPULATED
---
# Procedure — Counterparty governing-law clause adoption

**Procedure ID:** PROC-LEG-CL-01
**Owner:** Imani (legal-as-code) · Saskia (front-office negotiation envelope) where the soft-franchise track applies
**Approval:** BRC (under Contracting Policy v0.1 — STUB)
**Cadence:** Per-counterparty; runs whenever a counterparty enters negotiations-in-principle (build phase) or signed-agreement scope (post-licence)
**Version:** v0.1 — 2026-05-07
**Status:** **In force (build-phase scope)** — soft-franchise / negotiations-in-principle slice live now; live signed-agreement slice activates at licence-day

## 1. Source policy

- `Owner Inbox/2026-05-07_imani_legal-policies-bundle-v0.md` § Contracting Policy v0.1 §2 (Default governing law); §3 (Clause-library discipline); §4 (Legal-entity discipline).
- `Owner Inbox/2026-05-07_imani_legal-policies-bundle-v0.md` § Document Execution Policy v0.1 §3 (Recognition of electronic execution).

Both are stubs (per the bundle's §6); citations resolve to the bundle until BRC-approved full policies land.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-EL-01` | Recognise electronic communications and signatures (excluding ECTA Schedule 1). | Default electronic-execution mode; Schedule 1 gate at draft time. |
| `ORG-EL-02` | Reserve wet signatures for ECTA Schedule 1 categories. | Schedule 1 gate; `ECTAExceptionFlagged` escalation. |
| `Companies Act 71/2008 s.19(1)(b)` (direct statute; no obligations-register ID) | Capacity of a company to enter contracts. | Legal-entity-tree resolution at draft time. |
| `2002 ISDA Master Agreement §13(a)` (ISDA protocol; not a statute) | Standard governing-law architecture for ISDA-bound agreements. | Clause `CL-GVL-001` aligns to this default. |

## 3. Purpose

Decide and record the governing law for any agreement Bank Newco enters as the South African counterparty, by reference to a typed clause from Imani's clause library — never by drafting bespoke wording. The procedure is the keystone of the legal-as-code chain: it is the smallest end-to-end demonstration that `Regulation → Policy → Procedure → System Capability` reconciles for Imani's substrate.

In the build-phase, the procedure runs against **soft-franchise negotiations-in-principle** with target counterparties — no live signed agreements, but the structured artefact (clause adoption position) is real and consumed by Saskia's franchise design. At licence-day, the same procedure executes against live counterparty signings, with the additional steps that activate `ContractTemplateVersioned` and `ContractSigned` events.

## 4. Trigger

- **Build phase:** `NegotiationCounterpartyIdentified` event from Saskia's soft-franchise pipeline (planned event; today: structured note from Saskia in Owner Inbox is the manual analogue).
- **Licence-day onwards:** `ContractDraftRequested` event from Saskia (ISDA / GMRA path) or Niko (client-onboarding path).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Resolve the bank's contracting entity from the legal-entity tree by `entityId` (build-phase: always `LE-ZA-BANKNEWCO`). | Imani | `@platform/legal/legal-entity-registry` (PLANNED — today: `_legal-entity-tree.md` lookup) | Confirms jurisdiction `ZA`, status `pre-incorporation`, currencies in scope. |
| 2 | Read the counterparty profile — name, registered jurisdiction, ISDA-affiliated y/n, electronic-execution-capable y/n. | Imani | Counterparty intake (PLANNED — today: Saskia provides the profile inline). | Counterparty-master substrate activates with Niko at licence-day. |
| 3 | Look up the default governing-law clause (`CL-GVL-001`) from the clause library. | Imani | `@platform/legal/clause-library` (today: markdown lookup at `_clause-library.md`). | Confirms the clause's `jurisdictions: [ZA]` intersects the bank's entity jurisdiction. |
| 4 | Decide: accept the default, or open a variant. | Imani (decision in scope per Imani §9) | — | Decision criteria: counterparty has not pushed an alternative forum; the counterparty's home law does not require its own; ISDA / GMRA / GMSLA architecture supported by the clause. |
| 5 | If a variant is required (English law, NY law, etc.) and no library entry exists: emit `ClauseChangeProposed { proposedClauseId, basis, counterpartyId }`. Add the new clause to the library following the four-step authoring procedure in `_clause-library.md`. Pause the present procedure until the library is updated. | Imani | `@platform/event-store`; `@platform/legal/clause-library`. | This is the loopback that prevents drift: a variant is captured as a typed library entry, not as a one-off override. |
| 6 | Record the clause adoption: emit `NegotiationPositionRecorded { counterpartyId, agreementType, clauseRefs: [CL-GVL-001@v0.1, …], rationale, citations }` (build phase) or, post-licence, `ContractTemplateVersioned` / `ContractDraftCreated` carrying the same `clauseRefs`. | Imani | `@platform/event-store`. | Event header carries entity ID and timestamps per P5. Event body's `citations` field carries typed citations to ORG-EL-01, Contracting Policy v0.1 §2, ISDA §13(a). |
| 7 | Notify Saskia (build phase) or the relevant downstream agent (licence-day) of the recorded position. | system | `@platform/escalation` (event-driven; downstream consumes `NegotiationPositionRecorded` directly). | No human notification required — Saskia's handler (planned) consumes the event. |
| 8 | Bespoke-deal exception: if the counterparty insists on a clause structurally outside any library entry and not capturable as a variant, escalate. | Imani → Saskia + Owen | `AgentEscalation` event (planned — Wave-4 #14). | Per Imani spec §10. Pre-execution; escalation carries the proposed wording, the citation gap, and Imani's rationale. |

## 6. Reconciliation

- **Events produced:** `NegotiationPositionRecorded` (build phase); `ContractTemplateVersioned` / `ContractSigned` (licence-day). Optionally `ClauseChangeProposed` and `ClauseLibraryRevised` if a new variant was needed.
- **Reconciliation check:** every `NegotiationPositionRecorded` has at least one resolvable `clauseRef` (the clause exists in the clause library at the cited version) and a citation chain that resolves to the obligations register and the policy register. Vera's planned clause-library recon (Wave-4 candidate) asserts both.
- **Failure mode:** a `clauseRef` that does not resolve (typo, deleted clause, version mismatch) is a finding; the event remains in the log but is flagged for Imani to remediate via `ClauseLibraryRevised` or by re-issuing the position with a corrected ref.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `NegotiationPositionRecorded` event | Event log (`@platform/event-store`) | Indefinite (event log is append-only per P1) | Counterparty-confidential — sensitivity tier `confidential-counterparty` |
| Clause-library entry version referenced | `prototype/platform/legal/_clause-library.md` (today) | Indefinite (versioned) | Internal — sensitivity tier `internal` |
| Citation chain (resolved) | Materialised projection over events + obligations register + policy register | Re-derivable from inputs | Internal |
| Soft-franchise negotiation log | Saskia's soft-franchise log (per Saskia's franchise design proposal) | Through licence-day | Counterparty-confidential |

## 8. Manual steps

- **Build phase only:** Step 2 (counterparty profile read) and Step 7 (Saskia notification) run against today's manual analogue (Owner Inbox notes, Saskia handler not yet wired). At licence-day with the agent-runtime substrate live, both become event-driven. The manual analogue is registered as a tracked exception under P3, expiring when Atlas's A2 (event-trigger bus) lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Counterparty insists on bespoke wording | Step 4 / Step 5 cannot resolve to library entry | Saskia + Owen (Imani §10), pre-execution |
| Counterparty's electronic-execution capability cannot be confirmed | Step 2 returns `electronic-execution-capable: false` | Owen + Saskia (Imani §10); wet-signature exception path; `ECTAExceptionFlagged` event |
| Clause-library entry has lapsed citation (e.g., obligations-register ID changed) | Vera recon | Imani — re-version the clause; supersede |
| Counterparty enters a new jurisdiction beyond library coverage | Step 3 jurisdiction-intersection check fails | CEO + Owen + Camille + Yael (Imani §10 — material legal-entity-tree change) |

## 10. Related procedures

- `Procedures/by-policy/contract-template-cycle.md` — **planned (Imani-owned)** — quarterly template version increments consume clause-library state.
- `Procedures/by-policy/isda-csa-negotiation.md` — **planned (Imani + Saskia co-owned)** — the ISDA-specific path that this procedure feeds into.
- `Procedures/by-policy/gmra-negotiation.md` — **planned (Imani + Saskia co-owned)** — same for repo.
- `Procedures/by-policy/ecta-execution.md` — **planned (Imani-owned)** — picks up at signature time, post-counterparty agreement.
- `Procedures/by-policy/legal-entity-change.md` — **planned (Imani-owned)** — runs when Step 1's lookup needs a new entity.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Imani (via Scrooge) | Initial draft as keystone of the first end-to-end Reg→Policy→Procedure→Capability chain demonstration. |

## 12. Audit / assurance

Vera's planned clause-library recon (Wave-4 candidate) asserts: (a) every `NegotiationPositionRecorded` event has resolvable `clauseRef`s; (b) every clause referenced has a complete citation chain; (c) every citation resolves to a current obligations-register entry, current policy-register entry, statute, or current ISDA / ICMA / ISLA protocol. Findings are reported to Imani for remediation; structural findings (e.g., procedure cites a non-existent policy stub) are reported to Owen.

The procedure itself is exercised continuously in build phase against the soft-franchise pipeline; at licence-day it shifts onto live counterparty signings without architectural change.
