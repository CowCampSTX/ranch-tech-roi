// Tests of the page text (text.js), built from analyze() and combine() output: docs/audit/phase1-spec.md 9.5 items 9
// and 11, and the texts that 10.1 rows 6, 9 and 32 and the F1, F3 and F9 acceptance criteria assert in full.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, analyzeLines, buildLines, combine, irr, payback, valueOfGainFromQuotes } from "../roi.js";
import {
  money, quantity, count, joinAnd, poolName, moduleName, className, noticeText,
  irrText, paybackText, roundingUnit, aboutMoney, verdictSentence, capacityLine, verdictNotes, tiles, PUBLISHED_PRICES, HELP,
} from "../text.js";

const texts = (r, type) => r.notices.filter((n) => n.type === type).map(noticeText);
const stockers = (months) => ({ module: "vf", classes: { yearlings: { head: 1200 } }, enrolled: { yearlings: { head: 1200, months } } });
const subscription = (more) => ({ label: "Subscription", timing: "annual", basis: "perHeadMonth", classes: ["yearlings"], unitCost: 7, ...more });

test("formats: money in whole dollars from $100, cents below; quantities to two decimals; no '.00' (9.5 items 9, 11)", () => {
  assert.equal(money(10000), "$10,000");
  assert.equal(money(1490), "$1,490");
  assert.equal(money(7), "$7");
  assert.equal(money(6.666), "$6.67");
  assert.equal(money(-5000), "−$5,000");
  assert.equal(money(-0.001), "$0");
  assert.equal(quantity(200), "200");
  assert.equal(quantity(1.5), "1.50");
  assert.equal(quantity(0.75), "0.75");
  assert.equal(quantity(14.1421), "14.14");
  assert.equal(quantity(17760), "17,760");
  assert.equal(quantity(-8), "−8");
  assert.equal(count(1, "year"), "1 year");
  assert.equal(count(2, "year"), "2 years");
  assert.equal(count(-1, "hour"), "\u22121 hour");
  assert.equal(count(-2, "hour"), "\u22122 hours");
  assert.equal(count(1.001, "month"), "1 month"); // singular when it shows as 1
  assert.equal(count(5.5, "month"), "5.50 months");
  assert.equal(joinAnd(["A"]), "A");
  assert.equal(joinAnd(["A", "B"]), "A and B");
  assert.equal(joinAnd(["A", "B", "C"]), "A, B and C");
});

test("names: modules, pools and classes as the page writes them (9.5 items 9, 11)", () => {
  assert.equal(moduleName("water"), "Remote water monitoring");
  assert.equal(moduleName("vf"), "Collar-based virtual fencing");
  assert.equal(moduleName("eid"), "EID tags and scale");
  assert.equal(moduleName("Module A"), "Module A"); // a fixture module by its own name
  assert.equal(poolName("waterRuns"), "water runs");
  assert.equal(poolName("gatherHours"), "moving and gathering hours");
  assert.equal(poolName("deathLoss:water"), "death loss (water)");
  assert.equal(poolName("fenceMiles"), "interior fence miles");
  assert.deepEqual(["cows", "bulls", "replacementHeifers", "calvesBorn", "yearlings"].map(className),
    ["cows", "bulls", "replacement heifers", "calves", "yearlings"]);
});

test("row 6: the per-head-year warning names the line, the class and its months", () => {
  const r = analyze({ settings: { T: 1, discountRate: 0.07 }, ...stockers(5), costs: { subscription: subscription({ basis: "perHeadYear" }) } });
  assert.deepEqual(texts(r, "perHeadYearMonths"),
    ["Subscription is billed for 12 months per head, but the yearlings are enrolled for 5 months in year 1. Check how your quote bills."]);
});

test("row 32: the horizon that ends inside a contract", () => {
  const r = analyze({ settings: { T: 2, discountRate: 0.07 }, ...stockers(5.5),
    costs: { subscription: subscription({ billing: "advance", commitYears: 3, earlyTerminationFee: 10000 }) } });
  assert.deepEqual(texts(r, "commitPastHorizon"),
    ["The horizon (2 years) ends inside the 3-year contract on Subscription, so its early-termination fee ($10,000) is charged in year 2."]);
});

test("F3: 'No cattle in year t: benefits not counted.' for each year without head-months", () => {
  const r = analyze({ settings: { T: 3, discountRate: 0.07 }, classes: { cows: { head: [100, 100, 0, 0] } }, served: { cows: {} } });
  assert.deepEqual(texts(r, "noCattle"), ["No cattle in year 2: benefits not counted.", "No cattle in year 3: benefits not counted."]);
});

test("F1: the 'absorbed' notice", () => {
  const r = analyze({ settings: { T: 2, discountRate: 0.07 }, classes: { cows: { head: 100 } }, served: { cows: {} }, labor: { otherHoursSaved: 10 } });
  assert.deepEqual(texts(r, "absorbed"), ["Freed time is absorbed, so no cash labor saving is counted."]);
});

test("F9: the clamp warning and the blank-baseline prompt", () => {
  const a = { settings: { T: 2, discountRate: 0.07 }, classes: { cows: { head: 100 } }, served: { cows: {} },
    water: { blocks: [{ runsPerWeek: 4, weeks: 37 }] } };
  const runs = { id: "runs", label: "Runs avoided", kind: "cash", pool: "waterRuns", claim: () => 160, valuePerUnit: () => 10 };
  assert.deepEqual(texts(analyzeLines(a, [...buildLines(a), runs]), "poolClamp"),
    ["The claim on water runs is above the baseline in year 1 (160 against 148), so it is counted only up to the baseline."]);
  const vf = { ...a, ...stockers(5), vf: {} };
  const gather = { id: "gather", label: "Gathering hours cut", kind: "hours", pool: "gatherHours", claim: () => 300 };
  assert.deepEqual(texts(analyzeLines(vf, [...buildLines(vf), gather]), "baselineBlank"),
    ["Enter moving and gathering hours today to check the claim on moving and gathering hours."]);
});

test("row 9: combine() warnings name both modules, in full", () => {
  const mod = (module, runsPerWeek) => ({ settings: { T: 3, discountRate: 0.07 }, module, classes: { cows: { head: 100 } },
    served: { cows: {} }, water: { blocks: [{ runsPerWeek, weeks: 20 }] } });
  const build = (a) => [...buildLines(a), { id: "runs", label: "Runs avoided", kind: "cash", pool: "waterRuns", claim: () => 100, valuePerUnit: () => 5 }];
  const same = combine([mod("Module A", 5), mod("Module B", 5)], build);
  assert.deepEqual(same.warnings.map(noticeText),
    ["Module A and Module B claim the same water runs: together 200 against a baseline of 100 in year 1, so each claim is scaled down in proportion."]);
  const differ = combine([mod("Module A", 5), mod("Module B", 6)], build);
  assert.deepEqual(differ.warnings.map(noticeText), [
    "Module A and Module B report different baselines for water runs in year 1 (100 and 120); the largest, 120, is used.",
    "Module A and Module B claim the same water runs: together 200 against a baseline of 120 in year 1, so each claim is scaled down in proportion.",
  ]);
});

test("a notice whose text comes with a later item has none yet", () => {
  assert.equal(noticeText({ type: "quoteRequired", lineId: "software" }), null);
});

// ---------------------------------------------------------------- metrics, tiles and verdict (F8)

test("IRR and payback state texts (9.3; rows 1, 3, 4, 5, 17, 27)", () => {
  assert.equal(irrText(irr([0, 0, 0])), "n/a: no cash flows");
  assert.equal(paybackText(payback([0, 0, 0])), "n/a: no cash flows");
  assert.equal(irrText(irr([-1000, 100, 100, 100])), "below 0%");
  assert.equal(paybackText(payback([-1000, 100, 100, 100])), "none within 3 years");
  assert.equal(paybackText(payback([-100, 60, 60, -80, 60])), "4.00 years (cumulative was positive in year 2, then negative again before year 4)");
  assert.equal(irrText(irr([-100, 60, 60, -80, 60])), "n/a: cash flows change sign more than once");
  assert.equal(paybackText(payback([0, 10, 10])), "no net outlay: cumulative cash never negative");
  assert.equal(irrText(irr([0, 10, 10])), "n/a: no net outlay in year 0");
  assert.equal(paybackText(payback([100, -50, -80])), "none within 2 years (no net outlay in year 0; cumulative negative from year 2)");
  assert.equal(paybackText(payback([100, -150, 100, -100])),
    "none within 3 years (no net outlay in year 0; cumulative negative from year 1) (positive in year(s) 2, negative again by year 3)");
  assert.equal(irrText(irr([-1000, 20000])), "1,900.0%");
  assert.equal(irrText(irr([-1, 1000000])), "above 10,000%");
  assert.equal(paybackText(payback([-100, 100])), "1.00 years");
  assert.equal(paybackText(payback([-100, 50])), "none within 1 year");
  assert.equal(irrText(irr([-100, 100])), "0.0%");
});

test("row 19's texts: a subscription alone, billed either way, has no payback within 5 years and an IRR below 0%", () => {
  for (const billing of ["advance", "arrears"]) {
    const r = analyze({ settings: { T: 5, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
      costs: { subscription: { label: "Subscription", timing: "annual", basis: "fixed", unitCost: 1000, billing } } });
    assert.equal(paybackText(r.payback), "none within 5 years", billing);
    assert.equal(irrText(r.irr), "below 0%", billing);
  }
});

test("a late first cash flow: payback counted from year 0 with its note (row 48)", () => {
  const N = [0, 0, -1800, 780, 780, 780, 780, 780, 780, 780, 1140];
  assert.equal(paybackText(payback(N, 2)), "4.31 years (counted from year 0; the first cash flow is in year 2)");
  assert.equal(paybackText(payback(N.map((x, t) => x / 1.07 ** t), 2)), "4.61 years (counted from year 0; the first cash flow is in year 2)");
  assert.equal(irrText(irr(N, 2)), "41.1%");
});

// The hand-checked case (nets −1,000, 400, 400, 400 at 10%) with every input typed by the user ([D]), or not.
const handCheck = (prov = {}) => {
  const a = { settings: { T: 3, discountRate: 0.1 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} }, prov,
    costs: { hardware: { label: "Hardware", timing: "capital", basis: "fixed", unitCost: 1000, lifeYears: null },
      running: { label: "Running cost", timing: "annual", basis: "fixed", unitCost: 100, billing: "arrears" } } };
  const saving = { id: "saving", label: "Saving", kind: "cash", claim: () => 1, valuePerUnit: () => 500, paths: ["fixture.saving"] };
  return [a, analyzeLines(a, [...buildLines(a), saving])];
};
const typed = { cls: "D", src: "your entry" };

test("rounding follows the evidence: $100 when every material input is [A] or [D], else $1,000 (7.3)", () => {
  const [a, r] = handCheck();
  assert.equal(roundingUnit(a, r), 1000); // no provenance recorded: not first-hand
  const all = { "costs.hardware.unitCost": typed, "costs.running.unitCost": typed, "fixture.saving": typed };
  assert.equal(roundingUnit(...handCheck(all)), 100);
  assert.equal(roundingUnit(...handCheck({ ...all, "fixture.saving": { cls: "E", src: "example assumption" } })), 1000);
  assert.equal(aboutMoney(-11079, 1000), "about \u2212$11,000");
  assert.equal(aboutMoney(-11079, 100), "about \u2212$11,100");
  assert.equal(aboutMoney(120.5, 1000), "about break-even");
  assert.equal(aboutMoney(229531, 1000), "about $230,000");
});

test("the verdict sentence: amount, rate, before tax, state and the rise needed (9.5 item 1, 9.3)", () => {
  const [a, r] = handCheck();
  assert.equal(verdictSentence(a, r),
    "Over 3 years at your 10% real rate, before tax, this is within $500 of breaking even in cash. It does not pay. Cash benefits would need to rise by about 1%.");
  const example = { "settings.discountRate": { cls: "E", src: "Synthetic Ranch A" } };
  assert.match(verdictSentence(...handCheck(example)), /^Over 3 years at the example's 10% real rate \(an assumption, not a recommendation\), before tax, /);
  const v1 = { "settings.discountRate": { cls: "E", src: "version 1 link" } };
  assert.match(verdictSentence(...handCheck(v1)), /at your 10% real rate/);
  // A saving that pays: no rise sentence.
  const [b, pays] = handCheck();
  const rich = analyzeLines(b, [...buildLines(b), { id: "more", label: "More", kind: "cash", claim: () => 1, valuePerUnit: () => 5000 }]);
  assert.equal(verdictSentence(b, rich), `Over 3 years at your 10% real rate, before tax, this saves about $${(Math.round(rich.cashNPV / 1000) * 1000).toLocaleString("en-US")} more than it costs in cash. It pays.`);
  assert.ok(pays.cashNPV < 0);
  // f of 2 or more reads as a fold, to one decimal.
  const [c] = handCheck();
  const thin = analyzeLines(c, [...buildLines(c), { id: "small", label: "Small", kind: "cash", claim: () => 1, valuePerUnit: () => 100 }]);
  const f = (thin.pv.C - thin.pv.R) / thin.pv.B;
  assert.ok(f >= 2);
  assert.ok(verdictSentence(c, thin).endsWith(`It does not pay. Cash benefits would need to rise about ${f.toFixed(1)}-fold.`));
});

test("the verdict with a loss estimate, with no cash flows, and with one year (9.3, 9.5 item 1, row 1)", () => {
  const a = { settings: { T: 1, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    costs: { software: { label: "Software", timing: "annual", basis: "fixed", unitCost: 100, billing: "arrears" } } };
  const risk = { id: "risk:0", label: "Losses avoided (water)", kind: "risk", claim: () => 1, valuePerUnit: () => 1000 };
  const r = analyzeLines(a, [...buildLines(a), risk]);
  assert.equal(verdictSentence(a, r), "Over 1 year at your 7% real rate, before tax, this is within $500 of breaking even in cash. It pays only if the loss estimate holds.");
  const none = analyze({ settings: { T: 5, discountRate: 0.07 }, startYear: 0 });
  assert.equal(verdictSentence(none, none), "No cash flows for you in this analysis.");
  for (const t of tiles(none, none)) assert.ok(!/NaN|Infinity/.test(t.value), t.value);
});

test("the capacity-hours line, the verdict notes and the published-prices sentence (9.5 item 1)", () => {
  assert.equal(capacityLine({ hoursFreedPerYear: 84 }), "It also frees about 84 hours a year of your time (not cash).");
  assert.equal(capacityLine({ hoursFreedPerYear: -30.4 }), "It also takes about 30 more hours a year of your time (not cash).");
  assert.equal(capacityLine({ hoursFreedPerYear: 1 }), "It also frees about 1 hour a year of your time (not cash).");
  assert.equal(capacityLine({ hoursFreedPerYear: 0.4 }), null);
  const own = (settings, prov = {}) => verdictNotes({ settings: { T: 5, discountRate: 0.07, ...settings }, prov });
  assert.deepEqual(own({ ownAnalysis: false }), []);
  assert.deepEqual(own({ ownAnalysis: true, rateReviewed: false }), ["Discount rate not yet reviewed."]);
  const placeholder = { "costs.mounting.unitCost": { cls: "E", src: "synthetic placeholder", placeholder: true } };
  assert.deepEqual(own({ ownAnalysis: true, rateReviewed: true }, placeholder), ["Includes synthetic cost placeholders."]);
  assert.deepEqual(own({ ownAnalysis: true, rateReviewed: true }, { x: { ...placeholder["costs.mounting.unitCost"], confirmed: true } }), []);
  assert.equal(PUBLISHED_PRICES, "Published prices describe what the equipment costs. They do not support the projected savings, which come from your entries or the example's assumptions.");
});

test("the tiles: labels say before tax, values are rounded or stated as 9.5 item 2 says", () => {
  const [a, r] = handCheck();
  assert.deepEqual(tiles(a, r), [
    { label: "Cash NPV (before tax)", value: "about break-even" },
    { label: "Economic NPV (before tax)", value: "about break-even" },
    { label: "Cash payback (before tax)", value: "2.50 years" },
    { label: "BCR (before tax)", value: (r.bcr).toFixed(2) },
    { label: "Cost per head-month (before tax)", value: `$${r.costPerHeadMonth.toFixed(2)}` },
    { label: "Hours freed per year (before tax)", value: "0 hours" },
    { label: "IRR (before tax)", value: "9.7%" },
  ]);
  const risk = { id: "risk:0", label: "Losses avoided (water)", kind: "risk", claim: () => 1, valuePerUnit: () => 1000 };
  const withRisk = analyzeLines(a, [...buildLines(a), risk]);
  assert.equal(tiles(a, withRisk)[1].label, "Cash NPV including expected losses avoided (before tax)");
  const noCattle = analyze({ ...a, classes: {}, served: {} });
  assert.equal(tiles(a, noCattle).find((t) => t.label.startsWith("Cost per head-month")).value, "n/a");
});

test("the losses-avoided tile shows only when a risk line is entered (9.5 item 2)", () => {
  const water = (more) => ({ settings: { T: 3, discountRate: 0.07 }, startYear: 0, module: "water", classes: { cows: { head: 100, valuePerHead: 1500 } },
    served: { cows: {} }, water: { blocks: [] }, ...more });
  const has = (a) => tiles(a, analyze(a)).some((t) => t.label.startsWith("Cash NPV including expected losses avoided"));
  // The water module's losses from fewer physical checks are blank by default: no tile.
  assert.equal(has(water({})), false);
  assert.equal(tiles(water({}), analyze(water({}))).length, 7);
  // A risk line left blank counts 0 and is listed as not entered: no tile. Entered: the tile.
  const outage = { cause: "water", class: "cows", eventsPerYear: 0.15, headPerEvent: 5, shareCaught: 0.75 };
  assert.equal(has(water({ riskLines: [{ ...outage, eventsPerYear: null }] })), false);
  assert.equal(has(water({ riskLines: [outage] })), true);
  assert.equal(has(water({ water: { blocks: [], fewerChecksLoss: { headPerYear: 1, class: "cows" } } })), true);
});

test("a risk line with no cause is not entered and claims no pool (judgment)", () => {
  const r = analyze({ settings: { T: 2, discountRate: 0.07 }, module: "water", classes: { cows: { head: 100, valuePerHead: 1500 } }, served: { cows: {} },
    water: { blocks: [] }, riskLines: [{ class: "cows", eventsPerYear: 0.15, headPerEvent: 5, shareCaught: 1 }] });
  assert.ok(texts(r, "notEntered").includes("Losses avoided: not entered, not counted"));
  assert.deepEqual(Object.keys(r.pools), []);
  assert.deepEqual(r.X, [0, 0, 0]);
});

test("rounding counts the hours behind the capacity line (7.3, 9.3)", () => {
  // Hours freed valued at a typed owner rate rest on the hours saved: estimated hours make the result round to $1,000.
  const a = (cls) => ({ settings: { T: 3, discountRate: 0.07, oppCostPerHour: 20 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    labor: { otherHoursSaved: 500 }, prov: { "settings.oppCostPerHour": { cls: "D", src: "your entry" }, "labor.otherHoursSaved": { cls, src: "x" } } });
  assert.equal(analyze(a("D")).lines.find((l) => l.id === "hoursFreed").paths.includes("labor.otherHoursSaved"), true);
  assert.equal(roundingUnit(a("D"), analyze(a("D"))), 100);
  assert.equal(roundingUnit(a("E"), analyze(a("E"))), 1000);
});

// ---------------------------------------------------------------- F4, F7 and F6 texts

const herd = { classes: { cows: { head: 300 }, calvesBorn: { head: 285 }, calvesSold: { head: 240 } }, served: { cows: {}, calvesBorn: {} } };

test("F4: blank weight gain is listed; the value-of-gain warnings and help text (F4 1, 4, 5; row 13)", () => {
  const r = analyze({ settings: { T: 2, discountRate: 0.07 }, module: "eid", ...herd });
  assert.deepEqual(texts(r, "notEntered"), ["Weight gain: not entered, not counted"]);
  const cwt = analyze({ settings: { T: 2, discountRate: 0.07 }, module: "eid", ...herd,
    classes: { ...herd.classes, calvesSold: { head: 240, valueOfGain: 79 } }, production: { lbPerHeadPerDay: 0.2, days: 100, classes: ["calvesSold"] } });
  assert.deepEqual(texts(cwt, "valueOfGainRange"),
    ["Value of gain $79/lb is outside the usual range of $0.10 to $5/lb. Check that it is entered in $/lb, not $/cwt (100 lb)."]);
  const { warnings } = valueOfGainFromQuotes({ weight: 526, pricePerCwt: 400 }, { weight: 573, pricePerCwt: 450 });
  assert.deepEqual(warnings.map(noticeText), ["Value of gain is normally below the sale price per pound."]);
  assert.deepEqual(valueOfGainFromQuotes({ weight: 573, pricePerCwt: 400 }, { weight: 526, pricePerCwt: 450 }).warnings.map(noticeText),
    ["Value of gain: the heavier quote's weight must be above the base quote's weight."]);
  assert.match(HELP.valueOfGain, /not the sale price per pound/);
});

test("F7: blank risk lines are listed by label; row 12's warning in full", () => {
  const r = analyze({ settings: { T: 2, discountRate: 0.07 }, module: "water", classes: { cows: { head: 100, valuePerHead: 1500 } }, served: { cows: {} },
    riskLines: [{ cause: "water", class: "cows", headPerEvent: 5, shareCaught: 1 }], water: { blocks: [] } });
  assert.deepEqual(texts(r, "notEntered"), ["Losses avoided (water): not entered, not counted", "Losses from fewer physical checks: not entered, not counted"]);
  const mod = (module) => ({ settings: { T: 3, discountRate: 0.07 }, module, classes: { cows: { head: 100, valuePerHead: 1000 } }, served: { cows: {} },
    riskLines: [{ cause: "water", class: "cows", eventsPerYear: 0.15, headPerEvent: 5, shareCaught: 1 }] });
  assert.deepEqual(combine([mod("Module A"), mod("Module B")]).warnings.map(noticeText),
    ["Module A and Module B claim the same death loss (water): together 1.50 against a baseline of 0.75 in year 1, so each claim is scaled down in proportion."]);
});

test("F6: the lease-end and water-care notices (9.5 item 11; rows 35(b), 47(a) and (b))", () => {
  const water = (landUnits) => analyze({ settings: { T: 10, discountRate: 0.07, landUnits }, module: "water", classes: { cows: { head: 100 } },
    served: { cows: {} }, water: { blocks: [] } });
  assert.deepEqual(texts(water([{ id: "u1", kind: "owned", share: 0.6 }, { id: "u2", kind: "leased", leaseYears: 3, share: 0.4 }]), "leaseEnds"),
    ["The lease on land unit 2 ends in year 3, inside the 10-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at the lease end and are credited any reimbursement."]);
  assert.deepEqual(texts(water([{ id: "u1", kind: "leased", leaseYears: 15, share: 1, waterBy: "landlord", careInLeaseRate: true }]), "waterCare"),
    ["On land unit 1, the landlord provides and checks the water, so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'."]);
  assert.deepEqual(texts(water([{ id: "u1", kind: "leased", leaseYears: 15, share: 1, careInLeaseRate: true }]), "waterCare"),
    ["On land unit 1, water care is included in the lease rate, so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'."]);
  // A lease that ends exactly at T is not "inside" the horizon: no notice.
  assert.deepEqual(texts(water([{ id: "u1", kind: "leased", leaseYears: 10, share: 1 }]), "leaseEnds"), []);
});
