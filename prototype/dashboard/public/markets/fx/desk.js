// dashboard/public/markets/fx/desk.js — FX desk Slices 1 + 2 + 3 + 4.
//
// READ PATH — V2 (FU5 migration; D-FX-OTC-CLOSURE-BACKLOG,
//   D-BANK-WIDE-V2-MIGRATION). The three READ panels now consume the
//   name-free `/api/v2/markets/fx/*` surface instead of the legacy
//   `/api/markets/fx/*` GET routes:
//     - counterparties → GET /api/v2/markets/fx/counterparties
//     - headroom       → GET /api/v2/markets/fx/headroom (B3 FX cluster, FIL-sourced)
//     - NPA badges     → GET /api/v2/markets/fx/npa
//   Each V2 panel carries an explicit `dataState` ("live" | "empty" | "v1-only")
//   + `reason`; the page renders honest empty / absent states (never a silent
//   zero) and surfaces seats by Title only (the V2 DTOs are name-free).
//
// WRITE PATH — V1 (unchanged; NOT in scope of the V2 read migration). The RFQ
//   form still POSTs to the V1 action routes — there is no V2 trade-execution
//   endpoint (the V2 surface is read-only; FIL is materialised FROM V1 trades):
//     - POST /api/markets/fx/quote → seed-data-driven bid/offer/mid
//     - POST /api/markets/fx/trade → appends RfqRequested + QuoteResponded +
//       FxTradeExecuted with the simulated provenance tag; confirmation panel
//       renders tradeId + eventId + provenance.
//     - POST /api/markets/fx/order → 7-check pre-trade gateway (Slice 4).
//
// Counterparty SELECT (trade-form picker) is populated from the V2
//   counterparties read; trade submission remains the V1 POST path above.
//
// Seat ownership is surfaced by Title only (name-free policy;
//   feedback_no_agent_names_in_ui).

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
      // V2 read (FU5): name-free counterparty view — eligibility ∩ live FX FIL.
      const res = await fetch("/api/v2/markets/fx/counterparties", {
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

  // V2 counterparties DTO is name-free: rows of
  //   { counterpartyId, eligibility, liveFxInstruments, asOf }
  // plus a panel-level { dataState, reason }. No display NAME, screening id, or
  // evidence refs cross the V2 boundary (feedback_no_agent_names_in_ui), so the
  // table maps the existing 5 columns onto the V2 fields honestly rather than
  // re-introducing names client-side.
  function v2Rows(payload) {
    return payload && Array.isArray(payload.rows) ? payload.rows : null;
  }

  function eligibilityClass(eligibility) {
    return eligibility === "institutional-eligible" ? "fx-cp-outcome-pass" : "fx-cp-outcome-other";
  }

  function renderCounterparties(payload) {
    const summaryCount = $("[data-fx-cp-count]");
    const tbody = $("[data-fx-cp-tbody]");
    if (!tbody) return;

    const list = v2Rows(payload);
    if (!list) {
      if (summaryCount) summaryCount.textContent = "?";
      renderEmpty("Counterparty endpoint unavailable.");
      return;
    }

    if (summaryCount) summaryCount.textContent = String(list.length);

    if (list.length === 0) {
      // Honest empty state surfaced by the V2 panel — never a silent zero.
      renderEmpty(
        payload.reason ||
          "No screened counterparties and no live FX FIL counterparties on this store.",
      );
      return;
    }

    tbody.innerHTML = list
      .map((c) => {
        const cpId = c.counterpartyId || "—";
        return [
          "<tr>",
          `<td><span class="fx-cp-id">${escapeHtml(cpId)}</span></td>`,
          `<td>${escapeHtml(String(c.liveFxInstruments ?? 0))} live FX</td>`,
          `<td><span class="${eligibilityClass(c.eligibility)}">${escapeHtml(c.eligibility || "—")}</span></td>`,
          `<td>${escapeHtml(fmtAsOf(c.asOf))}</td>`,
          "<td>—</td>",
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
        counterparties: v2Rows(payload)?.length ?? 0,
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
    const list = v2Rows(payload) ?? [];
    const previous = sel.value;
    const opts = list
      .map((c) => {
        // Name-free: the V2 DTO carries the counterparty party-id only.
        const label = c.counterpartyId;
        return `<option value="${escapeHtml(c.counterpartyId)}">${escapeHtml(label)}</option>`;
      })
      .join("");
    sel.innerHTML = `<option value="">— select an eligible counterparty —</option>${opts}`;
    if (previous && list.some((c) => c.counterpartyId === previous)) {
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
    const gatewayBtn = $("[data-fx-rfq-gateway]");
    const input = readForm();
    const fillable = isFormFillable(input);
    if (submitBtn) submitBtn.disabled = !fillable;
    if (gatewayBtn) gatewayBtn.disabled = !fillable;
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

  // ============================================================
  // Slice 4 — Gateway visualisation
  // ============================================================

  function showGatewayPanel(result) {
    const panel = $("[data-fx-gateway-panel]");
    const statusEl = $("[data-fx-gw-status]");
    const tbody = $("[data-fx-gw-checks-tbody]");
    if (!panel) return;

    panel.hidden = false;

    if (statusEl) {
      const approved = result.status === "approved";
      statusEl.textContent = approved
        ? "APPROVED — all gateway checks passed"
        : `REJECTED — check: ${escapeHtml(result.rejectingCheck ?? "unknown")} · ${escapeHtml(result.rejectionReason ?? "")}`;
      statusEl.className = `fx-gw-status ${approved ? "fx-gw-approve" : "fx-gw-reject"}`;
    }

    if (tbody) {
      const checks = Array.isArray(result.checks) ? result.checks : [];
      tbody.innerHTML = checks
        .map((c) => {
          const cls = c.outcome === "approve" ? "fx-gw-approve" : "fx-gw-reject";
          const icon = c.outcome === "approve" ? "✓" : "✗";
          const latency = typeof c.latencyMs === "number" ? `${c.latencyMs}ms` : "—";
          return [
            `<tr class="${cls}">`,
            `<td>${escapeHtml(c.checkKind)}</td>`,
            `<td>${icon} ${escapeHtml(c.outcome)}</td>`,
            `<td>${escapeHtml(latency)}</td>`,
            "</tr>",
          ].join("");
        })
        .join("");
    }
  }

  async function routeToGateway() {
    const input = readForm();
    if (!isFormFillable(input)) {
      setStatus("Form is incomplete.", true);
      return;
    }
    setStatus("Routing to gateway…");
    const gatewayBtn = $("[data-fx-rfq-gateway]");
    if (gatewayBtn) gatewayBtn.disabled = true;
    try {
      const res = await fetch("/api/markets/fx/order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && (data.status === "approved" || data.status === "rejected")) {
        setStatus(
          data.status === "approved"
            ? `Gateway: APPROVED (orderId: ${data.orderId})`
            : `Gateway: REJECTED — ${data.rejectionReason ?? "check failed"}`,
          data.status === "rejected",
        );
        showGatewayPanel(data);
        if (window.bankShell?.audit) {
          window.bankShell.audit.log("fx-desk.gateway.result", {
            orderId: data.orderId,
            status: data.status,
          });
        }
      } else {
        const reason = data?.reason ?? data?.error ?? `HTTP ${res.status}`;
        setStatus(`Gateway error: ${reason}`, true);
      }
    } catch (e) {
      console.warn("[fx-desk] gateway route failed", e);
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
    // Slice 4 — gateway button (outside the form submit path)
    const gatewayBtn = $("[data-fx-rfq-gateway]");
    if (gatewayBtn) {
      gatewayBtn.addEventListener("click", () => {
        routeToGateway().catch((e) => console.warn("[fx-desk] gateway route", e));
      });
    }
    refreshFormState();
    refreshQuote().catch((e) => console.warn("[fx-desk] initial quote", e));
  }

  // ============================================================
  // Slice 3 — Headroom panel
  // ============================================================

  // Notional exposures are whole-number major units; route the number through
  // the shared formatter (grouping/negative-style/locale) but keep 0 decimals.
  function fmtExposure(n, currency) {
    if (typeof n !== "number" || !Number.isFinite(n)) return "—";
    const num = window.SC?.fmtNumber
      ? window.SC.fmtNumber(n, { decimals: 0 })
      : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return `${currency ?? ""} ${num}`.trim();
  }

  function renderHeadroomEmpty(message) {
    const tbody = $("[data-fx-headroom-tbody]");
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="fx-cp-empty">${escapeHtml(message)}</td></tr>`;
  }

  // Minor-unit (functional ccy) → major-unit number for display. The V2 headroom
  // DTO carries figures in MINOR units; the table renders major units.
  function minorToMajor(minor) {
    return typeof minor === "number" && Number.isFinite(minor) ? minor / 100 : null;
  }

  // V2 headroom DTO is a SINGLE B3 (FX net-open-position) row + panel meta:
  //   { b3: { cluster:"B3", limitName, currentExposureFunctionalMinor,
  //           limitValueFunctionalMinor, utilisationPct, ragStatus, currency },
  //     coverageStatus, dataState, reason, scopeNote, gaps }
  // Only the B3 FX cluster is V2-fed (FIL-sourced); the other RAS clusters stay
  // on the V1 limit-utilisation projection (scopeNote). Render the one B3 line
  // honestly; surface dataState reasons rather than a silent zero.
  function renderHeadroom(payload) {
    const tbody = $("[data-fx-headroom-tbody]");
    if (!tbody) return;

    const b3 = payload?.b3;
    if (!b3) {
      renderHeadroomEmpty("Headroom data unavailable.");
      return;
    }
    if (payload.dataState !== "live") {
      // Honest empty / no-limit state — exposure may be present but utilisation
      // cannot be computed; surface the V2 reason rather than fabricate a number.
      renderHeadroomEmpty(payload.reason || "No live FX net-open-position headroom on this store.");
      return;
    }

    const ragClass = `fx-rag-${b3.ragStatus ?? "green"}`;
    const ragLabel = (b3.ragStatus ?? "green").toUpperCase();
    const utilisationLabel =
      typeof b3.utilisationPct === "number" ? `${(b3.utilisationPct * 100).toFixed(1)}%` : "—";
    tbody.innerHTML = [
      "<tr>",
      `<td><strong>${escapeHtml(b3.cluster ?? "B3")}</strong></td>`,
      `<td>${escapeHtml(b3.limitName ?? "—")}</td>`,
      `<td>${escapeHtml(fmtExposure(minorToMajor(b3.currentExposureFunctionalMinor), b3.currency))}</td>`,
      `<td>${escapeHtml(fmtExposure(minorToMajor(b3.limitValueFunctionalMinor), b3.currency))}</td>`,
      `<td>${escapeHtml(utilisationLabel)}</td>`,
      `<td><span class="${ragClass}">${ragLabel}</span></td>`,
      "</tr>",
    ].join("");
  }

  async function loadHeadroom() {
    try {
      // V2 read (FU5): FIL-sourced RAS B3 (FX) limit-utilisation.
      const res = await fetch("/api/v2/markets/fx/headroom", {
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

  // ============================================================
  // Slice 7 — NPA attestation badge strip
  // ============================================================

  async function loadNpaAttestations() {
    try {
      // V2 read (FU5): product NPA lifecycle on the umbrella OTC-vanilla FX
      // product. DTO: { productId, attestations:[{productCode,status,…}],
      // dataState, reason }.
      const res = await fetch("/api/v2/markets/fx/npa", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const container = document.querySelector("[data-fx-npa-badges]");
      if (!container || !data.attestations) return;
      container.innerHTML = data.attestations
        .map((a) => {
          const cls =
            a.status === "approved"
              ? "fx-npa-approved"
              : a.status === "withheld"
                ? "fx-npa-withheld"
                : "fx-npa-pending";
          const label =
            a.status === "approved"
              ? `${escapeHtml(a.productCode)}: NPA approved ✓`
              : a.status === "withheld"
                ? `${escapeHtml(a.productCode)}: withheld ✗`
                : `${escapeHtml(a.productCode)}: pre-go-live (pending NPA)`;
          return `<span class="fx-npa-badge ${cls}" title="${escapeHtml(a.status)}">${label}</span>`;
        })
        .join("");
    } catch (e) {
      console.warn("[fx-desk] NPA attestation fetch failed", e);
      const container = document.querySelector("[data-fx-npa-badges]");
      if (container) {
        container.innerHTML =
          '<span class="fx-npa-badge fx-npa-pending">NPA attestation unavailable</span>';
      }
    }
  }

  async function boot() {
    // Render skeleton immediately so the shell chrome lays out even
    // before the first API call returns.
    renderEmpty("Loading…");
    renderHeadroomEmpty("Loading…");
    await Promise.all([loadDesk(), loadHeadroom(), loadNpaAttestations()]);
    bindForm();
    if (typeof window.registerPagePoll === "function") {
      window.registerPagePoll(
        () => Promise.all([loadDesk(), loadHeadroom(), loadNpaAttestations()]),
        30_000,
      );
    } else {
      setInterval(() => {
        Promise.all([
          loadDesk().catch((e) => console.warn("[fx-desk] counterparty refresh failed", e)),
          loadHeadroom().catch((e) => console.warn("[fx-desk] headroom refresh failed", e)),
          loadNpaAttestations().catch((e) =>
            console.warn("[fx-desk] NPA attestation refresh failed", e),
          ),
        ]);
      }, 30_000);
    }
  }

  // Expose for the shell header refresh button + future tests.
  window.bankFxDesk = { loadDesk, loadHeadroom, loadNpaAttestations };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
