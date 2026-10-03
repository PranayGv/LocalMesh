const form = document.getElementById("review-form");
const categorySelect = document.getElementById("category");
const areaSelect = document.getElementById("area");
const reviewText = document.getElementById("review_text");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const results = document.getElementById("results");

let demandChart = null;

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

async function loadMeta() {
  const res = await fetch("/api/meta");
  const meta = await res.json();
  categorySelect.innerHTML = meta.categories
    .map((c) => `<option value="${c.code}">${c.name}</option>`)
    .join("");
  areaSelect.innerHTML = meta.areas
    .map((a) => `<option value="${a.code}">${a.name}</option>`)
    .join("");
}

function labelFor(classificationLabel) {
  return classificationLabel === "hardware_defect" ? "Hardware Defect" : "Personal Dissatisfaction";
}

function renderClassification(classification) {
  const badgeClass =
    classification.label === "hardware_defect" ? "badge-defect" : "badge-dissatisfaction";
  const pct = Math.round(classification.confidence * 100);
  return `
    <div class="card">
      <p class="row-title">Classification</p>
      <span class="badge ${badgeClass}">${labelFor(classification.label)}</span>
      <p class="row-reason" style="margin-top:8px;">Confidence: ${pct}%</p>
    </div>
  `;
}

function renderDefectStub(defectBranch) {
  return `
    <div class="card stub-card">
      <p class="row-title">Hardware Defect Handling</p>
      <p class="row-reason">${defectBranch.message}</p>
    </div>
  `;
}

function renderDissatisfaction(branch) {
  const { demand, climate, decision } = branch;

  const decisionClass = decision.route === "local_warehouse" ? "local-warehouse" : "central-hub";
  const routeLabel = decision.route === "local_warehouse" ? "Local Warehouse" : "Central Hub";

  return `
    <div class="card">
      <div class="section-block">
        <p class="row-title">Recent Demand</p>
        <div class="chart-wrap"><canvas id="demand-chart" height="140"></canvas></div>
        <p class="chart-caption">
          Recent avg ${demand.recent_avg}/mo vs prior avg ${demand.prior_avg}/mo
          &mdash; Demand: <span class="yesno ${demand.has_demand ? "yes" : "no"}">${
            demand.has_demand ? "Yes" : "No"
          }</span>
        </p>
        <p class="row-reason" style="margin-top:6px;">${demand.reason}</p>
      </div>

      <div class="section-block">
        <p class="row-title">Climate Fit</p>
        <p class="row-reason">
          Area climate zone: <strong>${climate.area_climate_zone}</strong> &middot;
          Suited climates: <strong>${climate.category_suited_climates.join(", ")}</strong> &middot;
          Fit: <span class="yesno ${climate.is_climate_fit ? "yes" : "no"}">${
            climate.is_climate_fit ? "Yes" : "No"
          }</span>
        </p>
        <p class="row-reason" style="margin-top:6px;">${climate.reason}</p>
      </div>

      <div class="decision-banner ${decisionClass}">
        <p class="route-label">Decision: ${routeLabel}</p>
        <p>${decision.reason}</p>
      </div>
    </div>
  `;
}

function drawDemandChart(demand) {
  const canvas = document.getElementById("demand-chart");
  if (!canvas) return;

  if (demandChart) {
    demandChart.destroy();
    demandChart = null;
  }

  const seriesColor = cssVar("--series-1");
  const textSecondary = cssVar("--text-secondary");
  const gridline = cssVar("--gridline");

  demandChart = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: demand.months,
      datasets: [
        {
          label: "Purchases",
          data: demand.counts,
          backgroundColor: seriesColor,
          borderRadius: 4,
          maxBarThickness: 36,
        },
      ],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: textSecondary },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { color: textSecondary },
          grid: { color: gridline },
        },
      },
    },
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const res = await fetch("/api/process-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        review_text: reviewText.value,
        category_code: categorySelect.value,
        area_code: areaSelect.value,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      throw new Error(errBody?.detail?.[0]?.msg || `Request failed (${res.status})`);
    }

    const data = await res.json();

    let html = renderClassification(data.classification);
    if (data.defect_branch) {
      html += renderDefectStub(data.defect_branch);
    } else if (data.dissatisfaction_branch) {
      html += renderDissatisfaction(data.dissatisfaction_branch);
    }

    results.innerHTML = html;
    results.hidden = false;

    if (data.dissatisfaction_branch) {
      drawDemandChart(data.dissatisfaction_branch.demand);
    }
  } catch (err) {
    formError.textContent = err.message || "Something went wrong.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Process Return";
  }
});

loadMeta();
