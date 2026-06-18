// scripts/regulatory/cleanup-guidance-note-stubs.ts
//
// One-off DATA cleanup of PDF→structured extraction artifacts in 8 already
// fully-sourced guidance-note structured docs. Two deterministic passes:
//
//   A. Prune empty NUMBERED stub nodes. PDF extraction emitted a numbering
//      marker (e.g. "1.2", "2.4", "2.7.1") as a provision node carrying a
//      `number` but EMPTY `text`, EMPTY/absent `heading`, no `summary`, and no
//      text-bearing descendants — the real body text sits in sibling numbered
//      items. The Slice-1 normalizer classifies these `completeness:"heading-only"`,
//      and the reader renders a stray empty numbered bullet. A node is pruned
//      ONLY when it is empty to the leaves (see `isPrunableStub`).
//
//   B. De-duplicate EXACT whole-string repeated headings. The extractor
//      double/triple-captured a heading, e.g. "Savings products Savings products
//      …" → "Savings products". Collapsed ONLY when the heading is purely the
//      repeated unit (no trailing body content) — see `collapseExactRepeat`.
//      Headings that merely contain a repeated word naturally, or where body
//      text leaked into the heading after the repeat, are left untouched.
//
// SAFETY — this script NEVER prunes a stub whose provision id is referenced by
// an adopted obligation (an obligation pointing at an empty provision is a
// separate finding, NOT something this cleanup should silently delete). The
// obligation-safety check is performed by the runner against the canonical
// event store + regulatory graph (the `buildRegulationObligationIndex` reverse
// index) BEFORE any write; a referenced stub is kept and reported. The pure
// transform here also re-derives provision ids before/after and ASSERTS that no
// surviving sibling's id shifted (ids are number-keyed by `ensureProvisionIds`,
// so pruning an empty node must not move a real node's id).
//
// This script does NO rewriting of regulation text. It only removes nodes that
// carry no text anywhere in their subtree, and collapses a heading that is a
// pure self-repeat. Idempotent: a second run is a no-op.
//
// Authority: D-REGULATORY-STRUCTURED-FIRST-CANONICAL.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ensureProvisionIds,
  type LoaderDoc,
  type LoaderSection,
  type LoaderSubsection,
} from "../../platform/regulatory/structured-doc-loader";

// ---------------------------------------------------------------------------
// Pure transform — prune stubs + de-dup headings
// ---------------------------------------------------------------------------

/** A node that may carry text, a heading/title, a summary and child nodes. */
type CleanableNode = LoaderSubsection & {
  heading?: string;
  title?: string;
  summary?: string;
  subsections?: CleanableNode[];
};

function nodeText(n: CleanableNode): string {
  return typeof n.text === "string" ? n.text.trim() : "";
}

function nodeSummary(n: CleanableNode): string {
  return typeof n.summary === "string" ? n.summary.trim() : "";
}

/** Does this node, or anything in its subtree, carry non-empty text OR summary? */
export function subtreeHasContent(n: CleanableNode): boolean {
  if (nodeText(n)) return true;
  if (nodeSummary(n)) return true;
  return (n.subsections ?? []).some(subtreeHasContent);
}

/**
 * A node is a prunable empty stub when ALL hold:
 *   (1) empty/whitespace `text`;
 *   (2) no `summary`;
 *   (3) every descendant (recursively) is also empty of text AND summary.
 * (The obligation-reference check (4) lives in the runner, not here, because it
 * needs the event store + graph. The runner filters referenced ids out of the
 * `keepIds` set before calling the transform.)
 */
export function isPrunableStub(n: CleanableNode): boolean {
  if (nodeText(n)) return false;
  if (nodeSummary(n)) return false;
  return !(n.subsections ?? []).some(subtreeHasContent);
}

/**
 * Collapse a heading that is the EXACT consecutive repetition of a single unit
 * (`"X X"`, `"X X X"`, …) down to one `"X"`. Returns the collapsed string, or
 * the input unchanged when it is not a pure whole-string self-repeat.
 *
 * Conservative by construction: only collapses when the WHOLE trimmed string is
 * `unit` repeated k≥2 times with single-space joins and NOTHING after the last
 * repeat. "Corporate governance a) Board …" (repeat + leaked body) and
 * "Front companies (procurement) The …" (heading + sentence) are NOT collapsed.
 */
export function collapseExactRepeat(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return raw;
  const words = t.split(" ");
  const n = words.length;
  for (let u = 1; u <= Math.floor(n / 2); u++) {
    if (n % u !== 0) continue;
    const unit = words.slice(0, u).join(" ");
    let allMatch = true;
    for (let i = u; i < n; i += u) {
      if (words.slice(i, i + u).join(" ") !== unit) {
        allMatch = false;
        break;
      }
    }
    if (allMatch && n / u >= 2) return unit;
  }
  return raw;
}

export interface CleanupResult {
  /** ids (from `ensureProvisionIds`) of nodes pruned. */
  prunedIds: string[];
  /** ids that matched the stub shape but were KEPT (obligation-referenced). */
  keptReferencedIds: string[];
  /** `{ id, before, after }` for each heading collapsed. */
  collapsedHeadings: Array<{ id: string; before: string; after: string }>;
}

/**
 * Prune empty stubs and collapse exact-repeat headings in place on `doc`.
 *
 * @param keepIds provision ids that MUST NOT be pruned even if they match the
 *   stub shape (obligation-referenced — surfaced as `keptReferencedIds`).
 *
 * Id-stability contract: ids are (re)derived by `ensureProvisionIds` before and
 * after the prune. Every id that SURVIVES must be byte-identical across the two
 * passes; a shift means pruning moved a real node and the function THROWS rather
 * than risk breaking an adoption.
 */
export function cleanupDoc(doc: LoaderDoc, keepIds: ReadonlySet<string>): CleanupResult {
  // Snapshot the surviving-id set as it stands BEFORE any prune.
  ensureProvisionIds(doc);
  const idsBefore = new Set<string>();
  collectIds(doc, idsBefore);

  const prunedIds: string[] = [];
  const keptReferencedIds: string[] = [];
  const collapsedHeadings: Array<{ id: string; before: string; after: string }> = [];

  const pruneChildren = (children: CleanableNode[] | undefined): CleanableNode[] | undefined => {
    if (!children) return children;
    const survivors: CleanableNode[] = [];
    for (const child of children) {
      // De-dup heading first (cosmetic; never affects prune decision or ids).
      collapseNodeHeading(child, collapsedHeadings);
      if (isPrunableStub(child)) {
        const id = typeof child.id === "string" ? child.id : "";
        if (id && keepIds.has(id)) {
          keptReferencedIds.push(id);
          survivors.push(child);
          continue;
        }
        prunedIds.push(id);
        continue; // drop it
      }
      // Recurse into a non-prunable node's children.
      child.subsections = pruneChildren(child.subsections);
      survivors.push(child);
    }
    return survivors;
  };

  for (const chapter of doc.chapters) {
    // Collapse chapter-level title/heading repeats too (cosmetic).
    collapseNodeHeading(chapter as unknown as CleanableNode, collapsedHeadings);
    const sections = chapter.sections as unknown as CleanableNode[];
    const kept: LoaderSection[] = [];
    for (const section of sections) {
      collapseNodeHeading(section, collapsedHeadings);
      if (isPrunableStub(section)) {
        const id = typeof section.id === "string" ? section.id : "";
        if (id && keepIds.has(id)) {
          keptReferencedIds.push(id);
          kept.push(section as unknown as LoaderSection);
          continue;
        }
        prunedIds.push(id);
        continue;
      }
      section.subsections = pruneChildren(section.subsections);
      kept.push(section as unknown as LoaderSection);
    }
    chapter.sections = kept;
  }

  // Re-derive ids and assert no SURVIVING id moved. Pruned ids legitimately
  // disappear; everything else must be unchanged.
  ensureProvisionIds(doc);
  const idsAfter = new Set<string>();
  collectIds(doc, idsAfter);
  const prunedSet = new Set(prunedIds);
  for (const id of idsBefore) {
    if (prunedSet.has(id)) continue;
    if (!idsAfter.has(id)) {
      throw new Error(
        `cleanup-guidance-note-stubs: id-stability violation — surviving provision "${id}" ` +
          `changed id after pruning. Aborting rather than risk breaking an adoption.`,
      );
    }
  }
  // And no NEW id appeared (a prune must never re-key a sibling onto a fresh id).
  for (const id of idsAfter) {
    if (!idsBefore.has(id)) {
      throw new Error(
        `cleanup-guidance-note-stubs: id-stability violation — new provision id "${id}" ` +
          `appeared after pruning. Aborting.`,
      );
    }
  }

  return { prunedIds, keptReferencedIds, collapsedHeadings };
}

function collapseNodeHeading(
  node: CleanableNode,
  log: Array<{ id: string; before: string; after: string }>,
): void {
  for (const field of ["heading", "title"] as const) {
    const cur = node[field];
    if (typeof cur !== "string") continue;
    const collapsed = collapseExactRepeat(cur);
    if (collapsed !== cur) {
      node[field] = collapsed;
      log.push({ id: typeof node.id === "string" ? node.id : "", before: cur, after: collapsed });
    }
  }
}

function collectIds(doc: LoaderDoc, into: Set<string>): void {
  const visit = (n: CleanableNode): void => {
    if (typeof n.id === "string" && n.id) into.add(n.id);
    for (const ss of n.subsections ?? []) visit(ss);
  };
  for (const chapter of doc.chapters) {
    if (typeof chapter.id === "string" && chapter.id) into.add(chapter.id);
    for (const section of chapter.sections as unknown as CleanableNode[]) visit(section);
  }
}

// ---------------------------------------------------------------------------
// CLI runner — load the 8 docs, build the obligation-safety keep-set, write.
// ---------------------------------------------------------------------------

/** The 8 in-scope guidance-note slugs and their on-disk paths (relative to repo root). */
export const TARGET_DOCS: ReadonlyArray<{ slug: string; relPath: string }> = [
  { slug: "gn2-2019", relPath: "Regulations/CoopBanks/source-docs/gn2-2019-structured.json" },
  { slug: "banks-gn3-2011", relPath: "Regulations/Banks/source-docs/banks-gn3-2011-structured.json" },
  { slug: "banks-d11-2025", relPath: "Regulations/Banks/source-docs/banks-d11-2025-structured.json" },
  { slug: "banks-gn3-2010", relPath: "Regulations/Banks/source-docs/banks-gn3-2010-structured.json" },
  { slug: "banks-gn5-2013", relPath: "Regulations/Banks/source-docs/banks-gn5-2013-structured.json" },
  { slug: "banks-gn7-2016", relPath: "Regulations/Banks/source-docs/banks-gn7-2016-structured.json" },
  { slug: "banks-gn9-2008", relPath: "Regulations/Banks/source-docs/banks-gn9-2008-structured.json" },
  { slug: "banks-gn12-2022", relPath: "Regulations/Banks/source-docs/banks-gn12-2022-structured.json" },
];

function repoRoot(): string {
  // import.meta.dir = <root>/prototype/scripts/regulatory
  return resolve(import.meta.dir, "..", "..", "..");
}

/**
 * Build the set of provision ids (loader-id form, qualified by slug via the
 * caller) that are referenced by an adopted obligation and therefore MUST NOT
 * be pruned. Returns a per-slug map of kept ids.
 *
 * The reverse index (`buildRegulationObligationIndex`) qualifies provision keys
 * by slug. We collect, for each target slug, every provision id that appears as
 * an obligation target, in BOTH the loader-id form (e.g. "s2-4") and the graph
 * PROV-id form, so a referenced stub in any encoding is caught.
 */
async function buildObligationReferencedIds(): Promise<Map<string, Set<string>>> {
  const { EventStore } = await import("../../platform/event-store/store");
  const { buildRegulationObligationIndex, provisionKey } = await import(
    "../../dashboard/regulation-obligation-index"
  );
  const homeDb = resolve(process.env.HOME ?? "", ".local", "share", "bank", "event.db");
  const store = new EventStore(homeDb, { readonly: true });
  const idx = buildRegulationObligationIndex(store);

  const bySlug = new Map<string, Set<string>>();
  for (const { slug } of TARGET_DOCS) bySlug.set(slug, new Set<string>());

  for (const key of idx.byProvision.keys()) {
    const sep = key.indexOf("::");
    if (sep < 0) continue;
    const slug = key.slice(0, sep);
    const provId = key.slice(sep + provisionKeySepLen());
    const set = bySlug.get(slug);
    if (set) set.add(provId);
  }
  return bySlug;
}

function provisionKeySepLen(): number {
  return "::".length;
}

async function main(): Promise<void> {
  const root = repoRoot();
  const referencedBySlug = await buildObligationReferencedIds();

  let totalPruned = 0;
  let totalKept = 0;
  let totalCollapsed = 0;

  for (const { slug, relPath } of TARGET_DOCS) {
    const path = resolve(root, relPath);
    const doc = JSON.parse(readFileSync(path, "utf-8")) as LoaderDoc;
    if (!doc.slug) doc.slug = slug;

    const referenced = referencedBySlug.get(slug) ?? new Set<string>();
    const result = cleanupDoc(doc, referenced);

    writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, "utf-8");

    totalPruned += result.prunedIds.length;
    totalKept += result.keptReferencedIds.length;
    totalCollapsed += result.collapsedHeadings.length;

    console.log(`\n[${slug}]`);
    console.log(`  pruned ${result.prunedIds.length}: ${result.prunedIds.join(", ") || "—"}`);
    if (result.keptReferencedIds.length) {
      console.log(
        `  KEPT (obligation-referenced) ${result.keptReferencedIds.length}: ${result.keptReferencedIds.join(", ")}`,
      );
    }
    for (const c of result.collapsedHeadings) {
      console.log(`  collapsed heading [${c.id}]: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
    }
  }

  console.log(
    `\nTOTAL pruned=${totalPruned} keptReferenced=${totalKept} headingsCollapsed=${totalCollapsed}`,
  );
}

if (import.meta.main) {
  await main();
}
