// Tests of the phase-1 engine (roi.js), against docs/audit/phase1-spec.md: 9.3 formulas, 9.7 tests, 10.1 rows.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  YEARS_MESSAGE, at, npv, analyze, analyzeLines, buildLines, scheduleCapital, billAnnual, billingOf, addedHours, validate,
} from "../roi.js";

const close = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const closeAll = (xs, ys, tol = 1e-9) => {
  assert.equal(xs.length, ys.length, `${xs} vs ${ys}`);
  xs.forEach((x, i) => close(x, ys[i], tol));
};
const analysis = (T, discountRate, more = {}) => ({ settings: { T, discountRate }, startYear: 0, ...more });
const device = (more = {}) => ({ id: "devices", label: "Devices", timing: "capital", basis: "perDevice", unitCost: 1000, qty: 1, ...more });
const yearsBought = (line, T, s = 0) => scheduleCapital(line, T, s).purchases.map((p) => p.year);
// A benefit fixture with no cattle to depend on (9.7, "Cattle in engine tests").
const cashBenefit = (dollars) => ({ id: "savings", label: "Savings", kind: "cash", requiresCattle: false, claim: () => 1, valuePerUnit: () => dollars });
const errorsAt = (a, path) => validate(a).filter((e) => e.path === path);

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
    [{ type: "commitPastHorizon", lineId: "subscription", horizon: 5, commitYears: 6, fee: 10000 }]);
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
  const base = { settings: { T: 10, discountRate: 0.07, oppCostPerHour: 20 }, startYear: 0, labor: { otherHoursSaved: 50 } };
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
  const install = analyze({ settings, startYear: 0, labor: { added: [{ label: "install", hours: [30, 0], doneBy: "unpaid" }] } });
  assert.deepEqual(install.hours.unpaidAdded, [30, ...Array(10).fill(0)]);
  assert.deepEqual(install.K, [-600, ...Array(10).fill(0)]);
  assert.deepEqual(addedHours([30], 7, 0, 10), 30);
  // 52 h a year of monitoring, unpaid: years 1..10, lowering hours freed.
  const weekly = analyze({ settings, startYear: 0, labor: { otherHoursSaved: 100, added: [{ label: "monitoring", hours: 52, doneBy: "unpaid" }] } });
  assert.deepEqual(weekly.hours.freed, [0, ...Array(10).fill(48)]);
  assert.deepEqual(weekly.K, [0, ...Array(10).fill(960)]);
  // With the module starting in year 2, install in entry 2 falls in year 2 (K_2), and benefits start in year 3.
  const late = { settings, startYear: 2, labor: { otherHoursSaved: 100, added: [{ label: "install", hours: [0, 0, 30, 0], doneBy: "unpaid" }] } };
  assert.deepEqual(validate(late), []);
  const r = analyze(late);
  assert.deepEqual(r.hours.freed, [0, 0, -30, ...Array(8).fill(100)]);
  assert.deepEqual(r.K, [0, 0, -600, ...Array(8).fill(2000)]);
  // Paid setup hours are a cost in the year they are worked.
  const paid = analyze({ settings, startYear: 0, labor: { added: [{ label: "install", hours: [30, 0], doneBy: "paid", paidRate: 20, loadPct: 0 }] } });
  assert.deepEqual(paid.C, [600, ...Array(10).fill(0)]);
  assert.deepEqual(paid.K, Array(11).fill(0));
});

test("capacity is hours freed × the owner time rate, and 0 without a rate (economic view only)", () => {
  const a = { settings: { T: 3, discountRate: 0.07 }, startYear: 0, labor: { otherHoursSaved: 100 } };
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
  const a = (added, startYear = 0) => ({ settings: { T: 5, discountRate: 0.07 }, startYear, labor: { added } });
  const errors = validate(a([{ label: "install", hours: [30, 0], doneBy: "paid" }]));
  assert.deepEqual(errors.map((e) => [e.path, e.label]), [["labor.added.0.paidRate", "Pay rate"], ["labor.added.0.loadPct", "Payroll load"]]);
  assert.match(errors[0].message, /^Pay rate \(install\): /);
  assert.deepEqual(validate(a([{ label: "install", hours: [30, 0], doneBy: "unpaid" }])), []);
  const early = validate(a([{ label: "install", hours: [30, 0], doneBy: "unpaid" }], 2));
  assert.deepEqual(early.map((e) => [e.path, e.label]), [["labor.added.0.hours", "Hours"]]);
  assert.deepEqual(validate(a([{ label: "install", hours: [0, 0, 30, 0], doneBy: "unpaid" }], 2)), []);
});

test("labor rules: an avoided hire needs whole years, a first year after the module starts, a salary and a load (9.2)", () => {
  const a = (avoidedHire, startYear = 0) => ({ settings: { T: 5, discountRate: 0.07 }, startYear, labor: { avoidedHire } });
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
  const vehicle = { id: "vehicle", label: "Vehicle", kind: "cash", requiresCattle: false, claim: () => 44, valuePerUnit: () => 120 * 0.4 };
  assert.deepEqual(validate(a), []);
  const r = analyzeLines(a, [...buildLines(a), vehicle]);
  close(r.cashNPV, -11079, 1);
  close(r.bcr, 0.751, 0.001);
  assert.equal(r.payback, null); // "none within 10 years" once F8 adds the payback states
  assert.deepEqual(r.hours.freed, [-30, ...Array(10).fill(84)]); // 264 − 128 paid − 52 added; install in year 0
  // Capacity: 84 h × $20 a year less the $600 install. With the risk line (F7) it gives the pinned Economic NPV.
  close(r.pv.K, 11199.62, 0.005);
});
