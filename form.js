// The page's inputs, in the order of docs/audit/phase1-spec.md 9.4, as data (9.1: everything but the page wiring runs
// in node). formGroups(a) lists, for the analysis a, the groups of inputs the page shows; app.js only draws them and
// sends each change to state.js. Labels and units come from text.js inputInfo(), so the page, its notices and its
// validation errors name each input alike (9.4 intro). Pure functions, no DOM.
import { CLASS_NAMES, LINE_LABELS, buildLines, eidRuleClasses, lastShownYear, lineLabel, shareCap } from "./roi.js";
import { EID_RULE_NOTICE, inputInfo, HELP } from "./text.js";
import { vendorFill } from "./examples.js";
import { at } from "./roi.js";
import { getAt, installHours, installShaped, isInstall, LINE_TEMPLATES, PRICING_LINES } from "./state.js";

export { LINE_TEMPLATES, PRICING_LINES };

/** The classes in the order of 9.2; the sale flows are never enrolled or served. */
export const CLASSES = Object.keys(CLASS_NAMES);
const SALE_FLOWS = ["calvesSold", "cullCowsSold"];
export const INVENTORY = CLASSES.filter((c) => !SALE_FLOWS.includes(c));
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Choices of the inputs that take one of a field's listed values (9.2), as [stored value, text on the page]. */
export const CHOICES = {
  opType: [["cowCalf", "Commercial cow-calf"], ["stocker", "Stocker"], ["seedstock", "Seedstock"], ["other", "Other"]],
  kind: [["owned", "Owned"], ["leased", "Leased"]],
  party: [["tenant", "You (the tenant)"], ["landlord", "The landlord"]],
  freedTimeUse: [["absorbed", "Absorbed: it goes to other work and no pay changes (not cash)"],
    ["replacesPaidWork", "It replaces paid work: pay or a contract is cut (cash)"]],
  laborUnit: [["hour", "Hours"], ["day", "Days"], ["week", "Weeks"], ["position", "A position"]],
  doneBy: [["unpaid", "Unpaid (you or family)"], ["paid", "A paid hand"]],
  pricing: [["leased", "Leased collars with a subscription"], ["purchased", "Purchased collars plus a service fee"]],
  fenceMode: [["avoided", "Avoided"], ["deferred", "Deferred"]],
  residual: [["straightLine", "Straight line over its life"], ["none", "None"], ["pctOfCost", "A % of its cost"],
    ["amount", "A dollar amount"]],
  billing: [["advance", "At the start of the season"], ["arrears", "At the end of the season"]],
  subscriptionBasis: [["perHeadMonth", "Per head per month"], ["perHeadYear", "Per head per year (12 months)"]],
  softwareTiming: [["annual", "Each year, billed in advance"], ["capital", "One time"]],
  classes: CLASSES.map((c) => [c, capitalize(CLASS_NAMES[c])]),
  inventory: INVENTORY.map((c) => [c, capitalize(CLASS_NAMES[c])]),
};

/** The items the page adds to a list (9.2), each blank but for its defaults. */
export function newItem(a, path) {
  switch (path) {
    case "settings.landUnits": {
      const ids = new Set((a.settings.landUnits ?? []).map((u) => u.id));
      let n = ids.size + 1;
      while (ids.has(`u${n}`)) n++;
      return { id: `u${n}`, kind: "owned", share: 0 };
    }
    case "water.blocks":
      return { name: `block ${(a.water?.blocks?.length ?? 0) + 1}`, weeks: 0, runsPerWeek: 0, milesPerRun: 0, hoursPerRun: 0,
        minVisitsPerWeek: 0, freezeOrFeedRoute: false, shareAvoided: null };
    case "labor.added": {
      // The first "added item N" not in use, so no two items share a name after a removal.
      const used = new Set((a.labor?.added ?? []).map((x) => x.label));
      let n = (a.labor?.added?.length ?? 0) + 1;
      while (used.has(`added item ${n}`)) n++;
      return { label: `added item ${n}`, hours: null, doneBy: "unpaid" };
    }
    case "labor.handling.events":
      return { label: `event ${(a.labor?.handling?.events?.length ?? 0) + 1}`, classes: [], timesPerYear: null, minutesPerHead: null,
        crewSize: null };
    case "riskLines":
      return { cause: a.module === "water" ? "water" : "", class: INVENTORY.find((c) => a.classes?.[c]) ?? "cows",
        eventsPerYear: null, headPerEvent: null, shareCaught: null };
    default:
      return null;
  }
}

// ---------------------------------------------------------------- fields

/**
 * A number input at path, with its label and unit from inputInfo() and the factor that turns the stored value into
 * the shown one (a share stored as a fraction shows as a percent, 9.2; EID's seconds per read are stored as minutes).
 */
function num(a, path, more = {}) {
  const info = inputInfo(a, path);
  const scale = info.scale ?? (info.unit.startsWith("%") ? 100 : 1);
  return { type: "num", path, label: info.label, unit: info.unit, scale, ...more };
}

/**
 * A field's label as the page shows it (9.4 intro): the label followed by its unit in parentheses, "Payback target
 * (years)". A unit the label already ends with, or that only repeats it ("Monitors"), is not added again.
 */
export function shownLabel(f) {
  const unit = f.unit ?? "";
  if (!unit || f.label.endsWith(`(${unit})`) || f.label.toLowerCase() === unit.toLowerCase()) return f.label;
  return `${f.label} (${unit})`;
}
/** The label inputInfo() gives an input (9.4 intro), or the fallback when it names none. */
const labelOf = (a, path, fallback) => {
  const { label } = inputInfo(a, path);
  return label === path ? fallback : label;
};
const choice = (a, path, label, options, more = {}) => ({ type: "select", path, label: labelOf(a, path, label), options, ...more });
const yes = (a, path, label, more = {}) => ({ type: "yes", path, label: labelOf(a, path, label), ...more });
const text = (a, path, label, more = {}) => ({ type: "text", path, label: labelOf(a, path, label), ...more });
const classes = (a, path, label, options = CHOICES.classes, more = {}) => ({ type: "classes", path, label: labelOf(a, path, label), options, ...more });
const item = (path, i, title, rows, more = {}) => ({ type: "item", path, i, title, rows, ...more });
const add = (path, label) => ({ type: "add", path, label });

/** A price input (9.4 intro): its label, the fill it offers (9.5 item 7) and, read by the page, its prov label. */
function price(a, path, more = {}) {
  return num(a, path, { price: true, fill: vendorFill(a, path) !== null, ...more });
}

/** "Who pays for this?" or "Who receives this saving?" of a line (9.4 Shared, 9.5 item 7), at its stored path. */
function share(a, line) {
  const stored = a.costs?.[line.id] ? `costs.${line.id}.operatorShare` : `${line.kind === "cost" ? "costShares" : "benefitShares"}.${line.id}`;
  return { type: "share", path: stored, lineId: line.id, label: line.kind === "cost" ? "Who pays for this?" : "Who receives this saving?",
    unit: "%", scale: 100 };
}

// ---------------------------------------------------------------- groups (9.4)

const LEASE_FIELDS = {
  water: ["waterBy", "careInLeaseRate"],
  vf: ["fenceBuiltBy", "fenceMaintainedBy", "fenceReimbursement"],
  eid: [],
};

function landUnitRows(a) {
  const units = a.settings.landUnits ?? [];
  const rows = units.map((u, i) => {
    const p = `settings.landUnits.${i}`;
    const r = [choice(a, `${p}.kind`, "Owned or leased", CHOICES.kind), num(a, `${p}.share`)];
    if (u.kind === "leased") {
      r.push(num(a, `${p}.leaseYears`), yes(a, `${p}.renewalExpected`, "Renewal expected"));
      for (const f of LEASE_FIELDS[a.module]) {
        if (f === "fenceReimbursement") r.push(num(a, `${p}.fenceReimbursement`));
        else if (f === "careInLeaseRate") r.push(yes(a, `${p}.careInLeaseRate`, "Water care is included in the lease rate"));
        else {
          const label = { waterBy: "Who provides and checks the water", fenceBuiltBy: "Who builds the fence", fenceMaintainedBy: "Who maintains the fence" }[f];
          r.push(choice(a, `${p}.${f}`, label, CHOICES.party, { dflt: "tenant" }));
        }
      }
    }
    return item("settings.landUnits", i, `Land unit ${i + 1}`, r, { removable: true });
  });
  return [...rows, add("settings.landUnits", "Add a land unit")];
}

/** The head of each class the analysis enters, by year where it varies (9.4 Shared: head by class and year). */
function herdRows(a) {
  const listed = CLASSES.filter((c) => a.classes?.[c]);
  const rows = listed.map((c) => item("classes", c, capitalize(CLASS_NAMES[c]), [
    num(a, `classes.${c}.head`, { byYear: true }),
    num(a, `classes.${c}.valuePerHead`),
    num(a, `classes.${c}.valueOfGain`, { advanced: true, help: HELP.valueOfGain }),
  ], { removable: listed.length > 1, key: true }));
  const missing = CLASSES.filter((c) => !a.classes?.[c]);
  if (missing.length) rows.push({ type: "addKey", path: "classes", label: "Add a class", options: CHOICES.classes.filter(([c]) => missing.includes(c)) });
  rows.push(num(a, "heifersRetained", { byYear: true }));
  return rows;
}

/**
 * Entries only a hand-made link puts in the classes served or enrolled: a sale flow under the module's own key, and
 * any class under the other module's key (validate() checks both, 9.2). Each is listed with a note and a Remove button
 * only, so an error it raises can be fixed without losing the other inputs.
 */
function strayRows(a, own) {
  const other = own === "enrolled" ? "served" : "enrolled";
  const row = (key, c, title, text) => item(key, c, title, [{ type: "note", error: true, text }],
    { removable: true, key: true, removeLabel: `Remove ${CLASS_NAMES[c] ?? c} from the ${key === "enrolled" ? "enrolled classes" : "classes served"}` });
  return SALE_FLOWS.filter((c) => Object.hasOwn(a[own] ?? {}, c))
    .map((c) => row(own, c, capitalize(CLASS_NAMES[c]), `A sale flow drawn from another class cannot be ${own}. Remove it to see results.`))
    .concat(Object.keys(a[other] ?? {}).map((c) => row(other, c, `${capitalize(CLASS_NAMES[c] ?? c)} (${other})`,
      other === "enrolled" ? "Only a virtual fence analysis enrolls classes. Remove it." : "Only a water or EID analysis serves classes. Remove it.")));
}

/** Virtual fence: the enrolled classes, head and months (9.4); water and EID: the classes served and their months. */
function servedRows(a) {
  if (a.module === "vf") {
    const listed = INVENTORY.filter((c) => a.enrolled?.[c]);
    const rows = strayRows(a, "enrolled").concat(listed.map((c) => item("enrolled", c, capitalize(CLASS_NAMES[c]), [
      num(a, `enrolled.${c}.head`, { byYear: true }),
      num(a, `enrolled.${c}.months`, { byYear: true, help: "Months include trap training before turnout and collar removal at shipping, unless the quote bills grazing months only." }),
    ], { removable: true, key: true, removeLabel: `Remove ${CLASS_NAMES[c]} from the enrolled classes` })));
    const missing = INVENTORY.filter((c) => !a.enrolled?.[c]);
    if (missing.length) rows.push({ type: "addKey", path: "enrolled", label: "Enroll a class", options: CHOICES.inventory.filter(([c]) => missing.includes(c)) });
    return rows;
  }
  const listed = INVENTORY.filter((c) => a.served?.[c]);
  const rows = strayRows(a, "served").concat(listed.map((c) => item("served", c, capitalize(CLASS_NAMES[c]),
    [num(a, `served.${c}.months`, { byYear: true, placeholder: 12 })],
    { removable: true, key: true, removeLabel: `Remove ${CLASS_NAMES[c]} from the classes served` })));
  const missing = INVENTORY.filter((c) => !a.served?.[c]);
  if (missing.length) rows.push({ type: "addKey", path: "served", label: "Serve a class", options: CHOICES.inventory.filter(([c]) => missing.includes(c)) });
  return rows;
}

function settingsRows(a) {
  return [
    num(a, "settings.T"),
    num(a, "settings.paybackTarget", { help: "The page tests whether the analysis pays for itself within this many years." }),
    num(a, "settings.discountRate", { label: "Discount rate (real, %/yr)", unit: "", rate: true,
      help: "real rate ≈ your loan rate + a risk premium − expected inflation" }),
    { type: "note", text: "All amounts are in today's US dollars, with prices held flat, so the discount rate is a real rate. Every result is before tax." },
    num(a, "startYear"),
    num(a, "settings.oppCostPerHour"),
  ];
}

/** A list of years as typed ("0, 1" or "0 1"; commas, spaces or semicolons): the years, or null when one cannot be read. */
export function readYears(text) {
  const years = String(text).split(/[\s,;]+/).filter(Boolean).map(Number);
  return years.every((y) => Number.isFinite(y)) ? years : null;
}

/** The error of a list of years that cannot be read: the page keeps the text typed, and the analysis the last list read. */
export const yearsUnread = (years) => `Not read: enter whole years separated by commas, such as 0, 1. The analysis still uses ${years?.length ? years.join(", ") : "no years"}.`;

/** The help of paid labor cut by year: the years before the first operating year are not counted. */
export const cutFrom = (first) => `Counted from year ${first}, the first operating year; an entry for an earlier year is not counted.`;

/** The help of an install item whose hours are one number (a hand-made link): the engine counts it every operating year. */
export const INSTALL_EVERY_YEAR = "This value counts in every year after the start year. Enter it by year to count it in the install year only.";

/** The labor inputs every module shares (9.4 Shared and each module's "who drives"). */
function laborRows(a) {
  const L = a.labor ?? {};
  const rows = [choice(a, "labor.freedTimeUse", "What happens to the freed time?", CHOICES.freedTimeUse)];
  const cut = L.cut ?? {};
  // The unit has no default (9.2): until it is chosen, the page asks for the pay rate and not the hours per unit.
  const unit = cut.laborUnit;
  // By year, an entry before the first operating year is not counted (9.3 Timing), and the page says so.
  const first = Number.isInteger(a.startYear ?? 0) ? (a.startYear ?? 0) + 1 : null;
  const early = Array.isArray(cut.unitsCut) && first !== null ? { help: cutFrom(first) } : {};
  rows.push(choice(a, "labor.cut.laborUnit", "Paid labor is cut in", CHOICES.laborUnit), num(a, "labor.cut.unitsCut", { byYear: true, ...early }));
  if (unit && unit !== "hour") rows.push(num(a, "labor.cut.hoursPerUnit"));
  rows.push(unit === "position" ? num(a, "labor.cut.salary") : num(a, "labor.cut.paidRate"), num(a, "labor.cut.loadPct"));
  (L.added ?? []).forEach((x, i) => {
    const p = `labor.added.${i}`;
    // Water's install time is one entry, the module's start year, of an hours list that is 0 in the other years (9.4):
    // the page shows and writes the install hours, and state.js keeps them in that entry. Hours of another shape (an
    // old link, hours by year) show by year, as the engine counts them.
    const hours = !isInstall(a, i) ? num(a, `${p}.hours`, { byYear: true })
      : installShaped(a, x.hours) ? num(a, `${p}.hours`, { install: i })
      : num(a, `${p}.hours`, { byYear: true, ...(typeof x.hours === "number" ? { help: INSTALL_EVERY_YEAR } : {}) });
    const r = [text(a, `${p}.label`, "Name"), hours, choice(a, `${p}.doneBy`, "Done by", CHOICES.doneBy, { dflt: "unpaid" })];
    if (x.doneBy === "paid") r.push(num(a, `${p}.paidRate`), num(a, `${p}.loadPct`));
    rows.push(item("labor.added", i, inputInfo(a, `${p}.hours`).label, r, { removable: true }));
  });
  rows.push(add("labor.added", "Add hours the technology takes"));
  if (a.module === "vf" || a.module === "eid") rows.push(...handlingRows(a));
  rows.push(num(a, "labor.otherHoursSaved", { advanced: true }));
  for (const f of ["salary", "loadPct", "startYear", "years"]) rows.push(num(a, `labor.avoidedHire.${f}`, { advanced: true }));
  return rows;
}

function handlingRows(a) {
  const h = a.labor?.handling ?? {};
  const rows = [];
  // Events of the same name are told apart by their classes (Ranch C weighs its cows and its calves), else by number.
  const events = h.events ?? [];
  const named = events.map((e, i) => {
    const name = e.label ?? `event ${i + 1}`;
    if (events.filter((x) => (x.label ?? null) === (e.label ?? null)).length < 2) return name;
    return `${name} (${(e.classes ?? []).map((c) => CLASS_NAMES[c]).join(", ") || `event ${i + 1}`})`;
  });
  const titles = named.map((x, i) => (named.indexOf(x) !== named.lastIndexOf(x) ? `${x}, event ${i + 1}` : x));
  events.forEach((e, i) => {
    const p = `labor.handling.events.${i}`;
    rows.push(item("labor.handling.events", i, `Handling: ${titles[i]}`, [
      text(a, `${p}.label`, "Name"),
      classes(a, `${p}.classes`, "Classes", CHOICES.inventory),
      num(a, `${p}.timesPerYear`), num(a, `${p}.minutesPerHead`), num(a, `${p}.crewSize`),
    ], { removable: true }));
  });
  rows.push(add("labor.handling.events", a.module === "eid" ? "Add a weighing" : "Add a handling event"));
  if (a.module === "vf") {
    for (const f of ["gathers", "gatherRiders", "hoursPerGather"]) rows.push(num(a, `labor.handling.${f}`));
    rows.push(num(a, "labor.handling.trainingDays", { byYear: true }), num(a, "labor.handling.trainingRiders"), num(a, "labor.handling.hoursPerDay"));
  }
  rows.push(choice(a, "labor.handling.doneBy", "Handling done by", CHOICES.doneBy));
  if (h.doneBy === "paid") rows.push(num(a, "labor.handling.paidRate"), num(a, "labor.handling.loadPct"));
  return rows;
}

const MIN_VISITS_HELP = "Visits you would make anyway, for cattle, bull and mineral checks. Two Australian studies make the "
  + "same point: PIRSA (South Australia, February 2022 prices) says monitors \"do not eliminate the need to inspect tanks and "
  + "troughs\", and in MLA report B.NBP.0505 (Queensland, Australia, 2011; data about 2009–11) a producer withdrew because "
  + "visual inspections were still needed. Both describe Australian stations and are cited for the practice, not as a US "
  + "value or default.";
export const MIN_VISITS_SOURCES = [
  ["PIRSA", "https://pir.sa.gov.au/research/agtech/find_solutions/products/farmbot-tank-monitor"],
  ["MLA B.NBP.0505", "https://mla.com.au/contentassets/dd4b131cce5f4d49abd20980e1a5b68b/b.nbp.0505_final_report.pdf"],
];

function waterRows(a) {
  const w = a.water ?? {};
  const rows = [num(a, "water.monitors")];
  (w.blocks ?? []).forEach((b, i) => {
    const p = `water.blocks.${i}`;
    rows.push(item("water.blocks", i, `Season block: ${b.name ?? i + 1}`, [
      text(a, `${p}.name`, "Name"),
      num(a, `${p}.weeks`), num(a, `${p}.runsPerWeek`), num(a, `${p}.milesPerRun`), num(a, `${p}.hoursPerRun`),
      num(a, `${p}.minVisitsPerWeek`, { help: MIN_VISITS_HELP, sources: MIN_VISITS_SOURCES }),
      yes(a, `${p}.freezeOrFeedRoute`, "Tanks freeze / water checked on the feeding route", { help: "A frozen tank can still read full." }),
      num(a, `${p}.shareAvoided`, { cap: shareCap(b) }),
    ], { removable: true }));
  });
  rows.push(add("water.blocks", "Add a season block"));
  rows.push(num(a, "water.variableCostPerMile"));
  return rows;
}

function vfRows(a) {
  const v = a.vf ?? {};
  const rows = [choice(a, "vf.pricing", "Pricing model", CHOICES.pricing), num(a, "vf.batteriesPerCollar"),
    num(a, "vf.collarLoss.pctPerYear"), price(a, "vf.collarLoss.chargePerCollar")];
  const f = v.fence ?? {};
  rows.push({ type: "heading", text: "Interior fence the technology replaces" });
  const units = a.settings.landUnits ?? [];
  // Asked with more than one land unit, and also whenever the stored unit names none of them, so its error can be fixed.
  if (units.length > 1 || (f.landUnitId && !units.some((u) => u.id === f.landUnitId))) {
    // A blank land unit is the first one (9.2), as the engine reads it.
    rows.push(choice(a, "vf.fence.landUnitId", "Land unit the fence is on", a.settings.landUnits.map((u, i) => [u.id, `Land unit ${i + 1}`]),
      { dflt: units[0]?.id }));
  }
  for (const k of ["miles", "planMiles", "F", "k", "Lf", "m"]) rows.push(num(a, `vf.fence.${k}`));
  rows.push(choice(a, "vf.fence.mode", "Avoided or deferred", CHOICES.fenceMode));
  if (f.mode === "deferred") rows.push(num(a, "vf.fence.d"));
  rows.push({ type: "heading", text: "Moving, gathering and health checks" });
  rows.push(num(a, "vf.gatherHoursToday"), num(a, "vf.gatherHoursCut"),
    num(a, "vf.healthCheckHoursCut", { help: "Collars do not replace pulling and doctoring sick cattle." }),
    yes(a, "vf.validatedAlert", "I can cite a validated alert function (counts the health-check hours as cash)"));
  return rows;
}

export const EID_RULE_QUESTION = "Does the EID rule apply to cattle you move?";
export const EID_RULE_HELP = "Sexually intact cattle 18 months and older, dairy cattle, and rodeo, recreation, show and exhibition "
  + "cattle, moved interstate other than directly to slaughter.";

function eidRows(a) {
  const ruleClasses = eidRuleClasses(a);
  const rows = ruleClasses.map((c) => yes(a, `eid.ruleApplies.${c}`, `${EID_RULE_QUESTION} (${CLASS_NAMES[c]})`, { help: EID_RULE_HELP, rule: true }));
  // The B4a notice beside the question while any class is answered yes (9.4 EID, 10.1 row 36).
  if (ruleClasses.some((c) => a.eid?.ruleApplies?.[c] === true)) rows.push({ type: "note", text: EID_RULE_NOTICE, rule: true });
  rows.push(price(a, "eid.tagPrice"), num(a, "eid.retagPct"), num(a, "eid.freeTags.qty", { byYear: true }),
    { type: "years", path: "eid.freeTags.years", label: "Free-tag billing years" },
    num(a, "eid.recordingHoursToday"));
  rows.push({ type: "heading", text: "Program premium" });
  rows.push(num(a, "eid.premium.saleCwt"), num(a, "eid.premium.premiumPerCwt"), num(a, "eid.premium.verificationFee"),
    text(a, "eid.premium.quoteNote", "Buyer quote note"));
  rows.push({ type: "heading", text: "Dosing savings" });
  rows.push(num(a, "eid.dosing.perApplication"));
  for (const c of INVENTORY.filter((x) => a.classes?.[x])) rows.push(num(a, `eid.dosing.applications.${c}`));
  return rows;
}

/** The cost lines (9.4), each with its price and its other fields, and the lines the module can add. */
function costRows(a) {
  const m = a.module, rows = [];
  const pricing = a.vf?.pricing;
  const hidden = (id) => m === "vf" && ((pricing === "leased" && (id === "collars" || id === "serviceFee"))
    || (pricing === "purchased" && id === "subscription"));
  const leased = (a.settings.landUnits ?? []).some((u) => u.kind === "leased");
  for (const [id, c] of Object.entries(a.costs ?? {})) {
    if (hidden(id)) continue;
    const p = `costs.${id}`;
    const r = [];
    const tag = m === "eid" && ["cowTags", "calfTags", "retags"].includes(id);
    if (!tag) r.push(price(a, `${p}.unitCost`, { byYear: true }));
    // The classes that get cow tags (9.4 EID), cows when none is chosen, as the engine counts them.
    if (m === "eid" && id === "cowTags") r.push(classes(a, `${p}.classes`, "Classes", CHOICES.inventory, { dflt: ["cows"] }));
    if (m === "vf" && id === "subscription") r.push(choice(a, `${p}.basis`, "Billed", CHOICES.subscriptionBasis));
    if (m === "vf" && id === "baseStations") r.push(num(a, `${p}.qty`));
    if (m === "eid" && id === "software") r.push(choice(a, `${p}.timing`, "Paid", CHOICES.softwareTiming));
    const capital = (c.timing ?? LINE_TEMPLATES[m]?.[id]?.timing) === "capital";
    const details = [];
    if (capital) {
      details.push(num(a, `${p}.lifeYears`), num(a, `${p}.repairPct`));
      details.push(choice(a, `${p}.residual.mode`, `Residual (${lineLabel(a, id)})`, CHOICES.residual,
        { dflt: c.lifeYears === null || c.lifeYears === undefined || c.lifeYears === "" ? "none" : "straightLine" }));
      if (c.residual?.mode === "pctOfCost") details.push(num(a, `${p}.residual.pct`));
      if (c.residual?.mode === "amount") details.push(num(a, `${p}.residual.dollars`));
      if (leased) details.push(yes(a, `${p}.staysWithLand`, "Stays with the land when a lease ends"), num(a, `${p}.leaseReimbursement`));
    } else if (!(m === "vf" && ["serviceFee", "collarBatteries"].includes(id)) && !tag) {
      details.push(choice(a, `${p}.billing`, "Billed", CHOICES.billing, { dflt: ["subscription", "serviceFee"].includes(id) ? "advance" : "arrears" }));
    }
    if (!capital) details.push(num(a, `${p}.minQty`), num(a, `${p}.commitYears`), num(a, `${p}.earlyTerminationFee`));
    details.push(num(a, `${p}.startYear`));
    r.push({ type: "details", label: "Life, residual, billing and contract", rows: details });
    rows.push(item("costs", id, lineLabel(a, id), r, { removable: !required(a, id), key: true, line: id }));
  }
  const addable = Object.keys(LINE_TEMPLATES[m] ?? {}).filter((id) => !a.costs?.[id] && !hidden(id));
  if (addable.length) rows.push({ type: "addKey", path: "costs", label: "Add a cost line", options: addable.map((id) => [id, LINE_LABELS[m]?.[id] ?? id]) });
  return rows;
}

/** A line the module needs for its pricing or its tags; the page offers no "Remove" for it. */
function required(a, id) {
  if (a.module === "vf") return (PRICING_LINES[a.vf?.pricing] ?? []).includes(id);
  if (a.module === "eid") return ["cowTags", "calfTags", "retags"].includes(id);
  return a.module === "water" && (id === "monitors" || id === "subscription");
}

/** "Who pays for this?" and "Who receives this saving?" on every line (9.4 Shared, F6), in the order buildLines gives. */
function shareRows(a) {
  let lines;
  try {
    lines = buildLines(a);
  } catch {
    return [];
  }
  return lines.filter((l) => l.kind !== "hours").map((l) => ({ ...share(a, l), title: l.label }));
}

function advancedRows(a) {
  const rows = [];
  if (a.module !== "water") {
    rows.push({ type: "heading", text: "Weight gain" });
    rows.push(num(a, "production.lbPerHeadPerDay"), num(a, "production.days"),
      classes(a, "production.classes", "Classes sold", CHOICES.classes.filter(([c]) => ["calvesSold", "cullCowsSold", "yearlings"].includes(c))),
      num(a, "production.soldShare"), yes(a, "production.fromRecords", "From my own records (counts as cash)"),
      text(a, "production.sourceNote", "Source note"));
  }
  rows.push({ type: "heading", text: "Losses avoided" });
  (a.riskLines ?? []).forEach((r, i) => {
    const p = `riskLines.${i}`;
    rows.push(item("riskLines", i, lineLabel(a, `risk:${i}`), [
      text(a, `${p}.cause`, "Cause"), choice(a, `${p}.class`, "Class", CHOICES.inventory),
      num(a, `${p}.eventsPerYear`), num(a, `${p}.headPerEvent`), num(a, `${p}.shareCaught`),
    ], { removable: true }));
  });
  rows.push(add("riskLines", "Add a loss you expect to avoid"));
  if (a.module === "water") {
    rows.push(num(a, "water.fewerChecksLoss.headPerYear"), choice(a, "water.fewerChecksLoss.class", "Class (losses from fewer physical checks)", CHOICES.inventory));
  }
  return rows;
}

/** The ramp (B3, 9.4): each module's share of the full benefit in its first three operating years. */
function rampRows(a) {
  return [{ type: "heading", text: "Ramp" }, ...[1, 2, 3].map((i) => num(a, `ramp.${i}`))];
}

/**
 * The groups of inputs the page shows for analysis a, in the order of 9.4: step 1 (the operation), step 2 (horizon,
 * target and rate), the module's own inputs, labor, costs, who pays and receives, and the advanced inputs.
 */
export function formGroups(a) {
  const own = { water: waterRows, vf: vfRows, eid: eidRows }[a.module];
  return [
    { id: "operation", title: "Step 1: Your operation", rows: [choice(a, "settings.opType", "Operation type", CHOICES.opType),
      { type: "heading", text: a.module === "eid" ? "Land units (optional)" : "Land units" }, ...landUnitRows(a),
      { type: "heading", text: "Herd" }, ...herdRows(a),
      { type: "heading", text: a.module === "vf" ? "Enrolled classes" : "Classes served" }, ...servedRows(a)] },
    { id: "settings", title: "Step 2: Horizon, payback target and rate", rows: settingsRows(a) },
    { id: "module", title: `Step 3: ${{ water: "Water", vf: "Virtual fence", eid: "EID and scale" }[a.module]}`, rows: [...(own ? own(a) : []), ...rampRows(a)] },
    { id: "labor", title: "Labor", rows: laborRows(a) },
    { id: "costs", title: "Costs", rows: costRows(a) },
    { id: "shares", title: "Who pays and who receives", rows: shareRows(a),
      note: "Each line's share is set from the land units unless you change it. Amounts paid or received by others are listed under the year table." },
    { id: "advanced", title: "Advanced", rows: advancedRows(a),
      note: "Benefits left blank are not counted, so they can only make the result look worse." },
  ];
}

/** Every field of formGroups(a), flattened (for tests and for the page's focus handling). */
export function formFields(a) {
  const out = [];
  const walk = (rows) => rows.forEach((r) => (r.rows ? walk(r.rows) : out.push(r)));
  formGroups(a).forEach((g) => walk(g.rows));
  return out.filter((r) => r.path && !["item", "add", "addKey"].includes(r.type));
}

/**
 * The value a field shows: the stored value times its scale; for a per-year list, its value in each year 0..T, the
 * years past its end carrying its last value as the engine does (9.2); for install time, the install hours.
 */
export function shownValue(a, field) {
  const v = getAt(a, field.path);
  const s = field.scale ?? 1;
  const one = (x) => (typeof x === "number" ? Number((x * s).toPrecision(12)) : x);
  if (field.install !== undefined) return one(installHours(a, v));
  if (!Array.isArray(v) || field.type !== "num") return one(v);
  return Array.from({ length: lastShownYear(a) + 1 }, (_, t) => one(at(v, t)));
}
