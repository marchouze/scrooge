// _format.js — Shared number/currency formatter (window.SC.*)
//
// One house style for every figure on the intranet. Replaces the ~8 per-page
// re-implementations of fmtZar/zarFmt/fmtR/numFmt etc. Reads the platform-wide
// display convention published by the shell as window.BANK_DISPLAY (set in
// _shell.js from GET /api/config → display block). Falls back to baked-in
// defaults so figures render correctly even before /api/config resolves.
//
// Authority: D-BANK-CONFIG-STORE (display block); dashboard UI enhancement.
// Author: Atlas (Platform Engineering Lead).

(() => {
  // Baked-in defaults — must mirror buildDisplayDefaults() in
  // platform/config/loader.ts so pre-config render matches post-config render.
  const DEFAULTS = {
    decimals: 2,
    thousandsSeparator: true,
    negativeStyle: "minus", // "minus" | "parens" | "minus-red"
    rightAlignNumbers: true,
    currencyPosition: "prefix", // "prefix" | "suffix"
    locale: "en-ZA",
  };

  const MINUS = "−"; // U+2212 true minus, matches the legacy convention.

  // Live display settings: window.BANK_DISPLAY overrides defaults per-key.
  function settings() {
    const d = (typeof window !== "undefined" && window.BANK_DISPLAY) || {};
    return {
      decimals: typeof d.decimals === "number" ? d.decimals : DEFAULTS.decimals,
      thousandsSeparator:
        typeof d.thousandsSeparator === "boolean"
          ? d.thousandsSeparator
          : DEFAULTS.thousandsSeparator,
      negativeStyle: d.negativeStyle || DEFAULTS.negativeStyle,
      rightAlignNumbers:
        typeof d.rightAlignNumbers === "boolean" ? d.rightAlignNumbers : DEFAULTS.rightAlignNumbers,
      currencyPosition: d.currencyPosition || DEFAULTS.currencyPosition,
      locale: d.locale || DEFAULTS.locale,
    };
  }

  // Format the absolute magnitude with locale grouping + fixed decimals.
  function magnitude(absValue, cfg, decimals) {
    const dp = typeof decimals === "number" ? decimals : cfg.decimals;
    try {
      return absValue.toLocaleString(cfg.locale, {
        minimumFractionDigits: dp,
        maximumFractionDigits: dp,
        useGrouping: cfg.thousandsSeparator,
      });
    } catch {
      // Bad locale string → fall back to fixed-point with no grouping.
      return absValue.toFixed(dp);
    }
  }

  // Apply the negative convention. `body` is the already-formatted magnitude
  // (optionally with a currency affix). `plain` forces text-only output (no
  // <span>), used where HTML is not safe (e.g. <option>, title attributes).
  function applyNegative(body, isNeg, cfg, plain) {
    if (!isNeg) return body;
    if (cfg.negativeStyle === "parens") return `(${body})`;
    if (cfg.negativeStyle === "minus-red" && !plain) {
      return `<span class="num-negative">${MINUS}${body}</span>`;
    }
    // "minus" (and minus-red in plain mode) → bare true-minus prefix.
    return `${MINUS}${body}`;
  }

  // ── fmtNumber ──────────────────────────────────────────────────
  // Format a plain (major-unit) number. opts: { decimals, plain }.
  function fmtNumber(value, opts = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const cfg = settings();
    const n = Number(value);
    const body = magnitude(Math.abs(n), cfg, opts.decimals);
    return applyNegative(body, n < 0, cfg, opts.plain === true);
  }

  // ── fmtMoney ───────────────────────────────────────────────────
  // Format an amount given in MINOR units (cents) with a currency code, e.g.
  // fmtMoney(-123456, "ZAR") → "−ZAR 1,234.56" (prefix) or "−1,234.56 ZAR".
  // opts: { decimals, plain, minorUnitDivisor } (divisor default 100).
  function fmtMoney(minorUnits, currency, opts = {}) {
    if (minorUnits === null || minorUnits === undefined || Number.isNaN(Number(minorUnits)))
      return "—";
    const cfg = settings();
    const divisor = typeof opts.minorUnitDivisor === "number" ? opts.minorUnitDivisor : 100;
    const major = Number(minorUnits) / divisor;
    const ccy = currency ? String(currency) : "";
    const mag = magnitude(Math.abs(major), cfg, opts.decimals);
    const body = !ccy ? mag : cfg.currencyPosition === "suffix" ? `${mag} ${ccy}` : `${ccy} ${mag}`;
    return applyNegative(body, major < 0, cfg, opts.plain === true);
  }

  // ── fmtPercent ─────────────────────────────────────────────────
  // Format a value already expressed in percent units (12.5 → "12.5%").
  // opts: { decimals (default 1), plain }.
  function fmtPercent(value, opts = {}) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const cfg = settings();
    const dp = typeof opts.decimals === "number" ? opts.decimals : 1;
    const n = Number(value);
    const body = `${magnitude(Math.abs(n), cfg, dp)}%`;
    return applyNegative(body, n < 0, cfg, opts.plain === true);
  }

  // ── numClass ───────────────────────────────────────────────────
  // Cell/element class for numeric columns: "num" when right-align is on.
  function numClass() {
    return settings().rightAlignNumbers ? "num" : "";
  }

  // ── getDisplay ─────────────────────────────────────────────────
  // Resolved settings, for pages that need to branch on the convention.
  function getDisplay() {
    return settings();
  }

  window.SC = Object.assign(window.SC || {}, {
    fmtMoney,
    fmtNumber,
    fmtPercent,
    numClass,
    getDisplay,
  });
})();
