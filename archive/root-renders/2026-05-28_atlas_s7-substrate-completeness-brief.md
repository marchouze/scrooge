---
title: "S7 Substrate-Completeness Brief — Sessions to Pre-Licence Readiness Gate"
author: "Atlas (Core banking platform architect, engineering)"
date: "2026-05-28"
category: "substrate-completeness-brief"
brief: "brief:atlas:s7-substrate-completeness-brief-current-state-se:2026-05-28"
run: "run:atlas:2026-05-28T06-19-50-250Z"
decision-required: false
---

# S7 Substrate-Completeness Brief
**Sessions to Pre-Licence Readiness Gate — as of 2026-05-28**

---

## 1. Pre-Licence Readiness Gate Definition

"Substrate-complete" means every item in the following checklist is green. The gate is a live recon query, not a manual sign-off; each criterion maps to an existing or planned recon harness.

| # | Criterion | Harness / evidence |
|---|---|---|
| G1 | All 7 products have `ProductApproved` events with NPA walks complete | `recon:npa-gate` + `recon:product-approval-attestation-integrity` |
| G2 | Full trade lifecycle (booking → settlement → MTM → accounting → reporting) exercised end-to-end for all 7 products with zero assertion failures | Planned: `recon:trade-lifecycle-e2e` |
| G3 | All 6 BA return forms (BA 300/310/320/325/350/600) generated and round-tripped against a SARB portal simulator with zero field errors | Planned: `recon:ba-return-xml-roundtrip` |
| G4 | IFRS 9 staging classifications reassessed automatically on trigger events with recon gate passing | Planned: `recon:ifrs9-staging-automation` |
| G5 | Vera Wave-4 recon pipelines (#10–#15) all passing in CI | Planned: Vera Wave-4 dispatch |
| G6 | All 31 personas with handlers wired for autonomous operation (goal-loop → escalation → close) | `recon:agent-spec` + `recon:goal-loop-capability` |
| G7 | CCO, CISO, and CAE governance seats producing autonomous run outputs (handler-level, not simulated) | Planned: governance-seat handler dispatch |
| G8 | Decision authority routing recon (`recon:decision-authority-routing`) passing with zero violations | `recon:decision-authority-routing` (active) |
| G9 | RMS registers (all 7) populated with zero parity gaps | `recon:rms-documents-parity` + `recon:rms-briefs-parity` (active) |
| G10 | Pre-licence readiness gate itself formally registered as a `Decision` event with CEO sign-off | This brief initiates |

M8 (Azure cloud migration) is explicitly excluded — CEO-deferred; it is not a pre-licence gate criterion under the current build-phase scope.

---

## 2. Remaining Work by Domain

| Domain | Work remaining | Est. sessions | Depends on |
|---|---|---|---|
| **Product lifecycle** | M5/M6/M7 NPA walks + `ProductApproved` events (in flight today); end-to-end trade lifecycle test for all 7 products (booking→settlement→MTM→accounting→reporting) | 2 | M5–M7 dispatch completing today (in flight) |
| **SARB reporting** | BA return XML generation pipeline; dry-run against SARB portal simulator; `recon:ba-return-xml-roundtrip` gate | 2 | BA 300/310/320/325/350/600 projections hardening (1 session) |
| **BA return hardening** | Stress-test coverage for BA 300/310/320/325/350/600 projections; edge-case assertions | 1 | None (projections exist; need stress scenarios) |
| **IFRS 9 automation** | Automated staging reassessment triggers on `TradeBooked`, `ProbabilityOfDefaultUpdated`, `LGDUpdated`; `recon:ifrs9-staging-automation` gate | 1 | None (IFRS 9 classification logic exists) |
| **Vera Wave-4 recon** | Pipelines #10–#15: agent-spec-integrity, mandate-coverage, procedure-actor coverage, compliance-obligation tracing, NPA-gate integrity, one additional; wired into `ci:recon:infra` | 2 | S8 complete (now done); Vera brief |
| **Governance seat handlers** | CCO autonomous handler wiring (AML obligations loop); CISO autonomous handler wiring (threat-model gate); CAE autonomous handler wiring (audit findings loop) | 2 | Wave-4 pipeline #10 (agent-spec-integrity) passing |
| **Gate formalisation** | Formal `Decision` event for pre-licence readiness gate definition (G10); CEO sign-off; gate registered in decisions register | 0.5 | This brief + Scrooge session delegation |

**Total: ~10.5 sessions**

Rounded to **11 sessions** accounting for integration friction (rebase collisions, CI fix-up, Marc review cycles).

---

## 3. Aggregate Estimate

| Tier | Sessions | Notes |
|---|---|---|
| In-flight today | 1 | M5–M7 NPA dispatch (parallel, ongoing) |
| Near-term (can start now) | 3.5 | BA hardening (1) + IFRS 9 (1) + gate formalisation (0.5) + Vera Wave-4 kickoff (1) |
| Depends-on near-term | 4 | Vera Wave-4 completion (1 more) + product lifecycle e2e (2) + SARB dry-run (1 more) |
| Depends-on Wave-4 | 2 | Governance seat handlers (CCO + CISO + CAE) |
| **Total** | **~10.5** | Excluding M8 (CEO-deferred) |

At one focused session per day, the gate is reachable in approximately **11 calendar days** from today (2026-05-28), assuming no blocking incidents.

---

## 4. Sequencing (Critical Path)

```
TODAY (in-flight)
  └─ M5/M6/M7 NPA walks + ProductApproved            [1 session]

WAVE A — can run in parallel, start immediately
  ├─ BA 300/310/320/325/350/600 stress-test hardening  [1 session]
  ├─ IFRS 9 staging automation                         [1 session]
  ├─ Gate formalisation (this brief → CEO sign-off)    [0.5 session]
  └─ Vera Wave-4 kickoff (pipelines #10–#12)           [1 session]

WAVE B — unblocked once Wave A delivers
  ├─ Vera Wave-4 completion (#13–#15)                  [1 session]
  ├─ SARB BA return XML + portal simulator dry-run     [2 sessions]
  │     (BA hardening must land first)
  └─ Product lifecycle e2e (all 7 products)            [2 sessions]
        (M5–M7 ProductApproved must land first)

WAVE C — unblocked once Wave-4 complete
  └─ Governance seat handlers (CCO / CISO / CAE)      [2 sessions]

GATE — all G1–G10 green → pre-licence readiness confirmed
```

Critical path length: TODAY + Wave A + Wave B (SARB branch) + Wave C = **5 waves**, minimum **8 sessions** serial, **~11 with parallelisation overhead**.

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SARB portal simulator unavailable or undocumented | Medium | +1–2 sessions | Use static schema validation against published BA form XSDs as a substitute; flag as open item in gate checklist |
| Vera Wave-4 pipelines surface unexpected violations requiring code fixes | Medium | +1–3 sessions | Scope each pipeline to pattern-match only; separate fix-up sessions from detection sessions |
| Governance seat handler wiring surfaces missing event types or payload schema gaps | Low–Medium | +1–2 sessions | Pre-check event-type registry coverage (`recon:event-type-registry-coverage`) before handler dispatch |
| M5–M7 NPA dispatch (in flight today) hits a blocker | Low | Delays Wave B product lifecycle e2e by 1 session | Atlas picks up manually from scaffold-commit if agent dies |
| IFRS 9 trigger integration requires new event types | Low | +0.5–1 session | Audit existing trigger schema surface before dispatch |
| CI parallelisation contention on shared infrastructure files | Low–Medium | +0.5 session per incident | Sequence handler dispatches strictly; use `recon:runtime-handler-sync` before each push |
| Pre-licence readiness gate criteria expand (regulatory finding or risk appetite change) | Low | +2–4 sessions | Lock gate definition as a CEO `Decision` event immediately (G10); changes require explicit CEO approval |

---

*Filed by Atlas (Core banking platform architect, engineering) — 2026-05-28*
*Authority: brief:atlas:s7-substrate-completeness-brief-current-state-se:2026-05-28*
