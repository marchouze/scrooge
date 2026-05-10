// platform/recon/provenance-lineage-registered.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 1 recon (Vera, owned).
//
// Asserts: every `ProvenanceTag.sourceLineage` value present on an event
// in the local event store matches a registered static entry OR a
// registered parameterised pattern (see
// `prototype/platform/event-store/provenance-lineage.registry.ts`).
//
// Soft-fail rationale (per pack §4.1 rule 5): a typo in `sourceLineage`
// is silent contamination — the runtime cannot easily distinguish
// "new-agent-just-shipped" from "typo". The recon surfaces unknown
// lineages so a human reviewer can either:
//   - Add the new agent / seed / runner to the registry.
//   - Or correct the typo at the producer.
//
// Severity: `warn` for unknown values; `fail` for empty values (which
// the Zod schema should already reject at append, but defence-in-depth
// is cheap here).
//
// Author: Atlas (Core banking platform architect, engineering — substrate)
//   on behalf of Vera (Internal audit / continuous-assurance engineer).

import { eventStore } from "../composition";
import { isRegisteredLineage } from "../event-store/provenance-lineage.registry";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:provenance-lineage-registered";

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const lineagesSeen = new Map<string, number>();
  let asserted = 0;
  for (const event of eventStore.replay()) {
    asserted += 1;
    const tag = event.provenance;
    if (!tag) continue; // tag-coverage recon flags this; skip here
    const lineage = String(tag.sourceLineage);
    lineagesSeen.set(lineage, (lineagesSeen.get(lineage) ?? 0) + 1);
  }

  result.asserted = asserted;

  for (const [lineage, count] of lineagesSeen.entries()) {
    if (lineage.length === 0) {
      violations.push({
        subject: `lineage:<empty> (${count} event(s))`,
        message:
          "ProvenanceTag.sourceLineage is empty — schema violation; investigate the producer.",
        severity: "fail",
      });
      continue;
    }
    if (!isRegisteredLineage(lineage)) {
      violations.push({
        subject: `lineage:${lineage} (${count} event(s))`,
        message:
          "Unknown sourceLineage — add a static entry to provenance-lineage.registry.ts or a parameterised pattern that matches.",
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok && r.violations.length === 0) {
    process.stdout.write(
      `${PIPELINE}: ok — asserted ${r.asserted} event(s); all sourceLineage values are registered\n`,
    );
    process.exit(0);
  }
  if (r.ok) {
    process.stdout.write(`${PIPELINE}: ok with warnings — asserted ${r.asserted} event(s)\n`);
    for (const v of r.violations) {
      process.stdout.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
    }
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
