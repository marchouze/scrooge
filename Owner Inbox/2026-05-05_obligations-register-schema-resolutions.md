# Obligations register — resolution of open engineering questions

**Authors:** Atlas (platform) and Mira (compliance)
**Date:** 2026-05-05
**For:** Marc and the engineering team

These are the joint resolutions to the six open questions raised in PAX's schema brief (`2026-05-05_obligations-register-schema.md`, §13). They are now binding for the implementation.

## 1. Storage — subdomain vs separate service

**Decision:** The obligations register is a **first-class subdomain inside the core platform**, not a separate service.

**Rationale:** The register is consumed on the hot path of every posting, control, contract execution, and regulatory return. Hosting it inside the platform means it inherits, by construction, every property the platform already provides under P1 and P4: event-sourced lineage, as-of replay, signed events, strong identity, mTLS, key-managed access, immutable audit log. Implementing it as a separate service would duplicate those properties and expose them to integration drift.

**Consequences:**
- Atlas hosts. Mira holds the curator role with `attest` and `supersede` privileges. Imani holds curator privileges scoped to contractual entries. Vera holds independent read-only access plus append-only finding-log privilege.
- The register exposes the API surface defined in §10 of the schema brief through the platform's standard API gateway with standard authn/authz.
- Changes to the register schema follow platform-evolution rules (event-versioning, additive changes, deprecation windows).

## 2. Provision text — canonical text vs pointer + extract

**Decision:** **Both.** Every `Provision` entry holds canonical text *and* a structured machine-readable extract, with a hash of the canonical text computed at attestation. A separate `source_location` field carries the regulator's published location with its own fetch hash and fetched-at timestamp.

**Rationale:** Two different jobs, two different artefacts. Canonical text is what we must prove we relied on if a regulator or court asks. The structured extract is what code dispatches on. Hashes give us tamper evidence on both.

**Constraint flagged:** Some standards (ISDA, FIX, FpML, ISO 20022 schema documents) are licensed and may not be redistributed verbatim. For these:
- Hold the structured extract.
- Hold the licensed-source pointer with hash.
- Mira manually attests canonical content from her licensed copy. The attestation event records the hash; the canonical text stays out of the register.

## 3. Multi-language

**Decision (day-one):** Every register entry carries a `language` field as a BCP 47 tag. SA entries are English (`en-ZA` where applicable). Translations, where they exist, attach as related-version entries with an explicit `is_translation_of` reference. The register **does not** auto-translate; the authoritative version is always the legislator's or counterparty's official version.

**Trigger:** First non-English jurisdictional activity (Principle 5 expansion). Mira and Imani revisit this rule before that activation. The expectation is that we will then designate one *authoritative* language per instrument and treat translations as advisory unless the instrument itself names a translation as authoritative.

## 4. Citation granularity in code

**Decision:** Every code citation is a **`(symbol, control_id)` pair**.

- `symbol` points to the function, class, or policy that enforces the obligation — stable across refactors as long as the symbol survives.
- `control_id` is a stable identifier owned by Vera's control inventory. The control inventory is itself a register entity (subset of `Policy`).
- Raw line numbers are forbidden — they rot at every commit.

**CI rule:** A `cite(...)` invocation without both fields fails to compile. The citation event is emitted at deploy time, not runtime — production code is fully cited before it ever serves a request.

## 5. Trust model for sources

**Decision (per source category):**

| Source category | Default acquisition | Attestation |
|---|---|---|
| Primary law (Acts of Parliament, gazetted regulations) | Manual fetch from official Government Gazette / SAFLII | **Manual** by Mira, with hash captured at attestation |
| Subsidiary regulation; regulator directives, standards, joint standards (PA, FSCA, FIC, SARS, Information Regulator) | **Scheduled fetch** from regulator's authoritative location, with hash | Cadence: quarterly, plus on change notification |
| Industry standards (BCBS, IFRS, IFRS XBRL, ISO, ISO 20022) | **Scheduled fetch** where the licence permits | Quarterly attestation by Mira |
| Licensed standards (ISDA, ICMA, ISLA, FIX, FpML) | Manual ingest of the structured extract; pointer to licensed source | **Manual** by Imani; canonical text out of register |
| Counterparty contracts | Created at execution by Imani | Hashed at execution; structured extract attested by Imani |
| Internal policy | Created on approval | Attested by the named approver per the signing matrix |

Every fetch — manual or scheduled — produces a `SourceFetch` event with the URL (or licensed-source identifier), bytes hash, and operator / service identity.

## 6. Backward citation invariants

**Decision:** **Hard CI failure** on production deploy if any cited URN resolves to a `superseded`, `repealed`, or `withdrawn` entry, *or* if the cited version differs from the version currently `in_force` for the URN.

**Override:** Only via a **registered exception**: a named approver, an expiry date, a review cadence. The exception is itself a register entry of type `Exception`, citing the obligation it excepts and the policy that justifies the deviation.

**Continuous test:** Vera's continuous controls monitoring asserts, at every cycle, that no production citation resolves to a non-`in_force` entry without an active matching exception. A failure is a sev-2 finding routed to Mira for repointing or to the named exception approver for review.

**Special case — historical re-runs:** When recomputing a return, control test, or report at a past as-of date, the *as-of-date version* of each cited URN is what counts, not the current `in_force` version. The CI rule applies only to forward-looking production code paths.

## 7. Implementation order

These resolutions imply a build order:

1. Atlas implements the register subdomain inside the platform (event types, lifecycle, API).
2. Mira begins seeding from the day-one corpus (separate deliverable: `2026-05-05_obligations-register-seed.md`).
3. Atlas wires the `cite()` mechanism into the build/deploy pipeline as a CI gate.
4. Vera's first continuous control is the citation-integrity test described in §6.

Item 1 is on Atlas's critical path and blocks items 2–4.
