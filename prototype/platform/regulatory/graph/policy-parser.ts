// platform/regulatory/graph/policy-parser.ts
//
// Parse YAML frontmatter from policy markdown files in Policies/.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { readFileSync } from "node:fs";

export interface PolicyFrontmatter {
  policyId: string;
  title: string;
  status: string;
  owner: string;
  version: string;
  effectiveFrom?: string;
  citations: string[];
  /** ORG-* IDs extracted from the summary "closes ORG-XXX, ORG-YYY" pattern. */
  obligationsClosed: string[];
  /**
   * ORG-* IDs declared in the explicit `obligations:` frontmatter list — the
   * policy's own statement of which adopted obligations it implements
   * (WS-OBLIGATION-POLICY-MAPPING).
   */
  obligationsImplemented: string[];
  riskTaxonomy: string[];
}

/**
 * Parse YAML frontmatter between `---` markers.
 * Returns null if the file has no frontmatter or cannot be parsed.
 */
export function parsePolicyFile(filePath: string): PolicyFrontmatter | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const fm = extractFrontmatter(raw);
  if (!fm) return null;

  const policyId = scalarOf(fm["policy-id"] ?? fm.policyId) ?? "";
  if (!policyId) return null;

  const title = scalarOf(fm.title) ?? "";
  const status = scalarOf(fm.status) ?? "";
  const owner = scalarOf(fm.owner) ?? "";
  const version = String(scalarOf(fm.version) ?? "1");
  const effectiveFromRaw = scalarOf(fm["effective-from"]) ?? scalarOf(fm.effectiveFrom);

  // citations — can be a YAML array or a single string
  const citationsRaw = fm.citations;
  const citations: string[] = Array.isArray(citationsRaw)
    ? citationsRaw
    : citationsRaw
      ? [String(citationsRaw)]
      : [];

  // riskTaxonomy — can be a YAML array or a single string
  const riskRaw = fm.riskTaxonomy ?? fm["risk-taxonomy"];
  const riskTaxonomy: string[] = Array.isArray(riskRaw)
    ? riskRaw
    : riskRaw
      ? [String(riskRaw)]
      : [];

  // Parse summary for ORG-* obligation IDs
  const summary = String(scalarOf(fm.summary) ?? "");
  const obligationsClosed = extractObligationIds(summary);

  // Explicit `obligations:` frontmatter list (ORG-* ids the policy implements)
  const obligationsRaw = fm.obligations;
  const obligationsImplemented: string[] = (
    Array.isArray(obligationsRaw) ? obligationsRaw : obligationsRaw ? [String(obligationsRaw)] : []
  )
    .map((o) => o.trim())
    .filter((o) => /^ORG-/.test(o));

  const result: PolicyFrontmatter = {
    policyId,
    title,
    status,
    owner,
    version,
    citations,
    obligationsClosed,
    obligationsImplemented,
    riskTaxonomy,
  };
  if (effectiveFromRaw) result.effectiveFrom = effectiveFromRaw;
  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the scalar string value, or undefined if the value is an array or absent. */
function scalarOf(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Extract YAML frontmatter into a plain key→value map.
 * Only handles simple scalar values and YAML lists (- item per line).
 * Does not require a full YAML parser.
 */
function extractFrontmatter(content: string): Record<string, string | string[]> | null {
  const stripped = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!stripped.startsWith("---")) return null;

  const end = stripped.indexOf("\n---", 3);
  if (end < 0) return null;

  const block = stripped.slice(4, end);
  return parseSimpleYaml(block);
}

/**
 * Very small YAML parser covering the subset used in policy frontmatter:
 * - `key: value`
 * - `key: "quoted value"`
 * - `key: 'quoted value'`
 * - `key:` followed by `  - item` lines (array)
 * - Multi-line value detection (pipe `|` blocks ignored — returned as "")
 */
function parseSimpleYaml(block: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const lines = block.split("\n");
  let currentKey: string | null = null;
  let collectingArray = false;
  const currentArray: string[] = [];

  const flushArray = () => {
    if (currentKey && collectingArray) {
      result[currentKey] = [...currentArray];
      currentArray.length = 0;
      collectingArray = false;
    }
    currentKey = null;
  };

  for (const line of lines) {
    // Array item under current key
    if (collectingArray && /^\s{1,}-\s+/.test(line)) {
      const item = line
        .replace(/^\s+-\s+/, "")
        .replace(/^["']|["']$/g, "")
        .trim();
      currentArray.push(item);
      continue;
    }

    // New key-value pair
    const kvMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)?$/);
    if (!kvMatch) {
      // Continuation or blank; flush array if pending
      if (!line.trim() || /^\s{1,}/.test(line)) {
        // Could be array item on next line — wait
        continue;
      }
      flushArray();
      continue;
    }

    // Flush any pending array
    if (collectingArray) flushArray();

    const key = kvMatch[1] as string;
    const val = (kvMatch[2] ?? "").trim();

    if (!val || val === "|" || val === ">") {
      // Start of array or multiline block
      currentKey = key;
      collectingArray = true;
      result[key] = "";
      continue;
    }

    // Strip surrounding quotes
    const unquoted = val.replace(/^["']|["']$/g, "");
    result[key] = unquoted;
    currentKey = key;
    collectingArray = false;
  }

  // Flush trailing array
  if (collectingArray && currentKey) {
    result[currentKey] = [...currentArray];
  }

  return result;
}

/**
 * Extract ORG-* obligation IDs from free text (summary, body).
 * Matches patterns like "ORG-PR-01", "ORG-FC-23", "ORG-BNK-CYBER-CONS".
 */
function extractObligationIds(text: string): string[] {
  const matches = text.match(/ORG-[A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*/g);
  if (!matches) return [];
  // Deduplicate
  return [...new Set(matches)];
}
