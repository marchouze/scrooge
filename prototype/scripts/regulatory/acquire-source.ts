// scripts/regulatory/acquire-source.ts
//
// WS-REGULATORY-LIBRARY-V1 Slice 1 — the source-filing CLI.
//
// Files a regulatory source binary (the regulator's published text — PDF,
// etc.) into the BLAKE3 content-addressed document store via a
// `RecordFiled{registerKey:"documents"}` event (Principle 1 — the event is
// canonical; the blob is the heavy bytes it cites by hash). The seed-projection
// replays these filings and hash-links each blob to its graph Document node.
//
// Usage:
//
//   bun run acquire:source \
//     --instrument-id FAIS-ACT-37-2002 \
//     --slug fais-act \
//     --title "Financial Advisory and Intermediary Services Act 37 of 2002" \
//     --regulator FSCA \
//     --from Regulations/FSCA/source-docs/fais-act-37-2002.pdf \
//     [--source-url <url>] [--content-type application/pdf]
//
// `--from` (a local file) is the PRIMARY path and the only one CI ever
// exercises. `--source-url` is recorded as provenance; a best-effort
// `fetch()` runs ONLY when `--from` is absent — the network MUST NEVER run in
// CI (CI always passes `--from`).
//
// To make the filing visible cross-worktree (so `graph:seed` and the
// integrity recon see it), run against the SHARED store:
//
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//   BANK_DOCUMENT_STORE="$HOME/.local/share/bank/documents" \
//   bun run acquire:source ...
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Backing brief: brief:mira:regulatory-library-slice-1-source-filing-primiti:2026-06-11.
// Author: Mira (Compliance / RegTech engineer, engineering) +
//         Atlas (Core banking platform architect, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — MUST be the first import so the shared
// resolver mutates BANK_EVENT_DB / BANK_DOCUMENT_STORE BEFORE
// `platform/composition` resolves its dbPath at module-load time.
import "../dispatch/resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { clock } from "../../platform/composition";
import { recordRegulatorySource } from "../../platform/records";
import { die, emitOk, optionalString, parseArgs, requireString } from "../dispatch/args";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  json: "application/json",
  html: "text/html",
  xml: "application/xml",
};

function contentTypeFor(pathOrUrl: string, override: string | undefined): string {
  if (override) return override;
  const ext = (pathOrUrl.split("?")[0] ?? "").split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
}

async function loadBytes(
  fromPath: string | undefined,
  sourceUrl: string | undefined,
): Promise<{ bytes: Uint8Array; origin: string }> {
  if (fromPath) {
    if (!existsSync(fromPath)) die(`--from path not found: ${fromPath}`);
    const bytes = new Uint8Array(readFileSync(fromPath));
    if (bytes.length === 0) die(`--from file is empty: ${fromPath}`);
    return { bytes, origin: fromPath };
  }
  if (!sourceUrl) {
    die("one of --from <local-file> or --source-url <url> is required");
  }
  // Best-effort network fetch — ONLY reached when --from is absent. CI always
  // passes --from, so the network is never exercised in CI.
  const res = await fetch(sourceUrl);
  if (!res.ok) die(`fetch ${sourceUrl} failed: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) die(`fetched ${sourceUrl} but body was empty`);
  return { bytes, origin: sourceUrl };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), new Set<string>());

  const instrumentId = requireString(args, "instrument-id");
  const slug = requireString(args, "slug");
  const title = requireString(args, "title");
  // --regulator is provenance / operator-facing context; not persisted on the
  // RecordFiled metadata (the Document node already carries the regulator).
  requireString(args, "regulator");

  const fromPath = optionalString(args, "from");
  const sourceUrl = optionalString(args, "source-url");
  const contentTypeOverride = optionalString(args, "content-type");

  const { bytes, origin } = await loadBytes(fromPath, sourceUrl);
  const contentType = contentTypeFor(origin, contentTypeOverride);

  const result = recordRegulatorySource(
    {
      instrumentId,
      slug,
      title,
      path: fromPath ?? origin,
      ...(sourceUrl ? { sourceUrl } : {}),
      contentType,
      body: bytes,
      actor: { type: "service", id: "agent:mira" },
    },
    clock.now(),
  );

  emitOk({
    instrumentId,
    slug,
    documentHash: result.documentHash,
    size: bytes.length,
    isNew: result.isNewDocument,
  });
}

main().catch((err) => {
  die(err instanceof Error ? err.message : String(err));
});
