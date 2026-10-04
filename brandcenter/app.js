const $ = (id) => document.getElementById(id);

let catalog = [];
let areas = [];
let repairs = [];
let stocks = [];
let viewMode = "repair"; // "repair" | "stock"
let lastRepairFingerprint = "";
let lastStockFingerprint = "";
let openRepairId = null;
let openStockId = null;

/* ---------------------------------------------------------------------- */
/* Setup: product/area pickers                                            */
/* ---------------------------------------------------------------------- */

async function loadPickers() {
  try {
    const [catRes, metaRes] = await Promise.all([fetch("/api/catalog"), fetch("/api/meta")]);
    catalog = catRes.ok ? await catRes.json() : [];
    const meta = metaRes.ok ? await metaRes.json() : { areas: [] };
    areas = meta.areas || [];
  } catch (err) {
    catalog = [];
    areas = [];
  }

  const productOptions = catalog
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => `<option value="${p.name}">${p.name}</option>`)
    .join("");
  const areaOptions = areas.map((a) => `<option value="${a.code}">${a.name}</option>`).join("");

  $("repair-product").innerHTML = productOptions;
  $("stock-product").innerHTML = productOptions;
  $("repair-area").innerHTML = areaOptions;
  $("stock-area").innerHTML = areaOptions;
}

/* ---------------------------------------------------------------------- */
/* Polling                                                                */
/* ---------------------------------------------------------------------- */

async function fetchRepairs() {
  try {
    const res = await fetch("/api/service/repairs");
    if (!res.ok) return;
    repairs = await res.json();
    const fp = JSON.stringify(repairs.map((r) => r.id));
    if (fp !== lastRepairFingerprint) {
      lastRepairFingerprint = fp;
      renderRepairResults();
    }
    renderStats();
  } catch (err) {
    /* backend not reachable yet — keep showing what we have */
  }
}

async function fetchStocks() {
  try {
    const res = await fetch("/api/service/stock-checks");
    if (!res.ok) return;
    stocks = await res.json();
    const fp = JSON.stringify(stocks.map((s) => s.id));
    if (fp !== lastStockFingerprint) {
      lastStockFingerprint = fp;
      renderStockResults();
    }
    renderStats();
  } catch (err) {
    /* backend not reachable yet — keep showing what we have */
  }
}

function renderStats() {
  const local = repairs.filter((r) => r.route === "local_warehouse").length;
  const hub = repairs.filter((r) => r.route === "central_hub").length;
  const dispatched = stocks.filter((s) => s.route === "dispatch").length;
  const flagged = stocks.filter((s) => s.route === "flag_storefront").length;
  $("stats").innerHTML = [
    stat(repairs.length, "Repairs"),
    stat(local, "To Local WH"),
    stat(hub, "To Hub"),
    stat(stocks.length, "Stock Checks"),
    stat(dispatched, "Dispatched"),
    stat(flagged, "Unavailable"),
  ].join("");
}

function stat(value, label) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ---------------------------------------------------------------------- */
/* Shared render helpers                                                  */
/* ---------------------------------------------------------------------- */

function statTile(label, value) {
  return `<div class="stat-tile"><p class="stat-tile-label">${label}</p><p class="stat-tile-value">${value}</p></div>`;
}

function stepRow(state, title, reason) {
  const icon = state === "pass" ? "✓" : state === "fail" ? "✕" : "–";
  return `
    <div class="step-row ${state}">
      <span class="step-icon">${icon}</span>
      <div class="step-body">
        <p class="step-title">${title}</p>
        <p class="step-reason">${reason}</p>
      </div>
    </div>
  `;
}

/* ---------------------------------------------------------------------- */
/* Repair results                                                         */
/* ---------------------------------------------------------------------- */

function renderRepairResults() {
  $("repair-empty").hidden = repairs.length > 0;
  $("repair-results").innerHTML = repairs.map(repairCardHtml).join("");
  $("repair-results").querySelectorAll(".result").forEach((el) => {
    el.addEventListener("toggle", () => {
      openRepairId = el.open ? el.dataset.id : null;
    });
  });
}

function repairCardHtml(r) {
  const isLocal = r.route === "local_warehouse";
  const open = r.id === openRepairId ? "open" : "";

  let stepsHtml = stepRow(
    r.technician_check.available ? "pass" : "fail",
    "Certified Technician Check",
    r.technician_check.reason
  );

  if (!r.repair_attempt.attempted) {
    stepsHtml += stepRow("skip", "Attempt Repair", "Skipped — " + r.repair_attempt.reason);
    stepsHtml += stepRow("skip", "Industry Standard Check", "Skipped — no repair was attempted.");
  } else {
    stepsHtml += stepRow("pass", "Attempt Repair", r.repair_attempt.reason);
    stepsHtml += stepRow(r.repair_attempt.passed ? "pass" : "fail", "Industry Standard Check", r.repair_attempt.reason);
  }

  let dissatisfactionHtml = "";
  if (r.dissatisfaction_check) {
    const { demand, climate } = r.dissatisfaction_check;
    const tiles = [
      statTile("Recent Demand", `${demand.recent_avg}/mo`),
      statTile("Threshold", `${demand.threshold}/mo`),
      statTile("Climate Zone", climate.area_climate_zone),
      statTile("Climate Fit", climate.is_climate_fit ? "Yes" : "No"),
    ].join("");
    dissatisfactionHtml = `
      <p class="sub-note"><b>Personal-dissatisfaction criterion applied</b> — repair passed inspection, so the unit is routed the same way a dissatisfaction return would be.</p>
      <div class="stat-row">${tiles}</div>
      <p class="sub-note">${demand.reason}</p>
      <p class="sub-note">${climate.reason}</p>
    `;
  }

  return `
    <details class="card result" data-id="${r.id}" ${open}>
      <summary>
        <span class="result-dot ${isLocal ? "good" : "bad"}"></span>
        <span class="result-main">
          <span class="result-product">${r.product}</span>
          <span class="result-meta">${r.area_name} &middot; ${formatTimestamp(r.submitted_at)}${r.return_id ? " &middot; from storefront" : " &middot; manual"}</span>
        </span>
        <span class="result-badge ${isLocal ? "good" : "bad"}">${isLocal ? "Local WH" : "Central Hub"}</span>
        <svg class="result-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="result-body">
        <div class="steps">${stepsHtml}</div>
        <div class="decision ${isLocal ? "good" : "bad"}">
          <p class="decision-head">Decision: ${isLocal ? "Local Warehouse" : "Central Hub"}</p>
          <p class="decision-reason">${r.route_reason}</p>
        </div>
        ${dissatisfactionHtml}
      </div>
    </details>
  `;
}

/* ---------------------------------------------------------------------- */
/* Stock results                                                          */
/* ---------------------------------------------------------------------- */

function renderStockResults() {
  $("stock-empty").hidden = stocks.length > 0;
  $("stock-results").innerHTML = stocks.map(stockCardHtml).join("");
  $("stock-results").querySelectorAll(".result").forEach((el) => {
    el.addEventListener("toggle", () => {
      openStockId = el.open ? el.dataset.id : null;
    });
  });
}

function stockCardHtml(s) {
  const isDispatch = s.route === "dispatch";
  const open = s.id === openStockId ? "open" : "";

  const tiles = [
    statTile("Local Qty", s.local_qty),
    statTile("Partner Shops", s.partner_matches.length),
  ].join("");

  const chips = s.partner_matches.length
    ? `<div class="chip-row">${s.partner_matches
        .map(
          (m) =>
            `<span class="chip">${m.area_name} &middot; ${m.qty}${s.found_at && s.found_at.area_code === m.area_code ? " ✓" : ""}</span>`
        )
        .join("")}</div>`
    : `<p class="sub-note">No partner shop reported stock for this product.</p>`;

  return `
    <details class="card result" data-id="${s.id}" ${open}>
      <summary>
        <span class="result-dot ${isDispatch ? "good" : "bad"}"></span>
        <span class="result-main">
          <span class="result-product">${s.product}</span>
          <span class="result-meta">${s.area_name} &middot; ${formatTimestamp(s.submitted_at)}</span>
        </span>
        <span class="result-badge ${isDispatch ? "good" : "bad"}">${isDispatch ? "Dispatched" : "Unavailable"}</span>
        <svg class="result-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="result-body">
        <p class="sub-note">Checked this service centre's own local warehouse, then every partner shop for the same product.</p>
        <div class="stat-row">${tiles}</div>
        ${chips}
        <div class="decision ${isDispatch ? "good" : "bad"}">
          <p class="decision-head">Decision: ${isDispatch ? "Dispatch Unit" : "Flag Storefront"}</p>
          <p class="decision-reason">${s.route_reason}</p>
        </div>
      </div>
    </details>
  `;
}

/* ---------------------------------------------------------------------- */
/* Forms (manual input — staff runs each check themselves)                */
/* ---------------------------------------------------------------------- */

function setSubmitting(form, submitting, label) {
  const btn = form.querySelector("button[type=submit]");
  btn.disabled = submitting;
  btn.querySelector(".btn-label").textContent = submitting ? "Running…" : label;
}

$("repair-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const product = $("repair-product").value;
  const area_code = $("repair-area").value;
  if (!product || !area_code) return;
  setSubmitting(form, true, "Run repair check");
  try {
    const res = await fetch("/api/service/repair-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, area_code }),
    });
    if (!res.ok) throw new Error("repair check failed");
    const notification = await res.json();
    openRepairId = notification.id;
    await fetchRepairs();
  } catch (err) {
    alert("Could not run the repair check. Try again.");
  } finally {
    setSubmitting(form, false, "Run repair check");
  }
});

$("stock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const product = $("stock-product").value;
  const area_code = $("stock-area").value;
  if (!product || !area_code) return;
  setSubmitting(form, true, "Run stock check");
  try {
    const res = await fetch("/api/service/stock-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product, area_code }),
    });
    if (!res.ok) throw new Error("stock check failed");
    const notification = await res.json();
    openStockId = notification.id;
    await fetchStocks();
  } catch (err) {
    alert("Could not run the stock check. Try again.");
  } finally {
    setSubmitting(form, false, "Run stock check");
  }
});

/* ---------------------------------------------------------------------- */
/* Tabs + init                                                            */
/* ---------------------------------------------------------------------- */

$("tabs").querySelectorAll(".seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.view === viewMode) return;
    viewMode = btn.dataset.view;
    $("tabs").querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("on", b === btn));
    $("repair-view").hidden = viewMode !== "repair";
    $("stock-view").hidden = viewMode !== "stock";
  });
});

(async function init() {
  await loadPickers();
  await Promise.all([fetchRepairs(), fetchStocks()]);
  setInterval(() => {
    fetchRepairs();
    fetchStocks();
  }, 5000);
})();
