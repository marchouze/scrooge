// dashboard/public/markets/fx/desk.js — FX desk Slices 1 + 2 + 3.
//
// Slice 1 — reads `/api/markets/fx/counterparties` and renders the
//   eligibility-passing counterparty list (read-only). Re-uses
//   `_refresh-controls.js` for periodic refresh + the shell header
//   refresh button.
//
// Slice 2 — wires the RFQ form: populates the counterparty select from
//   the live picker, calls POST /api/markets/fx/quote on input changes
//   to render the seed-data-driven bid/offer/mid (Slice 3 pricer), and
//   on submit calls POST /api/markets/fx/trade which appends
//   RfqRequested + QuoteResponded + FxTradeExecuted events to the local
//   event store with the simulated provenance tag for the
//   first-dry-run-2026-Q1 scenario. The confirmation panel renders the
//   emitted tradeId + eventId + provenance.
//
// Slice 3 — `loadHeadroom()` fetches GET /api/markets/fx/headroom and
//   renders the five RAS B-cluster rows with RAG status in the
//   #headroom table. Called on page load and on Refresh alongside
//   `loadCounterparties()`.
//
// Author: Kai (Trading systems engineer, engineering — reports to Saskia,
//         Head of Global Markets) · Saskia (Head of Global Markets,
//         governance) · Anya (Data / analytics engineer, engineering).

(() => {
  function $(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      c === "&"
        ? "&amp;"
        : c === "<"
          ? "&lt;"
          : c === ">"
            ? "&gt;"
            : c === '"'
              ? "&quot;"
              : "&#39;",
    );
  }

  function fmtAsOf(asOf) {
    if (!asOf) return "—";
    try {
      const d = new Date(asOf);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(asOf);
    }
  }

  async function fetchCounterparties() {
    try {
      const res = await fetch("/api/markets/fx/counterparties", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn("[fx-desk] counterparty fetch failed", e);
      return null;
    }
  }

  function renderEmpty(message) {
    const tbody = $("[data-fx-cp-tbody]");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="fx-cp-empty">${escapeHtml(message)}</td></tr>`;
  }

  function renderCounterparties(payload) {
    const summaryCount = $("[data-fx-cp-count]");
    const tbody = $("[data-fx-cp-tbody]");
    if (!tbody) return;

    if (!payload || !Array.isArray(payload.counterparties)) {
      if (summaryCount) summaryCount.textContent = "?";
      renderEmpty("Counterparty endpoint unavailable.");
      return;
    }

    const list = payload.counterparties;
    if (summaryCount) summaryCount.textContent = String(list.length);

    if (list.length === 0) {
      // Empty corpus is the expected state until Slice 2 seeds the
      // synthetic counterparty corpus (pack §9 gap #6).
      renderEmpty(
        "No eligibility-passing counterparties in the event store. " +
          "Seed CounterpartyEligibilityScreened events to populate (Slice 2 substrate gap §9 #6).",
      );
      return;
    }

    tbody.innerHTML = list
      .map((c) => {
        const evidenceList = (c.evidenceRefs || [])
          .slice(0, 3)
          .map((e) => `<li>${escapeHtml(e)}</li>`)
          .join("");
        return [
          "<tr>",
          `<td><strong>${escapeHtml(c.counterpartyId)}</strong>`,
          `<span class="fx-cp-id">${escapeHtml(c.screeningId || "")}</span></td>`,
          `<td>${escapeHtml(c.screeningId || "—")}</td>`,
          `<td><span class="fx-cp-outcome-pass">${escapeHtml(c.outcome || "—")}</span></td>`,
          `<td>${escapeHtml(fmtAsOf(c.asOf))}</td>`,
          `<td><ul class="fx-cp-evidence">${evidenceList || "<li>—</li>"}</ul></td>`,
          "</tr>",
        ].join("");
      })
      .join("");
  }

  async function loadDesk() {
    const payload = await fetchCounterparties();
    renderCounterparties(payload);
    populateCounterpartySelect(payload);

    if (window.bankShell?.render) {
      const asOf = payload?.asOf ? payload.asOf : new Date().toISOString();
      window.bankShell.render.asOf(asOf);
    }
    if (window.bankShell?.audit) {
      window.bankShell.audit.log("fx-desk.tiles.rendered", {
        counterparties: payload?.counterparties?.length ?? 0,
      });
    }
  }

  // ============================================================
  // Slice 2 — RFQ form + quote + trade-emit
  // ============================================================

  function fmtRate(n) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return n.toFixed(4);
  }

  function defaultValueDate() {
    // Spot convention: T+2 (no calendar adjustment in the form — calendar
    // logic lands at M2 with the bond cut-off work).
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  function populateCounterpartySelect(payload) {
    const sel = $("[data-fx-rfq-counterparty]");
    if (!sel) return;
    const list = (payload?.counterparties ?? []).map((c) => c.counterpartyId);
    const previous = sel.value;
    const opts = list
      .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(id)}</option>`)
      .join("");
    sel.innerHTML = `<option value="">— select an eligible counterparty —</option>${opts}`;
    if (previous && list.includes(previous)) {
      sel.value = previous;
    }
    // Refresh derived UI state on every reload (e.g. submit-button
    // enable/disable).
    refreshFormState();
  }

  function readForm() {
    const cp = $("[data-fx-rfq-counterparty]")?.value || "";
    const pair = $("[data-fx-rfq-pair]")?.value || "";
    const sideEl = document.querySelector("[data-fx-rfq-side]:checked");
    const side = sideEl ? sideEl.value : "buy";
    const notionalRaw = $("[data-fx-rfq-notional]")?.value || "";
    const valueDate = $("[data-fx-rfq-value-date]")?.value || "";
    const notional = Number(notionalRaw);
    return {
      counterpartyId: cp,
      currencyPair: pair,
      side,
      notional: Number.isFinite(notional) ? notional : 0,
      valueDate,
    };
  }

  function isFormFillable(input) {
    return (
      !!input.counterpartyId &&
      input.currencyPair === "USD/ZAR" &&
      (input.side === "buy" || input.side === "sell") &&
      typeof input.notional === "number" &&
      input.notional > 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(input.valueDate)
    );
  }

  function setStatus(msg, isError = false) {
    const el = $("[data-fx-rfq-status]");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-error", isError);
  }

  function renderQuote(quote) {
    const set = (sel, v) => {
      const el = $(sel);
      if (el) el.textContent = v;
    };
    if (!quote) {
      set("[data-fx-rfq-bid]", "—");
      set("[data-fx-rfq-mid]", "—");
      set("[data-fx-rfq-offer]", "—");
      set("[data-fx-rfq-rate]", "—");
      set("[data-fx-rfq-source]", "—");
      return;
    }
    set("[data-fx-rfq-bid]", fmtRate(quote.bidRate));
    set("[data-fx-rfq-mid]", fmtRate(quote.midRate));
    set("[data-fx-rfq-offer]", fmtRate(quote.offerRate));
    set("[data-fx-rfq-rate]", fmtRate(quote.rateUsed));
    set("[data-fx-rfq-source]", quote.source ?? "—");
  }

  async function refreshQuote() {
    const input = readForm();
    if (!isFormFillable(input)) {
      renderQuote(null);
      return;
    }
    try {
      const res = await fetch("/api/markets/fx/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "ok" && data.quote) {
        renderQuote(data.quote);
      } else {
        renderQuote(null);
      }
    } catch (e) {
      console.warn("[fx-desk] quote fetch failed", e);
      renderQuote(null);
    }
  }

  function refreshFormState() {
    const submitBtn = $("[data-fx-rfq-submit]");
    if (!submitBtn) return;
    const input = readForm();
    submitBtn.disabled = !isFormFillable(input);
  }

  function showConfirmation(result) {
    const panel = $("[data-fx-rfq-confirmation]");
    if (!panel) return;
    const set = (sel, v) => {
      const el = $(sel);
      if (el) el.textContent = v;
    };
    panel.hidden = false;
    set("[data-fx-conf-status]", result.status ?? "—");
    set("[data-fx-conf-trade-id]", result.tradeId ?? "—");
    set("[data-fx-conf-rfq-id]", result.rfqId ?? "—");
    set("[data-fx-conf-event-id]", result.eventId ?? "—");
    set("[data-fx-conf-event-type]", result.eventType ?? "—");
    const prov = result.provenance
      ? `${result.provenance.kind} · scenario:${result.provenance.scenario ?? "—"} · sourceLineage:${result.provenance.sourceLineage ?? "—"}`
      : "—";
    set("[data-fx-conf-provenance]", prov);
    set("[data-fx-conf-asof]", result.asOf ?? "—");
  }

  async function submitTrade(ev) {
    ev.preventDefault();
    const input = readForm();
    if (!isFormFillable(input)) {
      setStatus("Form is incomplete.", true);
      return;
    }
    setStatus("Emitting FxTradeExecuted…");
    const submitBtn = $("[data-fx-rfq-submit]");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const res = await fetch("/api/markets/fx/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.status === "ok") {
        setStatus(`Trade ${data.tradeId} emitted.`);
        showConfirmation(data);
        if (window.bankShell?.audit) {
          window.bankShell.audit.log("fx-desk.trade.emitted", {
            tradeId: data.tradeId,
            eventId: data.eventId,
          });
        }
      } else {
        const reason = data?.reason ?? `HTTP ${res.status}`;
        setStatus(`Rejected: ${reason}`, true);
      }
    } catch (e) {
      console.warn("[fx-desk] trade emit failed", e);
      setStatus(`Network error: ${e?.message ?? e}`, true);
    } finally {
      refreshFormState();
    }
  }

  function bindForm() {
    const form = $("[data-fx-rfq-form]");
    if (!form) return;
    // Default value date.
    const vd = $("[data-fx-rfq-value-date]");
    if (vd && !vd.value) vd.value = defaultValueDate();
    form.addEventListener("submit", submitTrade);
    form.addEventListener("input", () => {
      refreshFormState();
      // Quote re-fetch on any input change. Fire-and-forget; simple
      // last-write-wins (no debounce in v1 — synthetic stub is local).
      refreshQuote().catch((e) => console.warn("[fx-desk] quote refresh", e));
    });
    form.addEventListener("change", () => {
      refreshFormState();
      refreshQuote().catch((e) => console.warn("[fx-desk] quote refresh", e));
    });
    refreshFormState();
    refreshQuote().catch((e) => console.warn("[fx-desk] initial quote", e));
  }

  // ============================================================
  // Slice 3 — Headroom panel
  // ============================================================

  function fmtExposure(n, currency) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    return `${currency ?? ""} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.trim();
  }

  function renderHeadroomEmpty(message) {
    const tbody = $("[data-fx-headroom-tbody]");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="fx-cp-empty">${escapeHtml(message)}</td></tr>`;
  }

  function renderHeadroom(payload) {
    const tbody = $("[data-fx-headroom-tbody]");
    if (!tbody) return;

    if (!payload || !Array.isArray(payload.rows) || payload.rows.length === 0) {
      renderHeadroomEmpty("Headroom data unavailable.");
      return;
    }

    tbody.innerHTML = payload.rows
      .map((row) => {
        const ragClass = `fx-rag-${row.ragStatus ?? "green"}`;
        const ragLabel = (row.ragStatus ?? "green").toUpperCase();
        const utilisationLabel =
          typeof row.utilisationPct === "number"
            ? `${(row.utilisationPct * 100).toFixed(1)}%`
            : "—";
        return [
          "<tr>",
          `<td><strong>${escapeHtml(row.cluster ?? "—")}</strong></td>`,
          `<td>${escapeHtml(row.limitName ?? "—")}</td>`,
          `<td>${escapeHtml(fmtExposure(row.currentExposure, row.currency))}</td>`,
          `<td>${escapeHtml(fmtExposure(row.limitValue, row.currency))}</td>`,
          `<td>${escapeHtml(utilisationLabel)}</td>`,
          `<td><span class="${ragClass}">${ragLabel}</span></td>`,
          "</tr>",
        ].join("");
      })
      .join("");
  }

  async function loadHeadroom() {
    try {
      const res = await fetch("/api/markets/fx/headroom", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const payload = await res.json();
      renderHeadroom(payload);
    } catch (e) {
      console.warn("[fx-desk] headroom fetch failed", e);
      renderHeadroomEmpty("Headroom data unavailable.");
    }
  }

  async function boot() {
    // Render skeleton immediately so the shell chrome lays out even
    // before the first API call returns.
    renderEmpty("Loading…");
    renderHeadroomEmpty("Loading…");
    await Promise.all([loadDesk(), loadHeadroom()]);
    bindForm();
    if (typeof window.registerPagePoll === "function") {
      window.registerPagePoll(() => Promise.all([loadDesk(), loadHeadroom()]), 30_000);
    } else {
      setInterval(() => {
        Promise.all([
          loadDesk().catch((e) => console.warn("[fx-desk] counterparty refresh failed", e)),
          loadHeadroom().catch((e) => console.warn("[fx-desk] headroom refresh failed", e)),
        ]);
      }, 30_000);
    }
  }

  // Expose for the shell header refresh button + future tests.
  window.bankFxDesk = { loadDesk, loadHeadroom };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
