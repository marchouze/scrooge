---
title: Counterparty institutional-eligibility screening v0 (D-FSP-LICENCE-NECESSITY confirm-A)
author: Niko (Sales / CRM engineer)
date: 2026-05-09
summary: First substrate slice for FAIS Posture A counterparty-eligibility screening — three typed events (Screened / Revalidated / Breached), procedure stub PROC-CRM-CIE-01, and lightweight Zod-round-trip tests. The classification module that performs the test, Vera's recon pipeline, and the criteria-as-code taxonomy are named substrate gaps, not built in this PR.
decision-required: false
---

# Counterparty institutional-eligibility screening v0 — completion note

## Context

On 2026-05-09 the CEO resolved **D-FSP-LICENCE-NECESSITY** as **`confirm-A-no-research`** (decision record: `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md`; PR #62). Posture A binding means **every counterparty onboarded must clear an institutional-eligibility test that anchors the FAIS scope-of-services to the institutional product set**. v0 substrate is owed.

This PR delivers that v0 substrate as a single coherent slice: typed event family + procedure stub + lightweight tests, with the engineering-side classification module, Vera's recon pipeline, and the legal-as-code criteria taxonomy named as substrate gaps for follow-on PRs.

Authority chain: D-FSP-LICENCE-NECESSITY → D-THIN-HUMAN-LAYER-MINIMUM → D-MARKETS-SCHEMA-FOUNDATION; strategic-foundation memory (institutional-only / wholesale).

## What landed

### 1. Typed event family — `prototype/platform/event-store/event-types.ts`

Three events under a clearly-marked CRM section header (added at the end of the typed-event block, before the `TYPED_EVENT_TYPES` registry, to keep merge-time conflict zones small with the parallel Saskia-Kai-Atlas / Mira / Imani in-flight PRs):

- **`CounterpartyEligibilityScreened`** — initial screening (or fresh post-breach screening). Payload: `{ counterpartyId, screeningId, criteria[], outcome, evidenceRefs[], asOf }`. Outcome enum: `institutional-eligible` / `ineligible` / `indeterminate`.
- **`CounterpartyEligibilityRevalidated`** — periodic (annual default) re-eligibility cycle. Same payload + `priorScreeningId` referencing the prior screening.
- **`CounterpartyEligibilityBreached`** — ongoing-monitoring drift signal (entity status change, business-model change, regulatory-classification change). Payload: `{ counterpartyId, priorScreeningId, breachReason, recommendedAction, asOf }`. Action enum: `suspend-trading-and-rescreen` / `escalate-to-zara-and-counsel` / `run-fresh-screening` / `no-action-monitor`.

Each event registered in `prototype/platform/event-store/registry.ts` under `MARKETS_EVENT_TYPES` with issuer `Niko`, subscribers `[Saskia, Zara, Imani, Mira, Vera, dashboard]` (+ `Kai` on the Breached event for trading-halt routing), replay-fold rules per A0 §6, and citations hint referencing FAIS Act 37/2002 + the Mira (Compliance / RegTech engineer) PR #70 FAIS Posture A URN cluster (`urn:obligation:bank:fais:general-code-of-conduct:v1`) + obligations-register entries `ORG-CD-01` / `ORG-CD-04`.

`recon:runtime-handler-sync` passes (132 assertions, 0 violations) per memory `feedback_handlers_metadata_three_way_clash`.

### 2. Procedure — `Procedures/by-policy/counterparty-institutional-eligibility-screening.md`

Procedure ID: **PROC-CRM-CIE-01**. Status: **STUB**. Frontmatter follows the agent-spec convention. Owner (engineering): Niko (Sales / CRM engineer). Owner (governance): Saskia (Head of Global Markets, governance) on the markets-franchise side; Zara (Chief Compliance Officer, governance) on the conduct line.

Triggers: per-counterparty at onboarding; annual re-eligibility cycle; ongoing-monitoring breach signal. Seven steps from classification → criteria application → event emission → outcome routing (ineligible escalates blocking; indeterminate routes to Zara + counsel; institutional-eligible enters lifecycle). Reconciliation rule: every `Order*` event for a counterparty must trace to a current `institutional-eligible` outcome — Vera (Internal-audit / continuous-assurance engineer) recon enforces this.

Cross-linked from `Procedures/_index.md` under Customer / sales.

### 3. Lightweight tests — `prototype/tests/counterparty-eligibility.test.ts`

11 tests, all passing:
- Round-trip parse for each of the three event factories.
- P2 enforcement (≥1 envelope citation).
- Outcome enum enforcement.
- `priorScreeningId` required on Revalidated.
- `breachReason` required on Breached.
- `recommendedAction` enum enforcement.
- At-least-one criteria + at-least-one evidenceRef enforcement.
- Registry-lookup integration check (markets class, Niko issuer, payload schema present for all three types).

## Substrate gaps named (NOT built in this PR)

These are roadmap items per Principle 7 (steady-state vs current substrate) — the gap is the work, not something to hide.

1. **`prototype/platform/lifecycle/counterparty-eligibility.ts`** — typescript module that performs the actual classification logic + emits the events. **Owner:** Atlas (Core banking platform architect) + Niko (Sales / CRM engineer) joint follow-on PR.
2. **Vera (Internal-audit / continuous-assurance engineer) Wave-4 finding-pipeline** — the `Order*`-without-current-eligibility recon (cross-domain reconciliation rule above). **Owner:** Vera planning task.
3. **Institutional-eligibility-criteria-as-code** — typed criteria taxonomy at `prototype/platform/lifecycle/eligibility-criteria.ts`. **Owner:** Niko (Sales / CRM engineer) + Imani (Legal-as-code engineer) joint follow-on; legal-as-code engineer authors the criteria-typed definitions; CRM engineer consumes.
4. **Counterparty-master-data interaction** — Niko's wider lifecycle substrate (counterparty registration, FK references, status projections). Out of scope for this v0 PR.

## `[citation: TBC]` items routed

- **FAIS s.45 sub-section refs.** The institutional / professional-counterparty exemption sub-section refs are marked `[citation: TBC pending counsel]` throughout (event-type docstrings, procedure §2 + §5 step 2, test fixture citations). Counsel ratifies at the licence-application gate. Tracked under Imani (Legal-as-code engineer)'s external-counsel scope (`Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`).
- **FAIS retention period for the three event types.** Procedure §7 carries `[citation: TBC]` against retention. Routed to Mira (Compliance / RegTech engineer) for inclusion in the FAIS Posture A retention-schedule work.

## Cross-references

- **PR #62** — `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (D-FSP-LICENCE-NECESSITY confirm-A decision record).
- **PR #70** — Mira (Compliance / RegTech engineer) FAIS Posture A URN cluster (`urn:obligation:bank:fais:*`).
- **`Owner Inbox/2026-05-09_zara-imani_fsp-confirm-a-scope-updates.md`** — Zara + Imani joint completion note actioning the same decision; flags Niko (Sales / CRM engineer) substrate as the customer-interaction record-capture leg of the Posture A engineering work.
- **`Procedures/by-policy/fais-advice-record-capture.md`** (PROC-CRM-FA-01) — sibling procedure on the post-licence advice-record-capture pipeline.

## CI status

- `bun test` — **330 pass**, 3 fail (pre-existing on `main`: Vera overnight-recon × 2; Anya projection-drift / dashboard-derivation drift). New 11 tests all pass.
- `bun run typecheck` — **clean**.
- `bun run lint` — **clean** (after `bun run format`).
- `bun run recon:runtime-handler-sync` — **clean** (132 assertions, 0 violations).
- The full `ci` script's other recon failures (Rohan amber fixture, dashboard-derivation drift) are pre-existing on `main` and noted in the PR body, not fixed in this PR.
