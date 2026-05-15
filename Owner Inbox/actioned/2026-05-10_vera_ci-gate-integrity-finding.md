---
title: "CI-gate integrity finding — pre-existing failures + merge-bypass pattern"
author: Vera (Internal audit / continuous-assurance engineer)
date: 2026-05-10
summary: >
  `cd prototype && bun run ci` fails on main HEAD (commit 67fc0d8) with one
  biome-formatter lint violation and three failing tests. Investigation shows
  twenty consecutive PRs (#82–#101) merged with `conclusion: "FAILURE"` on
  the registered "ci" check. Branch protection cannot be configured on this
  repo's current GitHub plan (private repo, free tier — Pro / public required
  for protection rules), so the gate runs but is unenforceable. Substrate
  failure of a Principle-4 secure-SDLC preventive control. Atlas + Devon to
  decide remediation path: fix-and-keep / accept-with-deferral / change
  enforcement substrate (e.g. flip repo public, GitHub Pro, or a self-hosted
  pre-merge enforcer).
decision-required: true
decision-id: D-CI-GATE-INTEGRITY
decision-category: substrate-quality
decision-owner: Atlas (Core banking platform architect) + Devon (COO, governance — operational resilience)
decision-for-ceo: choose remediation path — (i) fix the four failures and re-establish green main; (ii) flip repo public OR upgrade to GitHub Pro to enable branch protection; (iii) build a self-hosted pre-merge enforcer; or (iv) formally accept-with-deferral under a Principle-2 citation
---

## §1 The finding

The PR-level CI workflow at `.github/workflows/pr-ci.yml` is configured to
run the full `bun run ci` battery (typecheck, lint, tests, citation-gate, and
nine recon pipelines) against every PR opened to `main`. The script in
`prototype/package.json` matches what the workflow invokes — gate-config
itself is sound.

Despite this, `bun run ci` on main HEAD (commit `67fc0d8`) is **RED**, and
PRs continue to land. Atlas (Core banking platform architect) surfaced this
in a PR #101 dispatch report on 2026-05-10. Vera reproduced it.

The four named failures are:

1. **Biome lint violation** in
   `prototype/scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts`
   (introduced by PR #70 — `compliance(register): FAIS Posture A — ORG-FAIS-KI
   closed + 5 record-keeping URNs (D-FSP-LICENCE-NECESSITY)`).
2. **Test failure**: `mandate-ownership pipeline > recognises governance
   seats and personas as valid owners`.
3. **Test failure**: `runtime — Rohan (Risk engineer) backtest-harness —
   severity bands per fixture > fixture 'amber' produces severity amber`.
4. **Test failure**: `runtime — Vera overnight-recon handler` (two `it`
   blocks: `runs all pipelines and reports ok` + `writes a deliverable when
   not in dry-run mode`).

The merge-history audit in §4 below shows that **PRs #82 through #101
inclusive (twenty consecutive PRs) merged with `conclusion: "FAILURE"` on
the registered "ci" check**. The CI gate runs, reports red, and is ignored.

## §2 Reproduction

Working tree: `claude/ci-gate-integrity-finding` rebased on main `67fc0d8`.

```text
$ cd prototype && bun run ci
$ bunx tsc --noEmit          # typecheck — PASS (silent)
$ biome check .              # lint
./scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts format ━━━━━━

  × Formatter would have printed the following content:

    51 51 │   const obligationsCount = (next as unknown as { ... }).bank
    52 52 │     ?.metrics?.obligations;
    53    │ - console.log(`Re-derived·dashboard·state.…`);
       53 │ + console.log(
       54 │ + ··`Re-derived·dashboard·state.…`,
       55 │ + );

Checked 193 files in 94ms. No fixes applied.
Found 1 error.
error: script "lint" exited with code 1
error: script "ci" exited with code 1
```

Because `bun run ci` chains gates with `&&`, **the lint failure short-
circuits before tests run**. Running `bun test` standalone reproduces the
three test failures:

```text
$ bun test
…
(fail) mandate-ownership pipeline > recognises governance seats and personas
       as valid owners [0.84ms]
       Received: [{
         "message": "Procedure has no parseable Owner field",
         "severity": "fail",
         "subject": "counterparty-institutional-eligibility-screening.md",
       }]

(fail) runtime — Rohan backtest-harness — severity bands per fixture >
       fixture 'amber' produces severity amber [2.78ms]
       Expected: 1   Received: 2
       Handler logged: sevCounts:{red:1} eventsEmitted:2  ← classified as RED

(fail) runtime — Vera overnight-recon handler > runs all pipelines and
       reports ok against the live repo [141.20ms]
       Expected: true   Received: false

(fail) runtime — Vera overnight-recon handler > writes a deliverable when
       not in dry-run mode [136.76ms]
       Expected: true   Received: false

 392 pass · 3 fail (4 it-block failures) · 3165 expect() calls · 31 files
```

(The `bun test` output groups the two Vera `it` blocks under a single
"failing test" headline, matching Atlas's count of three. Counted as `it`
blocks, the failures are four; counted as named tests, three. Both framings
appear in this finding.)

## §3 Classification of each failure

Classification scheme:
- **(a)** Reproducible & blocking — the gate should be red, why isn't it?
- **(b)** Reproducible but flaky — non-deterministic; mitigation strategy
- **(c)** Tolerated / known-deferred — there's an explicit deferral with
  a Principle-2 citation
- **(d)** Not reproducible — environment differs from main

### Failure 1 — biome lint violation in `derive-dashboard-state-2026-05-09-fais-posture-a.ts`

**Classification: (a) Reproducible & blocking.**

`bun run lint` fails with one biome formatter violation. No deferral
citation exists in the file or in any companion accept-with-deferral note.
Introduced by PR #70 (merged `2026-05-09T07:20:43Z` by `marchouze`,
empty `statusCheckRollup` — the `pr-ci.yml` workflow did not yet exist at
that time; it was added 09:27 UTC same day in PR #18).

**Why fail isn't blocking merges**: lint is short-circuited inside `bun run
ci`, so subsequent gates (tests, recon) don't even run. But the gate itself
*does* report red on every subsequent PR — the merges proceed because
branch protection is not enforcing the check (see §5).

**Trivial to fix** — `biome format --write
./scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts`.

### Failure 2 — `mandate-ownership pipeline` test

**Classification: (a) Reproducible & blocking.**

The procedure file
`Procedures/by-policy/counterparty-institutional-eligibility-screening.md`
(introduced by PR #77, merged 2026-05-09T07:26:15Z, empty
`statusCheckRollup` — pre-`pr-ci.yml`) has an `Owner` field with composite
syntax that the recon parser does not recognise:

```yaml
owner: Niko (Sales / CRM engineer) + governance-line: Saskia (...) + Zara (...)
```

The recon (`platform/recon/mandate-ownership.ts`) reads the procedure files
and tries to resolve each named owner. The "Owner" extraction expects a
simpler shape (single-name or comma-separated) and the `+ governance-line:`
prefix construct yields no parseable owners — surfaces as `"Procedure has
no parseable Owner field"`.

**Either** the parser must be extended to handle the dual engineering /
governance-line syntax (which is now an established convention — see
`Procedures/_owner-conventions.md` and other procedures using the same
shape), **or** PROC-CRM-CIE-01's `owner:` field is rewritten to a shape the
parser already accepts. Bidirectional traceability under Principle 6
mandates one of those two — the procedure is real and load-bearing under
D-FSP-LICENCE-NECESSITY; it cannot be deleted to make the recon green.

### Failure 3 — `Rohan backtest-harness — fixture 'amber' produces severity amber`

**Classification: (a) Reproducible & blocking.**

Runs in test-file isolation. The amber fixture (`tests/fixtures/backtest-
ecl/index.ts`, fixture B) is documented to produce severity = amber:
predictionCount = 10, expected = 0.5, observed = 1, ratio = 2.0 → amber
band (1.5 < r ≤ 3.0). The handler logs `sevCounts:{red:1} eventsEmitted:2`
when this fixture runs — the handler classified amber as red and emitted
the additional `RiskRaised` (the second event). The test asserts
`eventsEmitted === 1` for non-red severities and fails.

Possibilities (Rohan to disambiguate; not Vera's call):
- Calibration drift between the fixture-arithmetic comment and the actual
  `predictionPoints()` count (off-by-one in the iteration cap could yield
  predictionCount ≠ 10, shifting expected and the resulting ratio).
- A handler-level change that altered the band-classification thresholds
  without updating the fixture.
- A subtle as-of leak inside the same test file (the prior `it` block
  seeded `fixtureWithinTolerance`; the singleton `eventStore` retains
  events across `it` blocks — but entity isolation should prevent leakage).

Introduced by which PR — PR #65/#71/etc. (Rohan's S7-Targeted #4 series).
Test reliably fails in isolation, so this is not a flake.

### Failure 4 — `Vera overnight-recon handler` (both `it` blocks)

**Classification: (a) Reproducible & blocking — but causally downstream of
Failures 2 and 3.**

The Vera overnight-recon handler runs the full recon suite end-to-end and
returns `{ ok: true }` only when every pipeline reports zero `fail`-severity
violations. The live run logs `7 fail violations across 3 pipelines` —
mandate-ownership (Failure 2 above) is one of the contributing pipelines.
The handler is doing exactly what its spec calls for. The test failure
disappears when Failures 2 (and the other two pipeline failures the handler
is detecting) are fixed.

This means **Failure 4 is not an independent defect** — it is the second-
line recon correctly detecting Failure 2 and refusing to silently pass.
This is the audit substrate working as designed; the surface failure is
*the gate's only-green-when-substrate-is-clean* contract.

The other two pipelines failing are visible in the run log but not named
in Atlas's report; Vera should run the full recon suite and surface them
as siblings of the mandate-ownership finding.

**Summary table:**

| # | Failure | Classification | Owner to fix |
|---|---|---|---|
| 1 | Biome lint in derive-dashboard-state…fais-posture-a.ts | (a) reproducible-blocking | Atlas (originating PR #70 author) |
| 2 | mandate-ownership pipeline | (a) reproducible-blocking | Niko (PROC-CRM-CIE-01 owner) + Vera (parser extension) |
| 3 | Rohan backtest-harness amber fixture | (a) reproducible-blocking | Rohan (Risk engineer) |
| 4 | Vera overnight-recon handler | (a) reproducible-blocking *but downstream of #2* | Auto-resolves once #2 lands |

None of the four are flakes. None carry an explicit deferral citation. None
are environment-specific (Atlas's environment matches main; this finding
reproduced in a fresh worktree of main `67fc0d8`).

## §4 Merge-history audit

`gh pr list --state merged --limit 25 --json number,title,statusCheckRollup,mergedAt`
on 2026-05-10 yields:

| PR # | Merged at (UTC) | "ci" status | Title |
|---|---|---|---|
| 101 | 09:04:06 | **FAILURE** | substrate(events): register 4 M1 event types in registry.ts (D-EVENT-STORE-SCALING Slice 1 prerequisite) |
| 100 | 09:04:03 | **FAILURE** | inbox: PAX role-brief — Compliance Lead (D-THIN-HUMAN-LAYER-MINIMUM) |
| 99  | 09:04:00 | **FAILURE** | inbox: PAX role-brief — Independent Chair (D-THIN-HUMAN-LAYER-MINIMUM) |
| 98  | 09:03:57 | **FAILURE** | inbox: PAX role-brief — NED #3 (D-THIN-HUMAN-LAYER-MINIMUM) |
| 97  | 09:03:54 | **FAILURE** | inbox: PAX role-brief — NED #2 (D-THIN-HUMAN-LAYER-MINIMUM) |
| 96  | 09:03:51 | **FAILURE** | inbox: PAX role-brief — Company Secretary (D-THIN-HUMAN-LAYER-MINIMUM) |
| 95  | 09:03:49 | **FAILURE** | inbox: PAX role-brief — Human CRO (D-THIN-HUMAN-LAYER-MINIMUM) |
| 94  | 09:03:34 | **FAILURE** | inbox: 3 CEO decision records (D-NEW-PRODUCT-APPROVAL-POLICY + …) |
| 93  | 08:29:43 | **FAILURE** | governance: shared-board across 3 entities + per-entity statutory officers (D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER) |
| 92  | 08:26:56 | **FAILURE** | accounting(IFRS 10): consolidation substrate v0 + PROC-ACC-IFRS10-01 |
| 91  | 08:26:14 | **FAILURE** | privacy: per-entity POPIA s.55-56 IO designation scoping + PROC-PRIV-IO-DSG-01 |
| 90  | 08:25:25 | **FAILURE** | substrate(events): LegalEntityRegistered + LegalEntityChanged + IntraGroupArrangementSigned |
| 89  | 08:28:27 | **FAILURE** | compliance(register): Domain Q reclassification under PA look-through |
| 88  | 08:24:42 | **FAILURE** | risk(ras): PA look-through framing — bank-entity RAS, consolidated-basis monitoring |
| 87  | 08:24:40 | **FAILURE** | brand: Hoz v3.2 supplement — sub-brand lockups (Hoz Bank + Hoz Securities) |
| 86  | 07:57:56 | **FAILURE** | inbox: D-HOZ-DOMAIN-REGISTRATION-SET — defer all activities |
| 85  | 07:51:37 | **FAILURE** | inbox: D-REGULATORY-PERIMETER — bank to PA, securities to JSE, group not separately regulated |
| 84  | 07:51:31 | **FAILURE** | compliance(register): per-entity scoping vocabulary + consolidated-supervision rows v0 |
| 83  | 07:40:45 | **FAILURE** | legal: CIPC three-reservation update — Hoz Group + Bank + Securities |
| 82  | 07:30:50 | **FAILURE** | inbox: D-LEGAL-ENTITY-TREE-V0 — approve as recommended (3 entities) |
| 81  | 07:26:24 | empty (pre-workflow) | dashboard: intranet fix — tile-render + per-page back-link (v0) |
| 80  | 07:26:21 | empty (pre-workflow) | legal: legal-entity tree v0 — group + bank + securities (D-GROUP-STRUCTURE) |
| 79  | 07:22:52 | empty (pre-workflow) | dashboard(cache): re-derive after merge-resolver wave |
| 78  | 07:26:18 | empty (pre-workflow) | inbox: D-GROUP-STRUCTURE — Hoz as a group, not a single entity |
| 77  | 07:26:15 | empty (pre-workflow) | crm(lifecycle): counterparty institutional-eligibility screening v0 (D-FSP-LICENCE-NECESSITY) |

Findings:

- **20 of 20 PRs (#82–#101)** merged with `conclusion: "FAILURE"` on the
  registered `ci` check. None bypassed via admin-only flag in the JSON
  metadata; all merged via the standard merge button by `marchouze`.
- PRs #77–#81 merged before the `pr-ci.yml` workflow file landed (PR #18
  registered the workflow at 09:27 UTC on 2026-05-09 — slightly *after*
  these PRs by clock, but `pr-ci.yml` was added in commit `c3caf86` per
  `git log --diff-filter=A`; the empty `statusCheckRollup` confirms the
  workflow simply did not run for those PRs). PR #70 also pre-workflow.
- The four failures Atlas named all originate in PRs #70 and #77 — both
  pre-workflow — which is *why* they sit on main today: at the time those
  PRs merged, no gate existed to catch them. Every PR since #82 has been
  red but merged anyway because the gate is **not enforced**.

## §5 Root cause hypothesis

**Two-stage failure** — the substrate has two separate defects, each of
which would be sufficient on its own:

### Cause A — substrate-quality regression (origin)

PRs #70 and #77 introduced the four failures into main while the CI gate
workflow did not yet exist. The workflow landed shortly after; subsequent
work has not paid down the four pre-existing failures.

### Cause B — branch protection cannot be enforced on the current GitHub plan (compounding)

`gh api repos/marchouze/scrooge/branches/main/protection` returns:

```text
HTTP 403 — "Upgrade to GitHub Pro or make this repository public to enable
this feature."
```

Same response from `gh api repos/marchouze/scrooge/rules/branches/main`.

The repo is private, on the GitHub free plan. Branch protection rules and
rulesets are **gated features** that require either GitHub Pro / Team /
Enterprise on private repos, or a public repo. Without one of those, the
`ci` check can be configured and registered but **cannot be made
required** — merges proceed regardless of conclusion.

The `pr-ci.yml` workflow's own header comment acknowledged this gap:

> "Branch protection rules are not modifiable from a workflow file, so
>  this step is manual-by-necessity (registered as an exception under
>  Principle 3)."

The exception was registered. The dependency on a manual configuration
step that *cannot be performed at all on the current GitHub plan* was not.
This is a substrate gap that escaped notice because the workflow runs and
turns red — visually performing the role of a gate — without enforcing.

The merges-without-protection pattern is **not** an admin override and
**not** a "merge without checks" UI choice. It is the GitHub default in
the absence of a protection rule: the check exists, reports its result,
nobody is required to wait for it.

**Combined root cause**: the gate is correctly configured in code but
unenforced in the substrate (Cause B), and the substrate it would have
caught has accumulated four pre-existing failures (Cause A). Cause B is
the harder of the two — it requires a substrate change, not a code change.

## §6 Recommended remediation

Atlas (Core banking platform architect) and Devon (COO, governance —
operational resilience) own the choice. Vera frames the four options:

### Option (i) — fix-and-keep (do both)

- Fix all four failures (lint auto-format; mandate-ownership parser
  extension or PROC-CRM-CIE-01 owner-syntax rewrite; Rohan amber-fixture
  recalibration; Vera overnight-recon then auto-resolves).
- **And** address Cause B (one of the sub-options below) so the gate can
  *prevent* future regressions, not merely report them.

This is the recommended path. The four failures are tractable; they should
not have been allowed to accumulate; and the gate was always intended to
be enforced. Recommendation: dispatch four follow-on agents in parallel
(Atlas → Failure 1; Niko + Vera → Failure 2; Rohan → Failure 3; Failure 4
auto-resolves) and a separate Devon-owned agent for the enforcement-
substrate choice.

### Option (ii) — flip repo public

- **Pros**: zero direct cost; branch-protection rules become available
  immediately; reproducibility benefits.
- **Cons**: substantial. The repo contains regulatory-strategy material,
  pre-licence application work, draft policies, draft procedures,
  decision records, persona specs that include personal-data fields
  (Marc's email, agent-design choices). Going public is a strategic
  choice with reputational, legal-privilege, and POPIA implications well
  beyond Atlas's authority — escalates to CEO and to legal review by
  Imani (Legal-as-code engineer).

### Option (iii) — GitHub Pro / Team subscription

- **Pros**: smallest substrate change; enables branch-protection rules
  and rulesets on the existing private repo; preserves confidentiality
  posture.
- **Cons**: cost (USD 4 / month / user on Pro at time of writing — this is
  a real Anthropic-API-budget-adjacent line item, but materially smaller
  than the Anthropic-API spend itself).
- This is the operationally cheapest path to enforced branch protection.

### Option (iv) — self-hosted pre-merge enforcer

- Build a substrate component (e.g. a GitHub App or a pre-commit-style
  check that runs at merge time on a Bun-runtime workflow we control)
  that refuses to merge without green CI.
- **Pros**: no third-party dependency; directly under bank-substrate
  control; aligned with Principle 3 (cloud-native, code-defined).
- **Cons**: this is a substrate-build project — Atlas-scale work — for a
  problem that GitHub Pro solves for USD 4/month. Justified only if
  Option (iii) is rejected.

### Option (v) — formal accept-with-deferral

- Register the four failures (or all five, including the unenforced gate)
  in the obligations register with Principle-2 citations explaining why
  each is tolerated and a binding date by which they will be cleared.
- **Pros**: legitimises the current state under our own discipline.
- **Cons**: the four failures are tractable and the gate was *intended* to
  be a preventive control. Formal deferral is the wrong tool for a
  substrate-quality regression we can clear in a single agent dispatch
  per failure. Recommend rejecting this option in favour of (i) + (iii).

**Vera's recommendation: Option (i) + Option (iii).** Fix the four
failures *and* upgrade the GitHub plan so branch protection can enforce.
The combination is decisive, low-cost, and restores the secure-SDLC
discipline the workflow file was authored to deliver.

## §7 Citation chain

| Layer | Citation | What it requires |
|---|---|---|
| Bank constitution | CLAUDE.md Principle 4 — Security designed in from the start; Secure SDLC | "dependency scanning, SAST/DAST, signed builds, reproducible deployments, supply-chain verification (SLSA-aligned)" — preventive controls before merge, not detective controls after. |
| Bank constitution | CLAUDE.md Principle 6 — single-graph discipline | Every system capability has a procedure; "merge to main" is a procedure whose system capability is `pr-ci.yml`. An unenforced capability is an orphan-procedure-by-effect. |
| Regulator instrument | PA / FSCA Joint Standard 1 of 2024 (Cybersecurity and Cyber Resilience), articles on change management, secure development, and assurance over preventive controls | The bank must operate "preventive cybersecurity controls" with "evidence of operating effectiveness". A reported-but-unenforced gate fails the operating-effectiveness leg. |
| Internal-audit standard | IIA International Professional Practices Framework (IPPF) Standard 2120 (Risk Management) and 2130 (Control) | Internal audit must "assist the organization by identifying and evaluating significant exposures to risk and contributing to the improvement of risk management and control systems." This finding is the assist. |
| Internal-audit standard | IIA IPPF Standard 2410 — Criteria for Communicating | Findings include criterion, condition, cause, consequence, recommendation. Mapped: criterion = `bun run ci` must be green for merge; condition = 20 PRs merged red; cause = §5 (A + B); consequence = pre-licence substrate carries known-bad code into commencement-of-trading window; recommendation = §6 Option (i) + (iii). |
| Bank discipline | CLAUDE.md Principle 2 — every action traces to a source | If any of the four failures is tolerated, that toleration must carry a citation in the obligations register with a binding clearance date. As of 2026-05-10, no such deferral citation exists. |
| Bank memory | `feedback_canonical_source_registry.md` | The CI gate is the canonical authoring location for "code that may merge to main." The merge-button-without-gate path is a duplicate, lower-quality authoring path and breaks the registry. |

---

**Decision-id:** D-CI-GATE-INTEGRITY
**Decision-owner:** Atlas (Core banking platform architect) + Devon (COO,
governance — operational resilience)
**Decision-required by:** before the next batch of PRs is dispatched —
every additional merge while the gate is unenforced compounds the finding.
