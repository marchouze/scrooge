# Procedure — [Name]

**Procedure ID:** PROC-[domain]-[nn]
**Owner:** [Governance seat] · [Engineering seat]
**Approval:** [BRC / AC / RemCo / etc.]
**Cadence:** [Continuous / Daily / Per-event / Annual / On-trigger]
**Version:** [v1.0 — date]
**Status:** [Draft / Approved / In force / Deprecated]

## 1. Source policy

[Cite the policy this procedure implements, linking to its location.]

> Example: `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` § 4 (KYC / CDD / EDD Policy).

## 2. Source regulation(s)

[Obligations-register IDs and the underlying instruments, from `Regulations/_obligations-register.md`.]

> Example: `ORG-FC-02` (FIC Act s.21 — CDD before establishing relationship); `ORG-FC-04` (FIC s.21B — beneficial ownership).

## 3. Purpose

[One paragraph: what this procedure achieves and why it matters.]

## 4. Trigger

[What causes this procedure to run. Specific events, time-based schedules, signals from external systems, or human-initiated requests.]

> Example: `ClientCandidateRegistered` event arrives; or daily 06:00 UTC scheduler; or human reports a security incident.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | [What is done] | [`system` / `human` / `service`, with name] | [`@platform/<component>` or `PLANNED`] | [Decision criteria, edge cases] |
| 2 | … | … | … | … |
| 3 | … | … | … | … |

Each step must:

- Name the **actor** (typed: system, human, service, with the specific identity).
- Name the **system capability** it invokes (path under `/prototype/platform/` or production equivalent; or `PLANNED` with intended location).
- Identify any **human discretion** involved (e.g., "MLRO judges suspicion"). Discretion is captured as a typed event.

## 6. Reconciliation

[How we know the procedure was performed correctly. Specifically:]

- **Events produced:** [Typed events that result from this procedure, with their schemas in `/prototype/platform/event-store/`.]
- **Reconciliation check:** [What query / assertion confirms correctness — e.g., "every `ClientCandidateRegistered` results in either a `ClientAccepted` or `ClientRejected` within 30 days."]
- **Failure mode:** [What happens if the procedure fails or is incomplete.]

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| [What is produced] | [Where it lives — event log, projection, document] | [How long it is kept] | [PII / financial / regulatory tier] |

## 8. Manual steps

[List any manual steps. Each manual step must be justified — automation either impossible or not yet implemented. Manual steps are tracked exceptions under P2.]

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| [What can go wrong] | [How we detect it] | [Who is notified, in what timeframe] |

## 10. Related procedures

- [Cross-references to upstream / downstream procedures.]

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | [date] | [author] | Initial draft. |

## 12. Audit / assurance

[How this procedure is tested — by Vera (audit) and / or independent validation. Evidence of regular execution is itself an event consumed by Vera.]
