// platform/accounting/sla/expression.ts
//
// Sandboxed amount-expression language (Phase-0 spec §4).
//
// This is the security boundary of the rules-as-data engine (Principle 4).
// A posting rule's `amount` and `when`/`condition` expressions are written
// in a restricted grammar evaluated by a HAND-WRITTEN tree-walker over a
// parsed AST. It never calls `eval`, never touches the filesystem, network,
// clock, or `Math.random`; it has no loops and no user-defined functions.
// A malicious or buggy rule can at worst produce a wrong (but balanced, or
// loudly-rejected) number — it can never execute code.
//
// Grammar (EBNF, spec §4.1):
//
//   expr      := term (("+" | "-") term)*
//   term      := factor (("*" | "/") factor)*
//   factor    := number | path | func "(" args ")" | "(" expr ")" | "-" factor
//   path      := "event" ("." ident | "[" string "]")+
//              | "context" "." ident
//   args      := expr ("," expr)*
//   func      := "abs" | "min" | "max" | "neg" | "if"
//   predicate := expr cmp expr | predicate ("&&" | "||") predicate | "!" predicate
//   cmp       := "==" | "!=" | ">" | ">=" | "<" | "<="
//
// Evaluation semantics (spec §4.2):
//   - Money is integer minor units. All arithmetic is BigInt so deep-EM
//     notionals beyond 2^53 are exact. Division is integer division with
//     banker's HALF-EVEN rounding (engine default, Marc working default
//     2026-06-05).
//   - Pure & total: every expression terminates; `if(cond,a,b)` is the only
//     conditional; comparisons return booleans, arithmetic returns BigInt.
//   - Unknown paths reject LOUDLY (`UnknownPathError`) — never silently 0.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).
// Authority: D-SLA-ENGINE-RULES-AS-DATA (CEO-approved 2026-06-05).
// Citations: Principles/4-security-designed-in.md.

// ---------------------------------------------------------------------------
// Errors — all loud, all typed.
// ---------------------------------------------------------------------------

/** Raised for any malformed expression at parse time. */
export class ExpressionParseError extends Error {
  constructor(message: string) {
    super(`sla-expression parse error: ${message}`);
    this.name = "ExpressionParseError";
  }
}

/** Raised when an expression references an absent event/context path. */
export class UnknownPathError extends Error {
  constructor(public readonly path: string) {
    super(`sla-expression: unknown path '${path}' (reject-loudly; never defaulted to 0)`);
    this.name = "UnknownPathError";
  }
}

/** Raised for runtime evaluation faults (division by zero, type mismatch). */
export class ExpressionEvalError extends Error {
  constructor(message: string) {
    super(`sla-expression eval error: ${message}`);
    this.name = "ExpressionEvalError";
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type TokenType =
  | "number"
  | "ident"
  | "string"
  | "op"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "comma"
  | "dot"
  | "eof";

interface Token {
  readonly type: TokenType;
  readonly value: string;
  readonly pos: number;
}

const OPERATORS = ["==", "!=", ">=", "<=", "&&", "||", ">", "<", "+", "-", "*", "/", "!"];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i] as string;

    // whitespace
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    // number (integer or decimal; decimals only legal as scalar literals,
    // e.g. rate multipliers — money arithmetic stays integer)
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < n && (src[j] as string) >= "0" && (src[j] as string) <= "9") j++;
      if (j < n && src[j] === ".") {
        j++;
        while (j < n && (src[j] as string) >= "0" && (src[j] as string) <= "9") j++;
      }
      tokens.push({ type: "number", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // identifier / keyword
    if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i;
      while (
        j < n &&
        (((src[j] as string) >= "a" && (src[j] as string) <= "z") ||
          ((src[j] as string) >= "A" && (src[j] as string) <= "Z") ||
          ((src[j] as string) >= "0" && (src[j] as string) <= "9") ||
          src[j] === "_")
      ) {
        j++;
      }
      tokens.push({ type: "ident", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // string literal (single or double quotes) — used for bracket paths
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let value = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\") {
          throw new ExpressionParseError(`escape sequences are not permitted (pos ${j})`);
        }
        value += src[j];
        j++;
      }
      if (j >= n) throw new ExpressionParseError(`unterminated string literal (pos ${i})`);
      tokens.push({ type: "string", value, pos: i });
      i = j + 1;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "lparen", value: c, pos: i });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: c, pos: i });
      i++;
      continue;
    }
    if (c === "[") {
      tokens.push({ type: "lbracket", value: c, pos: i });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ type: "rbracket", value: c, pos: i });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ type: "comma", value: c, pos: i });
      i++;
      continue;
    }
    if (c === ".") {
      tokens.push({ type: "dot", value: c, pos: i });
      i++;
      continue;
    }

    // multi-char then single-char operators
    const two = src.slice(i, i + 2);
    const op = OPERATORS.find((o) => (o.length === 2 ? two === o : c === o));
    if (op) {
      tokens.push({ type: "op", value: op, pos: i });
      i += op.length;
      continue;
    }

    throw new ExpressionParseError(`unexpected character '${c}' (pos ${i})`);
  }

  tokens.push({ type: "eof", value: "", pos: n });
  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

const FUNCTIONS = new Set(["abs", "min", "max", "neg", "if", "exists"]);

export type Ast =
  | { kind: "num"; value: string }
  | { kind: "str"; value: string }
  | { kind: "path"; segments: string[]; raw: string }
  | { kind: "unary"; op: "-" | "!"; operand: Ast }
  | { kind: "binary"; op: string; left: Ast; right: Ast }
  | { kind: "call"; fn: string; args: Ast[] };

// ---------------------------------------------------------------------------
// Parser — recursive descent. Precedence (low→high):
//   ||  →  &&  →  comparison  →  +/-  →  * /  →  unary  →  primary
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos] as Token;
  }
  private next(): Token {
    return this.tokens[this.pos++] as Token;
  }
  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) {
      throw new ExpressionParseError(`expected ${type} but got '${t.value}' (pos ${t.pos})`);
    }
    return t;
  }

  parse(): Ast {
    const expr = this.parseOr();
    if (this.peek().type !== "eof") {
      throw new ExpressionParseError(`unexpected trailing token '${this.peek().value}'`);
    }
    return expr;
  }

  private parseOr(): Ast {
    let left = this.parseAnd();
    while (this.peek().type === "op" && this.peek().value === "||") {
      this.next();
      const right = this.parseAnd();
      left = { kind: "binary", op: "||", left, right };
    }
    return left;
  }

  private parseAnd(): Ast {
    let left = this.parseComparison();
    while (this.peek().type === "op" && this.peek().value === "&&") {
      this.next();
      const right = this.parseComparison();
      left = { kind: "binary", op: "&&", left, right };
    }
    return left;
  }

  private parseComparison(): Ast {
    let left = this.parseAddSub();
    const cmps = new Set(["==", "!=", ">", ">=", "<", "<="]);
    while (this.peek().type === "op" && cmps.has(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseAddSub();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseAddSub(): Ast {
    let left = this.parseMulDiv();
    while (this.peek().type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const right = this.parseMulDiv();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMulDiv(): Ast {
    let left = this.parseUnary();
    while (this.peek().type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Ast {
    if (this.peek().type === "op" && (this.peek().value === "-" || this.peek().value === "!")) {
      const op = this.next().value as "-" | "!";
      const operand = this.parseUnary();
      return { kind: "unary", op, operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Ast {
    const t = this.peek();

    if (t.type === "lparen") {
      this.next();
      const expr = this.parseOr();
      this.expect("rparen");
      return expr;
    }

    if (t.type === "number") {
      this.next();
      return { kind: "num", value: t.value };
    }

    if (t.type === "string") {
      this.next();
      return { kind: "str", value: t.value };
    }

    if (t.type === "ident") {
      // function call, path root (event/context), or bare keyword
      if (FUNCTIONS.has(t.value) && this.tokens[this.pos + 1]?.type === "lparen") {
        return this.parseCall();
      }
      if (t.value === "event" || t.value === "context") {
        return this.parsePath();
      }
      throw new ExpressionParseError(
        `unknown identifier '${t.value}' — only event/context paths and ${[...FUNCTIONS].join("/")} functions are allowed (pos ${t.pos})`,
      );
    }

    throw new ExpressionParseError(`unexpected token '${t.value}' (pos ${t.pos})`);
  }

  private parseCall(): Ast {
    const fn = this.next().value;
    this.expect("lparen");
    const args: Ast[] = [];
    if (this.peek().type !== "rparen") {
      args.push(this.parseOr());
      while (this.peek().type === "comma") {
        this.next();
        args.push(this.parseOr());
      }
    }
    this.expect("rparen");
    return { kind: "call", fn, args };
  }

  private parsePath(): Ast {
    const root = this.next().value; // "event" | "context"
    const segments: string[] = [root];
    let raw = root;

    // at least one accessor required
    while (this.peek().type === "dot" || this.peek().type === "lbracket") {
      if (this.peek().type === "dot") {
        this.next();
        const id = this.expect("ident");
        segments.push(id.value);
        raw += `.${id.value}`;
      } else {
        this.next();
        const key = this.expect("string");
        this.expect("rbracket");
        segments.push(key.value);
        raw += `[${JSON.stringify(key.value)}]`;
      }
    }

    if (segments.length < 2) {
      throw new ExpressionParseError(`path '${root}' must access at least one field`);
    }
    return { kind: "path", segments, raw };
  }
}

/** Parse an expression string into an AST. Throws ExpressionParseError. */
export function parseExpression(src: string): Ast {
  return new Parser(tokenize(src)).parse();
}

// ---------------------------------------------------------------------------
// Evaluation context + values
// ---------------------------------------------------------------------------

/** The read-only roots an expression may access. */
export interface EvalScope {
  readonly event: unknown;
  readonly context: unknown;
}

type EvalValue = bigint | boolean | string;

/** Half-even (banker's) integer division of two BigInts. */
export function bigIntDivHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new ExpressionEvalError("division by zero");
  }
  // Work in positive magnitudes, track sign separately so rounding is
  // symmetric around zero.
  const negative = numerator < 0n !== denominator < 0n;
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  const q = absNum / absDen;
  const r = absNum % absDen;
  if (r === 0n) return negative ? -q : q;

  // Compare 2*r to denominator to decide rounding.
  const twice = r * 2n;
  let rounded: bigint;
  if (twice < absDen) {
    rounded = q; // round down
  } else if (twice > absDen) {
    rounded = q + 1n; // round up
  } else {
    // exactly halfway → round to even
    rounded = q % 2n === 0n ? q : q + 1n;
  }
  return negative ? -rounded : rounded;
}

function readPath(scope: EvalScope, ast: Extract<Ast, { kind: "path" }>): unknown {
  const [root, ...rest] = ast.segments;
  let current: unknown = root === "event" ? scope.event : scope.context;
  for (const seg of rest) {
    if (current === null || current === undefined || typeof current !== "object") {
      throw new UnknownPathError(ast.raw);
    }
    if (!(seg in (current as Record<string, unknown>))) {
      throw new UnknownPathError(ast.raw);
    }
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

/** Does a path resolve without error? Used by the `exists(...)` builtin. */
function pathExists(scope: EvalScope, ast: Extract<Ast, { kind: "path" }>): boolean {
  try {
    const v = readPath(scope, ast);
    return v !== undefined && v !== null;
  } catch {
    return false;
  }
}

function toBigInt(v: EvalValue, where: string): bigint {
  if (typeof v === "bigint") return v;
  throw new ExpressionEvalError(`expected a number at ${where}, got ${typeof v}`);
}

function coerceScalar(value: unknown, raw: string): EvalValue {
  if (typeof value === "bigint") return value;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    // numeric strings (minor-unit amounts stored as strings, e.g.
    // MissedExpectedReceipt.expectedAmountMinor) coerce to BigInt; other
    // strings stay strings for comparison/currency use.
    if (/^-?\d+$/.test(value)) return BigInt(value);
    return value;
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) return BigInt(value);
    // Non-integer scalar (e.g. a rate). Represent exactly enough for
    // comparisons; arithmetic with non-integers is rejected to keep money
    // integer-exact (cross-currency translation is a context-supplied
    // pre-multiplied input per spec §4.2, not done in-expression).
    throw new ExpressionEvalError(
      `path '${raw}' resolved to a non-integer number (${value}); money arithmetic is integer-only — supply pre-translated minor-unit amounts`,
    );
  }
  throw new ExpressionEvalError(`path '${raw}' resolved to an unsupported type (${typeof value})`);
}

function evalAst(ast: Ast, scope: EvalScope): EvalValue {
  switch (ast.kind) {
    case "num": {
      if (ast.value.includes(".")) {
        throw new ExpressionEvalError(
          `non-integer literal '${ast.value}' is not permitted in money arithmetic`,
        );
      }
      return BigInt(ast.value);
    }
    case "str":
      return ast.value;
    case "path":
      return coerceScalar(readPath(scope, ast), ast.raw);
    case "unary": {
      if (ast.op === "!") {
        const v = evalAst(ast.operand, scope);
        if (typeof v !== "boolean") {
          throw new ExpressionEvalError("'!' requires a boolean operand");
        }
        return !v;
      }
      // unary minus
      return -toBigInt(evalAst(ast.operand, scope), "unary '-'");
    }
    case "binary":
      return evalBinary(ast, scope);
    case "call":
      return evalCall(ast, scope);
  }
}

function evalBinary(ast: Extract<Ast, { kind: "binary" }>, scope: EvalScope): EvalValue {
  const { op } = ast;

  // logical (short-circuit)
  if (op === "&&" || op === "||") {
    const l = evalAst(ast.left, scope);
    if (typeof l !== "boolean") throw new ExpressionEvalError(`'${op}' requires boolean operands`);
    if (op === "&&" && !l) return false;
    if (op === "||" && l) return true;
    const r = evalAst(ast.right, scope);
    if (typeof r !== "boolean") throw new ExpressionEvalError(`'${op}' requires boolean operands`);
    return r;
  }

  const l = evalAst(ast.left, scope);
  const r = evalAst(ast.right, scope);

  // comparisons — allow bigint/bigint and string/string
  if (op === "==" || op === "!=") {
    const eq = compareEquality(l, r);
    return op === "==" ? eq : !eq;
  }
  if (op === ">" || op === ">=" || op === "<" || op === "<=") {
    const a = toBigInt(l, "comparison lhs");
    const b = toBigInt(r, "comparison rhs");
    switch (op) {
      case ">":
        return a > b;
      case ">=":
        return a >= b;
      case "<":
        return a < b;
      case "<=":
        return a <= b;
    }
  }

  // arithmetic — integer BigInt only
  const a = toBigInt(l, `'${op}' lhs`);
  const b = toBigInt(r, `'${op}' rhs`);
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      return bigIntDivHalfEven(a, b);
    default:
      throw new ExpressionEvalError(`unknown operator '${op}'`);
  }
}

function compareEquality(l: EvalValue, r: EvalValue): boolean {
  if (typeof l === "bigint" && typeof r === "bigint") return l === r;
  if (typeof l === "string" && typeof r === "string") return l === r;
  if (typeof l === "boolean" && typeof r === "boolean") return l === r;
  // mixed bigint/string: compare numerically only if the string is numeric
  if (typeof l === "bigint" && typeof r === "string" && /^-?\d+$/.test(r)) return l === BigInt(r);
  if (typeof r === "bigint" && typeof l === "string" && /^-?\d+$/.test(l)) return r === BigInt(l);
  return false;
}

function evalCall(ast: Extract<Ast, { kind: "call" }>, scope: EvalScope): EvalValue {
  const { fn, args } = ast;
  switch (fn) {
    case "exists": {
      if (args.length !== 1 || args[0]?.kind !== "path") {
        throw new ExpressionEvalError("exists(...) takes exactly one path argument");
      }
      return pathExists(scope, args[0] as Extract<Ast, { kind: "path" }>);
    }
    case "abs": {
      if (args.length !== 1) throw new ExpressionEvalError("abs(x) takes one argument");
      const v = toBigInt(evalAst(args[0] as Ast, scope), "abs");
      return v < 0n ? -v : v;
    }
    case "neg": {
      if (args.length !== 1) throw new ExpressionEvalError("neg(x) takes one argument");
      return -toBigInt(evalAst(args[0] as Ast, scope), "neg");
    }
    case "min":
    case "max": {
      if (args.length < 1) throw new ExpressionEvalError(`${fn}(...) needs at least one argument`);
      const vals = args.map((a) => toBigInt(evalAst(a, scope), fn));
      return vals.reduce((acc, v) => {
        if (fn === "min") return v < acc ? v : acc;
        return v > acc ? v : acc;
      });
    }
    case "if": {
      if (args.length !== 3) throw new ExpressionEvalError("if(cond,a,b) takes three arguments");
      const cond = evalAst(args[0] as Ast, scope);
      if (typeof cond !== "boolean") {
        throw new ExpressionEvalError("if(...) condition must be a boolean");
      }
      return evalAst((cond ? args[1] : args[2]) as Ast, scope);
    }
    default:
      throw new ExpressionEvalError(`unknown function '${fn}'`);
  }
}

// ---------------------------------------------------------------------------
// Public evaluation API
// ---------------------------------------------------------------------------

/**
 * Evaluate an amount expression to an integer minor-unit BigInt. Throws if
 * the result is not a BigInt (e.g. the expression is a predicate).
 */
export function evaluateAmount(src: string, scope: EvalScope): bigint {
  const ast = parseExpression(src);
  const v = evalAst(ast, scope);
  if (typeof v !== "bigint") {
    throw new ExpressionEvalError(`amount expression '${src}' did not evaluate to a number`);
  }
  return v;
}

/**
 * Evaluate a predicate expression (`when` / `condition`) to a boolean.
 * Throws if the result is not a boolean.
 */
export function evaluatePredicate(src: string, scope: EvalScope): boolean {
  const ast = parseExpression(src);
  const v = evalAst(ast, scope);
  if (typeof v !== "boolean") {
    throw new ExpressionEvalError(`predicate '${src}' did not evaluate to a boolean`);
  }
  return v;
}

/**
 * Evaluate an expression that may resolve to a string (e.g. a currency path
 * like `event.near.payCurrency`). Used by the resolver to read a line's
 * currency source.
 */
export function evaluateString(src: string, scope: EvalScope): string {
  const ast = parseExpression(src);
  const v = evalAst(ast, scope);
  if (typeof v !== "string") {
    throw new ExpressionEvalError(`expression '${src}' did not evaluate to a string`);
  }
  return v;
}
