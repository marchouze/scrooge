# Brief — Client master structure with continuous KYC

**Author:** Scrooge (relaying CEO directive)
**Date:** 2026-05-06
**For:** Mira (lead — KYC and obligations); Anya (lead — client master as projection); Imani (legal-entity structure)
**CC:** Atlas (events and platform), Senna (security boundaries on client data), Niko (onboarding hand-off)

## CEO directives

Marc has issued two related directives that are to be treated as load-bearing requirements of the platform.

### D1 — Client master structure

There must be a single client master structure where all client information is stored. It must:

- Be **integrated with the KYC function** such that all regulatory requirements for client onboarding are met **before** a client is added to the master.
- Support **hierarchies of clients** — group structures, subsidiaries, related parties.
- Support **beneficial-ownership structures** — natural-person UBOs, controlling-interest chains, indirect ownership.
- Support **all kinds of legal entities** — natural persons, companies, CCs, trusts, partnerships, sole proprietors, public benefit organisations, foreign equivalents, and their unfamiliar variants encountered as the bank grows.
- Support **multi-jurisdictional clients** — distinct registration jurisdiction, operating jurisdiction(s), tax-residence jurisdiction(s), and centre of main interests. A client registered in country A but operating in country B is the canonical case, not the edge case.

### D2 — Continuous KYC

KYC must operate in three modes simultaneously:

1. **Upfront** — completed before the client enters the master (gates D1).
2. **Recurring** — the periodic re-KYC required by law (FIC Act and FIC Guidance Note 7 RBA periodicity by risk band).
3. **Continuous** — re-evaluated on an ongoing basis from automatically-available signals (sanctions-list deltas, adverse-media events, transaction-pattern shifts, beneficial-ownership changes, registry changes, jurisdictional-status changes, document-expiry events, watchlist updates, behavioural anomalies surfaced by monitoring).

The recurring cycle does not satisfy the continuous cycle and vice versa. Both run in parallel; either may produce a status change.

## Required design properties

These directives must be implemented in line with the four architectural principles. The design that lands must satisfy *all* of the following:

**P1 — Events as source of truth.**
The client master is a **projection**, not authoritative state. Every client fact (name, address, status, risk rating, KYC status, beneficial-ownership edge, hierarchy edge, jurisdiction tag) is a typed event with as-of timestamp, source, and citation. The "client record at point in time T" is a query. Re-running a continuous-KYC rule retrospectively against the event stream is a first-class capability.

**P2 — Traceability.**
Every regulatory gate at onboarding, every periodic re-KYC trigger, every continuous-KYC rule, every risk-rating uplift, every blocking-status change links to an entry in Mira's obligations register — FIC Act sections, FIC Guidance Note 7, FATF Recommendations, POPIA processing-purpose entries, FATCA/CRS classification rules, internal policy versions.

**P3 — Cloud-native, no manual.**
Document collection, ID verification, registry lookups (e.g. CIPC, foreign equivalents), sanctions-list ingestion, adverse-media ingestion, beneficial-ownership-registry ingestion, and continuous-KYC re-scoring run as automated pipelines. Human review is a typed actor in the workflow with a typed event, never a step "outside the system". Manual exceptions are tracked under P2.

**P4 — Security by design.**
Client master fields are classified and field-level encrypted. Read events on PII are themselves audited as events. Access is purpose-bound and POPIA-aligned. Senna sets the threat model on the client master and on every continuous-KYC ingestion source before it ships.

**P5 — Multi-everything.**
- **Legal-entity types** are extensible — a typed taxonomy curated by Imani; new types added as register entries, not code branches.
- **Jurisdictions** are first-class on every client: registration, operating, tax-residence, centre of main interests, regulator(s) of the entity itself, regulator(s) of its activities. A client carries multiple jurisdiction tags simultaneously, each with its own KYC requirement set dispatched from the register.
- **Currencies** of the client's expected activity are captured at onboarding and update on signal.
- **Hierarchies** cross borders without code branches; the model represents them as a graph.

## Ownership split

- **Mira** — leads. KYC pipeline (upfront, recurring, continuous), risk-rating engine, regulatory gating before master entry, register entries for every rule and gate, sanctions/PEP/adverse-media ingestion, registry-change ingestion. Owns the "is this client accepted, kept, exited" decision.
- **Anya** — leads the client master itself as a projection: schema, hierarchy graph, beneficial-ownership graph, multi-jurisdiction model, lineage, point-in-time queries, master-data contracts. Owns the "what is the client record at time T" answer.
- **Imani** — leads the legal-entity-type taxonomy and the contractual / constitutional documents that bind clients to the bank; co-owns the hierarchy semantics with Anya.
- **Atlas** — provides the event types, the registry-ingestion adaptors, and the workflow runtime for human-in-the-loop steps.
- **Senna** — threat-models the client master, the ingestion sources, and the access patterns; sets encryption and access-audit requirements.
- **Niko** — owns the onboarding UX up to the gate; hand-off to Mira's KYC pipeline is event-driven.

## Deliverables to Marc (Owner Inbox)

A single design document covering both D1 and D2, structured as:

1. Event types underpinning the client master (Atlas + Mira + Imani).
2. Client-master projection schema, including hierarchy and beneficial-ownership graph models (Anya).
3. Legal-entity-type taxonomy v1 with extension procedure (Imani).
4. Multi-jurisdiction model — the four jurisdiction roles, how they combine into KYC requirement dispatch (Mira + Imani).
5. KYC pipeline — upfront, recurring, continuous — including signal sources, rule engine, and re-scoring semantics (Mira).
6. Obligations-register entries created or modified by this design (Mira).
7. Threat model and access-control design (Senna).
8. Reconciliation and as-of-replay design — including how a retrospective rule change re-evaluates history (Anya + Mira).

Target: first cut to Owner Inbox within the week. Mira coordinates; Scrooge tracks.

## CEO decisions (2026-05-06)

1. **Geographic perimeter — primarily South African.** The bank's own customer base is, on day one, primarily South African. Multi-jurisdiction work in this design is therefore principally for *clients with foreign exposure* (foreign registration, foreign operating jurisdiction, foreign tax residence, foreign UBOs), not for non-SA-resident customers as a primary segment. P5 still applies — the model must be plural by construction; it just isn't being exercised by a globally-distributed customer base on day one. Register this as a scope decision, not a permanent constraint.
2. **Continuous-KYC signal sources — non-paid first.** Mira designs the continuous-KYC pipeline against open and free sources first (sanctions lists from UN, OFAC, EU, UK HMT, DTI; PEP and adverse-media via open sources; CIPC and equivalent open registries; document-expiry and behavioural anomalies from internal events). Paid-data integrations (LSEG World-Check, Moody's BvD, Sayari, ComplyAdvantage) are deferred — but the pipeline must be source-pluggable so paid sources can be added later as register-linked sources without re-architecture.
3. **Restrict-immediately vs restrict-on-review — deferred to the CRO and the Risk Appetite Statement.** Mira drafts both options as designed, but the *default behaviour* is set by the Risk Appetite Statement and Framework, not by this brief. See follow-up below.

## Follow-up actions arising

- **Rohan (CRO function for the virtual bank)** — draft the Risk Appetite Statement and Framework. This is now on the critical path for finalising the continuous-KYC default behaviour and for several other design defaults yet to surface. Separate brief raised: `Team Inbox/2026-05-06_brief_risk-appetite-statement-and-framework.md`.
- **Mira** — design both restriction options (immediate vs on-review) so they are ready to be selected once the RAS lands. Do not block the rest of the design.
- **Anya** — proceed with the client master as specified; the geographic-perimeter answer does not change the model, only the volume profile.
- **Mira** — record the three CEO decisions as register entries (scope decision, signal-source policy, deferral to RAS) with citation to this brief.
