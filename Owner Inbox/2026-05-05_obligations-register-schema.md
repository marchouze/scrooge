# Obligations register — schema and design

**Author:** PAX
**Date:** 2026-05-05
**For:** Marc, Atlas, Mira, and the engineering team

## 1. Purpose

Under Principle 2, every action the bank takes must cite a structured source of authority. The obligations register is that source. It is the canonical, typed, versioned home for every law, regulation, standard, contract, and internal policy the bank depends on, plus the obligations the bank derives from them and the registered exceptions where the default operating model does not apply.

This document defines the register's shape and contract. It is consumed primarily by Atlas (who hosts it on the platform) and Mira (who curates it).

## 2. Scope

The register holds:

- **External obligations** — laws, regulations, regulator standards and directives, supranational standards (BCBS, FATF, OECD), accounting and reporting standards, exchange rules.
- **Industry standards** — ISO, ISDA, ICMA, ISLA, FIX, BIAN, SWIFT documentation that the bank chooses to follow.
- **Contractual obligations** — master agreements, CSAs, prime-brokerage agreements, customer agreements, service-provider agreements, scheme participant rules.
- **Internal authorities** — board mandates, policies, delegations of authority, signing matrix, model-governance records.
- **Exceptions** — registered deviations from the default operating model under Principle 3.

The register does **not** hold:

- Implementation code (it is *cited from* code; it is not code).
- Customer data, contract instances, payroll instructions, postings — the register holds the *type* and the *clause*, not the *case*.

## 3. Core entity types

- `Source` — the issuing body (SARB, FSCA, FIC, SARS, JSE, IFRS Foundation, BCBS, ISDA, etc.).
- `Instrument` — the named legal or normative document (Banks Act, Regulations Relating to Banks, Joint Standard 1 of 2024, IFRS 9, GMRA 2011, JSE Equities Rules).
- `Provision` — a section, paragraph, clause, rule, or principle inside an instrument.
- `Policy` — internal policy or standard that adopts, interprets, or extends external provisions.
- `Obligation` — the bank's structured duty derived from one or more provisions and/or policies.
- `Exception` — a registered deviation under P3, with justification, scope, and review cadence.
- `Citation` — the link recorded *from* an artefact (code, control, posting, contract, document) *to* an entry above.

## 4. Identifier scheme

URN-style, hierarchical, human-readable, stable across versions:

- `oblig:source:za-sarb`
- `oblig:instrument:za-sarb:banks-act-94-1990`
- `oblig:provision:za-sarb:banks-act-94-1990:s64`
- `oblig:policy:internal:credit-risk-policy`
- `oblig:obligation:kyc:cdd-natural-person`
- `oblig:exception:wet-signature:property-loan`

Versions are a property of the entry, not the identifier. RFC 8141 URN conventions apply.

## 5. Common fields

Every entity carries:

- `urn` — identifier.
- `version` — semantic version of the entry (regulator amendment → minor; replacement instrument → major).
- `as_of` — date this version is valid from.
- `superseded_by` — pointer to the version that replaces this one, when applicable.
- `status` — one of `draft`, `in_force`, `superseded`, `repealed`, `withdrawn`.
- `created_at`, `created_by`, `attested_at`, `attested_by` — provenance.
- `events` — backref into the platform event log (the register is itself event-sourced under P1).
- `integrity` — hash of the canonical text or data captured at attestation, signed under P4.

## 6. Per-type fields (non-exhaustive)

`Source` — name, jurisdiction, type (regulator / standards body / counterparty / internal), parent body, official location reference (version-stamped where one exists).

`Instrument` — title, source URN, jurisdiction, instrument type (statute / regulation / directive / standard / contract / policy), promulgation date, repeal date, language, official location, taxonomy tags.

`Provision` — instrument URN, section/clause path, canonical text, text-as-of date, plain-language summary, optional structured machine-readable extract, tags.

`Policy` — title, owner, approver, scope, supersedes, related external provisions.

`Obligation` — name, plain-language statement, structured precondition (when does it apply: customer type, product type, jurisdiction, threshold), structured action required, basis (one or more provisions/policies), severity (statutory / regulatory / contractual / internal), responsible-team tag, evidence requirement.

`Exception` — name, what is being deviated from, justification text, justification basis (citation), scope (entity, jurisdiction, product, customer-class), review cadence, expiry, approver.

`Citation` — citing artefact (URI to code, control, posting, contract, document), cited URN, citing-version, optional sub-fragment (symbol, control test ID).

## 7. Lifecycle

State transitions are events:

```
draft → in_force → (superseded | repealed | withdrawn)
```

Citations from production code may not reference `draft`, `superseded`, `repealed`, or `withdrawn` entries — references are repointed before deployment, or a registered exception is created.

Regulatory amendments produce a new version of the instrument and the affected provisions. Prior versions are kept `superseded` and remain queryable forever, so historical re-runs of returns or controls under the rule that *was* in force are first-class operations.

## 8. Versioning and as-of replay

Under P1, the register is event-sourced. The query "what did obligation X say on date Y?" is exact and reproducible.

A control or computation cites a URN. The version of the obligation that *applied* at the time of the action is resolved by the action's as-of date. Historical investigations resolve to historical versions; new design resolves to current `in_force`.

## 9. Cross-references

- `Provision → Provision` — amendments, references, repeals.
- `Obligation → Provision/Policy` — basis (always at least one).
- `Citation → Obligation/Provision/Policy` — many-to-one from artefacts.
- `Exception → Obligation/Provision` — what is being excepted from.
- `Policy → Provision` — which external authorities the policy implements.

The graph is queryable: "what controls test obligation X?" "what obligations cite provision Y?" "which exceptions touch product Z, on which date?" are standard queries.

## 10. API contract (conceptual)

A small, stable surface every other engineer depends on:

- `resolve(urn, as_of) → Entry`
- `list(filter, as_of) → [Entry]`
- `cite(citing_artefact, urn, as_of_optional) → Citation`
- `attest(urn, version) → AttestationEvent`
- `supersede(urn, by_version) → Event`
- `register_exception(...) → ExceptionEntry`
- `graph_query(...)` — relationship traversals.

Every call produces a signed event under P4. Reads are authorised under least-privilege; metadata is broadly readable, canonical text may be access-controlled where licensed.

## 11. Consumer integration patterns

- **Postings** — every posting carries one or more citations (chart-of-accounts node → disclosure obligation; transactional posting → operating obligation).
- **Controls** — every control test references the obligation it asserts.
- **Contracts** — every clause in a template carries a citation; client-instance contracts inherit citations from their templates, with overrides themselves citation-bearing.
- **Reports** — every BA return cell, every IFRS line, every tax-return field cites the obligation it satisfies.
- **Workflows** — approval workflows cite the obligation that requires the approval.
- **Models** — risk and pricing models cite the methodology authority and any model-validation requirement.

## 12. Curation and governance

- **Curated by Mira** as part of regulatory-change management.
- **Independently asserted by Vera** — citation integrity, attestation freshness, exception currency are continuous-controls-monitoring tests.
- **Reviewed by Imani** for contractual and legal-instrument entries.
- **Hosted by Atlas** — the platform exposes the register as a first-class service.
- Every entry carries a fetched-from reference to the regulator's or counterparty's own publication, hashed at fetch time.
- PR-style flow for changes: proposed change → review by Imani and the affected domain engineer → attestation by Mira.
- Stale-attestation alarms: any `in_force` entry past its review cadence triggers a register-tracked exception until refreshed.

## 13. Open questions for engineering

Flagged for Atlas and Mira on day one:

1. **Storage** — is the register a first-class subdomain inside the core platform, or a separate service? Recommend the former, but document the contract either way.
2. **Provision text** — hold canonical text, or pointer + extract? Recommend both, with hash integrity on canonical text.
3. **Multi-language** — SA legislation is in English; counterparty contracts and host-jurisdiction rules will introduce others on expansion. Decide policy at first host-country activity (P5).
4. **Citation granularity in code** — cite to file+line, symbol, or documented control ID? Recommend symbol + control ID; never raw line numbers.
5. **Trust model for sources** — manual attestation for primary law; automated fetch + hash for issued standards. Define list per source type.
6. **Backward citation invariants** — how strictly do we forbid `superseded` references in production? Recommend hard CI failure with explicit override only via registered exception.

## 14. Sources consulted

- Principle 2 and Principle 4, `CLAUDE.md` of this project.
- Akoma Ntoso and LegalRuleML — legal-document markup standards informing the structured-text approach.
- W3C ODRL — vocabulary for permissions and duties (informational reference).
- BIAN service domain reference model — informs the shape of a "compliance evidence" service.
- IETF RFC 8141 — URN syntax and best practice.
- BCBS 239 — risk-data aggregation principles, applied here to obligations data.
