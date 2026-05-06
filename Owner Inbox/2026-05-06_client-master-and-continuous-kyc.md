# Client master and continuous KYC — design

**Authors:** Mira (lead — KYC pipeline), Anya (lead — client master as projection), Imani (legal-entity taxonomy)
**Contributors:** Atlas (event types and platform), Senna (security and threat model), Niko (onboarding hand-off), Iris (POPIA), Zara (regulatory designations)
**Date:** 2026-05-06
**For:** Marc (CEO)

> **Note on derivation (Principle 6).** The client master is a **projection** over events, not an authoritative table. Continuous-KYC outcomes are events that update the projection. This design document is the *standard* layer; policies (CDD, EDD, sanctions, RMCP) sit above it; live client records and KYC outcomes are *data*; future external presentations (regulatory reports, client confirmations) summarise from here.

---

## 1. Event types underpinning the client master

Atlas-defined; Mira and Anya co-curated.

### Identity events
- `ClientCandidateRegistered { candidate_id, source, jurisdiction_tags, intent }`
- `ClientIdentityClaimed { candidate_id, identity_type, identity_value, evidence_ref, citation }`
- `ClientIdentityVerified { candidate_id, method, score, verified_by, citation }`
- `ClientAccepted { client_id, entity, accepted_at, citation }`
- `ClientRejected { candidate_id, reason_code, citation }`
- `ClientExited { client_id, reason_code, citation, exited_at }`

### Hierarchy and beneficial-ownership events
- `HierarchyEdgeAsserted { parent_id, child_id, type, percentage, source, asserted_at, citation }`
- `HierarchyEdgeRetired { edge_id, retired_at, reason, citation }`
- `BeneficialOwnerAsserted { client_id, ubo_id, ownership_pct, control_basis, source, citation }`
- `BeneficialOwnerRetired { client_id, ubo_id, retired_at, reason, citation }`
- `ControllingPartyDeclared { client_id, person_or_entity_id, basis, citation }`

### Jurisdiction and tax events
- `JurisdictionTagAsserted { client_id, role (registration|operating|tax_residence|com|regulatory), country, source, citation }`
- `JurisdictionTagRetired { client_id, role, country, retired_at, citation }`
- `TaxClassificationAsserted { client_id, regime (FATCA|CRS|Other), classification, citation }`

### Risk-rating and KYC events
- `KYCStateChanged { client_id, from, to, mode (upfront|recurring|continuous), trigger, citation }`
- `RiskRatingAssigned { client_id, rating, basis (typology|signal|EDD), assigned_by, citation }`
- `KYCSignalIngested { client_id, signal_source, signal_type, payload_ref, ingested_at }`
- `KYCRuleEvaluated { client_id, rule_id, outcome, evidence_refs, citation }`
- `RestrictionApplied { client_id, restriction_type, basis, applied_by, citation }`
- `RestrictionLifted { client_id, restriction_type, lifted_by, citation }`
- `STREscalated { client_id, mlro: zara, reasoning_ref, escalated_at }`

### Document and consent events
- `DocumentLodged { client_id, document_type, evidence_ref, expires_at, citation }`
- `DocumentExpired { client_id, document_id, expired_at }`
- `ConsentGranted { client_id, purpose, lawful_basis, granted_at, citation }`
- `ConsentWithdrawn { client_id, purpose, withdrawn_at }` *(propagates through Anya's projections; Iris-governed under POPIA)*

All events carry: `event_id`, `as_of`, `source`, `actor` (typed), `entity`, `cryptographic_attestation`. P1, P2, P4 by construction.

## 2. Client-master projection schema

Anya-owned; consumed by every domain that asks "what is the client record at as-of date T?"

```
ClientRecord {
  client_id,
  entity,                        // legal entity of the bank holding the relationship
  status,                        // candidate | active | restricted | exited
  legal_entity_type,             // see §3 taxonomy
  jurisdictions: {
    registration: [country],
    operating:    [country, country, ...],
    tax_residence:[country, country, ...],
    com:           country,
    regulatory:   [country, country, ...]
  },
  hierarchy_edges: [             // graph projection
    { parent_id, child_id, type, percentage, source, as_of }
  ],
  beneficial_owners: [           // graph projection
    { ubo_id, ownership_pct, control_basis, as_of }
  ],
  controlling_parties: [...],
  risk_rating: { value, basis, as_of },
  kyc_state: { upfront, recurring, continuous, last_review, next_review },
  documents: [{ type, status, expires_at }],
  restrictions: [{ type, basis, as_of }],
  consents: [{ purpose, lawful_basis, as_of }],
  tax_classifications: [{ regime, classification, as_of }],
  citations: [obligations_register_id],
  derived_from: [event_ids]      // P2 — full lineage
}
```

The record is **derived** — never authored. Every field traces to events. As-of-date queries are first-class; replay is reproducible.

Hierarchies and beneficial ownership are **graph projections**, not flat tables — UBO chains crossing borders and entity types are first-class.

## 3. Legal-entity-type taxonomy v1

Imani-curated; extensible via register entries (P5 — new types added as register changes, not code branches).

| Code | Type | Notes |
|---|---|---|
| NP | Natural person | Customer-protection regime applies |
| ZA-PTY | Private Company (Pty Ltd) under Companies Act | CIPC registration |
| ZA-PUB | Public Company under Companies Act | CIPC registration; possibly listed |
| ZA-CC | Close Corporation | Legacy; CIPC |
| ZA-NPC | Non-Profit Company | Companies Act NPC |
| ZA-PBO | Public Benefit Organisation | SARS PBO designation |
| ZA-TRUST | Trust under Trust Property Control Act | Master of the High Court |
| ZA-PTSHIP | Partnership | Common-law |
| ZA-SP | Sole Proprietor | NP-equivalent for some purposes |
| ZA-COOP | Co-operative | Co-operatives Act |
| FOR-CORP | Foreign corporate | Country-specific subtype lookup |
| FOR-TRUST | Foreign trust | Country-specific |
| FOR-OTHER | Other foreign entity | Tagged for follow-up; register entry triggers full subtype |
| GOV | Government / public-sector entity | Sovereign, sub-sovereign, parastatal |
| FI | Financial institution | Bank, insurer, FSP — special CDD treatment |
| INTL-ORG | International organisation | Multilateral / treaty-based |
| OTHER-FLAGGED | Unrecognised type | Forces register-entry creation before acceptance |

Each type has, in the register, the prescribed CDD documentation set, the prescribed UBO-resolution rules, and the prescribed risk-rating typology baseline.

## 4. Multi-jurisdiction model

Per Principle 5: every client carries multiple jurisdiction roles simultaneously. These are independent fields, not a single "country" property.

| Role | Definition | Source-of-truth signal |
|---|---|---|
| `registration` | Where the entity is constituted | Constitutional document; CIPC / foreign registry |
| `operating` | Where the entity actually does business (can be plural) | Customer self-declaration + signal validation |
| `tax_residence` | Where the entity is tax-resident | Self-certification + tax-authority registration |
| `com` | Centre of main interests (insolvency-relevant) | Self-declaration + operational evidence |
| `regulatory` | Regulator(s) of the entity itself or its activities | Look-up by entity-type and licence |

KYC requirements **dispatch** on jurisdiction roles. A client registered in BVI but operating in SA carries SA operating + BVI registration tags; KYC rules from both regimes apply (intersection, with SA prevailing where conflict on SA-residence-required).

The canonical case "registered in country A, operating in country B" is the default, not an edge case.

## 5. KYC pipeline — three modes

Mira-owned. Operates as **three parallel modes**, each producing `KYCStateChanged` events. The client-master projection consumes all three.

### 5.1 Upfront KYC (gate before client-master entry)

Sequence (event-driven):
1. `ClientCandidateRegistered` — entry point.
2. Identity collection → `ClientIdentityClaimed` events for each identity element.
3. Identity verification (ID document, biometrics, registry lookup) → `ClientIdentityVerified` events.
4. Sanctions / PEP / adverse-media screening on candidate, controlling parties, UBOs → `KYCRuleEvaluated` events.
5. Beneficial-ownership resolution per legal-entity-type → `BeneficialOwnerAsserted` events; recursive on corporate UBOs until natural persons or terminal opaque structures.
6. Risk rating assigned → `RiskRatingAssigned`.
7. EDD branch if high-risk → additional documents and approvals; `DocumentLodged`, `KYCRuleEvaluated`.
8. Final accept / reject decision → `ClientAccepted` or `ClientRejected`.
9. **Only on `ClientAccepted` does the client appear in the master projection**.

Acceptance gate is the regulatory line: no client enters the master without satisfying applicable upfront KYC under FIC Act, FATF Recs, FAIS where relevant, and regulatory-by-jurisdiction.

### 5.2 Recurring KYC (legal periodicity)

- Risk-band-driven cadence per FIC Guidance Note 7 (RBA): high-risk → annual review; medium → 24 months; low → 36 months. (Periodicity defaults; Zara's RMCP refines.)
- Each due date is a scheduled event; absence of action triggers escalation.
- On each cycle, refresh: identity validity, document expiry, jurisdiction tags, ownership structure, risk rating.
- Outcome: `KYCStateChanged { mode: recurring, ... }` plus updated rating.

### 5.3 Continuous KYC (signal-driven, ongoing)

The bank operates a continuous-KYC pipeline that consumes signals and re-evaluates clients as signals arrive.

Signal sources (per CEO directive 2026-05-06: **non-paid first**, source-pluggable for later paid sources):
- Sanctions-list deltas: UN, OFAC, EU, UK HMT, DTI Targeted Financial Sanctions list (POCDATARA).
- PEP / adverse-media via open sources (initially; ComplyAdvantage / World-Check / Sayari **deferred**).
- Beneficial-ownership / registry updates: CIPC, equivalent foreign open registries.
- Document expiry: internal events.
- Jurisdictional-status changes: country-risk re-rating; sanctions geopolitics.
- Behavioural anomalies: from Mira's transaction-monitoring pipeline (separate but feeds here).
- Court / insolvency / regulator-action filings where openly available.
- Watchlist updates curated internally.

Pipeline flow (event-driven):
1. `KYCSignalIngested` from any source.
2. Rules engine evaluates relevance against the affected client(s) → `KYCRuleEvaluated` events.
3. **Restriction default per RAS / RAF §B5:**
   - **High-confidence triggers** (sanctions hit, court order, beneficial-ownership change crossing a control threshold) → `RestrictionApplied { type: immediate }`.
   - **Medium-confidence triggers** (adverse media, behavioural anomaly, registry change) → `RestrictionApplied { type: on-review-pending }` plus case-management workflow.
4. Risk rating may be uplifted → `RiskRatingAssigned`.
5. KYC state event recorded → `KYCStateChanged { mode: continuous, trigger: ... }`.
6. STR consideration if typology fits → `STREscalated`; Zara as MLRO judges and files with FIC.

Continuous-KYC re-evaluation against historical state is replayable — a retrospective rule change re-evaluates history and emits as-of-replay events for review.

## 6. Obligations-register entries (P2)

Mira-curated; partial list:

- FIC Act 38 of 2001, ss.21–21H (CDD), s.42 (RMCP), ss.28 / 28A / 29 (reporting) — every CDD step, every monitoring rule, every reporting trigger cites these.
- FATF Recommendations 10 (CDD), 11 (record-keeping), 12 (PEPs), 13 (correspondent banking), 16 (wire transfers), 22 (DNFBPs).
- FIC Guidance Note 7 — RBA periodicity for recurring KYC.
- POPIA ss.13 (purpose), 14 (retention), 15 (further processing), 19–22 (security and breach), 72 (cross-border) — Iris-governed.
- FATCA Inter-Governmental Agreement; CRS — tax-classification dispatch.
- Sanctions: UN consolidated; OFAC SDN; EU consolidated; UK HMT; DTI POCDATARA list.
- Banks Act 94 of 1990 — to the extent the client master serves regulator-facing reporting.
- Companies Act 71 of 2008 + Companies Regulations 2011 — beneficial-ownership filing requirements (CIPC).
- Trust Property Control Act — for ZA-TRUST UBO resolution.

Each entry is versioned; rule changes propagate forward, with as-of-replay maintaining historical evaluation against historical rules unless replay is explicitly run with new rules (a Mira-judged operation).

## 7. Threat model and access-control design (Senna)

- Client-master fields are classified: PII (high), financial (high), KYC outcome (high), risk-rating (medium-high). All field-level encrypted with envelope encryption rooted in HSM.
- Read events on PII are themselves audited as events (`PIIRead { reader, purpose, client_id, fields, timestamp }`); aggregations are projections of these audit events.
- Access is purpose-bound — every reader binds to a documented lawful purpose at the time of read; readers without bound purpose are refused.
- Continuous-KYC ingestion sources are signed; integrity of list-version, rule-version, and decision is cryptographically attested per evaluation.
- Tipping-off prevention: STR existence and content are restricted to the MLRO (Zara) plus the named investigation set; the projection enforces this.
- Threat model passes Senna's gate before any new ingestion source is added; new sources enter as register entries with a documented threat model.

## 8. Reconciliation and as-of-replay design

- The client-master projection is **idempotent and deterministic** over the event stream: replaying produces the same record.
- A **CI reconciliation harness** runs on every change to the projection runtime: a synthetic event stream is replayed; the resulting projection must match a checked-in golden state. Drift fails the CI gate.
- Retrospective rule changes (e.g., a sanctions list adds a person whose past transactions need re-screening) are run as **replay-with-new-rules** operations: this produces a new event stream of `KYCRuleEvaluated` events tagged with the as-of-rule-version; the projection's history reflects what was known when, *and* what would have been known under the new rule.
- This is the operational expression of P1's as-of-replay guarantee.

## 9. Implementation sequencing

| Phase | Scope | Owner |
|---|---|---|
| 1 (now) | Event types specified; projection schema specified; this document approved | Mira / Anya / Imani |
| 2 | Prototype implementation in `prototype/`: event log, projection runtime, sample CDD | Atlas + Anya |
| 3 | KYC upfront pipeline (rules engine, screening, EDD branch) | Mira |
| 4 | Continuous-KYC signal ingestion (sanctions deltas, document expiry, behavioural feed) | Mira + Anya |
| 5 | Recurring-KYC scheduler | Mira |
| 6 | Senna's threat-model gate enforced; access-audit projection live | Senna |
| 7 | Iris's POPIA approval; lawful-processing register entries lodged | Iris |
| 8 | First end-to-end onboarding through the prototype | All |

## 10. Open items requiring CEO action / awareness

1. **Approval of the two-tier continuous-KYC restriction default** as recorded in RAS / RAF §B5 — this design implements that default; restate if appetite changes.
2. **Confirmation that paid-data integrations remain deferred** (current design uses non-paid sources; pipeline is source-pluggable for later addition).
3. **Iris's POPIA Information Officer designation** — must be lodged with the Information Regulator before continuous-KYC ingestion of personal-information sources from third parties begins in production. (Out-of-system action; CEO signature.)
4. **Initial geographic perimeter** confirmed primarily SA; design is plural by construction so day-one perimeter does not constrain forward expansion.

## 11. Co-dependencies with other deliverables

- **Governance framework** (`Owner Inbox/2026-05-06_governance-framework.md`) — defines the MLRO and CCO accountabilities (Zara) that this design relies on.
- **RAS / RAF** (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) — sets the two-tier continuous-KYC restriction default that this design implements.
- **Org structure** (`Owner Inbox/2026-05-06_org-structure.md`) — confirms the seats (Mira → Zara, Anya → Devon, Imani interim → Devon) that this design depends on.
