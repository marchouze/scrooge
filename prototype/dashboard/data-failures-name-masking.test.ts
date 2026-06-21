// dashboard/data-failures-name-masking.test.ts
//
// No-agent-names rule (Marc): user-facing dashboard UI surfaces seats by Title
// only, never persona names. The global cross-page data-failure banner
// (_data-failure-banner.js → GET /api/data-failures) renders the owner cell and
// is loaded on EVERY page, so a name leak there is bank-wide. The route handler
// masks the name-bearing fields at the API boundary with `ownerSeatTitle()`
// (owner cells, authored "Name (Title)") and `redactAgentNames()` (free-text
// label / rationale / figure). This test pins that the source views genuinely
// carry persona names AND that the masking the handler applies strips them all.
//
// Authority: the no-agent-names standing rule (Marc; see dashboard/agent-title.ts);
// Engineering Charter command 2 (fail-closed).

import { describe, expect, test } from "bun:test";

import { EventStore } from "../platform/event-store/store";
import { checkExpectedEvents } from "../platform/model-registry/expected-event-watchdog";
import { ownerSeatTitle, redactAgentNames } from "./agent-title";

// Persona names that the data-failure views are known to embed today. Whole-word
// matched so a substring (e.g. "Bea" inside "Beanstalk") would not false-trip.
const PERSONA_NAMES = ["Bea", "Rohan", "Helena", "Camille"] as const;

function containsPersonaName(text: string): string | null {
  for (const name of PERSONA_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(text)) return name;
  }
  return null;
}

describe("/api/data-failures name masking", () => {
  test("source expected-event gaps DO carry persona names (the leak is real)", () => {
    // An empty in-memory store leaves every standalone + calc-bound expectation
    // absent, so checkExpectedEvents returns the full gap manifest verbatim.
    const gaps = checkExpectedEvents(new EventStore());
    expect(gaps.length).toBeGreaterThan(0);
    const leak = gaps
      .flatMap((g) => [g.owningRole, g.label, g.rationale])
      .map(containsPersonaName)
      .find((n) => n !== null);
    // Proves the masking has something to do — if the source stops carrying
    // names this assertion fails loudly rather than the test passing vacuously.
    expect(leak).not.toBeNull();
  });

  test("handler masking strips every persona name from expected-event gaps", () => {
    const gaps = checkExpectedEvents(new EventStore());
    // The exact transform the /api/data-failures handler applies to gaps.
    const masked = gaps.map((g) => ({
      ...g,
      label: redactAgentNames(g.label),
      owningRole: ownerSeatTitle(g.owningRole),
      rationale: redactAgentNames(g.rationale),
    }));
    for (const g of masked) {
      expect(containsPersonaName(g.owningRole)).toBeNull();
      expect(containsPersonaName(g.label)).toBeNull();
      expect(containsPersonaName(g.rationale)).toBeNull();
    }
  });

  test("ownerSeatTitle strips the name from the failures-path owner cell", () => {
    // The failures path (buildDataFailuresView / buildPnLDataFailuresView)
    // carries the same "Name (Title)" owner-cell shape as the gaps path; the
    // handler masks `owningAgent` with the same `ownerSeatTitle` helper. Pin
    // that a representative name-bearing cell loses its name and keeps its Title.
    const owner = ownerSeatTitle("Bea (Accounting & financial reporting engineer, engineering)");
    expect(containsPersonaName(owner)).toBeNull();
    expect(owner).toBe("Accounting & financial reporting engineer, engineering");
  });
});
