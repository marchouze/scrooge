---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T07:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-BANK-NAME-SELECTION, 2026-05-09 (revised)

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

This record **replaces** an earlier same-day Lucet record (PR #55, closed before merge) after the CEO reversed the name selection in chat. Per Principle 6 versioning discipline, no prior version is silently deleted; the supersession chain is recorded here.

## Supersession chain

| Version | Outcome | Source proposal | Status |
|---|---|---|---|
| v1 | **Cadens** | `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md` § 1 | Superseded by CEO redo instruction (AI-theme reframe) |
| v2 | **Lucet** | `Owner Inbox/2026-05-09_linnea_bank-name-v2-analysis.md` (PR #53) | Superseded by CEO chat-intake reversal before PR #55 merged; PR #55 closed |
| **v3 (current)** | **Hoz** | CEO chat-intake 2026-05-09 ("change name to Hoz / not lucet") | **Active** |

## Outcome

- **Decision ID:** `D-BANK-NAME-SELECTION`
- **Title:** Bank-name selection — final (revised)
- **Action:** approve (with override of Linnea (Brand & design lead)'s v2 single recommendation)
- **Outcome:** **The bank's name is "Hoz."** Three letters; one short, hard syllable. Not on Linnea's v1 or v2 shortlists — a CEO-direct selection. The brand package's typography and palette remain intact; the wordmark is shorter than any prior shortlist candidate, which has visual-identity implications Linnea is to address in a v3 brand package supplement.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "change name to Hoz / not lucet" — chat-intake 2026-05-09.
- **Authority chain:** Brand-identity decisions sit at the *policy* layer of Principle 6's downward chain. "Hoz" propagates downward to *standard* (brand tokens, document templates, regulator-submission cover sheets), to *process* (every system-capability that surfaces the bank's name to a human or counterparty), and to *presentation* (logo wordmark, dashboard header, customer correspondence).

## Open gates carried forward

The decision proceeds with the following gate-checks queued — none blocks the name's adoption inside the build phase, but all must clear before licence-application lodgment:

1. **Trade Marks Act 194 of 1993 cross-check** — formal CIPC + TM search SA + key foreign jurisdictions for "Hoz" in Class 36 (banking / financial services). Three-letter names in Class 36 are typically more contested than four-or-more-letter names; Imani (Legal-as-code engineer) + external counsel must surface any TM conflict early. Owner: Imani + counsel.
2. **Domain availability** — `hoz.com`, `hoz.co.za`, `hoz.ai`, `hoz.bank`, `hoz.financial`. Three-letter `.com` domains are extremely high-value (likely already registered or premium-priced); the realistic posture is `hoz.co.za` + `hoz.ai` or `hoz.bank` as the working domain set, with `.com` aspirational. Owner: Devon (COO, governance) + Tomas (Operations & payments engineer).
3. **Banks Act s.22 use-of-name signals** — confirmation that "Hoz" carries no deceptive-similarity or unauthorised-implication risk under the Banks Act 94 of 1990. Owner: Imani + Mira (Compliance / RegTech engineer).
4. **SA 11-language sweep** — sanity-check across English, isiZulu, isiXhosa, Afrikaans, Sesotho, Sepedi, Setswana, siSwati, Tshivenda, Xitsonga, isiNdebele for offensive / unintended meanings. Three-letter names carry higher false-positive risk in any natural language. Owner: PAX (Role researcher) + Imani via the planned `naming-pre-clearance.md` procedure.
5. **Pronunciation and disambiguation** — "Hoz" pronounces somewhat ambiguously across the bank's institutional-international audience (rhymes with "hose"? "haws"? "hoz" with a hard z?). A pronunciation guide and a one-line "say it as …" line in the brand package supplement would reduce friction. Owner: Linnea (Brand & design lead) — to address in the v3 supplement.
6. **AI-theme alignment** — "Hoz" carries no overt AI / agentic / cognition signal. The CEO has accepted that the name itself does not foreground the AI theme; the brand voice and tone (per Linnea's v1 brand package) carry the AI signal at the presentation layer rather than at the name layer. Linnea's v3 supplement should explicitly address how the brand voice carries the AI-driven identity since the name no longer does so on its own.

If any gate fails, a fresh decision card opens (`D-BANK-NAME-FALLBACK`) with the Linnea v2 shortlist (Lucet, Noeta, Synaps) as fallback options.

## Follow-on routes recorded

- `agent:Linnea (Brand & design lead) + agent:Atlas (Core banking platform architect) + agent:Anya (Data / analytics engineer)` — apply "Hoz" across the substrate. Update `prototype/dashboard/public/_brand.css` (any `--bank-name` token), `_shell.js` (any bank-name string), `home.html` (header text / wordmark), the logo SVGs in `prototype/dashboard/public/brand/logo-direction-{a,b,c}.svg` to render the Hoz wordmark, and the `<title>` tag pattern across all dashboard HTML pages. Three-letter wordmark — Linnea verifies that Direction A (the active concept) renders cleanly at three letters; if not, switch to B or C with rationale.
- `agent:Linnea (Brand & design lead)` — produce a v3 brand-package supplement at `Owner Inbox/<date>_linnea_hoz-brand-application.md` covering: full wordmark + lockup + favicon at three-letter geometry; pronunciation guide; voice/tone refinements that carry the AI-driven signal at the presentation layer (since the name no longer does); sample document headers; sample regulator-cover-sheet; sample customer correspondence header.
- `agent:Owen (Company Secretary, governance)` — update `Owner Inbox/2026-05-06_governance-framework.md` and the persona / regulatory-correspondence templates with the bank's name. Cross-link to this decision record. Update `Owner Inbox/_styles.css` (Owner-Inbox HTML rendering) where the bank's name appears.
- `agent:Imani (Legal-as-code engineer) + external counsel` — formal Trade Marks Act 194 of 1993 search + Banks Act s.22 use-of-name analysis on "Hoz". Higher-priority gate for three-letter Class 36 names. Output: `Owner Inbox/<date>_imani_hoz-name-clearance.md`. Cadence: pre-licence-application gate; upgrade priority given the three-letter risk.
- `agent:Devon (COO, governance) + agent:Tomas (Operations & payments engineer)` — domain registration: aim for `hoz.bank` or `hoz.co.za` + `hoz.ai` as the realistic working set; `.com` aspirational. Brief CEO if `.com` is unobtainable or if any registration surfaces a conflict.
- `agent:PAX (Role researcher) + agent:Imani (Legal-as-code engineer)` — SA 11-language sweep on "Hoz" via the planned `naming-pre-clearance.md` procedure. Higher false-positive risk for three-letter names; sweep is non-trivial.
- `agent:Mira (Compliance / RegTech engineer)` — register entry `urn:obligation:bank:gv:bank-name-registered:v1` under Domain GV (governance) of the obligations register, citing Companies Act 71 of 2008 + Banks Act s.22; status: `corporate-bind`.
- `agent:CLAUDE.md` (curated by Scrooge) — update CLAUDE.md to refer to the bank by name where appropriate. Replace generic "the bank" references with "Hoz" only where the named identity adds clarity; the Principle / role / mandate prose stays unchanged.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — same gap as D-M4-FX-SUB-DECISIONS (record written direct under Principle 7 fallback). Atlas (Core banking platform architect) v1.
2. **Decision-supersession trail** — the v1 → v2 → v3 chain is captured here in prose. The substrate-side `CeoDecision` event-stream should support a `supersedes` reference field so resolved-then-reversed decisions are first-class. Atlas v1.
3. **Three-letter-name risk surface** — TM Class 36 + 11-language sweep + pronunciation are higher-difficulty gates for three-letter names than for the longer Linnea v2 shortlist. Owner: Imani + counsel + PAX + Linnea.
4. **Naming-pre-clearance procedure** — `Procedures/by-policy/naming-pre-clearance.md` does not yet exist; Imani has noted it as a planned procedure. Owen v1 substrate-stub.
5. **Domain-registrar substrate** — Devon + Tomas's domain-registrar substrate is not yet wired; manual registration acceptable for v0.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
