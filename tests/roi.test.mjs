// Tests of the phase-1 engine (roi.js), against docs/audit/phase1-spec.md: 9.3 formulas, 9.7 tests, 10.1 rows.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  YEARS_MESSAGE, at, npv, analyze, analyzeLines, buildLines, scheduleCapital, billAnnual, billingOf, addedHours, validate,
  herdOf, poolBaseline, combine,
} from "../roi.js";

const close = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const closeAll = (xs, ys, tol = 1e-9) => {
  assert.equal(xs.length, ys.length, `${xs} vs ${ys}`);
  xs.forEach((x, i) => close(x, ys[i], tol));
};
// A served herd in every year, so that the cattle-presence rule (F3) does not zero the benefits (9.7, "Cattle in
// engine tests"). Tests of the rule itself replace it.
const herd = { classes: { cows: { head: 100 } }, served: { cows: {} } };
const analysis = (T, discountRate, more = {}) => ({ settings: { T, discountRate }, startYear: 0, ...herd, ...more });
const device = (more = {}) => ({ id: "devices", label: "Devices", timing: "capital", basis: "perDevice", unitCost: 1000, qty: 1, ...more });
const yearsBought = (line, T, s = 0) => scheduleCapital(line, T, s).purchases.map((p) => p.year);
// A benefit fixture with no cattle to depend on (9.7, "Cattle in engine tests").
const cashBenefit = (dollars) => ({ id: "savings", label: "Savings", kind: "cash", requiresCattle: false, claim: () => 1, valuePerUnit: () => dollars });
const errorsAt = (a, path) => validate(a).filter((e) => e.path === path);
const zerosOf = (T) => Array(T + 1).fill(0);

// ---------------------------------------------------------------- hand check (9.1 step 2, 9.7 Hand checks)

test("today's hand-checked case rebuilt as line items gives the same NPV, IRR and payback", () => {
  const a = analysis(3, 0.1, {
    costs: {
      hardware: { label: "Hardware", timing: "capital", basis: "fixed", unitCost: 1000, lifeYears: null },
      running: { label: "Running cost", timing: "annual", basis: "fixed", unitCost: 100, billing: "arrears" },
    },
  });
  const r = analyzeLines(a, [...buildLines(a), cashBenefit(500)]);
  assert.deepEqual(r.N, [-1000, 400, 400, 400]);
  close(r.cashNPV, -1000 + 400 / 1.1 + 400 / 1.21 + 400 / 1.331, 1e-9);
  assert.equal(Math.round(r.cashNPV * 100) / 100, -5.26);
  close(npv(r.irr, r.N), 0, 1e-6);
  assert.equal(Math.round(r.irr * 10000) / 100, 9.7);
  close(r.payback, 2.5, 1e-12); // −200 left after year 2, +400 in year 3
});

// ---------------------------------------------------------------- capital scheduler (F5, 9.3)

test("capital scheduler: rebuys at s + n·L before T, none in year T, straight-line residual (F5 2–6; rows 7, 21)", () => {
  // L = 4, T = 10: purchases in years 0, 4 and 8; residual at year 10 = 50% of the year-8 purchase (row 7, F5 2).
  let r = scheduleCapital(device({ lifeYears: 4 }), 10, 0);
  assert.deepEqual(r.purchases.map((p) => p.year), [0, 4, 8]);
  assert.equal(r.residual[10], 500);
  assert.deepEqual(r.residual.slice(0, 10), Array(10).fill(0));
  // (a) L = 10, T = 7: one purchase; residual 30% of cost (F5 6).
  r = scheduleCapital(device({ lifeYears: 10 }), 7, 0);
  assert.deepEqual(r.purchases.map((p) => p.year), [0]);
  close(r.residual[7], 300, 1e-9);
  // (b) startYear 2, L = 4, T = 10: purchases in years 2 and 6; residual 0 (F5 5).
  r = scheduleCapital(device({ lifeYears: 4 }), 10, 2);
  assert.deepEqual(r.purchases.map((p) => p.year), [2, 6]);
  assert.equal(r.residual[10], 0);
  // (c) L = 4, T = 8: purchases in years 0 and 4, none in year 8; residual 0 (F5 3).
  r = scheduleCapital(device({ lifeYears: 4 }), 8, 0);
  assert.deepEqual(r.purchases.map((p) => p.year), [0, 4]);
  assert.equal(r.cost[8], 0);
  assert.equal(r.residual[8], 0);
  // (d) L = 5, T = 10: purchases in years 0 and 5 only (F5 4).
  assert.deepEqual(yearsBought(device({ lifeYears: 5 }), 10), [0, 5]);
});

test("capital line with lifeYears null: one purchase, repairs every later year, residual only from pctOfCost or amount", () => {
  const line = device({ lifeYears: null, repairPct: 0.05 });
  let r = scheduleCapital(line, 6, 0);
  assert.deepEqual(r.purchases, [{ year: 0, qty: 1, unitCost: 1000 }]);
  closeAll(r.cost, [1000, 50, 50, 50, 50, 50, 50]);
  assert.equal(r.residual[6], 0); // default mode "none"
  assert.equal(scheduleCapital({ ...line, residual: { mode: "straightLine" } }, 6, 0).residual[6], 0);
  assert.equal(scheduleCapital({ ...line, residual: { mode: "pctOfCost", pct: 0.2 } }, 6, 0).residual[6], 200);
  assert.equal(scheduleCapital({ ...line, residual: { mode: "amount", dollars: 150 } }, 6, 0).residual[6], 150);
});

test("residual modes on a line with a life: straightLine, none, pctOfCost of each cohort's last purchase, amount for the line", () => {
  const line = device({ qty: [10, 10, 15], unitCost: 100, lifeYears: 4 }); // cohorts: 10 from year 0, 5 from year 2
  const T = 8;
  assert.equal(scheduleCapital(line, T, 0).residual[T], 250); // last purchases 4 (0%) and 6 (50% of 5 × $100)
  assert.equal(scheduleCapital({ ...line, residual: { mode: "none" } }, T, 0).residual[T], 0);
  assert.equal(scheduleCapital({ ...line, residual: { mode: "pctOfCost", pct: 0.1 } }, T, 0).residual[T], 150); // 10% of 1,000 + 500
  assert.equal(scheduleCapital({ ...line, residual: { mode: "amount", dollars: 400 } }, T, 0).residual[T], 400);
});

test("a rise in quantity is a new cohort with its own rebuys and residual (cohort added in year 2)", () => {
  const r = scheduleCapital(device({ qty: [10, 10, 15], unitCost: 100, lifeYears: 4 }), 8, 0);
  assert.deepEqual(r.purchases, [
    { year: 0, qty: 10, unitCost: 100 }, { year: 2, qty: 5, unitCost: 100 },
    { year: 4, qty: 10, unitCost: 100 }, { year: 6, qty: 5, unitCost: 100 },
  ]);
  assert.deepEqual(r.cost, [1000, 0, 500, 0, 1000, 0, 500, 0, 0]);
  assert.equal(r.lastCost, 1500);
});

test("a dip and recovery buys nothing new, but a perAnimal line buys again (9.3, 9.7)", () => {
  // perDevice 1,200, 0, 1,200 (carried forward), L = 5, T = 7: idle devices serve again, so 1,200 in years 0 and 5 only.
  const r = scheduleCapital(device({ qty: [1200, 0, 1200], lifeYears: 5 }), 7, 0);
  assert.deepEqual(r.purchases.map((p) => [p.year, p.qty]), [[0, 1200], [5, 1200]]);
  // perAnimal with the same counts and lifeYears null: tags leave with the cattle, so 1,200 in years 0 and 2.
  const tags = scheduleCapital(device({ qty: [1200, 0, 1200], lifeYears: null, perAnimal: true }), 7, 0);
  assert.deepEqual(tags.purchases.map((p) => [p.year, p.qty]), [[0, 1200], [2, 1200]]);
});

test("repairs fall in each purchase's service years, at that purchase's price", () => {
  // Bought in year 0 at $100 and again in year 4 at $120 (unitCost by purchase year), L = 4, T = 6, repairs 10%.
  const r = scheduleCapital(device({ unitCost: [100, 100, 100, 100, 120], lifeYears: 4, repairPct: 0.1 }), 6, 0);
  closeAll(r.cost, [100, 10, 10, 10, 10 + 120, 12, 12]);
  close(r.residual[6], 60, 1e-9); // (4 + 4 − 6) ÷ 4 = 50% of the $120 purchase
});

test("residual is its own series, counted in BCR and payback", () => {
  const a = analysis(5, 0.07, { costs: { devices: device({ basis: "fixed", lifeYears: 10 }) } });
  const r = analyzeLines(a, [...buildLines(a), cashBenefit(150)]);
  assert.deepEqual(r.R, [0, 0, 0, 0, 0, 500]); // half the life left at year 5
  assert.deepEqual(r.B, [0, 150, 150, 150, 150, 150]);
  assert.deepEqual(r.N, [-1000, 150, 150, 150, 150, 650]);
  close(r.bcr, (r.pv.B + r.pv.R) / r.pv.C, 1e-12);
  close(r.pv.R, 500 / 1.07 ** 5, 1e-9);
  close(r.payback, 4 + 400 / 650, 1e-12); // without the residual it would never pay back
  close(r.cashNPV, r.pv.B + r.pv.R - r.pv.C, 1e-9);
});

// ---------------------------------------------------------------- annual lines and billing (F5, 9.3)

test("advance billing falls in years s..T−1 and arrears in s+1..T; advance multiplies PV by exactly 1 + r (row 19, F5 7)", () => {
  const sub = (billing) => analysis(5, 0.07, { costs: { subscription: { label: "Subscription", timing: "annual", basis: "fixed", unitCost: 1000, billing } } });
  const adv = analyze(sub("advance")), arr = analyze(sub("arrears"));
  assert.deepEqual(adv.C, [1000, 1000, 1000, 1000, 1000, 0]);
  assert.deepEqual(arr.C, [0, 1000, 1000, 1000, 1000, 1000]);
  assert.equal(Math.round(adv.cashNPV * 100) / 100, -4387.21);
  assert.equal(Math.round(arr.cashNPV * 100) / 100, -4100.2);
  close(adv.pv.C / arr.pv.C, 1.07, 1e-12);
});

test("billing defaults: subscriptions and service fees in advance, other annual lines in arrears (9.2)", () => {
  assert.equal(billingOf({ id: "subscription" }), "advance");
  assert.equal(billingOf({ id: "serviceFee" }), "advance");
  assert.equal(billingOf({ id: "batteries" }), "arrears");
  assert.equal(billingOf({ id: "batteries", billing: "advance" }), "advance");
  // A blank entry, as the page sends a cleared field, takes the default too.
  assert.equal(billingOf({ id: "subscription", billing: "" }), "advance");
  assert.equal(billingOf({ id: "batteries", billing: null }), "arrears");
});

test("purchase vs subscription: two analyses of the same 10 water points (row 10)", () => {
  const T = 10, r = 0.07;
  const buy = analyze(analysis(T, r, {
    costs: {
      monitors: { label: "Monitors", timing: "capital", basis: "perDevice", qty: 10, unitCost: 1490, lifeYears: 10, residual: { mode: "straightLine" } },
      serviceFee: { label: "Service fee", timing: "annual", basis: "perDevice", qty: 10, unitCost: 365, billing: "advance" },
    },
  }));
  close(buy.pv.C, 42330.6, 0.005); // 14,900 + 3,650 × 7.515232, the 10-year annuity-due factor at 7%
  assert.equal(buy.R[T], 0);
  const lease = (X) => analyze(analysis(T, r, {
    costs: { lease: { label: "Lease", timing: "annual", basis: "perDevice", qty: 10, unitCost: X, billing: "advance" } },
  }));
  assert.deepEqual(lease(1).C.map((c, t) => (c ? t : -1)).filter((t) => t >= 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(Math.abs(lease(563.26).pv.C - buy.pv.C) < 1);
  close(lease(600).pv.C, 45091.39, 0.005);
  assert.ok(lease(600).pv.C > buy.pv.C);
});

test("an annual line's price is taken for the season the bill pays for", () => {
  // Batteries by season (Synthetic Ranch A's pattern): $20 a monitor in seasons 4 and 8.
  const unitCost = [0, 0, 0, 0, 20, 0, 0, 0, 20, 0, 0];
  const bat = (billing) => billAnnual({ id: "batteries", basis: "perDevice", qty: 10, unitCost, billing }, 10, 0).cost;
  assert.deepEqual(bat("arrears"), [0, 0, 0, 0, 200, 0, 0, 0, 200, 0, 0]);
  assert.deepEqual(bat("advance"), [0, 0, 0, 200, 0, 0, 0, 200, 0, 0, 0]);
});

test("a line that starts later bills from its own start year", () => {
  const line = { id: "fee", basis: "fixed", unitCost: 100 };
  assert.deepEqual(billAnnual({ ...line, billing: "advance" }, 6, 2).cost, [0, 0, 100, 100, 100, 100, 0]);
  assert.deepEqual(billAnnual({ ...line, billing: "arrears" }, 6, 2).cost, [0, 0, 0, 100, 100, 100, 100]);
  const a = analysis(6, 0.07, { costs: { fee: { ...line, label: "Fee", timing: "annual", billing: "arrears", startYear: 2 } } });
  assert.deepEqual(analyze(a).C, [0, 0, 0, 100, 100, 100, 100]);
});

test("a committed minimum is billed when the quantity falls below it, inside the commitment only (F5 8)", () => {
  // perDevice 100 devices, then 40; minimum 80 devices for 3 seasons; $10 per device, billed in advance; T = 5.
  const line = { id: "subscription", basis: "perDevice", qty: [100, 100, 40], unitCost: 10, minQty: 80, commitYears: 3, earlyTerminationFee: 10000 };
  const r = billAnnual(line, 5, 0);
  // Seasons 1..5 bill 100, 80 (minimum), 80 (minimum), 40, 40; advance puts season t in year t − 1.
  assert.deepEqual(r.cost, [1000, 800, 800, 400, 400, 0]);
  assert.equal(r.commitPastHorizon, false);
});

test("a commitment that runs past T charges its early-termination fee in year T, with a notice", () => {
  const line = { label: "Subscription", timing: "annual", basis: "perDevice", qty: 40, unitCost: 10, minQty: 80, commitYears: 6, earlyTerminationFee: 10000 };
  const r = analyze(analysis(5, 0.07, { costs: { subscription: line } }));
  assert.deepEqual(r.C, [800, 800, 800, 800, 800, 10000]); // the minimum in every season, and the fee in year 5
  assert.deepEqual(r.notices.filter((n) => n.type === "commitPastHorizon"),
    [{ type: "commitPastHorizon", lineId: "subscription", label: "Subscription", horizon: 5, commitYears: 6, fee: 10000 }]);
  const within = analyze(analysis(6, 0.07, { costs: { subscription: line } }));
  assert.deepEqual(within.C, [800, 800, 800, 800, 800, 800, 0]); // billed in advance, so no bill in year 6
  assert.ok(!within.notices.some((n) => n.type === "commitPastHorizon"));
});

test("a blank price is not counted and is listed as Quote required (9.2)", () => {
  const r = analyze(analysis(5, 0.07, {
    costs: { software: { label: "Software", timing: "annual", basis: "fixed", unitCost: null, billing: "advance" } },
  }));
  assert.deepEqual(r.C, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(r.notices, [{ type: "quoteRequired", lineId: "software" }]);
});

test("a blank price inside a price list is listed where it is used; a line with no quantity is not listed (9.2, 9.5 item 7)", () => {
  const quotes = (costs, T = 5) => analyze(analysis(T, 0.07, { costs })).notices.filter((n) => n.type === "quoteRequired");
  const batteries = { label: "Batteries", timing: "annual", basis: "perDevice", qty: 10, billing: "arrears" };
  // Seasons 1..5 read entries 1..4 (the last carried forward); the blank in season 2 is used, so it is listed.
  const r = analyze(analysis(5, 0.07, { costs: { batteries: { ...batteries, unitCost: [0, 50, null, 50] } } }));
  assert.deepEqual(r.C, [0, 500, 0, 500, 500, 500]);
  assert.deepEqual(r.notices, [{ type: "quoteRequired", lineId: "batteries" }]);
  // Entry 0 is no season's price on a line that starts in year 0, so a blank there is not used.
  assert.deepEqual(quotes({ batteries: { ...batteries, unitCost: [null, 50] } }), []);
  // A capital price list is read by purchase year: the rebuy in year 2 is priced blank.
  assert.deepEqual(quotes({ devices: device({ lifeYears: 2, unitCost: [1000, 1000, null] }) }), [{ type: "quoteRequired", lineId: "devices" }]);
  assert.deepEqual(quotes({ devices: device({ lifeYears: 2, unitCost: [null] }) }), [{ type: "quoteRequired", lineId: "devices" }]);
  // A blank price on a line whose quantity is 0 in every year changes nothing, so it is not listed.
  assert.deepEqual(quotes({ collarLoss: { ...batteries, qty: 0, unitCost: null }, spare: device({ qty: 0, unitCost: null }) }), []);
  // A committed minimum is billed even at quantity 0, so its blank price is listed.
  assert.deepEqual(quotes({ subscription: { ...batteries, qty: 0, minQty: 5, commitYears: 2, unitCost: null } }),
    [{ type: "quoteRequired", lineId: "subscription" }]);
});

test("a blank start year on a cost line is the module's start year, in analyze() as in validate() (9.2, 9.3 Timing)", () => {
  const line = { label: "Monitors", timing: "capital", basis: "fixed", unitCost: 1000, lifeYears: 3 };
  const at1 = { ...analysis(5, 0.07), startYear: 1 };
  const expected = analyze({ ...at1, costs: { monitors: line } });
  assert.deepEqual(expected.C, [0, 1000, 0, 0, 1000, 0]);
  for (const startYear of ["", null, undefined]) {
    const a = { ...at1, costs: { monitors: { ...line, startYear } } };
    assert.deepEqual(validate(a), []);
    const r = analyze(a);
    assert.deepEqual(r.C, expected.C, `startYear ${JSON.stringify(startYear)}`);
    assert.deepEqual(r.R, expected.R);
  }
  const billed = { label: "Software", timing: "annual", basis: "fixed", unitCost: 100, billing: "arrears", startYear: "" };
  assert.deepEqual(analyze({ ...at1, costs: { software: billed } }).C, [0, 0, 100, 100, 100, 100]);
});

test("per-year values carry their last entry forward (9.2)", () => {
  assert.equal(at(5, 3), 5);
  assert.equal(at([1, 2], 0), 1);
  assert.equal(at([1, 2], 7), 2);
  assert.equal(at([], 2), undefined);
});

// ---------------------------------------------------------------- labor (F1, 9.3 Labor)

const LOADED = 18.72 * 1.1;
const ranchLabor = (more = {}) => ({
  freedTimeUse: "replacesPaidWork",
  cut: { laborUnit: "day", unitsCut: 16, hoursPerUnit: 8, paidRate: 18.72, loadPct: 0.1 },
  otherHoursSaved: 264,
  ...more,
});

test("cash labor saved is the paid units cut × hours × pay × (1 + load); the rest of the hours saved is capacity", () => {
  const a = analysis(10, 0.07, { settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 }, labor: ranchLabor() });
  const r = analyze(a);
  const cut = r.lines.find((l) => l.id === "laborCut");
  assert.equal(cut.label, "Hired labor cut");
  close(cut.series[1], 16 * 8 * LOADED, 1e-9); // $2,635.78 a year
  assert.equal(cut.series[0], 0);
  assert.deepEqual(r.hours.paidCut, [0, ...Array(10).fill(128)]);
  assert.deepEqual(r.hours.freed, [0, ...Array(10).fill(264 - 128)]);
  assert.deepEqual(r.K, [0, ...Array(10).fill(136 * 20)]);
  closeAll(r.B, [0, ...Array(10).fill(16 * 8 * LOADED)]);
});

test("with no units cut, changing the hours saved leaves cash NPV unchanged to the cent (F1 1)", () => {
  const run = (hours) => analyze(analysis(10, 0.07, {
    settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 },
    costs: { monitors: device({ qty: 10, unitCost: 1490, lifeYears: 10 }) },
    labor: ranchLabor({ cut: { ...ranchLabor().cut, unitsCut: 0 }, otherHoursSaved: hours }),
  }));
  const low = run(100), high = run(500);
  assert.equal(Math.round(low.cashNPV * 100), Math.round(high.cashNPV * 100));
  assert.deepEqual(low.N, high.N);
  assert.ok(high.pv.K > low.pv.K); // the hours show up as capacity only
});

test("100 added hours done by a paid hand lower cash NPV by exactly PV(100 × rate × (1 + load)); capacity unchanged (F1 3, row 18)", () => {
  const base = { settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 }, startYear: 0, ...herd, labor: { otherHoursSaved: 50 } };
  const without = analyze(base);
  const withPaid = analyze({ ...base, labor: { otherHoursSaved: 50, added: [{ label: "Checking", hours: 100, doneBy: "paid", paidRate: 18.72, loadPct: 0.1 }] } });
  const line = withPaid.lines.find((l) => l.id === "added:0");
  assert.equal(line.label, "Checking");
  closeAll(line.series, [0, ...Array(10).fill(2059.2)]);
  close(without.cashNPV - withPaid.cashNPV, 14462.96, 0.005);
  close(without.cashNPV - withPaid.cashNPV, npv(0.07, [0, ...Array(10).fill(100 * 18.72 * 1.1)]), 1e-9);
  assert.deepEqual(withPaid.K, without.K);
  assert.deepEqual(withPaid.hours.paidAdded, [0, ...Array(10).fill(100)]);
});

test("paid hours cut above the hours saved is a validation error naming the hired labor cut (F1 4)", () => {
  const a = (days, more = {}) => analysis(10, 0.07, { labor: ranchLabor({ cut: { ...ranchLabor().cut, unitsCut: days } }), ...more });
  assert.deepEqual(validate(a(33)), []); // 264 h against 264 h
  const errors = validate(a(34)); // 272 h against 264 h
  assert.equal(errors.length, 1);
  assert.equal(errors[0].path, "labor.cut.unitsCut");
  assert.equal(errors[0].label, "Hired labor cut");
  assert.match(errors[0].message, /^Hired labor cut: .*272 h.*264 h/);
  // The input takes its module's driver label (9.4 intro).
  assert.equal(validate(a(34, { module: "vf" }))[0].label, "Hired moving and gathering hours cut");
  // An array of units is checked year by year.
  assert.match(validate(a([33, 33, 33, 34]))[0].message, /in year 3 /);
});

test("answering 'absorbed' sets cash labor saved to 0 and is not checked against the hours saved (F1 5, 9.2)", () => {
  const replaces = analysis(10, 0.07, { settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 }, labor: ranchLabor() });
  const absorbed = { ...replaces, labor: { ...replaces.labor, freedTimeUse: "absorbed" } };
  const unanswered = { ...replaces, labor: { ...replaces.labor, freedTimeUse: undefined } };
  for (const a of [absorbed, unanswered]) {
    const r = analyze(a);
    assert.deepEqual(r.lines.find((l) => l.id === "laborCut").series, Array(11).fill(0));
    assert.deepEqual(r.hours.paidCut, Array(11).fill(0));
    assert.deepEqual(r.hours.freed, [0, ...Array(10).fill(264)]); // every hour saved is capacity
    assert.ok(r.notices.some((n) => n.type === "absorbed"));
    // A typed unitsCut is kept for when the answer changes, and not checked against the hours saved.
    const big = { ...a, labor: { ...a.labor, cut: { ...a.labor.cut, unitsCut: 40 } } };
    assert.deepEqual(validate(big), []);
  }
  assert.ok(!analyze(replaces).notices.some((n) => n.type === "absorbed"));
  assert.ok(analyze(replaces).cashNPV > analyze(absorbed).cashNPV);
});

test("a position cut counts its salary; the engine takes fractional units from sensitivity runs", () => {
  const a = analysis(5, 0.07, {
    labor: { freedTimeUse: "replacesPaidWork", otherHoursSaved: 2080,
      cut: { laborUnit: "position", unitsCut: 1, hoursPerUnit: 2080, salary: 40000, loadPct: 0.2 } },
  });
  assert.deepEqual(validate(a), []);
  const r = analyze(a);
  assert.deepEqual(r.B, [0, 48000, 48000, 48000, 48000, 48000]);
  assert.deepEqual(r.hours.freed, Array(6).fill(0));
  // 12.8 days cut in a tornado run is computed, not rejected (9.2).
  const days = analyze(analysis(5, 0.07, { labor: ranchLabor({ cut: { ...ranchLabor().cut, unitsCut: 12.8 } }) }));
  close(days.B[1], 12.8 * 8 * LOADED, 1e-9);
});

test("an hour cut is worth its hours at the loaded rate, with 1 hour per unit", () => {
  const r = analyze(analysis(3, 0.07, {
    labor: { freedTimeUse: "replacesPaidWork", otherHoursSaved: 300, cut: { laborUnit: "hour", unitsCut: 200, paidRate: 25, loadPct: 0 } },
  }));
  assert.deepEqual(r.B, [0, 5000, 5000, 5000]);
  assert.deepEqual(r.hours.freed, [0, 100, 100, 100]);
});

test("an avoided hire counts salary × (1 + load) in its own years, ending at T", () => {
  const a = analysis(5, 0.07, { labor: { avoidedHire: { salary: 30000, loadPct: 0.1, startYear: 2, years: 3 } } });
  assert.deepEqual(validate(a), []);
  const hire = analyze(a).lines.find((l) => l.id === "avoidedHire");
  assert.equal(hire.label, "Avoided hire");
  closeAll(hire.series, [0, 0, 33000, 33000, 33000, 0]);
  const late = analysis(5, 0.07, { labor: { avoidedHire: { salary: 30000, loadPct: 0.1, startYear: 4, years: 5 } } });
  closeAll(analyze(late).lines.find((l) => l.id === "avoidedHire").series, [0, 0, 0, 0, 33000, 33000]);
});

test("added hours: an array entry s falls in year s, a single number recurs in years s+1..T (9.3 Timing)", () => {
  const settings = { T: 10, discountRate: 0.07, oppCostPerHour: 20 };
  // Synthetic Ranch A's install: [30, 0] is 30 h in year 0 only; [30] would carry 30 h into every year.
  const install = analyze({ settings, ...herd, startYear: 0, labor: { added: [{ label: "install", hours: [30, 0], doneBy: "unpaid" }] } });
  assert.deepEqual(install.hours.unpaidAdded, [30, ...Array(10).fill(0)]);
  assert.deepEqual(install.K, [-600, ...Array(10).fill(0)]);
  assert.deepEqual(addedHours([30], 7, 0, 10), 30);
  // 52 h a year of monitoring, unpaid: years 1..10, lowering hours freed.
  const weekly = analyze({ settings, ...herd, startYear: 0, labor: { otherHoursSaved: 100, added: [{ label: "monitoring", hours: 52, doneBy: "unpaid" }] } });
  assert.deepEqual(weekly.hours.freed, [0, ...Array(10).fill(48)]);
  assert.deepEqual(weekly.K, [0, ...Array(10).fill(960)]);
  // With the module starting in year 2, install in entry 2 falls in year 2 (K_2), and benefits start in year 3.
  const late = { settings, ...herd, startYear: 2, labor: { otherHoursSaved: 100, added: [{ label: "install", hours: [0, 0, 30, 0], doneBy: "unpaid" }] } };
  assert.deepEqual(validate(late), []);
  const r = analyze(late);
  assert.deepEqual(r.hours.freed, [0, 0, -30, ...Array(8).fill(100)]);
  assert.deepEqual(r.K, [0, 0, -600, ...Array(8).fill(2000)]);
  // Paid setup hours are a cost in the year they are worked.
  const paid = analyze({ settings, ...herd, startYear: 0, labor: { added: [{ label: "install", hours: [30, 0], doneBy: "paid", paidRate: 20, loadPct: 0 }] } });
  assert.deepEqual(paid.C, [600, ...Array(10).fill(0)]);
  assert.deepEqual(paid.K, Array(11).fill(0));
});

test("capacity is hours freed × the owner time rate, and 0 without a rate (economic view only)", () => {
  const a = { settings: { T: 3, discountRate: 0.07 }, startYear: 0, ...herd, labor: { otherHoursSaved: 100 } };
  const r = analyze(a);
  assert.deepEqual(r.hours.freed, [0, 100, 100, 100]);
  assert.deepEqual(r.K, [0, 0, 0, 0]);
  assert.equal(r.cashNPV, 0);
  assert.deepEqual(analyze({ ...a, settings: { ...a.settings, oppCostPerHour: 20 } }).K, [0, 2000, 2000, 2000]);
});

// ---------------------------------------------------------------- validation (9.2)

test("a horizon that is not a whole number of years is an error, and nothing else is checked against it (row 28, typed)", () => {
  for (const T of [2.5, 0, -1, NaN, null, "5"]) {
    assert.deepEqual(validate({ settings: { T, discountRate: 0.07 } }), [{ path: "settings.T", label: "Horizon", message: YEARS_MESSAGE }], String(T));
  }
  assert.equal(YEARS_MESSAGE, "Enter a whole number of years, 1 or more.");
  assert.deepEqual(validate({ settings: { T: 1, discountRate: 0.07 } }), []);
});

test("cost-line rules: life, start years, commitment years and residuals (9.2)", () => {
  const a = (line, more = {}) => analysis(10, 0.07, { costs: { devices: line }, ...more });
  // An entered life must be a whole number of years, 1 or more; blank is one purchase.
  assert.deepEqual(errorsAt(a(device({ lifeYears: 2.5 })), "costs.devices.lifeYears"),
    [{ path: "costs.devices.lifeYears", label: "Life", message: YEARS_MESSAGE }]);
  assert.equal(errorsAt(a(device({ lifeYears: 0 })), "costs.devices.lifeYears").length, 1);
  assert.deepEqual(validate(a(device({ lifeYears: null }))), []);
  assert.deepEqual(validate(a(device({ lifeYears: 4 }))), []);
  // Start years are whole numbers before T, for a line and for the module.
  assert.match(errorsAt(a(device({ startYear: 1.5 })), "costs.devices.startYear")[0].message, /^Start year \(Devices\): /);
  assert.match(errorsAt(a(device({ startYear: 10 })), "costs.devices.startYear")[0].message, /before year 10/);
  assert.deepEqual(validate(a(device({ startYear: 9 }))), []);
  assert.equal(errorsAt(a(device(), { startYear: 10 }), "startYear")[0].label, "The year the module starts");
  assert.equal(errorsAt(a(device(), { startYear: 0.5 }), "startYear").length, 1);
  // Commitment years are whole numbers.
  const sub = { label: "Subscription", timing: "annual", basis: "fixed", unitCost: 100 };
  assert.match(errorsAt(a({ ...sub, commitYears: 1.5 }), "costs.devices.commitYears")[0].message, /^Commit years \(Subscription\): /);
  assert.deepEqual(validate(a({ ...sub, commitYears: 3 })), []);
  // A residual cannot exceed the cost of the purchases it values.
  assert.equal(errorsAt(a(device({ lifeYears: 4, residual: { mode: "pctOfCost", pct: 1.2 } })), "costs.devices.residual").length, 1);
  assert.deepEqual(validate(a(device({ lifeYears: 4, residual: { mode: "pctOfCost", pct: 1 } }))), []);
  // amount: dollars for the whole line, against Σ unitCost × qty over each cohort's last purchase (here $1,000 + $500).
  const cohorts = device({ qty: [10, 10, 15], unitCost: 100, lifeYears: 4, residual: { mode: "amount", dollars: 1500 } });
  assert.deepEqual(validate(analysis(8, 0.07, { costs: { devices: cohorts } })), []);
  const over = validate(analysis(8, 0.07, { costs: { devices: { ...cohorts, residual: { mode: "amount", dollars: 1500.01 } } } }));
  assert.equal(over[0].label, "Residual");
  assert.match(over[0].message, /\$1,500\.01 is more than the \$1,500/);
});

test("labor rules: whole units, the fields a paid cut needs, and 'Hours per unit' for a position (9.2, 9.7)", () => {
  const a = (cut, freedTimeUse = "replacesPaidWork") => analysis(5, 0.07, { labor: { freedTimeUse, otherHoursSaved: 3000, cut } });
  const day = { laborUnit: "day", unitsCut: 2, hoursPerUnit: 8, paidRate: 18.72, loadPct: 0.1 };
  assert.deepEqual(validate(a(day)), []);
  // Days, weeks and positions are whole numbers, whatever the answer to the labor question; hours need not be.
  assert.equal(errorsAt(a({ ...day, unitsCut: 2.5 }), "labor.cut.unitsCut").length, 1);
  assert.equal(errorsAt(a({ ...day, unitsCut: 2.5 }, "absorbed"), "labor.cut.unitsCut").length, 1);
  assert.deepEqual(validate(a({ laborUnit: "hour", unitsCut: 2.5, paidRate: 25, loadPct: 0 })), []);
  // A position cut with 0 hours per unit is an error, so a salary is never counted with no hours saved behind it.
  const position = { laborUnit: "position", unitsCut: 1, hoursPerUnit: 0, salary: 40000, loadPct: 0.2 };
  assert.deepEqual(validate(a(position)).map((e) => e.label), ["Hours per unit"]);
  // Blank pay rate, salary or load while units are cut and the time replaces paid work.
  assert.deepEqual(validate(a({ ...day, paidRate: null, loadPct: "" })).map((e) => e.label), ["Pay rate", "Payroll load"]);
  assert.deepEqual(validate(a({ ...position, hoursPerUnit: 2080, salary: null })).map((e) => e.label), ["Salary"]);
  assert.deepEqual(validate(a({ ...day, hoursPerUnit: null })).map((e) => e.label), ["Hours per unit"]);
  // None of them is needed while nothing is cut or the time is absorbed.
  assert.deepEqual(validate(a({ ...day, unitsCut: 0, paidRate: null, loadPct: null })), []);
  assert.deepEqual(validate(a({ ...day, paidRate: null, loadPct: null }, "absorbed")), []);
});

test("labor rules: paid added hours need a pay rate and load, and no hours fall before the module starts (9.2)", () => {
  const a = (added, startYear = 0) => ({ settings: { T: 5, discountRate: 0.07 }, startYear, ...herd, labor: { added } });
  const errors = validate(a([{ label: "install", hours: [30, 0], doneBy: "paid" }]));
  assert.deepEqual(errors.map((e) => [e.path, e.label]), [["labor.added.0.paidRate", "Pay rate"], ["labor.added.0.loadPct", "Payroll load"]]);
  assert.match(errors[0].message, /^Pay rate \(install\): /);
  assert.deepEqual(validate(a([{ label: "install", hours: [30, 0], doneBy: "unpaid" }])), []);
  const early = validate(a([{ label: "install", hours: [30, 0], doneBy: "unpaid" }], 2));
  assert.deepEqual(early.map((e) => [e.path, e.label]), [["labor.added.0.hours", "Hours"]]);
  assert.deepEqual(validate(a([{ label: "install", hours: [0, 0, 30, 0], doneBy: "unpaid" }], 2)), []);
});

test("labor rules: an avoided hire needs whole years, a first year after the module starts, a salary and a load (9.2)", () => {
  const a = (avoidedHire, startYear = 0) => ({ settings: { T: 5, discountRate: 0.07 }, startYear, ...herd, labor: { avoidedHire } });
  const hire = { salary: 30000, loadPct: 0.1, startYear: 1, years: 2 };
  assert.deepEqual(validate(a(hire)), []);
  assert.deepEqual(validate(a({ ...hire, years: 2.5 })).map((e) => e.label), ["Years"]);
  assert.deepEqual(validate(a({ ...hire, startYear: 0 })).map((e) => e.label), ["First year"]);
  assert.deepEqual(validate(a({ ...hire, startYear: 2 }, 2)).map((e) => e.label), ["First year"]);
  assert.deepEqual(validate(a({ ...hire, salary: null, loadPct: null })).map((e) => e.label), ["Salary", "Payroll load"]);
  // An unused avoided hire needs no first year, salary or load.
  assert.deepEqual(validate(a({ years: 0 })), []);
  assert.deepEqual(validate(a({})), []);
});

// ---------------------------------------------------------------- cross-check against Appendix A

test("Synthetic Ranch A's cost lines and labor reproduce its pinned cash NPV, BCR and payback (Appendix A)", () => {
  // The water module comes with B7 (9.1 step 5). Until then its two outputs are supplied here: the vehicle saving as
  // a fixture line (88 summer runs × 50% avoided × 120 mi × $0.40/mi) and its hours saved (44 runs × 6 h = 264 h) as
  // other hours saved. Everything else is Ranch A's expected case as Appendix A lists it.
  const a = {
    settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 }, startYear: 0,
    classes: { cows: { head: 900 } }, served: { cows: {} }, // 900 cows, served 12 months (the default)
    costs: {
      monitors: { label: "Monitors", timing: "capital", basis: "perDevice", qty: 10, unitCost: 1490, lifeYears: 10, repairPct: 0 },
      mounting: { label: "Mounting", timing: "capital", basis: "fixed", unitCost: 750, lifeYears: null },
      subscription: { label: "Subscription", timing: "annual", basis: "perDevice", qty: 10, unitCost: 365, billing: "advance" },
      batteries: { label: "Batteries and repairs", timing: "annual", basis: "perDevice", qty: 10,
        unitCost: [0, 0, 0, 0, 100, 0, 0, 0, 100, 0, 0], billing: "arrears" },
    },
    labor: {
      freedTimeUse: "replacesPaidWork",
      cut: { laborUnit: "day", unitsCut: 16, hoursPerUnit: 8, paidRate: 18.72, loadPct: 0.1 },
      otherHoursSaved: 264,
      added: [{ label: "install", hours: [30, 0], doneBy: "unpaid" }, { label: "monitoring", hours: 52, doneBy: "unpaid" }],
    },
  };
  const vehicle = { id: "vehicle", label: "Vehicle", kind: "cash", claim: () => 44, valuePerUnit: () => 120 * 0.4 };
  assert.deepEqual(validate(a), []);
  const r = analyzeLines(a, [...buildLines(a), vehicle]);
  close(r.cashNPV, -11079, 1);
  close(r.bcr, 0.751, 0.001);
  assert.equal(r.payback, null); // "none within 10 years" once F8 adds the payback states
  assert.deepEqual(r.hours.freed, [-30, ...Array(10).fill(84)]); // 264 − 128 paid − 52 added; install in year 0
  // Capacity: 84 h × $20 a year less the $600 install. With the risk line (F7) it gives the pinned Economic NPV.
  close(r.pv.K, 11199.62, 0.005);
});

// ---------------------------------------------------------------- head-months and head-based quantities (F3, F5)

const stockers = (months = 5, head = 1200) => ({ module: "vf", classes: { yearlings: { head } }, enrolled: { yearlings: { head, months } } });
const subscription = (more = {}) => ({ label: "Subscription", timing: "annual", basis: "perHeadMonth", classes: ["yearlings"], unitCost: 7, ...more });

test("head-months count the enrolled or served classes for their months, never the sale flows (9.3)", () => {
  // Synthetic Ranch C: cows and calves born served 12 months (the default); calves sold are a sale flow.
  const ranchC = { module: "eid", classes: { cows: { head: 300 }, calvesBorn: { head: 285 }, calvesSold: { head: 240 } },
    served: { cows: {}, calvesBorn: {} } };
  assert.deepEqual(herdOf(ranchC, 3).HM, [7020, 7020, 7020, 7020]);
  // A class that is not served is not counted; a served class's months may be fewer than 12 and vary by year.
  assert.deepEqual(herdOf({ ...ranchC, served: { cows: { months: [12, 6] } } }, 2).HM, [3600, 1800, 1800]);
  // Virtual fence counts enrolled head for the months enrolled, not the inventory.
  const vf = herdOf({ module: "vf", classes: { cows: { head: 400 }, yearlings: { head: 1200 } }, enrolled: { yearlings: { head: [0, 1200, 600], months: 5 } } }, 2);
  assert.deepEqual(vf.HM, [0, 6000, 3000]);
  assert.equal(vf.head("cows", 1), 0); // inventory not enrolled has no head for the module
});

test("per-head-month vs per-head-year billing: seasonal yearlings (row 6)", () => {
  const run = (basis) => analyze(analysis(1, 0.07, { ...stockers(), costs: { subscription: subscription({ basis }) } }));
  const month = run("perHeadMonth");
  assert.deepEqual(month.C, [42000, 0]); // 6,000 head-months × $7, billed in advance in year 0
  assert.ok(!month.notices.some((n) => n.type === "perHeadYearMonths"));
  const year = run("perHeadYear");
  assert.deepEqual(year.C, [100800, 0]); // 1,200 × 12 × $7
  assert.deepEqual(year.notices.filter((n) => n.type === "perHeadYearMonths"), [
    { type: "perHeadYearMonths", lineId: "subscription", label: "Subscription", class: "yearlings", months: 5, year: 1, enrolled: true },
  ]);
});

test("changing herd size does not change a per-device subscription (F5 1)", () => {
  const run = (head) => analyze(analysis(5, 0.07, {
    classes: { cows: { head } }, served: { cows: {} },
    costs: { subscription: { label: "Subscription", timing: "annual", basis: "perDevice", qty: 10, unitCost: 365 } },
  }));
  assert.deepEqual(run(900).C, run(300).C);
  assert.deepEqual(run(900).C, [3650, 3650, 3650, 3650, 3650, 0]);
});

test("a per-device line with classes takes its quantity from head: by season, or the season a purchase serves (9.2 field notes)", () => {
  // Calf tags, used up each season, billed in arrears: 285 calves born a year.
  const tags = analyze(analysis(3, 0.07, {
    classes: { cows: { head: 300 }, calvesBorn: { head: 285 } }, served: { cows: {}, calvesBorn: {} },
    costs: { calfTags: { label: "Calf tags", timing: "annual", basis: "perDevice", classes: ["calvesBorn"], unitCost: 3, billing: "arrears" } },
  }));
  assert.deepEqual(tags.C, [0, 855, 855, 855]);
  // Purchased collars from enrolled head: bought in year t for the season that ends at t + 1, and qty_T = qty_{T−1}.
  const herd = herdOf({ module: "vf", classes: { cows: { head: 450 } }, enrolled: { cows: { head: [0, 400, 450], months: 12 } } }, 4);
  const collars = { id: "collars", label: "Purchased collars", timing: "capital", basis: "perDevice", classes: ["cows"], unitCost: 100, lifeYears: null };
  assert.deepEqual(scheduleCapital(collars, 4, 0, herd).purchases, [{ year: 0, qty: 400, unitCost: 100 }, { year: 1, qty: 50, unitCost: 100 }]);
  assert.throws(() => scheduleCapital(collars, 4, 0), /needs the herd/);
});

test("a per-head-year commitment bills at least 12 × the minimum head (9.2 field notes)", () => {
  const r = analyze(analysis(3, 0.07, {
    classes: { cows: { head: [0, 100, 50] } }, served: { cows: {} },
    costs: { service: { label: "Service", timing: "annual", basis: "perHeadYear", classes: ["cows"], unitCost: 1, billing: "arrears", minQty: 80, commitYears: 2 } },
  }));
  assert.deepEqual(r.C, [0, 1200, 960, 600]); // 12 × max(100, 80), 12 × max(50, 80), then 12 × 50 after the commitment
});

test("a horizon shorter than a per-head-month commitment: bills in years 0 and 1, the fee in year 2 (row 32)", () => {
  const r = analyze(analysis(2, 0.07, {
    ...stockers(5.5), costs: { subscription: subscription({ billing: "advance", commitYears: 3, earlyTerminationFee: 10000 }) },
  }));
  assert.deepEqual(r.C, [46200, 46200, 10000]); // 6,600 head-months × $7
  assert.deepEqual(r.notices.filter((n) => n.type === "commitPastHorizon"),
    [{ type: "commitPastHorizon", lineId: "subscription", label: "Subscription", horizon: 2, commitYears: 3, fee: 10000 }]);
});

// ---------------------------------------------------------------- cattle-presence rule (F3)

test("with no cattle, benefits and hours freed are 0 and only fixed, capital and committed costs remain (F3)", () => {
  const T = 5;
  const a = analysis(T, 0.07, {
    settings: { T, discountRate: 0.07, oppCostPerHour: 20 },
    module: "vf", classes: { yearlings: { head: 0 } }, enrolled: { yearlings: { head: 0, months: 5.5 } },
    costs: {
      subscription: subscription({ billing: "advance", minQty: 6600, commitYears: 3 }),
      software: { label: "Software", timing: "annual", basis: "fixed", unitCost: 100, billing: "arrears" },
      baseStations: { label: "Base stations", timing: "capital", basis: "fixed", unitCost: 3000, lifeYears: 10 },
    },
    labor: { freedTimeUse: "replacesPaidWork", cut: { laborUnit: "hour", unitsCut: 40, paidRate: 20, loadPct: 0 },
      otherHoursSaved: 100, added: [{ label: "monitoring", hours: 52, doneBy: "unpaid" }] },
  });
  const saving = { id: "saving", label: "Saving", kind: "cash", claim: () => 1, valuePerUnit: () => 500 };
  const fixture = { id: "fixture", label: "Fixture", kind: "cash", requiresCattle: false, claim: () => 1, valuePerUnit: () => 10 };
  const r = analyzeLines(a, [...buildLines(a), saving, fixture]);
  assert.deepEqual(r.B, [0, ...Array(T).fill(10)]); // only the fixture that does not require cattle
  assert.deepEqual(r.K, zerosOf(T));
  assert.deepEqual(r.hours.freed, zerosOf(T));
  assert.deepEqual(r.hours.saved, zerosOf(T));
  assert.deepEqual(r.hours.paidCut, zerosOf(T));
  assert.deepEqual(r.notices.filter((n) => n.type === "noCattle").map((n) => n.year), [1, 2, 3, 4, 5]);
  const line = (id) => r.lines.find((l) => l.id === id).series;
  assert.deepEqual(line("subscription"), [46200, 46200, 46200, 0, 0, 0]); // the committed minimum, then nothing
  assert.deepEqual(line("software"), [0, 100, 100, 100, 100, 100]);
  assert.equal(line("baseStations")[0], 3000);
  const cashOnly = analyze(a);
  assert.ok(cashOnly.cashNPV <= 0);
});

test("a year with no head-months zeroes that year's benefits and the paid hours cut with them (F3, 9.3 Labor)", () => {
  const a = analysis(3, 0.07, {
    settings: { T: 3, discountRate: 0.07, oppCostPerHour: 20 },
    classes: { cows: { head: [100, 100, 0, 100] } }, served: { cows: {} },
    labor: { freedTimeUse: "replacesPaidWork", cut: { laborUnit: "hour", unitsCut: 10, paidRate: 20, loadPct: 0 }, otherHoursSaved: 100 },
  });
  const r = analyze(a);
  assert.deepEqual(r.HM, [1200, 1200, 0, 1200]);
  assert.deepEqual(r.notices.filter((n) => n.type === "noCattle"), [{ type: "noCattle", year: 2 }]);
  assert.deepEqual(r.hours.paidCut, [0, 10, 0, 10]);
  assert.deepEqual(r.B, [0, 200, 0, 200]);
  assert.deepEqual(r.hours.freed, [0, 90, 0, 90]);
  assert.deepEqual(r.K, [0, 1800, 0, 1800]);
});

// ---------------------------------------------------------------- pools and the single-module clamp (F9)

const water = (runs) => ({ water: { blocks: [{ name: "Summer", runsPerWeek: runs / 4, weeks: 4 }] } });
const runsLine = (runs, dollarsPerRun, more = {}) => ({ id: "runs", label: "Runs avoided", kind: "cash", pool: "waterRuns",
  claim: () => runs, valuePerUnit: () => dollarsPerRun, ...more });
const runHours = (runs, hoursPerRun) => ({ id: "runHours", label: "Hours from runs", kind: "hours", pool: "waterRuns",
  derived: true, claim: () => runs, hoursPerUnit: hoursPerRun });

test("pool baselines come from the analysis's own inputs (9.6)", () => {
  const T = 2;
  assert.deepEqual(poolBaseline("waterRuns", { water: { blocks: [{ runsPerWeek: 4, weeks: 22 }, { runsPerWeek: 2, weeks: 30 }] } }, T), [148, 148, 148]);
  assert.equal(poolBaseline("gatherHours", { vf: {} }, T), null); // blank: the clamp is skipped
  assert.deepEqual(poolBaseline("gatherHours", { vf: { gatherHoursToday: 300 } }, T), [300, 300, 300]);
  const risks = { riskLines: [{ cause: "water", eventsPerYear: 0.2, headPerEvent: 5 }, { cause: "water", eventsPerYear: 1, headPerEvent: 3 },
    { cause: "calving", eventsPerYear: 4, headPerEvent: 1 }] };
  assert.deepEqual(poolBaseline("deathLoss:water", risks, T), [4, 4, 4]);
  assert.deepEqual(poolBaseline("fenceMiles", { vf: { fence: { miles: 14.14 } } }, T), [14.14, 14.14, 14.14]);
  assert.deepEqual(poolBaseline("fenceMiles", { vf: { fence: { miles: 14.14, planMiles: 20 } } }, T), [20, 20, 20]);
  assert.throws(() => poolBaseline("grass", {}, T), /Unknown pool/);
});

test("a single module's claim above its baseline is clamped to the baseline, with one warning (F9)", () => {
  const a = analysis(3, 0.07, { ...water(148), labor: { freedTimeUse: "replacesPaidWork",
    cut: { laborUnit: "hour", unitsCut: 74, paidRate: 20, loadPct: 0 } } });
  // The runs claim 160 against 148; the hours saved, 0.5 h a run, come from the same runs and take the same scale.
  const r = analyzeLines(a, [...buildLines(a), runsLine(160, 10), runHours(160, 0.5)]);
  const scale = 148 / 160;
  closeAll(r.pools.waterRuns.scale, [1, scale, scale, scale]);
  assert.deepEqual(r.pools.waterRuns.claims, [0, 160, 160, 160]);
  closeAll(r.lines.find((l) => l.id === "runs").claims, [0, 148, 148, 148]);
  closeAll(r.hours.saved, [0, 74, 74, 74]);
  closeAll(r.hours.paidCut, [0, 74 * scale, 74 * scale, 74 * scale]); // paid hours follow the hours through f_t
  assert.deepEqual(r.notices.filter((n) => n.type === "poolClamp"), [{ type: "poolClamp", pool: "waterRuns", year: 1, claim: 160, baseline: 148 }]);
});

test("a blank baseline skips the clamp and asks for it (9.6)", () => {
  const gather = { id: "gather", label: "Gathering hours cut", kind: "hours", pool: "gatherHours", claim: () => 300 };
  const blankBase = analyzeLines(analysis(2, 0.07, { vf: {} }), [gather]);
  assert.deepEqual(blankBase.hours.saved, [0, 300, 300]);
  assert.deepEqual(blankBase.notices.filter((n) => n.type.startsWith("pool") || n.type === "baselineBlank"), [{ type: "baselineBlank", pool: "gatherHours" }]);
  const entered = analyzeLines(analysis(2, 0.07, { vf: { gatherHoursToday: 200 } }), [gather]);
  closeAll(entered.hours.saved, [0, 200, 200]);
});

test("two risk lines with one cause add up before the clamp: 3.5 of 4 head is not clamped (9.6, 9.7)", () => {
  const riskLines = [{ cause: "water", class: "cows", eventsPerYear: 0.2, headPerEvent: 5, shareCaught: 0.5 },
    { cause: "water", class: "calvesBorn", eventsPerYear: 1, headPerEvent: 3, shareCaught: 1 }];
  const risk = (i, r) => ({ id: `risk:${i}`, label: "Losses avoided", kind: "risk", pool: "deathLoss:water",
    claim: () => r.eventsPerYear * r.headPerEvent * r.shareCaught, valuePerUnit: () => 1000 });
  const run = (lines) => { const a = analysis(2, 0.07, { riskLines: lines }); return analyzeLines(a, [...buildLines(a), ...lines.map((r, i) => risk(i, r))]); };
  const r = run(riskLines);
  assert.deepEqual(r.pools["deathLoss:water"].claims, [0, 3.5, 3.5]);
  assert.deepEqual(r.X, [0, 3500, 3500]);
  assert.ok(!r.notices.some((n) => n.type === "poolClamp"));
  assert.deepEqual(r.cashNPV, 0); // risk lines never enter cash
  // Every loss caught claims the whole baseline, and still nothing is clamped: one analysis's risk lines on one cause
  // cannot claim more than their summed baseline.
  const all = run(riskLines.map((x) => ({ ...x, shareCaught: 1 })));
  assert.deepEqual(all.pools["deathLoss:water"].scale, [1, 1, 1]);
  assert.deepEqual(all.X, [0, 4000, 4000]);
});

// ---------------------------------------------------------------- combine() (F9, 9.6)

// Two fixture modules, each claiming every run of its water baseline, with the hours those runs save (0.5 h a run)
// and a paid hand cut by those hours.
const fixtureModule = (module, baselineRuns, more = {}) => analysis(3, 0.07, {
  module, ...water(baselineRuns),
  labor: { freedTimeUse: "replacesPaidWork", cut: { laborUnit: "hour", unitsCut: 50, paidRate: 20, loadPct: 0 } }, ...more,
});
const fixtureLines = (a) => [...buildLines(a), runsLine(100, 5), runHours(100, 0.5)];

test("combine() of two modules claiming the same 100 water runs scales each claim by 0.5 (row 9, F9)", () => {
  const a = fixtureModule("Module A", 100), b = fixtureModule("Module B", 100);
  const alone = analyzeLines(a, fixtureLines(a));
  assert.deepEqual(alone.B, [0, 1500, 1500, 1500]); // 100 runs × $5 + 50 h × $20
  const c = combine([a, b], fixtureLines);
  assert.deepEqual(c.pools.waterRuns.scale, [1, 0.5, 0.5, 0.5]);
  assert.deepEqual(c.pools.waterRuns.baseline, [100, 100, 100, 100]);
  assert.deepEqual(c.pools.waterRuns.claims, [[0, 100, 100, 100], [0, 100, 100, 100]]);
  const claims = c.results.map((r) => r.lines.find((l) => l.id === "runs").claims[1]);
  assert.deepEqual(claims, [50, 50]); // combined claim 100 runs
  for (const r of c.results) {
    assert.deepEqual(r.hours.saved, [0, 25, 25, 25]); // derived hours saved halved
    assert.deepEqual(r.hours.paidCut, [0, 25, 25, 25]); // paid hours cut halved
    assert.deepEqual(r.B, [0, 750, 750, 750]);
    assert.ok(!r.notices.some((n) => n.type === "poolClamp")); // the scale replaces each analysis's own clamp
  }
  assert.deepEqual(c.warnings, [{ type: "poolShared", pool: "waterRuns", year: 1, modules: ["Module A", "Module B"], claim: 200, baseline: 100 }]);
});

test("combine() with baselines of 100 and 120 runs uses 120, with a warning (row 9)", () => {
  const c = combine([fixtureModule("Module A", 100), fixtureModule("Module B", 120)], fixtureLines);
  assert.deepEqual(c.pools.waterRuns.baseline, [120, 120, 120, 120]);
  closeAll(c.pools.waterRuns.scale, [1, 0.6, 0.6, 0.6]);
  assert.deepEqual(c.warnings[0], { type: "baselinesDiffer", pool: "waterRuns", year: 1, modules: ["Module A", "Module B"], values: [100, 120], largest: 120 });
  assert.equal(c.warnings[1].type, "poolShared");
});

test("combine() returns each analysis's results, the pools and the risk subtotal, counting a shared loss once (9.6)", () => {
  const riskLines = [{ cause: "water", class: "cows", eventsPerYear: 0.15, headPerEvent: 5, shareCaught: 1 }];
  const outage = { id: "risk:0", label: "Losses avoided (water)", kind: "risk", pool: "deathLoss:water", claim: () => 0.75, valuePerUnit: () => 1000 };
  const mod = (module) => analysis(3, 0.07, { module, riskLines });
  const build = (a) => [...buildLines(a), outage];
  const alone = analyzeLines(mod("Module A"), build(mod("Module A")));
  const c = combine([mod("Module A"), mod("Module B")], build);
  assert.deepEqual(Object.keys(c), ["results", "pools", "riskSubtotalPV", "warnings"]);
  assert.equal(c.results.length, 2);
  closeAll(c.results[0].X, [0, 375, 375, 375]);
  close(c.riskSubtotalPV, alone.pv.X, 1e-9); // 0.75 head a year counted once across the two modules
  c.results.forEach((r) => assert.equal(r.cashNPV, alone.cashNPV));
  assert.deepEqual(c.warnings, [{ type: "poolShared", pool: "deathLoss:water", year: 1, modules: ["Module A", "Module B"], claim: 1.5, baseline: 0.75 }]);
});

test("combine(): a pool with no baseline and no claims has scale 1 and no NaN; mismatched horizons and blank baselines are errors (9.6)", () => {
  const none = (module) => analysis(2, 0.07, { module, water: { blocks: [] } });
  const build = (a) => [...buildLines(a), runsLine(0, 5)];
  const c = combine([none("Module A"), none("Module B")], build);
  assert.deepEqual(c.pools.waterRuns.scale, [1, 1, 1]);
  assert.deepEqual(c.warnings, []);
  c.results.forEach((r) => [r.cashNPV, ...r.N, ...r.B].forEach((x) => assert.ok(Number.isFinite(x))));
  assert.deepEqual(combine([none("Module A"), analysis(3, 0.07, { module: "Module B" })], build).error, { type: "horizonsDiffer", horizons: [2, 3] });
  const gather = (a) => [...buildLines(a), { id: "gather", label: "Gathering", kind: "hours", pool: "gatherHours", claim: () => 100 }];
  const vfBlank = analysis(2, 0.07, { module: "vf", ...stockers(), vf: {} });
  const vfFull = analysis(2, 0.07, { module: "vf", ...stockers(), vf: { gatherHoursToday: 150 } });
  assert.deepEqual(combine([vfFull, vfBlank], gather).error, { type: "baselineMissing", pool: "gatherHours", module: "vf" });
});

test("an analysis claims a pool only where its claims are above 0: a zero claim is not named, needs no baseline and asks for none (9.6)", () => {
  const a = fixtureModule("Module A", 100);
  const b = fixtureModule("Module B", 120);
  const build = (x) => [...buildLines(x), runsLine(x.module === "Module A" ? 150 : 0, 5)];
  const c = combine([a, b], build);
  // Only Module A claims, so its own baseline (100, not B's 120) caps it, with the single-module warning.
  assert.deepEqual(c.pools.waterRuns.baseline, [100, 100, 100, 100]);
  assert.deepEqual(c.warnings, [{ type: "poolClamp", pool: "waterRuns", year: 1, claim: 150, baseline: 100 }]);
  const gather = (x) => [...buildLines(x), { id: "gather", label: "Gathering", kind: "hours", pool: "gatherHours", claim: () => (x.vf.gatherHoursToday ? 100 : 0) }];
  const vfBlank = analysis(2, 0.07, { module: "vf", ...stockers(), vf: {} });
  const vfFull = analysis(2, 0.07, { module: "vf", ...stockers(), vf: { gatherHoursToday: 150 } });
  const both = combine([vfFull, vfBlank], gather);
  assert.equal(both.error, undefined);
  assert.deepEqual(both.pools.gatherHours.scale, [1, 1, 1]);
  assert.ok(!analyzeLines(vfBlank, gather(vfBlank)).notices.some((n) => n.type === "baselineBlank"));
  assert.deepEqual(combine([]).error, { type: "noAnalyses" });
});

// ---------------------------------------------------------------- class rules (F3, 9.2)

test("class rules: enrolled months, no sale flows enrolled or served, enrolled within inventory, calves sold within calves born (9.2)", () => {
  const base = { settings: { T: 3, discountRate: 0.07 }, startYear: 0, module: "vf", classes: { yearlings: { head: [1200, 1200, 1000] } } };
  assert.deepEqual(validate({ ...base, enrolled: { yearlings: { head: 1000, months: 5 } } }), []);
  const months = validate({ ...base, enrolled: { yearlings: { head: 1000 } } });
  assert.deepEqual(months.map((e) => [e.path, e.label]), [["enrolled.yearlings.months", "Enrolled head by class and months"]]);
  assert.match(months[0].message, /^Enrolled head by class and months \(yearlings\): enter the months enrolled\.$/);
  const over = validate({ ...base, enrolled: { yearlings: { head: 1200, months: 5 } } });
  assert.deepEqual(over.map((e) => e.path), ["enrolled.yearlings.head"]);
  assert.match(over[0].message, /1,200 head enrolled in year 2 are more than the 1,000 in the herd/);
  const sale = validate({ ...base, classes: { ...base.classes, calvesSold: { head: 10 } }, enrolled: { yearlings: { head: 1000, months: 5 }, calvesSold: { head: 10, months: 5 } } });
  assert.ok(sale.some((e) => e.path === "enrolled.calvesSold" && e.label === "Enrolled head by class and months"));
  const served = validate({ settings: { T: 3, discountRate: 0.07 }, module: "water", served: { cows: {}, cullCowsSold: {} } });
  assert.deepEqual(served.map((e) => [e.path, e.label]), [["served.cullCowsSold", "Classes served and months on the served pastures"]]);
  // Synthetic Ranch C: 240 calves sold of 285 born pass; with 50 heifers kept, only 235 are left to sell.
  const ranchC = { settings: { T: 7, discountRate: 0.07 }, module: "eid", classes: { cows: { head: 300 }, calvesBorn: { head: 285 }, calvesSold: { head: 240 } },
    served: { cows: {}, calvesBorn: {} } };
  assert.deepEqual(validate(ranchC), []);
  // Only the years of the analysis are checked: entries past the horizon are not used (9.2).
  const past = { ...base, classes: { yearlings: { head: [1200, 1200, 1200, 1200, 500] } }, enrolled: { yearlings: { head: 1000, months: 5 } } };
  assert.deepEqual(validate(past), []);
  assert.deepEqual(validate({ ...ranchC, settings: { T: 2, discountRate: 0.07 }, heifersRetained: [0, 0, 0, 0, 0, 0, 0, 60] }), []);
  // Heifers kept above the calves born, with no calves sold, are named as such.
  const heifers = validate({ ...ranchC, classes: { cows: { head: 300 }, calvesBorn: { head: 285 } }, heifersRetained: 300 });
  assert.deepEqual(heifers.map((e) => [e.path, e.label, e.message]), [["heifersRetained", "Calves kept as heifers",
    "Calves kept as heifers: the 300 kept in year 0 are more than the 285 calves born."]]);
  const kept = validate({ ...ranchC, heifersRetained: [0, 50] });
  assert.deepEqual(kept.map((e) => [e.path, e.label]), [["classes.calvesSold.head", "Head by class and year"]]);
  assert.match(kept[0].message, /240 calves sold in year 1 are more than the 285 calves born less the 50 kept as replacement heifers/);
});
