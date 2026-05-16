// platform/event-store/provenance-lineage.registry.ts
//
// D-DATA-PROVENANCE-SUBSTRATE — Slice 1.
//
// Typed allow-list of valid `ProvenanceTag.sourceLineage` values. Every
// `sourceLineage` token an event carries must match an entry here OR a
// registered pattern (e.g. `agent-runtime:<agentName>`). Recon-enforced
// (`recon:provenance-lineage-registered`); soft-fail at runtime so a
// new agent's first scaffold-commit is never blocked by a registry-
// update lag.
//
// Adding a new lineage:
//   1. Append the entry to `STATIC_LINEAGE_REGISTRY` with a one-line
//      description naming the issuer.
//   2. If the lineage is parameterised (e.g. per-agent or per-test),
//      append a regex pattern to `LINEAGE_PATTERNS` instead.
//   3. The recon picks up new entries on the next CI cycle.
//
// Author: Atlas (Core banking platform architect, engineering — substrate)

export interface ProvenanceLineageEntry {
  readonly value: string;
  readonly issuer: string;
  readonly description: string;
}

/**
 * Initial allow-list per pack §15 dispatch-ready brief. Curated; new
 * entries land here as their producers wire up.
 */
export const STATIC_LINEAGE_REGISTRY: readonly ProvenanceLineageEntry[] = [
  {
    value: "pre-substrate-backfill",
    issuer: "substrate",
    description:
      "Slice-6 backfill default for events appended before D-DATA-PROVENANCE-SUBSTRATE landed. Tagged simulated/pre-substrate-build-phase.",
  },
  {
    value: "ceo-decision-record",
    issuer: "Scrooge",
    description:
      "CeoDecision events carved out as kind:'production' (Q-PROV-NEW-2). Real architectural commitments with binding force.",
  },
  {
    value: "decision-record",
    issuer: "Scrooge",
    description:
      "Decision events (D-DECISIONS-FRAMEWORK-REDESIGN). Unified family subsuming CeoDecision; kind:'production'.",
  },
  {
    value: "agent-brief",
    issuer: "Scrooge",
    description:
      "AgentBriefIssued events carved out as kind:'production'. Real instructions to autonomous agents.",
  },
  {
    value: "agent-runtime",
    issuer: "substrate",
    description:
      "Generic agent-runtime emissions when a per-agent variant is not specified. Prefer the parameterised pattern below.",
  },
  {
    value: "synthetic-bank-seed",
    issuer: "Atlas",
    description: "Synthetic event-store seed corpus used to bootstrap the bank's local demo state.",
  },
  {
    value: "scenario-runner",
    issuer: "scenarios",
    description:
      "Scenario rehearsal emissions (e.g. 01-hello-bank). Persistent simulated events with named scenarios.",
  },
  {
    value: "recon-harness",
    issuer: "Vera",
    description:
      "Reconciliation harness synthetic events. Ephemeral; never persisted to the canonical store.",
  },
  {
    value: "test-fixture",
    issuer: "bun-test-runner",
    description:
      "Generic test-fixture lineage for in-memory bun:test event stores. Per-test paths use the parameterised pattern.",
  },
];

/**
 * Parameterised lineage patterns. Tokens of the form `<prefix>:<suffix>`
 * (e.g. `agent-runtime:atlas-2026-05-10`, `bun-test-runner:tests/foo.test.ts`)
 * match these regexes. The recon admits any token matching a pattern OR a
 * static entry.
 */
export const LINEAGE_PATTERNS: readonly RegExp[] = [
  // agent-runtime:<agentName-or-trigger>
  /^agent-runtime:[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_:./-]+)?$/,
  // bun-test-runner:<test-file-path>
  /^bun-test-runner:[a-zA-Z0-9_./:-]+$/,
  // scenario-runner:<scenario-name>
  /^scenario-runner:[a-zA-Z0-9_-]+$/,
  // synthetic-bank-seed:v<n>
  /^synthetic-bank-seed:v\d+$/,
  // script:<script-name>  (for one-shot scripts that emit canonical events)
  /^script:[a-zA-Z0-9_./:-]+$/,
  // backfill:<source-tag>
  /^backfill:[a-zA-Z0-9_./:-]+$/,
];

const STATIC_LINEAGE_VALUES: ReadonlySet<string> = new Set(
  STATIC_LINEAGE_REGISTRY.map((e) => e.value),
);

/**
 * Whether `value` is a registered lineage (static entry OR matches a
 * parameterised pattern).
 */
export function isRegisteredLineage(value: string): boolean {
  if (STATIC_LINEAGE_VALUES.has(value)) return true;
  return LINEAGE_PATTERNS.some((re) => re.test(value));
}

/**
 * All static + parameterised lineage descriptors, for diagnostic /
 * registry-listing use. The patterns are surfaced as their regex source
 * so consumers can inspect them.
 */
export function listRegisteredLineages(): {
  static: readonly ProvenanceLineageEntry[];
  patterns: readonly string[];
} {
  return {
    static: STATIC_LINEAGE_REGISTRY,
    patterns: LINEAGE_PATTERNS.map((re) => re.source),
  };
}
