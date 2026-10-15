// Ranch technology ROI engine (phase 1). Pure functions, no dependencies. The rules are those of
// docs/audit/phase1-spec.md: the data model in 9.2 and the formulas in 9.3. Phase 1 builds this engine in steps
// (9.1); until step 6 the page keeps running on today's model, in v1.js.
// Money is in today's US dollars, before tax; the discount rate is real. Years run t = 0..T.
// Built so far: cost lines with the capital scheduler, billing and commitments (F5), and labor (F1).
// Still to come: head-based quantities and the cattle-presence rule (F3), pools (F9), the IRR and payback states and
// the other metrics (F8), who pays and who receives (F6), production and risk inputs (F4, F7), ramp (B3) and modules.

const blank = (v) => v === null || v === undefined || v === "";
const num = (v) => (blank(v) ? 0 : v);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const zeros = (T) => Array(T + 1).fill(0);

/** Entry t of a per-year input: a number holds in every year; a shorter array carries its last value forward (9.2). */
export function at(v, t) {
  if (!Array.isArray(v)) return v;
  return v.length ? v[Math.min(t, v.length - 1)] : undefined;
}

export function npv(rate, nets) {
  return nets.reduce((s, cf, t) => s + cf / (1 + rate) ** t, 0);
}

/** Internal rate of return by bisection; null when the search finds no sign change. The states of 9.3 come with F8. */
export function irr(nets) {
  let lo = -0.99, hi = 10;
  const f = (r) => npv(r, nets);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Years until cumulative net cash turns positive, interpolated within the year; null if never (F8 adds the states). */
export function payback(nets) {
  let cum = nets[0];
  for (let t = 1; t < nets.length; t++) {
    const before = cum;
    cum += nets[t];
    if (cum >= 0) return t - 1 + -before / nets[t];
  }
  return null;
}

// ---------------------------------------------------------------- cost lines (F5)

/** A stored cost line's quantity in year t: fixed is 1, perDevice its qty. The head-based bases come with F3. */
function quantity(line, t) {
  if (line.basis === "fixed") return 1;
  if (line.basis === "perDevice") return num(at(line.qty, t));
  throw new Error(`Cost line ${line.id}: basis "${line.basis}" is not supported yet`);
}

/** The billing of an annual line: as entered, else (blank) in advance for subscriptions and service fees (9.2). */
export function billingOf(line) {
  if (!blank(line.billing)) return line.billing;
  return line.id === "subscription" || line.id === "serviceFee" ? "advance" : "arrears";
}

/**
 * Capital scheduler (9.3). The initial cohort is bought in the start year s; each later rise in quantity is a new
 * cohort, counted against the largest quantity so far, or against the year before for a perAnimal line. A cohort
 * first bought in b0 is bought again at b0 + n·L while that is before T. Repairs fall in each purchase's service
 * years, and the residual at T comes from the last purchase of each cohort.
 * Returns { cost, residual, purchases: [{year, qty, unitCost}], lastCost, blankPrice } with cost and residual by year;
 * blankPrice is true when a purchase is priced blank ("Quote required", counted as 0).
 */
export function scheduleCapital(line, T, s) {
  const life = blank(line.lifeYears) ? null : line.lifeYears;
  const q = (t) => quantity(line, t);
  const price = (t) => num(at(line.unitCost, t));
  let blankPrice = false;
  const cohorts = [];
  if (s < T && q(s) > 0) cohorts.push({ first: s, qty: q(s) });
  let peak = s < T ? q(s) : 0;
  for (let t = s + 1; t < T; t++) {
    const rise = line.perAnimal ? q(t) - q(t - 1) : q(t) - peak;
    if (rise > 0) cohorts.push({ first: t, qty: rise });
    peak = Math.max(peak, q(t));
  }

  const mode = blank(line.residual?.mode) ? (life === null ? "none" : "straightLine") : line.residual.mode;
  const cost = zeros(T), residual = zeros(T), purchases = [];
  let lastCost = 0; // Σ unitCost × cohort qty over the last purchase of every cohort: the base of a residual
  for (const c of cohorts) {
    let last = null;
    for (let b = c.first; b < T; b = life === null ? T : b + life) {
      const unitCost = price(b), amount = unitCost * c.qty;
      if (blank(at(line.unitCost, b))) blankPrice = true;
      purchases.push({ year: b, qty: c.qty, unitCost });
      cost[b] += amount;
      const end = life === null ? T : Math.min(b + life, T);
      for (let y = b + 1; y <= end; y++) cost[y] += num(line.repairPct) * amount;
      last = { year: b, amount };
    }
    lastCost += last.amount;
    if (mode === "straightLine" && life !== null) {
      residual[T] += last.amount * Math.min(1, Math.max(0, (last.year + life - T) / life));
    } else if (mode === "pctOfCost") {
      residual[T] += num(line.residual.pct) * last.amount;
    }
  }
  if (mode === "amount") residual[T] += num(line.residual.dollars);
  purchases.sort((x, y) => x.year - y.year);
  return { cost, residual, purchases, lastCost, blankPrice };
}

/**
 * Annual line (9.3 Timing and Commitments). Season t, for t = s+1..T, is billed in year t − 1 in advance and in
 * year t in arrears, at the price and quantity of season t. Inside the commitment (seasons s+1..s+commitYears) the
 * billed quantity is at least minQty. A commitment that runs past T charges its early-termination fee in year T.
 * Returns { cost, residual, commitPastHorizon, blankPrice } with cost by year (an annual line has no residual);
 * blankPrice is true when a season with a quantity billed is priced blank ("Quote required", counted as 0).
 */
export function billAnnual(line, T, s) {
  const cost = zeros(T);
  const advance = billingOf(line) === "advance";
  const commitYears = num(line.commitYears), minQty = num(line.minQty);
  let blankPrice = false;
  for (let t = s + 1; t <= T; t++) {
    const qty = quantity(line, t);
    const billedQty = t <= s + commitYears ? Math.max(qty, minQty) : qty;
    if (billedQty > 0 && blank(at(line.unitCost, t))) blankPrice = true;
    cost[advance ? t - 1 : t] += num(at(line.unitCost, t)) * billedQty;
  }
  const commitPastHorizon = commitYears > 0 && s + commitYears > T;
  if (commitPastHorizon) cost[T] += num(line.earlyTerminationFee);
  return { cost, residual: zeros(T), commitPastHorizon, blankPrice };
}

// ---------------------------------------------------------------- labor (F1)

const LABOR_CUT_LABEL = { water: "Hired labor cut", vf: "Hired moving and gathering hours cut", eid: "Hired labor cut" };
// The input labor.cut.unitsCut takes its B9 driver's label where it has one, else its description (9.4 intro).
const UNITS_CUT_LABEL = { water: "Hired labor cut", vf: "Hired moving and gathering hours cut", eid: "Paid hours cut at the chute" };

/** Paid hours in one unit of the labor cut: 1 for an hour, the entered hours for a day, week or position. */
const hoursPerUnit = (cut) => (cut.laborUnit === "hour" ? 1 : num(cut.hoursPerUnit));

/** Cash saved per unit cut (9.3 Labor): a position's salary, otherwise its paid hours at the pay rate; with payroll load. */
function cutValuePerUnit(cut) {
  const pay = cut.laborUnit === "position" ? num(cut.salary) : hoursPerUnit(cut) * num(cut.paidRate);
  return pay * (1 + num(cut.loadPct));
}

/**
 * Hours of a labor.added item in year t (9.3 Timing). An array gives the hours of each year from the module's start
 * year s (entry s, such as install, falls in year s); a single number is hours a year, in years s+1..T.
 */
export function addedHours(hours, t, s, T) {
  if (t > T) return 0;
  if (Array.isArray(hours)) return t >= s ? num(at(hours, t)) : 0;
  return t > s ? num(hours) : 0;
}

/** True only once the user answers that freed time replaces paid work; until then it is "absorbed" (9.2). */
const replacesPaidWork = (labor) => labor?.freedTimeUse === "replacesPaidWork";

/** Hours saved in year t by the "hours" lines, before any later step's factors: claim × hoursPerUnit (default 1). */
const hoursFrom = (lines, t, ctx) => sum(lines.map((l) => l.claim(t, ctx) * (l.hoursPerUnit ?? 1)));

// ---------------------------------------------------------------- lines and analysis

/**
 * The analysis's lines (9.2): its stored cost lines, then the labor lines derived from a.labor with their fixed ids
 * (added:<i> for each paid added item, laborCut, avoidedHire), the hours saved that no module input covers
 * (otherHoursSaved, kind "hours"), and the capacity line hoursFreed.
 * A cost line is either stored ({timing, basis, unitCost, qty, ...}) or derived ({flow: (t, ctx) => $}).
 * A benefit line has claim(t, ctx) and valuePerUnit(t, ctx) and counts in the module's operating years s+1..T
 * (hoursFreed also in year s, where unpaid setup hours fall). A line of kind "hours" adds claim(t, ctx) × hoursPerUnit
 * (default 1) to the hours saved in the operating years; `eligible: false` keeps it from supporting paid hours cut.
 */
export function buildLines(a) {
  const s = a.startYear ?? 0, T = a.settings.T;
  const lines = Object.entries(a.costs ?? {}).map(([id, c]) => ({ ...c, id, kind: "cost" }));
  const L = a.labor;
  if (L) {
    (L.added ?? []).forEach((item, i) => {
      if (item.doneBy !== "paid") return;
      const rate = num(item.paidRate) * (1 + num(item.loadPct));
      lines.push({ id: `added:${i}`, label: item.label, kind: "cost", flow: (t) => addedHours(item.hours, t, s, T) * rate });
    });
    if (L.cut) {
      lines.push({
        id: "laborCut", label: LABOR_CUT_LABEL[a.module] ?? "Hired labor cut", kind: "cash",
        claim: (t, ctx) => ctx.unitsCut[t], valuePerUnit: () => cutValuePerUnit(L.cut),
      });
    }
    const hire = L.avoidedHire;
    if (hire && num(hire.years) > 0) {
      const first = hire.startYear, lastYear = Math.min(hire.startYear + hire.years - 1, T);
      lines.push({
        id: "avoidedHire", label: "Avoided hire", kind: "cash",
        claim: (t) => (t >= first && t <= lastYear ? 1 : 0),
        valuePerUnit: () => num(hire.salary) * (1 + num(hire.loadPct)),
      });
    }
    if (!blank(L.otherHoursSaved)) {
      lines.push({ id: "otherHoursSaved", label: "Other hours saved", kind: "hours", claim: (t) => num(at(L.otherHoursSaved, t)) });
    }
  }
  lines.push({
    id: "hoursFreed", label: "Hours freed", kind: "capacity", fromStartYear: true,
    claim: (t, ctx) => ctx.hoursFreed[t], valuePerUnit: () => num(a.settings.oppCostPerHour),
  });
  return lines;
}

/**
 * Runs the analysis on the given lines (buildLines(a), plus any test fixtures). Assumes validate(a) found no errors.
 * Returns the series by year (C cost, B cash benefit, R residual, X expected losses avoided, K capacity value,
 * P production, N = B + R − C), their present values, cash NPV, BCR, IRR and payback on N, the labor hours by year,
 * each line's series and PV, and notices for the page.
 */
export function analyzeLines(a, lines) {
  const T = a.settings.T, rate = a.settings.discountRate, s = a.startYear ?? 0;
  const years = [...Array(T + 1).keys()];
  const operating = (t) => t > s && t <= T;
  const ctx = { a, T, s };

  // Labor hours (9.3 Labor): hours saved and paid hours cut at year end in the operating years; added hours as worked.
  const hourLines = lines.filter((l) => l.kind === "hours");
  ctx.hoursSaved = years.map((t) => (operating(t) ? hoursFrom(hourLines, t, ctx) : 0));
  const labor = a.labor ?? {}, cut = labor.cut;
  ctx.unitsCut = years.map((t) => (cut && replacesPaidWork(labor) && operating(t) ? num(at(cut.unitsCut, t)) : 0));
  ctx.paidHoursCut = ctx.unitsCut.map((u) => (u ? u * hoursPerUnit(cut) : 0));
  const addedBy = (paid) => years.map((t) => sum((labor.added ?? [])
    .filter((item) => (item.doneBy === "paid") === paid).map((item) => addedHours(item.hours, t, s, T))));
  ctx.paidHoursAdded = addedBy(true);
  ctx.unpaidHoursAdded = addedBy(false);
  ctx.hoursFreed = years.map((t) => ctx.hoursSaved[t] - ctx.paidHoursCut[t] - ctx.unpaidHoursAdded[t]);

  const series = { C: zeros(T), B: zeros(T), R: zeros(T), X: zeros(T), K: zeros(T), P: zeros(T) };
  const BY_KIND = { cash: "B", risk: "X", capacity: "K", production: "P" };
  const out = [], notices = [];
  for (const line of lines) {
    const base = { id: line.id, label: line.label, kind: line.kind };
    if (line.kind === "hours") {
      out.push({ ...base, hours: years.map((t) => (operating(t) ? hoursFrom([line], t, ctx) : 0)) });
    } else if (line.kind === "cost") {
      let flows;
      if (line.flow) flows = { cost: years.map((t) => line.flow(t, ctx)), residual: zeros(T) };
      else {
        const ls = blank(line.startYear) ? s : line.startYear;
        flows = line.timing === "capital" ? scheduleCapital(line, T, ls) : billAnnual(line, T, ls);
        // A blank price is listed only where it is used: a line whose quantity is 0 in every year changes nothing (9.5 item 7).
        if (flows.blankPrice) notices.push({ type: "quoteRequired", lineId: line.id });
        if (flows.commitPastHorizon) {
          notices.push({ type: "commitPastHorizon", lineId: line.id, horizon: T, commitYears: line.commitYears,
            fee: num(line.earlyTerminationFee) });
        }
      }
      flows.cost.forEach((x, t) => (series.C[t] += x));
      flows.residual.forEach((x, t) => (series.R[t] += x));
      out.push({ ...base, series: flows.cost, residual: flows.residual, purchases: flows.purchases,
        pv: npv(rate, flows.cost), pvResidual: npv(rate, flows.residual) });
    } else {
      const counts = (t) => operating(t) || (line.fromStartYear && t === s);
      const claims = years.map((t) => (counts(t) ? line.claim(t, ctx) : 0));
      const flow = claims.map((c, t) => (c ? c * line.valuePerUnit(t, ctx) : 0));
      flow.forEach((x, t) => (series[BY_KIND[line.kind]][t] += x));
      out.push({ ...base, claims, series: flow, pv: npv(rate, flow) });
    }
  }
  if (a.labor && !replacesPaidWork(a.labor)) notices.push({ type: "absorbed" });

  const { C, B, R, X, K, P } = series;
  const N = years.map((t) => B[t] + R[t] - C[t]);
  const pv = Object.fromEntries(Object.entries(series).map(([k, xs]) => [k, npv(rate, xs)]));
  return {
    T, rate, startYear: s, years, C, B, R, X, K, P, N, pv,
    cashNPV: npv(rate, N),
    bcr: pv.C ? (pv.B + pv.R) / pv.C : null,
    irr: irr(N),
    payback: payback(N),
    hours: { saved: ctx.hoursSaved, paidCut: ctx.paidHoursCut, paidAdded: ctx.paidHoursAdded,
      unpaidAdded: ctx.unpaidHoursAdded, freed: ctx.hoursFreed },
    lines: out,
    notices,
  };
}

export function analyze(a) {
  return analyzeLines(a, buildLines(a));
}

// ---------------------------------------------------------------- validation (9.2)

export const YEARS_MESSAGE = "Enter a whole number of years, 1 or more.";
const wholeYears = (v) => Number.isInteger(v) && v >= 1;
const yearIndex = (v) => Number.isInteger(v) && v >= 0;
const show = (x) => (Math.round(x * 100) / 100).toLocaleString("en-US");

/**
 * The 9.2 validation errors built so far: the horizon, start years, the F5 cost-line fields and the F1 labor fields.
 * Returns [{path, label, message}]: path is the input's path in the analysis, label its label on the page (9.4), and
 * message the text shown, which names the field unless it is the whole-years message. Nothing is computed while any
 * error remains. Later steps add their own rules (9.1). Trial values from the sensitivity features and the solver are
 * not checked by the whole-number rules (9.2); the solver clips its range by the paid-hours and residual rules (9.3, B9).
 */
export function validate(a) {
  const errors = [];
  const err = (path, label, message) => errors.push({ path, label, message });
  const T = a.settings?.T;
  const tOk = wholeYears(T);
  if (!tOk) err("settings.T", "Horizon", YEARS_MESSAGE);

  const s = a.startYear ?? 0;
  const startLabel = "The year the module starts";
  if (!yearIndex(s)) err("startYear", startLabel, `${startLabel}: enter a whole number, 0 or more.`);
  else if (tOk && s >= T) err("startYear", startLabel, `${startLabel}: must be before year ${T}, the end of the horizon.`);

  for (const [id, line] of Object.entries(a.costs ?? {})) {
    const p = `costs.${id}.`, name = line.label ?? id;
    if (!blank(line.startYear)) {
      if (!yearIndex(line.startYear)) err(p + "startYear", "Start year", `Start year (${name}): enter a whole number, 0 or more.`);
      else if (tOk && line.startYear >= T) {
        err(p + "startYear", "Start year", `Start year (${name}): must be before year ${T}, the end of the horizon.`);
      }
    }
    if (line.timing === "capital") {
      const lifeOk = blank(line.lifeYears) || wholeYears(line.lifeYears);
      if (!lifeOk) err(p + "lifeYears", "Life", YEARS_MESSAGE);
      const res = line.residual;
      if (res?.mode === "pctOfCost" && num(res.pct) > 1) {
        err(p + "residual", "Residual", `Residual (${name}): cannot be more than 100% of the purchase cost.`);
      }
      if (res?.mode === "amount" && tOk && lifeOk) {
        const ls = blank(line.startYear) ? s : line.startYear;
        const { lastCost } = scheduleCapital(line, T, ls);
        if (num(res.dollars) > lastCost + 1e-9) {
          err(p + "residual", "Residual",
            `Residual (${name}): $${show(num(res.dollars))} is more than the $${show(lastCost)} that the purchases it values cost.`);
        }
      }
    } else if (!blank(line.commitYears) && !yearIndex(line.commitYears)) {
      err(p + "commitYears", "Commit years", `Commit years (${name}): enter a whole number of years.`);
    }
  }

  if (a.labor) validateLabor(a, s, tOk ? T : null, err);
  return errors;
}

/** The F1 rules of 9.2. T is null when the horizon itself is invalid, which skips the checks that need it. */
function validateLabor(a, s, T, err) {
  const L = a.labor, cut = L.cut;
  const unitsLabel = UNITS_CUT_LABEL[a.module] ?? "Hired labor cut";
  const paid = replacesPaidWork(L);
  if (cut) {
    const unit = cut.laborUnit;
    const entries = Array.isArray(cut.unitsCut) ? cut.unitsCut : [cut.unitsCut];
    if (unit !== "hour" && entries.some((u) => !blank(u) && !Number.isInteger(u))) {
      err("labor.cut.unitsCut", unitsLabel, `${unitsLabel}: enter a whole number of ${unit}s, because they are paid whole.`);
    }
    if (paid && entries.some((u) => num(u) > 0)) {
      const why = `because the ${unitsLabel.toLowerCase()} needs it`;
      if (unit !== "hour" && !(num(cut.hoursPerUnit) > 0)) {
        err("labor.cut.hoursPerUnit", "Hours per unit", `Hours per unit: enter the paid hours in one ${unit}, ${why}.`);
      }
      if (unit === "position" && blank(cut.salary)) err("labor.cut.salary", "Salary", `Salary: enter it, ${why}.`);
      if (unit !== "position" && blank(cut.paidRate)) err("labor.cut.paidRate", "Pay rate", `Pay rate: enter it, ${why}.`);
      if (blank(cut.loadPct)) err("labor.cut.loadPct", "Payroll load", `Payroll load: enter it (0% if none), ${why}.`);
    }
  }

  const hire = L.avoidedHire;
  if (hire && !blank(hire.years)) {
    const why = "because the avoided hire needs it";
    if (!yearIndex(hire.years)) err("labor.avoidedHire.years", "Years", "Years (Avoided hire): enter a whole number of years.");
    else if (hire.years > 0) {
      if (!Number.isInteger(hire.startYear) || hire.startYear < s + 1) {
        err("labor.avoidedHire.startYear", "First year",
          `First year (Avoided hire): enter a whole number, year ${s + 1} or later, after the module starts.`);
      }
      if (blank(hire.salary)) err("labor.avoidedHire.salary", "Salary", `Salary (Avoided hire): enter it, ${why}.`);
      if (blank(hire.loadPct)) err("labor.avoidedHire.loadPct", "Payroll load", `Payroll load (Avoided hire): enter it (0% if none), ${why}.`);
    }
  }

  (L.added ?? []).forEach((item, i) => {
    const p = `labor.added.${i}.`, name = item.label ?? `added item ${i + 1}`;
    if (item.doneBy === "paid") {
      const why = "because a paid hand does these hours";
      if (blank(item.paidRate)) err(p + "paidRate", "Pay rate", `Pay rate (${name}): enter it, ${why}.`);
      if (blank(item.loadPct)) err(p + "loadPct", "Payroll load", `Payroll load (${name}): enter it (0% if none), ${why}.`);
    }
    if (Array.isArray(item.hours)) {
      const early = item.hours.findIndex((h, t) => t < s && num(h) > 0);
      if (early >= 0) err(p + "hours", "Hours", `Hours (${name}): year ${early} is before the module starts in year ${s}, so it cannot have hours.`);
    }
  });

  // Paid hours cut stay within the hours saved that can support them, taken before the ramp, the cattle-presence
  // rule and the pool scale (9.3 Labor). Not checked while "absorbed", when the cut counts as 0, nor while the cut
  // has no paid hours to compare (its hoursPerUnit error above).
  const comparable = cut && (cut.laborUnit === "hour" || num(cut.hoursPerUnit) > 0);
  if (paid && comparable && T !== null && yearIndex(s) && s < T) {
    const ctx = { a, T, s };
    const hourLines = buildLines(a).filter((l) => l.kind === "hours" && l.eligible !== false);
    for (let t = s + 1; t <= T; t++) {
      const paidCut = num(at(cut.unitsCut, t)) * hoursPerUnit(cut);
      const eligible = hoursFrom(hourLines, t, ctx);
      if (paidCut > eligible + 1e-9) {
        err("labor.cut.unitsCut", unitsLabel,
          `${unitsLabel}: the paid hours cut in year ${t} (${show(paidCut)} h) are more than the hours saved that can support them (${show(eligible)} h).`);
        break;
      }
    }
  }
}
