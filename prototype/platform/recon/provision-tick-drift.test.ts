// platform/recon/provision-tick-drift.test.ts
//
// Drift gate coverage: hash-stable adoption stays green; text change,
// removed scope, and removed instrument each surface a finding; unticks
// supersede stale hashes.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, it } from "bun:test";

import { makeProvisionScopeAdopted } from "../event-store/event-types/obligation-lifecycle";
import type { RegStructuredDocMinimal } from "../regulatory/graph/provision-tree";
import { buildProvisionTree, computeScopeVerbatimHash } from "../regulatory/graph/provision-tree";
import { findTickDrift } from "./provision-tick-drift";

const DOC: RegStructuredDocMinimal = {
  slug: "test-reg",
  title: "Test Regulation",
  chapters: [
    {
      id: "ch-1",
      sections: [
        { id: "s-1", number: "1", text: "Original text of section one." },
        { id: "s-2", number: "2", text: "Original text of section two." },
      ],
    },
  ],
};

function tick(scopeId: string, adopted: boolean, hash: string, at: string) {
  return makeProvisionScopeAdopted({
    asOf: at,
    entity: "LE-ZA-HOZ-BANK",
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE"],
    payload: {
      instrumentSlug: "test-reg",
      scopeId,
      adopted,
      adoptedBy: "marc@tgv.co.za",
      adoptedAt: at,
      verbatimHash: hash,
    },
  });
}

const loadDoc = (slug: string) => (slug === "test-reg" ? DOC : null);

describe("recon:provision-tick-drift", () => {
  it("green when the stored hash matches the recomputed hash", () => {
    const tree = buildProvisionTree(DOC);
    const hash = computeScopeVerbatimHash(tree, "s-1");
    const { findings, asserted } = findTickDrift(
      [tick("s-1", true, hash, "2026-06-11T10:00:00Z")],
      loadDoc,
    );
    expect(asserted).toBe(1);
    expect(findings).toHaveLength(0);
  });

  it("surfaces a finding when the text changed since the tick", () => {
    const { findings } = findTickDrift(
      [tick("s-1", true, "stale-hash-from-before-the-amendment", "2026-06-11T10:00:00Z")],
      loadDoc,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.scopeId).toBe("s-1");
    expect(findings[0]?.hashNow).not.toBeNull();
    expect(findings[0]?.message).toContain("changed since the bank ticked it");
  });

  it("an untick supersedes the stale hash of the tick it reverses", () => {
    const events = [
      tick("s-1", true, "stale-hash", "2026-06-11T10:00:00Z"),
      tick("s-1", false, "irrelevant", "2026-06-11T11:00:00Z"),
    ];
    const { findings, asserted } = findTickDrift(events, loadDoc);
    expect(asserted).toBe(0); // no currently-adopted scope
    expect(findings).toHaveLength(0);
  });

  it("surfaces a finding when the adopted scope no longer exists in the outline", () => {
    const { findings } = findTickDrift(
      [tick("s-99", true, "whatever", "2026-06-11T10:00:00Z")],
      loadDoc,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("no longer exists");
  });

  it("surfaces a finding when the instrument's structured.json is gone", () => {
    const ev = makeProvisionScopeAdopted({
      asOf: "2026-06-11T10:00:00Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE"],
      payload: {
        instrumentSlug: "vanished-reg",
        scopeId: "s-1",
        adopted: true,
        adoptedBy: "marc@tgv.co.za",
        adoptedAt: "2026-06-11T10:00:00Z",
        verbatimHash: "whatever",
      },
    });
    const { findings } = findTickDrift([ev], loadDoc);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("no structured.json exists");
  });

  it("only the latest event per scope is checked (re-tick re-anchors the hash)", () => {
    const tree = buildProvisionTree(DOC);
    const freshHash = computeScopeVerbatimHash(tree, "s-2");
    const events = [
      tick("s-2", true, "stale-hash-before-correction", "2026-06-10T10:00:00Z"),
      tick("s-2", true, freshHash, "2026-06-11T10:00:00Z"), // re-adopt after review
    ];
    const { findings, asserted } = findTickDrift(events, loadDoc);
    expect(asserted).toBe(1);
    expect(findings).toHaveLength(0);
  });

  it("empty store is green by construction", () => {
    const { findings, asserted } = findTickDrift([], loadDoc);
    expect(asserted).toBe(0);
    expect(findings).toHaveLength(0);
  });
});
