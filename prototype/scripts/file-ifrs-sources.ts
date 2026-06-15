// scripts/file-ifrs-sources.ts
//
// WS-REGULATORY-REVIEW-MARKER (Phase 1) — acquire + file the three IFRS
// instruments the bank's accounting policy binds to (IFRS 9 / IFRS 13 / IFRS 7).
//
// For each instrument it:
//   1. Reads the PDF from `~/Desktop/<slug>.pdf` (skips + warns if absent).
//   2. Registers the instrument as a typed RegulatoryInstrumentRegistered event
//      (issuingBody "IASB"), idempotent — skipped if already registered.
//   3. Files the source bytes into the content-addressed document store via
//      recordRegulatorySource (RecordFiled{category:"regulatory-source"}),
//      idempotent on content hash.
//
// applicabilityStatus is NOT a stored field — it is derived by
// getApplicabilityStatus(), which maps the `IFRS-` / `IAS-` prefix to
// "transposed" (IFRS is transposed into SA via the Companies Act / JSE listing
// requirements). The brief's "applicabilityStatus direct" intent is satisfied
// by the instrument binding the bank directly through its accounting-policy
// chain; the recon treats both direct AND transposed as binding.
//
// NOT wired into ci:migrate — run post-merge by Scrooge against the SHARED
// store:
//
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//   BANK_DOCUMENT_STORE="$HOME/.local/share/bank/documents" \
//   bun run scripts/file-ifrs-sources.ts
//
// Authority: brief:atlas:phase-1-regulatory-review-marker-foundation-regu:2026-06-15;
// D-REGULATORY-LIBRARY-V1.
// Author: Atlas (Core Banking Platform Architect, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST so the shared-store resolver
// mutates BANK_EVENT_DB / BANK_DOCUMENT_STORE before composition resolves paths.
import "./dispatch/resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { clock, eventStore } from "../platform/composition";
import { hashContent } from "../platform/document-store/hash";
import { makeRegulatoryInstrumentRegistered } from "../platform/event-store/event-types/regulatory";
import type { Actor } from "../platform/event-store/types";
import { recordRegulatorySource } from "../platform/records";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:mira" };
const CITATIONS = ["D-REGULATORY-LIBRARY-V1"];

interface IfrsInstrument {
  readonly instrumentId: string;
  readonly slug: string;
  readonly title: string;
  /** Desktop filename (without the ~/Desktop/ prefix). */
  readonly desktopFile: string;
  readonly publicationDate: string;
  readonly effectiveDate: string;
  readonly version: string;
}

const IFRS_INSTRUMENTS: readonly IfrsInstrument[] = [
  {
    instrumentId: "IFRS-9",
    slug: "ifrs-9",
    title: "IFRS 9 Financial Instruments",
    desktopFile: "ifrs-9-financial-instruments.pdf",
    publicationDate: "2014-07-24",
    effectiveDate: "2018-01-01",
    version: "2014",
  },
  {
    instrumentId: "IFRS-13",
    slug: "ifrs-13",
    title: "IFRS 13 Fair Value Measurement",
    desktopFile: "ifrs-13-fair-value-measurement.pdf",
    publicationDate: "2011-05-12",
    effectiveDate: "2013-01-01",
    version: "2011",
  },
  {
    instrumentId: "IFRS-7",
    slug: "ifrs-7",
    title: "IFRS 7 Financial Instruments: Disclosures",
    desktopFile: "ifrs-7-financial-instruments-disclosures.pdf",
    publicationDate: "2005-08-18",
    effectiveDate: "2007-01-01",
    version: "2005",
  },
];

/** True iff a RegulatoryInstrumentRegistered already exists for this id. */
function isInstrumentRegistered(instrumentId: string): boolean {
  for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId === instrumentId) return true;
  }
  return false;
}

function main(): void {
  const desktop = join(homedir(), "Desktop");
  const registered: string[] = [];
  const filed: string[] = [];
  const skippedRegistration: string[] = [];
  const skippedFiling: string[] = [];
  const absent: string[] = [];

  for (const inst of IFRS_INSTRUMENTS) {
    const path = join(desktop, inst.desktopFile);
    if (!existsSync(path)) {
      absent.push(`${inst.slug} (${path})`);
      console.warn(`[warn] source PDF not found, skipping: ${path}`);
      continue;
    }
    const bytes = new Uint8Array(readFileSync(path));
    if (bytes.length === 0) {
      absent.push(`${inst.slug} (empty file)`);
      console.warn(`[warn] source PDF empty, skipping: ${path}`);
      continue;
    }

    const asOf = clock.now();

    // 1. Register the instrument (idempotent).
    if (isInstrumentRegistered(inst.instrumentId)) {
      skippedRegistration.push(inst.instrumentId);
    } else {
      eventStore.append(
        makeRegulatoryInstrumentRegistered({
          asOf,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            instrumentId: inst.instrumentId,
            title: inst.title,
            issuingBody: "IASB",
            instrumentType: "guidance",
            jurisdiction: "INTL",
            publicationDate: inst.publicationDate,
            effectiveDate: inst.effectiveDate,
            version: inst.version,
            contentHash: hashContent(bytes),
          },
        }),
      );
      registered.push(inst.instrumentId);
    }

    // 2. File the source bytes (idempotent on content hash).
    const result = recordRegulatorySource(
      {
        instrumentId: inst.instrumentId,
        slug: inst.slug,
        title: inst.title,
        path: `~/Desktop/${inst.desktopFile}`,
        contentType: "application/pdf",
        body: bytes,
        actor: ACTOR,
        entity: ENTITY,
      },
      asOf,
    );
    if (result.isNewDocument) filed.push(inst.slug);
    else skippedFiling.push(inst.slug);
  }

  console.log("file-ifrs-sources —");
  console.log(`  instruments registered: ${registered.length} [${registered.join(", ")}]`);
  console.log(`  registrations skipped (already present): ${skippedRegistration.length}`);
  console.log(`  sources filed (new content): ${filed.length} [${filed.join(", ")}]`);
  console.log(`  filings skipped (content unchanged): ${skippedFiling.length}`);
  console.log(`  PDFs absent / empty (skipped): ${absent.length}`);
  for (const a of absent) console.log(`    - ${a}`);
}

main();
