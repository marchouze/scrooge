---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T06:30:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-BANK-NAME-SELECTION, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-BANK-NAME-SELECTION`
- **Title:** Bank-name selection — final
- **Action:** approve
- **Outcome:** **The bank's name is "Lucet."** Approved on Linnea (Brand & design lead)'s v2 AI-themed shortlist (`Owner Inbox/2026-05-09_linnea_bank-name-v2-analysis.md`, PR #53), single recommendation. Latin *lucere* — "to shine, to be clear" — cognition / clarity-of-reasoning axis. Two clean syllables; pairs naturally with Linnea's brand palette; encodes a property true of *this* bank specifically (clarity of reasoning under an AI-driven operating model) rather than the generic-bank "settling" of the v1 Cadens recommendation.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "go with lucet" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_linnea_bank-name-v2-analysis.md` (PR #53)
- **Superseded options:** Cadens (Linnea v1 recommendation, `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md` § 1) — superseded by the AI-theme redo at the CEO's instruction.
- **Authority chain:** Brand-identity decisions sit at the *policy* layer of Principle 6's downward chain; "Lucet" propagates downward to *standard* (brand tokens, document templates, regulator-submission cover sheets), to *process* (every system-capability that surfaces the bank's name to a human or counterparty), and to *presentation* (logo wordmark, dashboard header, customer correspondence).

## Open gates carried forward (Linnea's v2 §3)

The decision proceeds with the following gate-checks queued — none blocks the name's adoption inside the build phase, but all must clear before licence-application lodgment:

1. **Trade Marks Act 194 of 1993 cross-check** — formal CIPC + TM search SA + key foreign jurisdictions for "Lucet" in Class 36 (banking / financial services). Owner: Imani (Legal-as-code engineer) + external counsel.
2. **Domain availability** — `lucet.com`, `lucet.co.za`, `lucet.ai`. Linnea flagged that `.com` may collide with Lucet Health (US healthcare-tech). Owner: Devon (COO, governance) — register via Tomas (Operations & payments engineer)'s domain-registrar substrate; if `.com` is taken, fall back to `lucet.bank` / `lucet.financial` / `lucet-bank.com` and flag for CEO confirmation.
3. **Banks Act s.22 use-of-name signals** — confirmation that "Lucet" carries no deceptive-similarity or unauthorised-implication risk under the Banks Act 94 of 1990. Owner: Imani + Mira (Compliance / RegTech engineer).
4. **SA 11-language sweep** — sanity-check across English, isiZulu, isiXhosa, Afrikaans, Sesotho, Sepedi, Setswana, siSwati, Tshivenda, Xitsonga, isiNdebele for offensive / unintended meanings. Owner: PAX (Role researcher) + Imani via the planned `naming-pre-clearance.md` procedure.

If any gate fails, a fresh decision card opens (`D-BANK-NAME-FALLBACK`) with Noeta and Synaps as the v2 fallback shortlist; do NOT re-run the full v2 analysis.

## Follow-on routes recorded

- `agent:Linnea (Brand & design lead) + agent:Atlas (Core banking platform architect) + agent:Anya (Data / analytics engineer)` — apply "Lucet" across the substrate. Update `prototype/dashboard/public/_brand.css` (any `--bank-name` token), `_shell.js` (any bank-name string), `home.html` (header text), `home.js` (any rendered name), and the logo placement in `prototype/dashboard/public/brand/logo-direction-{a,b,c}.svg` to render the Lucet wordmark. Also update the `<title>` tag pattern across all dashboard HTML pages. Substrate update only; no logical change.
- `agent:Owen (Company Secretary, governance)` — update `Owner Inbox/2026-05-06_governance-framework.md` and the persona / regulatory-correspondence templates with the bank's name. Cross-link to this decision record. Update `Owner Inbox/_styles.css` (Owner-Inbox HTML rendering) where the bank's name appears.
- `agent:Imani (Legal-as-code engineer) + external counsel` — formal Trade Marks Act 194 of 1993 search + Banks Act s.22 use-of-name analysis. Output: `Owner Inbox/<date>_imani_lucet-name-clearance.md`. Cadence: pre-licence-application gate.
- `agent:Devon (COO, governance) + agent:Tomas (Operations & payments engineer)` — domain registrations (`lucet.com`, `lucet.co.za`, `lucet.ai`); fallback to `lucet.bank` / `lucet.financial` / `lucet-bank.com` if `.com` is taken; brief CEO if any registration fails or surfaces a conflict (e.g. Lucet Health). Cadence: as soon as domain-registrar substrate is live.
- `agent:PAX (Role researcher) + agent:Imani (Legal-as-code engineer)` — SA 11-language sweep on "Lucet" via the planned `naming-pre-clearance.md` procedure. Cadence: pre-licence-application gate.
- `agent:Mira (Compliance / RegTech engineer)` — register entry for `urn:obligation:bank:gv:bank-name-registered:v1` under Domain GV (governance) of the obligations register, citing Companies Act 71 of 2008 + Banks Act s.22; status: `corporate-bind` per the rules-bind-at-commencement memory.
- `agent:CLAUDE.md` (curated by Scrooge) — update CLAUDE.md to refer to the bank by name where appropriate. Replace generic "the bank" references with "Lucet" only where the named identity adds clarity; the Principle / role / mandate prose stays unchanged.
- `agent:Linnea (Brand & design lead)` — produce a v3 brand package supplement at `Owner Inbox/<date>_linnea_lucet-brand-application.md` covering: full wordmark + lockup + favicon, palette adjustments (if any) for the "Lucet" wordmark on the chrome, voice/tone refinements specific to the chosen-name reality, sample document headers, sample regulator-cover-sheet, sample customer correspondence header. Logo Direction A (current active) — verify the final wordmark renders cleanly; if not, switch to B or C with rationale.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — same gap as D-M4-FX-SUB-DECISIONS (record written direct under Principle 7 fallback). Atlas (Core banking platform architect) v1.
2. **Follow-on-router auto-dispatch** — same gap (typed payload not yet read by a router handler).
3. **Naming-pre-clearance procedure** — `Procedures/by-policy/naming-pre-clearance.md` does not yet exist; Imani has noted it as a planned procedure. Owen (Company Secretary, governance) v1 substrate-stub.
4. **Domain-registrar substrate** — Devon + Tomas's domain-registrar substrate is not yet wired; manual registration acceptable for v0.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
