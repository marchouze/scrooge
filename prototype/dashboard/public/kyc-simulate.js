// dashboard/public/kyc-simulate.js
//
// KYC Simulation Panel — /kyc-onboarding/simulate
// POSTs to /api/kyc/simulate and renders results.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01; AML-CFT-POLICY-V1.
// Author: Atlas (Core banking platform architect, engineering)

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Scenario descriptions

const SCENARIO_DESCS = {
  clean:
    "Registers a clean low-risk entity (Meridian Capital). All checks pass; auto-accept expected on full run.",
  "pep-linked":
    "UBO name starts with 'LINKED' → PEP-linked flag → EDD initiated → human gate required.",
  "sanctions-exact":
    "Entity name starts with 'SANCTION' → exact hit on all lists → auto-rejected immediately.",
  "sanctions-fuzzy":
    "Entity name starts with 'FUZZY' → fuzzy sanctions hit (score < 100) → referred to human gate.",
  "high-risk-jurisdiction":
    "Jurisdiction: NG (Nigeria — FATF grey list) → high risk score → EDD initiated → human gate.",
  "complex-ubo":
    "UBO basis of control includes 'nominee arrangement' → opaque structure → human gate.",
  "credit-adverse":
    "UBO ID number ends in '9' → adverse credit indicator → medium/high risk → human gate.",
};

function updateScenarioDesc() {
  const scenario = $("scenarioPicker")?.value;
  const desc = $("scenarioDesc");
  if (desc) desc.textContent = SCENARIO_DESCS[scenario] ?? "";
}
window.updateScenarioDesc = updateScenarioDesc;

// ---------------------------------------------------------------------------
// Utilities

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, type = "error") {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => {
    t.className = "toast";
  }, 4000);
}

function outcomeBadge(outcome) {
  const map = {
    "in-progress": "badge-blue",
    accepted: "badge-green",
    rejected: "badge-red",
    referred: "badge-amber",
    error: "badge-grey",
  };
  return `<span class="badge ${map[outcome] ?? "badge-grey"}">${esc(outcome)}</span>`;
}

function riskBadge(band) {
  if (!band || band === "-") return `<span class="muted">—</span>`;
  const map = { low: "badge-green", medium: "badge-amber", high: "badge-red" };
  return `<span class="badge ${map[band] ?? "badge-grey"}">${esc(band)}</span>`;
}

// ---------------------------------------------------------------------------
// Simulate

async function runSimulation() {
  const scenario = $("scenarioPicker")?.value;
  const count = Math.max(1, Math.min(10, Number($("countInput")?.value) || 1));
  const runFull = $("runFullToggle")?.checked ?? false;

  if (!scenario) {
    showToast("Select a scenario first.");
    return;
  }

  const btn = $("generateBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Running…";
  }

  $("resultsSection").hidden = false;
  $("loadingState").className = "loading-state show";
  $("resultsTableWrap").hidden = true;
  $("resultsSubtitle").textContent = "";

  try {
    const res = await fetch("/api/kyc/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario, count, runFull }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

    renderResults(data.results ?? []);
    showToast(
      `Simulation complete — ${(data.results ?? []).length} candidate(s) generated.`,
      "success",
    );
  } catch (e) {
    showToast(`Simulation failed: ${e.message}`);
    $("loadingState").className = "loading-state";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "▶ Generate";
    }
  }
}
window.runSimulation = runSimulation;

// ---------------------------------------------------------------------------
// Render results

function renderResults(results) {
  $("loadingState").className = "loading-state";
  $("resultsTableWrap").hidden = false;
  $("resultsSubtitle").textContent =
    `${results.length} candidate${results.length !== 1 ? "s" : ""} generated`;

  $("resultsBody").innerHTML = results
    .map((r) => {
      const truncId = r.candidateId.length > 16 ? `${r.candidateId.slice(0, 16)}…` : r.candidateId;
      return `<tr>
      <td><code title="${esc(r.candidateId)}">${esc(truncId)}</code></td>
      <td>${esc(r.entityName ?? "—")}</td>
      <td><code>${esc(r.scenario)}</code></td>
      <td>${esc((r.finalStep ?? "—").replace(/-/g, " "))}</td>
      <td>${outcomeBadge(r.outcome)}</td>
      <td>${riskBadge(r.riskBand)}</td>
      <td>
        ${
          r.candidateId && r.candidateId !== "error-0"
            ? `<a class="btn btn-outline btn-sm" href="/kyc-onboarding/${encodeURIComponent(r.candidateId)}">View</a>`
            : ""
        }
      </td>
    </tr>`;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Init

updateScenarioDesc();
