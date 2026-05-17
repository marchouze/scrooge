---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T11:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-HOZ-DOMAIN-REGISTRATION-SET, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written-direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

- **Decision ID:** `D-HOZ-DOMAIN-REGISTRATION-SET`
- **Title:** Hoz domain registration — defer all activities
- **Action:** defer
- **Outcome:** **All domain-registration activities are deferred.** No working-set registrations (`.bank`, `.co.za`, `.ai`), no defensive-set registrations, no fTLD pre-application, no `.com` aftermarket bid, no registrar account openings. The complete §5 plan in Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)'s domain-registration plan (PR #73, merged) is held until a future cadence.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "defer all of the domain registration activities" — chat-intake 2026-05-09.
- **Source proposal:** `Owner Inbox/2026-05-09_devon-tomas_hoz-domain-registration-plan.md` (PR #73, merged)
- **Authority chain:** Refines `D-BANK-NAME-SELECTION` (Hoz, PR #57) and `D-LEGAL-ENTITY-TREE-V0` (PR #82) at the digital-presence layer.

## Rationale codified for the audit trail

The CEO has chosen to defer all domain activities at this cadence. Inferable rationale (the chat-intake message did not articulate it; capturing the operational read for downstream coherence):

1. **Name-clearance gates are still open.** Imani (Legal-as-code engineer)'s TM Act + Banks Act s.22 + CIPC + 11-language scoping (PR #76, merged) is pending counsel-execution. Registering domains before counsel ratifies the bank name creates rework if a gate fails and the name has to change (e.g. fallback to Lucet / Noeta / Synaps per Linnea (Brand & design lead)'s v2 shortlist).
2. **Build-phase has no public-facing domain need.** The bank UI is on `localhost:3010` during build-phase and will lift to Azure-internal at substrate-readiness. Public-facing domain identity is a licence-day-cadence concern, not a build-phase one.
3. **`.bank` fTLD verification is naturally licence-day-cadence.** The single domain that signals legitimacy to institutional counterparties cannot complete registration until SARB licence-day anyway. Pre-application could lock the string but at administrative cost; deferral accepts the (small) opportunistic-registration risk in exchange for cost-minimisation now.
4. **Cost-minimisation discipline.** Per memory `project_ai_driven_bank.md` build-phase posture: no real customers, no real capital, no real employees beyond statutory minimum; every committed cost (Anthropic API spend; cloud spend) is a real bill. Deferring ~$600 of year-1 domain costs is a small but coherent cost-discipline call.

## Operational consequences

- **Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)** — no registrar accounts opened; no WHOIS execution; no DNS configuration. Devon + Tomas's PR #73 plan stays as-authored as the spec-for-resumption when the deferral lifts.
- **fTLD pre-application** — not filed. Accept the opportunistic-registration risk on `hoz.bank` until the deferral is lifted.
- **Defensive set (6 variants)** — not registered. Accept the cybersquatting risk surface for the build-phase. The risk is bounded by: (a) the bank name "Hoz" is not yet publicly announced beyond the Owner Inbox + GitHub branch namespace; (b) the name-clearance gates have not closed, so the name may still change; (c) Imani's pre-clearance Gate-1 TM check at counsel-engagement will surface any active squatting before licence-application lodgment.
- **`.co.za` + `.ai`** — not registered. Plausibly available now (the August 2024 brand-name v2 supersession was Lucet→Hoz so any prior squatting on Hoz is unlikely); revisit at deferral-lift cadence and risk a small WHOIS-availability change.
- **Email-deliverability hardening** — not configured because no domain is registered. The DKIM / SPF / DMARC / DNSSEC discipline (PR #73 §4) is held until a domain is in hand.
- **Substrate-side (Tomas's domain-registrar adapter)** — Tomas's v1 substrate task (`prototype/` operations namespace) is not blocked by this decision; Tomas can author the substrate against a synthetic-domain-set during build-phase per the testing strategy memo (PR #75, merged). Substrate-readiness at deferral-lift cadence.
- **Substrate domains** — `prototype/dashboard/public/_brand.css` references no domains; only the bank-name-as-token. No substrate change owed by this deferral.

## Deferral-lift trigger

The deferral lifts at the **earlier of** (per Devon + Tomas to monitor; surface to Scrooge for Marc's attention):

1. **Counsel-cleared name-clearance** — Imani's external counsel ratifies "Hoz" against TM Act + Banks Act s.22 + CIPC + 11-language gates. At that point the name is locked and registrations carry no rework risk.
2. **Pre-licence-application gate proximity** — when the SARB licence-application lodgment cadence is set (Owen, Company Secretary, governance owns the application calendar), domain registrations need to happen ~3–6 months before lodgment so that fTLD verification can complete and Hoz Bank's regulator-facing email / web presence is in place.
3. **A counterparty-pull signal** — if Niko (Sales / CRM engineer)'s top-100 institutional-counterparty pipeline starts asking for a Hoz domain for verification, the deferral lifts.
4. **A cybersquatting incident** — if any of the variants in PR #73 §2 is opportunistically registered (Imani's TM-monitor catches), the deferral lifts on the affected variants for defensive registration.

## Follow-on routes recorded

- `agent:Devon (Chief Operating Officer, governance) + agent:Tomas (Operations & payments engineer)` — close PR #73's `decision-required: true` flag (PR #73 already merged; the decision-required frontmatter on the merged file should be flipped to `decision-required: false` with a deferral header). v0 acceptable: a small follow-up PR adds a "Deferred 2026-05-09 by D-HOZ-DOMAIN-REGISTRATION-SET" header to the plan file. No registrar work; just inbox hygiene.
- `agent:Imani (Legal-as-code engineer)` — note that the deferral-lift trigger (1) is the counsel-cleared name-clearance. The trigger lands when counsel returns the four-gate scoping outputs (PR #76, merged; counsel-execution still pending). Imani surfaces back to Devon + Tomas at that point.
- `agent:Niko (Sales / CRM engineer)` — note that the deferral-lift trigger (3) is a counterparty-pull signal. If Niko's institutional-counterparty pipeline (top-100 list per `Owner Inbox/2026-05-07_niko_top-100-sa-institutional-targets.md`) surfaces a counterparty asking for a Hoz domain for verification, Niko escalates.
- `agent:Owen (Company Secretary, governance)` — note that the deferral-lift trigger (2) is the SARB licence-application calendar Owen owns. When the lodgment cadence is set, Owen surfaces to Devon + Tomas with a 3–6 month lead-time.
- `agent:Linnea (Brand & design lead)` — note that the v3.2 sub-brand lockup work (D-LEGAL-ENTITY-TREE-V0 follow-on; Hoz Bank / Hoz Securities sub-brand variants) lands at brand cadence regardless of domain-registration deferral. The v3.2 work is not blocked by this deferral.

## Substrate gaps surfaced

1. **CeoDecision event substrate** — recurring; Atlas (Core banking platform architect) v1.
2. **Cybersquatting-monitor substrate** — would surface at the deferral period: Imani's TM-monitor and Tomas's domain-watch (a periodic WHOIS scan over the variants in PR #73 §2). Currently a v1 substrate task; the deferral makes it slightly more important to land before the next deferral-lift trigger fires.
3. **Domain-registrar adapter** (Tomas v1) — not blocked; can be built against synthetic-domain-set during build-phase per testing strategy.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved-deferred"` (or equivalent for deferral-as-decision) follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.

—Scrooge (Chief of Staff / Orchestrator)
