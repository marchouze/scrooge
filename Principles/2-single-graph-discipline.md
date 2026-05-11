# Principle 2 — Single-graph discipline

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
