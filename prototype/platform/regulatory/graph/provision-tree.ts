// platform/regulatory/graph/provision-tree.ts
//
// Builds a parent→children map from a structured regulation doc and provides
// utilities for hierarchy-aware provision adoption state resolution.
//
// Used by:
//   - projection (buildProvisionAdoptionState) — server-side leaf resolution
//   - distillation endpoint — collecting adopted leaf texts for LLM input
//   - drift recon gate — finding provisions with stale verbatimHash
//
// "Leaf" = deepest addressable node in the hierarchy for a given branch.
// A section with no subsections is a leaf; a section with subsections is not.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Types (mirror the minimal subset of regulation-reader-view.ts we need here
// without creating a circular import — the structured doc types are plain JSON)
// ---------------------------------------------------------------------------

interface RegSubsection {
  id: string;
  number?: string;
  text?: string;
}

interface RegSection {
  id: string;
  number?: string;
  sectionNumber?: string;
  heading?: string;
  title?: string;
  text?: string;
  subsections?: RegSubsection[];
}

interface RegChapter {
  id: string;
  number?: string;
  heading?: string;
  title?: string;
  sections: RegSection[];
}

export interface RegStructuredDocMinimal {
  slug: string;
  title?: string;
  chapters: RegChapter[];
}

// ---------------------------------------------------------------------------
// ProvisionNode
// ---------------------------------------------------------------------------

export interface ProvisionNode {
  readonly id: string;
  readonly parentId: string | null;
  /** Direct child IDs (in document order). */
  readonly children: string[];
  /** Verbatim / summary text for this node (may be empty). */
  readonly text: string;
  readonly number?: string;
  readonly heading?: string;
}

export type ProvisionTree = Map<string, ProvisionNode>;

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build a ProvisionTree from a structured regulation doc.
 *
 * Hierarchy: document-root (slug) → chapters → sections → subsections.
 * The document root node uses the instrument slug as its ID, so a whole-doc
 * tick (`scopeId == slug`) covers every section in the instrument.
 */
export function buildProvisionTree(doc: RegStructuredDocMinimal): ProvisionTree {
  const tree = new Map<string, ProvisionNode>();

  const addNode = (node: ProvisionNode) => tree.set(node.id, node);
  const addChild = (parentId: string, childId: string) => {
    const p = tree.get(parentId);
    if (p) (p.children as string[]).push(childId);
  };

  // Document root
  addNode({ id: doc.slug, parentId: null, children: [], text: "", heading: doc.title ?? doc.slug });

  for (const chapter of doc.chapters) {
    addNode({
      id: chapter.id,
      parentId: doc.slug,
      children: [],
      text: "",
      heading: chapter.heading ?? chapter.title ?? chapter.id,
    });
    addChild(doc.slug, chapter.id);

    for (const section of chapter.sections) {
      addNode({
        id: section.id,
        parentId: chapter.id,
        children: [],
        text: section.text ?? "",
        number: section.number ?? section.sectionNumber,
        heading: section.heading ?? section.title,
      });
      addChild(chapter.id, section.id);

      for (const sub of section.subsections ?? []) {
        addNode({
          id: sub.id,
          parentId: section.id,
          children: [],
          text: sub.text ?? "",
          number: sub.number,
        });
        addChild(section.id, sub.id);
      }
    }
  }

  return tree;
}

// ---------------------------------------------------------------------------
// Traversal helpers
// ---------------------------------------------------------------------------

/** Return IDs of all leaf nodes under `nodeId` (inclusive if nodeId itself is a leaf). */
export function getLeafDescendants(tree: ProvisionTree, nodeId: string): string[] {
  const node = tree.get(nodeId);
  if (!node) return [];
  if (node.children.length === 0) return [nodeId];
  return node.children.flatMap((childId) => getLeafDescendants(tree, childId));
}

/** Return the nodeId and all its ancestor IDs (nearest ancestor first). */
export function getAncestors(tree: ProvisionTree, nodeId: string): string[] {
  const node = tree.get(nodeId);
  if (!node || node.parentId === null) return [];
  return [node.parentId, ...getAncestors(tree, node.parentId)];
}

// ---------------------------------------------------------------------------
// Adoption resolution
// ---------------------------------------------------------------------------

export interface ScopeEvent {
  scopeId: string;
  adopted: boolean;
  adoptedAt: string;
}

/**
 * Resolve whether a leaf provision is currently adopted, given the set of
 * scope events for its instrument.
 *
 * Algorithm: collect every event whose scopeId == leafId or is an ancestor
 * of leafId; pick the most recent by adoptedAt; ties → more specific (deeper)
 * scope wins.
 */
export function resolveLeafAdoptionState(
  leafId: string,
  tree: ProvisionTree,
  events: ScopeEvent[],
): boolean {
  const ancestors = getAncestors(tree, leafId);
  // Depth 0 = the leaf itself, depth N = root
  const depthOf = (id: string) => {
    if (id === leafId) return 0;
    const idx = ancestors.indexOf(id);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx + 1;
  };

  const covering = events.filter(
    (e) => e.scopeId === leafId || ancestors.includes(e.scopeId),
  );
  if (covering.length === 0) return false;

  // Sort: most recent first; ties → shallowest depth (i.e. most specific) first
  covering.sort((a, b) => {
    if (a.adoptedAt !== b.adoptedAt) return a.adoptedAt < b.adoptedAt ? 1 : -1;
    return depthOf(a.scopeId) - depthOf(b.scopeId);
  });

  return covering[0]!.adopted;
}

// ---------------------------------------------------------------------------
// Verbatim hash (drift anchor)
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hex digest of the concatenated verbatim text under a
 * scope node. Used as the `verbatimHash` stored in `ProvisionScopeAdopted`
 * events — the drift recon gate compares this against the current source text.
 */
export function computeScopeVerbatimHash(tree: ProvisionTree, scopeId: string): string {
  const leaves = getLeafDescendants(tree, scopeId);
  const combined = leaves
    .map((id) => tree.get(id)?.text ?? "")
    .join("\n\n---\n\n");
  return createHash("sha256").update(combined).digest("hex");
}
