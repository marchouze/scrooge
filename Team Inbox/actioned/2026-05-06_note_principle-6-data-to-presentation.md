# Team note — Principle 6: Single source of truth; presentations derive from data

**Author:** Scrooge (relaying CEO directive)
**Date:** 2026-05-06
**For:** All team members

## CEO directive (verbatim)

> Single source of truth — external presentations must be summarised versions of internal documents / databases. **Data → Process → Standard → Policy → Presentation.**

## Status

This is now **Principle 6** in `CLAUDE.md`, alongside the existing five. It binds every team member and every deliverable.

## What this means in practice

- **Data** is canonical (P1's event log and projections).
- **Process** is coded workflow (P3).
- **Standard** is the technical / operational spec the process implements.
- **Policy** is governance-approved rules the standards must satisfy.
- **Presentation** is everything external: board packs, regulator submissions (BA returns, STRs, CTRs, FATCA / CRS XML), financial statements, AGM, investor decks, customer notices, marketing.

External presentations are summarised derivations. Nothing of substance is authored at the presentation layer — it derives from policy and below. Every presentation carries a citation chain back through the stack (extends P2).

## Direct implications by seat

- **Anya** — your semantic layer is the operational infrastructure of P6. Every named quantity in the bank is defined exactly once and consumed everywhere. Presentations query the semantic layer; they do not redefine.
- **Mira** — the obligations register is the spine of the citation chain. Every policy cites a regulator instrument; every standard cites a policy; every process cites a standard; every presentation cites the policy it derives from.
- **Owen** — board and committee packs are queries. The governance framework you co-author with Helena must specify *generation*, not *assembly*, of every governance artefact. Manual narrative is permitted as explanation only, never as new substance.
- **Helena** — the RAS / RAF document is itself a presentation; the operational limits and KRIs are the policy-and-standard layer; appetite-in-force is data. The board RAS is a summary of the operational stack, not the other way around.
- **Camille** — financial statements, BA returns, AC packs are all **generated** from Anya's projections through Bea's sub-ledger architecture. You sign the generated output; you do not author a parallel set.
- **Zara** — RMCP, compliance plans, monitoring outputs, regulator submissions are queries over Mira's pipelines. STR / SAR / CTR / TPR submissions are generated; you exercise judgement as a typed event in the workflow.
- **Iris** — privacy notices, PAIA manual, breach notifications, data-subject responses are all generated from the lawful-processing register and the event log. Notices are summaries of internal policy and processing activities.
- **Devon** — operational MI, change reports, incident reviews, resilience-test outputs are queries. The platform's operational story to the board is a generated artefact.
- **Bea, Yael, Ravi** — your respective sub-ledgers, tax submissions, and treasury / ALCO packs are generated from the event log. Reconciliation harnesses run in CI to ensure the chain holds.
- **Atlas** — the platform must support generation of presentations as a first-class capability. Reporting is not an afterthought layer; it is core platform.
- **Senna** — security artefacts (threat models, SBOMs, IR reports, breach notifications) are generated from continuous attestation events. POPIA breach notifications use Iris's regulator-facing wording; the data is generated.
- **Kai, Tomas, Niko** — customer-facing statements, settlement confirmations, advice records, and marketing material derive from product policy and event-level data. Marketing claims are validated against data.
- **Vera** — your continuous-controls evidence is itself a generated presentation; lineage queries are your audit trail. The audit opinion that ultimately reaches the AC is a summary of the evidence stack.
- **Imani** — contracts and constitutional documents are themselves *standards* in the hierarchy when they bind counterparties. Customer-facing documents (statements, notices, terms) are generated from the legal-as-code library.
- **Sade** — payslips, fit-and-proper attestations, employment letters are generated. The org chart is a generated projection of HCM events (per the org-structure brief).
- **PAX, Nolan** — role briefs and persona files are themselves a small instance of the same hierarchy: the persona is a *standard*, the brief is a *policy*, the role on the chart is a *presentation* derived from it.

## What changes for in-flight work

No reassignments. But several deliverables already in flight tighten under this principle:

- **Sade's org structure** — already specified as a projection over HCM events. Reinforced: the org structure rendered as a chart is a presentation; the events are the data.
- **Helena's governance framework** — must specify the generation pathway for every committee pack, every charter review, every board paper. No spreadsheet-built artefacts.
- **Helena's RAS / RAF** — board RAS is the presentation; operational limits are policy / standard; live limits and breaches are data. The chain must be explicit.
- **Mira and Anya's client master + continuous KYC** — KYC outcomes and client records are data; the client-master query and onboarding decisions are presentations of that data; nothing about a client is authored at the presentation layer.

## Action

No deliverable changes hands; no deadline shifts. Each lead reviews their in-flight work for compliance with Principle 6 and flags back to Scrooge any place the principle cannot be honoured (so the exception can be tracked under P2 or the design adjusted).

Scrooge tracks. Marc receives outcomes.
