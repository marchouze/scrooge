// platform/recon/types.ts
//
// Uniform contract for continuous-controls pipelines. Every pipeline
// exposes `run(): ReconResult` — a pure-function assertion over real
// repository state (events, files, registers).
//
// Author: Vera

export type ReconSeverity = "info" | "warn" | "fail";

export interface ReconViolation {
  subject: string;
  message: string;
  severity: ReconSeverity;
}

export interface ReconResult {
  pipeline: string;
  ok: boolean;
  asserted: number;
  violations: ReconViolation[];
  asOf: string;
}

export function emptyResult(pipeline: string): ReconResult {
  return {
    pipeline,
    ok: true,
    asserted: 0,
    violations: [],
    asOf: new Date().toISOString(), // wall-clock: recon pipeline infrastructure timestamp
  };
}
