// platform/model-registry/models-view.ts
//
// Read-side projection for the dashboard Models page (/api/models). For every
// bound calculation (CALC_BINDINGS), assembles: the owning agent, model id +
// version, registry governance status (registered? tier? validation status?),
// the live model-approval check, the declared input contract, and the most
// recent CalculationPerformed event (inputs → output, trust status). This is
// the single view that proves objective 3: each surfaced figure traces to an
// owned, approved model with a full calculation history.
//
// Authority: D-TRUSTED-FIGURES-PROGRAM-V1 (CEO session-delegation 2026-05-29).
// Author: Atlas (substrate), coordinating Rohan (builder) + Nadia (validator).

import type { CalculationPerformedPayload } from "../event-store/event-types/calculation";
import type { EventStore } from "../event-store/store";
import { CALC_BINDINGS, type CalcInputContract, checkModelApproved } from "./calculation-binding";
import { LocalModelRegistry } from "./index";
import type { ValidationStatus } from "./registry";

export interface LastCalculationView {
  readonly asOf: string;
  readonly output: number | null;
  readonly outputUnit: string;
  readonly status: CalculationPerformedPayload["status"];
  readonly missingInputs: readonly string[];
  readonly inputs: CalculationPerformedPayload["inputs"];
}

export interface CalcModelView {
  readonly calcKey: string;
  readonly figure: string;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly owningAgent: string;
  readonly outputUnit: string;
  /** True when a ModelSubmitted event exists for the bound modelId. */
  readonly registered: boolean;
  /** Registry validation status, or `unregistered` when no model exists. */
  readonly validationStatus: ValidationStatus | "unregistered";
  /** Tier when registered; null otherwise. */
  readonly tier: number | null;
  /** Result of checkModelApproved — the loud-failure gate. */
  readonly approved: boolean;
  /** Reason the model is not approved (absent when approved). */
  readonly approvalReason?: string;
  readonly citations: readonly string[];
  readonly inputContract: readonly CalcInputContract[];
  /** Most recent CalculationPerformed for this model, if any. */
  readonly lastCalculation?: LastCalculationView;
}

/** Latest CalculationPerformed payload per modelId (by replay order). */
function latestCalculationByModelId(
  store: EventStore,
): Map<string, { asOf: string; payload: CalculationPerformedPayload }> {
  const latest = new Map<string, { asOf: string; payload: CalculationPerformedPayload }>();
  for (const ev of store.replay({ type: "CalculationPerformed" })) {
    const payload = ev.payload as unknown as CalculationPerformedPayload;
    // Replay is in append order — later events overwrite earlier ones.
    latest.set(payload.modelId, { asOf: ev.as_of, payload });
  }
  return latest;
}

/** Build the full Models view across every bound calculation. */
export function buildCalcModelsView(store: EventStore): CalcModelView[] {
  const registry = new LocalModelRegistry({ eventStore: store });
  const models = new Map(registry.list().map((m) => [m.modelId, m]));
  const lastCalc = latestCalculationByModelId(store);

  return Object.values(CALC_BINDINGS).map((binding) => {
    const model = models.get(binding.modelId);
    const approval = checkModelApproved(store, binding.calcKey);
    const last = lastCalc.get(binding.modelId);

    return {
      calcKey: binding.calcKey,
      figure: binding.figure,
      modelId: binding.modelId,
      modelVersion: binding.modelVersion,
      owningAgent: binding.owningAgent,
      outputUnit: binding.outputUnit,
      registered: model !== undefined,
      validationStatus: model?.validationStatus ?? "unregistered",
      tier: model?.tier ?? null,
      approved: approval.ok,
      ...(approval.ok ? {} : { approvalReason: approval.reason }),
      citations: binding.citations,
      inputContract: binding.inputContract,
      ...(last
        ? {
            lastCalculation: {
              asOf: last.asOf,
              output: last.payload.output,
              outputUnit: last.payload.outputUnit,
              status: last.payload.status,
              missingInputs: last.payload.missingInputs,
              inputs: last.payload.inputs,
            },
          }
        : {}),
    };
  });
}
