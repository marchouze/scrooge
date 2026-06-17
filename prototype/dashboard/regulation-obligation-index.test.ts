// dashboard/regulation-obligation-index.test.ts
//
// The reverse index is the bidirectional join at the heart of the unified
// Regulations module. These tests exercise it against an in-memory event store
// (Plane B) + an in-memory graph (Plane A), so no real graph.db/event.db is
// touched. They cover: the EXPRESSES path (section-anchored), the derivesFrom
// path (tick-flow), applicability enrichment, and — critically — the V2 UI
// masking rule (owner surfaced by seat TITLE, never the agent personal name).
//
// Author: Atlas (Core banking platform architect, engineering).

import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";

import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import { makeObligationAdopted } from "../platform/event-store/event-types/obligation-lifecycle";
import { EventStore } from "../platform/event-store/store";
import type { Actor } from "../platform/event-store/types";
import { SEAT_AGENT } from "../platform/regulatory/domain-ownership-map";
import { buildRegulationObligationIndex } from "./regulation-obligation-index";

const ACTOR: Actor = { type: "service", id: "agent:test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-REGULATORY-ARCHITECTURE-TWO-PLANE"];

function makeGraph(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE graph_nodes (id TEXT PRIMARY KEY, node_type TEXT NOT NULL,
      label TEXT NOT NULL, effective_from TEXT, effective_to TEXT, metadata TEXT);
    CREATE TABLE graph_edges (id TEXT PRIMARY KEY, from_id TEXT NOT NULL,
      to_id TEXT NOT NULL, edge_type TEXT NOT NULL, effective_from TEXT,
      effective_to TEXT, source_provision TEXT, extraction_method TEXT,
      confidence_score REAL, extracted_at TEXT, metadata TEXT,
      UNIQUE(from_id, to_id, edge_type));
  `);
  return db;
}
function addExpresses(db: Database, provId: string, oblId: string): void {
  db.prepare(
    "INSERT INTO graph_edges (id, from_id, to_id, edge_type) VALUES (?,?,?,'EXPRESSES')",
  ).run(`E-${provId}-${oblId}`, provId, `OBL-${oblId}`);
}

function adopt(
  store: EventStore,
  id: string,
  over: { citation?: string; requirement?: string; derivesFrom?: string[]; owner?: string } = {},
): void {
  store.append(
    makeObligationAdopted({
      asOf: "2026-06-17",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        obligationId: id,
        urn: `urn:obligation:bank:test:${id.toLowerCase()}:v1`,
        domain: "C",
        citation: over.citation ?? "FIC Act s.29",
        requirement: over.requirement ?? "File suspicious transaction reports.",
        fulfilmentPolicy: "AML/CFT Policy",
        owner: over.owner ?? "CCO",
        status: "active",
        ...(over.derivesFrom ? { derivesFrom: over.derivesFrom } : {}),
        adoptedAt: "2026-06-17",
      },
    }),
  );
}

function concludeApplicability(
  store: EventStore,
  subjectRef: string,
  verdict: "applies" | "partially-applies" | "does-not-apply",
  asOf: string,
): void {
  const assessmentId = `assessment:obligation:${subjectRef.toLowerCase()}:${asOf}`;
  const at = `${asOf}T00:00:00.000Z`;
  store.append(
    makeApplicabilityAssessmentRequested({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        assessmentId,
        subjectRef,
        subjectKind: "obligation",
        appliesToScope: { kind: "jurisdiction", jurisdiction: "ZA" },
        requestedBy: "agent:test",
        citations: CITES,
      },
    }),
  );
  store.append(
    makeApplicabilityAssessmentPerformed({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        assessmentId,
        contextsEvaluated: [{ contextRef: "ctx:le-za-hoz-bank", context: { jurisdiction: "ZA" } }],
        matches: verdict === "does-not-apply" ? [] : ["ctx:le-za-hoz-bank"],
        performedBy: "agent:test",
        performedAt: at,
      },
    }),
  );
  store.append(
    makeApplicabilityAssessmentConcluded({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        assessmentId,
        verdict,
        appliesToContexts: verdict === "does-not-apply" ? [] : ["ctx:le-za-hoz-bank"],
        rationale: `Verdict ${verdict} for ${subjectRef}.`,
        concludedBy: "agent:test",
        concludedAt: at,
        citations: CITES,
      },
    }),
  );
}

describe("buildRegulationObligationIndex", () => {
  it("maps a section-anchored obligation back to its provision via EXPRESSES", () => {
    const store = new EventStore();
    const db = makeGraph();
    adopt(store, "ORG-FC-02");
    addExpresses(db, "PROV-FICA-s29", "ORG-FC-02");

    const index = buildRegulationObligationIndex(store, db);

    const refs = index.byProvision.get("PROV-FICA-s29") ?? [];
    expect(refs.map((r) => r.id)).toContain("ORG-FC-02");
    expect(index.provisionsForObligation.get("ORG-FC-02")).toContain("PROV-FICA-s29");
    expect(index.byObligationId.get("ORG-FC-02")?.status).toBe("active");
  });

  it("maps a tick-flow obligation back via derivesFrom (no EXPRESSES edge)", () => {
    const store = new EventStore();
    const db = makeGraph();
    adopt(store, "ORG-FC-09", { derivesFrom: ["banks-act-60"] });

    const index = buildRegulationObligationIndex(store, db);

    expect((index.byProvision.get("banks-act-60") ?? []).map((r) => r.id)).toContain("ORG-FC-09");
  });

  it("enriches the ref with the latest applicability verdict", () => {
    const store = new EventStore();
    const db = makeGraph();
    adopt(store, "ORG-FC-02");
    addExpresses(db, "PROV-FICA-s29", "ORG-FC-02");
    // Two assessments; the later one must win.
    concludeApplicability(store, "ORG-FC-02", "does-not-apply", "2026-06-10");
    concludeApplicability(store, "ORG-FC-02", "applies", "2026-06-15");

    const index = buildRegulationObligationIndex(store, db);

    expect(index.byObligationId.get("ORG-FC-02")?.applicability?.verdict).toBe("applies");
  });

  it("surfaces the owner by seat TITLE, never the agent personal name (masking)", () => {
    const store = new EventStore();
    const db = makeGraph();
    // ORG-FC-* classifies to financial-crime → the CCO seat.
    adopt(store, "ORG-FC-02");
    addExpresses(db, "PROV-FICA-s29", "ORG-FC-02");

    const index = buildRegulationObligationIndex(store, db);
    const title = index.byObligationId.get("ORG-FC-02")?.ownerSeatTitle;

    expect(title).toBe(SEAT_AGENT.cco.position);
    // The personal name must never leak into the UI-facing field.
    const everyName = Object.values(SEAT_AGENT).map((a) => a.name);
    expect(everyName).not.toContain(title);
  });

  it("excludes un-adopted obligations and dedups across provisions", () => {
    const store = new EventStore();
    const db = makeGraph();
    adopt(store, "ORG-FC-02", { derivesFrom: ["PROV-FICA-s29"] });
    // Same obligation also linked via EXPRESSES to the same provision id.
    addExpresses(db, "PROV-FICA-s29", "ORG-FC-02");

    const index = buildRegulationObligationIndex(store, db);

    const refs = index.byProvision.get("PROV-FICA-s29") ?? [];
    expect(refs.filter((r) => r.id === "ORG-FC-02")).toHaveLength(1);
  });
});
