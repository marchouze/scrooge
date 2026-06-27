// v2-core/regulatory-returns/cell-value/derivation-eval.ts
//
// Phase 0 of the per-cell value engine (D-BA-RETURN-CELL-VALUE-ENGINE): a
// DECIMAL-NATIVE evaluator for the SARB cell-contract `derivation.expression`
// grammar — the form's own arithmetic. A `sum`/`formula` cell's value is computed
// from OTHER cells' values exactly as the published workbook computes it, so the
// evaluator doubles as an internal cross-foot check.
//
// Grammar (transcribed verbatim from the SARB "Calculation Definition" column):
//
//   expr   := term (('+' | '-') term)*
//   term   := factor (('*' | '/') factor)*
//   factor := number | cellref | '(' expr ')' | '-' factor
//   cellref:= '[' FORM ',' Rxxxx ',' Cxxxx ']'      e.g. [BA100,R0020,C0010]
//
// FAIL-CLOSED (Engineering Charter cmd 2): if ANY referenced cell is unresolved
// (no sound value), the whole expression evaluates to `null` — never a partial /
// zero-filled number. All arithmetic is on the decimal engine (no float on a
// money figure — D-DECIMAL-NATIVE-MONEY-ARITHMETIC).
//
// This module is PURE: no event reads, no domain judgement. It knows nothing
// about which cell means what — only how to evaluate the form's own formula given
// a resolver for leaf values. The domain-truth attribution lives elsewhere.

import { type DecimalValue, addD, divD, mulD, subD, toDecimal } from "../../fil-core/decimal";

/**
 * Resolves a referenced cell to its decimal value, or `null` when that cell has
 * no sound value (which makes the whole expression fail closed). `selfForm` is
 * the form being evaluated, so bare in-form references resolve against it.
 */
export type CellRefResolver = (form: string, row: string, column: string) => DecimalValue | null;

/** A token in a derivation expression. */
type Token =
  | { kind: "num"; value: DecimalValue }
  | { kind: "ref"; form: string; row: string; column: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

/** Raised when an expression cannot be parsed (a malformed contract expression). */
export class DerivationParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DerivationParseError";
  }
}

const CELL_REF = /^\[\s*([A-Za-z0-9]+)\s*,\s*(R\d{4})\s*,\s*(C\d{4})\s*\]/;
const NUMBER = /^\d+(?:\.\d+)?/;

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const rest = expr.slice(i);
    const ch = expr[i];
    if (ch === undefined) break;
    if (ch === " " || ch === "\t" || ch === "\n") {
      i += 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", op: ch });
      i += 1;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i += 1;
      continue;
    }
    const refMatch = CELL_REF.exec(rest);
    if (refMatch !== null) {
      const form = refMatch[1];
      const row = refMatch[2];
      const column = refMatch[3];
      if (form === undefined || row === undefined || column === undefined) {
        throw new DerivationParseError(`malformed cell reference in: ${expr}`);
      }
      tokens.push({ kind: "ref", form, row, column });
      i += refMatch[0].length;
      continue;
    }
    const numMatch = NUMBER.exec(rest);
    if (numMatch !== null) {
      tokens.push({ kind: "num", value: toDecimal(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    throw new DerivationParseError(`unexpected character '${ch}' at position ${i} in: ${expr}`);
  }
  return tokens;
}

/** Sentinel: a sub-expression that referenced an unresolved cell (fail-closed). */
const UNRESOLVED = Symbol("unresolved");
type Evald = DecimalValue | typeof UNRESOLVED;

class Parser {
  private pos = 0;
  constructor(
    private readonly tokens: Token[],
    private readonly selfForm: string,
    private readonly resolve: CellRefResolver,
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  parse(): Evald {
    const v = this.expr();
    if (this.pos !== this.tokens.length) {
      throw new DerivationParseError("trailing tokens after a complete expression");
    }
    return v;
  }

  private expr(): Evald {
    let acc = this.term();
    for (;;) {
      const t = this.peek();
      if (t?.kind === "op" && (t.op === "+" || t.op === "-")) {
        this.next();
        const rhs = this.term();
        acc = combine(acc, rhs, t.op);
      } else {
        return acc;
      }
    }
  }

  private term(): Evald {
    let acc = this.factor();
    for (;;) {
      const t = this.peek();
      if (t?.kind === "op" && (t.op === "*" || t.op === "/")) {
        this.next();
        const rhs = this.factor();
        acc = combine(acc, rhs, t.op);
      } else {
        return acc;
      }
    }
  }

  private factor(): Evald {
    const t = this.next();
    if (t === undefined) throw new DerivationParseError("unexpected end of expression");
    if (t.kind === "op" && t.op === "-") {
      const f = this.factor();
      return f === UNRESOLVED ? UNRESOLVED : subD(toDecimal("0"), f);
    }
    if (t.kind === "num") return t.value;
    if (t.kind === "ref") {
      // `selfForm` is retained for callers that resolve bare in-form refs; the
      // contract always writes the form explicitly, so pass it straight through.
      void this.selfForm;
      const resolved = this.resolve(t.form, t.row, t.column);
      return resolved === null ? UNRESOLVED : resolved;
    }
    if (t.kind === "lparen") {
      const v = this.expr();
      const close = this.next();
      if (close?.kind !== "rparen") throw new DerivationParseError("expected ')'");
      return v;
    }
    throw new DerivationParseError(`unexpected token ${t.kind}`);
  }
}

function combine(a: Evald, b: Evald, op: "+" | "-" | "*" | "/"): Evald {
  if (a === UNRESOLVED || b === UNRESOLVED) return UNRESOLVED;
  switch (op) {
    case "+":
      return addD(a, b);
    case "-":
      return subD(a, b);
    case "*":
      return mulD(a, b);
    case "/":
      if (b.isZero()) return UNRESOLVED; // division by zero — fail closed, not Infinity/NaN
      return divD(a, b);
  }
}

/**
 * Evaluate a derivation expression to a decimal value, or `null` if any
 * referenced cell is unresolved (fail-closed) or the expression is empty. Throws
 * `DerivationParseError` only on a MALFORMED expression (a contract defect).
 */
export function evaluateDerivation(
  expression: string,
  selfForm: string,
  resolve: CellRefResolver,
): DecimalValue | null {
  const trimmed = expression.trim();
  if (trimmed === "") return null;
  // A `direct` cell whose "expression" is a prose source description (no cell
  // references and not pure arithmetic) is not an evaluable formula — leave it
  // to leaf resolution. Detect: contains no '[' reference and no digit-led math.
  if (!trimmed.includes("[") && !/^[-\d(]/.test(trimmed)) return null;
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) return null;
  const result = new Parser(tokens, selfForm, resolve).parse();
  return result === UNRESOLVED ? null : result;
}

/** Extract the cell references in an expression (for dependency ordering). */
export function referencedCells(
  expression: string,
): readonly { form: string; row: string; column: string }[] {
  const out: { form: string; row: string; column: string }[] = [];
  const global = /\[\s*([A-Za-z0-9]+)\s*,\s*(R\d{4})\s*,\s*(C\d{4})\s*\]/g;
  for (const m of expression.matchAll(global)) {
    const form = m[1];
    const row = m[2];
    const column = m[3];
    if (form !== undefined && row !== undefined && column !== undefined) {
      out.push({ form, row, column });
    }
  }
  return out;
}
