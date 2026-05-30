// scripts/record-d-ci-runtime-approvals-2026-05-30.ts
//
// One-shot: record CEO approval of two deferred build-phase engineering
// decisions, per Marc's in-session delegation ("do 1-4", 2026-05-30).
//   - D-CI-GITHUB-PLAN-UPGRADE-DEFER — defer GitHub paid-plan upgrade;
//     agent discipline holds branch-protection posture until licence-day.
//   - D-RUNTIME-LANGUAGE — continue on Bun through build phase; defer the
//     formal Bun vs Node choice to M8 (before first Container App deploy).
//
// Authority: CEO (marc@tgv.co.za) via scrooge:session-delegation.

import { recordDecision } from "../runtime/decisions/record";
import { clock } from "../platform/composition";

const ts = clock.now();

const r1 = recordDecision(
  {
    decisionId: "D-CI-GITHUB-PLAN-UPGRADE-DEFER",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "GitHub plan upgrade for branch-protection enforcement — deferred; agent discipline holds the line",
    category: "engineering",
    recommendation:
      "Defer GitHub plan upgrade; agent discipline holds branch-protection operating posture until upgrade lands; resurfaces at regulator-readiness gate, internal-audit prep, substrate-quality drift, or repo-visibility shift",
    rationale:
      "CEO confirmed deferral in-session 2026-05-30 ('do 1-4'). Build-phase deferral acceptable provided agent-discipline holds: agents must NOT merge a red-CI PR. Upgrade is non-negotiable at licence-day (Principle 4 enforcement layer). Re-litigation triggers: (1) regulator-readiness gate; (2) audit-plan prep; (3) agent-discipline drift; (4) repo-visibility shift. Origin: Vera CI-gate-integrity finding (PR #103); Marc 'defer but remember need to upgrade' 2026-05-10.",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

const r2 = recordDecision(
  {
    decisionId: "D-RUNTIME-LANGUAGE",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Runtime language for licence-day — Bun vs Node evaluation deferred to M8 cloud-lift",
    category: "engineering",
    recommendation:
      "Defer runtime language (Bun vs Node) evaluation to the M8 cloud-lift stage; use Bun through the build phase; decision must be made before the first Container App deploy",
    rationale:
      "CEO confirmed deferral in-session 2026-05-30 ('do 1-4'). Bun is the build-phase runtime (fast iteration, native TS, native SQLite) and is appropriate through build phase. The Bun vs Node choice is a multi-year commitment that should be evaluated at M8 with the Container App target architecture in view. No SARB-regulated precedent for Bun exists; evaluation before first cloud deploy is required. Origin: Atlas engineering-platform appropriateness assessment 2026-05-07.",
    sourceDocHashes: [],
    citations: [],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

console.log("recorded:", r1.eventId, "(D-CI-GITHUB-PLAN-UPGRADE-DEFER approved)");
console.log("recorded:", r2.eventId, "(D-RUNTIME-LANGUAGE approved)");
