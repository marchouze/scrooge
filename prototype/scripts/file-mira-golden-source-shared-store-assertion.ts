// scripts/file-mira-golden-source-shared-store-assertion.ts
//
// One-shot RMS Phase 3 filing for Mira's design note recording the CORRECTED
// enforcement model for `recon:regulatory-golden-source-integrity`: it is a
// shared-store assertion (warns-clean in CI by design), with the real
// dangling-hash assertion run off-pipeline on a cadence by the scheduled tick
// `scripts/regulatory/golden-source-integrity-tick.ts`. Emits a RecordFiled
// event so the Documents register holds the canonical note. Idempotent — skips
// if already filed.
//
// Authority: D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13);
//            D-REGULATORY-LIBRARY-V1; D-RMS-PHASE-3 (active).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:mira:golden-source-shared-store-assertion:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-mira-golden-source-shared-store-assertion] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# Golden-source integrity — corrected enforcement model: shared-store assertion + scheduled tick

**Author:** Mira (Chief Obligations & Regulatory Officer, compliance)
**Date:** 2026-06-13
**Authority:** D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13); D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11)
**Backing brief:** brief:mira:golden-source-integrity-re-document-as-shared-st:2026-06-13
**Status:** Design note recording a corrected enforcement model. No change to the gate's core checking logic, hashes, RecordFiled events, or graph citations.

---

## 1. What was wrong

The recon gate \`recon:regulatory-golden-source-integrity\` was documented and labelled as an
ENFORCING clean-CI gate (\`advisoryUntil 2026-06-11\`, "now a hard failure in CI"). That framing was
false. The gate is structurally inert in the CI pipeline:

- \`ci:migrate\` never seeds the regulatory graph, so on a clean runner there are **no
  golden-source nodes** to read.
- \`data/documents/*\` is gitignored — **zero blobs are git-tracked**.
- The gate therefore asserts **0 nodes → warns-clean** on every clean checkout. It cannot fail in
  the pipeline, regardless of the \`ENFORCEMENT_DATE\`.

The reported "CI failure" was a manual reproduction (seed the graph from a populated store, then
resolve the in-repo store only) — not the pipeline. My earlier analysis disproved the reported
failure; this note records the CEO-ratified fix.

## 2. The agreed truth (Principle 1)

Golden-source bytes and the \`goldenSourceHash\` linkage live in the **shared/home store by
design**. The hash is injected onto the seeded graph (a derived projection, Principle 1) from a
\`RecordFiled\` regulatory-source filing; it is never committed to git. This is correct: the event
+ document store is the single durable artefact, and the graph is a query over it.

Marc approved **Option A**: accept shared-store-only bytes, make the gate honest, and give it a
place it actually runs. **Option B (commit source-doc inputs / CI re-materialise) was rejected** —
no blobs or source-doc inputs are committed, and the gitignore posture of \`data/documents/\` is
unchanged.

## 3. The corrected model

**The gate is a SHARED-STORE assertion, not a clean-CI gate.**

- **In CI (empty graph):** asserts 0 nodes → \`ok:true\`. This is intentional and now documented
  as such in the gate header, the \`ENFORCEMENT_DATE\` doc-comment, and the recon-suite entry. A
  pin-test (\`platform/recon/regulatory-golden-source-integrity.test.ts\` →
  "PIN: zero nodes at the real enforcement boundary → ok:true, asserted 0") locks the clean-CI
  shape: zero nodes can never produce a violation, at any date, so a future change that makes the
  gate spuriously fail on a clean runner is caught.
- **The real assertion runs off-pipeline, on a cadence,** against the populated shared store, via
  the scheduled tick \`scripts/regulatory/golden-source-integrity-tick.ts\`
  (\`bun run recon:golden-source-integrity-tick\`).

The per-node severity rules are unchanged (blob in legacy in-repo store → warn; missing pre-
enforcement → warn; missing post-enforcement → fail). They only bite once there ARE nodes to
assert — i.e. on the populated shared store via the tick, never on the empty pipeline graph. The
\`ENFORCEMENT_DATE\` dates the per-node warn→fail transition; it is **not** a claim of in-pipeline
CI enforcement.

## 4. The scheduled shared-store tick

A daily macOS LaunchAgent \`com.scrooge.golden-source-integrity-tick\` (in
\`prototype/scripts/launchd/\`, installed by \`install.sh\` alongside \`com.scrooge.scheduler-tick\`
and \`com.scrooge.event-store-archive\`) runs the tick. The tick:

1. Resolves the home shared store via the boot shim (\`BANK_EVENT_DB\` /
   \`BANK_DOCUMENT_STORE\` → \`$HOME/.local/share/bank/{event.db,documents}\`; \`BANK_GRAPH_DB\` →
   home \`graph.db\`) — the same cross-worktree shared-store posture as the dispatch CLIs
   (D-CROSS-WORKTREE-EVENT-STORE-SYNC).
2. Seeds the regulatory graph from that populated store.
3. Runs the same \`run()\` the gate exposes against the seeded graph + resolved store.
4. Emits a \`SubstrateAlert{alertClass:"integrity", severity:"high"}\` for every dangling
   golden-source node (a Document node citing a \`goldenSourceHash\` whose blob is missing from
   every reachable store). The alert is idempotent on a stable \`alertId\` per node
   (\`alert:integrity:golden-source-dangling-<slug>\`) — append-only audit trail, no daily
   re-spam. \`warn\`-severity findings (legacy-store-only; pre-enforcement advisory) do **not**
   alert; only \`fail\` (dangling everywhere, post-enforcement) escalates.

The tick exits 0 always: it records its finding as a \`SubstrateAlert\` event surfaced by Vera's
escalation recon + the cross-page data-failure banner; it does not fail the host.

**Cadence rationale.** Daily (\`StartInterval 86400\`) matches the lightest standing-tick
convention (the 6-hourly archive check is the other dedicated tick; the 60-second scheduler-tick
is the agent-runtime driver). A golden-source blob does not vanish mid-day, and \`RunAtLoad\`
catches a missed window (sleeping machine) on next wake.

**Live verification (2026-06-13).** Run against the home store, the tick resolved the shared pair
(\`shared:true\`), seeded ~8,133 graph nodes, asserted 943 golden-source nodes, found 0 dangling →
clean, 0 alerts emitted — proving the assertion is real and meaningful (943 nodes) where the
in-pipeline gate reads 0.

## 5. What did NOT change

Per the brief's out-of-scope: the gate's core checking logic, the per-node severity grading, the
RecordFiled events, the goldenSourceHash linkage, and the graph citations are untouched. No source
bytes or blobs were committed; the gitignore posture of \`data/documents/\` is unchanged. Only the
framing/labelling changed (header, \`ENFORCEMENT_DATE\` doc-comment, recon-suite annotation), plus
the additive pin-test, the scheduled tick, its plist + install/uninstall + README entry, and the
\`recon:golden-source-integrity-tick\` package script.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the content-addressed
document store is canonical (D-RMS-PHASE-4). Deliverable under
D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION",
      "D-REGULATORY-LIBRARY-V1",
    ],
    actor: {
      type: "service",
      id: "agent:mira:compliance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "Golden-source integrity — corrected enforcement model: shared-store assertion + scheduled tick",
      path: "2026-06-13_mira_golden-source-shared-store-assertion.md",
      category: "engineering-design-note",
      author: "Mira (Chief Obligations & Regulatory Officer, compliance)",
      date: "2026-06-13",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
