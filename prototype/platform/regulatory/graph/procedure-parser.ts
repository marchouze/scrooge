// platform/regulatory/graph/procedure-parser.ts
//
// Parse procedure frontmatter from Procedures/ markdown files.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { readFileSync } from "node:fs";

export interface ProcedureFrontmatter {
  procedureId: string;
  title: string;
  status: string;
  owner?: string | undefined;
  /** Links to a policy-id — sourced from "Source policy" section or frontmatter. */
  policyCited?: string | undefined;
  /**
   * Raw `system-capability:` frontmatter value (the "@platform/..." reference
   * list, "·"/"+"-separated). Undefined when the procedure has no binding —
   * a Principle-2 lower-half gap. Parsed by capability-parser.ts.
   */
  systemCapability?: string | undefined;
}

/**
 * Parse a procedure file. Strategy:
 *  1. Check YAML frontmatter for `procedure-id` / `policy-cited`.
 *  2. Fall back to scanning the markdown body for "Procedure ID:" and
 *     "Source policy" fields (common pattern in this codebase where
 *     procedures use markdown headers rather than YAML frontmatter).
 *
 * Returns null if no procedure ID can be determined.
 */
export function parseProcedureFile(filePath: string): ProcedureFrontmatter | null {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  // Try YAML frontmatter first
  const fm = extractFrontmatter(raw);
  if (fm) {
    const procedureId = fm["procedure-id"] ?? fm.procedureId ?? "";
    if (procedureId) {
      const r: ProcedureFrontmatter = {
        procedureId,
        title: fm.title ?? deriveTitleFromPath(filePath),
        status: fm.status ?? "UNKNOWN",
      };
      const ownerVal = fm.owner;
      if (ownerVal) r.owner = ownerVal;
      const policyVal = fm["policy-cited"] ?? fm.policyCited;
      if (policyVal) r.policyCited = policyVal;
      const capVal = fm["system-capability"] ?? fm.systemCapability;
      if (capVal) r.systemCapability = capVal;
      return r;
    }
  }

  // Fall back: scan markdown body
  return parseProcedureBody(raw, filePath);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractFrontmatter(content: string): Record<string, string> | null {
  const stripped = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!stripped.startsWith("---")) return null;
  const end = stripped.indexOf("\n---", 3);
  if (end < 0) return null;
  const block = stripped.slice(4, end);
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s+(.+)$/);
    if (m) result[m[1] as string] = (m[2] as string).replace(/^["']|["']$/g, "").trim();
  }
  return result;
}

/**
 * Parse key fields from the markdown body.
 * Procedures in this codebase commonly have:
 *   **Procedure ID:** PROC-XXX-YY
 *   # Procedure — Title
 *   ## Source policy
 *   `policy-id` or prose reference
 */
function parseProcedureBody(content: string, filePath: string): ProcedureFrontmatter | null {
  const lines = content.split("\n");

  let procedureId = "";
  let title = "";
  let status = "UNKNOWN";
  let owner: string | undefined;
  let policyCited: string | undefined;
  let systemCapability: string | undefined;
  let inSourcePolicy = false;

  for (const line of lines) {
    // system-capability frontmatter / inline field (e.g. `system-capability: "@platform/..."`)
    if (!systemCapability) {
      const capMatch = line.match(/^\s*system-capability:\s*(.+)$/i);
      if (capMatch) {
        systemCapability = (capMatch[1] as string).trim().replace(/^["']|["']$/g, "");
      }
    }

    // Procedure ID
    const idMatch = line.match(/\*\*Procedure\s+ID[:\*]+\s*([A-Z][A-Z0-9-]+)/i);
    if (idMatch) {
      procedureId = idMatch[1] as string;
    }

    // Title from H1
    if (!title && line.startsWith("# ")) {
      title = line
        .replace(/^#+\s+/, "")
        .replace(/\*\*/g, "")
        .trim();
    }

    // Status
    const statusMatch = line.match(/\*\*Status[:\*]+\s*(.+)/i);
    if (statusMatch) {
      status = (statusMatch[1] as string).replace(/\*\*/g, "").trim();
    }

    // Owner
    const ownerMatch = line.match(/\*\*Owner[:\*]+\s*(.+)/i);
    if (ownerMatch && !owner) {
      owner = (ownerMatch[1] as string).replace(/\*\*/g, "").trim();
    }

    // Source policy section
    if (/^#{1,3}\s+.*[Ss]ource\s+[Pp]olicy/.test(line)) {
      inSourcePolicy = true;
      continue;
    }
    if (inSourcePolicy && /^#{1,3}\s+/.test(line) && !/[Ss]ource\s+[Pp]olicy/.test(line)) {
      inSourcePolicy = false;
    }
    if (inSourcePolicy && !policyCited) {
      // Look for policy-id in backtick references or prose
      const policyIdMatch = line.match(/`([a-z][a-z0-9-]+-policy(?:-v\d+)?)`/i);
      if (policyIdMatch) {
        policyCited = policyIdMatch[1] as string;
      }
    }
  }

  if (!procedureId) {
    // Use filename as fallback ID
    procedureId = deriveProcedureIdFromPath(filePath);
  }

  if (!title) {
    title = deriveTitleFromPath(filePath);
  }

  const result: ProcedureFrontmatter = { procedureId, title, status };
  if (owner) result.owner = owner;
  if (policyCited) result.policyCited = policyCited;
  if (systemCapability) result.systemCapability = systemCapability;
  return result;
}

function deriveTitleFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.md$/, "").replace(/-/g, " ");
}

function deriveProcedureIdFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? filePath;
  return `PROC-${base
    .replace(/\.md$/, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "-")}`;
}
