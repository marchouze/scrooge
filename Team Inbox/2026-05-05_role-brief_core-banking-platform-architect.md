# Role brief — Core banking platform architect

**Author:** PAX
**Date:** 2026-05-05
**For:** Nolan

## 1. Role title and one-line purpose

**Core banking platform architect** — owns the foundational platform on which every other banking function is built: customer, account, ledger, identity, eventing, and APIs.

## 2. Why this role exists

Every other engineer on this team will build on top of a shared core: a single source of truth for customers, accounts, balances, postings, and events. If that core is wrong, everything downstream — accounting, trading, risk, compliance, ops — inherits the defect. This role designs and owns it.

This is the first technical hire because nothing else can be built without it.

## 3. Scope of work (priority order)

1. Customer master and legal entity model — natural persons, juristic persons, trusts, partnerships, with full beneficial-ownership graph.
2. Account model and chart of accounts — hierarchical, multi-currency, multi-entity, with sub-ledgers that reconcile to the GL by construction.
3. Double-entry ledger — immutable, event-sourced, replayable, reconciled continuously.
4. Identity, authentication, and authorisation — staff, customers, machines, with full audit trail.
5. Event backbone — durable, ordered, replayable; the spine that every other team consumes from.
6. Internal and external API surface — versioned, contract-tested, with policy enforcement at the edge.
7. Data lineage and time-travel — every value must be reproducible at any point in time for audit and regulatory enquiry.
8. Disaster recovery, business continuity, and resilience standards.

## 4. Required expertise

- Distributed systems and event-driven architecture (event sourcing, CQRS, idempotent processing).
- Double-entry bookkeeping and ledger design at scale.
- Strong consistency vs eventual consistency trade-offs in financial contexts.
- API design (REST, gRPC, async eventing) with contract-first discipline.
- Observability: tracing, metrics, structured logs, audit logs as first-class outputs.
- Cloud-native infrastructure and IaC.

## 5. Desirable expertise

- Prior experience on a core banking platform (Thought Machine Vault, Mambu, 10x, Temenos, Finacle, or in-house equivalents).
- Familiarity with ISO 20022 data model.
- Cryptographic key management and HSM integration.

## 6. Regulatory / certification requirements

- Familiarity with SARB Prudential Authority outsourcing and cloud directives, particularly Directive 3 of 2018 on cloud computing and offshoring of data.
- POPIA — system design must support data-subject rights (access, correction, deletion) by construction.
- BCBS 239 — risk-data aggregation and reporting principles.
- Banks Act 94 of 1990 — record-keeping obligations.

## 7. Interfaces

- **Accounting engineer** — consumes the GL and sub-ledgers.
- **Compliance engineer** — consumes customer and account events for KYC, screening, and monitoring.
- **Risk engineer** — consumes positions, balances, and exposures.
- **Operations engineer** — consumes payment instructions and settlement events.
- **Internal audit engineer** — consumes immutable audit logs.
- All other engineers — consume APIs and events.

## 8. Success criteria — first 90 days

- A documented platform architecture with explicit consistency, durability, and recovery guarantees.
- A working customer + account + ledger reference implementation with at least one end-to-end posting flow.
- Event contracts published for the first three downstream consumers.
- A documented record-keeping and time-travel approach that satisfies both Banks Act and POPIA in the same design.
- Zero ambiguity for downstream hires about how to integrate.

## 9. Principle alignment

**P1 — Events as source of truth.** This role *owns* the event store and the projection engine. The platform exposes no authoritative aggregate; every balance, position, and status read by a downstream system is a projection over the event log, computed on demand or cached with the event log as authority. Time-travel and as-of replay are core API features, not extensions.

**P2 — Traceability.** Every event type carries a citation slot. Every API contract links to the obligation it serves. The platform exposes the obligations register as a first-class service so all other engineers can resolve and depend on it.

**P3 — Cloud-native, no manual.** Event store, projection engine, API gateway, identity, and key management are all IaC-defined and run on managed cloud services. Multi-region active-active is a deployment configuration. Cryptographic key material is held in managed cloud HSMs (FIPS 140-2/3 Level 3). Operator access is just-in-time and event-recorded; there are no persistent credentials.

**P4 — Security by design.** Zero-trust service-to-service mTLS, per-event lineage and integrity, signed and reproducible builds, threat models attached to every API design. Field-level encryption for sensitive data is a platform primitive, not an application concern.

**P5 — Multi-everything.** Every event, account, and aggregate is typed by currency, legal entity, and jurisdiction. Calendars, timezones, and FX-rate sources are platform services. Reporting-currency translation is a parameterised query, never stored. Adding a second entity, currency, or jurisdiction is configuration, not engineering work.

## 10. Sources consulted

- South African Reserve Bank — Prudential Authority directives, particularly D3/2018 (cloud and offshoring).
- Banks Act 94 of 1990, sections on record-keeping.
- Protection of Personal Information Act 4 of 2013 (POPIA).
- BCBS 239 — Principles for effective risk data aggregation and risk reporting.
- BIAN (Banking Industry Architecture Network) service domain reference model — industry-standard decomposition of banking capabilities.
- ISO 20022 standard — data model alignment for downstream payments interop.

**Note:** I have cited source names, not deep URLs, to avoid stale links. Nolan can pull current versions from `resbank.co.za`, `fsca.co.za`, and `iso20022.org` directly.
