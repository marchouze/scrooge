# Local base infrastructure — specification

**Author:** Atlas (core banking platform architect — lead)
**Contributors:** Senna (security primitives), Devon (operating model & reproducibility), Anya (data substrate), Tomas (settlement-shape simulation), Vera (audit hooks)
**Date:** 2026-05-06
**For:** Marc (CEO)
**Status:** **Specification only — no build at this stage.** Build follows under Atlas + Senna + Devon, sequenced per Atlas's M-phase plan.

> **Derivation note (Principle 6).** This spec is at the policy / standard layer — it defines *how* the local environment is shaped so that the system capabilities the procedures reference can be built. It cites Atlas's prior `local-prototype-plan.md` and the cloud-target-Azure memory; it does not author new architectural substance independently of those.
>
> **Sequencing (CEO directive 2026-05-06):** **full local build first, migrate to Azure as a single coherent phase**. Local must be substantively production-grade in its logic; cloud lift is substrate replacement only.

---

## 1. Purpose

Specify the foundational local environment on which every system capability M1–M7 (per the reporting-capability spec) will be built. The environment must:

- **Run end-to-end on a laptop** (or a small set of laptops for collaborative dev / scenarios).
- **Boot with one command** from a clean clone, in under 60 seconds.
- **Mirror production discipline architecturally** — typed, signed, audited, reconcilable — so M8 cloud lift is configuration, not rewrite.
- **Be reproducible** across team members through devcontainer + version-pinned tooling.
- **Carry no real customer data**, no real money, no real network calls to live regulators or markets. Synthetic data is clearly labelled `SIMULATED`.
- **Honour every architectural principle (P1–P6)** locally — no shortcuts that defer to "cloud will solve that".

## 2. Sequencing principle

**Full local build first; migrate to cloud as a single coherent phase.** (Per CEO directive 2026-05-06; codified under Principle 3.)

- **Local is not a "demo".** Local is the bank's complete capability surface running on a substrate appropriate for laptop scale.
- **No capability splits.** No "we'll do that bit in cloud" — everything M1–M7 ships locally first.
- **Substrate-replacement seams** designed in from day one (clean interfaces; dependency-injected substrates).
- **M8 is migration, not development.** SQLite → managed Postgres / Event Hubs; software-backed crypto → Key Vault Managed HSM; mock identity → Entra ID; Pino → Azure Monitor; static dashboards → Container Apps + Storage.

## 3. Hardware & OS

| Element | Choice | Rationale |
|---|---|---|
| Primary platforms | macOS (Apple Silicon), Linux (x86_64 / ARM64) | Atlas / engineers' laptops; reproducible. |
| Windows | Supported via WSL2 | Avoids Windows-native idiosyncrasies in Bun / SQLite. |
| Minimum spec | 16 GB RAM, 8 cores, 50 GB free disk | Comfortable for full M1–M7 footprint with synthetic data of demonstration scale. |
| Network | Localhost only by default | No external calls to live systems. Optional outbound permitted for package install + (future) sandbox regulator-portal testing. |

## 4. Runtime & language

Per Atlas's `local-prototype-plan.md` §3 — confirmed unchanged.

| Element | Choice | Reason |
|---|---|---|
| Runtime | **Bun** (latest LTS-equivalent) | Single binary; ships TypeScript runtime, SQLite driver, test runner, package manager. Minimum-dependency surface. |
| Language | **TypeScript** with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` | Best fit for structured-data, contract-heavy platform. Branded types encode P5 at the type level. |
| Linter / formatter | **Biome** | Lint + format in one tool, fast. |
| Schema validation | **Zod** | Runtime schema validation at event boundaries (P2 enforcement). |
| Logger | **Pino** | Structured logging; cloud-target replaceable via the same interface. |
| Test runner | **Bun's built-in test** (`bun:test`) primary; `vitest` only if a specific pattern requires it | Standard test runner; the choice is whichever reads cleaner. |
| SQL helper | **Drizzle** (lightweight) for typed SQL where helpful; raw SQL where clearer | Avoid heavy ORM; embrace SQL. |

Versions are pinned in `prototype/package.json` and `.tool-versions` (asdf-compatible) — no floating versions.

## 5. Event store substrate (P1)

The substrate layer of everything.

| Element | Local | Cloud (M8) |
|---|---|---|
| Implementation | **SQLite** via `bun:sqlite` (single file: `prototype/.local/event.db`) | Azure Database for PostgreSQL (logical decoding) **or** Azure Event Hubs + Cosmos DB Change Feed — Atlas selects at M8. |
| Interface (TypeScript) | `@platform/event-store/EventStore` — `append(event)`, `appendAll(events)`, `replay(opts)`, `count()` | Same interface; different implementation. |
| Append discipline | P2-enforced citations ≥ 1 (Zod-rejected at append) | Same. |
| Sequence | Monotonically increasing `sequence INTEGER PRIMARY KEY AUTOINCREMENT` | Cloud equivalent: PG `bigserial` or stream-offset. |
| As-of replay | Filter by `as_of <= ?` in `replay()` | Same query semantics. |
| Backup | Periodic SQLite snapshot to `prototype/.local/snapshots/` | Azure-native PG / Cosmos backup. |

The interface is the seam. Capability code never imports SQLite directly; only `@platform/event-store/EventStore`.

## 6. Projection & data storage

| Element | Local | Cloud (M8) |
|---|---|---|
| Projection runtime | In-process Bun module reading the event store, applying pure-function reducers; idempotent, replayable | Azure Container Apps / Functions reading the cloud event substrate; same reducer code. |
| Projection caches | SQLite tables alongside the event table, OR in-memory data structures | Azure SQL / Cosmos / Redis — Atlas selects per cache. |
| Master-data projections | Client master, product master, instrument master, legal-entity master, calendar master, currency master, rate master — all SQLite-backed projections of events | Same projections, cloud-substrate-backed. |
| Semantic layer | TypeScript module exposing typed `metric()` queries with citation metadata | Same module, served via Container App. |
| Reconciliation harness | CI gate; runs synthetic event stream through projections; asserts against golden state | Same harness, runs in CI pipeline pre-deploy. |

## 7. Identity, auth, secrets

| Element | Local | Cloud (M8) |
|---|---|---|
| Workload identity | Mock JWT issuer + verifier (`@platform/identity/local`) | Azure Entra ID Workload Identity Federation. |
| Human auth | Local mock SSO (e.g., Keycloak or hand-rolled minimal IdP) | Azure Entra ID. |
| MFA / WebAuthn | Local WebAuthn for testing customer-auth flows; FIDO2 keys supported | Azure Entra ID + WebAuthn. |
| Secrets | `prototype/.local/secrets/` (gitignored) + 1Password or env-loader; never committed | Azure Key Vault. |
| API auth | Bearer tokens signed by mock IdP; rotation cadence enforced | Same shape via Entra-issued tokens. |

The interface is `@platform/identity/Authenticator`. Mocks behind it are clearly marked `LOCAL_ONLY`.

## 8. Cryptography & signing (P4)

| Element | Local | Cloud (M8) |
|---|---|---|
| Signing keys | Software-backed via Web Crypto API; keys persisted to `prototype/.local/keys/` | Azure Key Vault Managed HSM (FIPS 140-2 Level 3) — required by P4. |
| Encryption keys (envelope) | Software-backed AES-GCM-256 with per-domain DEKs; KEK rotation simulated | Same envelope scheme; KEKs in Managed HSM. |
| Field-level encryption | PII fields tagged in projection schemas; envelope-encrypted at rest in SQLite | Same tagging; cloud HSM rooted. |
| Event signing | Each event optionally signed by its actor; signatures verified on replay | Same; HSM-rooted in cloud. |
| List-version attestation | Sanctions / PEP / adverse-media list versions hashed and signed at ingestion | Same. |
| Key rotation | Local rotation rehearsal — rotate every 90 days in dev to exercise the path | Cloud rotation per Key Vault policy. |

The interface is `@platform/crypto/Signer` and `@platform/crypto/EncryptionService`. Web Crypto and Managed HSM share the same call shape (sign / verify / encrypt / decrypt / wrap / unwrap).

## 9. Observability

| Element | Local | Cloud (M8) |
|---|---|---|
| Logging | **Pino** structured JSON to stdout + `prototype/.local/logs/` rotation | Pino → Azure Monitor / Log Analytics. |
| Tracing | **OpenTelemetry** SDK with local Jaeger or Tempo for visualisation | OTel → Application Insights. |
| Metrics | OTel metrics → local Prometheus → Grafana (optional, dev-time) | OTel → Azure Monitor metrics. |
| Audit log | Append-only events under `audit.*` types; same event store; queryable | Same; cloud-substrate-backed. |
| Dashboards | Static HTML + JS, served by a simple local HTTP server reading from the projection runtime | Container App + Storage. |

The interface is `@platform/observability/Logger` and `@platform/observability/Tracer`.

## 10. Networking

Local-only by default.

| Element | Choice |
|---|---|
| Dev HTTP | Bun's built-in HTTP server (`Bun.serve`); per-domain ports under `localhost:3000-3999` |
| Internal mTLS | Optional TLS on the loopback for testing mTLS-shape; production runs on real mTLS via Entra workload identity |
| External network | Disabled by default; explicit `network: "outbound"` flag on dev runs that need package install or sandbox regulator-portal testing |
| Simulated externals | `prototype/simulators/` houses mock JSE, SAMOS, BankservAfrica, SWIFT, SARS, FIC; never call real ones |

## 11. Build, lint, type, test

| Step | Tool | Gate |
|---|---|---|
| Install | `bun install` | One command, pinned versions |
| Type check | `bun tsc --noEmit` | Pre-commit + CI |
| Lint / format | `biome check .` / `biome format --write .` | Pre-commit + CI |
| Unit tests | `bun test` | Pre-commit (fast tests) + CI (all) |
| Integration tests | `bun test --pattern='**/integration.test.ts'` | CI |
| Scenario runs | `bun run scenarios/<name>.ts` | CI; runs synthetic scenario end-to-end |
| Reconciliation harness | `bun run platform/recon/harness.ts` | CI gate — must pass before merge (P1 / P6) |
| Citation gate | `bun run platform/citation/gate.ts` | CI gate — every event has ≥1 citation; rejects merges that violate P2 |
| Threat-model gate | Per-design human review (Senna) | Required for new event types, APIs, integrations (P4) |

CI runs locally first via `bun run ci` (a script that chains the above), then on a remote runner (GitHub Actions or equivalent — selected at M8 / sooner if the team grows).

## 12. Process supervision & local bring-up

A single command starts the local environment.

```sh
make up           # or: bun run dev
```

Brings up:

- The event store (SQLite — file-backed, no daemon).
- The projection runtime (long-running Bun process).
- The mock IdP (Bun process serving JWT issuer endpoints).
- The local HTTP API (Bun.serve on `localhost:3000`).
- The dashboard server (static HTML + JS on `localhost:3010`).
- A Jaeger / Tempo / Prometheus stack via docker-compose for observability (optional; off by default).

Process supervision via **`overmind`** or a custom Bun-based runner. Process logs interleaved with prefix tags. Graceful shutdown on `Ctrl+C` flushes pending events.

```sh
make down         # graceful stop, flush, snapshot
make reset        # wipe local state; clean slate
make seed         # apply seed events from prototype/seeds/
```

## 13. CI / pre-commit gates

Pre-commit hooks (via `lefthook` or `husky`) enforce:

1. Type check passes.
2. Biome lint passes.
3. No untyped events ("any" payloads rejected).
4. No events without citations (P2 gate).
5. Threat-model marker present for new event types (manual: requires Senna's review record).
6. Format check passes.

Server-side CI repeats all the above plus:

7. All unit tests pass.
8. All integration tests pass.
9. Reconciliation harness passes (GL ↔ event-derived ↔ sub-ledger reconciles to zero — P1).
10. SBOM generated; dependency vulnerabilities scanned (Senna).
11. Build is reproducible (deterministic outputs).

## 14. Security primitives (P4)

Per the Information Security Policy and Cyber Resilience Policy:

- **Zero trust by default.** Every service-to-service call authenticates and authorises; no implicit trust on the loopback.
- **Least privilege.** Local dev still requires explicit grants; access events are typed.
- **Threat-model gate.** New event types, APIs, integrations are not approved without an explicit threat model and the controls that follow from it (Senna's review).
- **Immutable audit.** Append-only audit events; never mutated.
- **Insider-risk parity.** The same controls apply to dev access as to production access.
- **Secret rotation rehearsed.** Local rotation simulated to exercise the path; cloud rotation inherits.

## 15. Synthetic data discipline

- **All data is synthetic** and labelled `SIMULATED` in event metadata.
- **No real PII.** Test customers have generated names, addresses, ID numbers (with valid Luhn-equivalent format but no association to real persons).
- **No real market data.** Rate fixings, FX, security prices are simulated under known distributions.
- **No real regulator submissions.** STR / FATCA / CRS / BA-return generators produce content but submissions go to mock regulator endpoints.
- **Synthetic-data generators** live in `prototype/simulators/` and `prototype/seeds/`.
- **Datasets are versioned** so scenarios are reproducible.

## 16. Migration seams

The substrate-replacement seams that make M8 a configuration phase, not a rewrite:

| Substrate | Local interface (M1–M7) | Cloud implementation (M8) |
|---|---|---|
| Event store | `@platform/event-store/EventStore` | Postgres / Event Hubs implementation |
| Identity | `@platform/identity/Authenticator` | Entra ID implementation |
| Secrets | `@platform/secrets/Secrets` | Key Vault implementation |
| Crypto | `@platform/crypto/Signer`, `EncryptionService` | Managed HSM implementation |
| Logging | `@platform/observability/Logger` | Azure Monitor implementation |
| Tracing | `@platform/observability/Tracer` | Application Insights implementation |
| HTTP server | `@platform/http/Server` | Container App implementation |
| Storage (blobs) | `@platform/storage/Blob` | Azure Storage implementation |
| Scheduler | `@platform/scheduler/Scheduler` | Azure Functions / cron-trigger Container App |
| Notification | `@platform/notification/Notifier` | Azure Communication Services implementation |

**Discipline:** capability code imports only the interface; the implementation is wired at the composition root (`prototype/platform/composition.ts`). Local and cloud composition roots are different files; the rest of the code is identical.

## 17. Repository layout

Per Atlas's `local-prototype-plan.md` §4, with refinements:

```
prototype/
├── platform/                   Atlas. The substrate every domain builds on.
│   ├── core/                   Branded types, money, time, IDs.
│   ├── event-store/            Append-only event log (SQLite local).
│   ├── projection/             Projection runtime; reducers; replay.
│   ├── citation/               Obligations-register integration.
│   ├── identity/               Auth: local mock + interface for cloud.
│   ├── crypto/                 Signing, encryption, key management.
│   ├── observability/          Logger, tracer, metrics.
│   ├── http/                   HTTP server abstraction.
│   ├── storage/                Blob storage abstraction.
│   ├── scheduler/              Time-based triggers.
│   ├── notification/           Outbound notification abstraction.
│   ├── recon/                  Reconciliation harness.
│   └── composition.ts          Composition root: wires interfaces to implementations.
├── domains/                    Bea, Mira, Kai, Rohan, Tomas, Imani, Sade, Niko, Yael, Vera.
│   ├── capital/
│   ├── liquidity/
│   ├── credit/
│   ├── markets/
│   ├── compliance/
│   ├── privacy/
│   ├── customer/
│   ├── tax/
│   ├── treasury/
│   └── ...
├── simulators/                 Mocked external systems.
├── scenarios/                  End-to-end demo scripts.
├── seeds/                      Register seed data, calendars, reference data.
├── tests/                      Cross-domain integration tests.
├── infra/
│   ├── azure/                  IaC scaffolding for M8 (Bicep / Terraform — Atlas selects).
│   └── local/                  docker-compose for optional observability stack.
├── .devcontainer/              Reproducible dev environment.
├── .local/                     Gitignored: SQLite DB, keys, secrets, logs, snapshots.
└── package.json / tsconfig.json / biome.json / .tool-versions / Makefile
```

## 18. Documentation discipline

- **Every platform module** (`platform/<x>/`) has a `README.md` explaining: what it is, what interface it exposes, its substrate-replacement seam, its testing approach.
- **Every domain module** (`domains/<x>/`) has a `README.md` explaining: which procedures it implements, which obligations register IDs it cites, which events it emits / consumes.
- **Every scenario** (`scenarios/<name>.ts`) has a top-of-file comment explaining what regulatory / operational story it demonstrates.
- **Every test file** has a top comment naming the policies / procedures it tests.
- **Procedures library** (`/Procedures/`) cross-references back to the domain modules — the chain Reg → Policy → Procedure → System Capability is testable.

## 19. Open items

1. **`overmind` vs Bun-native process supervisor** — Atlas's call.
2. **`lefthook` vs `husky` for pre-commit** — Atlas's call.
3. **Local Keycloak vs hand-rolled minimal IdP** — Senna's call from a security-realism perspective.
4. **Optional Jaeger / Tempo / Prometheus stack opt-in** — defaults to off; opt-in via `make obs-up`.
5. **`asdf` vs `mise` vs `nvm`-equivalent** — Atlas's call; pin a single tool for reproducibility.
6. **Database file location** — `prototype/.local/event.db` proposed; configurable for multi-laptop scenarios.
7. **Multi-laptop scenarios** — peer-to-peer event log replication (post-M2) for collaborative dev.
8. **Devcontainer base image** — Bun official vs custom; Senna reviews.

These are engineering decisions; none requires CEO action today.

## 20. Open items requiring CEO awareness

1. **Bun is not yet installed** on Marc's laptop. Bun install: `curl -fsSL https://bun.sh/install | bash`. Reversible.
2. **Local environment will hold synthetic PII** (clearly labelled `SIMULATED`) — POPIA does not apply to synthetic data, but Iris should review the synthetic-data discipline before any real-data seeding ever occurs (it should not before licensing).
3. **No CEO authorisation yet** to start the build of M1–M7 capabilities against this infrastructure. This spec describes the platform; build authorisation is a separate decision.
4. **Cloud-lift sequencing (M8) authorisation** is a future decision; not before complete local build.

## 21. Co-dependencies

- `Owner Inbox/2026-05-05_local-prototype-plan.md` — Atlas's prior plan; this spec extends and refines.
- `Owner Inbox/2026-05-06_reporting-capability-spec.md` §6, §7 — tech-stack alignment + M-phase plan.
- `Owner Inbox/2026-05-06_core-policies-infosec-ops.md` §1, §2, §6 — Information Security, Cyber Resilience, Cloud Computing policies.
- `Procedures/by-policy/change-management.md` — production-change discipline.
- `CLAUDE.md` Principles 1–7 — bind the spec.
- `prototype/` walking-skeleton code from today (`platform/core/types.ts`, `money.ts`, `event-store/types.ts`, `event-store/store.ts`).

## 22. What this specification does *not* do

- **Does not authorise the build.** Build authorisation is a CEO decision in a future pack.
- **Does not pin every micro-decision.** Atlas reserves discretion on tooling sub-choices (process supervisor, pre-commit hook framework, observability-stack opt-in).
- **Does not commit a delivery date.** M-phase horizons remain indicative.
- **Does not specify the cloud (Azure) substrate primitives.** Those are M8 design decisions per the Azure-target memory.
- **Does not duplicate Atlas's prior plan.** Where this spec is silent, the prior plan governs.

This spec defines the platform substrate the team will build *on top of*. The capabilities themselves — events, projections, generators, dashboards — are specified per domain in the relevant policies and procedures.
