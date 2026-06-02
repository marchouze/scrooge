// dashboard/risk-register.ts
//
// Risk-register view — gives the WS-RISK-REGISTER-CLOSURE substrate a face.
//
// Derives the risk register from the event store (Principle 1): every
// `RiskRaised` finding (latest event per `riskId`) paired with its closure
// state from the closure family (`RiskResolved` / `RiskAccepted` /
// `RiskMitigated` — `RISK_CLOSURE_EVENT_TYPES`). A finding is OPEN until a
// closure event carries its `riskId`.
//
// Consumed by:
//   - GET /api/risk-register   (server.ts)
//   - /risk-register.html
//
// Provenance: each finding carries its provenance (production / simulated /
// build-phase-fixture). The canonical register is the production set —
// synthetic findings are test / backtest-harness data and are flagged so the
// page can default to production-only (mirrors `hasOpenRiskFindings()` and the
// `recon:risk-register-closure` pipeline, which both audit production only).
//
// Author: Atlas (Core banking platform architect, engineering)

import { nowUtc } from "../platform/core/types";
import { RISK_CLOSURE_EVENT_TYPES } from "../platform/event-store/event-types/risk";
import type { EventStore } from "../platform/event-store/store";

export type RiskProvenanceKind = "production" | "simulated" | "build-phase-fixture";
export type RiskFindingStatus = "open" | "resolved" | "accepted" | "mitigated";

export interface RiskClosureDetail {
  /** Closure event type. */
  type: (typeof RISK_CLOSURE_EVENT_TYPES)[number];
  /** Who closed it (resolvedBy / acceptedBy / mitigatedBy). */
  by: string;
  /** Closure timestamp (ISO). */
  at: string;
  /** Free-text closure detail (resolution / rationale / mitigatingControl). */
  detail: string;
}

export interface RiskFinding {
  riskId: string;
  description: string;
  category: string;
  severity: string;
  raisedBy: string;
  raisedAt: string;
  provenance: RiskProvenanceKind;
  status: RiskFindingStatus;
  closure: RiskClosureDetail | null;
}

export interface RiskRegisterSummary {
  /** Distinct findings by provenance. */
  byProvenance: Record<RiskProvenanceKind, number>;
  /** Production findings by status. */
  production: Record<RiskFindingStatus, number>;
  /** Total distinct findings (all provenance). */
  total: number;
}

export interface RiskRegisterView {
  asOf: string;
  summary: RiskRegisterSummary;
  /** All distinct findings, production first, then by raisedAt desc. */
  findings: RiskFinding[];
}

function provenanceKind(e: { provenance?: unknown }): RiskProvenanceKind {
  const kind = (e.provenance as { kind?: string } | null | undefined)?.kind;
  return kind === "simulated" || kind === "build-phase-fixture" ? kind : "production";
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

const STATUS_BY_CLOSURE: Record<(typeof RISK_CLOSURE_EVENT_TYPES)[number], RiskFindingStatus> = {
  RiskResolved: "resolved",
  RiskAccepted: "accepted",
  RiskMitigated: "mitigated",
};

function closureDetailText(type: string, payload: Record<string, unknown>): string {
  if (type === "RiskResolved") {
    const rt = str(payload.resolutionType);
    return [rt && `[${rt}]`, str(payload.resolution)].filter(Boolean).join(" ");
  }
  if (type === "RiskAccepted") {
    const auth = str(payload.authority);
    return [auth && `[${auth}]`, str(payload.rationale)].filter(Boolean).join(" ");
  }
  if (type === "RiskMitigated") {
    const res = str(payload.residualSeverity);
    return [str(payload.mitigatingControl), res && `(residual: ${res})`].filter(Boolean).join(" ");
  }
  return "";
}

export function buildRiskRegisterView(
  store: EventStore,
  asOf: string = nowUtc(),
): RiskRegisterView {
  // Latest RiskRaised per riskId (replay is chronological; later wins).
  const raisedByRiskId = new Map<
    string,
    { payload: Record<string, unknown>; provenance: RiskProvenanceKind; raisedAt: string }
  >();
  for (const e of store.replay({ type: "RiskRaised" })) {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const riskId = str(payload.riskId);
    if (!riskId) continue;
    raisedByRiskId.set(riskId, {
      payload,
      provenance: provenanceKind(e),
      raisedAt: e.as_of,
    });
  }

  // Latest closure per riskId across the closure family.
  const closureByRiskId = new Map<string, RiskClosureDetail>();
  for (const closureType of RISK_CLOSURE_EVENT_TYPES) {
    for (const e of store.replay({ type: closureType })) {
      const payload = (e.payload ?? {}) as Record<string, unknown>;
      const riskId = str(payload.riskId);
      if (!riskId) continue;
      const prior = closureByRiskId.get(riskId);
      if (prior && prior.at >= e.as_of) continue;
      closureByRiskId.set(riskId, {
        type: closureType,
        by: str(payload.resolvedBy ?? payload.acceptedBy ?? payload.mitigatedBy, "—"),
        at: e.as_of,
        detail: closureDetailText(closureType, payload),
      });
    }
  }

  const findings: RiskFinding[] = [];
  for (const [riskId, raised] of raisedByRiskId) {
    const closure = closureByRiskId.get(riskId) ?? null;
    findings.push({
      riskId,
      description: str(raised.payload.description, riskId),
      category: str(raised.payload.category, "—"),
      severity: str(raised.payload.severity, "—"),
      raisedBy: str(raised.payload.raisedBy, "—"),
      raisedAt: raised.raisedAt,
      provenance: raised.provenance,
      status: closure ? STATUS_BY_CLOSURE[closure.type] : "open",
      closure,
    });
  }

  // Production first, then most-recently-raised first.
  const provRank: Record<RiskProvenanceKind, number> = {
    production: 0,
    simulated: 1,
    "build-phase-fixture": 2,
  };
  findings.sort((a, b) => {
    if (provRank[a.provenance] !== provRank[b.provenance]) {
      return provRank[a.provenance] - provRank[b.provenance];
    }
    return a.raisedAt < b.raisedAt ? 1 : a.raisedAt > b.raisedAt ? -1 : 0;
  });

  const summary: RiskRegisterSummary = {
    byProvenance: { production: 0, simulated: 0, "build-phase-fixture": 0 },
    production: { open: 0, resolved: 0, accepted: 0, mitigated: 0 },
    total: findings.length,
  };
  for (const f of findings) {
    summary.byProvenance[f.provenance]++;
    if (f.provenance === "production") summary.production[f.status]++;
  }

  return { asOf, summary, findings };
}
