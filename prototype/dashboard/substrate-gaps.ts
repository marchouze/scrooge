// dashboard/substrate-gaps.ts
//
// Reads the most-recent Atlas substrate-state deliverable from
// /Owner Inbox/ and extracts the "## Substrate gaps" section bullets
// for surface on /health.html.
//
// Atlas owns the substrate-gap inventory (per his operating spec § 11).
// His weekly autonomous run writes a markdown deliverable; this module
// is the structured-data view of that markdown for the dashboard's UI.
//
// Cached for 5 minutes server-side. Files don't change on a faster
// cadence; the cache TTL also bounds the cost of re-parsing.
//
// Author: Atlas (substrate-state report owner) · runtime infrastructure
// shared with /api/agent-runs.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { logger } from "../platform/observability/logger";

export interface SubstrateGapsView {
  readonly asOf: string | null; // ISO from the deliverable's frontmatter
  readonly sourceFile: string | null; // basename of the parsed deliverable
  readonly gaps: readonly string[]; // bullet lines, leading "- " stripped
}

interface Cached {
  fetchedAt: number;
  view: SubstrateGapsView;
}

const TTL_MS = 5 * 60 * 1000;
let cache: Cached | null = null;

function findLatestAtlasFile(ownerInboxDir: string): string | null {
  if (!existsSync(ownerInboxDir)) return null;
  const entries: string[] = [];
  for (const f of readdirSync(ownerInboxDir)) {
    if (!f.endsWith(".md")) continue;
    if (!/^\d{4}-\d{2}-\d{2}_atlas_substrate-state\.md$/.test(f)) continue;
    entries.push(f);
  }
  if (entries.length === 0) return null;
  // Filename starts with ISO date, so lexical-descending = most recent first.
  entries.sort((a, b) => (a < b ? 1 : -1));
  return entries[0] ?? null;
}

const FRONTMATTER_ASOF = /^asOf:\s*(\S+)\s*$/m;
const SUBSTRATE_GAPS_HEADING = /^##\s+Substrate gaps\s*$/i;
const NEXT_H2 = /^##\s+/;

function parseGaps(content: string): { asOf: string | null; gaps: string[] } {
  const asOfMatch = content.match(FRONTMATTER_ASOF);
  const asOf = asOfMatch?.[1] ?? null;

  const gaps: string[] = [];
  const lines = content.split(/\r?\n/);
  let inSection = false;
  for (const line of lines) {
    if (!inSection) {
      if (SUBSTRATE_GAPS_HEADING.test(line)) inSection = true;
      continue;
    }
    if (NEXT_H2.test(line)) break;
    const m = line.match(/^-\s+(.+)$/);
    if (m?.[1]) gaps.push(m[1].trim());
  }
  return { asOf, gaps };
}

export function getSubstrateGapsView(repoRoot: string): SubstrateGapsView {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache.view;

  const ownerInboxDir = resolve(repoRoot, "archive", "owner-inbox");
  const filename = findLatestAtlasFile(ownerInboxDir);
  if (!filename) {
    const view: SubstrateGapsView = { asOf: null, sourceFile: null, gaps: [] };
    cache = { fetchedAt: now, view };
    return view;
  }
  try {
    const path = resolve(ownerInboxDir, filename);
    const stat = statSync(path);
    if (!stat.isFile()) throw new Error("not a file");
    const content = readFileSync(path, "utf8");
    const { asOf, gaps } = parseGaps(content);
    const view: SubstrateGapsView = { asOf, sourceFile: filename, gaps };
    cache = { fetchedAt: now, view };
    logger.debug({ filename, gaps: gaps.length }, "substrate-gaps cache refreshed");
    return view;
  } catch (e) {
    logger.warn(
      { err: (e as Error).message, filename },
      "substrate-gaps parse failed; serving empty view",
    );
    const view: SubstrateGapsView = { asOf: null, sourceFile: filename, gaps: [] };
    cache = { fetchedAt: now, view };
    return view;
  }
}
