---
title: Core platform architecture — initial design
author: Atlas
date: 2026-05-05
summary: v0.1 spine document for the core platform. Superseded — D-EVENT-STORE-SCALING + D-RMS-PHASE-1 + D-DATA-PROVENANCE-SUBSTRATE + D-AGENT-RUNTIME-AUTHORIZE materially update the architecture set here.
decision-required: false
superseded-by:
  - decision-id: D-EVENT-STORE-SCALING
    decision-date: 2026-05-10
    note: "Event-store substrate (snapshot substrate, runtime-cache split, cache-from-commit-graph slices) supersedes the v0.1 event-store framing here."
  - decision-id: D-RMS-PHASE-1
    decision-date: 2026-05-09
    note: "Records Management Substrate Phase 1 (BLAKE3 doc store + 7 typed events + 7 projection registers) sets the records architecture today."
  - decision-id: D-DATA-PROVENANCE-SUBSTRATE
    decision-date: 2026-05-10
    note: "Provenance substrate sets citation + attestation primitives at platform layer, beyond this v0.1."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Core platform architecture — initial design

**Author:** Atlas
**Date:** 2026-05-05
**For:** Marc, with consumers across the team

This is the spine document. Every other engineer's work integrates with what is described here. It is deliberately a v0.1 — most decisions are made, a small number are flagged for Marc.

## 1. Purpose and scope

The core platform is the substrate of the bank. It owns:

- The **event store** — the single durable artefact of the bank.
- The **projection engine** — the means by which every aggregate (balances, positions, exposures, trial balances, BA-return cells) is computed.
- The **obligations register** as a first-class subdomain (per the resolutions deliverable).
- **Identity**, authentication, and authorisation for humans, services, and counterparties.
- **Key management** via managed cloud HSM.
- **Eventing** — the durable, ordered backbone every consumer subscribes to.
- The **API gateway** and contract-versioning machinery.
- **Observability** — tracing, metrics, structured logs, audit logs as first-class outputs.
- **Multi-region resilience** and disaster recovery posture.
- The **deploy and CI/CD pipeline**, including the citation CI gate.

The platform does **not** own application-domain logic — accounting rules, trading flows, risk methodology, payments scheme integration, contract templates. Those are the domain engineers' work. The platform exposes the primitives.

## 2. Architectural principles applied

The five principles from `CLAUDE.md` are realised at the platform layer as follows.

- **P1 (Events as truth):** the platform exposes no authoritative aggregate. Reads are projections, computed on demand or cached with the event log as authority. As-of replay is a first-class API.
- **P2 (Traceability):** every event type carries a citation slot. Every API contract carries an obligation reference. The register is hosted here and exposed as a platform service.
- **P3 (Cloud-native, no manual):** infrastructure is IaC-defined. Operator access is just-in-time, event-recorded, and short-lived. No persistent SSH or RDP. Cryptographic keys live in managed cloud HSM (FIPS 140-2/3 Level 3).
- **P4 (Security by design):** zero-trust mTLS, signed events, signed builds, per-field encryption for classified data, immutable audit logs, threat models attached to every component.
- **P5 (Multi-everything):** every event is typed by `currency`, `legal_entity`, and `jurisdiction`. Calendars, time zones, and FX rates are platform services. Reporting-currency translation is a parameterised query.

## 3. High-level architecture

```
        ┌────────────────────────────────────────────────────────┐
        │                  Domain engineers                      │
        │  Bea · Mira · Kai · Rohan · Tomas · Imani · Sade ·     │
        │  Niko · Yael · Vera                                    │
        └─────────┬──────────────────┬──────────────────┬────────┘
                  │ API              │ Event sub        │ Register
                  ▼                  ▼                  ▼
        ┌──────────────────────────────────────────────────────┐
        │                 Platform API gateway                 │
        │  (mTLS, authn, authz, citation enforcement, rate)    │
        └─────────┬─────────────────┬─────────────────┬────────┘
                  │                 │                 │
                  ▼                 ▼                 ▼
            ┌──────────┐      ┌──────────┐     ┌────────────┐
            │ Command  │      │  Query   │     │ Obligations│
            │ services │─────▶│  engine  │     │  register  │
            └────┬─────┘      └────┬─────┘     └─────┬──────┘
                 │ append          │ project          │
                 ▼                 │                  │
            ┌──────────────────────┴─────┐            │
            │       Event store          │◀───────────┘
            │   (append-only, signed)    │   register events
            └────────────┬───────────────┘
                         │ stream
                         ▼
              ┌──────────────────────┐
              │ Projection engine    │
              │ (materialised views) │
              └──────────────────────┘
```

## 4. Event store design

- **Append-only**, ordered per stream, globally orderable via Lamport-style sequencing.
- **Signed events.** Every event carries a producer signature; a chained hash links it to the prior event in the stream. Tampering is detectable.
- **Schema-versioned.** Event types use additive schema evolution; breaking changes get a new event type, never a mutated one.
- **Retention: indefinite.** The bank's history is not deleted. POPIA right-to-erasure is implemented via crypto-shredding of personal-data fields, not event deletion.
- **Per-event citation slot.** Required for every event in production, enforced at write time.
- **Per-event multi-everything tags.** `currency`, `legal_entity`, `jurisdiction` are required where semantically applicable; the schema marks which are required per type.

## 5. Projection engine

- **Materialised projections** are caches, not authority.
- **As-of replay** is the canonical operation. Every projection is reproducible at any past moment by replaying events up to that timestamp.
- **Projections are typed and named.** Each carries the event types it depends on; rebuilds are automatic on schema or definition change.
- **Two reads modes:**
  - *Live* — current best-effort projection with lag SLO (target: <5s for hot projections).
  - *As-of* — deterministic replay to a stated timestamp.
- **No write-through projections.** Writes go to the event store; projections catch up.

## 6. Identity, authentication, authorisation

- **Subjects:** humans, services, counterparties, external systems — all typed identities.
- **Authn:** WebAuthn / FIDO2 for humans by default; mTLS with short-lived workload identities for services; signed-message authentication for counterparties.
- **Authz:** policy-as-code. Every API call evaluates against an explicit policy. Policies are register-cited (P2).
- **Just-in-time access:** elevated operator access is request-approve-record-expire; defaults are revoked.
- **Every read of classified data is itself an event** for audit purposes.

## 7. Key management and HSM

- All cryptographic key material lives in **managed cloud HSM** at FIPS 140-2/3 Level 3.
- Private keys never leave the HSM. Signing and decryption happen inside.
- Per-tenant, per-purpose key segregation (event-signing, document-signing, payment-signing, register-attestation).
- Key rotation is automated, scheduled, and event-recorded.
- HSM is multi-region with cross-region replication of key handles, not key material.

## 8. Obligations register hosting

The register lives inside the platform per the joint resolution. Its data shape and API are defined in the schema brief. Implementation notes:

- The register's events flow through the same event store as all other events.
- Register reads are unauthenticated for metadata, authenticated for canonical text where licensing requires.
- The `cite()` mechanism is wired into the CI/CD pipeline: code that references a URN gets compile-time validation against the register's current `in_force` set.
- Mira holds curator privileges; Imani holds curator privileges scoped to contractual entries; Vera holds independent read and append-only finding-log writes.

## 9. API surface

- **Synchronous APIs** — REST + gRPC, contract-first, OpenAPI / Protobuf.
- **Asynchronous APIs** — event subscriptions, durable consumer groups, replay support.
- **Versioning** — additive evolution; breaking changes get a new path or topic with a deprecation window.
- **Citation enforcement** — every endpoint registers its obligation citation; calls to unregistered endpoints are rejected.

## 10. Multi-region resilience

- **Active-active** across two regions in the cloud vendor's South Africa footprint, with a third region (in-region or cross-region) for disaster recovery and audit-log replication.
- **RPO target: zero data loss** for committed events (synchronous replication for the event store).
- **RTO target: under 15 minutes** for full service in a region failure.
- **Chaos engineering** is part of the deploy posture from week one — not a future initiative.

## 11. Observability and audit logs

- **Tracing** end-to-end across all services; every event carries trace context.
- **Metrics** at every layer; SLO-driven alerting.
- **Structured logs**; no free-text severity-by-grep.
- **Audit logs** are append-only, signed, and retained indefinitely. They are an output of the event store, not a sidecar.
- **Vera's continuous controls monitoring** runs against this surface directly.

## 12. Cloud platform — decision pending Marc

The architecture is cloud-vendor-neutral by design, but a vendor must be chosen. Three serious candidates:

| Vendor | SA region | Notes |
|---|---|---|
| AWS | `af-south-1` (Cape Town) | Largest SA financial-services footprint; broadest managed services; strong CloudHSM offering |
| Microsoft Azure | South Africa North (Johannesburg), South Africa West (Cape Town) | Two SA regions enables in-country active-active; strong identity stack |
| Google Cloud | `africa-south1` (Johannesburg) | Single SA region today; strong data tooling; thinner SA financial-services precedent |

**Selection criteria:**
- Two in-country regions (or a credible plan for the second) for P5 / P3 alignment with SARB Directive 3 of 2018.
- Managed HSM at FIPS 140-2/3 Level 3.
- Demonstrable SARB PA engagement with other SA banks on the platform.
- Pricing and lock-in posture.
- Talent availability.

**Atlas's recommendation, subject to Marc:** Microsoft Azure, primarily for the in-country two-region active-active posture and the SARB PA engagement track record at SA banks. AWS is a close second.

## 13. Threat model summary

Top-level threats addressed by design (not exhaustive):

- **Insider abuse** — separation of duties enforced in code; every privileged action is registered, signed, and reviewable; auditors hold independent read.
- **Supply-chain compromise** — signed builds, reproducible builds, dependency provenance, SBOM-tracked, SLSA-aligned.
- **Credential theft** — short-lived workload identity, no long-lived secrets in code or operators.
- **Tampering** — chained-hash event log, HSM-backed signatures, immutable audit log.
- **Data exfiltration** — per-field encryption, read-event auditing, egress controls per-region.
- **Regulator exposure (loss of evidence)** — events are the evidence, retained indefinitely, replayable as-of any past moment.

A full STRIDE-per-component threat model accompanies each subsystem design and is required for every new event type.

## 14. Performance budgets (initial)

| Surface | Target |
|---|---|
| Event append latency (p99) | < 50 ms within region |
| Hot projection lag (p99) | < 5 s |
| As-of replay throughput | 50k events/s per consumer |
| Register `resolve()` (p99) | < 20 ms cached, < 200 ms uncached |
| API gateway request budget (p99) | < 200 ms excluding downstream |

These are starting numbers. Each domain engineer can negotiate tighter or looser budgets per use case at integration time.

## 15. Out of scope

- All application-domain logic (handled by the eleven domain hires).
- The bank's licensing strategy and entity formation (Marc's domain).
- Office IT and end-user device management (a future hire if needed).

## 16. Open items for Marc

1. **Cloud vendor selection** — Atlas recommends Azure; awaiting Marc's call.
2. **Identity provider for human authn** — first-party (own WebAuthn) vs managed (Entra, Okta, Auth0). Atlas recommends first-party WebAuthn-backed identity to avoid third-party-IdP risk on the bank's own staff; flag for Marc.
3. **External-auditor access posture** — read-only via the standard API surface, or an isolated read-only mirror? Atlas recommends standard surface with auditor-scoped identity; flag for Marc.
4. **Source-code repository host** — managed (GitHub / GitLab) vs self-hosted on the chosen cloud. Atlas recommends GitHub Enterprise on the chosen cloud's network with SSO, scoped tokens, and signed commits; flag for Marc.
