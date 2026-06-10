---
title: Regulatory Knowledge Graph Ontology
author: Mira (Compliance / RegTech engineer, engineering)
version: v1
date: 2026-05-16
citations: [Principles/2-single-graph-discipline.md, Principles/6-autonomous-by-default.md]
---

# Regulatory Knowledge Graph Ontology v1

This document is the canonical human-readable specification of the regulatory knowledge graph ontology used by the HOZ Bank regulatory analysis engine. The machine-readable contract lives in `prototype/platform/regulatory/graph/ontology-schema.ts`; this file is the explanatory companion and future-LLM-prompt source.

> **Two-plane context** (`D-REGULATORY-ARCHITECTURE-TWO-PLANE`, see `../architecture.md`). This ontology is the schema of **Plane A — Regulatory Knowledge**: reference data describing what regulations say (regulators, documents, provisions, source obligations). It is fed by *pluggable* extractors (LLM, scripts, agents, humans) that all emit the one `RegulatoryExtractionArtefact` contract (`../extraction-contract.ts`) with provenance, and loaded by the single loader `seed-projection.ts`. The bank's **adoption** of an obligation is an *event* (Plane B), not part of this reference graph. Two edges bridge/close the chain and are added to the typed schema in the phase that first seeds them: **`DERIVES_FROM`** (bank obligation → source obligation) and **`REALISES`** (capability → obligation).

---

## Design rationale: the Provision/Obligation split

The most important design choice in this ontology is the separation of **Provision** and **Obligation** nodes.

A **Provision** is a piece of text — an atomic clause in a regulatory instrument. It is stable, identifiable by its statutory location (section number), and can be quoted verbatim. Multiple interpretations of a single provision are possible, especially across different entity types or activity contexts.

An **Obligation** is a semantic claim — what a provision *requires*. A single provision may express zero, one, or many obligations. The same obligation may be expressed by multiple provisions (e.g. a primary section and an elaborating regulation). Obligations carry the operational meaning: who must do what, under what conditions, with what strength (must/must-not/may).

This split enables:
- Clean version control: when a provision is amended, only the Provision node changes; Obligation nodes that remain valid persist unchanged.
- Multi-source obligations: "maintain adequate capital" may be expressed by the Banks Act, PA Directive 5/2021, and Basel III transposition simultaneously.
- Clear Principle 2 chain: Regulation → **Provision** –EXPRESSES→ **Obligation** –IMPLEMENTS← **Policy** –GOVERNS→ **Activity**.

---

## Node Types

### 1. Regulator

**Description:** A regulatory authority that issues binding instruments.

**Key properties:** `label` (full name), `id` (REG-{slug})

**Examples:**
- `REG-sarb` — South African Reserve Bank
- `REG-fsca` — Financial Sector Conduct Authority
- `REG-pa` — Prudential Authority

**ID convention:** `REG-{lowercase-slug}` e.g. `REG-fsca`

---

### 2. Jurisdiction

**Description:** A legal jurisdiction in which regulatory authority is exercised.

**Key properties:** `label` (full name), `id` (JURS-{iso-code})

**Examples:**
- `JURS-ZA` — South Africa
- `JURS-EU` — European Union

**ID convention:** `JURS-{ISO-3166-1-alpha-2}` e.g. `JURS-ZA`

---

### 3. Framework

**Description:** An overarching regulatory or international standard framework that one or more instruments implement.

**Key properties:** `label`, `id`

**Examples:**
- `FRMWK-BASEL-III` — Basel III capital and liquidity framework
- `FRMWK-FATF-2012` — FATF 2012 Recommendations

**ID convention:** `FRMWK-{slug}` e.g. `FRMWK-BASEL-III`

---

### 4. Document

**Description:** A regulatory instrument — an act, regulation, notice, circular, guidance note, or directive.

**Key properties:** `label`, `id` (= instrumentId), `effectiveFrom`, `effectiveTo`

**Type-specific metadata (stored in GraphNodeMetadata):**
- `applicabilityStatus`: one of `"direct" | "transposed" | "reference" | "monitored"` (see taxonomy below)
- `instrumentType`: `"act" | "regulation" | "notice" | "circular" | "guidance" | "directive" | "conduct-standard"`
- `jurisdiction`: ISO-3166-1 alpha-2

**Applicability status taxonomy:**
- `direct` — SA legislation or directives that directly bind the bank (e.g. Banks Act, FAIS Act, FIC Act, PA Directives)
- `transposed` — A supranational standard implemented via an SA instrument (e.g. Basel III → PA D5/2021; FATF → FIC Act). The SA instrument is `direct`; the supranational source is `transposed`.
- `reference` — Scanned for context; does not directly bind the bank (e.g. EU MiFID II, UK FCA rules scanned for market practice context)
- `monitored` — Tracked for future applicability (cross-border expansion, forthcoming SARB policy)

**ID convention:** same as `instrumentId` e.g. `FAIS-ACT-37-2002`, `PA-D5-2021`

---

### 5. Provision

**Description:** An atomic clause, section, or sub-section of a Document. This is the verbatim text anchor.

**Key properties:**
- `id` — `{instrumentId}:s{section}` e.g. `FAIS-ACT-37-2002:s7`
- `label` — section heading or "Section 7"
- `text` — verbatim excerpt (max 2000 chars)
- `level` — `"part" | "chapter" | "section" | "clause"`

**ID convention:** `{instrumentId}:s{section}[.{clause}]`
- `FAIS-ACT-37-2002:s7` — Section 7 of the FAIS Act
- `FAIS-ACT-37-2002:s7.1` — Subsection 7(1)
- `BANKS-ACT-94-1990:s60` — Section 60 of the Banks Act

---

### 6. Obligation

**Description:** A semantic requirement expressed by one or more Provisions. Captures what an entity must do, must not do, or may do.

**Key properties:**
- `id` — `OBL-{instrumentId}-s{section}-{seq}` e.g. `OBL-FAIS-ACT-37-2002-s7-1`
- `label` — short title of the obligation
- `obligationType` — `"must" | "must-not" | "may" | "conditional" | "recommended"`
- `actor` — who must fulfil the obligation (e.g. "FSP", "key individual", "board")
- `actionSummary` — plain-English one-sentence summary
- `trigger` — condition that activates the obligation (optional)
- `exception` — condition that exempts from the obligation (optional)

**ID convention:** `OBL-{instrumentId}-s{section}-{seq}` where `{seq}` is a 1-based integer per provision.

**obligationType values:**
- `must` — mandatory positive duty ("shall", "must")
- `must-not` — prohibition ("shall not", "must not")
- `may` — permissive or discretionary ("may")
- `conditional` — obligation gated on a condition or threshold
- `recommended` — guidance or best practice ("should")

---

### 7. Term

**Description:** A word or phrase given a statutory definition in a regulatory instrument.

**Key properties:**
- `id` — `TERM-{slug}` e.g. `TERM-key-individual`
- `label` — the term as it appears in the instrument
- `term` — the exact defined term
- `definitionText` — the statutory definition text

**ID convention:** `TERM-{kebab-case-slug}` e.g. `TERM-qualifying-capital`, `TERM-financial-instrument`

---

### 8. RegulatedEntity

**Description:** A type of entity that is subject to regulation under an instrument (e.g. bank, FSP, auditor, key individual).

**Key properties:** `id`, `label`

**Examples:**
- `ENTITY-bank` — a bank as defined in the Banks Act
- `ENTITY-category-i-fsp` — Category I Financial Services Provider
- `ENTITY-key-individual` — Key individual of an FSP

**ID convention:** `ENTITY-{slug}`

---

### 9. Activity

**Description:** A regulated activity that an entity may be permitted or required to perform.

**Key properties:** `id`, `label`

**Examples:**
- `ACT-TRADE-EXEC` — executing trades
- `ACT-CLIENT-ONBOARD` — client onboarding
- `ACT-REPORTING` — regulatory reporting

**ID convention:** Use the canonical taxonomy codes from the EXTRACTION_SYSTEM_PROMPT (`ACT-TRADE-EXEC`, etc.) as IDs.

---

### 10. RiskCategory

**Description:** A risk classification node — ties obligations to the bank's risk taxonomy.

**Key properties:** `id` (= risk taxonomy code), `label`

**Examples:**
- `CMP-001` — regulatory compliance risk
- `MKT-001` — market risk general

**ID convention:** canonical risk taxonomy code (e.g. `MKT-001`, `CRD-001`, `OPR-001`)

---

### 11. Control

**Description:** A mitigating control or safeguard required or implied by an obligation.

**Key properties:** `id`, `label`

**ID convention:** `CTL-{slug}` e.g. `CTL-aml-screening`, `CTL-margin-call`

---

### 12. ReportingRequirement

**Description:** A specific filing or disclosure obligation — submitting a report to a regulator or disclosing information to a client.

**Key properties:** `id`, `label`, `actor`, `actionSummary`, `trigger`

**Examples:**
- `RPT-SARB-BA700` — BA700 monthly return to SARB
- `RPT-FSCA-DISCLOSURE` — FSCA disclosure to retail/institutional clients

**ID convention:** `RPT-{slug}`

---

### 13. Threshold

**Description:** A quantitative trigger, limit, or ratio that activates or conditions an obligation.

**Key properties:**
- `id` — `THR-{slug}` e.g. `THR-cet1-ratio-4-5-pct`
- `value` — numeric value (e.g. `4.5`)
- `unit` — unit of measure (e.g. `"%"`, `"ZAR"`, `"days"`)
- `operator` — comparison operator: `">=" | "<=" | "=" | ">" | "<"`

**ID convention:** `THR-{descriptive-slug}` e.g. `THR-lar-100-pct`, `THR-net-stable-funding-100-pct`

---

### 14. EffectivePeriod

**Description:** A time window during which obligations apply (e.g. a transitional period, a phase-in window).

**Key properties:** `id`, `label`, `effectiveFrom`, `effectiveTo`

**ID convention:** `EP-{slug}` e.g. `EP-basel-iii-phase-in-2013-2019`

---

### 15. Policy

**Description:** A bank-internal policy document that implements one or more regulatory obligations (Principle 2 chain).

**Key properties:** `id` (= policy code), `label`

**Examples:**
- `POL-FAIS-001` — FAIS Act compliance policy
- `POL-AML-001` — AML/CFT policy

**ID convention:** same as bank policy code e.g. `POL-FAIS-001`

---

### 16. Procedure

**Description:** A bank-internal procedure that operationalises a Policy (the bottom of the Principle 2 chain: Obligation → Policy → Procedure → System Capability).

**Key properties:** `id` (= procedure code), `label`

**Examples:**
- `PROC-KYC-001` — KYC onboarding procedure
- `PROC-TRADE-EXEC-001` — trade execution procedure

**ID convention:** same as bank procedure code e.g. `PROC-KYC-001`

---

## Edge Types

### Structural Edges

| Edge | From | To | Meaning | When to assert |
|------|------|----|---------|----------------|
| `ISSUED_BY` | Document | Regulator | The instrument was issued by this regulatory authority | Always — every document has an issuer |
| `OPERATES_IN` | Regulator | Jurisdiction | The authority exercises jurisdiction here | Always — every regulator operates in a jurisdiction |
| `COMPRISES` | Framework | Document | The framework is implemented by/comprises this instrument | When a framework (Basel, FATF) is operationalised by a specific SA instrument |
| `CONTAINS` | Document | Provision | The document contains this provision | Always — every provision is contained in a document |
| `PART_OF` | Provision | Provision | This clause is a sub-provision of a parent section | For subsection relationships (s7.1 PART_OF s7) |

### Semantic Edges

| Edge | From | To | Meaning | When to assert |
|------|------|----|---------|----------------|
| `EXPRESSES` | Provision | Obligation | This provision expresses an obligation | For every obligation extracted from a provision |
| `APPLIES_TO` | Obligation | RegulatedEntity | The obligation applies to this entity type | When the provision explicitly names an entity type |
| `APPLIES_TO_ACTIVITY` | Obligation | Activity | The obligation applies when performing this activity | When the obligation is activity-scoped |
| `REQUIRES` | Obligation | Control | Fulfilling the obligation requires this control | When the obligation clearly implies a specific control type |
| `REQUIRES_REPORT` | Obligation | ReportingRequirement | The obligation requires a specific regulatory filing | For disclosure and reporting obligations |
| `ADDRESSES` | Obligation | RiskCategory | The obligation is designed to address this risk category | When the risk category is evident from context |
| `SETS` | Obligation | Threshold | The obligation sets a quantitative limit or trigger | For capital adequacy, liquidity ratio, concentration limit provisions |
| `DEFINES` | Provision | Term | This provision provides the statutory definition of a term | For definition sections |
| `USES` | Provision | Term | This provision uses a term defined elsewhere in the instrument | For provisions that apply a defined term |
| `CONDITIONAL_ON` | Obligation | Threshold | The obligation is only activated when a threshold is breached | For conditional/event-triggered obligations |

### Lifecycle/Temporal Edges

| Edge | From | To | Meaning | When to assert |
|------|------|----|---------|----------------|
| `SUPERSEDES` | Document | Document | The new document supersedes the old | Version transitions; amendment that replaces a prior act |
| `AMENDS` | Document | Document | The instrument amends (modifies) another instrument | Amendment notices that patch specific sections |
| `EFFECTIVE_DURING` | Obligation | EffectivePeriod | The obligation is only effective during this period | Transitional arrangements, phase-in windows |
| `TRANSPOSES` | Document | Framework \| Document | An SA instrument transposes an international standard — either the whole framework or a specific standard Document | PA D5/2021 TRANSPOSES FRMWK-BASEL-III; SARB PA Directive D2/2015 TRANSPOSES the BCBS 239 Document |
| `EQUIVALENT_TO` | Obligation | Obligation | Cross-jurisdictional equivalence (same obligation, different regime) | For EU/UK equivalence mapping (reference only) |

#### Adoption semantics (Basel baseline → jurisdiction)

The bank catalogues the Basel Framework as the **baseline layer** and layers each jurisdiction's adoption over it (D-BASEL-CATALOGUE-PILLAR-1). The five adoption relationships map onto the existing edge set — there is no separate `ADOPTS`/`MODIFIES`/`GOLD_PLATES`/`SILENT` edge type:

| Adoption | Maps to | Carries |
|---|---|---|
| **ADOPTS** — local takes the Basel provision unchanged | `TRANSPOSES` | no delta |
| **MODIFIES** — local adopts with a variation (national discount, different transition date, add-on) | `TRANSPOSES` | typed `delta` |
| **GOLD_PLATES** — local is *stricter* than Basel | `TRANSPOSES` | `delta` + `stricter: true` |
| **SUPERSEDES** — local replaces the Basel position entirely | `SUPERSEDES` | — |
| **SILENT** — Basel speaks, local has not | *(no edge)* | resolver falls back to the Basel baseline |

The typed "register" form lives at `platform/regulatory/basel-adoption.ts` (`ADOPTION_EDGES`); the point-in-time resolution function (`jurisdiction + provision + date → governing rule, Basel fallback`) is `platform/regulatory/resolve-applicable-rule.ts`. These are projectable into the seeded graph as `TRANSPOSES`/`SUPERSEDES` edges once the LLM-extraction breadth pass runs.

### Cross-Reference Edges

| Edge | From | To | Meaning | When to assert |
|------|------|----|---------|----------------|
| `REFERENCES` | Provision | Provision | This provision explicitly cross-references another | When "as contemplated in section X" language appears |
| `MAPS_TO` | Provision | Provision | Maps to an equivalent provision in another instrument | For cross-instrument reconciliation (internal use) |
| `CONFLICTS_WITH` | Obligation | Obligation | Two obligations conflict (rare; escalates for legal review) | Only assert with high confidence and a note |

### Bank-Internal Edges (Principle 2 Implementation Chain)

| Edge | From | To | Meaning | When to assert |
|------|------|----|---------|----------------|
| `IMPLEMENTS` | Policy | Obligation | A bank policy implements a regulatory obligation | When a policy exists that directly addresses this obligation |
| `CLOSES` | Control | Obligation | A control closes the gap left by an obligation | For control-mapping in the obligations register |
| `GOVERNS` | Policy | Activity | A bank policy governs a regulated activity | When the policy scope matches the activity |

---

## The Principle 2 Implementation Chain

Principle 2 (single-graph discipline) requires that every node in the bank's obligation and policy framework traces in both directions:

```
Regulation / Bank Objective
    ↓ (Document: ISSUED_BY Regulator)
Document
    ↓ (CONTAINS)
Provision
    ↓ (EXPRESSES)
Obligation
    ↑ (IMPLEMENTS)
Policy
    ↓ (GOVERNS)
Activity / Procedure
```

Every obligation in the bank's obligations register must have:
1. A Provision node that `EXPRESSES` it (upward citation to the law)
2. A Policy node that `IMPLEMENTS` it (downward to bank controls)

Obligations without both links are "orphans" — a Vera finding.

---

## Examples

### Example: FAIS Act Section 7 — Authorisation requirement

```
Provision node:
  id: "FAIS-ACT-37-2002:s7"
  nodeType: "Provision"
  label: "Section 7 — Authorisation required"
  level: "section"

Obligation node:
  id: "OBL-FAIS-ACT-37-2002-s7-1"
  nodeType: "Obligation"
  label: "FSP must be authorised before rendering financial services"
  obligationType: "must"
  actor: "Financial services provider"
  actionSummary: "Obtain authorisation from the FSCA before rendering any financial service"

Edges:
  "FAIS-ACT-37-2002:s7" --EXPRESSES--> "OBL-FAIS-ACT-37-2002-s7-1"  (confidence: 1.0)
  "OBL-FAIS-ACT-37-2002-s7-1" --APPLIES_TO--> "ENTITY-fsp"  (confidence: 1.0)
  "OBL-FAIS-ACT-37-2002-s7-1" --ADDRESSES--> "CMP-001"  (confidence: 0.9)
```

### Example: Banks Act capital adequacy threshold

```
Threshold node:
  id: "THR-cet1-ratio-4-5-pct"
  nodeType: "Threshold"
  label: "CET1 minimum ratio 4.5%"
  value: 4.5
  unit: "%"
  operator: ">="

Obligation node:
  id: "OBL-BANKS-ACT-94-1990-s70-1"
  nodeType: "Obligation"
  label: "Bank must maintain minimum CET1 ratio"
  obligationType: "must"
  actor: "bank"
  actionSummary: "Maintain Common Equity Tier 1 capital ratio of at least 4.5% of risk-weighted assets"

Edges:
  "BANKS-ACT-94-1990:s70" --EXPRESSES--> "OBL-BANKS-ACT-94-1990-s70-1"  (confidence: 1.0)
  "OBL-BANKS-ACT-94-1990-s70-1" --SETS--> "THR-cet1-ratio-4-5-pct"  (confidence: 1.0)
  "OBL-BANKS-ACT-94-1990-s70-1" --APPLIES_TO--> "ENTITY-bank"  (confidence: 1.0)
  "OBL-BANKS-ACT-94-1990-s70-1" --ADDRESSES--> "MKT-001"  (confidence: 0.8)
```

---

## Validation

All LLM extraction output is validated against the JSON Schema contract before being stored:
- `GRAPH_NODE_SCHEMA` at `https://hoz-bank/regulatory-graph/node/v1`
- `GRAPH_EDGE_SCHEMA` at `https://hoz-bank/regulatory-graph/edge/v1`
- `EXTRACTION_RESPONSE_SCHEMA` at `https://hoz-bank/regulatory-graph/extraction-response/v1`

Validation is performed by `validateExtractionResponse()` in `ontology-schema.ts` using Zod. Output that fails validation is discarded with a warning log — it is never silently accepted.
