# Bank prototype

A single-laptop, zero-cloud, zero-spend prototype of the bank. Architecturally honest with the production design — the M8 cloud lift to Azure is substrate replacement, not rewrite. Sequencing per CEO directive (2026-05-06): **full local build first, migrate to cloud as a single coherent phase**.

For the architectural principles, see `../CLAUDE.md`.
For the full plan, see `../Owner Inbox/2026-05-05_local-prototype-plan.md` (Atlas) and `../Owner Inbox/2026-05-06_local-base-infrastructure-spec.md` (Atlas — refined).
For the reporting / analysis capability that this substrate carries, see `../Owner Inbox/2026-05-06_reporting-capability-spec.md`.

## Status

**M1 — Walking skeleton: live.** Event store, P2 citation gate, reconciliation harness, and a first end-to-end scenario all run.

```
$ make ci
typecheck → lint → test (6 pass) → reset → seed scenario → citation gate (5 / 5) → recon (100 / 100)
```

## Stack

- **Bun** runtime — single binary; ships TypeScript, SQLite, test runner, package manager.
- **TypeScript** strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `allowImportingTsExtensions`).
- **SQLite** (`bun:sqlite`) for the local event store — append-only.
- **Web Crypto API** for software-backed signing (Azure Key Vault Managed HSM-shaped at M8).
- **Biome** for lint and format.
- **Zod** for runtime schema validation at event boundaries (P2 enforcement).
- **Pino** for structured logging (Azure Monitor / Application Insights at M8).

Capability code imports only `@platform/<x>` interfaces; the local implementations are wired at `platform/composition.ts`. The cloud lift swaps the composition root without touching capability code.

## Layout

```
prototype/
├── platform/                   Atlas. Substrate every domain builds on.
│   ├── core/                   Branded types, money, time, IDs (P5).
│   ├── event-store/            Append-only event log (SQLite local).
│   ├── citation/               P2 gate; citation types.
│   ├── observability/          Pino logger.
│   ├── recon/                  Reconciliation harness (P1).
│   ├── composition.ts          Composition root — wires interfaces to local impls.
│   └── (M2+) identity, crypto, http, storage, scheduler, notification.
├── domains/                    Per-engineer domain modules (Bea, Mira, Kai, etc.).
├── simulators/                 Mocked external systems.
├── scenarios/                  End-to-end demo scripts.
├── seeds/                      Register seed data, calendars, reference data.
├── tests/                      Cross-domain integration tests.
├── infra/azure/                Bicep / Terraform scaffolding for M8 (placeholder).
├── .local/                     Gitignored: SQLite DB, keys, secrets, logs, snapshots.
├── Makefile                    `make help` for commands.
├── package.json
├── tsconfig.json
└── biome.json
```

## Running it

Install Bun once:

```sh
curl -fsSL https://bun.sh/install | bash
```

Then from `prototype/`:

```sh
make install         # bun install
make ci              # full local CI loop (typecheck, lint, test, scenario, citation gate, recon)

make up              # reset + seed scenario (default: hello-bank)
make test            # unit + integration tests
make scenario:hello  # run the hello-bank scenario alone
make citation-gate   # P2 — every event has ≥1 citation
make recon           # P1 — projection round-trip is deterministic
make reset           # wipe .local/
```

Equivalent `bun run <script>` commands are in `package.json`.

## Architectural principles enforced in M1

- **P1** — events are the only source of truth; replay is reproducible (`recon harness`).
- **P2** — every event carries citations; rejected at append by `eventSchema`; verified by `citation gate`.
- **P3** — no manual steps in the bring-up; `make up` is one command.
- **P4** — software-backed signing today; HSM-shaped at M8. Synthetic data only; clearly labelled.
- **P5** — branded types for `Currency`, `LegalEntity`, `Jurisdiction`, `Calendar`. Cross-currency arithmetic rejected at runtime.
- **P6** — every output (e.g. citation gate report, recon harness output) is generated, not assembled.
- **P7** — capability code imports only platform interfaces; the seam is the composition root.

## Next milestones

- **M2 — Semantic layer v1 + first full BA return** (Anya + Bea + Eitan).
- **M3 — Prudential return suite + AFS skeleton** (Bea + Anya + Helena).
- **M4 — Compliance suite (RMCP, STR/CTR/TPR, FATCA/CRS)** (Mira + Zara + Yael).
- **M5+** — see `../Owner Inbox/2026-05-06_reporting-capability-spec.md` §7.

`M1–M7 all run locally. M8 is a single-phase cloud migration (Azure).`
