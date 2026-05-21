// scripts/record-d-rms-recordfiled-manifest.ts
//
// One-shot Decision-event emit: D-RMS-RECORDFILED-MANIFEST.
//
// Records the convention that retires the one-shot-RecordFiled-script
// authoring pattern in favour of a single canonical manifest replay
// (`scripts/migrate/recordfiled-manifest.json` +
// `scripts/migrate/replay-recordfiled-manifest.ts`).
//
// Authority: CEO (build phase) per the CLAUDE.md decision-authority routing
// table — "Engineering build decisions (substrate, platform, schema) → CEO
// (build phase)". Recorded via CEO session-delegation: Marc dispatched this
// brief through Scrooge with the explicit instruction to "pick & implement"
// the convention; per CLAUDE.md "Session delegation", that in-session
// authorization is the CEO approval. `authorityRef` is `marc@tgv.co.za` and
// `recordedVia` is `scrooge:session-delegation`.
//
// Author: Atlas (Core banking platform architect, engineering)

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-RMS-RECORDFILED-MANIFEST";

const TITLE =
  "Canonical manifest replay for RecordFiled events (retires one-shot-script + package.json-line pattern)";
const CATEGORY = "governance" as const;
const RECOMMENDATION =
  "Adopt `prototype/scripts/migrate/recordfiled-manifest.json` as the single canonical artefact for RecordFiled events that must hydrate on fresh runners. The replay script `prototype/scripts/migrate/replay-recordfiled-manifest.ts` is wired ONCE into `migrate:decisions-backfill` in package.json. New RecordFiled events outside of `dispatch:close-run` deliverable flow add a manifest entry — they do NOT author a new one-shot script and they do NOT add a new package.json line.";
const RATIONALE =
  "Three occurrences in four days closed the pattern. Each one-shot script carried ~150 lines of boilerplate plus a brittle package.json line; one of three (the atlas policy-next-review script) was authored without the package.json line, proving the gap is real. The manifest is declarative, reviewable in diff, race-free (vs Option A's auto-mutate-package.json on close-run, which would collide on parallel writes), and converges on one place to look. Substrate authority for the convention sits with engineering (Atlas) under CEO build-phase routing per CLAUDE.md; routine future register-key extensions (briefs, correspondence, feedback) can drop in without further authority changes.";
const CITATIONS = [
  "D-RMS-PHASE-1",
  "D-RMS-PHASE-3",
  "WS-RMS-DOCUMENTS-PARITY",
  "brief:atlas:auto-wire-one-shot-recordfiled-scripts-into-the-:2026-05-21",
] as const;

// Deterministic timestamps so the event store hashes the same on every CI run.
const REQUESTED_AT = "2026-05-21T07:30:00.000Z";
const APPROVED_AT = "2026-05-21T07:36:00.000Z";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const history = register.byId.get(DECISION_ID);
const alreadyRequested = !!history?.events.some((e) => e.phase === "requested");
const alreadyApproved = !!history?.events.some((e) => e.phase === "approved");

const emitted: { phase: string; eventId: string }[] = [];

if (!alreadyRequested) {
  const r = requestDecision(
    {
      decisionId: DECISION_ID,
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    REQUESTED_AT,
  );
  emitted.push({ phase: "requested", eventId: r.eventId });
}

if (!alreadyApproved) {
  const a = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    APPROVED_AT,
  );
  emitted.push({ phase: "approved", eventId: a.eventId });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? `${DECISION_ID}: already requested + approved — skip`
          : `${DECISION_ID}: emitted ${emitted.length} phase event(s)`,
      emitted,
    },
    null,
    2,
  ),
);
