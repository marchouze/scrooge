---
title: Local prototype — plan
author: Atlas
date: 2026-05-05
summary: Initial local-prototype plan. Superseded — the substrate now spans M1+ markets, RMS, provenance, agent-runtime, scenario clock, and the prototype is well past the v0.1 plan here.
decision-required: false
superseded-by:
  - decision-id: D-EVENT-STORE-SCALING
    decision-date: 2026-05-10
    note: "Event-store substrate scaling is the current governing decision; the local-prototype plan here is overtaken."
  - decision-id: D-RMS-PHASE-1
    decision-date: 2026-05-09
    note: "Records substrate sets the document-store + register shape today, beyond the prototype plan here."
  - decision-id: D-DATA-PROVENANCE-SUBSTRATE
    decision-date: 2026-05-10
    note: "Provenance substrate sets the citation / attestation shape; the plan here pre-dates it."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Local prototype — plan

**Author:** Atlas
**Date:** 2026-05-05
**For:** Marc

A single-laptop, zero-cloud, zero-spend prototype that demonstrates the bank end-to-end. Architecturally honest with the production design, so the lift to cloud later is configuration, not rewrite.

## 1. Goals

The prototype must convince three audiences:

- **Marc** — that the design works and the team can build it.
- **A regulator-style reader** — that every action carries citations, every figure is reproducible, and the audit posture is real.
- **A future co-founder, investor, or hire** — that this is not a slide deck but a running system.

Concretely it must demonstrate:

1. Event sourcing as the only source of truth (Principle 1).
2. The obligations register and citation enforcement (Principle 2).
3. Cloud-native shape, even though it runs locally (Principle 3).
4. Security primitives — signed events, identity, mTLS-shape, audit logs (Principle 4).
5. Multi-currency, multi-entity, multi-jurisdiction at the type level (Principle 5).
6. A credible end-to-end vertical: customer → account → posting → BA return.
7. A credible trading vertical: order → execution → position → risk.
8. A credible payments vertical: instruction → screening → settlement → reconciliation.
9. A credible reporting vertical: trial balance, BA100 cash line, VAT 201, IFRS 9 ECL stub.
10. A continuous-controls-monitoring demo from Vera asserting citation integrity.

## 2. Constraints

- Runs on one laptop. No cloud, no managed services, no paid licences.
- Reproducible from a clean clone in under 60 seconds.
- All data is synthetic and clearly labelled `SIMULATED`.
- No real customer data, no real money, no real network calls to live regulators or markets.
- Architectural shape matches the production design — same event-store API, same register, same projection contract; only the implementations are local.

## 3. Tech stack

| Choice | Rationale |
|---|---|
| **Bun** runtime | Single binary; ships TypeScript runtime, SQLite, test runner, package manager. Minimum-dependency surface. |
| **TypeScript strict** | Best fit for the structured-data, contract-heavy nature of the platform. Branded types let us encode `Currency`, `LegalEntity`, `Jurisdiction` at the type level. |
| **SQLite** (via Bun's built-in driver) | Append-only events table is trivial; zero install. Production swaps to a managed event store with the same API. |
| **Biome** | Lint + format in one tool, fast. |
| **Vitest** (or Bun's built-in test) | Standard test runner; the choice is whichever reads cleaner. |
| **Zod** | Runtime schema validation at event boundaries. |
| **Drizzle** (lightweight) | Typed SQL where helpful; raw SQL where clearer. |
| **Pino** | Structured logging. |
| **Software-only crypto** (Web Crypto API) | Same call-shape as cloud HSM; production swaps the implementation. |

All choices are reversible. None lock us in.

## 4. Repo layout

A monorepo under `prototype/`, leaving the existing folders (`Team/`, `Team Inbox/`, `Owner Inbox/`) untouched.

```
/Users/marc/code/Bank/
├── CLAUDE.md
├── Team/
├── Team Inbox/
├── Owner Inbox/
└── prototype/
    ├── README.md
    ├── package.json
    ├── tsconfig.json
    ├── biome.json
    │
    ├── platform/
    │   ├── events/         event store (append-only, signed, chained hash)
    │   ├── projections/    projection engine, as-of replay
    │   ├── identity/       subjects, authn, authz, policy-as-code
    │   ├── keys/           HSM-shaped key service (software-backed)
    │   ├── register/       obligations register subdomain
    │   ├── citation/       cite() macro + CI gate
    │   ├── eventing/       subscribe, replay, durable consumers
    │   ├── api/            gateway, contracts, versioning
    │   ├── types/          Currency, LegalEntity, Jurisdiction, Money, Calendar, FxRate
    │   └── observability/  structured logs, traces, audit log
    │
    ├── domains/
    │   ├── accounting/     Bea
    │   ├── compliance/     Mira
    │   ├── trading/        Kai
    │   ├── risk/           Rohan
    │   ├── operations/     Tomas
    │   ├── legal/          Imani
    │   ├── hr/             Sade
    │   ├── sales/          Niko
    │   ├── tax/            Yael
    │   └── audit/          Vera
    │
    ├── simulators/
    │   ├── jse/            mock exchange + FIX session
    │   ├── samos/          mock SARB RTGS messages
    │   ├── bankserv/       mock RTC, PayShap, EFT
    │   ├── swift/          mock SWIFT MT/MX
    │   ├── strate/         mock CSD settlement
    │   ├── sars/           mock SARS eFiling endpoints
    │   ├── fic/            mock FIC submission endpoint
    │   └── market-data/    mock price ticks for FX, equities, bonds
    │
    ├── scenarios/          end-to-end demo scripts
    ├── seeds/              register seed data, reference data, calendars, holidays
    └── tests/              cross-domain integration tests
```

Each domain folder is owned by the corresponding hire's mandate. Shared types and platform primitives live in `platform/`. External world is mocked entirely in `simulators/`.

## 5. Milestones

### M1 — Platform skeleton (target: 2 weeks of focused work)

Atlas's milestone alone.

- Event store: append, read, chain-hash verify, signed events.
- Event types: schema-versioned, additive evolution.
- Projection engine: rebuild from scratch, incremental tailing, as-of replay to any timestamp.
- Identity: subject types, mock authn, policy-as-code authz.
- Key service: HSM-shaped API, software-backed.
- Obligations register subdomain: CRUD on `Source`, `Instrument`, `Provision`, `Policy`, `Obligation`, `Exception`, `Citation`. Lifecycle states. URN resolver.
- `cite()` mechanism: macro/decorator + a `prebuild` step that fails the build if any citation references a non-`in_force` URN.
- Multi-everything types: `Money<Currency>`, `LegalEntity`, `Jurisdiction`, `Calendar`, `FxRate(rate_source, as_of)`.
- Logging, tracing, audit log.

**Acceptance:** an integration test appends a thousand events of mixed types, projects three different views, replays any view at any past timestamp, fails the build when a citation goes stale, and demonstrates that the audit log is tamper-evident.

### M2 — Customer + accounting + compliance vertical (target: 2 weeks)

Atlas + Bea + Mira + Imani.

- Customer master events: natural and juristic person; beneficial-ownership graph.
- KYC onboarding flow with FIC s21 citations; sanctions screening (mocked list); risk rating.
- Account opening; chart of accounts; first postings.
- Trial balance as a projection.
- BA100 cash-line cell as a query, with citation to the BA-return obligation.
- Customer agreement issued and stored as a structured `Contract` event with an Imani-curated template.

**Acceptance:** onboard a simulated client, open an account, deposit funds, withdraw funds, generate a trial balance, generate the BA100 cash line, and prove every step cites a register entry.

### M3 — Trading + risk vertical (target: 2 weeks)

Kai + Rohan.

- One asset class: FX spot ZAR/USD with mocked market data.
- Order capture, pre-trade risk gateway, execution event, allocation.
- Position projection.
- Real-time P&L.
- Historical-method VaR over the position.
- IFRS 9 ECL stub on a small loan portfolio (synthetic).
- Surveillance feed for Mira (suspicious order pattern detection).

**Acceptance:** book ten trades, compute the position and P&L live, compute a 1-day historical VaR, generate an ECL stage allocation, and surface one surveillance alert.

### M4 — Payments + tax vertical (target: 2 weeks)

Tomas + Yael.

- Simulated SAMOS ISO 20022 message issuance.
- Simulated PayShap payment with sanctions screening at message construction.
- Nostro reconciliation against a simulated counterparty statement.
- VAT 201 produced from the trial balance with a documented apportionment method.
- Dividends-tax declaration on a synthetic distribution.
- STT computation on a securities transfer.

**Acceptance:** issue a SAMOS message, settle a PayShap payment, reconcile the nostro, generate a VAT 201 in test format, and compute STT on a sample transfer.

### M5 — Audit + integration demo (target: 1 week)

Vera + Atlas.

- Vera's continuous controls monitoring asserts:
  - No production code path cites a non-`in_force` URN.
  - Every event has a valid citation slot populated.
  - No authoritative aggregates exist outside projections.
  - The audit log is tamper-evident and auditor-readable.
- A 5-minute demo script that walks the bank end-to-end: client onboarding → account open → trade → settlement → trial balance → BA100 → VAT 201 → CCM report.

**Acceptance:** the demo runs in one command and produces a clean report.

Total: roughly 9 weeks of focused work for a credible end-to-end prototype. Real-world calendar with interruptions: 3-4 months.

## 6. What the prototype does *not* attempt

- HSM with real FIPS-validated hardware (software keys with same API).
- Multi-region replication (single-process simulated).
- High-throughput performance (correctness over speed).
- Production-grade UI (CLI demos plus a thin web inspector).
- Real exchange/scheme connectivity.
- Real regulator submissions.
- Real money.
- A complete IFRS 9 ECL methodology (a stub is enough to prove the shape).
- A complete FRTB market-risk model (historical VaR is enough to prove the shape).
- Full BA-return suite (one cell on BA100 is enough to prove the shape).

The pattern: **one credible instance of each vertical, not a complete implementation**. The architecture has to be honest; the breadth comes later.

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep — wanting a "real" implementation | Each milestone has a hard "one credible instance" rule. Explicitly defer breadth. |
| Architectural drift between prototype and production design | Every prototype subsystem matches the documented production API shape. The lift to cloud is implementation swap, not redesign. |
| The team (the personas) producing inconsistent style/quality | Atlas reviews every domain integration before it lands; one shared type system; one shared event-store contract. |
| Citation discipline rotting under deadline pressure | The CI gate is non-bypassable from M1. There is no "we'll add citations later" path. |
| Demo polish stealing engineering time | Demo polish is M5, not earlier. The demo is a 5-minute CLI walk-through, not a UI build. |

## 8. Open items for Marc

These do not block M1 but should be settled before M2.

1. **Languages of record** — Atlas recommends TypeScript end-to-end for the prototype, with the option of dropping to Rust or Python for a specific hot computation in M3 if needed. Confirm or override.
2. **Repo hosting** — local git only, or push to a private GitHub repo for backup? Atlas recommends a private GitHub repo with signed commits.
3. **Demo audience** — is the prototype intended only for Marc to validate the design, or also for early conversations (regulator pre-engagement, co-founder, investor)? The latter raises the bar on the M5 demo.
4. **Naming** — does the bank have a working name yet, or should everything say `Bank` for now? The register and event types name the entity at the type level (`oblig:source:internal:bank-name`), so a placeholder is fine and renames are cheap.

## 9. Recommended first action

Atlas starts M1 as soon as Marc confirms this plan and answers item 1 (language) and item 2 (repo hosting). Items 3 and 4 can land later.

Once M1 is done, the rest of the team is unblocked and the milestones run partly in parallel: M2 (Bea/Mira/Imani) and M3 (Kai/Rohan) can overlap; M4 (Tomas/Yael) starts when M2 has produced postings to settle and tax against; M5 ties everything together.
