#!/usr/bin/env bun
// scripts/launchd/render-env-block.ts
//
// CLI shim invoked by `install.sh`. Reads `.env.local` from a path
// given on argv (or stdin if `--stdin`), extracts whitelisted `BANK_*`
// keys, and writes the rendered `<EnvironmentVariables>` dict-body XML
// to stdout.
//
// Why a separate shim: `install.sh` is the entry-point Marc runs
// directly; it needs a stable invocation that hides the worktree
// internals. We deliberately do **not** print key values to stderr —
// only counts and key names. The plist file (mode 0644) is the only
// place the rendered values live.
//
// Author: Devon (Chief Operating Officer, governance).

import { existsSync, readFileSync } from "node:fs";

import { renderFromDotEnv } from "./env-extract";

function usage(): never {
  // biome-ignore lint/suspicious/noConsole: CLI usage
  console.error(
    "usage: bun run scripts/launchd/render-env-block.ts <path-to-.env.local>\n" +
      "       (writes rendered <EnvironmentVariables> dict body to stdout)\n",
  );
  process.exit(2);
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length !== 1) usage();
  const envPath = args[0] ?? usage();

  let envLocalText: string | undefined;
  if (existsSync(envPath)) {
    envLocalText = readFileSync(envPath, "utf8");
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI warning
    console.error(
      `render-env-block: ${envPath} not found — rendering with PATH only.`,
    );
    envLocalText = undefined;
  }

  const { xml, bankKeyCount, bankKeyNames } = renderFromDotEnv({
    envLocalText,
  });

  // Surface counts + key NAMES only (never values) so install.sh can
  // print a useful diagnostic without leaking secrets.
  if (bankKeyCount === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI warning
    console.error(
      "render-env-block: no BANK_* keys found in .env.local — plist will install with PATH only.",
    );
  } else {
    // biome-ignore lint/suspicious/noConsole: CLI diagnostic (names only, no values)
    console.error(
      `render-env-block: ${bankKeyCount} BANK_* key(s) extracted: ${bankKeyNames.join(", ")}`,
    );
  }

  // stdout = the XML body.
  process.stdout.write(xml);
  process.stdout.write("\n");
}

main();
