// Tests of the page text (text.js), built from analyze() and combine() output: docs/audit/phase1-spec.md 9.5 items 9
// and 11, and the texts that 10.1 rows 6, 9 and 32 and the F1, F3 and F9 acceptance criteria assert in full.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, analyzeLines, buildLines, combine } from "../roi.js";
import { money, quantity, count, joinAnd, poolName, moduleName, className, noticeText } from "../text.js";

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
