---
policy-parent: Governance Framework Policy (planned)
last-reviewed: 2026-06-25
procedureId: PROC-GOV-ADC-01
title: Agent domain-competence framework — knowledge bases, domain-truth oracles, and the premise-challenge duty
author: Owen (Company Secretary, governance)
date: 2026-06-25
owner: Owen (Company Secretary, governance)
status: POPULATED
authority: D-AGENT-DOMAIN-COMPETENCE
policy-cited: Governance Framework Policy (planned)
system-capability: "@platform/recon/agent-spec-domain-competence.ts"
---

# Procedure — Agent domain-competence framework

**Procedure ID:** PROC-GOV-ADC-01
**Owner:** Owen (Company Secretary, governance)
**Authority:** `D-AGENT-DOMAIN-COMPETENCE` (CEO-approved 2026-06-25)
**Approval:** CEO (decision); Vera (Internal audit engineer) sources independent domain-correctness assurance
**Cadence:** Continuous (per agent run + per dispatch); calibration cadence per §7
**Version:** v1.0 — 2026-06-25
**Status:** POPULATED

> **Engineering-Charter binding.** This procedure sits under the Engineering Integrity Charter (`D-ENGINEERING-INTEGRITY-CHARTER`). The domain-invariant gates and golden cases it specifies are harden-only ratchets (Charter cmd 3); knowledge bases are sourced, not hardcoded (cmd 4); gaps become typed events + register entries (cmd 5).

---

## 1. Why this exists — the gap this closes

The bank's recent FX accounting errors were **domain-MODEL failures, not engineering failures.** The code balanced, compiled, and passed every structural recon — but the accounting *concept* was wrong, and a wrong premise propagated from the orchestrator's (Scrooge's) brief to the executing agent **unchallenged.**

Structural correctness (a trial balance that balances; a byte-stable replay; a green `tsc`; a passing recon that asserts *shape*) is necessary but not sufficient. A result can be internally consistent and still be **domain-wrong**: a realised FX gain posted to a balance-sheet account balances perfectly and is still an IAS 21 violation. The autonomous-by-default model (Principle 6) means there is frequently no human in the loop to catch a wrong premise before it ships. This framework is the governance scaffolding that holds every standing seat to domain **truth** and makes rejecting a wrong premise a **duty**, not a courtesy.

**Scope.** This procedure defines the *pattern* and the *governance rules*. The accounting-specific knowledge base (IFRS 9 / IAS 21 / IAS 32 content), the accounting domain-invariant gates, and the accounting golden cases are populated by a separate pilot dispatched to Bea (Financial-accounting engineer) — this procedure is the framework that pilot instantiates.

## 2. Source policy and regulation

- Governance Framework Policy (planned; Owen) — the home policy for governance arrangements.
- King IV (Apply-and-Explain) — accountability and ethical-leadership principles: a governing body must satisfy itself that decisions are competently made.
- Banks Act 94 of 1990 s.60 — board responsibility for adequate, accurate information.
- Principle 6 (autonomous-by-default; humans oversee the residual) — because the seat is the decision-maker, the seat carries the competence duty.
- Principle 2 (single-graph discipline) — every knowledge-base source and every golden case is a citable node in the bidirectional graph.

The chain:

```
Regulation (Companies Act / Banks Act s.60 / King IV)
  → Governance Framework Policy
    → PROC-GOV-ADC-01 (this procedure — agent domain-competence framework)
      → @platform/recon/agent-spec-domain-competence.ts  (§18–§20 presence gate)
      → per-seat @platform/recon/<domain-invariant>.ts    (§19 (a) invariant gates)
      → per-seat golden worked-example library              (§19 (b) golden cases)
```

## 3. The six layers

The framework is six layers. Each seat instantiates all six for its domain; the first three live in the persona spec (§18–§20), the rest are operating reflexes plus a cadence.

| # | Layer | What it requires | Where it lives |
|---|---|---|---|
| 1 | **Knowledge bases** | Each seat binds to its domain STANDARDS + curated worked examples + decision frameworks, acquired and structured as citable Principle-2 graph nodes (extends `D-REGULATORY-LIBRARY-V1` from regulation to domain standards). | Persona spec §18 |
| 2 | **Domain-truth oracles** | The seat validates work against authoritative oracles / golden worked cases + domain-invariant gates, NOT just internal consistency. A consistent-but-wrong result is a finding. | Persona spec §19; per-seat recon gates + golden library |
| 3 | **Model-before-code** | The seat establishes and validates the domain MODEL (the accounting/risk/legal concept) against the §18 knowledge base *before* implementation. Traceability-before-code (Charter cmd 8 / Principle 2) applied to the domain concept, not just the citation. | Operating reflex; recorded in the model/design note before the build |
| 4 | **Adversarial domain review + premise-challenge duty** | A reviewer-class pass challenges the domain premise of the work; and every seat MUST challenge a wrong brief premise (§6). On domain questions the seat OUTRANKS the brief — including a brief from Scrooge. | Persona spec §20; reviewer→decider sync primitive |
| 5 | **Lessons-to-gates** | Every caught domain error becomes a golden case + a domain-invariant gate + a knowledge-base note — harden-only. The error can never recur silently. | §5 reflex; per-seat recon + golden library |
| 6 | **Calibration** | Periodic worked-case competency exams per seat re-prove the seat reproduces its golden cases and honours its invariants. | §7 cadence |

## 4. The golden-oracle + domain-invariant-gate HARNESS pattern (reusable)

This is the reusable spec every seat follows to build Layer 2. It has two halves; a seat's domain-truth validation (§19 of its spec) is **not complete** until both exist for the domain's load-bearing concepts.

### 4.1 (a) Domain-invariant recon gates — "an expert would never do X"

A domain-invariant gate is a `platform/recon/<name>.ts` pipeline (uniform `run(): ReconResult` contract) that reads **events / state / files** and asserts a rule an expert in the domain would never break. It is *independent of the engine that produced the result* — it does not import the engine's implementation (Vera's third-line independence rule), so a bug in the engine cannot also defeat its own check.

Construction rules:
1. State the invariant as a negative an expert asserts unconditionally — e.g. *accounting:* "a realised FX gain must never post to a balance-sheet account"; *risk:* "a netting set's PFE must never exceed gross exposure"; *legal:* "a contract characterised as an ISDA Master must never lack a governing-law election".
2. Implement it as a fail-closed gate: absence of evidence the invariant holds is a violation, not a pass (Charter cmd 2 — fail-closed by default).
3. Make it **load-bearing in CI** with a fixture test that proves the gate FAILS on a synthetic violation and PASSES on a clean case — a gate that cannot fail is not a control (precedent: `recon:no-residual-minor-encoding-fixture`).
4. Severity may launch at `warn` during grooming and lift to `fail` (harden-only); it never weakens without a recorded `Decision` (Charter cmd 3).

### 4.2 (b) Golden worked-example library

A golden case is an `input → expected-output` pair the seat's engine must reproduce **exactly**. Cases are drawn from (i) the §18 standards' own published worked examples (the most authoritative source — the standard-setter has already computed the right answer) and (ii) expert-validated bank cases.

Construction rules:
1. Each case names its **source** (which §18 standard / validated case) and **what it pins** (the treatment / number that must reproduce).
2. The engine is run against the case in a test; a divergence is a `fail`. The case is the oracle — when engine and case disagree, the case wins until a recorded Decision says otherwise.
3. Golden cases are append-only and harden-only: cases are added, never silently deleted or their expected values loosened.

### 4.3 How the two halves combine

Invariant gates catch the **unbounded** wrong (any output that violates the rule); golden cases catch the **specific** wrong (a known treatment computed incorrectly). Together they replace "the result is internally consistent" with "the result matches what the domain's authority says is correct." This is the same move the risk seat already made (validate against the standard's worked SA-CCR figures) and that the accounting seat had not — which is how the FX errors survived every structural gate.

## 5. The lessons-to-gates reflex

Every domain error caught — in review, in production, in an incident — triggers a **mandatory, harden-only** three-part response, recorded as typed events (no silent deferral, Charter cmd 5):

1. **Golden case** — the failing scenario is added to the seat's golden library with the now-known correct expected output. The error becomes a permanent regression test.
2. **Domain-invariant gate** — where the error reveals a general rule, a domain-invariant recon gate is added (or an existing one tightened) so the *class* of error is caught, not just the instance.
3. **Knowledge-base note** — the seat's §18 knowledge base records the lesson (the misread of the standard, the subtle treatment) so the reasoning, not just the test, is captured.

The reflex is harden-only: a caught error may only *add* gates/cases or *tighten* severity. Weakening or removing a gate/case requires an explicit recorded `Decision`. This is what makes a caught error un-repeatable rather than re-learnable.

## 6. The premise-challenge duty (Layer 4 detail)

On domain questions, **the seat's authority outranks the brief — including a brief from the orchestrator (Scrooge).** This inverts the failure mode that produced the FX errors (a wrong premise flowing brief → executor unchallenged).

Standing rules:
1. **Validate before implementing.** On receiving a dispatch brief, the seat validates the brief's domain premise against its §18 knowledge base *before* writing code.
2. **Confirm or challenge — explicitly.** The seat states CONFIRM or CHALLENGE on the premise, with a citation, as its first move. It does not begin implementation on an unconfirmed premise.
3. **Reject a wrong premise.** When the premise is wrong, the seat pushes back with the citing authority — it does not implement the wrong thing and flag it later. **Silent execution of a wrong premise is a finding.**
4. **Escalate unresolved disagreement.** Where the seat challenges and the orchestrator maintains the premise, the seat raises a typed escalation (its §10 channel) to the governance overseer with authority for the domain (per the CLAUDE.md decision-authority routing table) rather than silently complying. The disagreement is recorded, never dropped.
5. **Outranking is scoped.** The seat outranks the brief only on its own domain (the accounting seat on accounting treatment, the risk seat on risk-weighting, etc.). Outside its domain it defers.

## 7. Calibration cadence

Each seat re-proves its competence on a periodic worked-case competency exam:

- **Trigger:** quarterly per seat (agent-time: each agent's next scheduled quarterly tick), and on any material change to a §18 standard (e.g. an IFRS amendment).
- **Method:** the seat re-runs its full golden-case library and its domain-invariant gates against current engine code; every case must still reproduce and every invariant must still hold. New worked cases published by a §18 standard-setter since the last exam are added.
- **Output:** a typed pass/fail attestation (recorded via the agent-run lifecycle); a fail is a finding routed to the domain's governance overseer and to Vera.
- **Independence:** Vera samples and re-performs a subset of each seat's exam as third-line evidence (§9).

## 8. Dispatch-brief premise rule (proposed standing dispatch-discipline wording)

> **NOTE.** This is the *proposed wording* for a standing dispatch-discipline rule. Owen does **not** edit CLAUDE.md; Scrooge applies the integration into the "Dispatch discipline" section separately. This section is the proposal of record.

Proposed addition to CLAUDE.md → "Dispatch discipline":

> - **Domain-premise statement + challenge gate.** Every dispatch brief touching a substantive domain (accounting, risk, legal, treasury, financial-crime, etc.) MUST state its domain **PREMISE** explicitly, with a citation to the authority the premise rests on (a standard, an obligation, a prior Decision). The receiving agent MUST validate that premise against its §18 knowledge base and **CONFIRM or CHALLENGE it before implementing** — stating which, with a citation. On domain questions the receiving seat's authority **outranks the brief, including a brief from Scrooge**; a wrong premise must be rejected (push back with citation), not silently executed. Silent execution of a wrong premise is a Principle-1 / Engineering-Charter (cmd 8 — traceability-before-code) finding reportable by Vera. Authority: `D-AGENT-DOMAIN-COMPETENCE`; `PROC-GOV-ADC-01`.

Rationale for the wording: it makes the premise a *required, cited field* of the brief (so it cannot be implicit and unexamined), and it makes the confirm-or-challenge a *required first act* of the executor (so a wrong premise is caught at the boundary, not after the fact).

## 9. Vera's remit extension — process to domain-correctness assurance

`D-AGENT-DOMAIN-COMPETENCE` extends Vera's (Internal audit engineer, third line) remit from **process assurance** (does the artefact have the required sections / citations / events?) to **domain-correctness assurance** (is the artefact *right* for its domain?). Concretely, Vera:

- Asserts the structural presence of §18–§20 via `recon:agent-spec-domain-competence` (this procedure's `system-capability`).
- Samples and re-performs each seat's golden-case exams (§7) as third-line evidence — independently reproducing the standard's worked answer.
- Tests that the lessons-to-gates reflex (§5) actually fired after a caught domain error (golden case + gate + note all present), and that the harden-only property held.
- Surfaces a "domain-invariant gate that cannot fail" (no fixture proving it FAILs on a violation) as a finding — mirroring the structural "gate not load-bearing" finding.

Independence is preserved exactly as for the existing recon estate: no `@platform/recon/*` pipeline imports a domain engine's implementation; the gates read events, state, and files only.

## 10. Definition of done (for a seat's domain-competence instantiation)

A seat's domain-competence framework is *done* (per the Engineering-Charter Definition of Done) only when:

1. §18 lists the seat's authoritative standards as citable graph nodes (acquired per `D-REGULATORY-LIBRARY-V1`, or marked `(planned)` with a tracked gap).
2. §19 names ≥1 domain-invariant gate (load-bearing in CI via a fixture test) and ≥1 golden case for each load-bearing domain concept.
3. §20 states the seat's outranking scope and its confirm-or-challenge gate.
4. The lessons-to-gates reflex (§5) is wired (a caught error has a recorded path to case + gate + note).
5. The calibration cadence (§7) is scheduled.
6. `recon:agent-spec-domain-competence` passes for the seat (presence) and Vera has sampled the domain-correctness evidence (§9).

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-06-25 | Owen (Company Secretary, governance) | Initial framework under `D-AGENT-DOMAIN-COMPETENCE`: six layers, golden-oracle + domain-invariant-gate harness pattern, lessons-to-gates reflex, calibration cadence, proposed dispatch-premise rule, Vera remit extension. |
