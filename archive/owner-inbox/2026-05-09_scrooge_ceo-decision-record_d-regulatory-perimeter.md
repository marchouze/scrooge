---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T10:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-REGULATORY-PERIMETER, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-REGULATORY-PERIMETER`
- **Title:** Regulatory perimeter per entity — bank to PA, securities to JSE, group not separately regulated
- **Action:** approve (CEO-direct posture statement; refines D-LEGAL-ENTITY-TREE-V0)
- **Outcome:** The CEO has stated the **regulatory perimeter per entity** in the Hoz group:

  | Entity | Primary regulator | Regulatory regime |
  |---|---|---|
  | **Hoz Bank Limited** | **SARB Prudential Authority** | Banks Act 94 of 1990 prudential regulations + Prudential Standards + Joint Standards (incl. JS 1 of 2024 cyber + JS 2 of 2024 op-resilience) + BCBS standards as applied by PA |
  | **Hoz Securities Limited** | **Johannesburg Stock Exchange (JSE)** | JSE Listings Requirements + JSE Equities/Bonds Membership Rules + STRATE participant rules. (FAIS Act + FSCA conduct standards apply secondarily where the securities entity provides advice / intermediary services to clients — counsel ratifies the FSCA-vs-JSE primary-supervisor allocation at the licence-application gate.) |
  | **Hoz Group Limited** | **Not separately regulated** | Companies Act 71 of 2008 (incorporation, group, related-party disclosures); subject to **consolidated-supervision look-through** by the SARB PA via Banks Act § 60+ — but the group itself does NOT hold a separate prudential / conduct licence in its own right. |

- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment (from chat):** "the bank will be subject to the prudential regulations of the SARB. The securities will be regulated by the Johannesburg Stock Exchange. The holding company group will not."
- **Authority chain:** Refines `D-LEGAL-ENTITY-TREE-V0` (resolved 2026-05-09; PR #82 record, merged) at the regulatory-perimeter layer. Resolves an open question that surfaced in PR #82 §3 ("Regulatory licence paths per entity") where the consolidated-supervision framing implied a more direct SARB regime over the group than the CEO has confirmed.

## What this clarifies (and corrects from earlier work)

The earlier records carried framing the CEO has now refined:

1. **PR #82 §3** said the group is "subject to consolidated supervision under Banks Act § 60+ + Joint Standard 1 of 2024 + BCBS principles". This stays *narrowly* true — the SARB PA has consolidated-supervision powers over the group **via the bank entity**, but the group is NOT a separately regulated / licensed entity. The PA does not directly license, supervise, or set prudential ratios at the group as a stand-alone — the PA "looks through" the bank to assess group-wide risk.
2. **PR #84 (Mira (Compliance / RegTech engineer) per-entity register scoping)** has 8 Domain Q "consolidated-supervision" URNs originally classified as `entity-scope: group`. **Re-classification is needed** post-this-decision:
   - URNs that genuinely impose on the group as a *registered company* (Companies Act incorporation; IFRS 10 group consolidated financial statements; IAS 24 related-party disclosures; SARB PA notification of change-of-control; parent-of-bank designation under Banks Act § 60) — these stay as `entity-scope: group` (the group, as a Companies Act entity, carries them).
   - URNs that are bank-prudential-obligations *measured at group level* (consolidated CGPs / consolidated ICAAP / consolidated ILAAP / consolidated recovery plan / consolidated cyber-resilience programme) — these reclassify to `entity-scope: bank` with an `applies-at: consolidated` field added to the register, OR a clarifying note that "the obligation binds on Hoz Bank Limited and is measured on a consolidated basis under PA look-through". This is a register-vocabulary refinement.
3. **The entity-tree v0 (PR #80)** describes Hoz Securities as "FSCA Authorised Dealer + Cat III FSP + JSE Equities & Bonds member + STRATE participant". The CEO's clarification places the **JSE as primary regulator** for the securities entity. FSCA / FAIS still applies secondarily where the securities entity provides advice — counsel ratifies the FSCA-vs-JSE primary-supervisor allocation at the licence-application gate (cross-references the closed D-FSP-LICENCE-NECESSITY decision).

## What this resolves

- **Hoz Group Limited regulatory posture** is now codified: Companies Act-only as a stand-alone entity; SARB consolidated-supervision look-through via the bank; no separate prudential / conduct licence.
- **Hoz Bank Limited regulatory posture** is unchanged from D-FSP-LICENCE-NECESSITY (Posture A; FSP licence pursued for advice/intermediary services in the bank-entity context — though re-reading, the FSP licence per D-FSP-LICENCE-NECESSITY may sit on Hoz Securities Limited rather than Hoz Bank Limited under this perimeter framing; counsel ratifies at licence-application gate). PA prudential regime is the primary lens.
- **Hoz Securities Limited regulatory posture** is JSE-primary, FSCA/FAIS-secondary. The JSE Membership Rules and Listings Requirements are the operative day-to-day regime.
- **Mira's register vocabulary** needs a small refinement: an `applies-at` field (values `entity-only` / `consolidated` / `look-through`) added to consolidated-supervision rows, OR the `entity-scope` value `consolidated-supervision` re-defined to mean "binds on Hoz Bank Limited, measured at group / consolidated level". Mira to choose.

## Follow-on routes recorded

- `agent:Mira (Compliance / RegTech engineer)` — refine the per-entity register scoping (PR #84, currently being rebased) **after** rebase lands. Re-classify the 8 Domain Q rows: keep parent-of-bank PA notification + IFRS 10 + IAS 24 as `entity-scope: group`; reclassify consolidated-CGPs / ICAAP / ILAAP / recovery / cyber as `entity-scope: bank` with an `applies-at: consolidated` annotation. Add the `applies-at` field to the entity-scope vocabulary section. Document the perimeter-table verbatim from this record. v0 acceptable; full register re-classification is the v1 substrate task already named.
- `agent:Imani (Legal-as-code engineer) + agent:Owen (Company Secretary, governance)` — update the entity-tree v0 (`Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`, merged) with the CEO's perimeter clarification. §3 (Regulatory licence paths per entity) becomes more precise: Hoz Group has Companies Act + Banks Act § 60 PA-notification / PA look-through but NO separate prudential licence; Hoz Bank has SARB PA Banks Act § 7 licence + prudential ratios + RAS / ICAAP / ILAAP at the entity-level; Hoz Securities has JSE Membership + STRATE + (secondarily) FSCA / FAIS.
- `agent:Helena (Chief Risk Officer, governance) + agent:Rohan (Risk engineer)` — group-level RAS framing changes. Earlier work assumed group-level RAS as a separate regulatory regime; now the framing is "RAS at the bank-entity level, measured on a consolidated basis where PA look-through applies". The substrate is similar (a single RAS that the bank reports at the entity level + a consolidated view); the legal framing is "this is bank-RAS not group-RAS".
- `agent:Saskia (Head of Global Markets, governance) + agent:Kai (Trading-systems engineer)` — Hoz Securities Limited's primary regulator is JSE, not FSCA. JSE Membership Rules become a higher priority obligation source than FSCA conduct standards for day-to-day operations. The trading-systems substrate (M-phase work) operates under JSE rules at the securities-entity level, supplemented by the bank's prudential controls for any positions held on the bank balance sheet.
- `agent:Atlas (Core banking platform architect)` — `LegalEntityRegistered` event family payload now includes `regulatoryRegime: { primaryRegulator: "PA" | "JSE" | "none-companies-act-only", regimeAnchor: string[] }`. v1 substrate task; promotes from D-LEGAL-ENTITY-TREE-V0 follow-on.
- `agent:Iris (Information Officer, governance)` — POPIA s.55 IO designation per entity stands. Each entity needs its own IO + Deputy under POPIA, regardless of the group's lighter regulatory posture (POPIA applies to *responsible parties* — the bank and securities entities are clearly responsible parties; the group as a holding company may also be a responsible party for its own minimal data processing).
- `agent:Bea (Accounting & financial reporting engineer)` — IFRS 10 consolidation at the group level remains a Companies Act + IFRS obligation on the group. This decision does not change the consolidation substrate; it clarifies that consolidated-supervision is a *prudential* concept (PA look-through), not a *financial-reporting* concept (which is IFRS-driven and applies to the group as a Companies Act entity).

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring; Atlas v1.
2. **Register vocabulary refinement** — the `applies-at` field on consolidated-supervision rows; Mira's PR #84 close-out task.
3. **`regulatoryRegime` on `LegalEntityRegistered`** — Atlas v1.
4. **JSE-primary vs FSCA-secondary supervisor-allocation for Hoz Securities** — counsel ratifies at licence-application gate; Imani follow-on routes via existing external-counsel scope.
5. **PA look-through framing in RAS / ICAAP / ILAAP** — Helena + Rohan substrate work; v1.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
