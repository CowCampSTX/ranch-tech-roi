// Ranch technology ROI engine (phase 1). Pure functions, no dependencies. The rules are those of
// docs/audit/phase1-spec.md: the data model in 9.2 and the formulas in 9.3. Phase 1 builds this engine in steps
// (9.1); until step 6 the page keeps running on today's model, in v1.js.
// Money is in today's US dollars, before tax; the discount rate is real. Years run t = 0..T.
// Built so far: cost lines with the capital scheduler, billing and commitments (F5), labor (F1), pools with the
// single-module clamp and combine() (F9), head-months, head-based quantities and the cattle-presence rule (F3), and the
// metrics with the IRR and payback states (F8), production and risk lines (F4, F7), and land units, operator shares and
// the fence (F6). Still to come: ramp (B3) and the modules.

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

// ---------------------------------------------------------------- metrics (F8)

/** The tolerance of the IRR and payback rules: a value, sum or cumulative below $0.005 in absolute value is 0 (9.3). */
export const ZERO = 0.005;
const isZero = (x) => Math.abs(x) < ZERO;

/** The first year with cash flows, s0: the first year in which C, B or R is $0.005 or more in absolute value, else 0. */
export function firstFlowYear(C, B, R) {
  const t = C.findIndex((_, i) => !isZero(C[i]) || !isZero(B[i]) || !isZero(R[i]));
  return t < 0 ? 0 : t;
}

/**
 * IRR on the nets (9.3 Metrics), read from year s0. Returns { state, value }: state "noFlows", "noOutlay" (with
 * year: s0), "signChanges", "below0", "value" (value: the IRR as a fraction, 0 when the nets sum to 0) or "above"
 * (above 10,000%). value is null except in state "value".
 */
export function irr(nets, s0 = 0) {
  if (nets.every(isZero)) return { state: "noFlows", value: null };
  if (nets[s0] > -ZERO) return { state: "noOutlay", year: s0, value: null };
  const signs = nets.filter((x) => !isZero(x)).map(Math.sign);
  if (signs.slice(1).filter((x, i) => x !== signs[i]).length > 1) return { state: "signChanges", value: null };
  const total = sum(nets);
  if (total <= -ZERO) return { state: "below0", value: null };
  if (total < ZERO) return { state: "value", value: 0 };
  const f = (r) => npv(r, nets);
  if (f(100) > 0) return { state: "above", value: null };
  let lo = 0, hi = 100; // f(lo) = total > 0 >= f(hi)
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return { state: "value", value: (lo + hi) / 2 };
}

/**
 * Payback on the nets (9.3 Metrics), counted from year 0 and read from year s0. Returns { state, years, ... }:
 * - "noFlows": every net is 0;
 * - "none": cumulative cash is negative at T (T: the last year); noOutlayYear (s0) and negativeFrom (the first year it
 *   is negative) when the net in year s0 is not an outlay; positiveYears: the years after the first negative one in
 *   which it was 0 or more again;
 * - "noOutlay": cumulative cash is never negative;
 * - "years": years, the payback in years, with earlyPositive (the first year from s0 to k − 2 in which cumulative cash
 *   was 0 or more) and before (k) when it went negative again, and s0 for the note of a late first cash flow.
 * years is null except in state "years".
 */
export function payback(nets, s0 = 0) {
  if (nets.every(isZero)) return { state: "noFlows", years: null };
  const T = nets.length - 1;
  const cum = [];
  nets.reduce((c, x, t) => (cum[t] = c + x), 0);
  const nonNegative = (t) => cum[t] > -ZERO;
  if (!nonNegative(T)) {
    const out = { state: "none", years: null, T, positiveYears: [] };
    let after = s0;
    if (nets[s0] > -ZERO) {
      out.noOutlayYear = s0;
      out.negativeFrom = cum.findIndex((c, t) => t >= s0 && c <= -ZERO);
      after = out.negativeFrom;
    }
    for (let t = after + 1; t <= T; t++) if (nonNegative(t)) out.positiveYears.push(t);
    return out;
  }
  let k = T;
  while (k > 0 && nonNegative(k - 1)) k--;
  if (k === 0) return { state: "noOutlay", years: null };
  const out = { state: "years", years: k - 1 + -cum[k - 1] / nets[k], s0 };
  for (let t = s0; t <= k - 2; t++) {
    if (nonNegative(t)) {
      out.earlyPositive = t;
      out.before = k;
      break;
    }
  }
  return out;
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
 * skipped and the page asks for it. analyzeLines splits each baseline by land unit like the claims on it (9.6).
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
  const lines = Object.entries(a.costs ?? {}).map(([id, c]) => ({ ...c, id, kind: "cost", paths: c.paths ?? costPaths(a, id, c) }));
  if (a.module === "vf" && num(a.vf?.fence?.miles) > 0) lines.push(fenceLine(a));
  const L = a.labor;
  if (L) {
    (L.added ?? []).forEach((item, i) => {
      if (item.doneBy !== "paid") return;
      const rate = num(item.paidRate) * (1 + num(item.loadPct));
      lines.push({ id: `added:${i}`, label: item.label, kind: "cost", flow: (t) => addedHours(item.hours, t, s, T) * rate,
        paths: ["hours", "paidRate", "loadPct"].map((f) => `labor.added.${i}.${f}`) });
    });
    if (L.cut) {
      const pay = L.cut.laborUnit === "position" ? ["salary"] : ["hoursPerUnit", "paidRate"];
      lines.push({
        id: "laborCut", label: LABOR_CUT_LABEL[a.module] ?? "Hired labor cut", kind: "cash",
        claim: (t, ctx) => ctx.unitsCut[t], valuePerUnit: () => cutValuePerUnit(L.cut),
        paths: ["unitsCut", ...pay.filter((f) => !(f === "hoursPerUnit" && L.cut.laborUnit === "hour")), "loadPct"]
          .map((f) => `labor.cut.${f}`),
      });
    }
    const hire = L.avoidedHire;
    if (hire && num(hire.years) > 0) {
      const first = hire.startYear, lastYear = Math.min(hire.startYear + hire.years - 1, T);
      lines.push({
        id: "avoidedHire", label: "Avoided hire", kind: "cash",
        claim: (t) => (t >= first && t <= lastYear ? 1 : 0),
        valuePerUnit: () => num(hire.salary) * (1 + num(hire.loadPct)),
        paths: ["labor.avoidedHire.salary", "labor.avoidedHire.loadPct"],
      });
    }
    if (!blank(L.otherHoursSaved)) {
      lines.push({ id: "otherHoursSaved", label: "Other hours saved", kind: "hours", claim: (t) => num(at(L.otherHoursSaved, t)),
        paths: ["labor.otherHoursSaved"] });
    }
  }
  if (a.module === "vf" || a.module === "eid") lines.push(productionLine(a));
  (a.riskLines ?? []).forEach((r, i) => lines.push(riskLine(a, r, i, sharesCause(a, r))));
  if (a.module === "water") lines.push(fewerChecksLine(a));
  // The capacity line multiplies the owner's time rate by the hours freed, so its inputs are the rate and every input
  // those hours come from: the hours saved, the paid hours cut and the unpaid added hours (9.3; the rounding rule, 7.3).
  const cutPaths = L?.cut && replacesPaidWork(L)
    ? ["labor.cut.unitsCut", ...(L.cut.laborUnit === "hour" ? [] : ["labor.cut.hoursPerUnit"])] : [];
  const unpaidPaths = (L?.added ?? []).flatMap((item, i) => (item.doneBy === "paid" ? [] : [`labor.added.${i}.hours`]));
  lines.push({
    id: "hoursFreed", label: "Hours freed", kind: "capacity", fromStartYear: true,
    claim: (t, ctx) => ctx.hoursFreed[t], valuePerUnit: () => num(a.settings.oppCostPerHour),
    paths: [...new Set(["settings.oppCostPerHour", ...lines.filter((l) => l.kind === "hours").flatMap((l) => l.paths ?? []),
      ...cutPaths, ...unpaidPaths])],
  });
  return lines;
}

// ---------------------------------------------------------------- who pays and who receives (F6)

/**
 * The land units the analysis's lines are split across (F6, 9.3), with n their number on the page (1, 2, ...). Water
 * and virtual fence lines (and a test fixture module's) are split by landUnits[u].share; EID lines, and an analysis
 * without land units, have one part with share 1 and unit id null. end is T' = leaseYears for a leased unit whose
 * lease ends within the horizon (leaseYears ≤ T) with no renewal expected, and null for a unit treated like ownership
 * within the horizon.
 */
export function landUnitsOf(a) {
  const T = a.settings.T, list = a.settings.landUnits ?? [];
  if (a.module === "eid" || !list.length) return [{ id: null, n: null, kind: "owned", share: 1, end: null, raw: {} }];
  return list.map((u, i) => ({
    id: u.id, n: i + 1, kind: u.kind, share: num(u.share), raw: u,
    end: u.kind === "leased" && !u.renewalExpected && num(u.leaseYears) <= T ? u.leaseYears : null,
  }));
}

/** The land unit the whole fence is on: the one vf.fence.landUnitId names, else the first (9.3). */
function fenceUnitOf(a, units) {
  return units.find((u) => u.id !== null && u.id === a.vf?.fence?.landUnitId) ?? units[0];
}

/** A leased unit where the landlord provides and checks the water, or water care is in the lease rate (9.3). */
const waterCare = (u) => u.kind === "leased" && (u.raw.waterBy === "landlord" || u.raw.careInLeaseRate === true);
/** The water lines that value water runs, whose part on such a unit is the landowner's by default (9.3). */
const WATER_RUN_LINES = ["vehicle", "laborCut", "avoidedHire", "hoursFreed"];

/**
 * A line's operator share on land unit u (9.2, 9.3): the stored answer to "Who pays for this?" or "Who receives this
 * saving?" (costs[id].operatorShare, costShares[id] for a derived cost line, benefitShares[id] for a benefit line; a
 * number, or an object keyed by land-unit id, where a unit left out takes its default), else the land-unit default:
 * 0 for the fence on a leased unit whose landlord provides the fence, and for a water line that values water runs on
 * a unit with landlord water care; 1 otherwise.
 */
export function operatorShare(a, line, u) {
  const stored = line.operatorShare ?? (line.kind === "cost" ? a.costShares?.[line.id] : a.benefitShares?.[line.id]);
  const v = stored !== null && typeof stored === "object" ? stored[u.id] : stored;
  if (!blank(v)) return v;
  if (line.fence) return u.kind === "leased" && u.raw.fenceBuiltBy === "landlord" ? 0 : 1;
  if (a.module === "water" && WATER_RUN_LINES.includes(line.id) && waterCare(u)) return 0;
  return 1;
}

/**
 * A cost line's parts by land unit (9.3): each unit's share of the line as scheduled, except a capital line marked
 * staysWithLand on a unit whose lease ends at T'. That part runs through the scheduler with horizon T' (no purchase
 * in year T' or later, no repair after T') and, if it had a purchase before T', takes as its residual at T' its part
 * of leaseReimbursement: leaseReimbursement × share ÷ Σ share over the units whose lease ends within T and whose part
 * had a purchase.
 */
function costParts(line, units, full, s, herd, T) {
  const part = (u) => ({ u, cost: full.cost.map((x) => x * u.share), residual: full.residual.map((x) => x * u.share) });
  if (line.timing !== "capital" || !line.staysWithLand || line.flow) return units.map(part);
  const lease = new Map(units.filter((u) => u.end !== null).map((u) => [u, scheduleCapital(line, u.end, s, herd)]));
  const bought = [...lease].filter(([, sch]) => sch.purchases.length).map(([u]) => u);
  const total = sum(bought.map((u) => u.share));
  return units.map((u) => {
    if (!lease.has(u)) return part(u);
    const cost = zeros(T), residual = zeros(T);
    lease.get(u).cost.forEach((x, t) => (cost[t] = x * u.share));
    if (bought.includes(u) && total > 0) residual[u.end] = num(line.leaseReimbursement) * u.share / total;
    return { u, cost, residual };
  });
}

/**
 * The fence stream fenceCost_b (F6, 9.3) by year 0..T: the purchases and upkeep of a capital line with unitCost F,
 * qty miles, startYear b, lifeYears Lf, repairPct m and a straight-line residual, less that residual, at horizon H
 * (T, or the lease end T'). endResidual, when given, takes the place of the straight-line residual at H (the lease-end
 * rule: the lease's fenceReimbursement). 0 in every year when b ≥ H. Returns { capital, upkeep }: the purchases less
 * the residual, and the upkeep, which the cattle-presence rule treats apart.
 */
export function fenceCost(fence, b, T, H = T, endResidual = null) {
  const capital = zeros(T), upkeep = zeros(T);
  if (b >= H) return { capital, upkeep };
  const line = { timing: "capital", basis: "perDevice", unitCost: num(fence.F), qty: num(fence.miles), lifeYears: fence.Lf,
    residual: { mode: "straightLine" } };
  const sch = scheduleCapital(line, H, b);
  sch.cost.forEach((x, t) => (capital[t] += x));
  capital[H] -= endResidual ?? sch.residual[H];
  for (const p of sch.purchases) {
    const end = blank(fence.Lf) ? H : Math.min(p.year + fence.Lf, H);
    for (let y = p.year + 1; y <= end; y++) upkeep[y] += num(fence.m) * p.unitCost * p.qty;
  }
  return { capital, upkeep };
}

/**
 * The fence benefit by year (9.3 Fence): avoided, fenceCost_k; deferred by d, fenceCost_k − fenceCost_{k+d}. On a
 * leased unit (from landUnitsOf), a landlord who maintains the fence makes the tenant's upkeep m 0, and a lease that
 * ends at T' with no renewal expected runs both streams to T', with the unit's fenceReimbursement as the residual at
 * T', so every fence flow after T' is 0. Returns { capital, upkeep }.
 */
export function fenceStream(a, unit) {
  const f = a.vf.fence, T = a.settings.T;
  const leased = unit?.kind === "leased";
  const fence = { ...f, m: leased && unit.raw.fenceMaintainedBy === "landlord" ? 0 : f.m };
  const H = unit?.end ?? T;
  const endResidual = unit?.end != null ? num(unit.raw.fenceReimbursement) : null;
  const avoided = fenceCost(fence, num(f.k), T, H, endResidual);
  if (f.mode !== "deferred") return avoided;
  const later = fenceCost(fence, num(f.k) + num(f.d), T, H, endResidual);
  return { capital: avoided.capital.map((x, t) => x - later.capital[t]), upkeep: avoided.upkeep.map((x, t) => x - later.upkeep[t]) };
}

/**
 * The virtual fence's fence line (9.3 Fence, 9.4): claims the fence miles on the fenceMiles pool, so a pool scale below
 * 1 scales the whole stream. It is not split by land unit: it lies whole on its own unit, whose tenure decides it.
 * It falls in the years the stream gives, from the build year k on (9.3 Timing). Cattle-presence rule (9.3): the
 * avoided capital counts if the module has head-months in some year 1..T; the upkeep only in a year that has them.
 */
function fenceLine(a) {
  const f = a.vf.fence, miles = num(f.miles);
  // The stream is computed when first valued, not when the line is built, so validate() can build the lines (for the
  // paid-hours check) before it has checked the fence's life and its land unit's lease term.
  let stream = null;
  return {
    id: "fence", label: f.mode === "deferred" ? "Interior fence deferred" : "Interior fence avoided", kind: "cash",
    pool: "fenceMiles", fence: true, anyYear: true, requiresCattle: false,
    claim: () => miles,
    valuePerUnit: (t, ctx) => {
      stream = stream ?? fenceStream(a, fenceUnitOf(a, landUnitsOf(a)));
      const anyCattle = ctx.HM.some((hm, y) => y >= 1 && hm > 0);
      return ((anyCattle ? stream.capital[t] : 0) + (t >= 1 && !(ctx.HM[t] > 0) ? 0 : stream.upkeep[t])) / miles;
    },
    // F is a benefit input, not a price: left blank, the line counts 0 and is listed as not entered (9.5 items 4, 7).
    missing: blank(f.F),
    paths: ["vf.fence.miles", "vf.fence.F", "vf.fence.m"],
  };
}

// ---------------------------------------------------------------- production (F4) and risk (F7)

/** The sold classes that production counts (9.3 Production). */
const SOLD = ["calvesSold", "cullCowsSold", "yearlings"];

/**
 * Weight gain (F4, 9.3): Σ over the sold classes of lb per head (lb a day × days) × head sold × value of gain, at year
 * end. Head sold is the head of calvesSold and cullCowsSold, and yearlings' head × soldShare (default 1). A production
 * line, in P, unless the gain is from the ranch's own records (fromRecords), when it is cash. `missing` marks a line
 * that counts 0 because an input it needs is blank (9.5 item 4).
 */
function productionLine(a) {
  const p = a.production ?? {};
  const classes = (p.classes ?? []).filter((c) => SOLD.includes(c));
  const lbs = num(p.lbPerHeadPerDay) * num(p.days);
  const share = (c) => (c === "yearlings" && !blank(p.soldShare) ? p.soldShare : 1);
  const gain = (t) => sum(classes.map((c) => lbs * num(at(a.classes?.[c]?.head, t)) * share(c) * num(a.classes?.[c]?.valueOfGain)));
  return {
    id: "production", label: "Weight gain", kind: p.fromRecords ? "cash" : "production",
    claim: () => 1, valuePerUnit: (t) => gain(t),
    missing: blank(p.lbPerHeadPerDay) || blank(p.days) || !classes.length || classes.every((c) => blank(a.classes?.[c]?.valueOfGain)),
    paths: ["production.lbPerHeadPerDay", "production.days", ...classes.flatMap((c) => [`classes.${c}.head`, `classes.${c}.valueOfGain`])],
  };
}

/**
 * A risk line (F7, 9.3): eventsPerYear × headPerEvent × shareCaught head a year, claimed on deathLoss:<cause>, at the
 * value per head of its class. Kind "risk": it enters X only. Labeled "Losses avoided (<cause>)", with the class's
 * name when another risk line has the same cause (9.4).
 */
function riskLine(a, r, i, shared) {
  const fields = ["cause", "class", "eventsPerYear", "headPerEvent", "shareCaught"];
  const missing = fields.some((f) => blank(r[f])) || blank(a.classes?.[r.class]?.valuePerHead);
  return {
    id: `risk:${i}`, kind: "risk", label: riskLabel(r, shared),
    // A line with no cause claims no pool: it counts 0 and is listed as not entered (judgment).
    pool: blank(r.cause) ? undefined : `deathLoss:${r.cause}`,
    claim: () => (missing ? 0 : num(r.eventsPerYear) * num(r.headPerEvent) * num(r.shareCaught)),
    valuePerUnit: () => num(a.classes?.[r.class]?.valuePerHead),
    missing,
    paths: [...fields.slice(2).map((f) => `riskLines.${i}.${f}`), ...(blank(r.class) ? [] : [`classes.${r.class}.valuePerHead`])],
  };
}

/**
 * A risk line's label (9.4): "Losses avoided (<cause>)", with its class's name when another risk line has the same
 * cause ("Losses avoided (water, cows)"); "Losses avoided" while the cause is blank.
 */
function riskLabel(r, shared) {
  if (blank(r.cause)) return "Losses avoided";
  return shared ? `Losses avoided (${r.cause}, ${CLASS_NAMES[r.class] ?? r.class})` : `Losses avoided (${r.cause})`;
}
const sharesCause = (a, r) => !blank(r.cause) && (a.riskLines ?? []).filter((x) => x.cause === r.cause).length > 1;

/**
 * The water module's optional offset for losses from fewer physical checks (9.3): a negative risk line with no pool,
 * −headPerYear × the value per head of its class a year. Blank by default.
 */
function fewerChecksLine(a) {
  const f = a.water?.fewerChecksLoss ?? {};
  return {
    id: "fewerChecks", label: "Losses from fewer physical checks", kind: "risk",
    claim: () => -num(f.headPerYear), valuePerUnit: () => num(a.classes?.[f.class]?.valuePerHead),
    missing: blank(f.headPerYear) || blank(f.class) || blank(a.classes?.[f.class]?.valuePerHead),
    paths: ["water.fewerChecksLoss.headPerYear", `classes.${f.class}.valuePerHead`],
  };
}

/**
 * The value of a pound of added weight from two dated weight-class quotes (F4, 9.3), in $/lb:
 * (W_heavy × P_heavy − W_base × P_base) ÷ (W_heavy − W_base), with the prices in $/cwt. Returns { value, warnings }:
 * a value above the heavier weight's price per pound warns that it is normally below the sale price (9.5 item 11).
 */
export function valueOfGainFromQuotes(base, heavy) {
  const entered = [base?.weight, base?.pricePerCwt, heavy?.weight, heavy?.pricePerCwt].every((x) => typeof x === "number" && Number.isFinite(x));
  if (!entered) return { value: null, warnings: [] };
  // The division needs the heavier quote above the base weight (F8: every division guarded).
  if (!(heavy.weight > base.weight)) return { value: null, warnings: [{ type: "quoteWeights" }] };
  const value = (heavy.weight * heavy.pricePerCwt / 100 - base.weight * base.pricePerCwt / 100) / (heavy.weight - base.weight);
  return { value, warnings: value > heavy.pricePerCwt / 100 ? [{ type: "valueOfGainAboveSale" }] : [] };
}

/**
 * The inputs a stored cost line multiplies (9.2 `paths`, for the provenance rules of 9.3): its price, and its
 * quantity or the head counts it is taken from.
 */
function costPaths(a, id, c) {
  const paths = [`costs.${id}.unitCost`];
  if (c.basis === "perDevice" && !(c.classes ?? []).length) paths.push(`costs.${id}.qty`);
  for (const k of c.basis === "fixed" ? [] : c.classes ?? []) {
    if (a.module === "vf") paths.push(`enrolled.${k}.head`, `enrolled.${k}.months`);
    else paths.push(`classes.${k}.head`, ...(c.basis === "perHeadMonth" ? [`served.${k}.months`] : []));
  }
  return paths;
}

/**
 * Runs the analysis on the given lines (buildLines(a), plus any test fixtures). Assumes validate(a) found no errors.
 * Each benefit line's claim in year t goes through the order of operations of 9.3 as built so far: the raw claim;
 * the land-unit split, with a leased unit's part 0 after its lease ends (F6); the cattle-presence rule (0 in a year
 * t ≥ 1 with no head-months, for a line that requires cattle); the pool's single-module clamp, or the combine() scale
 * passed in opts.scales ({ [pool]: scale by year }), which replaces it (9.6); × valuePerUnit; and the operator share
 * (F6). The ramp (B3) comes later. Hours saved take the same factors up to the scale, and paid hours cut and cash
 * labor saved follow them through f_t (9.3 Labor). A cost line is split by land unit too, with its operator share.
 * Returns the operator's series by year (C cost, B cash benefit, R residual, X expected losses avoided, K capacity
 * value, P production, N = B + R − C), their present values, cash NPV, BCR, IRR and payback on N, the head-months
 * HM, the labor hours by year, each pool's { baseline, claims, scale } (claims before the clamp), each line's series
 * and PV, the amounts that are not the operator's (paidByOthers, receivedByOthers: [{lineId, unitId, series, pv}],
 * hours with pv null for hoursFreed), and notices for the page.
 */
export function analyzeLines(a, lines, opts = {}) {
  const T = a.settings.T, rate = a.settings.discountRate, s = a.startYear ?? 0;
  const years = [...Array(T + 1).keys()];
  const operating = (t) => t > s && t <= T;
  const herd = herdOf(a, T);
  const ctx = { a, T, s, HM: herd.HM, herd };
  const notices = [];

  // Land units (F6, 9.3): each line's parts, w(t) its share of the line in year t after the lease-end rule.
  const units = landUnitsOf(a);
  const fenceUnit = fenceUnitOf(a, units);
  const live = (u, t) => u.end === null || t <= u.end;
  const partsOf = new Map(lines.map((line) => [line, line.fence
    ? [{ u: fenceUnit, w: (t) => (live(fenceUnit, t) ? 1 : 0) }]
    : units.map((u) => ({ u, w: (t) => (live(u, t) ? u.share : 0) }))]));
  const area = (line, t) => sum(partsOf.get(line).map((p) => p.w(t)));
  const unitArea = (t) => sum(units.map((u) => (live(u, t) ? u.share : 0)));
  for (const u of units) if (u.end !== null && u.end < T) notices.push({ type: "leaseEnds", unit: u.n, year: u.end, horizon: T });
  if (a.module === "water") {
    for (const u of units.filter((x) => waterCare(x))) {
      notices.push({ type: "waterCare", unit: u.n, reason: u.raw.waterBy === "landlord" ? "landlord" : "leaseRate" });
    }
  }

  // Cattle-presence rule (9.3): in a year t ≥ 1 with no head-months, a line that requires cattle counts 0.
  const noCattle = (t) => t >= 1 && !(herd.HM[t] > 0);
  for (const t of years) if (noCattle(t)) notices.push({ type: "noCattle", year: t });
  const cattle = (line, t) => (line.requiresCattle !== false && noCattle(t) ? 0 : 1);
  const counts = (line, t) => line.anyYear || operating(t) || (line.fromStartYear && t === s);
  const claimed = (line, t) => (counts(line, t) ? line.claim(t, ctx) * area(line, t) * cattle(line, t) : 0);

  // Pools (9.6): the claims after the split and the cattle-presence rule, against the baseline split the same way,
  // then the clamp to the baseline or the combine() scale.
  const pools = {};
  for (const line of lines) {
    if (!line.pool || line.derived) continue;
    if (!pools[line.pool]) {
      const full = poolBaseline(line.pool, a, T);
      const share = line.pool === "fenceMiles" ? (t) => (live(fenceUnit, t) ? 1 : 0) : unitArea;
      pools[line.pool] = { baseline: full && full.map((b, t) => b * share(t)), claims: zeros(T) };
    }
    for (const t of years) pools[line.pool].claims[t] += claimed(line, t);
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
  // ctx holds the hours before the land-unit split; the laborCut and hoursFreed lines are split like any other line.
  const hourLines = lines.filter((l) => l.kind === "hours");
  const rawHours = (line, t) => (operating(t) ? line.claim(t, ctx) * (line.hoursPerUnit ?? 1) : 0);
  const factor = (line, t) => cattle(line, t) * scaled(line, t);
  const hoursSum = (ls, t, f) => sum(ls.map((l) => rawHours(l, t) * f(l, t)));
  const eligible = hourLines.filter((l) => l.eligible !== false);
  const savedBeforeSplit = years.map((t) => hoursSum(hourLines, t, factor));
  ctx.hoursSaved = years.map((t) => hoursSum(hourLines, t, (l, y) => area(l, y) * factor(l, y)));
  ctx.laborFactor = years.map((t) => {
    const before = hoursSum(eligible, t, area);
    return before > 0 ? hoursSum(eligible, t, (l, y) => area(l, y) * factor(l, y)) / before : 1;
  });
  const labor = a.labor ?? {}, cut = labor.cut;
  ctx.unitsCut = years.map((t) => (cut && replacesPaidWork(labor) && operating(t)
    ? num(at(cut.unitsCut, t)) * ctx.laborFactor[t] : 0));
  ctx.paidHoursCut = ctx.unitsCut.map((u) => (u ? u * hoursPerUnit(cut) : 0));
  const addedBy = (paid) => years.map((t) => sum((labor.added ?? [])
    .filter((item) => (item.doneBy === "paid") === paid).map((item) => addedHours(item.hours, t, s, T))));
  ctx.paidHoursAdded = addedBy(true);
  ctx.unpaidHoursAdded = addedBy(false);
  ctx.hoursFreed = years.map((t) => (noCattle(t) ? 0 : savedBeforeSplit[t] - ctx.paidHoursCut[t] - ctx.unpaidHoursAdded[t]));

  // Lines (9.3, Who pays and who receives): the operator's flow is s × flow for each part; the rest is listed.
  const series = { C: zeros(T), B: zeros(T), R: zeros(T), X: zeros(T), K: zeros(T), P: zeros(T) };
  const BY_KIND = { cash: "B", risk: "X", capacity: "K", production: "P" };
  const out = [], paidByOthers = [], receivedByOthers = [];
  const shareOf = (line, u) => operatorShare(a, line, u);
  const others = (list, line, u, xs, money = true) => {
    if (xs.some((x) => Math.abs(x) > EPS)) list.push({ lineId: line.id, unitId: u.id, series: xs, pv: money ? npv(rate, xs) : null });
  };
  for (const line of lines) {
    const base = { id: line.id, label: line.label, kind: line.kind, paths: line.paths ?? [], missing: !!line.missing };
    if (line.kind === "hours") {
      out.push({ ...base, hours: years.map((t) => rawHours(line, t) * area(line, t) * factor(line, t)) });
    } else if (line.kind === "cost") {
      const ls = blank(line.startYear) ? s : line.startYear;
      let full;
      if (line.flow) full = { cost: years.map((t) => line.flow(t, ctx)), residual: zeros(T) };
      else {
        full = line.timing === "capital" ? scheduleCapital(line, T, ls, herd) : billAnnual(line, T, ls, herd);
        // A blank price is listed only where it is used: a line whose quantity is 0 in every year changes nothing (9.5 item 7).
        if (full.blankPrice) notices.push({ type: "quoteRequired", lineId: line.id });
        if (full.commitPastHorizon) {
          notices.push({ type: "commitPastHorizon", lineId: line.id, label: line.label ?? line.id, horizon: T,
            commitYears: line.commitYears, fee: num(line.earlyTerminationFee) });
        }
        if (line.basis === "perHeadYear") notices.push(...shortMonths(line, herd, ls, T));
      }
      const cost = zeros(T), residual = zeros(T);
      for (const part of costParts(line, units, full, ls, herd, T)) {
        const sh = shareOf(line, part.u);
        years.forEach((t) => { cost[t] += sh * part.cost[t]; residual[t] += sh * part.residual[t]; });
        others(paidByOthers, line, part.u, years.map((t) => (1 - sh) * (part.cost[t] - part.residual[t])));
      }
      cost.forEach((x, t) => (series.C[t] += x));
      residual.forEach((x, t) => (series.R[t] += x));
      out.push({ ...base, series: cost, residual, purchases: full.purchases, pv: npv(rate, cost), pvResidual: npv(rate, residual) });
    } else {
      // Steps 1 and 3–5, then each part (step 2) × valuePerUnit (6) × its operator share (7).
      const before = years.map((t) => (counts(line, t) ? line.claim(t, ctx) * cattle(line, t) * scaled(line, t) : 0));
      const value = years.map((t) => (before[t] ? line.valuePerUnit(t, ctx) : 0));
      const claims = zeros(T), operatorClaims = zeros(T), flow = zeros(T);
      for (const { u, w } of partsOf.get(line)) {
        const sh = shareOf(line, u);
        const partClaims = years.map((t) => before[t] * w(t));
        years.forEach((t) => {
          claims[t] += partClaims[t];
          operatorClaims[t] += sh * partClaims[t];
          flow[t] += sh * partClaims[t] * value[t];
        });
        const rest = partClaims.map((c, t) => (1 - sh) * (line.kind === "capacity" ? c : c * value[t]));
        others(receivedByOthers, line, u, rest, line.kind !== "capacity");
      }
      flow.forEach((x, t) => (series[BY_KIND[line.kind]][t] += x));
      out.push({ ...base, pool: line.pool ?? null, claims, operatorClaims, series: flow, pv: npv(rate, flow) });
    }
  }
  if (a.labor && !replacesPaidWork(a.labor)) notices.push({ type: "absorbed" });
  for (const line of lines) if (line.missing) notices.push({ type: "notEntered", lineId: line.id, label: line.label });
  // Value of gain outside $0.10 to $5/lb, for a class the production line counts (F4; 9.5 item 11).
  if (lines.some((l) => l.id === "production")) {
    for (const c of (a.production?.classes ?? []).filter((k) => SOLD.includes(k))) {
      const v = a.classes?.[c]?.valueOfGain;
      if (!blank(v) && (v < 0.1 || v > 5)) notices.push({ type: "valueOfGainRange", class: c, value: v });
    }
  }

  const { C, B, R, X, K, P } = series;
  const N = years.map((t) => B[t] + R[t] - C[t]);
  const pv = Object.fromEntries(Object.entries(series).map(([k, xs]) => [k, npv(rate, xs)]));
  // Metrics (9.3): risk, capacity and production never enter cash NPV, BCR, IRR or payback.
  const cashNPV = npv(rate, N);
  const s0 = firstFlowYear(C, B, R);
  const pvHM = npv(rate, herd.HM.map((hm, t) => (t >= 1 ? hm : 0)));
  const freed = years.map((t) => ctx.hoursFreed[t] * unitArea(t));
  const operatorFreed = out.find((l) => l.id === "hoursFreed")?.operatorClaims ?? freed;
  return {
    T, rate, startYear: s, years, C, B, R, X, K, P, N, pv,
    cashNPV,
    cashNPVWithRisk: cashNPV + pv.X,
    economicNPV: cashNPV + pv.X + pv.K + pv.P,
    bcr: isZero(pv.C) ? null : (pv.B + pv.R) / pv.C,
    firstFlowYear: s0,
    irr: irr(N, s0),
    payback: payback(N, s0),
    discountedPayback: payback(N.map((x, t) => x / (1 + rate) ** t), s0),
    noCashFlows: years.every((t) => isZero(C[t]) && isZero(B[t]) && isZero(R[t])),
    costPerHeadMonth: pvHM > 0 ? pv.C / pvHM : null,
    hoursFreedPerYear: T ? sum(operatorFreed.slice(1)) / T : 0,
    HM: herd.HM,
    hours: { saved: ctx.hoursSaved, paidCut: ctx.paidHoursCut.map((h, t) => h * unitArea(t)), paidAdded: ctx.paidHoursAdded,
      unpaidAdded: ctx.unpaidHoursAdded, freed, factor: ctx.laborFactor },
    pools,
    lines: out,
    paidByOthers,
    receivedByOthers,
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
 * analysis's claims taken before its own clamp, which the scale replaces. When the analyses claiming a pool in a year
 * report different baselines, the largest is used, with a warning. An analysis claims a pool in a year when its claim
 * on it is above 0 then; the warnings name only those analyses, and only their baselines count.
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
    // In each year the baseline is the largest among the analyses that claim the pool in that year; an analysis whose
    // claim that year is 0 (its land unit's lease has ended, for example) is not compared. In a year with no claim the
    // scale is 1, and the baseline is reported from the claimants, or with none from the analyses that enter one.
    const claimingIn = (t) => claimants.filter((x) => x.p.claims[t] > EPS);
    const basis = claimants.length ? claimants : by.filter((x) => x.p.baseline !== null);
    const baseline = basis.length ? years.map((t) => {
      const inYear = claimingIn(t).length ? claimingIn(t) : basis;
      return Math.max(...inYear.map((x) => x.p.baseline[t]));
    }) : null;
    // The baselines matter only in a year with claims, so the warning names the first such year in which they differ.
    const differ = years.find((t) => claimingIn(t).some((x) => Math.abs(x.p.baseline[t] - baseline[t]) > EPS));
    if (differ !== undefined) {
      const named = claimingIn(differ);
      warnings.push({ type: "baselinesDiffer", pool, year: differ, modules: named.map((x) => analyses[x.i].module),
        values: named.map((x) => x.p.baseline[differ]), largest: baseline[differ] });
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
 * The 9.2 validation errors built so far: the horizon, start years, the F5 cost-line fields, the F1 labor fields, the
 * F3 class rules, and the F6 land-unit, operator-share and fence rules.
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
  validateLand(a, s, err);
  return errors;
}

/** A line's label for a validation message, by its id (9.4). */
function lineLabel(a, id) {
  if (id.startsWith("added:")) return a.labor?.added?.[Number(id.slice(6))]?.label ?? id;
  if (id.startsWith("risk:")) {
    const r = a.riskLines?.[Number(id.slice(5))];
    return r ? riskLabel(r, sharesCause(a, r)) : id;
  }
  const labels = { laborCut: LABOR_CUT_LABEL[a.module] ?? "Hired labor cut", avoidedHire: "Avoided hire", production: "Weight gain",
    hoursFreed: "Hours freed", fewerChecks: "Losses from fewer physical checks", handling: "Handling labor",
    fence: a.vf?.fence?.mode === "deferred" ? "Interior fence deferred" : "Interior fence avoided" };
  return labels[id] ?? a.costs?.[id]?.label ?? id;
}

/**
 * The F6 rules of 9.2: a leased unit's lease term; land-unit shares that sum to 1 (water and virtual fence); every
 * operator share within 0–1; and, while there are fence miles, the fence's life, its build year (not before the
 * module starts), the years deferred (deferred mode) and its land unit.
 */
function validateLand(a, s, err) {
  const units = a.settings?.landUnits ?? [];
  units.forEach((u, i) => {
    if (u.kind === "leased" && !wholeYears(u.leaseYears)) err(`settings.landUnits.${i}.leaseYears`, "Lease term", YEARS_MESSAGE);
  });
  if (a.module !== "eid" && units.length) {
    const total = sum(units.map((u) => num(u.share)));
    if (Math.abs(total - 1) > 1e-9) {
      err("settings.landUnits", "Land units", `Land units: the shares add up to ${show(total * 100)}%; they must add up to 100%.`);
    }
  }
  const shares = [
    ...Object.entries(a.costs ?? {}).map(([id, c]) => [`costs.${id}.operatorShare`, c.operatorShare, id, true]),
    ...Object.entries(a.costShares ?? {}).map(([id, v]) => [`costShares.${id}`, v, id, true]),
    ...Object.entries(a.benefitShares ?? {}).map(([id, v]) => [`benefitShares.${id}`, v, id, false]),
  ];
  for (const [path, v, id, cost] of shares) {
    // A share is a number or a map by land unit, never a per-year array (9.2).
    const values = Array.isArray(v) ? [NaN] : v !== null && typeof v === "object" ? Object.values(v) : [v];
    if (values.some((x) => !blank(x) && !(x >= 0 && x <= 1))) {
      const label = cost ? "Who pays for this?" : "Who receives this saving?";
      err(path, label, `${label} (${lineLabel(a, id)}): enter the operator's share, from 0% to 100%.`);
    }
  }
  const f = a.vf?.fence;
  if (a.module === "vf" && f && num(f.miles) > 0) {
    if (!wholeYears(f.Lf)) err("vf.fence.Lf", "Fence life", YEARS_MESSAGE);
    if (!yearIndex(f.k)) err("vf.fence.k", "Fence build year", "Fence build year: enter a whole number, 0 or more.");
    else if (f.k < s) err("vf.fence.k", "Fence build year", `Fence build year: cannot be before year ${s}, when the module starts.`);
    if (f.mode === "deferred" && !yearIndex(f.d)) err("vf.fence.d", "Years deferred", "Years deferred: enter a whole number, 0 or more.");
    if (!blank(f.landUnitId) && !units.some((u) => u.id === f.landUnitId)) {
      err("vf.fence.landUnitId", "Land unit the fence is on", "Land unit the fence is on: choose one of the land units.");
    }
  }
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
