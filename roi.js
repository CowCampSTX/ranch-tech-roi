// Ranch technology ROI engine (phase 1). Pure functions, no dependencies. The rules are those of
// docs/audit/phase1-spec.md: the data model in 9.2 and the formulas in 9.3. Phase 1 builds this engine in steps
// (9.1); until step 6 the page keeps running on today's model, in v1.js.
// Money is in today's US dollars, before tax; the discount rate is real. Years run t = 0..T.
// Built so far: cost lines with the capital scheduler, billing and commitments (F5), labor (F1), pools with the
// single-module clamp and combine() (F9), and head-months, head-based quantities and the cattle-presence rule (F3).
// Still to come: the IRR and payback states and the other metrics (F8), production and risk inputs (F4, F7), who pays
// and who receives (F6), ramp (B3) and the modules.

const blank = (v) => v === null || v === undefined || v === "";
const num = (v) => (blank(v) ? 0 : v);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const zeros = (T) => Array(T + 1).fill(0);
const EPS = 1e-9;

/** Entry t of a per-year input: a number holds in every year; a shorter array carries its last value forward (9.2). */
export function at(v, t) {
  if (!Array.isArray(v)) return v;
  return v.length ? v[Math.min(t, v.length - 1)] : undefined;
}

// ---------------------------------------------------------------- herd (F3)

/** Class names as the page writes them (9.5 item 9). */
export const CLASS_NAMES = {
  cows: "cows", bulls: "bulls", replacementHeifers: "replacement heifers", calvesBorn: "calves",
  calvesSold: "calves sold", cullCowsSold: "cull cows sold", yearlings: "yearlings",
};
/** Sale flows drawn from other classes: never enrolled or served, never in head-months (9.2). */
const SALE_FLOWS = ["calvesSold", "cullCowsSold"];

/**
 * The module's cattle by year (9.3 Head-months and quantities). A virtual fence analysis (module "vf") counts its
 * enrolled head for the months enrolled; any other analysis counts the inventory head of its served classes for the
 * months served, 12 by default. head(c, t) is enrolled head for virtual fence and inventory head otherwise.
 * HM[t] sums hm(c, t) over the enrolled or served classes, never the sale flows.
 */
export function herdOf(a, T) {
  const enrolls = a.module === "vf";
  const listed = Object.keys((enrolls ? a.enrolled : a.served) ?? {}).filter((c) => !SALE_FLOWS.includes(c));
  const head = (c, t) => num(at((enrolls ? a.enrolled : a.classes)?.[c]?.head, t));
  const months = (c, t) => {
    const m = at((enrolls ? a.enrolled : a.served)?.[c]?.months, t);
    return blank(m) ? (enrolls ? 0 : 12) : m;
  };
  const hm = (c, t) => (listed.includes(c) ? head(c, t) * months(c, t) : 0);
  const HM = [...Array(T + 1).keys()].map((t) => sum(listed.map((c) => hm(c, t))));
  return { T, enrolls, listed, head, months, hm, HM };
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

/**
 * A cost line's quantity in year t (9.3): fixed 1; perDevice its qty, or the head of its classes when it lists any;
 * perHeadMonth the head-months of its classes; perHeadYear their head × 12. A capital line's head-based quantity in
 * year t is the head of season t + 1, which the devices bought in year t serve, and in year T that of year T (9.2
 * field notes).
 */
function quantity(line, t, herd, capital = false) {
  const classes = line.classes ?? [];
  if (line.basis === "fixed") return 1;
  if (line.basis === "perDevice" && !classes.length) return num(at(line.qty, t));
  if (!["perDevice", "perHeadMonth", "perHeadYear"].includes(line.basis)) {
    throw new Error(`Cost line ${line.id}: basis "${line.basis}" is not supported`);
  }
  if (!herd) throw new Error(`Cost line ${line.id}: a quantity taken from head counts needs the herd (herdOf)`);
  const u = capital ? Math.min(t + 1, herd.T) : t;
  if (line.basis === "perHeadMonth") return sum(classes.map((c) => herd.hm(c, u)));
  const head = sum(classes.map((c) => herd.head(c, u)));
  return line.basis === "perHeadYear" ? 12 * head : head;
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
 * years, and the residual at T comes from the last purchase of each cohort. herd (herdOf) is needed for a quantity
 * taken from head counts. Returns { cost, residual, purchases: [{year, qty, unitCost}], lastCost, blankPrice } with cost and residual by year;
 * blankPrice is true when a purchase is priced blank ("Quote required", counted as 0).
 */
export function scheduleCapital(line, T, s, herd) {
  const life = blank(line.lifeYears) ? null : line.lifeYears;
  const q = (t) => quantity(line, t, herd, true);
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
 * billed quantity is at least minQty (for perHeadYear, 12 × minQty head, 9.2 field notes). A commitment that runs past
 * T charges its early-termination fee in year T. herd (herdOf) is needed for a quantity taken from head counts.
 * Returns { cost, residual, commitPastHorizon, blankPrice } with cost by year (an annual line has no residual);
 * blankPrice is true when a season with a quantity billed is priced blank ("Quote required", counted as 0).
 */
export function billAnnual(line, T, s, herd) {
  const cost = zeros(T);
  const advance = billingOf(line) === "advance";
  const commitYears = num(line.commitYears);
  const minQty = (line.basis === "perHeadYear" ? 12 : 1) * num(line.minQty);
  let blankPrice = false;
  for (let t = s + 1; t <= T; t++) {
    const qty = quantity(line, t, herd);
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

// ---------------------------------------------------------------- pools (F9)

/**
 * Pool registry (9.6): the unit of each pool and its baseline in year t, from the analysis's own inputs (9.4). The
 * deathLoss:<cause> pools share one entry, whose baseline takes the cause. A baseline of null is blank: the clamp is
 * skipped and the page asks for it. The baseline's split by land unit comes with F6.
 */
export const POOLS = {
  waterRuns: { unit: "runs/yr", baseline: (t, a) => sum((a.water?.blocks ?? []).map((b) => num(b.runsPerWeek) * num(b.weeks))) },
  gatherHours: { unit: "h/yr", baseline: (t, a) => (blank(at(a.vf?.gatherHoursToday, t)) ? null : at(a.vf.gatherHoursToday, t)) },
  deathLoss: {
    unit: "head/yr",
    baseline: (t, a, cause) => sum((a.riskLines ?? []).filter((r) => r.cause === cause)
      .map((r) => num(r.eventsPerYear) * num(r.headPerEvent))),
  },
  fenceMiles: {
    unit: "mi",
    baseline: (t, a) => (blank(a.vf?.fence?.planMiles) ? num(a.vf?.fence?.miles) : a.vf.fence.planMiles),
  },
};

/** A pool's baseline by year for analysis a, or null when it is blank in any year. */
export function poolBaseline(pool, a, T) {
  const i = pool.indexOf(":");
  const entry = POOLS[i < 0 ? pool : pool.slice(0, i)];
  if (!entry) throw new Error(`Unknown pool "${pool}"`);
  const series = [...Array(T + 1).keys()].map((t) => entry.baseline(t, a, i < 0 ? undefined : pool.slice(i + 1)));
  return series.some((b) => b === null) ? null : series;
}

// ---------------------------------------------------------------- lines and analysis

/**
 * The analysis's lines (9.2): its stored cost lines, then the labor lines derived from a.labor with their fixed ids
 * (added:<i> for each paid added item, laborCut, avoidedHire), the hours saved that no module input covers
 * (otherHoursSaved, kind "hours"), and the capacity line hoursFreed.
 * A cost line is either stored ({timing, basis, unitCost, qty, ...}) or derived ({flow: (t, ctx) => $}).
 * A benefit line has claim(t, ctx) and valuePerUnit(t, ctx) and counts in the module's operating years s+1..T
 * (hoursFreed also in year s, where unpaid setup hours fall). A line of kind "hours" adds claim(t, ctx) × hoursPerUnit
 * (default 1) to the hours saved in the operating years; `eligible: false` keeps it from supporting paid hours cut.
 * Benefit and hours lines may name a `pool` (9.6). The pool's claim is the sum of its lines' claims, except a line
 * marked `derived`, which takes the pool's scale but adds no claim (such as the hours saved by the runs a water line
 * claims). Every line requires cattle (9.3) unless it sets `requiresCattle: false`, as a test fixture may.
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
 * Each benefit line's claim in year t goes through the order of operations of 9.3 as built so far: the raw claim;
 * the cattle-presence rule (0 in a year t ≥ 1 with no head-months, for a line that requires cattle); the pool's
 * single-module clamp, or the combine() scale passed in opts.scales ({ [pool]: scale by year }), which replaces it
 * (9.6); then × valuePerUnit. The land-unit split and the operator share (F6) and the ramp (B3) come later.
 * Hours saved take the same factors, and paid hours cut and cash labor saved follow them through f_t (9.3 Labor).
 * Returns the series by year (C cost, B cash benefit, R residual, X expected losses avoided, K capacity value,
 * P production, N = B + R − C), their present values, cash NPV, BCR, IRR and payback on N, the head-months HM, the
 * labor hours by year, each pool's { baseline, claims, scale } (claims before the clamp), each line's series and PV,
 * and notices for the page.
 */
export function analyzeLines(a, lines, opts = {}) {
  const T = a.settings.T, rate = a.settings.discountRate, s = a.startYear ?? 0;
  const years = [...Array(T + 1).keys()];
  const operating = (t) => t > s && t <= T;
  const herd = herdOf(a, T);
  const ctx = { a, T, s, HM: herd.HM, herd };
  const notices = [];

  // Cattle-presence rule (9.3): in a year t ≥ 1 with no head-months, a line that requires cattle counts 0.
  const noCattle = (t) => t >= 1 && !(herd.HM[t] > 0);
  for (const t of years) if (noCattle(t)) notices.push({ type: "noCattle", year: t });
  const cattle = (line, t) => (line.requiresCattle !== false && noCattle(t) ? 0 : 1);
  const counts = (line, t) => operating(t) || (line.fromStartYear && t === s);
  const claimed = (line, t) => (counts(line, t) ? line.claim(t, ctx) * cattle(line, t) : 0);

  // Pools (9.6): the claims after the cattle-presence rule, then the clamp to the baseline or the combine() scale.
  const pools = {};
  for (const line of lines) {
    if (!line.pool || line.derived) continue;
    const p = (pools[line.pool] ??= { baseline: poolBaseline(line.pool, a, T), claims: zeros(T) });
    for (const t of years) p.claims[t] += claimed(line, t);
  }
  for (const [pool, p] of Object.entries(pools)) {
    p.scale = opts.scales?.[pool] ?? years.map(() => 1);
    if (opts.scales?.[pool]) continue;
    if (p.baseline === null) {
      if (p.claims.some((c) => c > EPS)) notices.push({ type: "baselineBlank", pool });
      continue;
    }
    for (const t of years) {
      if (p.claims[t] <= p.baseline[t] + EPS) continue;
      if (p.scale.every((x) => x === 1)) {
        notices.push({ type: "poolClamp", pool, year: t, claim: p.claims[t], baseline: p.baseline[t] });
      }
      p.scale[t] = p.baseline[t] / p.claims[t];
    }
  }
  const scaled = (line, t) => (line.pool ? pools[line.pool]?.scale[t] ?? 1 : 1);

  // Labor hours (9.3 Labor): hours saved and paid hours cut at year end in the operating years; added hours as worked.
  // Paid hours cut follow the eligible hours saved through f_t, their share left after the cattle rule and the scale.
  const hourLines = lines.filter((l) => l.kind === "hours");
  const hoursOf = (line, t, factored) => {
    if (!operating(t)) return 0;
    const raw = line.claim(t, ctx) * (line.hoursPerUnit ?? 1);
    return factored ? raw * cattle(line, t) * scaled(line, t) : raw;
  };
  const hoursSum = (ls, t, factored) => sum(ls.map((l) => hoursOf(l, t, factored)));
  const eligible = hourLines.filter((l) => l.eligible !== false);
  ctx.hoursSaved = years.map((t) => hoursSum(hourLines, t, true));
  ctx.laborFactor = years.map((t) => {
    const before = hoursSum(eligible, t, false);
    return before > 0 ? hoursSum(eligible, t, true) / before : 1;
  });
  const labor = a.labor ?? {}, cut = labor.cut;
  ctx.unitsCut = years.map((t) => (cut && replacesPaidWork(labor) && operating(t)
    ? num(at(cut.unitsCut, t)) * ctx.laborFactor[t] : 0));
  ctx.paidHoursCut = ctx.unitsCut.map((u) => (u ? u * hoursPerUnit(cut) : 0));
  const addedBy = (paid) => years.map((t) => sum((labor.added ?? [])
    .filter((item) => (item.doneBy === "paid") === paid).map((item) => addedHours(item.hours, t, s, T))));
  ctx.paidHoursAdded = addedBy(true);
  ctx.unpaidHoursAdded = addedBy(false);
  ctx.hoursFreed = years.map((t) => (noCattle(t) ? 0 : ctx.hoursSaved[t] - ctx.paidHoursCut[t] - ctx.unpaidHoursAdded[t]));

  const series = { C: zeros(T), B: zeros(T), R: zeros(T), X: zeros(T), K: zeros(T), P: zeros(T) };
  const BY_KIND = { cash: "B", risk: "X", capacity: "K", production: "P" };
  const out = [];
  for (const line of lines) {
    const base = { id: line.id, label: line.label, kind: line.kind };
    if (line.kind === "hours") {
      out.push({ ...base, hours: years.map((t) => hoursOf(line, t, true)) });
    } else if (line.kind === "cost") {
      let flows;
      if (line.flow) flows = { cost: years.map((t) => line.flow(t, ctx)), residual: zeros(T) };
      else {
        const ls = blank(line.startYear) ? s : line.startYear;
        flows = line.timing === "capital" ? scheduleCapital(line, T, ls, herd) : billAnnual(line, T, ls, herd);
        // A blank price is listed only where it is used: a line whose quantity is 0 in every year changes nothing (9.5 item 7).
        if (flows.blankPrice) notices.push({ type: "quoteRequired", lineId: line.id });
        if (flows.commitPastHorizon) {
          notices.push({ type: "commitPastHorizon", lineId: line.id, label: line.label ?? line.id, horizon: T,
            commitYears: line.commitYears, fee: num(line.earlyTerminationFee) });
        }
        if (line.basis === "perHeadYear") notices.push(...shortMonths(line, herd, ls, T));
      }
      flows.cost.forEach((x, t) => (series.C[t] += x));
      flows.residual.forEach((x, t) => (series.R[t] += x));
      out.push({ ...base, series: flows.cost, residual: flows.residual, purchases: flows.purchases,
        pv: npv(rate, flows.cost), pvResidual: npv(rate, flows.residual) });
    } else {
      const claims = years.map((t) => claimed(line, t) * scaled(line, t));
      const flow = claims.map((c, t) => (c ? c * line.valuePerUnit(t, ctx) : 0));
      flow.forEach((x, t) => (series[BY_KIND[line.kind]][t] += x));
      out.push({ ...base, pool: line.pool ?? null, claims, series: flow, pv: npv(rate, flow) });
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
    HM: herd.HM,
    hours: { saved: ctx.hoursSaved, paidCut: ctx.paidHoursCut, paidAdded: ctx.paidHoursAdded,
      unpaidAdded: ctx.unpaidHoursAdded, freed: ctx.hoursFreed, factor: ctx.laborFactor },
    pools,
    lines: out,
    notices,
  };
}

/**
 * The warning for a perHeadYear line that bills 12 months per head while a class on it is enrolled or served for
 * fewer (9.3): one per class, for the first billed season in which that class has head and fewer than 12 months.
 */
function shortMonths(line, herd, s, T) {
  const found = [];
  for (const c of line.classes ?? []) {
    if (!herd.listed.includes(c)) continue;
    for (let t = s + 1; t <= T; t++) {
      if (herd.head(c, t) > 0 && herd.months(c, t) < 12) {
        found.push({ type: "perHeadYearMonths", lineId: line.id, label: line.label ?? line.id, class: c,
          months: herd.months(c, t), year: t, enrolled: herd.enrolls });
        break;
      }
    }
  }
  return found;
}

export function analyze(a) {
  return analyzeLines(a, buildLines(a));
}

/**
 * Applies the pool caps across analyses (9.6). Each analysis is run on buildLines(a), or on build(a) for test
 * fixtures. For each pool and year, scale = min(1, baseline ÷ Σ claims), or 1 when nothing is claimed, with each
 * analysis's claims taken before its own clamp, which the scale replaces. When the analyses claiming a pool report
 * different baselines, the largest is used, with a warning. An analysis claims a pool when its claims on it are above
 * 0 in some year; the warnings name only those analyses, and only their baselines count.
 * Returns { results, pools, riskSubtotalPV, warnings }: results holds analyze() output for each analysis, in order,
 * with the scales applied; pools[pool] is { baseline, claims (one series per analysis), scale }; riskSubtotalPV is the
 * PV of every risk line after scaling, each at its own analysis's rate. Returns { error } instead when the horizons
 * differ ({type: "horizonsDiffer"}), an analysis claims a pool whose baseline it leaves blank ({type:
 * "baselineMissing"}) or there is no analysis ({type: "noAnalyses"}).
 */
export function combine(analyses, build = buildLines) {
  if (!analyses.length) return { error: { type: "noAnalyses" } };
  const T = analyses[0].settings.T;
  if (analyses.some((a) => a.settings.T !== T)) {
    return { error: { type: "horizonsDiffer", horizons: analyses.map((a) => a.settings.T) } };
  }
  const years = [...Array(T + 1).keys()];
  const lineSets = analyses.map((a) => build(a));
  const alone = analyses.map((a, i) => analyzeLines(a, lineSets[i]));
  const pools = {}, warnings = [], scales = analyses.map(() => ({}));
  for (const pool of [...new Set(alone.flatMap((r) => Object.keys(r.pools)))]) {
    const by = alone.map((r, i) => ({ i, p: r.pools[pool] })).filter((x) => x.p);
    const claimants = by.filter((x) => x.p.claims.some((c) => c > EPS));
    const blankAt = claimants.find((x) => x.p.baseline === null);
    if (blankAt) return { error: { type: "baselineMissing", pool, module: analyses[blankAt.i].module } };
    const total = years.map((t) => sum(by.map((x) => x.p.claims[t])));
    // With no claim, the scale is 1 and the baseline is reported from the analyses that enter one.
    const basis = claimants.length ? claimants : by.filter((x) => x.p.baseline !== null);
    const baseline = basis.length ? years.map((t) => Math.max(...basis.map((x) => x.p.baseline[t]))) : null;
    // The baselines matter only in a year with claims, so the warning names the first such year in which they differ.
    const differ = years.find((t) => total[t] > EPS && claimants.some((x) => Math.abs(x.p.baseline[t] - baseline[t]) > EPS));
    if (differ !== undefined) {
      warnings.push({ type: "baselinesDiffer", pool, year: differ, modules: claimants.map((x) => analyses[x.i].module),
        values: claimants.map((x) => x.p.baseline[differ]), largest: baseline[differ] });
    }
    const scale = years.map((t) => (total[t] > EPS ? Math.min(1, baseline[t] / total[t]) : 1));
    const over = years.find((t) => total[t] > EPS && total[t] > baseline[t] + EPS);
    if (over !== undefined) {
      const named = claimants.filter((x) => x.p.claims[over] > EPS);
      warnings.push(named.length > 1
        ? { type: "poolShared", pool, year: over, modules: named.map((x) => analyses[x.i].module), claim: total[over], baseline: baseline[over] }
        : { type: "poolClamp", pool, year: over, claim: total[over], baseline: baseline[over] });
    }
    for (const x of by) scales[x.i][pool] = scale;
    pools[pool] = { baseline, claims: alone.map((r) => r.pools[pool]?.claims ?? zeros(T)), scale };
  }
  const results = analyses.map((a, i) => analyzeLines(a, lineSets[i], { scales: scales[i] }));
  return { results, pools, riskSubtotalPV: sum(results.map((r) => r.pv.X)), warnings };
}

// ---------------------------------------------------------------- validation (9.2)

export const YEARS_MESSAGE = "Enter a whole number of years, 1 or more.";
const wholeYears = (v) => Number.isInteger(v) && v >= 1;
const yearIndex = (v) => Number.isInteger(v) && v >= 0;
const show = (x) => (Math.round(x * 100) / 100).toLocaleString("en-US");

/**
 * The 9.2 validation errors built so far: the horizon, start years, the F5 cost-line fields, the F1 labor fields and
 * the F3 class rules.
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
        const { lastCost } = scheduleCapital(line, T, ls, herdOf(a, T));
        if (num(res.dollars) > lastCost + 1e-9) {
          err(p + "residual", "Residual",
            `Residual (${name}): $${show(num(res.dollars))} is more than the $${show(lastCost)} that the purchases it values cost.`);
        }
      }
    } else if (!blank(line.commitYears) && !yearIndex(line.commitYears)) {
      err(p + "commitYears", "Commit years", `Commit years (${name}): enter a whole number of years.`);
    }
  }

  validateHerd(a, tOk ? T : null, err);
  if (a.labor) validateLabor(a, s, tOk ? T : null, err);
  return errors;
}

/**
 * The class rules of 9.2 (F3): an enrolled class needs its months; the sale flows are never enrolled or served;
 * enrolled head stays within the inventory, and calves sold within the calves born less the heifers kept, in every
 * year. Without a valid horizon, the years checked are those the arrays give.
 */
function validateHerd(a, T, err) {
  const LABEL = { enrolled: "Enrolled head by class and months", served: "Classes served and months on the served pastures" };
  const name = (c) => CLASS_NAMES[c] ?? c;
  const inv = (c, t) => num(at(a.classes?.[c]?.head, t));
  const arrays = [a.heifersRetained, ...Object.values(a.classes ?? {}).map((x) => x?.head),
    ...Object.values(a.enrolled ?? {}).map((x) => x?.head)];
  // The years of the analysis, 0..T; without a valid horizon, the years the arrays give.
  const last = T ?? Math.max(0, ...arrays.map((v) => (Array.isArray(v) ? v.length - 1 : 0)));
  const years = [...Array(last + 1).keys()];

  for (const key of ["enrolled", "served"]) {
    for (const c of Object.keys(a[key] ?? {}).filter((c) => SALE_FLOWS.includes(c))) {
      err(`${key}.${c}`, LABEL[key],
        `${LABEL[key]} (${name(c)}): a sale flow drawn from another class cannot be ${key}.`);
    }
  }
  for (const [c, e] of Object.entries(a.enrolled ?? {})) {
    if (SALE_FLOWS.includes(c)) continue;
    const p = `enrolled.${c}.`;
    const months = Array.isArray(e?.months) ? e.months : [e?.months];
    if (!months.length || months.some(blank)) err(p + "months", LABEL.enrolled, `${LABEL.enrolled} (${name(c)}): enter the months enrolled.`);
    const t = years.find((y) => num(at(e?.head, y)) > inv(c, y) + EPS);
    if (t !== undefined) {
      err(p + "head", LABEL.enrolled, `${LABEL.enrolled} (${name(c)}): the ${show(num(at(e.head, t)))} head enrolled in year ${t} are more than the ${show(inv(c, t))} in the herd.`);
    }
  }
  const kept = (t) => num(at(a.heifersRetained, t));
  const t = years.find((y) => inv("calvesSold", y) > inv("calvesBorn", y) - kept(y) + EPS);
  if (t !== undefined && inv("calvesSold", t) <= EPS) {
    // No calves sold: the heifers kept alone are more than the calves born.
    err("heifersRetained", "Calves kept as heifers",
      `Calves kept as heifers: the ${show(kept(t))} kept in year ${t} are more than the ${show(inv("calvesBorn", t))} calves born.`);
  } else if (t !== undefined) {
    err("classes.calvesSold.head", "Head by class and year",
      `Head by class and year (calves sold): the ${show(inv("calvesSold", t))} calves sold in year ${t} are more than the ${show(inv("calvesBorn", t))} calves born less the ${show(kept(t))} kept as replacement heifers.`);
  }
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
    const herd = herdOf(a, T);
    const ctx = { a, T, s, HM: herd.HM, herd };
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
