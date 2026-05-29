// platform/model-registry/calculation-emit.ts
//
// Builds CalculationPerformed events from a calc engine's resolved inputs and
// output, deriving status (ok / degraded / failed) from input completeness
// against the bound model's input contract. This is the bridge between a calc
// engine (which knows the numbers) and the calculation-history provenance axis
// (which records which model, which inputs, with what trust status).
//
// A required input that is missing forces status `failed` and output `null` —
// the figure is "value unavailable", never silently 0 (objective 4). A missing
// optional input forces `degraded`. Only when every required input is present
// is the figure `ok`.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (builder) + Nadia (validator).

import {
  type CalculationInput,
  type CalculationStatus,
  makeCalculationPerformed,
} from "../event-store/event-types/calculation";
import type { Actor, Event } from "../event-store/types";
import { type CalcBinding, getCalcBinding } from "./calculation-binding";

/** A resolved input value for a bound calculation (or its absence). */
export interface ResolvedInput {
  /** Input name — must match a name in the binding's input contract. */
  readonly name: string;
  /** Resolved numeric value; null when the input could not be resolved. */
  readonly value: number | null;
  /** Set true when the input is absent — the figure must reflect this, not 0-fill. */
  readonly missing: boolean;
}

function unitFor(binding: CalcBinding, name: string): string {
  return binding.inputContract.find((c) => c.name === name)?.unit ?? "unknown";
}

function lineageFor(binding: CalcBinding, name: string): string {
  return binding.inputContract.find((c) => c.name === name)?.expectedFrom ?? "unknown";
}

/**
 * Derive trust status from the resolved inputs against the binding's contract:
 *   - any *required* input missing → `failed`
 *   - else any *optional* input missing → `degraded`
 *   - else → `ok`
 */
function deriveStatus(
  binding: CalcBinding,
  resolved: readonly ResolvedInput[],
): {
  status: CalculationStatus;
  missingInputs: string[];
} {
  const missingInputs: string[] = [];
  let requiredMissing = false;
  let optionalMissing = false;

  for (const contract of binding.inputContract) {
    const r = resolved.find((x) => x.name === contract.name);
    const isMissing = r === undefined || r.missing;
    if (isMissing) {
      missingInputs.push(contract.name);
      if (contract.required) requiredMissing = true;
      else optionalMissing = true;
    }
  }

  const status: CalculationStatus = requiredMissing
    ? "failed"
    : optionalMissing
      ? "degraded"
      : "ok";
  return { status, missingInputs };
}

/**
 * Build a CalculationPerformed event for `calcKey` from resolved inputs + output.
 *
 * The output is forced to `null` when status is `failed` — a figure derived from
 * a missing required input is never surfaced as a number (objective 4).
 */
export function buildCalculationPerformed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  calcKey: string;
  resolvedInputs: readonly ResolvedInput[];
  output: number | null;
}): Event {
  const binding = getCalcBinding(args.calcKey);
  const { status, missingInputs } = deriveStatus(binding, args.resolvedInputs);

  const inputs: CalculationInput[] = binding.inputContract.map((contract) => {
    const r = args.resolvedInputs.find((x) => x.name === contract.name);
    const missing = r === undefined || r.missing;
    return {
      name: contract.name,
      value: missing ? null : (r?.value ?? null),
      unit: unitFor(binding, contract.name),
      lineage: lineageFor(binding, contract.name),
      missing,
    };
  });

  // Never surface an output when a required input is missing.
  const output = status === "failed" ? null : args.output;

  return makeCalculationPerformed({
    asOf: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: [...binding.citations],
    payload: {
      modelId: binding.modelId,
      modelVersion: binding.modelVersion,
      owningAgent: binding.owningAgent,
      figure: binding.figure,
      computedAsOf: args.asOf,
      inputs,
      output,
      outputUnit: binding.outputUnit,
      status,
      missingInputs,
    },
  });
}
