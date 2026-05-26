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

  // Known test-pollution lineages: ProvenanceReclassified events carrying
  // these values leaked from the test suite into the production store. Skip
  // them here — the `recon:test-lineage-not-in-production` gate enforces
  // remediation. Run `bun run scripts/cleanup-test-run1-provenance-pollution.ts`
  // to reclassify these events to kind:simulated, which also removes them
  // from this recon's scope entirely (simulated events are checked against
  // the lineage registry for completeness but are not enforcement targets).
  const KNOWN_POLLUTION_LINEAGES: ReadonlySet<string> = new Set(["test-run-1"]);

  const lineagesSeen = new Map<string, number>();
  let asserted = 0;
  let pollutionSkipped = 0;
  for (const event of eventStore.replay()) {
    asserted += 1;
    const tag = event.provenance;
    if (!tag) continue; // tag-coverage recon flags this; skip here
    const lineage = String(tag.sourceLineage);
    // Skip known-pollution lineages to prevent 123k warn-spam; the dedicated
    // recon:test-lineage-not-in-production gate handles enforcement.
    if (KNOWN_POLLUTION_LINEAGES.has(lineage)) {
      pollutionSkipped += 1;
      continue;
    }
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

  // Surface pollution-skip count so the operator knows cleanup is pending.
  if (pollutionSkipped > 0) {
    violations.push({
      subject: `known-pollution: ${pollutionSkipped} event(s) with test-* sourceLineage skipped`,
      message:
        "Run `bun run scripts/cleanup-test-run1-provenance-pollution.ts` to reclassify these events " +
        "to kind:simulated, then they will no longer appear here.",
      severity: "warn",
    });
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
