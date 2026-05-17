---
title: Continuous-controls assurance programme — design + first wave
author: Vera
date: 2026-05-06
summary: Design + first-wave (#3, #4) recon pipelines. Superseded — Vera's Wave-4 recon harness has shipped #5–#16+ pipelines and the agent-discipline-assurance extension is operational.
decision-required: false
superseded-by:
  - reference: prototype/platform/recon/
    note: "Vera's Wave-4 recon pipelines + agent-discipline-assurance-extension are live in prototype/platform/recon/. The pipeline catalogue here (waves 1-3) is no longer the canonical state; the recon directory + bun run ci output are."
  - reference: feedback_canonical_source_registry.md
    note: "The canonical-source-registry rule (Owen, 2026-05-07; enforced by @platform/recon/prose-duplication.ts Wave-4 #16, live) supersedes the pipeline-catalogue framing here."
superseded-on: 2026-05-11
superseded-by-author: Owen (Company Secretary, governance) — sweep authorised by CEO 2026-05-11
---

# Continuous-controls assurance programme — design + first wave

**Author:** Vera (Internal audit / continuous-assurance engineer)
**Functional manager:** Thandiwe (CAE)
**Coordinators:** Owen (CoSec, IAF chair), Mira (obligations register), Atlas (platform), Anya (data substrate), Senna (security), Helena, Zara, Iris (combined-assurance counterparties).
**Date:** 2026-05-06
**For:** Marc (CEO)
**Authority:** CAE hire (2026-05-06) + Thandiwe's first-90-days §3.
**Status:** **Programme design + first-wave pipelines shipped.** Module updates: `prototype/platform/recon/` · Tests: `prototype/tests/recon-pipelines.test.ts`.

> **Derivation note (Principle 6 — downward).** This programme is the third-line continuous-controls infrastructure that produces Thandiwe's quarterly opinion to the (Interim) Audit Forum. It generates from the event log, the obligations register, the procedures library, the persona library, and the policy register — never authored independently of those.

---

## 1. Purpose

Continuous, machine-asserted controls evidence covering the populated control surface of the bank. The programme replaces ad-hoc audit testing with deterministic pipelines that run on every commit and emit typed events (P1) carrying citations (P2). Thandiwe consumes the pipelines' event stream and signs the quarterly opinion-pack; Vera engineers the pipelines.

## 2. Architectural posture

- **Independence in code.** No `@platform/recon/*` pipeline imports a domain module's *implementation*; pipelines read events, files in `Procedures/`, files in `/Team/`, and the obligations register. The seam keeps the third line architecturally independent from the controls it tests.
- **Synthetic-data discipline.** Pipelines run against the build-phase event store (synthetic flows clearly labelled `SIMULATED`). Switch-to-live at licence-grant adds live-evidence assurance on top of the same pipelines.
- **Conflicts register.** Vera maintains a register of controls / procedures / capabilities she helped design. Where any of those become subjects of third-line opinion, the conflict is named in the opinion-pack and Thandiwe sources assurance externally or via independent rotation.

## 3. Pipeline catalogue (state of play)

| # | Pipeline | Status | What it asserts |
|---|---|---|---|
| 1 | **Citation gate** (`platform/citation/gate.ts`) | **Live (5/5 today; will scale with event volume)** | Every event in the store has ≥ 1 citation (Principle 2). Run pre-merge + nightly. |
| 2 | **Event-store recon harness** (`platform/recon/harness.ts`) | **Live (100/100 today)** | Append-then-replay determinism on a synthetic 100-event stream. P1 invariant. |
| 3 | **Mandate-ownership integrity** (`platform/recon/mandate-ownership.ts`) | **Live — first wave** | Every populated procedure resolves to a real mandate-bearing persona in `/Team/<name>.md` or a governance seat. Orphans are reportable findings. |
| 4 | **Decision-event reconciliation** (`platform/recon/decision-event-recon.ts`) | **Live — first wave** | The dashboard registry's `decisionsResolved` list reconciles to `CeoDecision` events in the event store. The governance procedure is reproducible. |
| 5 | **Orphan-capability detection** | **Planned — second wave** | Every `@platform/<x>` module declares its supporting procedures; every populated procedure names its system capability. Orphans either way are reportable. |
| 6 | **Policy → procedure coverage** | **Planned — second wave** | Every approved policy in the policy register has at least one populated or planned-stub procedure with a named owner and timeline. |
| 7 | **Obligations-register integrity** | **Planned — third wave** | Independent assertion of Mira's curation: regulator instruments cited by policies are real instruments; obligations-register entries reconcile to policy citations. |
| 8 | **GL ↔ event-derived ↔ sub-ledger reconciliation** | **Planned — co-timed with M3** | Once the GL projection lands at M3, reconcile the trial balance to the event-derived balance to the sub-ledger projection. P1 / P6. |
| 9 | **BA-return cell ↔ event-derived cell** | **Planned — co-timed with M2** | When BA-return generators land at M2, reconcile each return cell to its event-derived computation. |

The first wave (#3, #4) ships today alongside this document. Second wave (#5, #6) lands within ~2 weeks. Third wave (#7) follows once Mira's regulator-instrument-analysis cadence is more populated. M-phase pipelines (#8, #9) co-time with the reporting-capability build.

## 4. Pipeline shape (uniform contract)

Every pipeline is a `prototype/platform/recon/<name>.ts` module exposing a single function:

```ts
export interface ReconResult {
  pipeline: string;
  ok: boolean;
  asserted: number;
  violations: ReconViolation[];
  asOf: string;
}
export interface ReconViolation {
  subject: string;
  message: string;
  severity: "info" | "warn" | "fail";
}
export function run(): ReconResult;
```

A CLI entry-point at the bottom of each module prints structured JSON (Pino-shaped) for CI consumption and exits 0/1. The same modules expose a programmatic API for the quarterly opinion-pack generator (next deliverable).

## 5. Quarterly opinion-pack generator

A pure-function generator (planned ~6 weeks; co-timed with M2) consumes the pipelines' `ReconResult`s and produces the third-line section of the AC opinion-pack:
- coverage statement (which pipelines ran; how many assertions; how often);
- exceptions and issues (from `ReconViolation`s);
- follow-up tracker;
- QAIP commentary.

Generated, not assembled. Thandiwe signs; Vera produces the inputs.

## 6. Combined-assurance interface

Thandiwe's first-90-days §4 is the combined-assurance map (joint with Helena, Zara, Iris, Senna). The programme's pipelines feed coverage into that map. The map regenerates from the pipeline event stream so it stays current, not a snapshot.

## 7. Conflicts register (Vera's own)

The pipelines are *infrastructure* that Vera built; they are not first-line controls she designed. The conflict surface is therefore narrow today. As Vera contributes design-time input on domain modules (e.g. consulting on the customer-lifecycle event shapes alongside Niko), each contribution is registered. The opinion-pack annotates findings drawn from those subjects accordingly.

## 8. What this does *not* do (yet)

- No human-readable PDF of the opinion-pack — generator is pure-function and emits structured data; rendering follows in week 6.
- No SSE / push notifications when a pipeline goes red — the dashboard polls the registry; pipeline events surface there at next poll.
- No external-auditor handoff — engagement-letter scoping (Thandiwe's first-90-days §5) remains in flight.
- No conflict-of-interest auto-detection — the conflicts register is curated, not generated, until the surface is large enough to merit pipeline support.

## 9. Architectural integrity (Principle 6)

This programme is itself a system capability:
- Procedure binding: `Procedures/by-policy/ceo-decision-review.md` is the first procedure the decision-event-recon pipeline tests against; the Internal Audit Charter (D6, in flight under Thandiwe) will name the broader procedure surface this programme covers.
- Policy backing: Internal Audit Charter (D6) + Operational Risk Policy + Stress Testing Policy.
- Regulator instruments: BCBS 223 (Internal Audit Function in Banks); IIA IPPF; King IV Audit Committee provisions; Banks Act 94 of 1990 (internal-audit expectations).
- No orphan capability: every pipeline above traces to a procedure (existing or planned) and ultimately to a regulator instrument.

—Vera
