---
title: Principles 2 and 6 — merge into single principle
author: Owen
date: 2026-05-11
summary: Merge the current Principle 2 (atomic citation discipline) and Principle 6 (single-graph discipline) into a single Principle 2 (Single-graph discipline), and renumber the current Principle 7 (autonomous-by-default) to Principle 6. The two principles already express the same rule at two scales — atomic citation at the edge, graph integrity at the whole — and the merge removes the ambiguity authors and recon harnesses currently encounter when picking which to cite.
decision-required: true
decision-id: D-PRINCIPLES-P2-P6-MERGE
decision-category: near-term
decision-owner: Owen (Company Secretary, governance)
decision-for-ceo: Approve the merge of Principles 2 and 6 into a single Principle 2 (Single-graph discipline), renumbering P7 (autonomous-by-default) to P6.
decision-recommendation: Approve. The two principles already cross-reference one another as the same rule expressed atomically vs structurally; the merge removes ambiguity and aligns the principle count with the way the team already reasons about the chain.
---

# Principles 2 and 6 — merge into single principle

**Author:** Owen (Company Secretary, governance)
**Reports through:** CEO
**Contributors / dependencies:** Anya (Semantic-layer engineer — semantic layer is named in the new principle's operational substrate), Mira (Compliance Engineer, obligations register owner — register is named in rule 1 and the operational substrate), Imani (Legal Engineer — legal-entity tree is named in the operational substrate), Vera (Internal Audit Engineer, third-line — citation-gate enforces atomic citation; one-shot scan after the follow-on PR), Scrooge (Chief of Staff — dispatches the follow-on in-place updates as a single mechanical PR).
**Date:** 2026-05-11
**For:** Marc (CEO)
**Authority:**
- 2026-05-06 prior P6+P7 consolidation precedent (old P6 "presentations derive" + old P7 "implementation traceability" merged into the current P6; same migration policy applied)
- Current P2 (`Principles/2-citation-discipline.md`) — atomic citation discipline
- Current P6 (`Principles/6-single-graph-discipline.md`) — single-graph discipline (which itself names P2 as the atomic complement: *"Principle 2 ensures each artefact has its anchor; this principle ensures the anchors form a single, testable, bidirectional graph with no orphans."*)
- Current P7 (`Principles/7-autonomous-by-default.md`) — autonomous by default (renumbered to P6 by this decision; substance unchanged)
- `Owner Inbox/_frontmatter-convention.md` — migration-policy precedent (living documents use present numbering; historical records retain numbering current at authoring)
**Status:** Specification only — no file change at this stage. The follow-on in-place updates land as a single mechanical PR by Scrooge after CEO approval.

> **Derivation note (Principle 6 — upward).** This brief sits at the *policy* layer: it changes the principle library that policies and procedures cite. The follow-on PR (a single mechanical sweep) sits at the *standard / process* layer. No system capability changes.

---

## 1. Why merge

Principle 2 and Principle 6 express the same rule at two scales.

- **Principle 2 — atomic citation.** Every artefact carries a typed citation to its source. The rule operates at the edge — one node, one citation.
- **Principle 6 — single-graph discipline.** Those citations connect into a single bidirectional graph with no orphans. The rule operates on the whole — every node reachable from every other.

P6 itself already concedes the relationship in its closing paragraph: *"Principle 2 ensures each artefact has its anchor; this principle ensures the anchors form a single, testable, bidirectional graph with no orphans."* The two are the same rule; one is read at the edge and one at the graph.

The cost of keeping them separate is concrete. Authors must pick which to cite; the team has been inconsistent. Recon harnesses under `prototype/platform/recon/` cite P2 for some integrity checks and P6 for structurally-identical ones. Persona-spec briefs sometimes cite both, sometimes one. Decision records surfaced in the last fortnight (e.g. Atlas's A2.2 cutover spec citing Principle 6 for "no orphan capability") would have been equally valid citing Principle 2; nothing in the substrate distinguishes which is correct, because there is no real distinction.

There is also a Marc framing that collapses the two further into a clean executable chain. Policy is the head of the executable chain. A policy is the bank's internal rule, sourced *either* from a regulation (external obligation, lives in Mira's obligations register) *or* from a bank objective (internal strategic choice, lives in the strategy register) — most policies will cite at least one regulation, but not all do, and the policy is the canonical head of the chain. A procedure executes the policy; a system capability (code) executes the procedure; the capability emits an outcome (a regulator submission, a board pack, a customer screen, a posted event). The single graph is exactly the chain that links those layers — and the citation is the edge type that makes any one layer reachable from any other.

Both directions of travel through the chain are equally load-bearing. Procedure → capability → outcome flows downward; the same chain must be navigable upward — every outcome justified by a policy, every policy traceable to a regulation or bank objective.

There is also recent precedent. On 2026-05-06 the old P6 (presentations derive) and old P7 (implementation traceability) were merged into the current P6 — the same surgery, with the same migration policy ("living documents use present numbering; historical records retain whatever numbering was current when written"). This decision applies the same pattern.

---

## 2. The merged principle (full text)

The text below is the proposed full content of the new `Principles/2-single-graph-discipline.md` file. The follow-on PR writes this content verbatim into that file (replacing the current `Principles/2-citation-discipline.md` and folding in the current `Principles/6-single-graph-discipline.md`).

---

### Principle 2 — Single-graph discipline

Every artefact in the bank — events, controls, procedures, system capabilities, policies, standards, regulator instruments, contracts, presentations — sits in a **single citable bidirectional graph**. The graph is testable from any node; no artefact exists outside it.

The graph has a single executable chain at its core, headed by policy and feeding through to outcomes:

```
Policy  ─►  Procedure  ─►  System capability  ─►  Outcome
(internal,  (action,        (code that          (event, report,
governance- actor +         performs the         presentation,
approved)   capability)     procedure)           customer screen)
   ▲
   │  sourced from one or both of:
   │
   ├── Regulation (external obligation, lives in Mira's obligations register)
   └── Bank objective (internal strategic choice, lives in the strategy register)
```

Policy is the canonical head of the executable chain. Every policy cites at least one upstream source — typically a regulation, but a bank objective is a sufficient source on its own. A regulation that does *not* yet have a policy is a finding (Mira's obligations register flags it); a policy that cites neither a regulation nor a bank objective is a Principle 2 violation.

Three non-negotiable rules — one atomic (citation), and two structural (one for each direction of travel through the graph; both directions are equally load-bearing):

#### Rule 1 — Atomic citation

Every node carries a typed, versioned citation to the node above it.

- Every policy cites at least one regulation or bank objective; every procedure cites a policy; every system capability cites a procedure; every outcome traces to a capability lineage.
- Citations are structured (urn / clause / version / as-of), held in Mira's obligations register, Owen's policy register, and the related canonical-source registers.
- A shared **obligations register** holds typed, versioned references: regulator + instrument + section + as-of date, or contract + clause, or internal policy + version. Every control and procedure links to one or more entries in the register. Compliance and internal audit consume those links directly. The register is curated by the compliance engineer as part of regulatory-change management; internal audit independently asserts the citation integrity.
- Code or content without a citation is by definition unjustified — it is either sourced or removed.

#### Rule 2 — Downward: every policy reaches a real outcome

Read the chain Policy → Procedure → Capability → Outcome top-down.

- A policy that does not decompose into one or more procedures is aspirational.
- A procedure with no implementing capability is unenforced.
- A capability that produces no outcome is dead code.
- Substantive content enters at policy (a governance-approved rule, sourced from a regulation or a bank objective) and propagates downward through standards / process / data into the outcome layer.
- **Outcomes are generated, not authored.** Board packs, sub-committee packs, regulator submissions (BA returns, STRs, CTRs, FATCA / CRS XML), audited financial statements, AGM materials, investor decks, customer statements and notices, marketing materials, public disclosures — all are queries over the layer below, never independent documents. "Authoring" at the outcome layer is reserved for narrative explanation; new substance enters at data (an event) or at policy (a governance-approved change).
- This applies even when convenient to violate: a regulator request, a board paper drafted overnight, a marketing claim. Where the data is not yet in the system, the data is added first (as an event); the outcome derives from it. Manual assembly at the outcome layer is a tracked Principle 3 exception and a flagged audit item.

#### Rule 3 — Upward: every outcome is justified by a policy

Read the same chain bottom-up.

- Every outcome (an event posted, a report sent to a regulator, a screen rendered to a customer, a contract clause signed) must trace back through capability and procedure to a named policy, and from there to its regulation or bank-objective source. An action without that upward trace is a rogue action — it has no defined reason, no accountability, no audit value.
- **No orphan capabilities.** Every system capability that exists in the bank — every API, every workflow, every projection, every screen, every report, every batch, every scheduled job, every integration — must have a corresponding procedure that names it. A capability without a procedure is unjustified and is either retired or properly procedure-bound.
- **No orphan procedures.** Every procedure must have an owner whose mandate explicitly covers it. The mandate lives in the owner's persona file under `/Team/` (engineering seats) or in the Governance Framework's executive structure (governance seats). A procedure whose subject-matter falls outside any mandate triggers either (a) a mandate amendment by the relevant governance seat, or (b) PAX research / Nolan hire if no suitable mandate exists.
- Mandate ownership is checked bidirectionally: each persona's areas of expertise should reconcile to a discoverable set of procedures the seat owns; each procedure's owner field must resolve to a real mandate covering its substance.
- The trace is testable from any leaf. Vera (Internal Audit Engineer, third-line) and the future Chief Audit Executive consume the chain end-to-end as continuous-controls assurance evidence.

#### Operational substrate

Anya's **semantic layer** (the single citable definition of every named quantity), Mira's **obligations register** (the citation graph from policy to regulator instrument), Owen's **policy register** and **governance framework** (the policy-approval pathway), the **procedures index** (Owen + domain leads), the **persona / mandate library** (`/Team/`, curated by Scrooge), and Imani's **legal-entity tree** are how this principle is enforced. They are not optional.

> **Principle-numbering history.** The principle library has been resequenced three times. On 2026-05-06 the old P6 (presentations derive) and old P7 (implementation traceability) were merged into a single Principle 6 (single-graph discipline), reducing the count from seven to six. On 2026-05-07 a new Principle 7 (autonomous-by-default) was added, returning the count to seven. On 2026-05-11 (this decision, `D-PRINCIPLES-P2-P6-MERGE`) the previous Principle 2 (citation discipline) and Principle 6 (single-graph discipline) were merged into the current Principle 2 (single-graph discipline), and the previous Principle 7 was renumbered to Principle 6, returning the count to six. Historical decision records, role briefs, and the actioned-decisions audit trail retain whatever numbering was current when written; living documents use the present numbering.

---

## 3. Renumbering table

| Before | After | File action |
|---|---|---|
| P1 events-are-truth | P1 events-are-truth | unchanged |
| **P2 citation-discipline** | **P2 single-graph discipline** | rewrite content per §2 above; rename file `2-citation-discipline.md` → `2-single-graph-discipline.md` |
| P3 cloud-native | P3 cloud-native | unchanged |
| P4 security-designed-in | P4 security-designed-in | unchanged |
| P5 multi-currency-entity-country | P5 multi-currency-entity-country | unchanged |
| **P6 single-graph-discipline** | — | delete file (content folded into new P2) |
| P7 autonomous-by-default | **P6 autonomous-by-default** | rename file `7-autonomous-by-default.md` → `6-autonomous-by-default.md`; update internal H1 from "Principle 7" to "Principle 6" |

Final count: **6 principles.**

---

## 4. Migration policy

The existing migration convention applies verbatim — no change:

> *Living documents use the present numbering. Historical decision records, role briefs from before the change, and the actioned-decisions audit trail retain whatever numbering was current when written.*

### 4.1 Update in place (living documents)

The follow-on PR sweeps these targets and updates them to the new numbering:

- `CLAUDE.md` "Architectural principles" section — collapse the seven-bullet list into six; rewrite the P2 line to reflect "single-graph discipline" and the new file name; remove the standalone P6 line; renumber P7 → P6.
- `CLAUDE.md` principle-numbering-history paragraph — extend the history note to record this 2026-05-11 merge alongside the prior 2026-05-06 P6+P7 merge and the 2026-05-07 P7 (autonomous) addition.
- `Owner Inbox/_frontmatter-convention.md` — currently cites "Principles 6 and 7"; update to "Principles 2 and 6" (the new P2 is single-graph; the new P6 is autonomous-by-default).
- Persona-spec files under `/Team/` — any file that cites P2 or P6 by number in sections 6–17 (operating spec proper). Vera's one-shot scan (see §5) produces the exact list.
- Recon-harness header comments under `prototype/platform/recon/` — any file whose header comment references P2 or P6 by number. Vera's one-shot scan covers these too.

### 4.2 Leave frozen (historical record)

These targets are *not* touched by the follow-on PR:

- Anything under `Owner Inbox/actioned/`.
- Superseded decision records (whether in `actioned/` or elsewhere).
- Old session memory files (e.g. `project_session_*.md`).
- Any `*-record.md` already emitted as a typed event — the event payload is canonical and immutable per Principle 1.
- The `archive/` tree (currently empty pending RMS Phase 4, but reserved as the destination for the legacy inbox folders).

---

## 5. Recon implications

Vera's `citation-gate` (run before every push per the Bank CLAUDE.md dispatch discipline) catches malformed citations automatically — it parses citation tokens, not principle numbers, so the gate is invariant under this merge. **No new recon harness is needed.**

After the follow-on PR lands, Vera (Internal Audit Engineer, third-line) runs a one-shot scan: grep for `Principle 2`, `Principle 6`, and `Principle 7` across living documents (everything outside `Owner Inbox/actioned/`, `archive/`, and superseded files). Expected hits:

- `Principle 2` — references to the new merged principle, valid.
- `Principle 6` — references to the new (renamed) autonomous-by-default principle, valid.
- `Principle 7` — zero hits. Any hit is a stale reference and is fixed in a follow-up sweep PR.

The scan is one-shot — not a standing pipeline — because the principle numbers are stable post-merge and the team's scrutiny rate at authoring time is high. If the scan surfaces a non-trivial backlog of stale references, Vera flags it as a finding and the standing harness is reconsidered at her next quarterly substrate-discipline opinion.

---

## 6. Implementation sequence (post-approval)

The follow-on is a **single mechanical PR by Scrooge**. Small, atomic, easy to revert. The sequence inside that PR:

1. **Rename + rewrite** `Principles/2-citation-discipline.md` → `Principles/2-single-graph-discipline.md`, with the full content from §2 of this spec.
2. **Delete** `Principles/6-single-graph-discipline.md` (content folded into the new P2).
3. **Rename + edit H1** `Principles/7-autonomous-by-default.md` → `Principles/6-autonomous-by-default.md`; change the H1 from "Principle 7 — Autonomous by default; humans oversee the residual" to "Principle 6 — Autonomous by default; humans oversee the residual". No other content change.
4. **Update `CLAUDE.md`** — the "Architectural principles" section bullet list (seven → six) and the principle-numbering-history paragraph.
5. **Update `Owner Inbox/_frontmatter-convention.md`** — the line citing "Principles 6 and 7" becomes "Principles 2 and 6".
6. **Sweep persona spec files and recon-harness header comments** — using the list from Vera's pre-PR scan, update any P2 / P6 number references in living documents to match the new numbering.
7. **Run `bun run citation-gate` from `prototype/`.** Zero violations required before push.
8. **Push, open PR, merge** — title and body cite this decision (`D-PRINCIPLES-P2-P6-MERGE`), not the spec markdown path.

---

## 7. Verification (post-implementation)

Six checks after the follow-on PR merges:

1. `cd prototype && bun run citation-gate` — zero violations.
2. `cd prototype && bun run recon` plus the targeted recons (`recon:agent-spec`, `recon:agent-spec-cross-link`, `recon:retention-citation-coverage`, `recon:permission-gate-default`) — all green.
3. `cd prototype && bun run ci` — full CI gate green.
4. Dashboard smoke (`bun run dashboard`, port 3010) — open the dashboard and confirm `D-PRINCIPLES-P2-P6-MERGE` appears in the resolved-decisions register; if a principles tile exists, confirm it reflects six principles.
5. Vera one-shot scan — grep `Principle 6` and `Principle 7` across living documents (everything outside `Owner Inbox/actioned/`, `archive/`, and superseded files). Expect zero hits referring to the old numbering (i.e. zero hits where `Principle 6` means single-graph or `Principle 7` means autonomous-by-default in a living-doc context).
6. Smoke read — open the new `Principles/2-single-graph-discipline.md` and the renamed `Principles/6-autonomous-by-default.md` and confirm both are coherent and self-contained.

If any verification step fails, Atlas / Scrooge revert the follow-on PR (single revert commit) and investigate. The principle library returns to its current seven-principle state pending a re-attempt.

—Owen
