// Ranch technology ROI engine (phase 1). Pure functions, no dependencies. The rules are those of
// docs/audit/phase1-spec.md: the data model in 9.2 and the formulas in 9.3. Phase 1 builds this engine in steps
// (9.1); until step 6 the page keeps running on today's model, in v1.js.
// Money is in today's US dollars, before tax; the discount rate is real. Years run t = 0..T.
// Built so far: cost lines with the capital scheduler, billing and commitments (F5), labor (F1), pools with the
// single-module clamp and combine() (F9), head-months, head-based quantities and the cattle-presence rule (F3), and the
// metrics with the IRR and payback states (F8), production and risk lines (F4, F7), land units, operator shares and
// the fence (F6), the ramp (B3), the three modules: water monitoring (B7), virtual fencing, and EID tags and scale
// (B4a), and the N-year test and "What would make it pay" (B9).

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

/** o[k] when k is o's own key, else undefined: an id from a link never reads an inherited member such as "toString". */
export const own = (o, k) => (o !== null && typeof o === "object" && Object.hasOwn(o, k) ? o[k] : undefined);

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
 * A cost line's quantity in year t (9.3): fixed 1; perDevice its qty, or the head of its classes when it lists any
 * (times qtyPerHead, which a module sets for items per head, such as batteries per collar or the retag rate);
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
  if (line.basis === "perDevice") return head * (line.qtyPerHead ?? 1); // a module's items per head (9.3)
  return 12 * head;
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
  // An amount values the purchases made before T, so a line with none (as in an N-year test that ends before the line
  // starts or its quantity first rises) has no residual (9.3).
  if (mode === "amount" && cohorts.length) residual[T] += num(line.residual.dollars);
  purchases.sort((x, y) => x.year - y.year);
  return { cost, residual, purchases, lastCost, blankPrice };
}

/**
 * Annual line (9.3 Timing and Commitments). Season t, for t = s+1..T, is billed in year t − 1 in advance and in
 * year t in arrears, at the price and quantity of season t. Inside the commitment (seasons s+1..s+commitYears) the
 * billed quantity is at least minQty (for perHeadYear, 12 × minQty head, 9.2 field notes). A commitment that runs past
 * T charges its early-termination fee in year T. herd (herdOf) is needed for a quantity taken from head counts.
 * Returns { cost, residual, bills: [{year, qty, unitCost}], commitPastHorizon, blankPrice } with cost by year (an
 * annual line has no residual) and each season's bill by the year it is paid; blankPrice is true when a season with a
 * quantity billed is priced blank ("Quote required", counted as 0).
 */
export function billAnnual(line, T, s, herd) {
  const cost = zeros(T);
  const advance = billingOf(line) === "advance";
  const commitYears = num(line.commitYears);
  const minQty = (line.basis === "perHeadYear" ? 12 : 1) * num(line.minQty);
  let blankPrice = false;
  const bills = [];
  for (let t = s + 1; t <= T; t++) {
    const qty = quantity(line, t, herd);
    const billedQty = t <= s + commitYears ? Math.max(qty, minQty) : qty;
    if (billedQty > 0 && blank(at(line.unitCost, t))) blankPrice = true;
    const unitCost = num(at(line.unitCost, t)), year = advance ? t - 1 : t;
    cost[year] += unitCost * billedQty;
    bills.push({ year, qty: billedQty, unitCost });
  }
  // A line that starts in year T or later has no flows, which only the N-year test allows (9.3, B9).
  const commitPastHorizon = commitYears > 0 && s < T && s + commitYears > T;
  if (commitPastHorizon) cost[T] += num(line.earlyTerminationFee);
  return { cost, residual: zeros(T), bills, commitPastHorizon, blankPrice };
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

// ---------------------------------------------------------------- modules (B7, virtual fence, B4a)

/** The module lines' labels on the page (9.4), by module and line id. */
export const LINE_LABELS = {
  water: { monitors: "Monitors", mounting: "Mounting", subscription: "Subscription", batteries: "Batteries and repairs",
    vehicle: "Vehicle" },
  vf: { subscription: "Subscription", collars: "Purchased collars", serviceFee: "Service fee", collarBatteries: "Collar batteries",
    baseStations: "Base stations", infrastructure: "Infrastructure", collarLoss: "Collar loss" },
  eid: { cowTags: "Cow tags", calfTags: "Calf tags", retags: "Retags", reader: "Reader", indicatorBars: "Indicator and load bars",
    platform: "Platform", software: "Software", premium: "Net program premium", dosing: "Dosing savings" },
};

/**
 * The module lines whose timing, basis and billing 9.3 and the 9.2 field notes fix (Virtual fence lines; EID lines and
 * premium: cow tags are bought per animal and leave with it, calf tags and retags are used up each season and billed
 * in arrears). They take the place of whatever the stored line holds.
 */
const FIXED_TIMING = {
  vf: { collars: { timing: "capital", basis: "perDevice" }, serviceFee: { timing: "annual", basis: "perDevice", billing: "advance" },
    collarBatteries: { timing: "annual", billing: "arrears" }, collarLoss: { timing: "annual", billing: "arrears" } },
  eid: { cowTags: { timing: "capital", basis: "perDevice" }, calfTags: { timing: "annual", billing: "arrears" },
    retags: { timing: "annual", billing: "arrears" } },
};

/** The classes a virtual fence analysis enrolls (never a sale flow, 9.2). */
const enrolledClasses = (a) => Object.keys(a.enrolled ?? {}).filter((c) => !SALE_FLOWS.includes(c));
const headPaths = (a, classes) => classes.map((c) => (a.module === "vf" ? `enrolled.${c}.head` : `classes.${c}.head`));

/**
 * The analysis's cost lines (9.2, 9.4): each line stored in a.costs, with its label and what its module derives.
 * Water: the monitors, subscription and batteries lines count water.monitors. Virtual fence: the subscription, or the
 * purchased collars and the service fee (by vf.pricing), and the collar batteries count the enrolled classes, the
 * batteries at vf.batteriesPerCollar per collar; the collarLoss line, built from vf.collarLoss, counts
 * pctPerYear × enrolled head at chargePerCollar (9.3 Virtual fence lines). EID: the cow tags (from the classes on the
 * cowTags line, cows by default; they leave with the animal), the calf tags (from calvesBorn) and the retags
 * (retagPct × the cow-tag classes' head) are priced at eid.tagPrice, and marked as tag lines for the free tags (9.3).
 */
function moduleCostLines(a) {
  const m = a.module, costs = { ...(a.costs ?? {}) };
  if (m === "vf" && a.vf?.collarLoss && !costs.collarLoss) costs.collarLoss = {};
  const pricing = a.vf?.pricing;
  const skip = (id) => m === "vf" && ((pricing === "leased" && (id === "collars" || id === "serviceFee"))
    || (pricing === "purchased" && id === "subscription"));
  const cowClasses = costs.cowTags?.classes?.length ? costs.cowTags.classes : ["cows"];
  return Object.entries(costs).filter(([id]) => !skip(id)).map(([id, c]) => {
    const line = { ...c, id, kind: "cost", label: own(LINE_LABELS[m], id) ?? c.label ?? id, ...own(FIXED_TIMING[m], id) };
    let paths = null;
    if (m === "water" && ["monitors", "subscription", "batteries"].includes(id) && !blank(a.water?.monitors)) {
      Object.assign(line, { basis: "perDevice", qty: a.water.monitors });
      paths = [`costs.${id}.unitCost`, "water.monitors"];
    } else if (m === "vf" && ["subscription", "collars", "serviceFee", "collarBatteries", "collarLoss"].includes(id)) {
      if (!c.classes?.length) line.classes = enrolledClasses(a);
      if (id === "collarBatteries") Object.assign(line, { basis: "perDevice", qtyPerHead: num(a.vf?.batteriesPerCollar) });
      if (id === "collarLoss") {
        const loss = a.vf?.collarLoss ?? {};
        Object.assign(line, { basis: "perDevice", qtyPerHead: num(loss.pctPerYear), unitCost: loss.chargePerCollar });
        paths = ["vf.collarLoss.pctPerYear", "vf.collarLoss.chargePerCollar", ...headPaths(a, line.classes)];
      } else if (id === "collarBatteries") {
        paths = [`costs.${id}.unitCost`, "vf.batteriesPerCollar", ...headPaths(a, line.classes)];
      }
    } else if (m === "eid" && ["cowTags", "calfTags", "retags"].includes(id)) {
      const classes = id === "calfTags" ? ["calvesBorn"] : cowClasses;
      Object.assign(line, { basis: "perDevice", classes, unitCost: a.eid?.tagPrice, tag: true });
      if (id === "cowTags") line.perAnimal = true;
      if (id === "retags") line.qtyPerHead = num(a.eid?.retagPct);
      paths = ["eid.tagPrice", ...(id === "retags" ? ["eid.retagPct"] : []), ...headPaths(a, classes)];
    }
    line.paths = c.paths ?? paths ?? costPaths(a, id, line);
    return line;
  });
}

/** A water block's cap on its share of runs avoided (9.3): (runs a week − minimum visits) ÷ runs a week; 0 with no runs. */
export function shareCap(block) {
  const runs = num(block.runsPerWeek);
  return runs > 0 ? Math.max(0, (runs - num(block.minVisitsPerWeek)) / runs) : 0;
}

/**
 * The share of a block's runs avoided that the analysis uses (9.3): as entered, at most its cap. A blank share is 0, as
 * is the default of a block flagged for freezing or the feeding route.
 */
export const shareUsed = (block) => Math.min(num(block.shareAvoided), shareCap(block));

/**
 * The water module's benefit lines (B7, 9.3 Water runs and vehicle). Runs avoided, Σ_b runsPerWeek × weeks ×
 * capped share, are the claim on waterRuns (the vehicle line) and the source of the hours saved (runHours, which takes
 * the pool's scale but adds no claim). Vehicle: runs avoided × miles per run × variable cost per mile; hours saved:
 * runs avoided × hours per run, each per run averaged over the blocks by runs avoided.
 */
function waterLines(a) {
  const w = a.water ?? {}, list = w.blocks ?? [];
  const blocks = list.map((b) => ({ b, avoided: num(b.runsPerWeek) * num(b.weeks) * shareUsed(b) }));
  const avoided = sum(blocks.map((x) => x.avoided));
  const perRun = (f) => (avoided > 0 ? sum(blocks.map((x) => x.avoided * num(x.b[f]))) / avoided : 0);
  const blockPaths = (f) => list.flatMap((b, i) => ["runsPerWeek", "weeks", "shareAvoided", f].map((k) => `water.blocks.${i}.${k}`));
  // The vehicle counts 0 because of a blank (9.5 item 4) when its cost per mile is blank, or when it avoids no runs and
  // a block that could avoid runs (one with runs and a cap above 0) has its share blank. A blank share beside a block
  // that still avoids runs is listed under its own label instead.
  const withRuns = list.filter((b) => num(b.runsPerWeek) * num(b.weeks) > 0);
  const sharesBlank = avoided === 0 && withRuns.some((b) => blank(b.shareAvoided) && shareCap(b) > 0);
  return [
    { id: "vehicle", label: "Vehicle", kind: "cash", pool: "waterRuns", claim: () => avoided,
      valuePerUnit: () => perRun("milesPerRun") * num(w.variableCostPerMile), missing: blank(w.variableCostPerMile) || sharesBlank,
      paths: [...blockPaths("milesPerRun"), "water.variableCostPerMile"] },
    { id: "runHours", label: "Hours saved on water runs", kind: "hours", pool: "waterRuns", derived: true,
      claim: () => avoided, hoursPerUnit: perRun("hoursPerRun"), paths: blockPaths("hoursPerRun") },
  ];
}

/**
 * The page's warnings on the water blocks (9.5 item 11): a share above 0% on a block flagged for freezing or the
 * feeding route, and a share typed above its block's cap on a block with runs (the cap is what counts, 9.3).
 */
function waterNotices(a) {
  const found = [];
  for (const b of a.water?.blocks ?? []) {
    const share = num(b.shareAvoided);
    if (b.freezeOrFeedRoute && share > 0) found.push({ type: "freezeShare", block: b.name, share });
    if (num(b.runsPerWeek) * num(b.weeks) > 0 && share > shareCap(b) + EPS) {
      found.push({ type: "shareAboveCap", block: b.name, cap: shareCap(b), share });
    }
  }
  return found;
}

/**
 * The virtual fence's hours saved (9.3 Labor): the moving and gathering hours cut, the module's one claim on
 * gatherHours, and the health-check riding hours cut, outside the pool, which support paid hours cut only with a
 * validated alert function (vf.validatedAlert). The fence line comes from fenceLine().
 */
function vfLines(a) {
  const v = a.vf ?? {};
  return [
    { id: "gatherHoursCut", label: "Moving and gathering hours cut", kind: "hours", pool: "gatherHours",
      claim: (t) => num(at(v.gatherHoursCut, t)), paths: ["vf.gatherHoursCut"] },
    { id: "healthCheckHoursCut", label: "Health-check riding hours cut", kind: "hours", eligible: v.validatedAlert === true,
      claim: (t) => num(at(v.healthCheckHoursCut, t)), paths: ["vf.healthCheckHoursCut"] },
  ];
}

/**
 * The EID module's benefit lines (B4a, 9.3 EID lines and premium). Net program premium: head in program (calves sold)
 * × (sale weight × premium − verification fee). Dosing savings: Σ over the classes in dosing.applications of head ×
 * applications × saving per application. Recording time today: hours saved.
 */
function eidLines(a) {
  const e = a.eid ?? {}, p = e.premium ?? {}, d = e.dosing ?? {};
  const apps = Object.entries(d.applications ?? {});
  return [
    { id: "premium", label: "Net program premium", kind: "cash", claim: (t) => num(at(a.classes?.calvesSold?.head, t)),
      valuePerUnit: () => num(p.saleCwt) * num(p.premiumPerCwt) - num(p.verificationFee),
      // A blank counts as 0 (9.5 item 7): with the sale weight or the premium blank, the line is the verification fee
      // alone, and it is listed as not entered only while that leaves it at 0 (9.5 item 4).
      missing: (blank(p.saleCwt) || blank(p.premiumPerCwt)) && num(p.verificationFee) === 0,
      paths: ["classes.calvesSold.head", "eid.premium.saleCwt", "eid.premium.premiumPerCwt", "eid.premium.verificationFee"] },
    { id: "dosing", label: "Dosing savings", kind: "cash", claim: () => 1,
      valuePerUnit: (t) => sum(apps.map(([c, n]) => num(at(a.classes?.[c]?.head, t)) * num(n))) * num(d.perApplication),
      missing: blank(d.perApplication) || !apps.some(([, n]) => !blank(n)), // a count typed as 0 is entered
      paths: ["eid.dosing.perApplication", ...apps.flatMap(([c]) => [`eid.dosing.applications.${c}`, `classes.${c}.head`])] },
    { id: "recordingHours", label: "Recording time today", kind: "hours", claim: (t) => num(at(e.recordingHoursToday, t)),
      paths: ["eid.recordingHoursToday"] },
  ];
}

/**
 * The classes "Does the EID rule apply to cattle you move?" is asked for (9.4): the inventory classes with head above
 * 0 in some year 0..T, never the sale flows, in the class order of 9.2.
 */
export function eidRuleClasses(a) {
  const years = [...Array(a.settings.T + 1).keys()];
  return Object.keys(CLASS_NAMES).filter((c) => !SALE_FLOWS.includes(c)
    && years.some((t) => num(at(a.classes?.[c]?.head, t)) > 0));
}

/**
 * Free tags (B4a, 9.3): in each listed billing year t, up to freeTags.qty tags (entry t of an array) cost $0. They go
 * first to the tags billed that year on the cow-tag line, then the calf tags, then the retags, whether or not the rule
 * applies; tags not used in a year do not carry over. Lowers each tag line's cost by year, in place.
 */
function applyFreeTags(a, lines, schedules, T) {
  const f = a.eid?.freeTags;
  if (a.module !== "eid" || !f) return;
  const left = zeros(T);
  for (const y of f.years ?? []) if (Number.isInteger(y) && y >= 0 && y <= T) left[y] = num(at(f.qty, y));
  for (const id of ["cowTags", "calfTags", "retags"]) {
    const line = lines.find((l) => l.id === id && l.tag);
    const full = line && schedules.get(line);
    if (!full) continue;
    for (const b of full.purchases ?? full.bills) {
      const free = Math.min(left[b.year], b.qty);
      if (!(free > 0)) continue;
      full.cost[b.year] -= free * b.unitCost;
      left[b.year] -= free;
    }
  }
}

/** The inputs the handling hours multiply (9.3 Labor), for the provenance rules. */
function handlingPaths(a, h) {
  return [...new Set([...(h.events ?? []).flatMap((e, i) => [...["timesPerYear", "minutesPerHead", "crewSize"].map((f) => `labor.handling.events.${i}.${f}`),
    ...headPaths(a, e.classes ?? [])]),
  ...["gathers", "gatherRiders", "hoursPerGather", "trainingDays", "trainingRiders", "hoursPerDay"].map((f) => `labor.handling.${f}`)])];
}

/**
 * Handling hours by year (9.3 Labor; virtual fence and EID): Σ over the events of times a year × the head of its classes
 * × minutes per head × crew ÷ 60, plus gathers × riders × hours per gather, plus training days × riders × hours per
 * day. They fall at year end in the module's operating years s+1..T, and only in a year with head-months. Training
 * days given by year take entry t; a single number applies in every operating year.
 */
export function handlingHours(a, herd, s, T) {
  const h = a.labor?.handling;
  return [...Array(T + 1).keys()].map((t) => {
    if (!h || t <= s || !(herd.HM[t] > 0)) return 0;
    const events = sum((h.events ?? []).map((e) => num(e.timesPerYear) * sum((e.classes ?? []).map((c) => herd.head(c, t)))
      * num(e.minutesPerHead) * num(e.crewSize) / 60));
    return events + num(h.gathers) * num(h.gatherRiders) * num(h.hoursPerGather)
      + num(at(h.trainingDays, t)) * num(h.trainingRiders) * num(h.hoursPerDay);
  });
}

// ---------------------------------------------------------------- lines and analysis

/**
 * The analysis's lines (9.2): its cost lines, with the quantities, classes and prices its module derives (9.4); the
 * module's benefit lines and hours saved (water: vehicle and the hours of the runs avoided; virtual fence: the fence
 * and the hours cut; EID: premium, dosing and recording time); the labor lines derived from a.labor with their fixed
 * ids (handling and added:<i> when paid, laborCut, avoidedHire); the hours saved that no module input covers
 * (otherHoursSaved, kind "hours"); weight gain and the risk lines; and the capacity line hoursFreed.
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
  const lines = moduleCostLines(a);
  if (a.module === "vf" && num(a.vf?.fence?.miles) > 0) lines.push(fenceLine(a));
  if (a.module === "water") lines.push(...waterLines(a));
  if (a.module === "vf") lines.push(...vfLines(a));
  if (a.module === "eid") lines.push(...eidLines(a));
  const L = a.labor;
  if (L) {
    const h = L.handling;
    if (h?.doneBy === "paid") {
      const rate = num(h.paidRate) * (1 + num(h.loadPct));
      lines.push({ id: "handling", label: "Handling labor", kind: "cost", flow: (t, ctx) => ctx.handlingHours[t] * rate,
        paths: ["labor.handling.paidRate", "labor.handling.loadPct", ...handlingPaths(a, h)] });
    }
    (L.added ?? []).forEach((item, i) => {
      if (item.doneBy !== "paid") return;
      const rate = num(item.paidRate) * (1 + num(item.loadPct));
      lines.push({ id: `added:${i}`, label: item.label, kind: "cost", flow: (t) => addedHours(item.hours, t, s, T) * rate,
        paths: ["hours", "paidRate", "loadPct"].map((f) => `labor.added.${i}.${f}`) });
    });
    if (L.cut) {
      const pay = L.cut.laborUnit === "position" ? ["salary"] : ["hoursPerUnit", "paidRate"];
      lines.push({
        // Not ramped itself: it follows the ramped hours through f_t (9.3 Labor).
        id: "laborCut", label: LABOR_CUT_LABEL[a.module] ?? "Hired labor cut", kind: "cash", ramp: false,
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
  // those hours come from: the hours saved, the paid hours cut and the unpaid added and handling hours (9.3; the
  // rounding rule, 7.3).
  const cutPaths = L?.cut && replacesPaidWork(L)
    ? ["labor.cut.unitsCut", ...(L.cut.laborUnit === "hour" ? [] : ["labor.cut.hoursPerUnit"])] : [];
  const unpaidPaths = [...(L?.added ?? []).flatMap((item, i) => (item.doneBy === "paid" ? [] : [`labor.added.${i}.hours`])),
    ...(L?.handling && L.handling.doneBy !== "paid" ? handlingPaths(a, L.handling) : [])];
  lines.push({
    id: "hoursFreed", label: "Hours freed", kind: "capacity", fromStartYear: true, ramp: false, // from the ramped hours
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
  const v = stored !== null && typeof stored === "object" ? (Object.hasOwn(stored, u.id) ? stored[u.id] : undefined) : stored;
  if (!blank(v)) return v;
  if (line.fence) return u.kind === "leased" && u.raw.fenceBuiltBy === "landlord" ? 0 : 1;
  if (a.module === "water" && WATER_RUN_LINES.includes(line.id) && waterCare(u)) return 0;
  return 1;
}

/**
 * The part of a staysWithLand capital line's leaseReimbursement that each leased unit receives at its lease end (9.3):
 * leaseReimbursement × share ÷ Σ share over the units whose lease ends within the horizon (from landUnitsOf) and whose
 * part had a purchase before its T'. A Map from the unit's number n to the amount.
 */
function reimbursements(line, units, s, herd) {
  const bought = units.filter((u) => u.end !== null && scheduleCapital(line, u.end, s, herd).purchases.length);
  const total = sum(bought.map((u) => u.share));
  return new Map(bought.map((u) => [u.n, total > 0 ? num(line.leaseReimbursement) * u.share / total : 0]));
}

/**
 * A cost line's parts by land unit (9.3): each unit's share of the line as scheduled, except a capital line marked
 * staysWithLand on a unit whose lease ends at T'. That part runs through the scheduler with horizon T' (no purchase
 * in year T' or later, no repair after T') and takes as its residual at T' its part of leaseReimbursement, as the
 * full horizon allocates it (alloc: the full horizon's land units and herd). The N-year test keeps that allocation: a
 * unit whose lease ends within the test but not within the full horizon (N > T) receives 0 (9.3, B9).
 */
function costParts(line, units, full, s, herd, T, alloc) {
  const part = (u) => ({ u, cost: full.cost.map((x) => x * u.share), residual: full.residual.map((x) => x * u.share) });
  if (line.timing !== "capital" || !line.staysWithLand || line.flow) return units.map(part);
  const paid = reimbursements(line, alloc.units, s, alloc.herd);
  return units.map((u) => {
    if (u.end === null) return part(u);
    const cost = zeros(T), residual = zeros(T);
    scheduleCapital(line, u.end, s, herd).cost.forEach((x, t) => (cost[t] = x * u.share));
    residual[u.end] = paid.get(u.n) ?? 0;
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
 * ends at T' with no renewal expected runs both streams to T' (no purchase in year T' or later), so every fence flow
 * after T' is 0. The residual at T' is the unit's fenceReimbursement when the tenant builds, and the straight-line
 * residual when the landlord provides the fence, whose stream is listed under "Received by others" (at T' = T, the
 * whole stream of 10.1 row 22(a)). Returns { capital, upkeep }.
 */
export function fenceStream(a, unit) {
  const f = a.vf.fence, T = a.settings.T;
  const leased = unit?.kind === "leased";
  const fence = { ...f, m: leased && unit.raw.fenceMaintainedBy === "landlord" ? 0 : f.m };
  const tenantBuilds = !(leased && unit.raw.fenceBuiltBy === "landlord");
  const end = unit?.end ?? null;
  const H = end ?? T;
  // fenceReimbursement is what the lease pays the tenant for the fence (9.2), so it is the residual of a fence the
  // tenant builds; a landlord's fence keeps its straight-line residual at T' (judgment).
  const endResidual = end !== null && tenantBuilds ? num(unit.raw.fenceReimbursement) : null;
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
    pool: "fenceMiles", fence: true, anyYear: true, requiresCattle: false, ramp: false, // avoided capital is not ramped
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
    const months = c.basis === "perHeadMonth" ? [`${a.module === "vf" ? "enrolled" : "served"}.${k}.months`] : [];
    paths.push(a.module === "vf" ? `enrolled.${k}.head` : `classes.${k}.head`, ...months);
  }
  return paths;
}

/**
 * Runs the analysis on the given lines (buildLines(a), plus any test fixtures). Assumes validate(a) found no errors.
 * Each benefit line's claim in year t goes through the order of operations of 9.3 as built so far: the raw claim;
 * the land-unit split, with a leased unit's part 0 after its lease ends (F6); the ramp (B3; not for a line marked
 * `ramp: false`); the cattle-presence rule (0 in a year t ≥ 1 with no head-months, for a line that requires cattle);
 * the pool's single-module clamp, or the combine() scale passed in opts.scales ({ [pool]: scale by year }), which
 * replaces it (9.6); × valuePerUnit; and the operator share (F6). opts.fullT, in the N-year test, is the full horizon,
 * whose allocation of lease-end reimbursements the test keeps (B9). Hours saved take the same factors up to the scale,
 * and paid hours cut and cash labor saved follow them through f_t (9.3 Labor). A cost line is split by land unit too, with its operator share.
 * Returns the operator's series by year (C cost, B cash benefit, R residual, X expected losses avoided, K capacity
 * value, P production, N = B + R − C), their present values, cash NPV, BCR, IRR and payback on N, the head-months
 * HM, the labor hours by year (with the handling hours), each pool's { baseline, claims, scale } (claims before the
 * clamp), each line's series and PV with its operator's part on each land unit (byUnit: [{unitId, series, ...}], so the
 * page can show each line by land unit), the amounts that are not the operator's (paidByOthers, receivedByOthers: [{lineId, unitId, series, pv}],
 * hours with pv null for hoursFreed), and notices for the page.
 */
export function analyzeLines(a, lines, opts = {}) {
  const T = a.settings.T, rate = a.settings.discountRate, s = a.startYear ?? 0;
  const years = [...Array(T + 1).keys()];
  const operating = (t) => t > s && t <= T;
  const herd = herdOf(a, T);
  const ctx = { a, T, s, HM: herd.HM, herd };
  const notices = [];

  // Land units (F6, 9.3): each line's parts, w(t) its share of the line in year t after the lease-end rule. The
  // lease-end reimbursements are allocated over the full horizon's leases, opts.fullT in the N-year test (B9).
  const units = landUnitsOf(a);
  const fullT = opts.fullT ?? T;
  const alloc = fullT === T ? { units, herd }
    : { units: landUnitsOf({ ...a, settings: { ...a.settings, T: fullT } }), herd: herdOf(a, fullT) };
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
    notices.push(...waterNotices(a));
  }
  // B4a: a "yes" to the EID rule question changes no line until B4b; it shows the pending-verification notice (9.4).
  if (a.module === "eid" && eidRuleClasses(a).some((c) => a.eid?.ruleApplies?.[c] === true)) notices.push({ type: "eidRulePending" });

  // Cattle-presence rule (9.3): in a year t ≥ 1 with no head-months, a line that requires cattle counts 0.
  const noCattle = (t) => t >= 1 && !(herd.HM[t] > 0);
  for (const t of years) if (noCattle(t)) notices.push({ type: "noCattle", year: t });
  const cattle = (line, t) => (line.requiresCattle !== false && noCattle(t) ? 0 : 1);
  const counts = (line, t) => line.anyYear || operating(t) || (line.fromStartYear && t === s);
  // Ramp (B3, 9.3): ramp[i] in the module's i-th operating year, year s + i, for i = 1..3; 1 from year s + 4 on (it is
  // not carried forward). An absent entry takes the default, 1 (9.2); a cleared one counts as 0, like any other
  // cleared advanced input (9.5 item 7).
  const rampAt = (t) => {
    const v = t - s >= 1 && t - s <= 3 ? a.ramp?.[t - s] : undefined;
    return v === undefined ? 1 : num(v);
  };
  const ramped = (line, t) => (line.ramp === false ? 1 : rampAt(t));
  // Each ramp entry is its own input, path "ramp.<i>" (9.2: the ramp is not a per-year array; 9.5 item 8 records
  // "ramp.1"). An entry is an input of a line only when it lowers an operating year within the horizon (a blank
  // entry, which counts as 0, among them).
  const rampPaths = [1, 2, 3].filter((i) => s + i <= T && a.ramp?.[i] !== undefined && rampAt(s + i) < 1).map((i) => `ramp.${i}`);
  const claimed = (line, t) => (counts(line, t) ? line.claim(t, ctx) * area(line, t) * ramped(line, t) * cattle(line, t) : 0);

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
  const factor = (line, t) => ramped(line, t) * cattle(line, t) * scaled(line, t);
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
  ctx.handlingHours = handlingHours(a, herd, s, T);
  const handlingPaid = labor.handling?.doneBy === "paid";
  const addedBy = (paid) => years.map((t) => sum((labor.added ?? [])
    .filter((item) => (item.doneBy === "paid") === paid).map((item) => addedHours(item.hours, t, s, T)))
    + (handlingPaid === paid ? ctx.handlingHours[t] : 0));
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
  // Cost lines as scheduled (F5), then the free tags (B4a), which lower the tag lines before they are split.
  const startOf = (line) => (blank(line.startYear) ? s : line.startYear);
  const schedules = new Map(lines.filter((l) => l.kind === "cost").map((line) => {
    const ls = startOf(line);
    if (line.flow) return [line, { cost: years.map((t) => line.flow(t, ctx)), residual: zeros(T) }];
    const full = line.timing === "capital" ? scheduleCapital(line, T, ls, herd) : billAnnual(line, T, ls, herd);
    // A blank price is listed only where it is used: a line whose quantity is 0 in every year changes nothing (9.5 item 7).
    if (full.blankPrice) notices.push({ type: "quoteRequired", lineId: line.id });
    if (full.commitPastHorizon) {
      notices.push({ type: "commitPastHorizon", lineId: line.id, label: line.label ?? line.id, horizon: T,
        commitYears: line.commitYears, fee: num(line.earlyTerminationFee) });
    }
    if (line.basis === "perHeadYear") notices.push(...shortMonths(line, herd, ls, T));
    return [line, full];
  }));
  applyFreeTags(a, lines, schedules, T);

  for (const line of lines) {
    // A benefit line other than the fence also rests on the ramp entries, directly or through the ramped hours (B3).
    const paths = [...(line.paths ?? []), ...(["cost", "hours"].includes(line.kind) || line.fence ? [] : rampPaths)];
    const base = { id: line.id, label: line.label, kind: line.kind, paths, missing: !!line.missing };
    if (line.kind === "hours") {
      out.push({ ...base, hours: years.map((t) => rawHours(line, t) * area(line, t) * factor(line, t)) });
    } else if (line.kind === "cost") {
      const ls = startOf(line), full = schedules.get(line);
      const cost = zeros(T), residual = zeros(T), byUnit = [];
      for (const part of costParts(line, units, full, ls, herd, T, alloc)) {
        const sh = shareOf(line, part.u);
        years.forEach((t) => { cost[t] += sh * part.cost[t]; residual[t] += sh * part.residual[t]; });
        byUnit.push({ unitId: part.u.id, series: part.cost.map((x) => sh * x), residual: part.residual.map((x) => sh * x) });
        others(paidByOthers, line, part.u, years.map((t) => (1 - sh) * (part.cost[t] - part.residual[t])));
      }
      cost.forEach((x, t) => (series.C[t] += x));
      residual.forEach((x, t) => (series.R[t] += x));
      out.push({ ...base, series: cost, residual, byUnit, purchases: full.purchases, pv: npv(rate, cost), pvResidual: npv(rate, residual) });
    } else {
      // Steps 1 and 3–5, then each part (step 2) × valuePerUnit (6) × its operator share (7).
      const before = years.map((t) => (counts(line, t) ? line.claim(t, ctx) * ramped(line, t) * cattle(line, t) * scaled(line, t) : 0));
      const value = years.map((t) => (before[t] ? line.valuePerUnit(t, ctx) : 0));
      const claims = zeros(T), operatorClaims = zeros(T), flow = zeros(T), byUnit = [];
      for (const { u, w } of partsOf.get(line)) {
        const sh = shareOf(line, u);
        const partClaims = years.map((t) => before[t] * w(t));
        years.forEach((t) => {
          claims[t] += partClaims[t];
          operatorClaims[t] += sh * partClaims[t];
          flow[t] += sh * partClaims[t] * value[t];
        });
        byUnit.push({ unitId: u.id, claims: partClaims.map((c) => sh * c), series: partClaims.map((c, t) => sh * c * value[t]) });
        const rest = partClaims.map((c, t) => (1 - sh) * (line.kind === "capacity" ? c : c * value[t]));
        others(receivedByOthers, line, u, rest, line.kind !== "capacity");
      }
      flow.forEach((x, t) => (series[BY_KIND[line.kind]][t] += x));
      out.push({ ...base, pool: line.pool ?? null, claims, operatorClaims, series: flow, byUnit, pv: npv(rate, flow) });
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
      unpaidAdded: ctx.unpaidHoursAdded, handling: ctx.handlingHours, freed, factor: ctx.laborFactor },
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

// ---------------------------------------------------------------- horizon prefill (F2)

/** The step-2 note when the horizon is the fallback of 5 years (F2, 9.2). */
export const HORIZON_NOTE = "5 years assumed: no contract term or asset life entered.";

/**
 * The horizon for a state that has none (9.2 settings.T, F2): the largest commitYears above 0 among the module's cost
 * lines; else the lifeYears of the capital line with the largest year-0 cost among those with a lifeYears, the first
 * in costs order on a tie; else 5, assumed. Only cost lines count, so the fence block does not. A line that starts
 * after year 0 has no year-0 cost. In phase 1 only a hand-made version 2 link whose settings have no T reaches it
 * (10.1 row 51). Returns { T, assumed }.
 */
export function defaultHorizon(a) {
  const lines = moduleCostLines(a);
  const commits = lines.filter((l) => l.timing === "annual" && Number.isInteger(l.commitYears) && l.commitYears > 0);
  if (commits.length) return { T: Math.max(...commits.map((l) => l.commitYears)), assumed: false };
  const s = num(a.startYear);
  let best = null;
  for (const line of lines.filter((l) => l.timing === "capital" && Number.isInteger(l.lifeYears) && l.lifeYears >= 1)) {
    const ls = blank(line.startYear) ? s : line.startYear;
    const cost0 = ls === 0 ? scheduleCapital({ ...line, repairPct: 0 }, 1, 0, herdOf(a, 1)).cost[0] : 0;
    if (!best || cost0 > best.cost0) best = { cost0, life: line.lifeYears };
  }
  return best ? { T: best.life, assumed: false } : { T: 5, assumed: true };
}

// ---------------------------------------------------------------- the N-year test and what would make it pay (B9)

/** The payback target N (9.2): a whole number of years, 5 when the state has none. */
export const paybackTargetOf = (a) => a.settings.paybackTarget ?? 5;

const range = (from, to) => (to < from ? [] : [...Array(to - from + 1).keys()].map((i) => from + i));

/** The value at a path ("water.blocks.0.shareAvoided"), or undefined. */
function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
}

/**
 * The analysis with the value at a path set to v (9.5 item 6), creating the objects (or, before an index, the lists)
 * on the way. Pure: it copies only the objects on the path, and shares the rest, which the engine never changes. It
 * sets an input and nothing else (no `prov`, no flags): what typing does to the state is state.js's setInput.
 */
export function setPath(a, path, v) {
  const keys = path.split(".");
  const put = (o, i) => {
    const k = keys[i];
    const base = o ?? (/^\d+$/.test(k) ? [] : {});
    const copy = Array.isArray(base) ? [...base] : { ...base };
    copy[k] = i === keys.length - 1 ? v : put(base[k], i + 1);
    return copy;
  };
  return put(a, 0);
}

/**
 * The analysis run again with horizon N in place of T and every other input unchanged (9.3, the N-year test). Every
 * rule applies with N as the horizon: per-year inputs are read through year N, a shorter array carrying its last value
 * (so a longer one is in effect cut to N + 1 entries; past T, each carries year T's value, whatever a list holds after
 * it); purchases, repairs, upkeep and billing follow N, and a
 * commitment that runs past N charges its fee in year N; a lease that ends within N follows the lease-end rule, with
 * the reimbursement the full horizon allocates; straight-line residuals are valued at N, and pctOfCost and amount
 * residuals are used as entered. null when the module starts in year N or later, so the test has no flows; a line
 * that starts in year N or later has none in it (the rule startYear < T is not applied to the test). N is the payback
 * target by default.
 */
export function nYearRun(a, N = paybackTargetOf(a)) {
  if ((a.startYear ?? 0) >= N) return null;
  const T = a.settings.T;
  const b = { ...(N > T ? cutToHorizon(a, T) : a), settings: { ...a.settings, T: N } };
  return analyzeLines(b, buildLines(b), { fullT: T });
}

// Lists of numbers that are not values by year (9.2): the ramp, by operating year, and the free tags' billing years.
const NOT_PER_YEAR = new Set(["ramp", "eid.freeTags.years"]);

/**
 * The analysis with each per-year input cut to its T + 1 entries (years 0..T, 9.2), so that a test past T carries
 * year T's value to year N, as 9.3 says, and never reads entries a list holds past the horizon (a link or a lowered T
 * can leave them; the page shows years 0..T only).
 */
function cutToHorizon(x, T, path = "") {
  if (Array.isArray(x)) {
    if (x.every((v) => v === null || typeof v === "number")) return NOT_PER_YEAR.has(path) ? x : x.slice(0, T + 1);
    return x.map((v, i) => cutToHorizon(v, T, `${path}.${i}`));
  }
  if (x === null || typeof x !== "object") return x;
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, k === "prov" && !path ? v : cutToHorizon(v, T, path ? `${path}.${k}` : k)]));
}

// Two warnings are the same when they come from the same notice about the same line, class, land unit, pool or water
// block, whatever horizon or year their text names (9.3).
const NOTICE_SUBJECTS = ["lineId", "class", "unit", "pool", "block"];
const noticeKey = (n) => [n.type, ...NOTICE_SUBJECTS.map((k) => n[k] ?? "")].join("|");

/**
 * The N-year test (B9, 9.3), with N the payback target: { years: N, cashNPV, pays, warnings }. cashNPV is the operator's
 * cash NPV before tax over years 0..N at the analysis's real rate; pays is true when it is 0 or more, false when it is
 * below 0, and null when the test has no cash flows for the operator (C, B and R each below $0.005 in every year 0..N),
 * as when the module starts in year N or later. warnings lists the notices the N-year run raises that the full-horizon
 * run (full, analyze(a) by default) does not, each once. Assumes validate(a) found no errors.
 */
export function targetTest(a, full = analyze(a)) {
  const N = paybackTargetOf(a);
  const r = nYearRun(a, N);
  const seen = new Set(full.notices.map(noticeKey));
  const warnings = (r?.notices ?? []).filter((n) => {
    const key = noticeKey(n);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { years: N, cashNPV: r ? r.cashNPV : 0, pays: !r || r.noCashFlows ? null : r.cashNPV >= 0, warnings };
}

/**
 * A per-year input over the years it is used (9.3): entry y is the first above 0 in those years, else the first year's
 * entry; varies is true when the entries differ across those years (an array whose entries are all equal is treated
 * like a single number).
 */
function yearEntry(v, years) {
  const y = years.find((t) => num(at(v, t)) > 0) ?? years[0];
  const value = at(v, y);
  return { y, value, varies: Array.isArray(v) && years.some((t) => num(at(v, t)) !== num(value)) };
}

/** A per-year input moved to v at entry y (9.3): every entry × v ÷ entry y, or every entry v when entry y is 0 or blank. */
function scaleTo(x, v, entered) {
  if (!Array.isArray(x)) return v;
  if (!(num(entered) > 0)) return x.map(() => v);
  return x.map((e) => (blank(e) ? e : e * v / entered));
}

/** A number or per-year array × f, blanks kept. */
const times = (x, f) => (Array.isArray(x) ? x.map((e) => times(e, f)) : blank(x) ? x : x * f);

const IN_PROPORTION = (label, y) => `${label} (year ${y}; other years in proportion)`;

/**
 * A driver that moves one input at a path (9.3): its entered value is entry y over the years the input is used, and
 * its label ends " (year y; other years in proportion)" when it is a per-year array whose entries differ there.
 * blank: the input is left blank (entered null).
 */
function pathDriver(a, d, years) {
  const raw = getPath(a, d.path);
  const e = yearEntry(raw, years);
  const isBlank = blank(raw) || (Array.isArray(raw) && raw.every(blank));
  return { ...d, label: e.varies ? IN_PROPORTION(d.label, e.y) : d.label, entered: isBlank ? null : num(e.value), blank: isBlank, na: d.na ?? null };
}

/** The years a module's cost line uses its unitCost (9.3): purchase years s..T−1 on a capital line, seasons s+1..T on an annual one. */
function priceYears(a, id) {
  const line = moduleCostLines(a).find((l) => l.id === id);
  const s = blank(line?.startYear) ? a.startYear ?? 0 : line.startYear;
  return line?.timing === "capital" ? range(s, a.settings.T - 1) : range(s + 1, a.settings.T);
}

/** A price driver (9.3): one cost line's unitCost. Its blank reads "Quote required" (9.5 item 9). */
const priceDriver = (a, id, label, unit, hi) =>
  ({ ...pathDriver(a, { id, path: `costs.${id}.unitCost`, label, unit, lo: 0, hi }, priceYears(a, id)), price: true });

const LABOR_HI = { hour: 10000, day: 365, week: 52, position: 10 };
const LABOR_UNITS = { hour: "hours", day: "days", week: "weeks", position: "positions" };

/**
 * Why a hired-labor driver is "n/a" (9.3), or null: freed time is absorbed, so no units are cut; or a field that 9.2
 * requires for units cut above 0 is blank (hoursPerUnit, paidRate or salary, and loadPct, by labor unit), or
 * hoursPerUnit is 0, so a cut has no cash value or no paid hours to check.
 */
function laborNa(a) {
  const cut = a.labor.cut, u = cut.laborUnit;
  if (!replacesPaidWork(a.labor)) return "absorbed";
  const needs = [...(u === "hour" ? [] : ["hoursPerUnit"]), u === "position" ? "salary" : "paidRate", "loadPct"];
  return needs.some((f) => blank(cut[f])) || !(hoursPerUnit(cut) > 0) ? "payNotEntered" : null;
}

/**
 * Herd size (9.3), in every module: the head in year y of the first served or enrolled class, in the class order of
 * 9.2, whose head is above 0 in some operating year (enrolled head for virtual fence, inventory head otherwise); y is
 * the first operating year in which it is above 0. Its set multiplies every head count (each class's head, the heifers
 * kept and the enrolled head, in every year), the free-tag quantities and the minQty of every line whose quantity comes
 * from head by the value ÷ the entered value, so every quantity that depends on head scales in proportion. "n/a" (no
 * head entered) with no such class.
 */
function herdDriver(a) {
  const years = range((a.startYear ?? 0) + 1, a.settings.T), herd = herdOf(a, a.settings.T);
  const order = Object.keys(CLASS_NAMES).filter((c) => herd.listed.includes(c));
  const c = order.find((k) => years.some((t) => herd.head(k, t) > 0));
  const d = { id: "herd", path: "herd", label: "Herd size", unit: CLASS_NAMES[c ?? order[0]] ?? "head", lo: 1, hi: 10000, blank: false };
  if (c === undefined) return { ...d, entered: 0, na: "noHead" };
  const y = years.find((t) => herd.head(c, t) > 0), entered = herd.head(c, y);
  const varies = years.some((t) => herd.head(c, t) !== entered);
  return { ...d, label: varies ? IN_PROPORTION(d.label, y) : d.label, entered, na: null, set: (b, v) => scaleHerd(b, v / entered) };
}

/** Every head count, free-tag quantity and head-based minQty × f (the herd-size driver, 9.3). */
function scaleHerd(a, f) {
  let next = a;
  const scale = (path) => {
    const x = getPath(next, path);
    if (x !== undefined) next = setPath(next, path, times(x, f));
  };
  Object.keys(a.classes ?? {}).forEach((c) => scale(`classes.${c}.head`));
  scale("heifersRetained");
  Object.keys(a.enrolled ?? {}).forEach((c) => scale(`enrolled.${c}.head`));
  if (a.eid?.freeTags) scale("eid.freeTags.qty");
  for (const line of moduleCostLines(a)) {
    const fromHead = ["perHeadMonth", "perHeadYear"].includes(line.basis) || (line.basis === "perDevice" && (line.classes ?? []).length > 0);
    if (fromHead && a.costs?.[line.id] && !blank(a.costs[line.id].minQty)) scale(`costs.${line.id}.minQty`);
  }
  return next;
}

/** The water drivers (9.3 table): each season block's share, the vehicle cost per mile, hired labor, the two prices, herd size. */
function waterDrivers(a) {
  const w = a.water ?? {}, T = a.settings.T, s = a.startYear ?? 0, out = [];
  (w.blocks ?? []).forEach((b, i) => {
    if (!(num(b.runsPerWeek) > 0 && num(b.weeks) > 0)) return; // a block with no runs has nothing to act on
    const d = pathDriver(a, { id: `share:${i}`, path: `water.blocks.${i}.shareAvoided`,
      label: `Share of runs avoided in ${b.name ?? `block ${i + 1}`}`, unit: "%", lo: 0, hi: shareCap(b) }, [s + 1]);
    // The share the analysis uses: as entered, at most the block's cap (9.3; 10.1 row 50(d)).
    out.push(d.blank ? d : { ...d, entered: shareUsed(b) });
  });
  if (w.blocks?.length) {
    out.push(pathDriver(a, { id: "vehicle", path: "water.variableCostPerMile", label: "Vehicle cost per mile", unit: "$/mi", lo: 0, hi: 5 }, [s + 1]));
  }
  if (a.labor?.cut) {
    const u = a.labor.cut.laborUnit;
    out.push(pathDriver(a, { id: "laborCut", path: "labor.cut.unitsCut", label: "Hired labor cut", unit: LABOR_UNITS[u] ?? "hours",
      lo: 0, hi: LABOR_HI[u] ?? LABOR_HI.hour, na: laborNa(a) }, range(s + 1, T)));
  }
  if (a.costs?.monitors) out.push(priceDriver(a, "monitors", "Monitor price", "$ per monitor", 10000));
  if (a.costs?.subscription) out.push(priceDriver(a, "subscription", "Subscription per monitor", "$ per monitor per year", 5000));
  return [...out, herdDriver(a)];
}

/**
 * The virtual fence drivers (9.3 table): the fence miles and cost per mile, the hired moving and gathering hours cut,
 * the subscription or service fee by vf.pricing, and herd size.
 */
function vfDrivers(a) {
  const v = a.vf ?? {}, T = a.settings.T, s = a.startYear ?? 0, out = [];
  if (v.fence) {
    // The fence miles move the plan with them (9.3): a plan below the entered miles keeps its ratio, so a clamp stays
    // as entered; otherwise the plan is raised to cover the miles. A blank plan keeps defaulting to the miles.
    const fenceMiles = (b, x) => {
      const f = b.vf.fence, m0 = num(f.miles);
      let plan = f.planMiles;
      if (!blank(plan) && plan < m0) plan = plan * x / m0;
      else if (!blank(plan) && plan < x) plan = x;
      return setPath(setPath(b, "vf.fence.miles", x), "vf.fence.planMiles", plan);
    };
    out.push({ ...pathDriver(a, { id: "fenceMiles", path: "vf.fence.miles", label: "Interior fence that would otherwise be built",
      unit: "mi", lo: 0, hi: 200 }, [s + 1]), set: fenceMiles });
    out.push(pathDriver(a, { id: "fenceCost", path: "vf.fence.F", label: "Fence cost per mile", unit: "$/mi", lo: 0, hi: 50000 }, [s + 1]));
  }
  if (a.labor?.cut) out.push(hoursCutDriver(a, range(s + 1, T)));
  if (v.pricing === "leased" && a.costs?.subscription) out.push(priceDriver(a, "subscription", "Subscription", "$/head/month", 20));
  if (v.pricing === "purchased" && a.costs?.serviceFee) out.push(priceDriver(a, "serviceFee", "Service fee", "$ per collar per year", 1000));
  return [...out, herdDriver(a)];
}

/**
 * Hired moving and gathering hours cut (9.3): the paid hours cut a year, unitsCut × hoursPerUnit at entry y. Its set
 * moves labor.cut.unitsCut to the value ÷ hoursPerUnit (a per-year array in proportion) and vf.gatherHoursCut by the
 * change in entry y's hours, so the paid hours cut stay within the hours cut.
 */
function hoursCutDriver(a, years) {
  const cut = a.labor.cut, e = yearEntry(cut.unitsCut, years), na = laborNa(a), per = hoursPerUnit(cut);
  const d = pathDriver(a, { id: "hoursCut", path: "labor.cut.unitsCut", label: "Hired moving and gathering hours cut", unit: "h/yr",
    lo: 0, hi: 10000, na }, years);
  // Its value is the paid hours cut, units cut × hours per unit (9.3), on an n/a row too. With the hours per unit blank
  // or 0 there are no hours to show, so that n/a row shows the units cut in their own unit, as the water driver does
  // (judgment).
  const entered = d.blank ? null : num(e.value) * (per > 0 ? per : 1);
  if (na) return { ...d, entered, unit: per > 0 ? d.unit : LABOR_UNITS[cut.laborUnit] ?? "hours" };
  const set = (b, x) => {
    const cut = b.labor.cut, per = hoursPerUnit(cut), was = num(yearEntry(cut.unitsCut, years).value);
    const g = b.vf?.gatherHoursCut, delta = x - was * per;
    return setPath(setPath(b, "labor.cut.unitsCut", scaleTo(cut.unitsCut, x / per, was)), "vf.gatherHoursCut",
      Array.isArray(g) ? g.map((h) => num(h) + delta) : num(g) + delta);
  };
  return { ...d, entered, set };
}

/** The EID drivers (9.3 table): herd size, the net program premium, the tag price, the reader and scale cost, added hours. */
function eidDrivers(a) {
  const T = a.settings.T, s = a.startYear ?? 0, years = range(s + 1, T), out = [herdDriver(a)];

  // Net program premium: the net premium a year at the head in program (calves sold) in year y; a blank counts 0.
  const head = (b, t) => num(at(b.classes?.calvesSold?.head, t));
  const p = a.eid?.premium ?? {};
  const premium = { id: "premium", path: "eid.premium", label: "Net program premium", unit: "$/yr", lo: 0, hi: 100000, blank: false };
  const y = years.find((t) => head(a, t) > 0);
  if (y === undefined) out.push({ ...premium, entered: 0, na: "noCalvesSold" });
  else {
    const varies = years.some((t) => head(a, t) !== head(a, y));
    out.push({ ...premium, label: varies ? IN_PROPORTION(premium.label, y) : premium.label, na: null,
      entered: head(a, y) * (num(p.saleCwt) * num(p.premiumPerCwt) - num(p.verificationFee)),
      // Only the net amount enters cash, so the trial sets it as one premium per cwt on 1 cwt (judgment, 9.3).
      set: (b, v) => setPath(b, "eid.premium", { saleCwt: 1, premiumPerCwt: v / head(b, y), verificationFee: 0 }) });
  }

  if (["cowTags", "calfTags", "retags"].some((id) => a.costs?.[id])) {
    out.push({ ...pathDriver(a, { id: "tagPrice", path: "eid.tagPrice", label: "Tag price", unit: "$/tag", lo: 0, hi: 20 }, range(s, T)), price: true });
  }

  // Reader and scale cost: the sum of the reader, indicator and load bars, and platform prices, each moved in proportion.
  const ids = ["reader", "indicatorBars", "platform"].filter((id) => a.costs?.[id]);
  if (ids.length) {
    const first = (id) => num(at(a.costs[id].unitCost, priceYears(a, id)[0]));
    const total = sum(ids.map(first));
    out.push({ id: "readerScale", path: "readerScale", label: "Reader and scale cost", unit: "$", lo: 0, hi: 50000, price: true,
      entered: total, blank: ids.every((id) => blank(a.costs[id].unitCost)), na: total > 0 ? null : "noReaderCost",
      set: (b, v) => ids.reduce((n, id) => setPath(n, `costs.${id}.unitCost`, times(n.costs[id].unitCost, v / total)), b) });
  }

  // Added hours: the handling hours and labor.added hours of year y; every handling time input and added item's hours
  // move in proportion.
  const herd = herdOf(a, T), handling = handlingHours(a, herd, s, T);
  const added = (t) => handling[t] + sum((a.labor?.added ?? []).map((item) => addedHours(item.hours, t, s, T)));
  const ya = years.find((t) => added(t) > 0);
  const hours = { id: "addedHours", path: "addedHours", label: "Added hours", unit: "h/yr", lo: 0, hi: 2000, blank: false };
  if (ya === undefined) out.push({ ...hours, entered: 0, na: "noAddedHours" });
  else {
    const entered = added(ya), varies = years.some((t) => added(t) !== entered);
    const set = (b, v) => {
      const f = v / entered;
      let n = b;
      const scale = (path) => {
        const x = getPath(n, path);
        if (x !== undefined) n = setPath(n, path, times(x, f));
      };
      (b.labor?.handling?.events ?? []).forEach((_, i) => scale(`labor.handling.events.${i}.minutesPerHead`));
      if (b.labor?.handling) ["hoursPerGather", "hoursPerDay"].forEach((k) => scale(`labor.handling.${k}`));
      (b.labor?.added ?? []).forEach((_, i) => scale(`labor.added.${i}.hours`));
      return n;
    };
    out.push({ ...hours, label: varies ? IN_PROPORTION(hours.label, ya) : hours.label, entered, na: null, set });
  }
  return out;
}

/**
 * The "What would make it pay" drivers of analysis a (B9, 9.2, 9.3 table), in the table's order: [{ id, path, label,
 * unit, lo, hi, set, entered, blank, price, na }]. path is the input the driver moves, or the name of a driver that
 * moves linked inputs through set ("herd", "readerScale", "addedHours"); label and unit as the panel shows them; lo and
 * hi the search range in the stored unit (a fraction for a %); set(a, v), when present, the analysis with the driver at
 * v. entered is the driver's value as entered (null when blank: blank true), price marks a price, whose blank reads
 * "Quote required", and na names why the driver is "n/a" in both columns ("noHead", "noCalvesSold", "noReaderCost",
 * "noAddedHours", "absorbed" or "payNotEntered"), or is null. A driver whose input has nothing to act on is left out
 * (9.3); herd size, the net program premium and added hours are always returned. The version 1 lines have no driver.
 */
export function PAYBACK_DRIVERS(a) {
  if (a.module === "water") return waterDrivers(a);
  if (a.module === "vf") return vfDrivers(a);
  if (a.module === "eid") return eidDrivers(a);
  return [];
}

/**
 * The analysis with driver d (from PAYBACK_DRIVERS) at value v (9.3): through its set, else at its path, a per-year
 * array in proportion to entry y.
 */
export function moveDriver(a, d, v) {
  if (d.set) return d.set(a, v);
  return setPath(a, d.path, scaleTo(getPath(a, d.path), v, d.entered));
}

/** The 9.2 rule that a trial value breaks, of the two that bound a driver (9.3): "paidHours", "residual" or null. */
function clipReason(a) {
  if (paidHoursOver(a)) return "paidHours";
  const T = a.settings.T, s = a.startYear ?? 0;
  return moduleCostLines(a).some((l) => l.timing === "capital" && residualError(a, l, T, s)) ? "residual" : null;
}

const HALVINGS = 100;

/**
 * What would make it pay (B9, 9.3): for each driver of PAYBACK_DRIVERS(a), holding every other input as entered, the
 * value at which the N-year test's cash NPV is 0 (target) and the value at which the full-horizon cash NPV is 0
 * (horizon). The range [lo, hi], widened to include the entered value, is clipped to the values that pass the two 9.2
 * rules that bound a driver (paid hours cut within the hours saved, a residual within the cost of its purchase), by
 * bisection between the entered value and each end that breaks one. Then in each column: "none" when the cash NPV is
 * below 0 at both ends of the clipped range, "all" when it is 0 or more at both, otherwise "value", found by bisection
 * on the cash NPV, which returns the end that pays, with direction "at least" when the cash NPV is higher at the top of
 * the range and "at most" otherwise. A column is "n/a" (reason "noCashFlows") when its test has no cash flows for the
 * operator, and both are "n/a" with the driver's own reason (PAYBACK_DRIVERS). Assumes validate(a) found no errors.
 * Returns one row per driver, in order: { id, path, label, unit, entered, blank, price, lo, hi, clippedLo, clippedHi,
 * clipReasonLo, clipReasonHi, target, horizon }, with target and horizon each { state, value, direction, reason }.
 */
export function solveDrivers(a, full = analyze(a), test = targetTest(a, full)) {
  const N = test.years;
  const na = (reason) => ({ state: "n/a", value: null, direction: null, reason });
  return PAYBACK_DRIVERS(a).map((d) => {
    const lo = d.blank ? d.lo : Math.min(d.lo, d.entered), hi = d.blank ? d.hi : Math.max(d.hi, d.entered);
    const row = { id: d.id, path: d.path, label: d.label, unit: d.unit, entered: d.entered, blank: d.blank, price: !!d.price,
      lo, hi, clippedLo: null, clippedHi: null, clipReasonLo: null, clipReasonHi: null };
    const target = test.pays === null ? na("noCashFlows") : d.na ? na(d.na) : null;
    const horizon = full.noCashFlows ? na("noCashFlows") : d.na ? na(d.na) : null;
    if (target && horizon) return { ...row, target, horizon };

    const trial = (v) => moveDriver(a, d, v);
    // The clip: the entered value passes (the analysis is valid), so each end that breaks a rule is moved toward it.
    const anchor = Math.min(hi, Math.max(lo, d.blank ? 0 : d.entered));
    const clip = (end) => {
      if (clipReason(trial(end)) === null) return null;
      let good = anchor, bad = end;
      for (let i = 0; i < HALVINGS; i++) {
        const m = (good + bad) / 2;
        if (clipReason(trial(m)) === null) good = m; else bad = m;
      }
      return { value: good, reason: clipReason(trial(bad)) };
    };
    const cLo = clip(lo), cHi = clip(hi);
    if (cLo) Object.assign(row, { clippedLo: cLo.value, clipReasonLo: cLo.reason });
    if (cHi) Object.assign(row, { clippedHi: cHi.value, clipReasonHi: cHi.reason });
    const from = row.clippedLo ?? lo, to = row.clippedHi ?? hi;

    const solve = (npvAt) => {
      const fLo = npvAt(from), fHi = npvAt(to);
      if (fLo < 0 && fHi < 0) return { state: "none", value: null, direction: null, reason: null };
      if (fLo >= 0 && fHi >= 0) return { state: "all", value: null, direction: null, reason: null };
      let neg = fLo < 0 ? from : to, pos = fLo < 0 ? to : from;
      for (let i = 0; i < HALVINGS; i++) {
        const m = (neg + pos) / 2;
        if (npvAt(m) >= 0) pos = m; else neg = m;
      }
      return { state: "value", value: pos, direction: fHi > fLo ? "at least" : "at most", reason: null };
    };
    return {
      ...row,
      target: target ?? solve((v) => nYearRun(trial(v), N).cashNPV),
      horizon: horizon ?? solve((v) => analyze(trial(v)).cashNPV),
    };
  });
}

/**
 * The drivers the verdict names (9.3 Ranking, 9.5 item 1), from solveDrivers() rows: those whose N-year result is a
 * value, the smallest |value − entered| ÷ |entered| first; a driver entered as 0 or left blank after the others; ties
 * in the order of the rows. A price left blank is never named.
 */
export function rankDrivers(rows) {
  // The relative change is taken to 10 significant figures, so drivers that tie in exact arithmetic (fence miles and
  // fence cost per mile; herd size and a per-head price that is the only head-based line) tie here too, whatever the
  // round-off of their separate searches, and keep the table order (judgment: 9.3 names no tolerance).
  const change = (r) => (r.blank || r.entered === 0 ? Infinity
    : Number((Math.abs(r.target.value - r.entered) / Math.abs(r.entered)).toPrecision(10)));
  return rows.map((r, i) => ({ r, i, k: r.target.state === "value" ? change(r) : null }))
    .filter((x) => x.k !== null && !(x.r.blank && x.r.price))
    .sort((x, y) => (x.k === y.k ? x.i - y.i : x.k < y.k ? -1 : 1))
    .map((x) => x.r);
}

// ---------------------------------------------------------------- validation (9.2)

export const YEARS_MESSAGE = "Enter a whole number of years, 1 or more.";
// The longest horizon and payback target (judgment; spec issue: 9.2 gives no upper limit, and the engine builds a list
// of T + 1 years, so a link or entry of a million years would stop the page).
export const MAX_YEARS = 50;
export const MAX_YEARS_MESSAGE = `Enter ${MAX_YEARS} years or fewer.`;
const wholeYears = (v) => Number.isInteger(v) && v >= 1;
const yearIndex = (v) => Number.isInteger(v) && v >= 0;
const show = (x) => (Math.round(x * 100) / 100).toLocaleString("en-US");

/**
 * The 9.2 validation errors built so far: the horizon and the payback target, start years, the F5 cost-line fields,
 * the F1 labor fields (with the handling labor's pay and training days), the F3 class rules, and the F6 land-unit,
 * operator-share and fence rules.
 * Returns [{path, label, message}]: path is the input's path in the analysis, label its label on the page (9.4), and
 * message the text shown, which names the field unless it is the whole-years message. Nothing is computed while any
 * error remains. Later steps add their own rules (9.1). Trial values from the sensitivity features and the solver are
 * not checked by the whole-number rules (9.2); the solver clips its range by the paid-hours and residual rules (9.3, B9).
 */
export function validate(a) {
  const errors = [];
  const err = (path, label, message) => errors.push({ path, label, message });
  const T = a.settings?.T;
  const tOk = wholeYears(T) && T <= MAX_YEARS;
  if (!wholeYears(T)) err("settings.T", "Horizon", YEARS_MESSAGE);
  else if (!tOk) err("settings.T", "Horizon", MAX_YEARS_MESSAGE);
  // The payback target, N (B9): a whole number of years, 1 or more; a state without one uses 5 (9.2).
  const N = a.settings?.paybackTarget;
  if (N !== undefined && !wholeYears(N)) err("settings.paybackTarget", "Payback target", YEARS_MESSAGE);
  else if (N !== undefined && N > MAX_YEARS) err("settings.paybackTarget", "Payback target", MAX_YEARS_MESSAGE);

  const s = a.startYear ?? 0;
  const startLabel = "The year the module starts";
  if (!yearIndex(s)) err("startYear", startLabel, `${startLabel}: enter a whole number, 0 or more.`);
  else if (tOk && s >= T) err("startYear", startLabel, `${startLabel}: must be before year ${T}, the end of the horizon.`);

  // The cost lines as the module builds them (9.3): with the timing, basis, classes, quantity and price the module
  // fixes or derives, and without the lines its pricing model leaves out. Each is named by its label (9.4).
  for (const line of moduleCostLines(a)) {
    const id = line.id, p = `costs.${id}.`, name = lineLabel(a, id);
    if (!blank(line.startYear)) {
      if (!yearIndex(line.startYear)) err(p + "startYear", "Start year", `Start year (${name}): enter a whole number, 0 or more.`);
      else if (tOk && line.startYear >= T) {
        err(p + "startYear", "Start year", `Start year (${name}): must be before year ${T}, the end of the horizon.`);
      }
    }
    if (line.timing === "capital") {
      if (!(blank(line.lifeYears) || wholeYears(line.lifeYears))) err(p + "lifeYears", "Life", YEARS_MESSAGE);
      const message = residualError(a, line, tOk ? T : null, s);
      if (message) err(p + "residual", "Residual", message);
    } else if (!blank(line.commitYears) && !yearIndex(line.commitYears)) {
      err(p + "commitYears", "Commit years", `Commit years (${name}): enter a whole number of years.`);
    }
  }

  validateHerd(a, tOk ? T : null, err);
  if (a.labor) validateLabor(a, s, tOk ? T : null, err);
  validateLand(a, s, err);
  return errors;
}

/**
 * The label of labor.added item i's hours on the page (9.4), the unit they are entered in and the factor from the
 * stored value to it: water's install time (hours in the start year) and added monitoring time (entered in hours a
 * week, stored × 52), EID's added data and desk time, and any other item by its own label. Validation and the link
 * banner both name the input this way (9.5 item 11).
 */
export function addedHoursInput(a, i) {
  const items = a.labor?.added ?? [];
  const name = items[i]?.label ?? `added item ${i + 1}`;
  if (a.module === "water" && name === "install") return { label: "Install time", unit: "h", scale: 1 };
  if (a.module === "water" && name === "monitoring time") return { label: "Added monitoring time", unit: "h/wk", scale: 1 / 52 };
  if (a.module === "eid") {
    return { label: items.length > 1 ? `Added data and desk time (${name})` : "Added data and desk time", unit: "h/yr", scale: 1 };
  }
  return { label: `Hours (${name})`, unit: "h/yr", scale: 1 };
}

/**
 * The residual rule of 9.2 for a capital line (built by moduleCostLines): a residual within the cost of its purchase,
 * so a pctOfCost of 100% or less, and an amount no more than what the purchases it values cost over the horizon T
 * (not checked while T or the line's life is invalid, T null). The message, or null. The solver clips its range by it
 * (B9).
 */
function residualError(a, line, T, s) {
  const res = line.residual, name = lineLabel(a, line.id);
  if (res?.mode === "pctOfCost" && num(res.pct) > 1) return `Residual (${name}): cannot be more than 100% of the purchase cost.`;
  if (res?.mode !== "amount" || T === null || !(blank(line.lifeYears) || wholeYears(line.lifeYears))) return null;
  const { lastCost } = scheduleCapital(line, T, blank(line.startYear) ? s : line.startYear, herdOf(a, T));
  if (num(res.dollars) <= lastCost + 1e-9) return null;
  return `Residual (${name}): $${show(num(res.dollars))} is more than the $${show(lastCost)} that the purchases it values cost.`;
}

/**
 * The paid-hours rule of 9.2 (9.3 Labor): paid hours cut stay within the hours saved that can support them, taken
 * before the ramp, the cattle-presence rule and the pool scale. Returns the first operating year that breaks it, as
 * { t, paidCut, eligible }, or null. Not checked while "absorbed", when the cut counts as 0, nor while the cut has no
 * paid hours to compare (hoursPerUnit blank or 0), nor while the horizon or start year is invalid. The solver clips its
 * range by it (B9).
 */
function paidHoursOver(a) {
  const L = a.labor, cut = L?.cut, T = a.settings?.T, s = a.startYear ?? 0;
  const comparable = cut && (cut.laborUnit === "hour" || num(cut.hoursPerUnit) > 0);
  if (!comparable || !replacesPaidWork(L) || !wholeYears(T) || !yearIndex(s) || s >= T) return null;
  const herd = herdOf(a, T);
  const ctx = { a, T, s, HM: herd.HM, herd };
  const hourLines = buildLines(a).filter((l) => l.kind === "hours" && l.eligible !== false);
  for (let t = s + 1; t <= T; t++) {
    const paidCut = num(at(cut.unitsCut, t)) * hoursPerUnit(cut);
    const eligible = hoursFrom(hourLines, t, ctx);
    if (paidCut > eligible + 1e-9) return { t, paidCut, eligible };
  }
  return null;
}

/** A line's label, by its id (9.4): for validation messages and the notices that name an input of a line. */
export function lineLabel(a, id) {
  if (id.startsWith("added:")) return a.labor?.added?.[Number(id.slice(6))]?.label ?? id;
  if (id.startsWith("risk:")) {
    const r = a.riskLines?.[Number(id.slice(5))];
    return r ? riskLabel(r, sharesCause(a, r)) : id;
  }
  const labels = { laborCut: LABOR_CUT_LABEL[a.module] ?? "Hired labor cut", avoidedHire: "Avoided hire", production: "Weight gain",
    hoursFreed: "Hours freed", fewerChecks: "Losses from fewer physical checks", handling: "Handling labor",
    fence: a.vf?.fence?.mode === "deferred" ? "Interior fence deferred" : "Interior fence avoided" };
  return own(labels, id) ?? own(LINE_LABELS[a.module], id) ?? own(a.costs, id)?.label ?? id;
}

/**
 * The F6 rules of 9.2: a leased unit's lease term; one or more land units, with shares that sum to 1 (water and
 * virtual fence); every operator share within 0–1; and, while there are fence miles, the fence's life, its build year
 * (not before the module starts), the years deferred (deferred mode) and its land unit.
 */
function validateLand(a, s, err) {
  const units = a.settings?.landUnits ?? [];
  units.forEach((u, i) => {
    if (u.kind === "leased" && !wholeYears(u.leaseYears)) err(`settings.landUnits.${i}.leaseYears`, "Lease term", YEARS_MESSAGE);
  });
  // Water and virtual fence need one or more land units (9.2): a list emptied by removing its last unit is an error.
  // (An analysis that holds no list, such as a test fixture, runs as one owned unit, landUnitsOf.)
  if (a.module !== "eid" && Array.isArray(a.settings?.landUnits) && !units.length) {
    err("settings.landUnits", "Land units", "Land units: add at least one land unit, owned or leased.");
  }
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

  const h = L.handling;
  if (h) {
    if (h.doneBy === "paid") {
      const why = "because a paid hand does the handling";
      if (blank(h.paidRate)) err("labor.handling.paidRate", "Pay rate", `Pay rate (Handling labor): enter it, ${why}.`);
      if (blank(h.loadPct)) err("labor.handling.loadPct", "Payroll load", `Payroll load (Handling labor): enter it (0% if none), ${why}.`);
    }
    if (Array.isArray(h.trainingDays)) {
      const early = h.trainingDays.findIndex((d, t) => t <= s && num(d) > 0);
      if (early >= 0) {
        err("labor.handling.trainingDays", "Training days",
          `Training days: year ${early} comes before year ${s + 1}, the module's first operating year, so it cannot have training days.`);
      }
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
      const { label } = addedHoursInput(a, i);
      if (early >= 0) err(p + "hours", label, `${label}: year ${early} is before the module starts in year ${s}, so it cannot have hours.`);
    }
  });

  // Paid hours cut stay within the hours saved that can support them (9.3 Labor; its hoursPerUnit error above when
  // the cut has no paid hours to compare).
  const over = T === null ? null : paidHoursOver(a);
  if (over) {
    err("labor.cut.unitsCut", unitsLabel,
      `${unitsLabel}: the paid hours cut in year ${over.t} (${show(over.paidCut)} h) are more than the hours saved that can support them (${show(over.eligible)} h).`);
  }
}
