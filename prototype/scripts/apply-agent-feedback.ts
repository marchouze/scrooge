// scripts/apply-agent-feedback.ts
//
// CLI: read an agent's Team/<Name>.md operating spec, call Claude to generate
// a targeted operating-rule patch in the relevant section + change log entry,
// then commit and push directly to main (small targeted change, no PR needed).
//
// Usage:
//   bun run perf:apply-feedback \
//     --agent <name> \
//     --finding-id <id> \
//     --severity low|medium|high|critical \
//     --category code-quality|process|mandate|output|security|other \
//     --summary "one-line description" \
//     [--detail "longer context"]
//
// Requires ANTHROPIC_API_KEY in env.
//
// Authority: D-AGENT-AUTONOMY-OPERATIONAL (Principle 6 — autonomous by default).
// Author: Atlas (Core banking platform architect, engineering)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface ParsedArgs {
  readonly agent: string;
  readonly findingId: string;
  readonly severity: string;
  readonly category: string;
  readonly summary: string;
  readonly detail?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length) {
      const key = arg.slice(2);
      args[key] = argv[i + 1] ?? "";
      i++;
    }
  }

  const required = ["agent", "finding-id", "severity", "category", "summary"];
  for (const field of required) {
    if (!args[field]) {
      console.error(`Missing required argument: --${field}`);
      console.error(
        'Usage: bun run perf:apply-feedback --agent <name> --finding-id <id> --severity <s> --category <c> --summary "..."',
      );
      process.exit(1);
    }
  }

  return {
    agent: args.agent as string,
    findingId: args["finding-id"] as string,
    severity: args.severity as string,
    category: args.category as string,
    summary: args.summary as string,
    ...(args.detail ? { detail: args.detail } : {}),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));

  // Capitalise first letter to match Team/<Name>.md convention
  const agentNameCapitalised =
    parsed.agent.charAt(0).toUpperCase() + parsed.agent.slice(1).toLowerCase();
  const specPath = resolve(`../Team/${agentNameCapitalised}.md`);

  if (!existsSync(specPath)) {
    console.error(`Agent spec not found: ${specPath}`);
    console.error(`Expected file at Team/${agentNameCapitalised}.md (capitalised first letter)`);
    process.exit(1);
  }

  const specContent = readFileSync(specPath, "utf-8");
  const today = new Date().toISOString().slice(0, 10);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — cannot call Claude.");
    process.exit(1);
  }

  const client = new Anthropic();

  const prompt = `You are updating an AI agent's operating spec (Team/${agentNameCapitalised}.md) in response to a performance finding.

Finding:
- ID: ${parsed.findingId}
- Severity: ${parsed.severity}
- Category: ${parsed.category}
- Summary: ${parsed.summary}${parsed.detail ? `\n- Detail: ${parsed.detail}` : ""}

Current spec:
${specContent}

Your task:
1. Identify which section of the spec should be updated to prevent this finding from recurring.
   - For "process" or "mandate" findings: add an explicit operating rule to the most relevant section (e.g. §6 Cadence, §9 Decisions in scope, §14 Procedures owned).
   - For "code-quality" or "output" findings: add a quality check or constraint to §11 Outputs or §14 Procedures owned.
   - For any finding: add an entry to §17 Change log.
2. Return ONLY the complete updated .md file — no explanation, no markdown fences, just the raw file content.
3. The change log entry format: \`- ${today} — Finding ${parsed.findingId} (${parsed.severity}/${parsed.category}): ${parsed.summary}. Rule added: <what was added and where>.\`
4. Keep the added rule terse — one or two sentences maximum. It must be actionable, not aspirational.
5. Do not restructure the file or change any other sections.`;

  console.log(`\nCalling Claude to patch Team/${agentNameCapitalised}.md...`);

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (!content || content.type !== "text") {
    console.error("Unexpected response from Claude — no text block returned.");
    process.exit(1);
  }

  const updatedSpec = content.text.trim();

  if (!updatedSpec.startsWith("#")) {
    console.error("Claude response does not look like a markdown file (does not start with '#').");
    console.error("First 200 chars of response:");
    console.error(updatedSpec.slice(0, 200));
    process.exit(1);
  }

  writeFileSync(specPath, `${updatedSpec}\n`, "utf-8");
  console.log(`Team/${agentNameCapitalised}.md updated.`);

  // Commit and push
  const commitMsg = `refactor(${agentNameCapitalised.toLowerCase()}): apply finding ${parsed.findingId} — ${parsed.summary}`;
  const relSpecPath = `Team/${agentNameCapitalised}.md`;

  try {
    execSync(`git -C .. add "${relSpecPath}"`, { stdio: "pipe" });
    execSync(`git -C .. commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { stdio: "pipe" });
    console.log(`Committed: ${commitMsg}`);

    // Rebase before push per dispatch discipline
    execSync("git -C .. fetch origin main", { stdio: "pipe" });
    execSync("git -C .. rebase origin/main", { stdio: "pipe" });

    // Push with retry (up to 5 attempts)
    let pushed = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        execSync("git -C .. push", { stdio: "pipe" });
        pushed = true;
        console.log(`Pushed to main (attempt ${attempt}).`);
        break;
      } catch {
        if (attempt < 5) {
          console.log(`Push rejected (attempt ${attempt}), rebasing and retrying...`);
          execSync("git -C .. pull --rebase", { stdio: "pipe" });
        }
      }
    }
    if (!pushed) {
      console.error("Failed to push after 5 attempts. Please push manually.");
      process.exit(1);
    }
  } catch (err) {
    const error = err as Error;
    console.error(`Git operation failed: ${error.message}`);
    console.error("The spec file has been updated locally. Please commit and push manually:");
    console.error(`  git add ${relSpecPath}`);
    console.error(`  git commit -m "${commitMsg}"`);
    console.error("  git push");
    process.exit(1);
  }

  console.log(`\nDone. Finding ${parsed.findingId} applied to Team/${agentNameCapitalised}.md.`);
}

main().catch((err: unknown) => {
  const error = err as Error;
  console.error("apply-agent-feedback failed:", error.message ?? String(err));
  process.exit(1);
});
