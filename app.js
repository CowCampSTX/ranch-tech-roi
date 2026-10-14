// Page wiring for Ranch Tech ROI: inputs -> roi.js -> tiles, charts, tables and the written-out formulas.
import { FIELDS, PRESETS, analyze, tornado, breakEven, grid } from "./roi.js";

const $ = (id) => document.getElementById(id);
const LABEL = Object.fromEntries(FIELDS.map(([, k, label, unit]) => [k, { label, unit }]));
const money = (x) => {
  const sign = x < 0 ? "−" : "";
  const a = Math.abs(x);
  return sign + "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? Math.round(a / 1e3) + "k" : Math.round(a).toLocaleString());
};
const full = (x) => (x < 0 ? "−$" : "$") + Math.round(Math.abs(x)).toLocaleString();
const num = (x) => (Math.round(x * 100) / 100).toLocaleString();
const dollars = (x) => "$" + (Number.isInteger(Math.round(x * 100) / 100) ? num(x) : x.toFixed(2));
// "12 months" for a one-year analysis, "5 years" otherwise; payback under a year reads in months.
const span = (y) => (y === 1 ? "12 months" : `${y} years`);
const pbText = (x, unit = "yrs") => (x < 1 ? `${Math.max(1, Math.round(x * 12))} months` : `${x.toFixed(1)} ${unit}`);
const unitVal = (k, v) => {
  const u = LABEL[k].unit;
  if (u.startsWith("$")) return dollars(v) + u.slice(1);
  if (u.startsWith("%")) return num(v) + u;
  return num(v) + " " + u;
};

let preset = Object.keys(PRESETS)[0];
let p = { ...PRESETS[preset] };

// ---------------------------------------------------------------- state in the link
function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.has("preset") && PRESETS[q.get("preset")]) { preset = q.get("preset"); p = { ...PRESETS[preset] }; }
  for (const [, k] of FIELDS) if (q.has(k) && !isNaN(+q.get(k))) p[k] = +q.get(k);
}
function writeHash() {
  const q = new URLSearchParams({ preset });
  for (const [, k] of FIELDS) if (p[k] !== PRESETS[preset][k]) q.set(k, p[k]);
  history.replaceState(null, "", "#" + q.toString());
}

// ---------------------------------------------------------------- inputs
function buildInputs() {
  $("preset").innerHTML = Object.keys(PRESETS).map((n) => `<option${n === preset ? " selected" : ""}>${n}</option>`).join("");
  let html = "", group = "";
  for (const [g, k, label, unit, step] of FIELDS) {
    if (g !== group) { html += `<h3>${g}</h3>`; group = g; }
    html += `<div class="row"><label for="f-${k}">${label}<small>${unit}</small></label>
      <input type="number" id="f-${k}" data-k="${k}" step="${step}" min="0" value="${p[k]}"></div>`;
  }
  $("fields").innerHTML = html;
}
$("fields").addEventListener("input", (e) => {
  const k = e.target.dataset.k;
  if (!k || e.target.value === "" || isNaN(+e.target.value)) return;
  p[k] = Math.max(0, +e.target.value);
  render();
});
$("preset").addEventListener("change", (e) => { preset = e.target.value; p = { ...PRESETS[preset] }; buildInputs(); render(); });
$("reset").addEventListener("click", () => { p = { ...PRESETS[preset] }; buildInputs(); render(); });
$("copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(location.href); $("copy").textContent = "Link copied"; }
  catch { $("copy").textContent = "Copy the address bar"; }
  setTimeout(() => ($("copy").textContent = "Copy link to this scenario"), 1800);
});

// ---------------------------------------------------------------- tooltip
const tip = $("tip");
function showTip(e, html) {
  tip.innerHTML = html; tip.style.display = "block";
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = x + "px"; tip.style.top = e.clientY + 14 + "px";
}
const hideTip = () => (tip.style.display = "none");
function hover(el, html) {
  el.addEventListener("pointermove", (e) => showTip(e, html));
  el.addEventListener("pointerleave", hideTip);
}

// ---------------------------------------------------------------- scales
function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
const NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent && parent.appendChild(el);
  return el;
}

// ---------------------------------------------------------------- charts
function cumulativeChart(a) {
  const W = 760, H = 260, m = { l: 64, r: 36, t: 12, b: 32 };
  const rows = a.rows;
  const ticks = niceTicks(Math.min(0, ...rows.map((r) => r.cumulative)), Math.max(0, ...rows.map((r) => r.cumulative)));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x = (i) => m.l + (i / Math.max(1, rows.length - 1)) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cumulative cash position by year" });
  for (const t of ticks) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: t === 0 ? "var(--axis)" : "var(--grid)", "stroke-width": t === 0 ? 1.5 : 1 }, svg);
    svgEl("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = money(t);
  }
  rows.forEach((r, i) => (svgEl("text", { x: x(i), y: H - 10, "text-anchor": "middle" }, svg).textContent = "Year " + r.year));
  svgEl("path", { d: rows.map((r, i) => `${i ? "L" : "M"}${x(i)},${y(r.cumulative)}`).join(""), fill: "none", stroke: "var(--s1)", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
  if (a.payback !== null) {
    const px = m.l + (a.payback / Math.max(1, rows.length - 1)) * (W - m.l - m.r);
    svgEl("line", { x1: px, x2: px, y1: m.t, y2: H - m.b, stroke: "var(--muted)", "stroke-dasharray": "3 4" }, svg);
    svgEl("text", { x: px + 6, y: m.t + 12, class: "lbl" }, svg).textContent = `Pays back in ${pbText(a.payback)}`;
  }
  rows.forEach((r, i) => {
    svgEl("circle", { cx: x(i), cy: y(r.cumulative), r: 4.5, fill: "var(--s1)", stroke: "var(--surface)", "stroke-width": 2 }, svg);
    const hit = svgEl("rect", { x: x(i) - 24, y: m.t, width: 48, height: H - m.t - m.b, fill: "transparent" }, svg);
    hover(hit, `<b>Year ${r.year}</b><br>Cost ${full(r.cost)}<br>Benefit ${full(r.benefit)}<br>Net ${full(r.net)}<br>Cumulative <b>${full(r.cumulative)}</b>`);
  });
  const last = rows[rows.length - 1];
  svgEl("text", { x: x(rows.length - 1) - 6, y: y(last.cumulative) - 10, "text-anchor": "end", class: "lbl" }, svg).textContent = money(last.cumulative);
  $("cumChart").replaceChildren(svg);
}

function tornadoChart(t) {
  const rows = t.slice(0, 8);
  const W = 760, rowH = 30, m = { l: 230, r: 16, t: 8, b: 30 }, H = m.t + m.b + rows.length * rowH;
  const vals = rows.flatMap((r) => [r.low, r.high, r.base]);
  const ticks = niceTicks(Math.min(...vals, 0), Math.max(...vals, 0));
  const x0 = ticks[0], x1 = ticks[ticks.length - 1];
  const x = (v) => m.l + ((v - x0) / (x1 - x0)) * (W - m.l - m.r);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Net present value with each input moved 20% down and up" });
  for (const tk of ticks) {
    svgEl("line", { x1: x(tk), x2: x(tk), y1: m.t, y2: H - m.b, stroke: tk === 0 ? "var(--axis)" : "var(--grid)" }, svg);
    svgEl("text", { x: x(tk), y: H - 10, "text-anchor": "middle" }, svg).textContent = money(tk);
  }
  rows.forEach((r, i) => {
    const cy = m.t + i * rowH + rowH / 2;
    svgEl("text", { x: m.l - 10, y: cy + 4, "text-anchor": "end", class: "lbl" }, svg).textContent = LABEL[r.key].label;
    for (const [v, color] of [[r.low, "var(--s1)"], [r.high, "var(--s2)"]]) {
      const a = Math.min(x(v), x(r.base)), w = Math.max(1, Math.abs(x(v) - x(r.base)));
      svgEl("rect", { x: a, y: cy - 9, width: w, height: 18, rx: 3, fill: color }, svg);
    }
    const hit = svgEl("rect", { x: m.l, y: cy - rowH / 2, width: W - m.l - m.r, height: rowH, fill: "transparent" }, svg);
    hover(hit, `<b>${LABEL[r.key].label}</b> (now ${unitVal(r.key, p[r.key])})<br>20% lower: NPV ${full(r.low)}<br>20% higher: NPV ${full(r.high)}`);
  });
  const bx = x(rows[0]?.base ?? 0);
  svgEl("line", { x1: bx, x2: bx, y1: m.t - 4, y2: H - m.b, stroke: "var(--ink)", "stroke-width": 1.5 }, svg);
  $("tornado").replaceChildren(svg);

  $("breakeven").innerHTML = "<tr><th>Input</th><th>As entered</th><th>Break-even value</th><th>Room before it stops paying</th></tr>" +
    rows.slice(0, 6).map((r) => {
      const be = breakEven(p, r.key);
      let val = "", room = "";
      if (be.none === "positive") { val = "none"; room = "Pays at any value from 0 to 10×"; }
      else if (be.none === "negative") { val = "none"; room = "Doesn't pay at any value from 0 to 10×"; }
      else {
        val = unitVal(r.key, be.value);
        const change = (be.value - p[r.key]) / p[r.key];
        room = analyze(p).npv >= 0 ? `can move ${Math.abs(change * 100).toFixed(0)}% ${change < 0 ? "down" : "up"}`
                                   : `needs to move ${Math.abs(change * 100).toFixed(0)}% ${change < 0 ? "down" : "up"}`;
      }
      return `<tr><td>${LABEL[r.key].label}</td><td>${unitVal(r.key, p[r.key])}</td><td>${val}</td><td>${room}</td></tr>`;
    }).join("");
}

function twoWay(t) {
  const [a, b] = t.slice(0, 2).map((r) => r.key);
  if (!a || !b) { $("grid").innerHTML = ""; $("gridNote").textContent = ""; return; }
  const steps = [0.6, 0.8, 1, 1.2, 1.4];
  const rv = steps.map((s) => p[a] * s), cv = steps.map((s) => p[b] * s);
  const g = grid(p, a, rv, b, cv);
  const maxAbs = Math.max(...g.flat().map(Math.abs)) || 1;
  const bg = (v) => v >= 0 ? (v / maxAbs > 0.5 ? "var(--pos-2)" : "var(--pos-1)") : (-v / maxAbs > 0.5 ? "var(--neg-2)" : "var(--neg-1)");
  $("gridNote").textContent = `NPV for the two inputs that matter most, ${LABEL[a].label.toLowerCase()} (rows) and ${LABEL[b].label.toLowerCase()} (columns), from 40% below to 40% above what you entered. Blue cells pay; red cells don't. The outlined cell is your scenario.`;
  $("grid").innerHTML = `<tr><th>${LABEL[a].label} ↓ / ${LABEL[b].label} →</th>${cv.map((v) => `<th>${unitVal(b, v)}</th>`).join("")}</tr>` +
    g.map((row, i) => `<tr><th>${unitVal(a, rv[i])}</th>${row.map((v, j) =>
      `<td class="cell" style="background:${bg(v)};${i === 2 && j === 2 ? "outline:2px solid var(--ink);outline-offset:-2px;font-weight:600" : ""}">${money(v)}</td>`).join("")}</tr>`).join("");
}

// ---------------------------------------------------------------- tiles, tables, formulas
function tiles(a) {
  const tile = (k, v, d) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  $("tiles").innerHTML =
    tile("Net present value", `<span class="${a.npv < 0 ? "neg" : ""}">${money(a.npv)}</span>`, `at ${p.discountRate}% over ${span(p.years)}`) +
    tile("Payback", a.payback === null ? "None" : pbText(a.payback), a.payback === null ? `cash stays negative for all ${span(p.years)}` : "until cumulative cash turns positive") +
    tile("Internal rate of return", a.irr === null ? "n/a" : (a.irr * 100).toFixed(0) + "%", "the rate where NPV is zero") +
    tile("Return on cost", a.roi === null ? "n/a" : (a.roi * 100).toFixed(0) + "%", "(benefits − costs) ÷ costs") +
    tile("All-in cost", a.costPerHeadYear === null ? "n/a" : "$" + a.costPerHeadYear.toFixed(2), "per head per year");
  const good = a.npv >= 0;
  const top = tornado(p)[0];
  $("verdict").innerHTML = `At these numbers, ${preset.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase())} <b class="${good ? "good" : "bad"}">${good ? "pays for itself" : "does not pay for itself"}</b>` +
    ` over ${span(p.years)}${good && a.payback !== null ? `, with payback in ${pbText(a.payback, "years")}` : ""}.` +
    (top ? ` The answer depends most on <b>${LABEL[top.key].label.toLowerCase()}</b>.` : "");
}

function cashTable(a) {
  $("cashTable").innerHTML = "<tr><th>Year</th><th>Cost</th><th>Benefit</th><th>Net</th><th>Cumulative</th><th>Discounted net</th></tr>" +
    a.rows.map((r) => `<tr><td>${r.year}</td><td>${full(r.cost)}</td><td>${full(r.benefit)}</td>
      <td class="${r.net < 0 ? "neg" : ""}">${full(r.net)}</td><td class="${r.cumulative < 0 ? "neg" : ""}">${full(r.cumulative)}</td>
      <td>${full(r.net / (1 + p.discountRate / 100) ** r.year)}</td></tr>`).join("");
}

// ---------------------------------------------------------------- 5-year outlook
// Whatever "Years analyzed" says, this section runs the same inputs over 5 years and reports each 12-month period.
// The purchase is counted in months 1-12, so each row is what that year actually did to the bank account.
const OUTLOOK_YEARS = 5;
function fiveYear() {
  const a5 = analyze({ ...p, years: OUTLOOK_YEARS });
  const [buy, ...ops] = a5.rows;
  const periods = ops.map((r, i) => {
    const cost = r.cost + (i === 0 ? buy.cost : 0);
    return { year: r.year, cost, benefit: r.benefit, net: r.benefit - cost, cumulative: r.cumulative };
  });
  const tile = (k, v, d) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  const signed = (x) => `<span class="${x < 0 ? "neg" : "pos"}">${x > 0 ? "+" : ""}${money(x)}</span>`;
  const last = periods[periods.length - 1];
  $("fiveNote").textContent = `The same inputs carried out to ${OUTLOOK_YEARS} years, one row per 12 months. ` +
    `Year 1 includes the ${full(a5.upfront)} purchase and counts ${num(Math.min(100, p.year1Realized))}% of the full benefit while the crew learns the system.`;
  $("fiveTiles").innerHTML =
    tile("5-year return on cost", a5.roi === null ? "n/a" : `<span class="${a5.roi < 0 ? "neg" : "pos"}">${(a5.roi * 100).toFixed(0)}%</span>`, "(benefits − costs) ÷ costs over 5 years") +
    tile("5-year gain or loss", signed(last.cumulative), "total benefit minus total cost") +
    tile("5-year net present value", signed(a5.npv), `at ${p.discountRate}% a year`) +
    tile("Payback", a5.payback === null ? "Not in 5 years" : pbText(a5.payback), a5.payback === null ? "cash stays negative" : "until cumulative cash turns positive");
  fiveChart(periods);
  $("fiveTable").innerHTML = "<tr><th>12-month period</th><th>Cost</th><th>Benefit</th><th>Gain or loss</th><th>Change from prior year</th><th>Running total</th></tr>" +
    periods.map((r, i) => `<tr><td>Year ${r.year} <span class="note">(months ${i * 12 + 1}–${i * 12 + 12})</span></td>
      <td>${full(r.cost)}</td><td>${full(r.benefit)}</td>
      <td class="${r.net < 0 ? "neg" : "pos"}">${r.net > 0 ? "+" : ""}${full(r.net)}</td>
      <td>${i ? (r.net - periods[i - 1].net > 0 ? "+" : "") + full(r.net - periods[i - 1].net) : "—"}</td>
      <td class="${r.cumulative < 0 ? "neg" : "pos"}">${full(r.cumulative)}</td></tr>`).join("");
}

function fiveChart(periods) {
  const W = 760, H = 220, m = { l: 64, r: 16, t: 16, b: 32 };
  const ticks = niceTicks(Math.min(0, ...periods.map((r) => r.net)), Math.max(0, ...periods.map((r) => r.net)), 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / periods.length, bw = Math.min(64, band * 0.55);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Gain or loss for each 12-month period over 5 years" });
  for (const t of ticks) {
    svgEl("line", { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: t === 0 ? "var(--axis)" : "var(--grid)", "stroke-width": t === 0 ? 1.5 : 1 }, svg);
    svgEl("text", { x: m.l - 8, y: y(t) + 4, "text-anchor": "end" }, svg).textContent = money(t);
  }
  periods.forEach((r, i) => {
    const cx = m.l + band * (i + 0.5), top = y(Math.max(0, r.net)), h = Math.max(1, Math.abs(y(r.net) - y(0)));
    const bar = svgEl("rect", { x: cx - bw / 2, y: top, width: bw, height: h, rx: 3, fill: r.net < 0 ? "var(--bad)" : "var(--good)" }, svg);
    hover(bar, `<b>Year ${r.year}</b> (months ${i * 12 + 1}–${i * 12 + 12})<br>Cost ${full(r.cost)}<br>Benefit ${full(r.benefit)}<br>Gain or loss <b>${full(r.net)}</b><br>Running total ${full(r.cumulative)}`);
    svgEl("text", { x: cx, y: r.net < 0 ? y(0) - 6 : top - 5, "text-anchor": "middle", class: "lbl" }, svg).textContent = money(r.net);
    svgEl("text", { x: cx, y: H - 10, "text-anchor": "middle" }, svg).textContent = "Year " + r.year;
  });
  $("fiveChart").replaceChildren(svg);
}

function formulas(a) {
  const hw = p.head * p.hardwarePerHead, b = a.fullBenefit;
  const line = (name, expr, val) => `<p class="formula">${name} = ${expr} = <b>${full(val)}</b></p>`;
  $("formulas").innerHTML =
    `<h3>Upfront (year 0)</h3>` +
    line("Hardware", `${num(p.head)} head × $${num(p.hardwarePerHead)}`, hw) +
    line("Upfront cost", `hardware ${full(hw)} + setup ${full(p.fixedCost)}`, a.upfront) +
    `<h3>Running cost (each year)</h3>` +
    line("Subscription", `${num(p.head)} head × $${num(p.subscriptionPerHead)}`, p.head * p.subscriptionPerHead) +
    line("Repairs", `${full(hw)} × ${num(p.maintenancePct)}%`, hw * p.maintenancePct / 100) +
    line("Replacements", `${full(hw)} × ${num(p.replacementPct)}%`, hw * p.replacementPct / 100) +
    line("Running cost", "subscription + repairs + replacements", a.yearlyCost) +
    `<h3>Benefit (each full year)</h3>` +
    line("Labor", `${num(p.laborHoursPerWeek)} hrs × 52 weeks × $${num(p.wage)}`, b.labor) +
    line("Death loss avoided", `${num(p.head)} head × ${num(p.deathLossPts)}% × $${num(p.valuePerHead)}`, b.deathLoss) +
    line("Extra weight sold", `${num(p.head)} head × ${num(p.gainLbsPerHead)} lbs × ${dollars(p.pricePerLb)}`, b.gain) +
    line("Other savings", "as entered", b.other) +
    line("Full-year benefit", "labor + death loss + weight + other", a.benefitTotal) +
    `<p class="note">Year 1 counts ${num(Math.min(100, p.year1Realized))}% of the full-year benefit while the crew learns the system; later years count all of it.</p>` +
    `<h3>Results</h3>` +
    `<p class="formula">Net cash each year = benefit − cost (year 0: − upfront cost)</p>` +
    `<p class="formula">NPV = Σ net<sub>t</sub> ÷ (1 + ${num(p.discountRate)}%)<sup>t</sup>, t = 0…${p.years} = <b>${full(a.npv)}</b></p>` +
    `<p class="formula">IRR = the discount rate that makes NPV = 0 = <b>${a.irr === null ? "n/a" : (a.irr * 100).toFixed(1) + "%"}</b></p>` +
    `<p class="formula">Payback = years until cumulative net cash ≥ 0, interpolated within the year = <b>${a.payback === null ? "not within " + span(p.years) : a.payback.toFixed(2) + " years"}</b></p>` +
    `<p class="formula">Return on cost = (total benefit ${full(a.totalBenefit)} − total cost ${full(a.totalCost)}) ÷ total cost = <b>${a.roi === null ? "n/a" : (a.roi * 100).toFixed(1) + "%"}</b></p>` +
    `<p class="note">Not included: taxes and depreciation, financing, resale value of the hardware at the end, and price changes over time. Add them by adjusting the inputs, for example a lower hardware cost to reflect resale.</p>`;
}

function render() {
  const a = analyze(p), t = tornado(p);
  tiles(a); fiveYear(); cumulativeChart(a); tornadoChart(t); twoWay(t); cashTable(a); formulas(a);
  writeHash();
}

readHash();
buildInputs();
render();
