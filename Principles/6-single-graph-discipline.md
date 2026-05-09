# Principle 6 — Single-graph discipline: presentations derive downward, capabilities justify upward

> *Consolidates the former Principles 6 (presentations derive from data) and 7 (implementation traceability), approved on 2026-05-06. Principle 2 (atomic citation discipline) remains separate; this principle is the structural rule about how those citations connect into a single graph.*

Every artefact in the bank — events, controls, procedures, system capabilities, policies, standards, regulator instruments, presentations — sits in a **single citable bidirectional graph**. The graph is testable from any node; no artefact exists outside it.

## Downward — presentations derive from data

The bank maintains a layered information hierarchy from foundation up:

**Data → Process → Standard → Policy → Presentation**

- **Data** — the event log and the projections derived from it (Principle 1). The canonical layer. Everything above is ultimately a function of this.
- **Process** — the coded workflows that act on data (Principle 3). Onboarding, monitoring, screening, posting, settlement, reporting, breach response — all are processes that operate on data and produce events.
- **Standard** — the technical and operational specifications that processes implement: ISO 20022 message standards, accounting policy mappings, encryption standards, screening rule specifications, identity protocols, data contracts.
- **Policy** — governance-approved rules that the standards must satisfy: AML / CFT policy, capital adequacy policy, conduct policy, information-security policy, privacy policy, model-risk policy. Approved through the governance framework.
- **Presentation** — every external artefact. Board packs, sub-committee packs, regulator submissions (BA returns, STRs, CTRs, FATCA / CRS XML), audited financial statements, AGM materials, investor decks, customer statements and notices, marketing materials, public disclosures.

Rules:

- External presentations are **summarised versions** of the internal stack. Nothing of substance is authored at the presentation layer that is not sourced from policy or below. A board pack is not an independent document — it is a query over policy outputs, which are queries over standard outputs, which are queries over process outputs, which are queries over data.
- Every presentation carries a **citation chain** to the policy / standard / process / data lineage that produced its content (this extends the atomic citation discipline of Principle 2 to external-facing artefacts).
- "Authoring" at the presentation layer is reserved for narrative explanation — never for new substance. New substance enters at data (an event) or at policy (a governance-approved change), and propagates upward.
- This applies even when convenient to violate: a regulator request, a board paper drafted overnight, a marketing claim. Where the data is not yet in the system, the data is added first (as an event); the presentation derives from it.
- Practically, financial statements, BA returns, board packs, STRs, FATCA / CRS XML, customer statements, and marketing claims are all **generated** — not assembled. Manual assembly is a tracked exception under Principle 3 and a flagged audit item.

## Upward — capabilities justify through procedure to regulation

The bank's regulatory obligations are discharged through a four-layer chain. Each layer reconciles to the layer above and below.

**Regulation → Policy → Procedure → System Capability**

- **Regulation** — the externally-imposed obligation. Lives in `/Regulations/` and surfaces in Mira's obligations register (`/Regulations/_obligations-register.md`).
- **Policy** — *what* the bank will do about the regulation. Governance-approved. Lives in the policy library (`Owner Inbox/2026-05-06_policy-register.md` and the bundle files). Each policy cites the regulation(s) it discharges.
- **Procedure** — *how* the bank does it. A procedure corresponds to an **action** (preferably automated) that a person or system performs. Lives in `/Procedures/`. Each procedure cites the policy it implements and names the system capability it relies on.
- **System capability** — the coded implementation that performs the procedure. Lives in `/prototype/` and eventually in production code. Each system capability declares which procedures it supports.

Rules:

- Policies say *what*; procedures say *how*; system capabilities do it. Without procedures, policies are aspirational. Without system capabilities, procedures are unenforced.
- Procedures must specify the **trigger**, the **steps** (each step naming the actor and the system capability), the **reconciliation** (how we know the procedure was performed correctly), and the **evidence / artefacts** produced.
- Where automation is possible, the procedure specifies the automated action; manual steps are exceptions tracked under Principle 2 with their own justification.
- The reconciliation is **bidirectional and testable**: given a regulation, the team can find every system capability that fulfils it; given a system capability, the team can find every regulation it serves.
- Vera (and the future CAE) consumes the chain end-to-end as continuous-controls evidence.

## No orphan functionality. No orphan procedures.

- Every system **capability** that exists in the bank — every API, every workflow, every projection, every screen, every report, every batch, every scheduled job, every integration — must have a **corresponding procedure** that names it. A capability without a procedure is unjustified and is either retired or properly procedure-bound.
- Every **procedure** must have an **owner whose mandate explicitly covers it**. The mandate lives in the owner's persona file under `/Team/` (engineering seats) or in the Governance Framework's executive structure (governance seats). A procedure whose subject-matter falls outside any mandate triggers either (a) a mandate amendment by the relevant governance seat, or (b) PAX research / Nolan hire if no suitable mandate exists.
- Mandate ownership is checked **bidirectionally**: each persona's areas of expertise should reconcile to a discoverable set of procedures the seat owns; each procedure's owner field must resolve to a real mandate covering its substance.
- Vera tests this discipline as part of continuous-controls assurance: orphaned capabilities and orphaned procedures are reportable findings.

## Operational substrate

Anya's **semantic layer** (the single citable definition of every named quantity), Mira's **obligations register** (the citation graph from policy to regulator instrument), Owen's **policy register** and **governance framework** (the policy-approval pathway), the **procedures index** (Owen + domain leads), the **persona / mandate library** (`/Team/`, curated by Scrooge), and Imani's **legal-entity tree** are how this principle is enforced. They are not optional.

This principle is the structural extension of Principle 2 (every action carries a citation): Principle 2 ensures each artefact has its anchor; this principle ensures the anchors form a single, testable, bidirectional graph with no orphans.

> **Principle-numbering history.** Between 2026-05-06 and 2026-05-07 there were six principles: old P6 and old P7 were consolidated into the current Principle 6 on 2026-05-06. On 2026-05-07 a new Principle 7 (autonomous-by-default) was added, returning the count to seven. Historical decision records, role briefs, and the actioned-decisions audit trail retain whatever numbering was current when written; living documents use the present numbering.
