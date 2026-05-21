// scripts/launchd/env-extract.ts
//
// Parse `.env.local` text, whitelist `BANK_*` keys, and render an XML
// fragment suitable for the `<EnvironmentVariables>` block of
// `com.scrooge.scheduler-tick.plist`.
//
// Why a TS module (not pure shell): we need disciplined parsing (comments,
// quoted values, escapes), strict whitelist enforcement, and XML escaping
// for the rendered plist — all three are easy to get wrong in `sed`/`awk`
// pipelines and are testable here.
//
// Security:
//   - Never log values. The caller (`install.sh`) discards stdout when
//     just-rendering and only writes the XML to the on-disk plist. The
//     plist is mode 0644 — Marc accepts that build-phase risk per the
//     existing comment in `com.scrooge.scheduler-tick.plist`.
//   - Only `BANK_*` keys are propagated. Any other key (e.g. credentials
//     belonging to other tooling, system env values) is dropped.
//
// Authority:
//   - D-AGENT-AUTONOMY-OPERATIONAL (Slice 1 — launchd scheduler).
//   - D-MARKETS-SCHEMA-FOUNDATION.
//
// Author: Devon (Chief Operating Officer, governance).

/**
 * Parse a `.env.local` file body into a key/value map.
 *
 * Format supported (pragmatic subset of dotenv):
 *   - `KEY=VALUE`
 *   - Trailing or leading whitespace ignored on the key, trimmed on the value
 *   - Lines starting with `#` are comments
 *   - Blank lines are ignored
 *   - Surrounding single or double quotes on the value are stripped
 *   - Escaped quotes (`\"`, `\'`) inside a quoted value are honoured
 *   - Inline comments (` #` after an unquoted value) are stripped
 *
 * The parser is intentionally tolerant — malformed lines are skipped
 * rather than throwing. `install.sh` already prints a warning if no
 * BANK_* keys are found.
 */
export function parseDotEnv(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = body.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue; // no key, or `=value` with empty key

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Reject keys that aren't a plausible env-var identifier.
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;

    // Quoted value: strip the matching quote pair, honour escapes.
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      const quote = value[0];
      value = value.slice(1, -1);
      if (quote === '"') {
        // Honour backslash escapes inside double-quoted values.
        value = value
          .replace(/\\"/g, '"')
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\");
      } else {
        // Single-quoted: literal. Only \\ is honoured to allow a literal \.
        value = value.replace(/\\'/g, "'");
      }
    } else {
      // Unquoted value: strip inline ` #...` comment.
      const hashIdx = value.indexOf(" #");
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trimEnd();
    }

    out[key] = value;
  }
  return out;
}

/**
 * Filter to whitelist: only keys matching the `BANK_*` prefix are kept.
 * Any other key — application secrets that don't belong in the launchd
 * env block, system overrides, etc. — is dropped silently.
 *
 * The prefix is enforced as a literal `BANK_` (uppercase) followed by
 * at least one further identifier character. Vacuous keys like `BANK_`
 * are dropped.
 */
export function whitelistBankKeys(parsed: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (!/^BANK_[A-Z0-9_]+$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Escape a string for safe embedding in a plist `<string>` element.
 *
 * The five XML predefined entities — `<`, `>`, `&`, `'`, `"` — must be
 * escaped. ASCII control characters below 0x20 (except `\t`, `\n`, `\r`)
 * are stripped — they have no defined behaviour in XML 1.0 and would
 * fail `plutil -lint`.
 */
export function escapeXml(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i] ?? "";
    const code = ch.charCodeAt(0);
    // Drop XML-illegal control chars (preserve tab, LF, CR).
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) continue;
    if (ch === "&") {
      out += "&amp;";
    } else if (ch === "<") {
      out += "&lt;";
    } else if (ch === ">") {
      out += "&gt;";
    } else if (ch === '"') {
      out += "&quot;";
    } else if (ch === "'") {
      out += "&apos;";
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Render the inner body of the plist `<EnvironmentVariables>` `<dict>`.
 *
 * Always includes a canonical `PATH` (the same value the static template
 * carried). `BANK_*` keys are appended in sorted order so the rendered
 * plist is deterministic — important for the install-script idempotency
 * check (`cmp -s`).
 *
 * Returned string is just the `<key>…</key><string>…</string>` pairs,
 * each indented with two spaces (the indent level used inside the dict
 * in the template). The caller wraps it in `<dict>…</dict>`.
 *
 * Output uses LF line endings; the template file uses LF (Unix), and
 * `plutil` accepts LF.
 */
export const DEFAULT_PATH_VALUE = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin";

export function renderEnvironmentDictBody(args: {
  bankKeys: Record<string, string>;
  /** Override the PATH value. Defaults to the build-phase canonical set. */
  pathValue?: string;
  /** Indent for each `<key>` / `<string>` line. Default "      " (6 spaces) — matches the surrounding template. */
  indent?: string;
}): string {
  const pathValue = args.pathValue ?? DEFAULT_PATH_VALUE;
  const indent = args.indent ?? "      ";
  const lines: string[] = [];
  lines.push(`${indent}<key>PATH</key>`);
  lines.push(`${indent}<string>${escapeXml(pathValue)}</string>`);

  const sortedKeys = Object.keys(args.bankKeys).sort();
  for (const k of sortedKeys) {
    const v = args.bankKeys[k] ?? "";
    lines.push(`${indent}<key>${escapeXml(k)}</key>`);
    lines.push(`${indent}<string>${escapeXml(v)}</string>`);
  }
  return lines.join("\n");
}

/**
 * End-to-end render: parse `.env.local` text, whitelist BANK_*, return
 * the `<EnvironmentVariables>` dict-body XML. Surfaced as a single entry
 * so the CLI can invoke it.
 *
 * Returns an object with both the rendered XML and the count of
 * BANK_* keys that survived the whitelist — `install.sh` uses the count
 * for its warn-on-empty branch.
 */
export function renderFromDotEnv(args: {
  envLocalText: string | undefined;
  pathValue?: string;
  indent?: string;
}): { xml: string; bankKeyCount: number; bankKeyNames: readonly string[] } {
  const parsed = args.envLocalText ? parseDotEnv(args.envLocalText) : {};
  const bankKeys = whitelistBankKeys(parsed);
  const xml = renderEnvironmentDictBody({
    bankKeys,
    pathValue: args.pathValue,
    indent: args.indent,
  });
  const bankKeyNames = Object.keys(bankKeys).sort();
  return { xml, bankKeyCount: bankKeyNames.length, bankKeyNames };
}
