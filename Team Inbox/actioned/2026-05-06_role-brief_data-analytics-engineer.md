# Role brief — Data / analytics engineer

**Author:** PAX
**Date:** 2026-05-06
**For:** Nolan

## 1. Role title and one-line purpose

**Data / analytics engineer** — owns every projection over the event log: regulatory data marts, MI, customer analytics, master-data services, and the query semantics by which any quantity in the bank is computed.

## 2. Why this role exists

Principle 1 makes the event log the only source of truth; everything else is a query. That elevates "querying" from a back-office concern to the bank's central computational discipline. Without a dedicated owner, projections proliferate inconsistently across domains, regulatory returns disagree with MI, master data drifts, and the as-of-replay guarantee silently breaks. This role owns projections, semantic layers, master-data services, and the data contracts that connect domains.

## 3. Scope of work (priority order)

1. **Projection framework.** A single, audited projection runtime — deterministic, replayable, idempotent — over which every domain (accounting, risk, treasury, compliance, ops, tax, MI) computes. As-of replay is a first-class capability.
2. **Master data services.** Client master, product master, instrument master, legal-entity master, calendar/holiday master, currency and rate master. Each is a projection with explicit lineage and versioning; each integrates with its owning domain (e.g., client master with Mira's KYC, legal-entity master with Imani).
3. **Semantic layer.** A single, citable definition of every "named quantity" — balance, exposure, P&L, RWA, ECL, LCR cell, BA-return cell, MI metric. Defined once, consumed everywhere.
4. **Regulatory and management data marts.** BA returns, IFRS reporting, FATCA/CRS XML, MI dashboards — all expressed as projections with register-linked definitions. No manual spreadsheets.
5. **Customer analytics and experimentation.** Behavioural analytics, segmentation, churn / LTV / NPS pipelines, A/B experimentation, fairness testing — built on POPIA-compliant minimised datasets.
6. **Data contracts.** Schemas, evolution rules, consumer compatibility tests; every event type and every projection is contract-governed.
7. **Data quality.** Continuous assertions, anomaly detection on projections, reconciliation harnesses (e.g., GL trial balance ↔ event-derived balance ↔ sub-ledger projection — must always reconcile to zero).
8. **ML / AI infrastructure.** Feature store as projections; model registry; offline-online parity; bias and explainability tooling — supporting Mira's monitoring, Rohan's risk, and customer-facing scoring.

## 4. Required expertise

- Event-sourced systems and CQRS in production — projection design, idempotency, exactly-once semantics, replay.
- Data contracts and schema evolution at scale (Avro/Protobuf or equivalent).
- Modern lakehouse / streaming patterns — Iceberg or Delta, Kafka or equivalent, columnar query engines, point-in-time semantics.
- Master data management at financial-services scale — client, product, instrument, legal entity, hierarchy modelling.
- Semantic layers — dbt, Cube, MetricFlow, or equivalent — used as references; built-to-purpose acceptable.
- Regulatory data: BA-return computation, IFRS sub-ledger interfaces, FATCA/CRS XML.
- POPIA-by-design data pipelines: minimisation, purpose binding, retention, masking, lineage.
- ML platform engineering: feature stores, model registries, offline/online parity, monitoring.

## 5. Desirable expertise

- BCBS 239 implementation experience.
- Hands-on with SARB BA-return submission stacks (banks' DI-system equivalents).
- ZARONIA / multi-curve master-data design.
- Privacy-enhancing technologies — differential privacy, secure enclaves, federated analytics.
- Graph databases for client-hierarchy and beneficial-ownership structures.

## 6. Regulatory / certification requirements

- BCBS 239 — Principles for Effective Risk Data Aggregation and Risk Reporting.
- POPIA 4 of 2013 — full working knowledge of sections 13 (purpose), 14 (retention), 15 (further processing), and 19 (security safeguards) as they apply to projections.
- Banks Act Regulations — BA-return data definitions and submission timing.
- IFRS 9 / IFRS 7 / IAS 1 disclosure data requirements.
- FATCA / CRS XML schemas and SARS Business Requirement Specifications.
- Practitioner credentials in modern data engineering (cloud certifications, data-engineering specialisations) preferred.

## 7. Interfaces

- **Core platform architect (Atlas)** — event-log producer; the projection runtime is platform-resident; data contracts are co-owned.
- **Compliance / RegTech engineer (Mira)** — KYC outcomes feed the client master; sanctions/PEP screening is a projection; STR/CTR XML is a regulatory mart.
- **Legal-as-code engineer (Imani)** — legal-entity master and contractual hierarchies; beneficial-ownership structures.
- **Accounting engineer (Bea)** — sub-ledger projections, BA-return reconciliations, IFRS disclosure marts.
- **Risk engineer (Rohan)** — feature store, ECL inputs, RWA datasets, IRRBB sensitivities.
- **Treasury engineer (Ravi)** — LCR/NSFR projections, FTP attribution, ALCO MI.
- **Tax engineer (Yael)** — VAT FS-apportionment data, FATCA/CRS source data.
- **Internal audit engineer (Vera)** — continuous-controls evidence is itself a set of projections; lineage is the audit trail.
- **Security engineer (Senna)** — POPIA controls on data, access auditing, encryption-key boundaries on stores.

## 8. Success criteria — first 90 days

- A working projection runtime in the prototype with deterministic replay over a seeded event stream.
- Client master, legal-entity master, and currency master as v1 projections with documented lineage.
- A semantic layer defining "balance", "exposure", "P&L" (per IAS), and one BA-return line — each citing the obligations register.
- A reconciliation harness running in CI: GL trial balance ↔ event-derived balance must reconcile to zero before merge.
- A POPIA-compliant data-minimisation policy enforced as schema constraints.
- Documented data contracts for the first three domains live (accounting, compliance, risk).

## 9. Principle alignment

**P1 — Events as source of truth.** This is the role's defining principle. Every projection is reproducible; the runtime *is* P1's operational expression. No projection is permitted to drift from the events.

**P2 — Traceability.** Every named quantity in the semantic layer carries an obligations-register citation — IFRS standard, BCBS 239 principle, BA-return cell, internal definition. Definitions without citation do not ship.

**P3 — Cloud-native, no manual.** No spreadsheets in the regulatory or MI path. Submissions are coded; reconciliations are continuous; manual overrides are exceptions tracked under P2.

**P4 — Security by design.** Field-level encryption, purpose-bound access, access-audit projections, POPIA-aware retention. Read events on PII are themselves logged and queryable.

**P5 — Multi-everything.** Master data is multi-jurisdictional, multi-currency, multi-entity by construction. Hierarchies (client, legal entity, product) cross borders without code branches — the data model carries it.

## 10. Sources consulted

- BCBS 239 — Principles for Effective Risk Data Aggregation and Risk Reporting (2013).
- Information Regulator — POPIA guidance notes; codes of conduct for the financial sector.
- SARB Prudential Authority — Banks Act Regulations 2012, BA-return forms and notes.
- IASB — IFRS 9, IFRS 7, IAS 1, IAS 21 (presentation-currency translation).
- SARS — FATCA and CRS Business Requirement Specifications.
- DAMA-DMBOK 2 — master data management discipline.
- CNCF and OpenLineage — data-lineage and contract patterns.
