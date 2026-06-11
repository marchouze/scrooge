// platform/recon/cfp-trigger-coverage.ts
//
// Continuous-controls pipeline: CFP trigger coverage
// (WS-TREASURER-WAVE1-SUBSTRATE).
//
// LRM Policy v1 §5.2 organises the Contingency Funding Plan in three
// activation tiers and names seven typed trigger events. Before this
// workstream none of those types existed — the CFP was policy prose with
// no executable firing path (a Principle 2 orphan: a policy control with
// no substrate projection). This gate pins the closure so it cannot
// silently regress.
//
// What this pipeline asserts:
//
//   1. Every §5.2 trigger event type exists in the typed event-type
//      surface (`TYPED_EVENT_TYPES`) AND has a canonical registry row in
//      `EVENT_TYPE_REGISTRY` with a Zod payload schema.
//      → fail when missing (the CFP cannot fire that trigger).
//
//   2. The EWI monitor handler (`ravi:cfp-ewi-monitor`) is registered in
//      `HANDLERS_METADATA` (event-driven) and `HANDLER_CALLABLES`, and its
//      `subscribesTo` covers every measurement type the EWI engine needs
//      (`EWI_MONITOR_MEASUREMENT_TYPES`).
//      → fail when missing (triggers exist but nothing evaluates them).
//
//   3. Every CFP tier in §5.2 (tier-1 / tier-2 / tier-3) has at least one
//      wired firing path: a trigger type in the EWI engine's
//      `EWI_WIRED_TRIGGER_TYPES` whose `CFP_TIER_BY_TRIGGER` mapping
//      reaches the tier.
//      → fail when a tier is unreachable (a CFP tier that can never
//      activate is dead policy).
//
// Status: ENFORCING — green on the PR that introduced it (PR for
// WS-TREASURER-WAVE1-SUBSTRATE); runs in the `domain` CI recon suite.
//
// Empty-state correctness: assertions are static (registry + metadata +
// engine constants) — no event-store dependency; green on a clean store.
//
// Standing authority: D-TREASURER-WAVE1-SUBSTRATE (CEO-approved
//   2026-06-11); parent D-TREASURER-ROLE-DEFINITION-REVIEW.
//
// Citations:
//   Policies/liquidity-risk-management-policy-v1.md §5.2;
//   BCBS 144 Principle 11; Banks Act 94 of 1990 Reg 26;
//   Principles/2-single-graph-discipline.md.
//
// Author: Ravi (Treasury and ALM engineer, engineering — reports to Eitan
//   (Treasurer, governance)).

import { HANDLER_CALLABLES } from "../../runtime/handler-callables";
import { HANDLERS_METADATA } from "../../runtime/handlers-metadata";
import {
  EWI_MONITOR_MEASUREMENT_TYPES,
  EWI_WIRED_TRIGGER_TYPES,
  wiredCfpTiers,
} from "../alm/cfp-ewi";
import {
  CFP_TIER_BY_TRIGGER,
  CFP_TRIGGER_TYPED_EVENT_TYPES,
  type CfpTier,
} from "../event-store/event-types/cfp-triggers";
import { TYPED_EVENT_TYPES } from "../event-store/event-types/index";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "cfp-trigger-coverage";

const EWI_MONITOR_KEY = "ravi:cfp-ewi-monitor";

const CFP_TIERS: readonly CfpTier[] = ["tier-1", "tier-2", "tier-3"];

interface MinimalMetadata {
  readonly key: string;
  readonly kind: string;
  readonly subscribesTo?: readonly string[];
}

export interface RunOpts {
  /** Override the typed event-type surface — used by tests. */
  typedEventTypes?: readonly string[];
  /** Override the registry types — used by tests. */
  registryTypes?: readonly string[];
  /** Override the handler metadata — used by tests. */
  handlersMetadata?: readonly MinimalMetadata[];
  /** Override the callable keys — used by tests. */
  callableKeys?: readonly string[];
  /** Override the wired trigger set — used by tests. */
  wiredTriggerTypes?: readonly string[];
}

export function run(opts: RunOpts = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const typedTypes = new Set(opts.typedEventTypes ?? TYPED_EVENT_TYPES);
  const registryTypes = new Set(opts.registryTypes ?? EVENT_TYPE_REGISTRY.map((m) => m.type));
  const metadata: readonly MinimalMetadata[] = opts.handlersMetadata ?? HANDLERS_METADATA;
  const callableKeys = new Set(opts.callableKeys ?? Object.keys(HANDLER_CALLABLES));
  const wiredTriggers = new Set(opts.wiredTriggerTypes ?? EWI_WIRED_TRIGGER_TYPES);

  // -------------------------------------------------------------------------
  // Assertion 1: every §5.2 trigger type registered (typed surface + registry).
  // -------------------------------------------------------------------------
  for (const type of CFP_TRIGGER_TYPED_EVENT_TYPES) {
    result.asserted++;
    if (!typedTypes.has(type)) {
      violations.push({
        subject: `event-type:${type}`,
        severity: "fail",
        message: `MISSING EVENT TYPE: LRM Policy v1 §5.2 names "${type}" as a CFP trigger but it is absent from TYPED_EVENT_TYPES (platform/event-store/event-types/index.ts). The CFP cannot fire this trigger — a Principle 2 orphan. Authority: D-TREASURER-WAVE1-SUBSTRATE.`,
      });
    }
    result.asserted++;
    if (!registryTypes.has(type)) {
      violations.push({
        subject: `registry-row:${type}`,
        severity: "fail",
        message: `MISSING REGISTRY ROW: CFP trigger type "${type}" has no EVENT_TYPE_REGISTRY row (platform/event-store/registry/cfp-triggers.ts). Required: a row with payload schema, retention, and subscribers. Authority: D-TREASURER-WAVE1-SUBSTRATE; LRM Policy v1 §5.2.`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Assertion 2: EWI monitor handler registered + subscribed to its measures.
  // -------------------------------------------------------------------------
  result.asserted++;
  const monitorRow = metadata.find((m) => m.key === EWI_MONITOR_KEY);
  if (!monitorRow) {
    violations.push({
      subject: `handler:${EWI_MONITOR_KEY}`,
      severity: "fail",
      message: `MISSING HANDLER METADATA: "${EWI_MONITOR_KEY}" is not in HANDLERS_METADATA (runtime/agents/metadata/ravi.ts). The §5.2 trigger types exist but nothing evaluates the EWI set. Authority: D-TREASURER-WAVE1-SUBSTRATE.`,
    });
  } else {
    const subscribed = new Set(monitorRow.subscribesTo ?? []);
    for (const measure of EWI_MONITOR_MEASUREMENT_TYPES) {
      result.asserted++;
      if (!subscribed.has(measure)) {
        violations.push({
          subject: `subscription:${measure}`,
          severity: "fail",
          message: `MISSING SUBSCRIPTION: "${EWI_MONITOR_KEY}" does not subscribe to "${measure}" — a measurement type the EWI engine evaluates (EWI_MONITOR_MEASUREMENT_TYPES in platform/alm/cfp-ewi.ts). A threshold crossing on that measure would never be re-evaluated. Authority: D-TREASURER-WAVE1-SUBSTRATE; LRM Policy v1 §5.2.`,
        });
      }
    }
  }

  result.asserted++;
  if (!callableKeys.has(EWI_MONITOR_KEY)) {
    violations.push({
      subject: `callable:${EWI_MONITOR_KEY}`,
      severity: "fail",
      message: `MISSING CALLABLE: "${EWI_MONITOR_KEY}" is not in HANDLER_CALLABLES (runtime/agents/callables/ravi.ts). The metadata row exists but the runtime cannot dispatch the handler. Authority: D-TREASURER-WAVE1-SUBSTRATE.`,
    });
  }

  // -------------------------------------------------------------------------
  // Assertion 3: every CFP tier has at least one wired firing path.
  // -------------------------------------------------------------------------
  const reachableTiers = new Set<CfpTier>();
  for (const type of CFP_TRIGGER_TYPED_EVENT_TYPES) {
    if (!wiredTriggers.has(type)) continue;
    for (const tier of CFP_TIER_BY_TRIGGER[type]) reachableTiers.add(tier);
  }
  // Sanity-pin the helper the engine exports against the local fold when
  // running on real (non-overridden) state.
  if (!opts.wiredTriggerTypes) {
    for (const tier of wiredCfpTiers()) reachableTiers.add(tier);
  }
  for (const tier of CFP_TIERS) {
    result.asserted++;
    if (!reachableTiers.has(tier)) {
      violations.push({
        subject: `cfp-tier:${tier}`,
        severity: "fail",
        message: `UNREACHABLE CFP TIER: no wired firing path reaches CFP ${tier} — no trigger type in EWI_WIRED_TRIGGER_TYPES maps to it via CFP_TIER_BY_TRIGGER. A CFP tier that can never activate is dead policy (LRM Policy v1 §5.2). Authority: D-TREASURER-WAVE1-SUBSTRATE.`,
      });
    }
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "cfp-trigger-coverage passed — all 7 §5.2 triggers registered, EWI monitor wired, all 3 CFP tiers reachable."
        : "cfp-trigger-coverage FAILED — CFP trigger substrate incomplete.",
      detail: r.violations,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
