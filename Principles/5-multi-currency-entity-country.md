# Principle 5 — Multi-currency, multi-entity, multi-country from day one

Single-currency, single-entity, single-jurisdiction shortcuts are forbidden, even when only one of each exists at the start.

- **Currency** — every monetary value carries its currency at the type level. FX conversions are explicit events with a rate source, rate timestamp, and citation. There is no default currency anywhere.
- **Entity** — every event, account, position, and contract belongs to a specific legal entity in a versioned legal-entity tree. Inter-entity flows are explicit events with consideration and arm's-length pricing.
- **Country / jurisdiction** — every customer, account, transaction, contract, and tax computation carries jurisdictional context. Regulatory and tax logic dispatches on jurisdiction. Cross-border flows are first-class.
- **Reporting currency** is a presentation choice, not a data property. Translation runs as a query with explicit rate-source and as-of date (IAS 21 alignment).
- **Calendars and timezones** — every date carries its calendar (jurisdictional holidays) and every timestamp is UTC internally, rendered to local time. Cut-offs and accruals are jurisdictional.
- The bank starts in South Africa with one entity. Every system is nonetheless built as if jurisdictions and entities were already plural — adding the second of any of them must be a configuration change, not a project.
- New jurisdictions, regulators, currencies, and tax regimes enter the system as register entries (Principle 2), not as code branches.
