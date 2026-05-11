# Procedure — CEO decision review

**Owner:** Owen (CoSec, procedural-discipline custodian) · Scrooge (Chief of Staff, orchestration)
**Source policy:** Governance Framework (`Owner Inbox/2026-05-06_governance-framework.md`) — CEO reserved-matter authority and the two-track approval convention (CEO / Board).
**Source regulation(s):** Companies Act 71 of 2008 (sections on directors' authority and the executive-board interface); BCBS Corporate Governance Principles for Banks; King IV.
**System capability:** `@platform/dashboard` (`prototype/dashboard/`) — the live bank operations dashboard.
**Status:** **POPULATED** (2026-05-06).

## Purpose

Define the procedure by which the CEO reviews and records executive decisions in a structured, citable, event-sourced way. Replaces ad-hoc decision capture in chat or email. Implements the atomic citation discipline (Principle 2) and the upward-chain integrity rule (Principle 2) for executive decisions.

## Trigger

Any of:
- A deliverable lands in `Owner Inbox/` requiring CEO sign-off.
- A team member surfaces a decision request via the next-decisions proposal cadence.
- The CEO initiates a decision (e.g. strategic-foundation directives).
- A scheduled re-confirmation is due (e.g. M-phase build re-authorisation gates).

## Steps

| # | Actor | Action | System capability |
|---|---|---|---|
| 1 | Author (any team member) | Drafts the deliverable that triggers the decision; surfaces it in `Owner Inbox/` and adds a corresponding entry to the dashboard state registry. | `@platform/dashboard` (registry write) |
| 2 | Scrooge | Confirms the registry entry has: clear decision-for-CEO statement, owner, trigger, source documents, and (where a recommendation is appropriate) a recommendation. | `@platform/dashboard` |
| 3 | CEO | Reviews the open-decision card on the dashboard; opens the decision modal; selects an action (Approve / Modify / Defer / Request revision); writes the outcome and any comment. | `@platform/dashboard` (decision modal) |
| 4 | `@platform/dashboard` | On submission, appends a `CeoDecision` event to the event store with citations to the Governance Framework and Companies Act, mutates the registry to move the decision from open → resolved, returns the event ID. | `@platform/event-store` · `@platform/dashboard` |
| 5 | Affected owners | Pick up the resolved decision from the dashboard / status summary regeneration; action accordingly. | `@platform/dashboard` (read) |
| 6 | Vera / Thandiwe (third-line) | Continuous-controls assurance over the decision-event stream: every CEO decision has a citation, every decision is reproducible at any past as-of date, no decision is recorded outside the system. | `@platform/recon` · `@platform/dashboard` |

## Reconciliation

The procedure is performed correctly when:

- Every executive decision is recorded as a `CeoDecision` event (verified by the citation gate and recon harness).
- The dashboard registry's `decisionsResolved` list reconciles to the event store's `CeoDecision` event count for the relevant period (off by zero on every recon run).
- Every resolved decision has a `sourceDoc` pointing to a real artefact in `Owner Inbox/`, `Team Inbox/`, or the policy / procedure libraries.
- No decision is taken outside this procedure; manual decision capture (chat, email, side-conversation) is a tracked exception under Principle 3.

Bidirectional reconciliation:
- Given a `CeoDecision` event → resolve to a registry entry → resolve to a source document → resolve to a policy or proposal layer → resolve to the regulator instrument creating the obligation (Principle 2, upward chain).
- Given an obligation in the register → resolve to a policy that discharges it → resolve to a decision that approved that policy → resolve to a `CeoDecision` event with citation.

## Evidence / artefacts produced

- `CeoDecision` events in the event store (canonical record).
- Registry updates in `seeds/dashboard-state.json` (cache, reproducible from events).
- Decision-record markdown in `Owner Inbox/` (human-readable presentation; per Principle 2, generated downward from the decision events at status-summary regeneration time).

## Citations

- Governance Framework — `Owner Inbox/2026-05-06_governance-framework.md` (CEO reserved matters; two-track approval).
- Companies Act 71 of 2008 (`COMPANIES-ACT-71-2008` in the obligations register).
- King IV — Principle 8 (governance functioning).
- BCBS — Corporate Governance Principles for Banks.
- The dashboard module README and procedure-binding citation in `prototype/dashboard/README.md`.

## What this procedure does *not* do

- It does not authorise the CEO to take *Board-reserved* decisions. Items requiring Board approval are routed via the Board (or Interim arrangements) under a separate procedure (to be drafted: `procedures-board-papers.md`, planned).
- It does not replace the Audit Committee / Interim Audit Forum approval pathway for items reserved to the AC (audit charter, audit plan, external auditor).
- It does not eliminate the deliberative phase before a decision is taken — proposals, recommendations, and stakeholder consultation still happen upstream of the modal.

## Mandate ownership

Owen owns the procedural discipline. Scrooge orchestrates the cadence (registry hygiene, decision routing). Atlas + Anya own the system capability (the dashboard module). Thandiwe + Vera assure the continuous-controls integrity of the decision-event stream as part of the third-line programme.

## Open follow-ups

- Auto-generation of resolved-decision markdown in `Team Inbox/actioned/` (today the resolved decisions live in the registry + event log; markdown is regenerated at next status-summary cycle).
- CEO-comment routing to affected team members (today the comment is recorded in the event payload but not fanned out as Team Inbox briefs).
- WebAuthn-bound CEO authentication at the dashboard (P4 — currently single-user localhost; Entra ID + WebAuthn at M8).
