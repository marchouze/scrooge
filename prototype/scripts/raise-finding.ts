// scripts/raise-finding.ts
//
// CLI: record a typed AuditFinding event against a named agent.
//
// Usage:
//   bun run perf:raise-finding \
//     --agent <name> \
//     --severity low|medium|high|critical \
//     --category code-quality|process|mandate|output|security|other \
//     --summary "one-line description" \
//     [--detail "longer context"] \
//     [--source-ref "PR #123 or path/to/file.ts"]
//
// The finding is always raised by marc@tgv.co.za (CEO / principal actor).
// The emitted AuditFinding event is consumed by the performance evaluator
// quality-scoring pipeline with no further wiring needed.
//
// After recording, prints instructions for running apply-agent-feedback.ts
// to patch the agent's Team/<Name>.md operating spec.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (Principle 6).
// Author: Atlas (Core banking platform architect, engineering)

import type {
  AuditFindingCategory,
  AuditFindingSeverity,
} from "../platform/event-store/event-types/audit";
import { recordAuditFinding } from "../platform/records/helpers";

const RAISED_BY = "marc@tgv.co.za";

function parseArgs(argv: string[]): {
  agent: string;
  severity: AuditFindingSeverity;
  category: AuditFindingCategory;
  summary: string;
  detail?: string;
  sourceRef?: string;
} {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[i + 1] ?? "";
      i++;
    }
  }

  const required = ["agent", "severity", "category", "summary"];
  for (const field of required) {
    if (!args[field]) {
      console.error(`Missing required argument: --${field}`);
      console.error(
        'Usage: bun run perf:raise-finding --agent <name> --severity low|medium|high|critical --category code-quality|process|mandate|output|security|other --summary "..."',
      );
      process.exit(1);
    }
  }

  const validSeverities: AuditFindingSeverity[] = ["low", "medium", "high", "critical"];
  const validCategories: AuditFindingCategory[] = [
    "code-quality",
    "process",
    "mandate",
    "output",
    "security",
    "other",
  ];

  const severity = args.severity as AuditFindingSeverity;
  if (!validSeverities.includes(severity)) {
    console.error(
      `Invalid --severity "${severity}". Must be one of: ${validSeverities.join(", ")}`,
    );
    process.exit(1);
  }

  const category = args.category as AuditFindingCategory;
  if (!validCategories.includes(category)) {
    console.error(
      `Invalid --category "${category}". Must be one of: ${validCategories.join(", ")}`,
    );
    process.exit(1);
  }

  return {
    agent: args.agent as string,
    severity,
    category,
    summary: args.summary as string,
    ...(args.detail ? { detail: args.detail } : {}),
    ...(args["source-ref"] ? { sourceRef: args["source-ref"] } : {}),
  };
}

function main(): void {
  const parsed = parseArgs(process.argv.slice(2));
  const asOf = new Date().toISOString();

  const findingId = recordAuditFinding(
    {
      agentId: parsed.agent,
      severity: parsed.severity,
      category: parsed.category,
      summary: parsed.summary,
      ...(parsed.detail ? { detail: parsed.detail } : {}),
      ...(parsed.sourceRef ? { sourceRef: parsed.sourceRef } : {}),
      raisedBy: RAISED_BY,
    },
    asOf,
  );

  console.log("\nAuditFinding recorded.");
  console.log(`  Finding ID : ${findingId}`);
  console.log(`  Agent      : ${parsed.agent}`);
  console.log(`  Severity   : ${parsed.severity}`);
  console.log(`  Category   : ${parsed.category}`);
  console.log(`  Summary    : ${parsed.summary}`);
  if (parsed.detail) console.log(`  Detail     : ${parsed.detail}`);
  if (parsed.sourceRef) console.log(`  Source ref : ${parsed.sourceRef}`);
  console.log(`  Raised by  : ${RAISED_BY}`);
  console.log(`  As-of      : ${asOf}`);
  console.log();
  console.log(
    `Next: run apply-agent-feedback.ts to patch the agent spec:\n  bun run perf:apply-feedback \\\n    --agent ${parsed.agent} \\\n    --finding-id ${findingId} \\\n    --severity ${parsed.severity} \\\n    --category ${parsed.category} \\\n    --summary "${parsed.summary}"${parsed.detail ? ` \\\n    --detail "${parsed.detail}"` : ""}`,
  );
}

main();
