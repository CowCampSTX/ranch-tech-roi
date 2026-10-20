// Page text for Ranch Tech ROI, built from analyze() and combine() output (docs/audit/phase1-spec.md, 9.5). Pure
// functions, no DOM, so node tests check every string the page will show. Phase 1 adds to it step by step (9.1);
// the page shows it from step 6. Built so far: the formats and names of 9.5 items 9 and 11; the notices of F1, F3,
// F4, F5, F6 and F7 and the pool warnings of F9 (9.5 items 4 and 11); the state texts, tiles and verdict of F8; and,
// with the modules, the water-block warnings, the EID rule notice (B4a), the price labels (9.5 item 4) and the
// examples' banners (9.5 item 5); the input labels and link banners (B8, 9.5 items 8 and 11); and the payback-target
// line, the "It would pay" sentence and the "What would make it pay" panel (B9, 9.5 items 1 and 9).
import { addedHours, addedHoursInput, addedName, at, buildLines, CLASS_NAMES, landUnitsOf, lastShownYear, LINE_LABELS, lineLabel as lineName, operatorShare, own,
  priceUnit, rankDrivers, shareUsed } from "./roi.js";
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
  // A vendor is named only in a linked citation (owner rule): a record whose link is missing or not a web page (a
  // hand-made link can carry one) names no source.
  const cite = safeUrl(prov.url) ? `${prov.src}, ${prov.pub}` : "source link missing";
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
    // No unit until "Paid labor is cut in" is chosen (9.2 gives it no default).
    return { label: UNITS_CUT_LABELS[a.module] ?? "Hired labor cut", unit: LABOR_UNITS[a.labor?.cut?.laborUnit] ?? "" };
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
    const name = addedName(a, Number(x[1]));
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
  if (path === "costs.baseStations.qty") return { label: "Number of base stations", unit: "" };
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
  const word = choiceLabel(a, path);
  if (word) return { label: word, unit: "" };
  return { label: path, unit: "" };
}

/** The labels of the inputs that take a choice, a yes or no, a name or a list of classes (9.4), or null. */
function choiceLabel(a, path) {
  let x;
  const m = (re) => path.match(re);
  const fixed = {
    "settings.opType": "Operation type", "labor.freedTimeUse": "What happens to the freed time", "labor.cut.laborUnit": "Paid labor is cut in",
    "labor.handling.doneBy": "Handling done by", "vf.pricing": "Pricing model", "vf.fence.mode": "Avoided or deferred",
    "vf.fence.landUnitId": "Land unit the fence is on", "vf.validatedAlert": "Validated alert function",
    "eid.premium.quoteNote": "Buyer quote note", "eid.freeTags.years": "Free-tag billing years", "production.classes": "Classes sold",
    "production.fromRecords": "Weight gain from your own records", "production.sourceNote": "Source note (weight gain)",
    "water.fewerChecksLoss.class": "Class (Losses from fewer physical checks)",
  };
  if (Object.hasOwn(fixed, path)) return fixed[path];
  if ((x = m(/^settings\.landUnits\.(\d+)\.(\w+)$/))) {
    const label = { kind: "Owned or leased", renewalExpected: "Renewal expected", fenceBuiltBy: "Who builds the fence",
      fenceMaintainedBy: "Who maintains the fence", waterBy: "Who provides and checks the water",
      careInLeaseRate: "Water care is in the lease rate", id: "Id" }[x[2]];
    return label ? `${label} on land unit ${Number(x[1]) + 1}` : null;
  }
  if ((x = m(/^labor\.added\.(\d+)\.(doneBy|label)$/))) {
    const name = addedName(a, Number(x[1]));
    return x[2] === "doneBy" ? `Done by (${name})` : `Name (added item ${Number(x[1]) + 1})`;
  }
  if ((x = m(/^labor\.handling\.events\.(\d+)\.(classes|label)$/))) {
    const name = a.labor?.handling?.events?.[Number(x[1])]?.label ?? `event ${Number(x[1]) + 1}`;
    return x[2] === "classes" ? `Classes (${name})` : `Name (event ${Number(x[1]) + 1})`;
  }
  if ((x = m(/^costs\.([^.]+)\.(timing|basis|billing|classes|staysWithLand|residual\.mode)$/))) {
    const label = { timing: "Bought or billed each season", basis: "Billing basis", billing: "Billing", classes: "Classes",
      staysWithLand: "Stays with the land when a lease ends", "residual.mode": "Residual" }[x[2]];
    return `${label} (${lineName(a, x[1])})`;
  }
  if ((x = m(/^riskLines\.(\d+)\.(cause|class)$/))) return `${x[2] === "cause" ? "Cause" : "Class"} (${lineName(a, `risk:${x[1]}`)})`;
  if ((x = m(/^water\.blocks\.(\d+)\.(name|freezeOrFeedRoute)$/))) {
    if (x[2] === "name") return `Name (block ${Number(x[1]) + 1})`;
    return `Tanks freeze / water checked on the feeding route (${a.water?.blocks?.[Number(x[1])]?.name ?? `block ${Number(x[1]) + 1}`})`;
  }
  if ((x = m(/^eid\.ruleApplies\.(\w+)$/))) return `Does the EID rule apply to cattle you move? (${className(x[1])})`;
  return null;
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

// ---------------------------------------------------------------- the page: year table, left out, chart and formulas (9.5 items 3, 4 and 10)

const CLASS_ORDER = ["A", "B", "C", "D", "E"];

/** The evidence classes of a line's inputs, from their `prov` records, in the order A to E: its badge (9.5 item 3). */
export function lineClasses(a, line) {
  const found = new Set((line.paths ?? []).map((p) => a.prov?.[p]?.cls).filter(Boolean));
  return CLASS_ORDER.filter((c) => found.has(c));
}

/** The note above the year table (9.5 item 3), with the analysis's real rate. */
export function yearTableNote(r) {
  return "Year 0 is the start. Fees billed in advance, such as a subscription, are paid at the start of the season they "
    + "cover, so the first season's fee is in year 0. Purchases, and fence the technology avoids, fall in the year of "
    + "purchase; other costs and every benefit fall at the end of their year. Money in today's US dollars, discounted at "
    + `${quantity(r.rate * 100)}% a year (real). Your share of each line, before tax.`;
}

/** "Quote required: not counted", as the year table and the list of what was left out name a blank price (9.5 item 7). */
export const QUOTE_REQUIRED = "Quote required: not counted";
export const QUOTE_WARNING = "Costs marked 'Quote required' are left out, so this result overstates the case.";
export const BLANK_BENEFITS = "Benefits left blank are not counted, so they can only make this result look worse.";

/**
 * The year table (9.5 item 3): years 0..T down the rows; a column for each cost line and each cash benefit line, with
 * the evidence classes of its inputs; then the residual value, total cost, total cash benefit, net cash, cumulative and
 * discounted net cash; the risk lines after them, with their own subtotal, never added to net cash; and the capacity
 * hours, in hours. Costs show as amounts paid. Each row carries the cattle-presence message of its year, if any.
 */
export function yearTable(a, r) {
  const quote = new Set(r.notices.filter((n) => n.type === "quoteRequired").map((n) => n.lineId));
  const costs = r.lines.filter((l) => l.kind === "cost");
  const cash = r.lines.filter((l) => l.kind === "cash");
  const risk = r.lines.filter((l) => l.kind === "risk" && !l.missing);
  const freed = r.lines.find((l) => l.id === "hoursFreed")?.operatorClaims ?? r.hours.freed;
  const line = (l, group) => ({ label: l.label, group, classes: lineClasses(a, l), note: quote.has(l.id) ? QUOTE_REQUIRED : null });
  const columns = [
    { label: "Year", group: "year" },
    ...costs.map((l) => line(l, "cost")),
    ...cash.map((l) => line(l, "benefit")),
    ...["Residual value", "Total cost", "Total cash benefit", "Net cash", "Cumulative", "Discounted"].map((label) => ({ label, group: "total" })),
    ...risk.map((l) => line(l, "risk")),
    ...(risk.length ? [{ label: "Expected losses avoided (not in net cash)", group: "risk" }] : []),
    { label: "Hours freed", group: "hours" },
  ];
  const noCattle = new Set(r.notices.filter((n) => n.type === "noCattle").map((n) => n.year));
  let cumulative = 0;
  const rows = r.years.map((t) => {
    cumulative += r.N[t];
    return {
      year: t,
      cells: [String(t), ...costs.map((l) => money(l.series[t])), ...cash.map((l) => money(l.series[t])), money(r.R[t]),
        money(r.C[t]), money(r.B[t]), money(r.N[t]), money(cumulative), money(r.N[t] / (1 + r.rate) ** t),
        ...risk.map((l) => money(l.series[t])), ...(risk.length ? [money(r.X[t])] : []), quantity(Math.round(freed[t] ?? 0))],
      negative: [r.N[t] < -0.005, cumulative < -0.005],
      note: noCattle.has(t) ? noticeText({ type: "noCattle", year: t }) : null,
    };
  });
  return { note: yearTableNote(r), columns, rows };
}

const unitName = (a, unitId) => {
  const i = (a.settings.landUnits ?? []).findIndex((u) => u.id === unitId);
  return i >= 0 ? `land unit ${i + 1}` : null;
};

/**
 * The lists under the year table (9.5 item 3, F6): what others pay ("Paid by others") and receive ("Received by
 * others"), by line and land unit, each year's amount and the PV. Hours freed that go to others are in hours, with no
 * PV. Neither list enters any result. Each list is null when it is empty.
 */
export function othersLists(a, r) {
  const label = (id) => r.lines.find((l) => l.id === id)?.label ?? id;
  const list = (title, items) => (items.length ? {
    title,
    columns: ["Line", "Land unit", ...r.years.map((t) => `Year ${t}`), "PV"],
    rows: items.map((x) => [label(x.lineId), unitName(a, x.unitId) ?? "", ...x.series.map((v) => (x.pv === null ? `${quantity(Math.round(v))} h` : money(v))),
      x.pv === null ? "n/a (hours)" : money(x.pv)]),
  } : null);
  return [list("Paid by others", r.paidByOthers), list("Received by others", r.receivedByOthers)];
}

/**
 * What was left out (9.5 items 4 and 7), in the order in which 9.4 lists the inputs: a blank price as "<line>: Quote
 * required: not counted", unless its line has no quantity in any year; a benefit, risk or production line that counts as
 * 0 because an input it needs is blank, once, as "<line>: not entered, not counted"; and any other blank input that
 * counts as 0 in a line buildLines builds, a cost, hours or capacity line included, once, under its own label. The
 * list ends with the blank-benefits sentence when it names a benefit, risk or production line or input other than
 * "Losses from fewer physical checks" and "Verification fee" (each lowers the result when entered); a blank cost input
 * adds no sentence, and a blank price adds the warning instead. A capital line's residual share or amount is one of its
 * cost inputs; the blank inputs of a line listed as not entered are not listed again unless a cost line counts them as 0
 * too; a blank owner time rate is listed
 * only when some year frees or takes hours, and adds the sentence only when the hours freed are worth more than 0.
 */
export function leftOut(a, r) {
  const quote = new Set(r.notices.filter((n) => n.type === "quoteRequired").map((n) => n.lineId));
  const missing = new Set(r.notices.filter((n) => n.type === "notEntered").map((n) => n.lineId));
  const found = [];
  const add = (text, path) => {
    if (!found.some((x) => x.text === text)) found.push({ text, order: inputOrder(a, path) });
  };
  let benefits = false;
  const blanksOf = (paths) => paths.filter((p) => blankValue(getPath(a, p)) && !OWN_BLANK.some((re) => re.test(p)));
  // A line counted as not entered is listed once, however many of its inputs are blank, so its blank inputs are not
  // listed again under another line (9.5 item 4).
  const behindLine = new Set(r.lines.filter((l) => missing.has(l.id)).flatMap((l) => blanksOf(l.paths ?? [])));
  // The owner time rate values the hours freed: it is left out only when some year frees or takes hours, and entering
  // it can only raise the result when the hours freed are worth more than 0 (judgment, spec issue).
  const freedPV = (r.hours?.freed ?? []).reduce((s, h, t) => s + h / (1 + r.rate) ** t, 0);
  const freedAny = (r.hours?.freed ?? []).some((h) => Math.abs(h) > 1e-9);
  for (const l of r.lines) {
    if (quote.has(l.id)) add(`${l.label}: ${QUOTE_REQUIRED}`, priceOf(l));
    if (missing.has(l.id)) {
      // A line listed once sits where the first input that left it blank sits in 9.4.
      const blanks = blanksOf(l.paths ?? []);
      add(`${l.label}: not entered, not counted`, firstInOrder(a, blanks.length ? blanks : l.paths ?? []));
      if (l.id !== "fewerChecks") benefits = true;
      continue;
    }
    // A capital line's residual also rests on its share of cost or its amount (9.3), a cost input.
    const paths = l.kind === "cost" ? [...new Set([...(l.paths ?? []), ...residualPaths(a, l)])] : l.paths ?? [];
    for (const path of blanksOf(paths)) {
      // A cost that counts the input as 0 lists it even so: a cost left out makes the result look better.
      if (behindLine.has(path) && l.kind !== "cost") continue;
      if (path === "settings.oppCostPerHour" && !freedAny) continue;
      add(`${leftLabel(a, path)}: not entered, not counted`, path);
      if (benefitInput(l, path) && (path !== "settings.oppCostPerHour" || freedPV > 1e-9)) benefits = true;
    }
  }
  // A stable sort: items at the same place in 9.4 keep the order of the lines.
  const items = found.sort((x, y) => x.order - y.order).map((x) => x.text);
  return { items, ending: benefits ? BLANK_BENEFITS : null, warning: quote.size ? QUOTE_WARNING : null };
}
/** An input's label in what was left out: a class's head names the class, as its field does. */
function leftLabel(a, path) {
  const { label, unit } = inputInfo(a, path);
  return /^classes\.\w+\.head(\.\d+)?$/.test(path) ? `${label} (${unit})` : label;
}
const priceOf = (l) => (l.id === "collarLoss" ? "vf.collarLoss.chargePerCollar" : (l.paths ?? []).find((p) => /unitCost$|^eid\.tagPrice$/.test(p)) ?? l.paths?.[0]);
const firstInOrder = (a, paths) => paths.reduce((best, p) => (best === undefined || inputOrder(a, p) < inputOrder(a, best) ? p : best), undefined);

// The order in which 9.4 lists the inputs (9.5 item 4): the shared inputs, then the module's. Pay and payroll load sort
// with the labor item they are asked beside (judgment).
const INSTALL = (a, p) => {
  const m = p.match(/^labor\.added\.(\d+)\./);
  return !!m && a.module === "water" && a.labor?.added?.[m[1]]?.label === "install";
};
const SHARED_ORDER = [/^settings\.(T|discountRate|paybackTarget|opType|landUnits)(\.|$)/, /\.operatorShare(\.|$)|^(costShares|benefitShares)\./,
  /^classes\./, /^heifersRetained(\.|$)/, /^labor\.freedTimeUse$/, /^settings\.oppCostPerHour$/, /^startYear$/,
  /^labor\.otherHoursSaved(\.|$)/, /^labor\.avoidedHire\./, /\.(staysWithLand|leaseReimbursement)$/];
const MODULE_ORDER = {
  water: [/^(water\.monitors|costs\.monitors\.)/, /^costs\.mounting\./, INSTALL, /^costs\.subscription\./, /^costs\.batteries\./,
    /^water\.blocks\./, /^served\./, /^labor\.cut\./, /^labor\.added\./, /^water\.variableCostPerMile$/, /^riskLines\./,
    /^water\.fewerChecksLoss(\.|$)/, /^ramp\./],
  vf: [/^vf\.pricing$/, /^costs\.subscription\./, /^costs\.(collars|serviceFee)\./, /^(costs\.collarBatteries\.|vf\.batteriesPerCollar$)/,
    /^costs\.baseStations\./, /^costs\.infrastructure\./, /^enrolled\./, /^vf\.collarLoss\./, /^labor\.handling\./, /^vf\.fence\./,
    /^vf\.gatherHoursToday$/, /^(vf\.gatherHoursCut$|labor\.cut\.)/, /^vf\.(healthCheckHoursCut|validatedAlert)$/, /^production\./,
    /^riskLines\./, /^ramp\./],
  eid: [/^eid\.ruleApplies\./, /^eid\.freeTags\./, /^served\./, /^(eid\.tagPrice$|costs\.(cowTags|calfTags|retags)\.|eid\.retagPct$)/,
    /^costs\.(reader|indicatorBars|platform)\./, /^costs\.software\./, /^labor\.handling\./, /^eid\.recordingHoursToday$/,
    /^labor\.added\./, /^labor\.cut\./, /^eid\.premium\./, /^eid\.dosing\./, /^production\./, /^riskLines\./, /^ramp\./],
};
/** An input's place in 9.4's order: its index in the shared list, else after the shared inputs in its module's list. */
function inputOrder(a, path) {
  if (path === undefined) return Infinity;
  const hit = (x) => (typeof x === "function" ? x(a, path) : x.test(path));
  const shared = SHARED_ORDER.findIndex(hit);
  if (shared >= 0) return shared;
  const own = (MODULE_ORDER[a.module] ?? []).findIndex(hit);
  return own >= 0 ? SHARED_ORDER.length + own : Infinity;
}
const BENEFIT_KINDS = ["cash", "risk", "production", "hours"];
/**
 * True when a blank input of line l is a benefit input for the blank-benefits sentence: an input of a benefit, risk,
 * production or hours-saved line, or of the capacity line other than the hours the technology takes (unpaid added and
 * handling hours, which are costs in time); never the verification fee.
 */
function benefitInput(l, path) {
  if (path === "eid.premium.verificationFee") return false;
  if (BENEFIT_KINDS.includes(l.kind)) return true;
  return l.kind === "capacity" && !/^labor\.(added\.\d+\.hours|handling\.)/.test(path);
}
// Blanks that are not "not entered": the ramp (blank is 1), a stored share (blank is the land units' default), a price
// ("Quote required"), the months served (blank is 12) and the inputs to which 9.2 to 9.4 give a blank its own meaning
// (9.5 item 7).
const OWN_BLANK = [/^ramp\./, /^(costShares|benefitShares)\./, /\.operatorShare(\.|$)/, /^costs\.[^.]+\.unitCost$/, /^eid\.tagPrice$/,
  /chargePerCollar$/, /lifeYears$/, /planMiles$/, /gatherHoursToday$/, /^served\.\w+\.months$/, /^classes\.undefined\./];
const blankValue = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.every(blankValue));

/** The caption of the cumulative cash chart (9.5 item 10). */
export const CUMULATIVE_CAPTION = "Year 0 holds purchases, fees billed in advance and any avoided capital; each later point "
  + "adds that year's cash benefits and residual value, less its costs. Your share, before tax. Payback is the point after "
  + "which the line stays at or above zero.";

/**
 * The cumulative cash chart's points and payback mark (9.5 item 10): the operator's cumulative net cash for years 0..T,
 * and the payback point only when the 9.3 payback state gives a number of years; otherwise its state text.
 */
export function cumulativeChart(r) {
  let c = 0;
  const points = r.N.map((x, t) => ({ year: t, value: (c += x) }));
  const mark = r.payback.state === "years" ? { at: r.payback.years, text: `Payback: ${paybackText(r.payback)} (before tax)` } : null;
  return { points, mark, state: mark ? null : `Cash payback (before tax): ${paybackText(r.payback)}` };
}

// ---------------------------------------------------------------- the written-out formulas (9.5 item 10)

const firstOperating = (r) => Math.min(r.startYear + 1, r.T);
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
const yearsWith = (xs) => xs.map((x, t) => (Math.abs(x) > 0.005 ? t : null)).filter((t) => t !== null);
/** A line's yearly amounts in a few words: "$3,650 a year in years 0, 1, 2, …, 9", "$1,000 in years 4 and 8". */
function amounts(series) {
  const ts = yearsWith(series);
  if (!ts.length) return "$0 in every year";
  const same = ts.every((t) => Math.abs(series[t] - series[ts[0]]) < 0.005);
  if (ts.length === 1) return `${money(series[ts[0]])} in year ${ts[0]}`;
  return same ? `${money(series[ts[0]])} a year in years ${yearList(ts)}` : `${money(series[ts[0]])} in year ${ts[0]}, then other amounts, in years ${yearList(ts)}`;
}
const yearList = (ts) => (ts.length > 4 ? `${ts.slice(0, 3).join(", ")}, …, ${ts[ts.length - 1]}` : ts.join(", "));

/** The formula of one cost or cash benefit line, with its values filled in from the analysis (9.5 item 10). */
function lineFormula(a, r, l) {
  const t1 = firstOperating(r);
  const c = a.costs?.[l.id] ?? {};
  const pv = `PV ${money(l.pv)}`;
  const nonzero = yearsWith(l.series);
  const inYears = nonzero.length ? ` in year${nonzero.length > 1 ? "s" : ""} ${yearList(nonzero)}` : " (none within the horizon)";
  const pick = (x) => (Array.isArray(x) ? at(x, t1) : x);
  const n = (x) => (x === null || x === undefined || x === "" ? 0 : Number(x));
  const inT1 = `${money(l.series[t1])} in year ${t1}; ${pv}`;
  // The factors the engine applies after the values shown, named so that the shown values multiply to the result: a
  // benefit's ramp in its first operating year (9.3 B3), the operator's share (F6), and what is left (the land units'
  // part, a lease's end, the baseline's cap, 9.3 and 9.6).
  const after = (product, amount, benefit) => {
    if (!(Math.abs(product) > 1e-9)) return "";
    const k = t1 - r.startYear;
    const ramp = benefit && k >= 1 && k <= 3 && a.ramp?.[k] !== undefined && a.ramp?.[k] !== null ? n(a.ramp[k]) : 1;
    const one = shareOf();
    // Nothing counted from values above 0: the ramp or the share that makes it 0.
    if (!(Math.abs(amount) > 0.005)) return ramp === 0 ? " × ramp 0%" : one === 0 ? " × your share 0%" : "";
    let rest = amount / product;
    const parts = [];
    if (ramp > 0 && ramp < 1) {
      parts.push(`ramp ${percent(ramp)}`);
      rest /= ramp;
    }
    if (one !== null && one > 0 && one < 1) {
      parts.push(`your share ${percent(one)}`);
      rest /= one;
    }
    if (Math.abs(rest - 1) > 1e-4) parts.push(`${percent(rest)} (${one === null ? "your share on each land unit, " : ""}the land units and limits in the year table)`);
    return parts.map((x) => ` × ${x}`).join("");
  };
  // The operator's share of the line when every land unit has the same one, else null (F6).
  const shareOf = () => {
    const line = { id: l.id, kind: l.kind, operatorShare: l.kind === "cost" ? c.operatorShare : undefined, fence: l.id === "fence" };
    const shares = landUnitsOf(a).map((u) => n(operatorShare(a, line, u)));
    return shares.every((x) => x === shares[0]) ? shares[0] ?? 1 : null;
  };
  const shareText = () => {
    const one = shareOf();
    return one === null ? ", times your share on each land unit" : one < 1 ? ` × your share ${percent(one)}` : "";
  };
  if (l.missing) return { expr: "not entered, not counted", result: "" };
  switch (l.id) {
    case "handling": {
      const h = a.labor.handling, hours = r.hours.handling[t1] ?? 0, rate = n(h.paidRate) * (1 + n(h.loadPct));
      return { expr: `${quantity(hours)} handling hours in year ${t1} × pay rate ${money(n(h.paidRate))}/h × (1 + payroll load ${percent(n(h.loadPct))})${after(hours * rate, l.series[t1], false)}`, result: inT1 };
    }
    case "vehicle": {
      // Runs avoided a year (each block's runs × its share used) and the miles per run averaged over them (9.3).
      const blocks = (a.water?.blocks ?? []).map((b) => ({ runs: n(b.runsPerWeek) * n(b.weeks) * shareUsed(b), miles: n(b.milesPerRun) }));
      const runs = blocks.reduce((x, b) => x + b.runs, 0);
      const miles = runs > 0 ? blocks.reduce((x, b) => x + b.runs * b.miles, 0) / runs : 0;
      const perMile = n(a.water.variableCostPerMile);
      return { expr: `${quantity(runs)} runs avoided a year × ${quantity(miles)} mi per run × vehicle cost ${money(perMile)}/mi${after(runs * miles * perMile, l.series[t1], true)}`, result: inT1 };
    }
    case "laborCut": {
      const cut = a.labor.cut, u = cut.laborUnit, units = n(pick(cut.unitsCut));
      const per = u === "hour" ? "" : `${quantity(n(cut.hoursPerUnit))} h per ${u ?? "unit"} × `;
      const pay = u === "position" ? `salary ${money(n(cut.salary))}` : `${per}pay rate ${money(n(cut.paidRate))}/h`;
      const each = u === "position" ? n(cut.salary) : (u === "hour" ? 1 : n(cut.hoursPerUnit)) * n(cut.paidRate);
      const cutText = u ? count(units, LABOR_UNITS[u].replace(/s$/, "")) : `${quantity(units)} units`;
      return { expr: `${cutText} cut × ${pay} × (1 + payroll load ${percent(n(cut.loadPct))})${after(units * each * (1 + n(cut.loadPct)), l.series[t1], true)}, within the hours saved`, result: inT1 };
    }
    case "avoidedHire": {
      const h = a.labor.avoidedHire;
      return { expr: `salary ${money(n(h.salary))} × (1 + payroll load ${percent(n(h.loadPct))})`, result: `${money(Math.max(...l.series))} a year${inYears}; ${pv}` };
    }
    case "fence": {
      const f = a.vf.fence;
      return { expr: `${quantity(n(f.miles))} mi × ${money(n(f.F))}/mi built in year ${n(f.k)}, every ${count(n(f.Lf), "year")}, with upkeep ${percent(n(f.m))} of its cost a year, less its residual at the end${f.mode === "deferred" ? `, less the same stream ${count(n(f.d), "year")} later` : ""}`, result: pv };
    }
    case "premium": {
      const p = a.eid.premium ?? {}, sold = n(pick(a.classes?.calvesSold?.head));
      const net = n(p.saleCwt) * n(p.premiumPerCwt) - n(p.verificationFee);
      return { expr: `${quantity(sold)} calves sold × (${quantity(n(p.saleCwt))} cwt × ${money(n(p.premiumPerCwt))}/cwt − verification fee ${money(n(p.verificationFee))})${after(sold * net, l.series[t1], true)}`, result: inT1 };
    }
    case "dosing": {
      const entries = Object.entries(a.eid.dosing.applications ?? {});
      const apps = entries.map(([c, k]) => `${quantity(n(pick(a.classes?.[c]?.head)))} ${className(c)} × ${count(n(k), "application")}`);
      const doses = entries.reduce((x, [c, k]) => x + n(pick(a.classes?.[c]?.head)) * n(k), 0), each = n(a.eid.dosing.perApplication);
      return { expr: `(${apps.join(" + ") || "no applications"}) × ${money(each)} per application${after(doses * each, l.series[t1], true)}`, result: inT1 };
    }
    case "production": {
      const p = a.production, lbs = n(p.lbPerHeadPerDay) * n(p.days);
      const sold = (p.classes ?? []).map((cl) => ({ cl, head: n(pick(a.classes?.[cl]?.head)) * (cl === "yearlings" && p.soldShare !== null && p.soldShare !== undefined && p.soldShare !== "" ? n(p.soldShare) : 1), gain: n(a.classes?.[cl]?.valueOfGain) }));
      // The sale classes' names already say "sold" ("calves sold"); yearlings' does not.
      const value = sold.map((x) => `${quantity(x.head)} ${className(x.cl)}${/ sold$/.test(className(x.cl)) ? "" : " sold"} × ${money(x.gain)}/lb`).join(" + ") || "no classes sold";
      return { expr: `${quantity(n(p.lbPerHeadPerDay))} lb/head/day × ${count(n(p.days), "day")} × (${value})${after(lbs * sold.reduce((x, y) => x + y.head * y.gain, 0), l.series[t1], true)}`, result: inT1 };
    }
    default:
      break;
  }
  if (l.id.startsWith("added:")) {
    // The year with the most cost, as the result names it, or with the most hours while the cost is 0 in every year (a
    // pay rate or a share of 0), and the item's own hours in it (the line is the operator's share of their cost, which
    // after() names).
    const item = a.labor.added[Number(l.id.slice(6))], rate = n(item.paidRate) * (1 + n(item.loadPct));
    const most = (f) => l.series.reduce((m, x, t) => (f(t) > f(m) ? t : m), 0);
    const top = l.series.some((x) => x > 0.005) ? most((t) => l.series[t]) : most((t) => addedHours(item.hours, t, r.startYear, r.T));
    const hours = addedHours(item.hours, top, r.startYear, r.T);
    return { expr: `${quantity(hours)} h in year ${top} × pay rate ${money(n(item.paidRate))}/h × (1 + payroll load ${percent(n(item.loadPct))})${after(hours * rate, l.series[top], false)}`,
      result: `${money(Math.max(...l.series))} at most in a year${inYears}; ${pv}` };
  }
  if (l.kind === "cost" && l.purchases) {
    // Free tags (EID) lower a purchase's quantity in the years they apply (9.3).
    const bought = l.purchases.filter((p) => p.qty > 0).map((p) => `${p.free > 0 ? `(${quantity(p.qty)} − ${quantity(p.free)} free)` : quantity(p.qty)} × ${money(n(p.unitCost))} in year ${p.year}`);
    const residual = l.residual?.[r.T] ? `; residual at year ${r.T} ${money(l.residual[r.T])}` : "";
    const repairs = n(c.repairPct) > 0 ? `, plus repairs at ${percent(n(c.repairPct))} of the cost a year` : "";
    return { expr: `quantity × unit price: ${bought.length ? bought.join(", ") : "no purchase within the horizon"}${repairs}${shareText()}`,
      result: `${money(l.series.reduce((x, y) => x + y, 0))} in all${residual}; ${pv}` };
  }
  if (l.kind === "cost") {
    const pricePath = { cowTags: "eid.tagPrice", calfTags: "eid.tagPrice", retags: "eid.tagPrice", collarLoss: "vf.collarLoss.chargePerCollar" }[l.id]
      ?? `costs.${l.id}.unitCost`;
    const info = inputInfo(a, pricePath);
    const price = getPath(a, pricePath);
    // A price with more than cents (a version 1 link's $0.30417) shows them, so the shown values multiply to the result.
    const cents = (x) => (info.unit.startsWith("$") && Math.abs(x) < 100 && Math.abs(x * 100 - Math.round(x * 100)) > 1e-6
      ? signed(x, `$${Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 5 })}`) + info.unit.slice(1) : withUnit(x, info.unit));
    const priceText = price === null || price === undefined ? "price not entered"
      : Array.isArray(price) && price.some((x) => n(x) !== n(price[0])) ? "the price entered for each season" : cents(n(pick(price)));
    const billing = l.id === "collarLoss" || l.id === "collarBatteries" || ["calfTags", "retags"].includes(l.id) ? "arrears"
      : c.billing ?? (["subscription", "serviceFee"].includes(l.id) ? "advance" : "arrears");
    // The quantity billed: one number when every season bills the same, else the first season's.
    const billed = (l.bills ?? []).filter((b) => b.qty > 0);
    // Billed per head per year, the quantity is head-months still (head × 12), at a price per head-month.
    const per = { perHeadMonth: " head-months", perHeadYear: " head-months" }[c.basis] ?? "";
    const qty = !billed.length ? "quantity" : billed.every((b) => b.qty === billed[0].qty) ? `${quantity(billed[0].qty)}${per}`
      : `quantity (${quantity(billed[0].qty)}${per} in year ${billed[0].year}, then by year)`;
    const free = (l.bills ?? []).filter((b) => b.free > 0).map((b) => `${quantity(b.free)} free in year ${b.year}`);
    return { expr: `${qty} × ${priceText}${priceText.endsWith("season") ? "" : " each season"}${free.length ? `, less ${free.join(", ")}` : ""}${shareText()}, billed ${billing === "advance" ? "at its start" : "at its end"}`,
      result: `${amounts(l.series)}; ${pv}` };
  }
  return { expr: "as entered", result: pv };
}

/**
 * The written-out formulas (9.5 item 10): each cost and cash benefit line with its formula and its values, then the
 * three NPVs, the BCR, the IRR and the payback with their state texts, and the note on what is not included.
 */
export function formulas(a, r) {
  const unit = roundingUnit(a, r);
  const rate = quantity(r.rate * 100);
  const lineRows = (kind) => r.lines.filter((l) => l.kind === kind).map((l) => ({ name: l.label, ...lineFormula(a, r, l) }));
  return {
    sections: [
      { title: "Costs (your share)", rows: lineRows("cost") },
      { title: "Cash benefits (your share)", rows: lineRows("cash") },
      { title: "Results (before tax)", rows: [
        { name: "Net cash", expr: "cash benefits + residual value − costs, each year (the year table)", result: "" },
        { name: "Cash NPV", expr: `Σ net cash ÷ (1 + ${rate}%)^t, t = 0…${r.T}`, result: `${money(r.cashNPV)} (${aboutMoney(r.cashNPV, unit)})` },
        { name: "Cash NPV including expected losses avoided", expr: "cash NPV + PV of expected losses avoided", result: money(r.cashNPVWithRisk) },
        { name: "Economic NPV", expr: "cash NPV + PV of losses avoided + PV of the hours freed at your time rate + PV of production not from your records", result: money(r.economicNPV) },
        { name: "BCR", expr: "(PV of cash benefits + PV of residual value) ÷ PV of costs", result: r.bcr === null ? "n/a" : r.bcr.toFixed(2) },
        { name: "IRR", expr: "the rate at which the NPV of net cash is 0", result: irrText(r.irr) },
        { name: "Cash payback", expr: "the year from which cumulative net cash stays at or above 0, counted from year 0 and interpolated within the year", result: paybackText(r.payback) },
      ] },
    ],
    note: "Not included: taxes (results are before tax), financing (the lender's view comes later) and price changes (amounts are in today's dollars with a real discount rate).",
  };
}

/** The notice the page shows in place of results that are not finite (judgment: values too large to compute). */
export const TOO_LARGE = "These values are too large to compute. Check the inputs for a number entered far too large.";

// ---------------------------------------------------------------- the assumptions list and sources (9.5 items 4 and 5)

/** What each evidence class means, as the badges and the assumptions list say it (9.5 item 3). */
export const CLASS_TEXT = { A: "official statistics", B: "research or extension", C: "vendor information", D: "your entry", E: "made-up example value" };

/**
 * A badge's hover text (9.5 items 3 and 4): what its class means, never its source, so a company or product name
 * appears only in a linked source citation.
 */
export const badgeTitle = (cls) => CLASS_TEXT[cls] ?? "";
const WORD_VALUES = {
  cowCalf: "commercial cow-calf", stocker: "stocker", seedstock: "seedstock", other: "other", owned: "owned", leased: "leased",
  tenant: "tenant", landlord: "landlord", absorbed: "absorbed", replacesPaidWork: "replaces paid work", hour: "hours", day: "days",
  week: "weeks", position: "a position", paid: "a paid hand", unpaid: "unpaid", capital: "bought", annual: "billed each season",
  fixed: "one amount", perDevice: "per device", perHeadMonth: "per head per month", perHeadYear: "per head per year",
  advance: "at the start of the season", arrears: "at the end of the season", straightLine: "straight line", none: "none",
  pctOfCost: "a % of cost", amount: "an amount", avoided: "avoided", deferred: "deferred", purchased: "purchased collars",
};

/** A stored value as the assumptions list shows it, in the unit the page uses for its input. */
function valueText(a, path, v) {
  const { unit, scale = 1 } = inputInfo(a, path);
  const one = (x) => {
    if (typeof x === "boolean") return x ? "yes" : "no";
    if (typeof x === "string") return WORD_VALUES[x] ?? CLASS_NAMES[x] ?? x;
    if (typeof x !== "number") return "blank";
    return withUnit(x * scale, unit);
  };
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v.map(one).join(", ");
  // The free tags' billing years are a list of years, not a value by year (9.2).
  if (path === "eid.freeTags.years" && Array.isArray(v)) {
    const ys = v.filter((x) => typeof x === "number");
    return ys.length === 0 ? "blank" : yearsNamed(ys);
  }
  // A per-year list as the engine reads it, years 0..T, its last value carried forward (9.2).
  if (Array.isArray(v)) {
    return byYearText(Array.from({ length: lastShownYear(a) + 1 }, (_, t) => at(v, t)).map((x) => (typeof x === "number" ? one(x) : "blank")));
  }
  return one(v);
}

/** Years named in a sentence: "year 3", "years 1 and 2", "years 1, 2 and 4". */
const yearsNamed = (ys) => (ys.length === 1 ? `year ${ys[0]}` : `years ${ys.slice(0, -1).join(", ")} and ${ys.at(-1)}`);

/**
 * A value entered by year: the value most years share, with the years that differ named ("$100 per monitor in years 4
 * and 8, $0 per monitor in the other years"), or each year in turn when no two years share a value.
 */
function byYearText(texts) {
  const count = new Map();
  for (const t of texts) count.set(t, (count.get(t) ?? 0) + 1);
  const [base, n] = [...count].reduce((m, x) => (x[1] > m[1] ? x : m));
  if (n === texts.length) return `${base} in every year`;
  if (n === 1) return `by year from year 0: ${texts.join("; ")}`;
  const years = (t) => texts.flatMap((x, i) => (x === t ? [i] : []));
  const others = [...count.keys()].filter((t) => t !== base).map((t) => `${t} in ${yearsNamed(years(t))}`);
  return `${others.join(", ")}, ${base} in the other years`;
}

/** A source's address when it is a web page (http or https), else null: the page links to nothing else (9.5 item 4). */
export function safeUrl(u) {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol) ? u : null;
  } catch {
    return null;
  }
}

/**
 * The source part of a value's label (9.5 item 4): a price's label when it has one, else its source with its date,
 * and, for research from outside the US, the country, currency and data year. The link goes to prov.url.
 */
export function sourceText(p) {
  if (!p) return "";
  const price = priceLabel(p);
  if (price && (p.placeholder || p.cls === "C")) return price;
  const parts = [p.src];
  if (p.pub) parts.push(p.pub);
  if (p.region && !/^US\b/.test(p.region)) parts.push(`${p.region}${p.currency && p.currency !== "USD" ? `, ${p.currency}` : ""}${p.dataYear ? `, data ${p.dataYear}` : ""}; may not apply in the US`);
  return parts.filter(Boolean).join(", ");
}

/**
 * Every value with its class and source (9.5 item 4), in the order the analysis holds them: the input's label, its
 * value, its evidence class and what that class means, the source text and link, any note, and whether it is a
 * synthetic placeholder (flagged, with "Keep this value", in the user's own analysis until kept: 9.5 item 5).
 */
export function assumptions(a) {
  return Object.entries(a.prov ?? {}).map(([path, p]) => {
    const v = path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), a);
    const source = sourceText(p);
    return {
      path, label: inputInfo(a, path).label, value: valueText(a, path, v), cls: p.cls, classText: CLASS_TEXT[p.cls] ?? "",
      source, cite: sourceCite(p, source), url: p.url ?? null, note: p.placeholder || p.cls === "C" ? null : p.note ?? null,
      placeholder: !!p.placeholder, confirmed: !!p.confirmed,
    };
  });
}

/**
 * The part of a source text that links to prov.url (9.5 item 4): the source and its document, "<src>, <pub>" for a
 * vendor price and <src> otherwise; null when the record has no link or the text does not hold it.
 */
function sourceCite(p, source) {
  if (!safeUrl(p.url) || !p.src) return null;
  const cite = p.cls === "C" && p.pub ? `${p.src}, ${p.pub}` : p.src;
  return source.includes(cite) ? cite : null;
}

// ---------------------------------------------------------------- the verdict area and the rate (9.5 items 1 and 5)

export const INDICATIVE = "Indicative only: most of the benefit is estimated, not from your records.";

/**
 * "Indicative only" (9.3, 7.3): a cash line, or a capital line's residual, is estimated when any input its value rests
 * on is [B], [C] or [E]; the line shows when the PV of the estimated ones is more than half of PV(B) + PV(R). A price
 * never supports a benefit line: a cash line's inputs are its own. A residual rests on its line's inputs and on its own
 * (the share of cost, the life of a straight-line residual, or the amount, which alone gives an amount residual); the
 * avoided fence also on its life, build year and, when deferred, the years deferred.
 */
export function indicativeOnly(a, r) {
  const estimated = (paths) => paths.some((p) => ["B", "C", "E"].includes(a.prov?.[p]?.cls));
  let pv = 0;
  for (const l of r.lines) {
    if (l.kind === "cash" && estimated([...(l.paths ?? []), ...fencePaths(a, l)])) pv += l.pv;
    if (l.kind === "cost" && l.pvResidual && estimated(residualPaths(a, l))) pv += l.pvResidual;
  }
  return pv > 0.5 * (r.pv.B + r.pv.R);
}

/** The fence's inputs besides those it multiplies: its life, build year and years deferred (9.3 Virtual fence). */
function fencePaths(a, l) {
  if (l.id !== "fence") return [];
  return ["vf.fence.Lf", "vf.fence.k", ...(a.vf?.fence?.mode === "deferred" ? ["vf.fence.d"] : [])];
}

/** The inputs a capital line's residual rests on, by its mode (9.3, as roi.js scheduleCapital reads it). */
function residualPaths(a, l) {
  const c = a.costs?.[l.id] ?? {}, p = `costs.${l.id}`;
  const life = c.lifeYears === null || c.lifeYears === undefined || c.lifeYears === "" ? null : c.lifeYears;
  const mode = c.residual?.mode || (life === null ? "none" : "straightLine");
  if (mode === "amount") return [`${p}.residual.dollars`];
  return [...(l.paths ?? []), ...(mode === "pctOfCost" ? [`${p}.residual.pct`] : mode === "straightLine" ? [`${p}.lifeYears`] : [])];
}

/**
 * The verdict area in its order (9.5 item 1): "Indicative only" when it applies; the verdict sentence; the
 * payback-target line; the "It would pay" sentence when the N-year test fails; the capacity-hours line; the rate and
 * placeholder notes; and the published-prices sentence. bars are the tornado's (tornado(a, r).bars).
 */
export function verdictArea(a, r, test, rows, bars) {
  const lines = [];
  if (!r.noCashFlows && indicativeOnly(a, r)) lines.push(INDICATIVE);
  lines.push(verdictSentence(a, r, bars), paybackTargetLine(test));
  const pay = wouldPaySentence(test, rows);
  if (pay) lines.push(pay);
  const hours = capacityLine(r);
  if (hours) lines.push(hours);
  lines.push(...verdictNotes(a), PUBLISHED_PRICES);
  return lines;
}

export const RATE_EXAMPLE_LABEL = "Example assumption (real rate), not a recommendation. Review it for your operation.";
export const RATE_PROMPT = "Review this rate";
export const RATE_HELP = "real rate ≈ your loan rate + a risk premium − expected inflation";

/**
 * What the page shows with the discount rate (9.5 item 5): the example label while the rate is the example's
 * unedited value, followed by "Reviewed" once kept; the "Review this rate" prompt, its help text and the "Keep this
 * rate" button while the analysis is the user's own and the rate is not reviewed. An edited rate is the user's [D]
 * value, with its badge and no label; a version 1 link's rate shows its badge and source ("version 1 link"),
 * followed by "Reviewed" once kept.
 */
export function rateField(a) {
  const p = a.prov?.["settings.discountRate"];
  const reviewed = !!a.settings.rateReviewed;
  const own = !!a.settings.ownAnalysis;
  const example = exampleRate(a);
  let label = example ? RATE_EXAMPLE_LABEL : p?.src === "version 1 link" ? p.src : null;
  if (label && reviewed) label += " Reviewed";
  return { label, cls: p?.cls ?? null, prompt: own && !reviewed, help: RATE_HELP };
}

export const PLACEHOLDER_FLAG = "Not yet replaced or confirmed.";

/**
 * The flag after a synthetic placeholder's label (9.5 item 5): in the user's own analysis, "Not yet replaced or
 * confirmed." with a "Keep this value" button until kept, then "Confirmed" with no button. null otherwise.
 */
export function placeholderFlag(a, path) {
  const p = a.prov?.[path];
  if (!p?.placeholder) return null;
  if (p.confirmed) return { text: "Confirmed", keep: false };
  return a.settings.ownAnalysis ? { text: PLACEHOLDER_FLAG, keep: true } : null;
}

/**
 * The label under a price input (9.5 items 4 and 7): its price label with the link to its source, or "Quote required"
 * when it is blank. { text, cite, url, quote }: cite is the part of text that links to url.
 */
export function priceNote(a, path, value) {
  const blankValue = value === null || value === undefined || value === "" || (Array.isArray(value) && value.every((x) => x === null || x === ""));
  if (blankValue) return { text: "Quote required", cite: null, url: null, quote: true };
  const p = a.prov?.[path];
  const text = priceLabel(p);
  if (!text) return null;
  const cite = p.cls === "C" ? `${p.src}, ${p.pub}` : null;
  return { text, cite: cite && text.includes(cite) ? cite : null, url: safeUrl(p.url), quote: false };
}

// ---------------------------------------------------------------- sources (9.5 item 5)

/**
 * The page's Sources table (9.5 items 4 and 5), rebuilt from the examples' `prov`: for each example, each value with
 * a source (a published, reported or researched value) or a synthetic placeholder, with its label, value, what it is
 * and its linked citation. Benefit assumptions [E] are in the assumptions list instead.
 */
export function exampleSources(examples) {
  const rows = [];
  for (const a of examples) {
    for (const x of assumptions(a)) {
      if (!(x.placeholder || ["A", "B", "C"].includes(x.cls))) continue;
      rows.push({ example: EXAMPLE_NAMES[a.example], label: x.label, value: x.value, cls: x.cls, source: x.source, cite: x.cite,
        url: x.url, note: x.note });
    }
  }
  return rows;
}
