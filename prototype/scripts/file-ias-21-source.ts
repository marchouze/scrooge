// scripts/file-ias-21-source.ts
//
// WS-FX-IFRS-REVIEW-FOUNDATION — acquire + file IAS 21 (The Effects of Changes
// in Foreign Exchange Rates) as the FX retranslation/settlement domain-truth
// oracle the FX-vanilla NPA accounting review validates against
// (D-FX-IFRS-REVIEW-FOUNDATION, CEO-approved 2026-06-26).
//
// IAS 21 was already a graph node (`urn:reg:ifrs:ias-21` + provision `:s.28`,
// iasb-instruments-graph.json) but had NO `*-structured.json` source-doc and NO
// filed regulatory source. Adding the structured doc creates a `transposed`
// row in `Regulations/_source-coverage.json` (the `IAS-` applicability prefix),
// which the ENFORCING `recon:regulatory-source-coverage` gate requires to be
// `sourceAcquired:true`. This script files that source so the gate stays green
// from REAL acquired data, not a stale committed snapshot.
//
// DETERMINISTIC, REPLAY-SAFE BODY. Unlike `file-ifrs-sources.ts` (which reads a
// PDF from ~/Desktop and is therefore NOT wired into ci:migrate), this script's
// source body is the COMMITTED structured JSON's concatenated verbatim
// paragraph text — in-repo, so the BLAKE3 content hash is deterministic on a
// clean CI store and the filing is genuinely idempotent (re-running files the
// same bytes → same hash → no new document). That lets it run in ci:migrate so
// a fresh CI store gets IAS-21 `sourceAcquired:true` exactly as the shared store
// does. The verbatim text is © IFRS Foundation; build-phase ingestion is tracked
// as a SubstrateGap with a licence-day procurement obligation (see
// scripts/file-ias-21-licensing-flag.ts).
//
// Idempotent on (instrument registration, content hash). Cross-worktree safe via
// the shared-store resolver.
//
// Authority: D-FX-IFRS-REVIEW-FOUNDATION (CEO-approved 2026-06-26);
//   D-REGULATORY-LIBRARY-V1. Principle 1; Principle 2.
// Author: Bea (Accounting & financial reporting engineer, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so the shared-store resolver
// mutates BANK_EVENT_DB / BANK_DOCUMENT_STORE before composition resolves paths.
import "./dispatch/resolve-event-db-boot";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { hashContent } from "../platform/document-store/hash";
import { makeRegulatoryInstrumentRegistered } from "../platform/event-store/event-types/regulatory";
import type { Actor } from "../platform/event-store/types";
import { recordRegulatorySource } from "../platform/records";
import type { StructuredSourceDocument } from "../platform/regulatory/structured-source-schema";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:bea" };
const CITATIONS = ["D-FX-IFRS-REVIEW-FOUNDATION", "D-REGULATORY-LIBRARY-V1"];

const INSTRUMENT_ID = "IAS-21";
const SLUG = "ias-21";
const TITLE = "IAS 21 The Effects of Changes in Foreign Exchange Rates";

/** Repo-relative path to the committed structured source-doc. */
const STRUCTURED_REL = "Regulations/INTL/IASB/source-docs/ias-21-structured.json";

/** Absolute path to the structured doc (repo root is two levels up from prototype/). */
function structuredAbsPath(): string {
  return resolve(import.meta.dir, "..", "..", STRUCTURED_REL);
}

/**
 * The deterministic source body — the concatenated verbatim paragraph text of
 * the committed structured doc, in document order. Same bytes every run, so the
 * content hash is stable and the filing is idempotent on a clean store.
 */
function deterministicSourceBody(): string {
  const doc = JSON.parse(readFileSync(structuredAbsPath(), "utf-8")) as StructuredSourceDocument;
  const parts: string[] = [`${doc.title}`, ""];
  for (const ch of doc.chapters) {
    for (const s of ch.sections) {
      for (const ss of s.subsections ?? []) {
        if (ss.text) parts.push(ss.text);
      }
    }
  }
  return `${parts.join("\n\n")}\n`;
}

/** True iff a RegulatoryInstrumentRegistered already exists for IAS-21. */
function isInstrumentRegistered(instrumentId: string): boolean {
  for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId === instrumentId) return true;
  }
  return false;
}

function main(): void {
  const body = deterministicSourceBody();
  const bytes = new TextEncoder().encode(body);
  const asOf = clock.now();

  // 1. Register the instrument (idempotent).
  let registered = false;
  if (!isInstrumentRegistered(INSTRUMENT_ID)) {
    eventStore.append(
      makeRegulatoryInstrumentRegistered({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          instrumentId: INSTRUMENT_ID,
          title: TITLE,
          issuingBody: "IASB",
          instrumentType: "guidance",
          jurisdiction: "INTL",
          publicationDate: "1983-12-01",
          effectiveDate: "2005-01-01",
          version: "2005-revised",
          contentHash: hashContent(bytes),
        },
      }),
    );
    registered = true;
  }

  // 2. File the source bytes (idempotent on content hash).
  const result = recordRegulatorySource(
    {
      instrumentId: INSTRUMENT_ID,
      slug: SLUG,
      title: TITLE,
      path: STRUCTURED_REL,
      contentType: "text/plain",
      body: bytes,
      actor: ACTOR,
      entity: ENTITY,
    },
    asOf,
  );

  console.log(
    JSON.stringify({
      ok: true,
      script: "file-ias-21-source",
      instrumentId: INSTRUMENT_ID,
      slug: SLUG,
      registered,
      filed: result.isNewDocument,
      documentHash: result.documentHash,
      bodyChars: body.length,
    }),
  );
}

main();
