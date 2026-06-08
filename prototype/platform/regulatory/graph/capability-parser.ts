// platform/regulatory/graph/capability-parser.ts
//
// Parse the `system-capability:` frontmatter field of a procedure into a list
// of typed Capability bindings. This is the SINGLE source of the slug rule —
// both the graph seeder (seed-projection.ts) and the recon:orphan-capability
// gate import from here so the slug derivation can never drift between them.
//
// Authority: D-PRINCIPLE-2-CAPABILITY-LAYER (CEO-approved 2026-06-08).
// Source finding: record:documents:scrooge:principle-2-capability-to-procedure-review:2026-06-04 (F1).
// Author: Atlas (Core banking platform architect, engineering).

/** A single capability parsed from a `system-capability:` frontmatter value. */
export interface ParsedCapability {
  /** Canonical reversible slug, e.g. "platform/markets/cdm/fx". */
  slug: string;
  /** Graph node id: `CAP-<slug>`. */
  nodeId: string;
  /** Citable URN: `urn:capability:bank:<slug>`. */
  urn: string;
  /** "planned" when the source token carried a "(PLANNED)" marker, else "live". */
  status: "planned" | "live";
  /** The original token (pre-slug), for provenance / debugging. */
  raw: string;
}

// ---------------------------------------------------------------------------
// Slug rule (DETERMINISTIC + REVERSIBLE)
// ---------------------------------------------------------------------------
//
// A `system-capability:` value is a list of code-module references separated by
// "·" or "+". Each reference is one of:
//   "@platform/markets/cdm/fx"                  → namespaced path (leading @)
//   "prototype/platform/projections/foo.ts"     → bare repo path
//   "@platform/ilaap (LIVE — atlas:ilaap-run)"  → trailing parenthetical note
//   "@platform/markets/mandate-registry (PLANNED)" → planned marker
//
// SLUG DERIVATION (applied per token):
//   1. Strip any trailing parenthetical "(...)" (the status / note marker).
//   2. Strip a leading "@" (namespace sigil) OR a leading "prototype/" segment.
//   3. Strip a trailing ".ts" file extension.
//   4. Lower-case; trim surrounding slashes/whitespace.
//   The remaining path IS the slug — reversible: prepend "@" (or "prototype/"
//   for file-path forms) to recover the source reference shape.
//
// STATUS: "planned" iff the token contains a "(PLANNED)" marker (case-insensitive);
//   otherwise "live" (covers "(LIVE — ...)" notes and unmarked tokens).
//
// The CapabilityUrnSchema (platform/citation/urn.ts) accepts
// `urn:capability:bank:[a-z0-9][a-z0-9._/-]*` so slashes survive in the URN.
// ---------------------------------------------------------------------------

const SPLIT_RE = /[·+]/;

/** True when a token carries an explicit "(PLANNED)" marker. */
function isPlanned(token: string): boolean {
  return /\(planned\b/i.test(token);
}

/** Derive the canonical reversible slug from a single capability token. */
export function capabilitySlug(token: string): string {
  let s = token.trim();
  // 1. Strip ALL trailing parenthetical notes/markers, e.g. "(PLANNED)",
  //    "(LIVE — atlas:ilaap-run handler)", "(DHA adapter — PLANNED)".
  s = s.replace(/\s*\([^()]*\)\s*$/g, "").trim();
  // Re-run once in case of stacked "(...)  (...)" (rare).
  s = s.replace(/\s*\([^()]*\)\s*$/g, "").trim();
  // 2. Strip a leading "@" sigil or a leading "prototype/" path segment.
  if (s.startsWith("@")) {
    s = s.slice(1);
  } else if (s.startsWith("prototype/")) {
    s = s.slice("prototype/".length);
  }
  // 3. Strip a trailing ".ts" extension (file-path forms).
  s = s.replace(/\.ts$/i, "");
  // 4. Normalise: lower-case, trim surrounding slashes/whitespace.
  s = s
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return s;
}

/** Build the CAP node id for a slug. */
export function capabilityNodeId(slug: string): string {
  return `CAP-${slug}`;
}

/** Build the urn:capability:bank URN for a slug. */
export function capabilityUrn(slug: string): string {
  return `urn:capability:bank:${slug}`;
}

/**
 * Parse a raw `system-capability:` frontmatter value into a deduplicated list
 * of ParsedCapability. Splits on "·"/"+", trims, drops empties.
 *
 * When the same slug appears more than once across tokens, the FIRST occurrence
 * wins; a "live" status anywhere upgrades a "planned" duplicate to "live"
 * (presence of a real binding dominates a planned one).
 */
export function parseSystemCapabilityValue(rawValue: string): ParsedCapability[] {
  // Strip surrounding quotes the YAML scalar may carry.
  const value = rawValue.trim().replace(/^["']|["']$/g, "");
  if (!value) return [];

  const byslug = new Map<string, ParsedCapability>();
  for (const token of value.split(SPLIT_RE)) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const slug = capabilitySlug(trimmed);
    if (!slug) continue;
    const status: "planned" | "live" = isPlanned(trimmed) ? "planned" : "live";
    const existing = byslug.get(slug);
    if (existing) {
      // A "live" sighting upgrades an earlier "planned" duplicate.
      if (existing.status === "planned" && status === "live") existing.status = "live";
      continue;
    }
    byslug.set(slug, {
      slug,
      nodeId: capabilityNodeId(slug),
      urn: capabilityUrn(slug),
      status,
      raw: trimmed,
    });
  }
  return [...byslug.values()];
}
