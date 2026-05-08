# Build-phase opex register

**Curator:** Camille (CFO) · **Engineering:** Bea · **Date:** 2026-05-07 · **Version:** 0.1 (initial)

> **Purpose.** Authoritative register of the bank's real operating expenditure during the build phase — before licence-day, before customers, before revenue. Per the AI-driven-bank operating model (CLAUDE.md), the build phase has real cost (Anthropic API tokens, cloud, tooling, Marc's time) but not real customers; this register tracks the real-cost half so the CFO seat has a substrate output now rather than at licence-day.
>
> **Canonical authoring location.** Per Owen's canonical-source registry: this file is the single citable source for build-phase opex. Cross-references in Camille's monthly close output, Atlas's substrate-state report, and any CEO budget-status surface link here rather than re-state the lines.

## How to read

- **Cost line** — what's being spent on; one line per provider / category.
- **Category** — `compute` (Anthropic API; future cloud), `tooling` (developer tools, observability, deployment), `infrastructure` (cloud-once-lifted, domains, certs), `other`.
- **Owner** — the seat accountable for the cost decision. Build-phase: Marc (CEO) for everything; specific delegations (e.g. Atlas for cloud, Senna for security tooling) named where relevant.
- **Estimate cadence** — `monthly`, `usage-based`, `annual`, `one-off`.
- **Latest known amount** — most recent reading; ZAR-equivalent if non-ZAR (FX rate + date in footnote).
- **Status** — `LIVE` (billing today), `PROVISIONED` (account set up, not yet billing), `DEFERRED` (planned, not yet started), `RETIRED` (was live; stopped).

Build-phase costs are denominated in their natural currency (USD for Anthropic, USD/ZAR mix for cloud, etc.) and reported with a reporting-currency reading (ZAR) per Principle 5. Translation rate captured per reading.

---

## Live cost lines

| ID | Cost line | Category | Owner | Estimate cadence | Latest known amount | Status |
|---|---|---|---|---|---|---|
| OPEX-COMPUTE-01 | Anthropic API (Claude Code + Claude API for agent narratives) | compute | Marc (CEO) | usage-based | TBD — first formal reading pending; current estimate unknown but largest single line | **LIVE** |

## Deferred (planned, not yet active)

| ID | Cost line | Category | Owner | Activates on | Status | Notes |
|---|---|---|---|---|---|---|
| OPEX-INFRA-01 | Microsoft Azure (target production cloud per `project_cloud_target_azure` memory) | infrastructure | Atlas | M8 cloud lift | **DEFERRED** | Build phase is local; lift to Azure is one coherent phase, not split. |
| OPEX-INFRA-02 | Domain registrations + DNS (bank legal-entity name + customer-facing domains) | infrastructure | Devon | Bank-name selection + legal-entity registration | **DEFERRED** | Awaits `D-BANK-NAME-SELECTION` final + Imani's CIPC filing. |
| OPEX-INFRA-03 | Cloud HSM (FIPS 140-2/3 Level 3 per Principle 4) | infrastructure | Senna | M8 cloud lift; pre-licence threat-model gate | **DEFERRED** | Required for production crypto; senna:m1-trading-stack-threat-model brief names this. |
| OPEX-TOOLING-01 | Observability stack (logs, metrics, traces — production-grade) | tooling | Atlas | M8 cloud lift | **DEFERRED** | Build phase uses local pino logging. |
| OPEX-INFRA-04 | Production data residency — SARB Directive 3/2018 + POPIA cross-border review | infrastructure | Senna + Iris | Pre-licence | **DEFERRED** | Real cost lands when residency strategy is approved. |
| OPEX-OTHER-01 | External counsel (banking-licence application + ongoing) | other | Owen | Pre-licence-application gate | **DEFERRED** | Per `project_ai_driven_bank` memory: not engaged until licence-application moment. |
| OPEX-OTHER-02 | External auditor (Companies Act s.90 + Banks Act) | other | Camille | Statutory-trigger or licence-day | **DEFERRED** | Auditor engagement is the trigger for this line. |
| OPEX-OTHER-03 | Insurance (D&O, professional indemnity, cyber per JS1/2024) | other | Owen + Senna | Licence-day | **DEFERRED** | Required at licence-day per `project_ai_driven_bank`. |

## Retired / not pursued

_None._

---

## Methodology

1. **Real today; not a simulation.** Lines marked `LIVE` are billed against Marc's accounts in real currency. Anthropic API spend is the binding visible line; this register is the home for tracking it.
2. **Append-only register; corrections add a row, do not edit history.** Mirrors the obligations-register convention.
3. **Monthly cadence on `LIVE` readings.** Camille's `cfo-substrate-state` weekly handler reads this register; the monthly-close cadence (Camille's §6) refreshes the `Latest known amount` cell.
4. **Translation to ZAR.** Reporting currency is ZAR per the bank's home jurisdiction; native-currency readings are kept alongside, and translation events are logged with rate + date per IAS 21.
5. **Citation chain.** Every line ties to (a) the procurement decision (CEO or delegated), (b) the contract / terms reference, and (c) the relevant accounting policy.

## Procedures

- `Procedures/by-policy/build-phase-opex-tracking.md` — **owner: Camille** (planned; reads this register, refreshes monthly readings, surfaces variance > 20% as `RiskRaised`).
- `Procedures/by-policy/cost-reading-attestation.md` — **owner: Camille** (planned; how a reading is verified — vendor invoice, receipt, observed bill).

## Substrate gaps

- **Live-reading ingestion.** No automated reader for vendor bills today; readings are added manually when Marc / Camille observes them. Future: Atlas's substrate could read vendor APIs / IMAP for invoices and emit `OpexReadingObserved` events.
- **Variance alerting.** No alert when a reading exceeds a budget envelope. Lands when the budget-envelope register (sibling) does.
- **Budget envelope.** This register tracks actuals; the budget envelope is a separate forward-looking artefact (typically Camille's monthly variance report). Not yet built.

## Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| 0.1 | 2026-05-07 | Camille (via Scrooge) | Initial register. Anthropic API listed as the sole `LIVE` cost line; Azure / HSM / counsel / auditor / insurance lines listed as `DEFERRED` with their activation triggers. Awaits first formal reading on `OPEX-COMPUTE-01`. |
