---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-NEW-PRODUCT-APPROVAL-POLICY, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-NEW-PRODUCT-APPROVAL-POLICY`
- **Title:** New Product Approval Policy v1.0 — adopt
- **Action:** approve as drafted
- **Source proposal:** [Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md](Owner%20Inbox/2026-05-10_saskia_new-product-approval-policy.md)
- **Outcome:** Saskia (Head of Global Markets)'s New Product Approval Policy v1.0 transitions PLANNED → IN FORCE in the policy register. Binding on the next product attestation. The CEO ratifies first-product attestations during the interim period (until BRC is constituted post-licence-day per `D-THIN-HUMAN-LAYER-MINIMUM`); BRC is the steady-state primary approval authority. Board-Reserved-Matter triggers per §6 stand: new asset class outside strategic-foundation scope, new jurisdiction, first FAIS-licensed activity, first Cat II / IIA discretionary mandate, or BRC judgement of material change to franchise risk profile. Marc currently wears both CEO and Board hats interim per `feedback_ceo_vs_board_approval.md`.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve all 3" — chat-intake 2026-05-10.
- **Authority chain:** Governance / market-conduct policy (Principle 6 *policy* layer). Implements BCBS *Sound Practices for the Management of Operational Risk* (rev. 2021) §27, Banks Act 94 of 1990 + Regulations Relating to Banks Reg 39, FSCA Conduct Standards 1–3 of 2018 (particularly CS 3/2018 §§3–9), FIC Act 38 of 2001 CDD on first transaction. Propagates downward to *standard* (the 12-event product-lifecycle family registered under D-PRODUCT-CONSTRUCTION-SUBSTRATE), to *process* (the seven binding procedures listed in §10), and to *presentation* (Product Register projection, BRC packs, daily controlled-launch monitoring report).

## Follow-on routes recorded

- `agent:Owen (Company Secretary, governance)` — flip the policy register entry to IN FORCE; record adoption in the canonical-source registry; confirm the Board-Reserved-Matter triggers are reflected in the Governance Framework's reserved-matters schedule; cross-link the seven new procedures (5 owned + 2 cross-referenced new) into the procedures index.
- `agent:Saskia (Head of Global Markets) + agent:Devon (COO, governance)` — author the five planned procedures: `Procedures/by-policy/new-product-due-diligence.md`, `product-controlled-launch.md`, `product-post-implementation-review.md`, `product-retirement-migration.md`, `product-annual-review.md`. Each cites this policy as parent and names the substrate slices (under D-PRODUCT-CONSTRUCTION-SUBSTRATE) that perform the steps.
- `agent:Atlas (Core banking platform architect)` — registry the 12 typed events from §11 + §4 of the construction-substrate brief in `prototype/platform/event-types.ts` and `registry.ts`, with retention metadata per D-EVENT-STORE-SCALING (Slice 1). Sequence: this lands as Slice 2 of the construction substrate.
- `agent:Mira (Compliance / RegTech engineer)` — open obligations-register entries: BCBS Sound Practices §27 (operational-risk URN under Domain ORG-OR), Banks Act Reg 39 sub-clauses (`[register: route to Mira — confirm Reg 39 binds on product approval, populate Domain B URNs]`), FSCA Conduct Standard 3/2018 §§3–9 dimensional-coverage URNs under Domain L. Citation chain on each `ProductApproved` event must resolve. **[done in this PR — `Regulations/_obligations-register.md` v1.11; ORG-PR-26 BCBS Sound Practices §27 lands in Domain A (Domain ORG-OR not yet split; v1.11 banner notes a future register-schema-change pass may split Domain A); ORG-PR-24 + ORG-PR-25 Reg 39 umbrella + product-approval-binding rows land in Domain A; ORG-MK-14 FSCA CS 3/2018 §§3–9 dimensional-coverage URN lands in Domain J (Domain L is structurally Whistleblowing/Ethics — Domain J is the natural fit for FSCA conduct-standard markets coverage; sequencing note to Owen for canonical-source-registry path-resolution).]**
- `agent:Anya (Data / analytics engineer)` — Product Register projection: query over `ProductProposalRegistered` → `ProductRetired` events (Principle 1); BRC + CEO + Helena (CRO) + Camille (CFO) + Saskia + Devon read the projection.
- `agent:Saskia (Head of Global Markets)` — schedule M1 first-product attestation against the policy: `prd:bank:equity:jse-equity-cash`. Generates the substrate's first end-to-end run (14 dimensional attestations → `ProductDueDiligenceCompleted` → CEO-interim ratification → `ProductApproved`). Sequenced after Slices 1–4 of the construction substrate land.
- `agent:Bea (Accounting & financial reporting engineer) + agent:Mira + agent:Senna (Security engineer) + agent:Nadia (Independent-validation engineer) + agent:Imani (Legal-as-code engineer) + agent:Zara (Chief Compliance Officer) + agent:Iris (Information Officer) + agent:Yael (Tax engineer) + agent:Rohan (Risk engineer) + agent:Helena (CRO) + agent:Camille (CFO) + agent:Devon (COO)` — each named as the per-dimension attestation owner per §5; each agent's spec is updated to register the `ProductDimensionAttested` emit responsibility for its named dimension(s).
- `agent:Vera (Internal audit engineer)` — register the attestation-integrity recon (Slice 8 of the construction substrate) as a Wave-4 finding stream; surface orphan attestations and missing dimensions as findings.

## Substrate gaps surfaced

1. **BRC not yet constituted.** First-product approvals run on the CEO-interim authority track until post-licence-day per `D-THIN-HUMAN-LAYER-MINIMUM`; the policy's `approvalAuthority: "CEO-interim"` payload value is the canonical record.
2. **Per-dimension attestation agents.** Several dimensions still depend on substrate that does not yet exist (capital-impact RWA-delta engine pending Rohan; model-risk attestation pending Nadia methodology library). Until those land, the policy attestation runtime falls back to manual-attestation cards per `Slice 7` of the construction substrate.
3. **Counterparty onboarding paused.** Niko's lifecycle is paused per `project_ai_driven_bank.md`. The policy's *AML* and *conduct* gates run on synthetic counterparty fixtures pre-licence-day.
4. **Procedures planned, not authored.** The five owned procedures and two cross-referenced new procedures are PLANNED. They author over the next agent ticks per the routes above.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; this markdown mirrors. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
