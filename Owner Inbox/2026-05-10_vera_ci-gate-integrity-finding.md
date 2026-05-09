---
title: "CI-gate integrity finding — pre-existing failures + merge-bypass pattern"
author: Vera (Internal audit / continuous-assurance engineer)
date: 2026-05-10
summary: >
  `cd prototype && bun run ci` fails on main HEAD (commit 67fc0d8) with one
  biome-formatter lint violation and three failing tests. Recent PRs continue
  to merge to main while the full CI battery is red. This finding investigates
  whether the gate is mis-configured, bypassed, or tolerating known-deferred
  failures, and frames the remediation choice for the CEO.
decision-required: true
decision-id: D-CI-GATE-INTEGRITY
decision-category: substrate-quality
decision-owner: Atlas (Core banking platform architect) + Devon (COO, governance — operational resilience)
decision-for-ceo: how to remediate (fix all four failures pre-merge of further work, or formally accept-with-deferral under a citation, or reconfigure the gate)
---

## §1 The finding

The PR-level CI workflow at `.github/workflows/pr-ci.yml` is configured to run
the full `bun run ci` battery (typecheck, lint, tests, citation-gate, recon
suite) against every PR opened to `main`. The script-definition in
`prototype/package.json` matches what the workflow invokes.

Despite this, `bun run ci` on main HEAD (commit `67fc0d8`) is RED, and PRs
continue to land. Atlas (Core banking platform architect) surfaced this in a
PR #101 dispatch report on 2026-05-10. The four named failures are:

1. **Biome lint violation** in
   `prototype/scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts`
   (introduced by PR #70).
2. **Test failure**: `mandate-ownership pipeline`.
3. **Test failure**: `Rohan (Risk engineer) backtest-harness — severity bands`.
4. **Test failure**: `Vera (Internal audit / continuous-assurance engineer)
   overnight-recon handler`.

Investigation populated below.

## §2 Reproduction

(populated after running `bun run ci` against main HEAD.)

## §3 Classification of each failure

(populated after reproduction and root-cause read.)

## §4 Merge-history audit

(populated after `gh pr list --state merged` audit of recent PRs.)

## §5 Root cause hypothesis

(populated after §1–§4.)

## §6 Recommended remediation

(populated after §5.)

## §7 Citation chain

- CLAUDE.md Principle 4 (security designed in from the start; secure SDLC
  explicitly includes an automated CI gate before merge).
- CLAUDE.md Principle 6 (no orphan capabilities; CI gate is the system
  capability that backs the procedure of "merge to main").
- PA / FSCA Joint Standard 1 of 2024 (Cybersecurity and Cyber Resilience) —
  control assurance and change-management discipline.
- IIA International Professional Practices Framework (IPPF) Standard 2120
  (Risk Management) and 2130 (Control) — internal audit's role in asserting
  the operating effectiveness of preventive controls.
