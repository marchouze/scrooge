// scripts/dispatch/args.ts
//
// Shared CLI argument parsing for the three dispatch helpers
// (open-brief, start-run, close-run). Each helper validates its required
// flags and exits non-zero with a JSON error on bad input.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); Phase 2 Block A —
// events-first dispatch substrate.
// Authorship: D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas joint, 2026-05-16).
//
// Author: Atlas (Core banking platform architect, engineering)

export type ParsedArgs = Readonly<Record<string, string | string[]>>;

/**
 * Parse `--flag value` style argv. Repeatable flags (declared in
 * `repeatableFlags`) collect into a string[]. Single-value flags overwrite.
 * Boolean flags (declared in `booleanFlags`) are presence-only: `--flag` sets
 * `"true"` without consuming the next token, and never requires a value. Any
 * other bare flag without a value is rejected.
 */
export function parseArgs(
  argv: readonly string[],
  repeatableFlags: ReadonlySet<string>,
  booleanFlags: ReadonlySet<string> = new Set<string>(),
): ParsedArgs {
  const out: Record<string, string | string[]> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg || !arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (booleanFlags.has(key)) {
      out[key] = "true";
      continue;
    }
    const value = argv[i + 1] ?? "";
    if (!value || value.startsWith("--")) {
      die(`Flag --${key} requires a value`);
    }
    i++;
    if (repeatableFlags.has(key)) {
      const existing = out[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        out[key] = [value];
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function requireString(args: ParsedArgs, key: string): string {
  const v = args[key];
  if (typeof v !== "string" || v.trim() === "") {
    die(`Missing required flag --${key}`);
  }
  return v.trim();
}

export function optionalString(args: ParsedArgs, key: string): string | undefined {
  const v = args[key];
  if (typeof v !== "string" || v.trim() === "") return undefined;
  return v.trim();
}

/** True iff a boolean flag (declared in `parseArgs` `booleanFlags`) was present. */
export function optionalBoolean(args: ParsedArgs, key: string): boolean {
  return args[key] === "true";
}

export function requireRepeatable(args: ParsedArgs, key: string): string[] {
  const v = args[key];
  if (Array.isArray(v) && v.length > 0) return [...v];
  if (typeof v === "string" && v.trim() !== "") return [v.trim()];
  die(`Missing required repeatable flag --${key}`);
}

export function optionalRepeatable(args: ParsedArgs, key: string): string[] {
  const v = args[key];
  if (Array.isArray(v)) return [...v];
  if (typeof v === "string" && v.trim() !== "") return [v.trim()];
  return [];
}

/** Print a structured error envelope to stderr and exit 1. */
export function die(message: string): never {
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
}

/** Print a structured ok envelope to stdout. */
export function emitOk(payload: Record<string, unknown>): void {
  console.log(JSON.stringify({ ok: true, ...payload }));
}
