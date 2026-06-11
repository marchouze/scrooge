// scripts/regulatory/stamp-pa-hashes.ts
//
// WS-PA-REMEDIATION Phase 1 — post-acquire hash stamping for PA instruments.
//
// Replays RecordFiled{category:"regulatory-source"} events where slug matches
// PA instruments (banks-d*, banks-c*, banks-gn*, banks-act, rrb), then stamps
// goldenSourceHash onto the corresponding *-structured.json files under
// Regulations/Banks/source-docs/ and Regulations/SARB-PA/source-docs/.
//
// Run AFTER the acquisition loop:
//
//   BANK_EVENT_DB="$HOME/.local/share/bank/event.db" \
//     bun run tsx scripts/regulatory/stamp-pa-hashes.ts
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Author: Mira (Compliance / RegTech engineer, engineering).

// D-CROSS-WORKTREE-EVENT-STORE-SYNC — import FIRST
import "../dispatch/resolve-event-db-boot";

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve as pathResolve } from "node:path";
import { eventStore } from "../../platform/composition";
import type { RecordFiledPayload } from "../../platform/event-store/event-types/rms";
import type { StructuredSourceDocument } from "../../platform/regulatory/structured-source-schema";

function repoRoot(): string {
  return pathResolve(import.meta.dir, "..", "..", "..");
}

function isPaSlug(slug: string): boolean {
  return (
    slug.startsWith("banks-d") ||
    slug.startsWith("banks-c") ||
    slug.startsWith("banks-gn") ||
    slug === "banks-act" ||
    slug === "rrb"
  );
}

function jsonPathFor(root: string, slug: string): string {
  if (slug === "banks-act" || slug === "rrb") {
    return join(root, "Regulations", "SARB-PA", "source-docs", `${slug}-structured.json`);
  }
  return join(root, "Regulations", "Banks", "source-docs", `${slug}-structured.json`);
}

async function main(): Promise<void> {
  const root = repoRoot();
  const stamped: Array<{ slug: string; hash: string; path: string }> = [];
  const skipped: Array<{ slug: string; reason: string }> = [];

  for (const event of eventStore.replay({ type: "RecordFiled" })) {
    const p = event.payload as RecordFiledPayload;
    const meta = p.metadata;
    if (!meta || meta.category !== "regulatory-source") continue;
    const slug: string = meta.slug ?? "";
    if (!isPaSlug(slug)) continue;

    const jsonPath = jsonPathFor(root, slug);

    if (!existsSync(jsonPath)) {
      skipped.push({ slug, reason: `structured JSON not found: ${jsonPath}` });
      continue;
    }

    let doc: StructuredSourceDocument;
    try {
      doc = JSON.parse(readFileSync(jsonPath, "utf-8")) as StructuredSourceDocument;
    } catch (e) {
      skipped.push({ slug, reason: `parse error: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }

    const hash = p.documentHash;
    if (doc.goldenSourceHash === hash) {
      stamped.push({ slug, hash, path: jsonPath });
      continue;
    }

    doc.goldenSourceHash = hash;
    writeFileSync(jsonPath, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");
    stamped.push({ slug, hash, path: jsonPath });
  }

  console.log(
    JSON.stringify({
      level: "info",
      service: "bank-prototype",
      script: "stamp-pa-hashes",
      stamped: stamped.length,
      skipped: skipped.length,
      detail: { stamped, skipped },
      msg: `Stamped goldenSourceHash on ${stamped.length} PA structured JSON files`,
    }),
  );

  if (skipped.length > 0) {
    process.stderr.write(`[warn] ${skipped.length} slugs skipped:\n`);
    for (const s of skipped) {
      process.stderr.write(`  ${s.slug}: ${s.reason}\n`);
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[error] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
