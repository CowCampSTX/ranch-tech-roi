// Page text for Ranch Tech ROI, built from analyze() and combine() output (docs/audit/phase1-spec.md, 9.5). Pure
// functions, no DOM, so node tests check every string the page will show. Phase 1 adds to it step by step (9.1);
// the page shows it from step 6. Built so far: the formats and names of 9.5 items 9 and 11; the notices of F1, F3,
// F4, F5, F6 and F7 and the pool warnings of F9 (9.5 items 4 and 11); the state texts, tiles and verdict of F8; and,
// with the modules, the water-block warnings, the EID rule notice (B4a), the price labels (9.5 item 4) and the
// examples' banners (9.5 item 5); the input labels and link banners (B8, 9.5 items 8 and 11); and the payback-target
// line, the "It would pay" sentence and the "What would make it pay" panel (B9, 9.5 items 1 and 9).
import { addedHoursInput, buildLines, CLASS_NAMES, LINE_LABELS, lineLabel as lineName, own, priceUnit, rankDrivers } from "./roi.js";
import { EXAMPLE_NAMES } from "./examples.js";
import { V1_FIELDS } from "./v1.js";

const MINUS = "−";

/** Help texts the page shows beside an input (9.3 Production). */
export const HELP = {
  valueOfGain: "Dollars per pound of added weight, not the sale price per pound: heavier cattle sell for fewer dollars a "
    + "pound. USDA NASS's \"calves\" price covers animals under 500 lb.",
};

/** Generic module names (9.5 item 11); a fixture module is named by its own id. */
export const MODULE_NAMES = {
  water: "Remote water monitoring",
  vf: "Collar-based virtual fencing",
  eid: "EID tags and scale",
};

const POOL_NAMES = {
  waterRuns: "water runs",
  gatherHours: "moving and gathering hours",
  fenceMiles: "interior fence miles",
};

/** The input that gives a pool's baseline, where it can be left blank while a claim is made (9.6, 9.5 item 11). */
const BASELINE_INPUTS = { gatherHours: "moving and gathering hours today" };

export const moduleName = (id) => MODULE_NAMES[id] ?? id;
export const className = (c) => CLASS_NAMES[c] ?? c;

/** A pool as the notices name it: "water runs", "death loss (water)". */
export function poolName(pool) {
  if (pool.startsWith("deathLoss:")) return `death loss (${pool.slice("deathLoss:".length)})`;
  return POOL_NAMES[pool] ?? pool;
}

const signed = (x, body) => (x < 0 && /[1-9]/.test(body) ? MINUS : "") + body;

/** A quantity: two decimals, thousands separators, and no ".00" (9.5 item 11). */
export function quantity(x) {
  const body = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return signed(x, body.replace(/\.00$/, ""));
}

/** Money: whole dollars at $100 or more, cents below, thousands separators, and no ".00" (9.5 item 9). */
export function money(x) {
  const abs = Math.abs(x);
  const body = abs >= 100
    ? Math.round(abs).toLocaleString("en-US")
    : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\.00$/, "");
  return signed(x, "$" + body);
}

/** A share stored as a fraction, shown as a percent: 0.5 → "50%", 0.255 → "25.50%" (9.2, 9.5 item 11). */
export const percent = (x) => `${quantity(x * 100)}%`;

/** A count with its unit, singular when it shows as 1 or −1: "1 year", "2 years", "−1 hour", "5 months". */
export function count(n, unit) {
  const q = quantity(n);
  return `${q} ${q.replace(MINUS, "") === "1" ? unit : `${unit}s`}`;
}

/** Joins with "and", with commas before it when there are more than two (9.5 item 11). */
export function joinAnd(items) {
  if (items.length < 2) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The B4a notice while the EID rule question is answered yes for any class (9.4, 10.1 row 36). */
export const EID_RULE_NOTICE = "Compliance treatment is pending verification of the rule's current status. All tags are "
  + "counted as project costs here, which may understate the case for EID if your tags are required anyway. Check with "
  + "your state veterinarian.";

/**
 * The text of a notice from analyze() or a warning from combine() (9.5 item 11), or null for a notice whose text
 * comes with a later item.
 */
export function noticeText(n) {
  switch (n.type) {
    case "noCattle":
      return `No cattle in year ${n.year}: benefits not counted.`;
    case "absorbed":
      return "Freed time is absorbed, so no cash labor saving is counted.";
    case "leaseEnds":
      return `The lease on land unit ${n.unit} ends in year ${n.year}, inside the ${n.horizon}-year horizon. Its share of `
        + "each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at "
        + "the lease end and are credited any reimbursement.";
    case "waterCare":
      return `On land unit ${n.unit}, ${n.reason === "landlord" ? "the landlord provides and checks the water" : "water care is included in the lease rate"}, `
        + "so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'.";
    case "notEntered":
      return `${n.label}: not entered, not counted`;
    case "valueOfGainRange":
      return `Value of gain ${money(n.value)}/lb is outside the usual range of $0.10 to $5/lb. Check that it is entered in $/lb, not $/cwt (100 lb).`;
    case "valueOfGainAboveSale":
      return "Value of gain is normally below the sale price per pound.";
    case "quoteWeights":
      return "Value of gain: the heavier quote's weight must be above the base quote's weight.";
    case "commitPastHorizon":
      return `The horizon (${count(n.horizon, "year")}) ends inside the ${n.commitYears}-year contract on ${n.label}, `
        + `so its early-termination fee (${money(n.fee)}) is charged in year ${n.horizon}.`;
    case "perHeadYearMonths":
      return `${n.label} is billed for 12 months per head, but the ${className(n.class)} are `
        + `${n.enrolled ? "enrolled" : "served"} for ${count(n.months, "month")} in year ${n.year}. Check how your quote bills.`;
    case "poolClamp":
      return `The claim on ${poolName(n.pool)} is above the baseline in year ${n.year} (${quantity(n.claim)} against `
        + `${quantity(n.baseline)}), so it is counted only up to the baseline.`;
    case "baselineBlank":
      return `Enter ${BASELINE_INPUTS[n.pool] ?? `the baseline for ${poolName(n.pool)}`} to check the claim on ${poolName(n.pool)}.`;
    case "poolShared":
      return `${joinAnd(n.modules.map(moduleName))} claim the same ${poolName(n.pool)}: together ${quantity(n.claim)} `
        + `against a baseline of ${quantity(n.baseline)} in year ${n.year}, so each claim is scaled down in proportion.`;
    case "freezeShare":
      return `The ${n.block} block is marked 'tanks freeze / water checked on the feeding route', so its share of runs `
        + `avoided is normally 0%. Check the ${percent(n.share)} you entered.`;
    case "shareAboveCap":
      return `The ${n.block} block's share of runs avoided is limited to ${percent(n.cap)} by the minimum visits; you entered ${percent(n.share)}.`;
    case "eidRulePending":
      return EID_RULE_NOTICE;
    case "baselinesDiffer":
      return `${joinAnd(n.modules.map(moduleName))} report different baselines for ${poolName(n.pool)} in year ${n.year} `
        + `(${joinAnd(n.values.map(quantity))}); the largest, ${quantity(n.largest)}, is used.`;
    default:
      return null;
  }
}

// ---------------------------------------------------------------- metrics, tiles and verdict (F8)

/** IRR as the page shows it (9.3 Metrics): a percent to one decimal with thousands separators, or its state. */
export function irrText(x) {
  switch (x.state) {
    case "noFlows": return "n/a: no cash flows";
    case "noOutlay": return `n/a: no net outlay in year ${x.year}`;
    case "signChanges": return "n/a: cash flows change sign more than once";
    case "below0": return "below 0%";
    case "above": return "above 10,000%";
    default: return `${(x.value * 100).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  }
}

/** Payback (or discounted payback) as the page shows it (9.3 Metrics): years to two decimals, or its state. */
export function paybackText(p) {
  switch (p.state) {
    case "noFlows": return "n/a: no cash flows";
    case "noOutlay": return "no net outlay: cumulative cash never negative";
    case "none": {
      let text = `none within ${count(p.T, "year")}`;
      if (p.noOutlayYear !== undefined) text += ` (no net outlay in year ${p.noOutlayYear}; cumulative negative from year ${p.negativeFrom})`;
      if (p.positiveYears.length) text += ` (positive in year(s) ${p.positiveYears.join(", ")}, negative again by year ${p.T})`;
      return text;
    }
    default: {
      let text = `${p.years.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} years`;
      if (p.earlyPositive !== undefined) text += ` (cumulative was positive in year ${p.earlyPositive}, then negative again before year ${p.before})`;
      if (p.s0 > 0) text += ` (counted from year 0; the first cash flow is in year ${p.s0})`;
      return text;
    }
  }
}

const FIRST_HAND = ["A", "D"];

/**
 * The rounding unit of the headline figures (7.3): $100 when every material input is [A] or [D], else $1,000. A line
 * is material when its |PV| is at least 10% of PV(B) + PV(R); its inputs are its `paths`, each with the class of its
 * `prov` record. A material line with no recorded inputs counts as not first-hand.
 */
export function roundingUnit(a, r) {
  const floor = 0.1 * (r.pv.B + r.pv.R);
  const material = r.lines.filter((l) => Math.abs(l.pv ?? 0) >= floor && Math.abs(l.pv ?? 0) > 0);
  const firstHand = (l) => (l.paths ?? []).length > 0 && l.paths.every((p) => FIRST_HAND.includes(a.prov?.[p]?.cls));
  return material.every(firstHand) ? 100 : 1000;
}

/** A headline NPV on a tile (9.5 item 2): "about −$11,000", or "about break-even" when it rounds to $0. */
export function aboutMoney(x, unit) {
  const rounded = Math.round(Math.abs(x) / unit) * unit;
  return rounded === 0 ? "about break-even" : `about ${signed(x, "$" + rounded.toLocaleString("en-US"))}`;
}

/** True while the rate shows the example's label: an example's unedited value, not one from a version 1 link (9.5 item 5). */
export function exampleRate(a) {
  const p = a.prov?.["settings.discountRate"];
  return p?.cls === "E" && p.src !== "version 1 link";
}

/**
 * The verdict sentence (9.5 item 1): the amount over T years at the rate, before tax; the state by the "pays" rule of
 * 9.3; when cash NPV is below 0 and there are cash benefits, the rise they would need; and, given the tornado's bars
 * (tornado(a, r).bars, widest first), "It turns most on" the entries with the two longest bars (none without bars).
 */
export function verdictSentence(a, r, bars = []) {
  if (r.noCashFlows) return "No cash flows for you in this analysis.";
  const unit = roundingUnit(a, r);
  const pct = quantity(r.rate * 100);
  const rate = exampleRate(a) ? `the example's ${pct}% real rate (an assumption, not a recommendation)` : `your ${pct}% real rate`;
  const X = Math.round(Math.abs(r.cashNPV) / unit) * unit;
  const amount = X === 0 ? `is within ${money(unit / 2)} of breaking even`
    : r.cashNPV >= 0 ? `saves about ${money(X)} more than it costs` : `costs about ${money(X)} more than it saves`;
  const parts = [`Over ${count(r.T, "year")} at ${rate}, before tax, this ${amount} in cash.`];
  parts.push(r.cashNPV >= 0 ? "It pays." : r.cashNPVWithRisk >= 0 ? "It pays only if the loss estimate holds." : "It does not pay.");
  if (r.cashNPV < 0 && r.pv.B > 0) {
    const f = (r.pv.C - r.pv.R) / r.pv.B;
    parts.push(f >= 2 ? `Cash benefits would need to rise about ${f.toFixed(1)}-fold.`
      : `Cash benefits would need to rise by about ${Math.max(1, Math.round((f - 1) * 100))}%.`);
  }
  if (bars.length) parts.push(`It turns most on ${bars.slice(0, 2).map((b) => lowerFirst(b.label)).join(" and ")}.`);
  return parts.join(" ");
}

/** The capacity-hours line under the verdict (9.5 item 1), or null when the average rounds to 0. */
export function capacityLine(r) {
  const h = Math.round(r.hoursFreedPerYear);
  if (h === 0) return null;
  const hours = `${quantity(Math.abs(h))}${h > 0 ? "" : " more"} ${Math.abs(h) === 1 ? "hour" : "hours"}`;
  return `It also ${h > 0 ? "frees" : "takes"} about ${hours} a year of your time (not cash).`;
}

export const PUBLISHED_PRICES = "Published prices describe what the equipment costs. They do not support the projected savings, which come from your entries or the example's assumptions.";

/** The verdict's notes on the rate and the placeholders, each while it applies (9.3, 9.5 item 1). */
export function verdictNotes(a) {
  const own = a.settings.ownAnalysis;
  const notes = [];
  if (own && !a.settings.rateReviewed) notes.push("Discount rate not yet reviewed.");
  if (own && Object.values(a.prov ?? {}).some((p) => p.placeholder && !p.confirmed)) notes.push("Includes synthetic cost placeholders.");
  return notes;
}

/**
 * The headline tiles (9.5 item 2): each label followed by " (before tax)", and its value as the tile shows it. The
 * losses-avoided tile shows only when a risk line is entered: a blank one, such as the water module's losses from
 * fewer physical checks by default, counts 0 and is listed as not entered instead.
 */
export function tiles(a, r) {
  const unit = roundingUnit(a, r);
  const out = [["Cash NPV", aboutMoney(r.cashNPV, unit)]];
  if (r.lines.some((l) => l.kind === "risk" && !l.missing)) out.push(["Cash NPV including expected losses avoided", aboutMoney(r.cashNPVWithRisk, unit)]);
  out.push(
    ["Economic NPV", aboutMoney(r.economicNPV, unit)],
    ["Cash payback", paybackText(r.payback)],
    ["BCR", r.bcr === null ? "n/a" : r.bcr.toFixed(2)],
    ["Cost per head-month", r.costPerHeadMonth === null ? "n/a" : `$${r.costPerHeadMonth.toFixed(2)}`],
    ["Hours freed per year", count(Math.round(r.hoursFreedPerYear), "hour")],
    ["IRR", irrText(r.irr)],
  );
  return out.map(([label, value]) => ({ label: `${label} (before tax)`, value }));
}

// ---------------------------------------------------------------- examples and price labels (9.5 items 4 and 5)

const SYNTHETIC = "Made-up numbers for demonstration, not any real operation's data.";
/** The banner of each example while the analysis is not yet the user's own (9.5 item 5). */
export const EXAMPLE_BANNERS = {
  ranchA: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchB: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchC: `Synthetic example ranch. ${SYNTHETIC}`,
  ranchD: `Good-fit synthetic example: conditions where this technology is most likely to pay. ${SYNTHETIC} Check whether your operation matches.`,
};

/**
 * The label of a price input (9.5 item 4), from its `prov` record: a synthetic placeholder; a vendor price reported
 * second-hand; a published list price, followed by its note in parentheses when the value was rounded from it or
 * computed from a pack price; or "your quote" for a typed price. The source part is the citation the page links to
 * prov.url. null for a price with no record (blank: "Quote required", 9.5 item 7).
 */
export function priceLabel(prov) {
  if (!prov) return null;
  if (prov.placeholder) return "Synthetic placeholder, not a price. Replace with your quote.";
  if (prov.cls === "D") return "your quote";
  if (prov.cls !== "C") return null;
  const cite = `${prov.src}, ${prov.pub}`;
  if (prov.reported) return `Vendor information: reported price (${cite}), not a published list price. Not an endorsement. Replace with your quote.`;
  // A version 1 link's copy of a published price notes where it came from; the label shows only the price part, "(10
  // monitors × $1,490)" (9.5 item 8, 10.1 row 30).
  const note = prov.note?.replace(/ \(version 1 link\)$/, "");
  return `Vendor information: published list price (${cite}). Not an endorsement. Replace with your quote.${note ? ` (${note})` : ""}`;
}

// ---------------------------------------------------------------- inputs: labels and units (9.4 intro, 9.5 items 9 and 11)

/** The singular of a counted unit, for a value of 1 (9.5 items 1 and 9: "1 day", "1 cow"). */
const SINGULAR = {
  years: "year", days: "day", weeks: "week", hours: "hour", positions: "position", months: "month", monitors: "monitor",
  cows: "cow", bulls: "bull", "replacement heifers": "replacement heifer", calves: "calf", "calves sold": "calf sold",
  "cull cows sold": "cull cow sold", yearlings: "yearling", tags: "tag", people: "person", riders: "rider", times: "time",
};

/**
 * A value with its unit as the notices write it (9.5 item 11, with the units of item 9): money as "$" and the amount
 * followed by the rest of the unit ("$15,866/mi", "$1,490 per monitor"), a share stored as a fraction as a percent
 * ("50%", "2%/yr"), and any other quantity to two decimals followed by its unit, singular for 1 ("−8 mi", "1 day").
 */
export function withUnit(x, unit) {
  if (unit.startsWith("$")) return money(x) + unit.slice(1);
  if (unit.startsWith("%")) return percent(x) + unit.slice(1);
  const q = quantity(x);
  if (!unit) return q;
  return `${q} ${q.replace(MINUS, "") === "1" ? SINGULAR[unit] ?? unit : unit}`;
}

const LABOR_UNITS = { hour: "hours", day: "days", week: "weeks", position: "positions" };
const UNITS_CUT_LABELS = { water: "Hired labor cut", vf: "Hired moving and gathering hours cut", eid: "Paid hours cut at the chute" };
// The prices that a B9 driver moves take the driver's label (9.4 intro, 9.3 table).
const PRICE_LABELS = {
  water: { monitors: "Monitor price", subscription: "Subscription per monitor" },
  vf: { subscription: "Subscription", serviceFee: "Service fee" },
};
const WORDS = {
  weeks: ["Weeks", "weeks"], runsPerWeek: ["Runs per week", ""], milesPerRun: ["Miles per run", "mi"],
  hoursPerRun: ["Hours per run", "h"], minVisitsPerWeek: ["Minimum visits per week", ""],
};
const HANDLING = {
  gathers: ["Refit gathers", ""], gatherRiders: ["Riders per gather", "riders"], hoursPerGather: ["Hours per gather", "h"],
  trainingDays: ["Training days", "days"], trainingRiders: ["Training riders", "riders"], hoursPerDay: ["Hours per day", "h"],
  paidRate: ["Pay rate (Handling labor)", "$/h"], loadPct: ["Payroll load (Handling labor)", "%"],
};
const COST_FIELDS = {
  lifeYears: ["Life", "years"], repairPct: ["Repairs", "%/yr"], minQty: ["Minimum quantity", ""],
  commitYears: ["Commit years", "years"], earlyTerminationFee: ["Early-termination fee", "$"],
  leaseReimbursement: ["Lease reimbursement", "$"], startYear: ["Start year", ""], qty: ["Quantity", ""],
};
const FIELD_SETS = {
  vf: {
    batteriesPerCollar: ["Batteries per collar per year", ""], gatherHoursToday: ["Moving and gathering hours today", "h/yr"],
    gatherHoursCut: ["Moving and gathering hours cut", "h/yr"], healthCheckHoursCut: ["Health-check riding hours cut", "h/yr"],
    "collarLoss.pctPerYear": ["Collar loss", "%/yr"], "collarLoss.chargePerCollar": ["Loss charge", "$/collar"],
    "fence.miles": ["Interior fence that would otherwise be built", "mi"], "fence.planMiles": ["Interior fence miles in your plan", "mi"],
    "fence.F": ["Fence cost per mile", "$/mi"], "fence.k": ["Fence build year", ""], "fence.Lf": ["Fence life", "years"],
    "fence.m": ["Fence upkeep", "%/yr"], "fence.d": ["Years deferred", "years"],
  },
  eid: {
    tagPrice: ["Tag price", "$/tag"], retagPct: ["Retag rate", "%/yr"], recordingHoursToday: ["Recording time today", "h/yr"],
    "freeTags.qty": ["Free tags", "tags"], "freeTags.years": ["Free-tag billing years", ""],
    "premium.saleCwt": ["Sale weight", "cwt"], "premium.premiumPerCwt": ["Premium", "$/cwt"],
    "premium.verificationFee": ["Verification fee", "$/head"], "dosing.perApplication": ["Saving per application", "$/head/application"],
  },
  water: {
    monitors: ["Monitors", "monitors"], variableCostPerMile: ["Vehicle cost per mile", "$/mi"],
    "fewerChecksLoss.headPerYear": ["Losses from fewer physical checks", "head/yr"],
  },
};


/**
 * The label and unit of the input at a path of analysis a (9.4 intro): the label the page gives it, which notices and
 * validation errors use without its unit (9.5 item 11), and the unit that follows its value. An entry of a per-year
 * list is named like the list. An input this table does not name takes its path, so a notice never breaks.
 */
export function inputInfo(a, path) {
  const m = (re) => path.match(re);
  let x;
  const unitN = (i) => `land unit ${Number(i) + 1}`;
  if (path === "settings.T") return { label: "Horizon", unit: "years" };
  if (path === "settings.discountRate") return { label: "Discount rate", unit: "%/yr" };
  if (path === "settings.paybackTarget") return { label: "Payback target", unit: "years" };
  if (path === "settings.oppCostPerHour") return { label: "Owner time rate", unit: "$/h" };
  if ((x = m(/^settings\.landUnits\.(\d+)\.(leaseYears|share|fenceReimbursement)$/))) {
    const share = a.module === "water" ? "Share of water points" : a.module === "vf" ? "Share of head-months" : "Share";
    const [label, unit] = { leaseYears: ["Lease term", "years"], share: [share, "%"], fenceReimbursement: ["Fence reimbursement at lease end", "$"] }[x[2]];
    return { label: `${label} on ${unitN(x[1])}`, unit };
  }
  if ((x = m(/^classes\.(\w+)\.head(\.\d+)?$/))) return { label: "Head by class and year", unit: className(x[1]) };
  if ((x = m(/^classes\.(\w+)\.valuePerHead$/))) return { label: `Value per head (${className(x[1])})`, unit: "$/head" };
  if ((x = m(/^classes\.(\w+)\.valueOfGain$/))) return { label: `Value of gain (${className(x[1])})`, unit: "$/lb" };
  if (m(/^heifersRetained(\.\d+)?$/)) return { label: "Calves kept as heifers", unit: "head" };
  if ((x = m(/^enrolled\.(\w+)\.(head|months)(\.\d+)?$/))) {
    return { label: "Enrolled head by class and months", unit: x[2] === "head" ? className(x[1]) : "months" };
  }
  if (m(/^served\.(\w+)\.months(\.\d+)?$/)) return { label: "Classes served and months on the served pastures", unit: "months" };
  if (m(/^labor\.cut\.unitsCut(\.\d+)?$/)) {
    return { label: UNITS_CUT_LABELS[a.module] ?? "Hired labor cut", unit: LABOR_UNITS[a.labor?.cut?.laborUnit] ?? "hours" };
  }
  if ((x = m(/^labor\.cut\.(hoursPerUnit|paidRate|salary|loadPct)$/))) {
    return { label: { hoursPerUnit: "Hours per unit", paidRate: "Pay rate", salary: "Salary", loadPct: "Payroll load" }[x[1]],
      unit: { hoursPerUnit: "h", paidRate: "$/h", salary: "$/yr", loadPct: "%" }[x[1]] };
  }
  if ((x = m(/^labor\.avoidedHire\.(salary|loadPct|startYear|years)$/))) {
    const [label, unit] = { salary: ["Salary", "$/yr"], loadPct: ["Payroll load", "%"], startYear: ["First year", ""], years: ["Years", "years"] }[x[1]];
    return { label: `${label} (Avoided hire)`, unit };
  }
  if ((x = m(/^labor\.added\.(\d+)\.(hours|paidRate|loadPct)(\.\d+)?$/))) {
    if (x[2] === "hours") return addedHoursInput(a, Number(x[1]));
    const name = a.labor?.added?.[Number(x[1])]?.label ?? `added item ${Number(x[1]) + 1}`;
    const [label, unit] = { paidRate: ["Pay rate", "$/h"], loadPct: ["Payroll load", "%"] }[x[2]];
    return { label: `${label} (${name})`, unit };
  }
  if (path === "labor.otherHoursSaved") return { label: "Other hours saved", unit: "h/yr" };
  if ((x = m(/^labor\.handling\.events\.(\d+)\.(timesPerYear|minutesPerHead|crewSize)$/))) {
    const name = a.labor?.handling?.events?.[Number(x[1])]?.label ?? `event ${Number(x[1]) + 1}`;
    // EID enters seconds per read, stored as minutes per head (9.4).
    if (x[2] === "minutesPerHead" && a.module === "eid") return { label: `Seconds per read (${name})`, unit: "s", scale: 60 };
    const [label, unit] = { timesPerYear: ["Times per year", "times"], minutesPerHead: ["Minutes per head", "min"], crewSize: ["Crew size", "people"] }[x[2]];
    return { label: `${label} (${name})`, unit };
  }
  if ((x = m(/^labor\.handling\.(\w+)(\.\d+)?$/)) && HANDLING[x[1]]) return { label: HANDLING[x[1]][0], unit: HANDLING[x[1]][1] };
  if (path === "startYear") return { label: "The year the module starts", unit: "" };
  if ((x = m(/^ramp\.(\d+)$/))) return { label: `Ramp in operating year ${x[1]}`, unit: "%" };
  if ((x = m(/^costs\.([^.]+)\.unitCost(\.\d+)?$/))) {
    return { label: own(PRICE_LABELS[a.module], x[1]) ?? lineName(a, x[1]), unit: priceUnit(a, x[1]) };
  }
  if ((x = m(/^costs\.([^.]+)\.residual\.(pct|dollars)$/))) {
    return { label: `Residual (${lineName(a, x[1])})`, unit: x[2] === "pct" ? "%" : "$" };
  }
  if ((x = m(/^costs\.([^.]+)\.operatorShare(\.[^.]+)?$/))) return { label: `Who pays for this? (${lineName(a, x[1])})`, unit: "%" };
  if ((x = m(/^costs\.([^.]+)\.(\w+)(\.\d+)?$/)) && COST_FIELDS[x[2]]) {
    return { label: `${COST_FIELDS[x[2]][0]} (${lineName(a, x[1])})`, unit: COST_FIELDS[x[2]][1] };
  }
  if ((x = m(/^costShares\.([^.]+)(\.[^.]+)?$/))) return { label: `Who pays for this? (${lineName(a, x[1])})`, unit: "%" };
  if ((x = m(/^benefitShares\.([^.]+)(\.[^.]+)?$/))) return { label: `Who receives this saving? (${lineName(a, x[1])})`, unit: "%" };
  if ((x = m(/^riskLines\.(\d+)\.(eventsPerYear|headPerEvent|shareCaught)$/))) {
    const [label, unit] = { eventsPerYear: ["Events per year", ""], headPerEvent: ["Head per event", "head"], shareCaught: ["Share caught early", "%"] }[x[2]];
    return { label: `${label} (${lineName(a, `risk:${x[1]}`)})`, unit };
  }
  if ((x = m(/^production\.(lbPerHeadPerDay|days|soldShare)$/))) {
    return { lbPerHeadPerDay: { label: "Gain", unit: "lb/head/day" }, days: { label: "Days", unit: "days" },
      soldShare: { label: "Share of yearlings sold", unit: "%" } }[x[1]];
  }
  if ((x = m(/^water\.blocks\.(\d+)\.(\w+)$/))) {
    const name = a.water?.blocks?.[Number(x[1])]?.name ?? `block ${Number(x[1]) + 1}`;
    if (x[2] === "shareAvoided") return { label: `Share of runs avoided in ${name}`, unit: "%" };
    if (WORDS[x[2]]) return { label: `${WORDS[x[2]][0]} (${name})`, unit: WORDS[x[2]][1] };
  }
  if ((x = m(/^eid\.dosing\.applications\.(\w+)$/))) return { label: `Applications per head per year (${className(x[1])})`, unit: "" };
  if ((x = m(/^(water|vf|eid)\.(.+?)(\.\d+)?$/)) && FIELD_SETS[x[1]]?.[x[2]]) {
    const [label, unit] = FIELD_SETS[x[1]][x[2]];
    return { label, unit };
  }
  return { label: path, unit: "" };
}

// ---------------------------------------------------------------- link banners (9.5 items 8 and 11)

export const UNREADABLE_LINK = "This link could not be read, so the page opened on Synthetic Ranch A.";

/** A version 1 field's value with its version 1 unit (V1_FIELDS): "−$5,000", "8%", "500 head", "1 year". */
function v1Value(field, x) {
  const unit = V1_FIELDS.find(([, k]) => k === field)[3];
  if (unit.startsWith("$")) return money(x) + unit.slice(1);
  if (unit.startsWith("%")) return `${quantity(x)}${unit}`;
  if (unit === "years") return count(x, "year");
  return `${quantity(x)} ${unit}`;
}
const v1Label = (field) => V1_FIELDS.find(([, k]) => k === field)[2];

/** "Changed from the link to a valid value: <input> (<from> to <to>); …." (9.5 item 11), or null with nothing changed. */
function changedText(entries) {
  return entries.length ? `Changed from the link to a valid value: ${entries.join("; ")}.` : null;
}

/**
 * The banner of a page opened from a link (9.5 items 8 and 11), from readLink(): for an unreadable link, the sentence
 * that says so; for a version 2 link, the values set to a valid one, if any; for a version 1 link, its conversion notes
 * in the order of item 11. null when there is nothing to say (no link, or a version 2 link read as it was).
 */
export function linkBanner(result) {
  if (result.kind === "unreadable") return UNREADABLE_LINK;
  if (result.kind === "v2") {
    return changedText(result.corrected.map((c) => {
      const { label, unit, scale = 1 } = inputInfo(result.state, c.path);
      return `${label} (${withUnit(c.from * scale, unit)} to ${withUnit(c.to * scale, unit)})`;
    }));
  }
  if (result.kind !== "v1") return null;
  const v1 = result.v1;
  const parts = ["This link was made with an earlier version of the calculator and has been converted."];
  if (v1.unknownPreset) parts.push(`It named no known technology, so it opened as ${moduleName("vf")}.`);
  if (v1.notCarried.length) parts.push(`Not carried over: ${v1.notCarried.map(v1Label).join("; ")}.`);
  const changed = changedText(v1.corrected.map((c) => `${v1Label(c.field)} (${v1Value(c.field, c.from)} to ${v1Value(c.field, c.to)})`));
  if (changed) parts.push(changed);
  parts.push("The discount rate is now a real rate (net of expected inflation). Review it for your operation.");
  if (v1.subscription) {
    parts.push("The subscription is now billed at the start of each year instead of at year end. Check whether your quote is per device rather than per head.");
  }
  // An example with no land units (EID's Ranch C) gives none to confirm (spec issue; judgment).
  parts.push(result.state.settings.landUnits?.length
    ? `Confirm the operation type (set to cow-calf) and the land units (taken from ${EXAMPLE_NAMES[v1.example]}).`
    : "Confirm the operation type (set to cow-calf).");
  return parts.join(" ");
}

// ---------------------------------------------------------------- payback target and what would make it pay (B9)

/** The line under the verdict sentence (9.5 item 1, 9.3), from targetTest(). */
export function paybackTargetLine(test) {
  const within = `within ${count(test.years, "year")}`;
  if (test.pays === null) return `No cash flows for you ${within}`;
  return test.pays ? `Pays for itself ${within} (counting equipment value left at year ${test.years})` : `Does not pay for itself ${within}`;
}

const lowerFirst = (label) => label.charAt(0).toLowerCase() + label.slice(1);

/**
 * The precision a driver's value is shown at (9.5 item 9), as a step in its stored unit: money in whole dollars at
 * $100 or more and in cents below; two decimals for miles and percentages (a fraction, so 0.0001); whole numbers for
 * head, days, weeks, positions and hours.
 */
function precision(x, unit) {
  if (unit.startsWith("$")) return Math.abs(x) >= 100 ? 1 : 0.01;
  if (unit === "%") return 0.0001;
  return unit === "mi" ? 0.01 : 1;
}

/** x rounded to its precision: "up", "down" or to the nearest (9.5 item 9). The 1e-9 keeps a float at a step from moving a step. */
function rounded(x, unit, mode) {
  const step = precision(x, unit), q = x / step;
  const n = mode === "up" ? Math.ceil(q - 1e-9) : mode === "down" ? Math.floor(q + 1e-9) : Math.round(q);
  return n * step;
}

/** A value unrounded, to two decimals, with its unit (9.5 item 9: a rounding that would leave the clipped range). */
function twoDecimals(x, unit) {
  const fixed = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (unit.startsWith("$")) return `$${fixed(x)}${unit.slice(1)}`;
  if (unit === "%") return `${fixed(x * 100)}%`;
  return `${fixed(x)} ${unit}`;
}

/** An entered value, or the end of a range, rounded to the nearest at its precision, with its unit (9.5 item 9). */
const nearest = (x, unit) => withUnit(rounded(x, unit, "nearest"), unit);

/** The low end of a range in a "none" or "all" cell, which keeps only its "$" or "%" sign (9.5 item 9). */
function lowEnd(x, unit) {
  const v = rounded(x, unit, "nearest");
  return unit.startsWith("$") ? money(v) : unit === "%" ? percent(v) : quantity(v);
}

/**
 * A solved value as the panel and the verdict show it (9.5 item 9): "at least" rounded up and "at most" rounded down
 * to its precision, so that the value shown, entered as is, passes its test; unrounded, to two decimals, when that
 * rounding would take it outside the clipped range.
 */
function solvedText(row, c) {
  const v = rounded(c.value, row.unit, c.direction === "at least" ? "up" : "down");
  const from = row.clippedLo ?? row.lo, to = row.clippedHi ?? row.hi;
  const inside = v >= from - 1e-9 && v <= to + 1e-9;
  return `${c.direction} ${inside ? withUnit(v, row.unit) : twoDecimals(c.value, row.unit)}`;
}

/** "You entered" (9.5 item 9): the entered value; "Quote required" for a blank price, "Left blank" for another blank driver. */
function enteredText(row) {
  if (row.blank) return row.price ? "Quote required" : "Left blank";
  return nearest(row.entered, row.unit);
}

const NA_TEXT = {
  noHead: "n/a: no head entered", noReaderCost: "n/a: no reader or scale cost entered", noAddedHours: "n/a: no added hours entered",
  noCalvesSold: "n/a: no calves sold", absorbed: "n/a: freed time is absorbed", payNotEntered: "n/a: pay rate, hours per unit or load not entered",
};
const CLIP_REASONS = {
  paidHours: "paid hours cut cannot be more than the hours saved",
  residual: "a residual cannot be more than the cost of the purchase",
};

/** A panel cell (9.5 item 9): column "target" (the N-year test) or "horizon" (the full horizon), by the result's state. */
function cellText(row, column, N, T) {
  const c = row[column], label = lowerFirst(row.label);
  const years = count(column === "target" ? N : T, "year");
  const between = `between ${lowEnd(row.clippedLo ?? row.lo, row.unit)} and ${nearest(row.clippedHi ?? row.hi, row.unit)}`;
  switch (c.state) {
    case "value": return solvedText(row, c);
    case "none": return column === "target" ? `No ${label} ${between} makes it pay for itself within ${years}`
      : `No ${label} ${between} makes it break even over ${years}`;
    case "all": return column === "target" ? `Pays for itself within ${years} at any ${label} ${between}`
      : `Breaks even or better over ${years} at any ${label} ${between}`;
    default: return c.reason === "noCashFlows" ? `n/a: no cash flows within ${years}` : NA_TEXT[c.reason];
  }
}

/** The notes on a row whose range the 9.2 validation clipped (9.5 item 9). */
function clipNotes(row) {
  const notes = [];
  if (row.clipReasonLo) notes.push(`Values below ${nearest(row.clippedLo, row.unit)} are not valid with your other inputs: ${CLIP_REASONS[row.clipReasonLo]}.`);
  if (row.clipReasonHi) notes.push(`Values above ${nearest(row.clippedHi, row.unit)} are not valid with your other inputs: ${CLIP_REASONS[row.clipReasonHi]}.`);
  return notes;
}

export const PANEL_CAPTION = "Each row changes one input and keeps every other input as entered. Cash only, before tax, at your "
  + "share of each cost and saving. Values are rounded up where a row says 'at least' and down where it says 'at most'.";

/**
 * The "What would make it pay" panel (9.5 item 9), from analyze(a), targetTest(a) and solveDrivers(a): its title,
 * caption, columns, one row per driver ({ input, entered, target, horizon, notes }) and the notes under it, each only
 * when it applies: the test runs past the horizon; a capital line's residual is used as entered; and each warning the
 * N-year test raises itself, prefixed "<N>-year test: ".
 */
export function paybackPanel(a, r, test, rows) {
  const N = test.years, T = r.T;
  const notes = [];
  if (N > T) notes.push(`This test assumes the same prices continue to year ${N}.`);
  const entered = buildLines(a).some((l) => l.kind === "cost" && l.timing === "capital" && ["pctOfCost", "amount"].includes(l.residual?.mode));
  if (entered) {
    notes.push(`Equipment value left at year ${N} uses the residual you entered as a percentage of cost or an amount; it is not recalculated for year ${N}.`);
  }
  for (const w of test.warnings) {
    const text = noticeText(w);
    if (text) notes.push(`${N}-year test: ${text}`);
  }
  return {
    title: "What would make it pay",
    caption: PANEL_CAPTION,
    columns: ["Input", "You entered", `To pay for itself within ${count(N, "year")}`, `To break even over ${count(T, "year")}`],
    rows: rows.map((row) => ({ input: row.label, entered: enteredText(row), target: cellText(row, "target", N, T),
      horizon: cellText(row, "horizon", N, T), notes: clipNotes(row) })),
    notes,
  };
}

/**
 * The verdict's "It would pay" sentence (9.5 item 1), when the N-year test fails: the first two drivers of the ranking
 * (rankDrivers), each "<label> at least <value> (you entered <entered>)" or "at most", with "(left blank)" for a blank
 * driver; with none, "No single input in the panel makes it pay for itself within N years." null when the test does not
 * fail.
 */
export function wouldPaySentence(test, rows) {
  if (test.pays !== false) return null;
  const within = `within ${count(test.years, "year")}`;
  const named = rankDrivers(rows).slice(0, 2);
  if (!named.length) return `No single input in the panel makes it pay for itself ${within}.`;
  const phrase = (row) => `${lowerFirst(row.label)} ${solvedText(row, row.target)} ${row.blank ? "(left blank)" : `(you entered ${enteredText(row)})`}`;
  return `It would pay for itself ${within} if: ${named.map(phrase).join(", or ")}.`;
}

// ---------------------------------------------------------------- sensitivity (9.5 item 6)

export const TORNADO_CAPTION = "Cash NPV, your share, before tax, with each input moved 20% down and 20% up, one at a time. "
  + "The longest bars are the numbers worth checking first.";
export const TORNADO_LEGEND = ["Lower value", "Higher value"];

/** The tornado's caption (9.5 item 6), followed by a sentence for each entry tested over its zeroRange. */
export function tornadoCaption(t) {
  return [TORNADO_CAPTION, ...t.zeroTested.map((z) => `${z.label}, entered as 0, is tested from ${withUnit(z.lo, z.unit)} to ${withUnit(z.hi, z.unit)}.`)]
    .join(" ");
}

/** A bar's hover text (9.5 item 6): its label, then the cash NPV at its lower and higher value. */
export function tornadoHover(bar) {
  return [`${bar.label} (now ${withUnit(bar.entered, bar.inputUnit)})`, `Lower value: cash NPV ${money(bar.low)}`,
    `Higher value: cash NPV ${money(bar.high)}`];
}

/** The lists under the tornado (9.5 item 6), each when it has an entry, its labels joined with "; ". */
export function tornadoLists(t) {
  return [["Not counted, left blank", t.leftBlank], ["Entered as 0, not tested", t.zeroNotTested], ["No effect on cash NPV", t.noEffect]]
    .filter(([, labels]) => labels.length).map(([lead, labels]) => `${lead}: ${labels.join("; ")}.`);
}

/** A value on an axis of the two-way grid, in the entry's own unit. */
export const gridValue = (axis, v) => withUnit(v, axis.inputUnit);

/** The note over the two-way grid (twoWayGrid), or null without one. */
export function gridNote(g) {
  if (!g) return null;
  const range = (x) => (x.zeroRange ? `entered as 0, from ${gridValue(x, x.zeroRange[0])} to ${gridValue(x, x.zeroRange[1])}`
    : "from 40% below to 40% above what you entered");
  const parts = [`Cash NPV for the two inputs that matter most: ${lowerFirst(g.rows.label)} (rows), ${range(g.rows)}, and `
    + `${lowerFirst(g.cols.label)} (columns), ${range(g.cols)}. The outlined cell is what you entered.`];
  if (g.rows.capped || g.cols.capped) parts.push("A share of runs avoided stops at its block's cap, the most the analysis counts.");
  if (g.rows.clipped || g.cols.clipped) parts.push("A value that is not valid with your other inputs is moved to the nearest one that is.");
  if (g.cells.some((row) => row.includes(null))) parts.push("A cell marked n/a pairs values that are not valid together.");
  return parts.join(" ");
}
