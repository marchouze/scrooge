---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-10T00:00:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-CI-GITHUB-PLAN-UPGRADE-DEFER, 2026-05-10

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file (event-substrate gap noted; written direct under Principle 7 "steady-state vs current substrate"); this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-CI-GITHUB-PLAN-UPGRADE-DEFER`
- **Title:** GitHub plan upgrade for branch-protection enforcement — defer (with reminder)
- **Action:** defer
- **Source proposal:** [Owner Inbox/2026-05-10_vera_ci-gate-integrity-finding.md](Owner%20Inbox/2026-05-10_vera_ci-gate-integrity-finding.md) (PR #103, merged 2026-05-10)
- **Outcome:** The plan-upgrade half of Vera (Internal audit / continuous-assurance engineer)'s remediation recommendation is **deferred**, not abandoned. The substrate-fix half (the four failing CI gates) is in flight separately under `D-CI-GATE-INTEGRITY` (Atlas (Core banking platform architect) executing). Until the plan-upgrade lands, the **operating posture** is: red CI is a blocker for merge even though merge is not gated by GitHub branch-protection — agent discipline holds the line. Memory captured at `project_github_plan_upgrade_pending.md` so the upgrade resurfaces on regulator-readiness, audit-prep, and substrate-quality reviews; licence-day cannot tolerate Principle 4 (security designed-in) gap on enforcement.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "Defer but remember need to upgrade" — chat-intake 2026-05-10.
- **Authority chain:** Operational-substrate / billing decision; not a regulatory bind in the build phase. The upgrade is a Principle 4 enforcement layer that becomes binding at licence-day; deferring during build phase is acceptable provided agent-discipline holds the operating posture.

## Trigger conditions for re-litigation

This deferral resurfaces (and may need reversal) on any of:

1. **Regulator-readiness gate** — pre-licence-application file assembly; SARB Prudential Authority would expect enforced branch-protection on the substrate that produces regulatory returns + capital calculations.
2. **Internal-audit prep** — Thandiwe (Chief Audit Executive)'s first risk-based audit plan; the unenforceable gate is a reportable IT-general-control finding.
3. **Substrate-quality push** — if agent-discipline drifts (a red CI merges that shouldn't have), the deferred posture loses its load-bearing assumption.
4. **Repo-visibility shift** — if the repo is made public for any reason (open-sourcing tooling, regulator transparency request, etc.), branch protection comes free and this defer auto-clears.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect)` — executing `D-CI-GATE-INTEGRITY` substrate-fix half (four failures); not blocked by this defer.
- `agent:Scrooge (Chief of Staff / Orchestrator)` — operating-rule reminder: dispatch agents must NOT merge a red-CI PR until either (a) CI is green or (b) Atlas confirms the failures are unrelated and the merge is intentional. This holds until the plan-upgrade lands.
- `agent:Vera (Internal audit / continuous-assurance engineer)` — record this deferral as a known-deferred item in the Wave-4 audit plan so it doesn't re-surface as a fresh finding on the next audit pass.

## Substrate gaps surfaced

1. **Branch-protection enforcement** — the original gap; the substrate-fix is plan-upgrade, deferred here.
2. **Agent-discipline as substitute for enforcement** — agents must read CI status before merging; today's eight-PR merge sequence under D-NEW-PRODUCT-APPROVAL-POLICY + D-EVENT-STORE-SCALING + D-PRODUCT-CONSTRUCTION-SUBSTRATE all merged with red CI per Vera's finding. Going forward, Scrooge gates this manually until the upgrade lands.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler (substrate-gap fallback: written directly by Scrooge in-session per Principle 7). The `CeoDecision` event is the canonical record once the v1 substrate lands; this markdown mirrors. Memory entry `project_github_plan_upgrade_pending.md` carries the cross-session reminder.

—Scrooge (Chief of Staff / Orchestrator)
