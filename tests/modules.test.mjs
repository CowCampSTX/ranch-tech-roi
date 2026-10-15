// Tests of the three modules and their synthetic examples (docs/audit/phase1-spec.md 9.1 step 5): the water module
// (B7), the virtual fence module and the EID module (B4a), run on the examples of examples.js (Appendix A), with the
// 10.1 rows that start from them and the 9.7 module tests. The ramp (B3) is tested in roi.test.mjs.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { npv, analyze, buildLines, combine, validate, shareCap, shareUsed, eidRuleClasses, handlingHours, herdOf } from "../roi.js";
import { example } from "../examples.js";
import { setInput } from "../state.js";
import { noticeText, paybackText, irrText, verdictSentence, tiles, EID_RULE_NOTICE } from "../text.js";

const close = (a, b, tol = 0.005) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b} (±${tol})`);
const closeAll = (xs, ys, tol = 1e-6) => {
  assert.equal(xs.length, ys.length, `${xs} vs ${ys}`);
  xs.forEach((x, i) => close(x, ys[i], tol));
};
/** An example with changes made in place by f. */
const ex = (id, f) => {
  const a = example(id);
  f?.(a);
  return a;
};
const run = (id, f) => {
  const a = ex(id, f);
  assert.deepEqual(validate(a), []);
  return analyze(a);
};
const line = (r, id) => r.lines.find((l) => l.id === id);
const texts = (r, type) => r.notices.filter((n) => n.type === type).map(noticeText);
const repeat = (x, n) => Array(n).fill(x);
const factor = (rate, years) => years.reduce((f, t) => f + 1 / (1 + rate) ** t, 0);

// ---------------------------------------------------------------- pinned regressions (9.7, Appendix A)

test("Synthetic Ranch A expected: −$11,079, −$412, +$10,788, BCR 0.751, none within 10 years, and its yearly net cash (Appendix A)", () => {
  const r = run("ranchA");
  close(r.cashNPV, -11079, 1);
  close(r.cashNPVWithRisk, -412, 1);
  close(r.economicNPV, 10788, 1);
  close(r.bcr, 0.751, 0.001);
  assert.equal(paybackText(r.payback), "none within 10 years");
  closeAll(r.N, [-19300, 1098, 1098, 1098, 98, 1098, 1098, 1098, 98, 1098, 4748], 0.5);
});

test("Synthetic Ranch B expected: −$229,531, BCR 0.285, none within 7 years, and its yearly net cash (Appendix A)", () => {
  const r = run("ranchB");
  close(r.cashNPV, -229531, 1);
  close(r.cashNPVWithRisk, -229531, 1);
  close(r.economicNPV, -229531, 1);
  close(r.bcr, 0.285, 0.001);
  assert.equal(paybackText(r.payback), "none within 7 years");
  closeAll(r.N, [-16300, -48780, -48780, -48780, -14380, -48780, -48780, -11180], 0.5);
});

test("Synthetic Ranch C expected: −$9,895, economic −$13,101, BCR 0.206, none within 7 years, rule applies: no (Appendix A)", () => {
  const a = example("ranchC");
  assert.deepEqual(a.eid.ruleApplies, { cows: false, calvesBorn: false });
  const r = run("ranchC");
  close(r.cashNPV, -9895, 1);
  close(r.cashNPVWithRisk, -9895, 1);
  close(r.economicNPV, -13101, 1);
  close(r.bcr, 0.206, 0.001);
  assert.equal(paybackText(r.payback), "none within 7 years");
  closeAll(r.N, [-5851, -871, -871, -871, -871, -871, -871, 172], 0.5);
  assert.ok(!r.notices.some((n) => n.type === "eidRulePending"));
  // The unpaid added hours: 885 weighings × 20 s × crew 3 = 14.75 h, plus 15 h of data upkeep, at $20/h.
  closeAll(r.K, [0, ...repeat(-595, 7)]);
});

test("Synthetic Ranch D: −$9,789, BCR 0.954, its payback and IRR states, PVs by line and yearly net cash (Appendix A)", () => {
  const r = run("ranchD");
  close(r.cashNPV, -9789, 1);
  close(r.economicNPV, -9789, 1);
  close(r.bcr, 0.954, 0.001);
  assert.equal(paybackText(r.payback), "none within 7 years (no net outlay in year 0; cumulative negative from year 7)");
  assert.equal(irrText(r.irr), "n/a: no net outlay in year 0");
  close(r.pv.C, 212075, 1);
  close(line(r, "subscription").pv, 193756, 1);
  close(line(r, "handling").pv, 13819, 1);
  close(line(r, "infrastructure").pv, 4500, 1);
  close(r.pv.B, 202286, 1);
  close(line(r, "fence").pv, 175340, 1);
  close(line(r, "laborCut").pv, 26946, 1);
  closeAll(r.N, [175446, -22223, -20123, -20123, -20123, -20123, -20123, -140276], 0.5);
  // The fence miles are stored unrounded, with planMiles defaulting to them: no clamp.
  const a = example("ranchD");
  close(a.vf.fence.miles, 2 * Math.sqrt(2000 / 640) * 4, 1e-12);
  assert.equal(a.vf.fence.planMiles, undefined);
  assert.ok(!r.notices.some((n) => n.type === "poolClamp"));
  // Typed as 14.14 mi, the cash NPV is −$9,815.
  close(run("ranchD", (x) => (x.vf.fence.miles = 14.14)).cashNPV, -9815, 1);
});

test("the section 11 sensitivity runs of the examples (Appendix A)", () => {
  close(run("ranchA", (a) => (a.water.blocks[1].shareAvoided = 0.5)).cashNPV, -965, 1);
  close(run("ranchA", (a) => { a.water.blocks[0].shareAvoided = 0; a.labor.cut.unitsCut = 0; }).cashNPV, -44426, 1);
  const fourHours = run("ranchA", (a) => (a.labor.added[1].hours = 4 * 52));
  close(fourHours.cashNPV, -11079, 1);
  close(fourHours.economicNPV, -11126, 1);
  assert.deepEqual(fourHours.hours.freed.slice(1, 3), [-72, -72]);
  close(run("ranchA", (a) => (a.settings.discountRate = 0.03)).cashNPV, -8898, 1);
  close(run("ranchA", (a) => (a.settings.discountRate = 0.1)).cashNPV, -12297, 1);
  close(run("ranchB", (a) => (a.settings.landUnits[0] = { ...a.settings.landUnits[0], kind: "leased", leaseYears: 7, renewalExpected: true, fenceBuiltBy: "landlord" })).cashNPV, -294088, 1);
  close(run("ranchB", (a) => Object.assign(a.vf.fence, { F: 15100, Lf: 25, m: 0.05 })).cashNPV, -194901, 1);
  close(run("ranchC", (a) => (a.eid.dosing.applications = { calvesBorn: 1 })).cashNPV, -11350, 1);
  close(run("ranchC", (a) => (a.eid.retagPct = 0.043)).cashNPV, -10037, 1);
});

// ---------------------------------------------------------------- water (B7)

// The USU worked example (B7 acceptance): one block, 26 weeks × 3 runs × 40 mi at $0.50/mi, 50% avoided, and one
// $1,800 monitor with a 10-year life; no subscription and no labor (USU does not count the install).
const usu = (more = {}) => ({
  module: "water", settings: { T: 10, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
  costs: { monitors: { timing: "capital", basis: "perDevice", unitCost: 1800, lifeYears: 10, residual: { mode: "straightLine" } } },
  water: { monitors: 1, variableCostPerMile: 0.5,
    blocks: [{ name: "summer", weeks: 26, runsPerWeek: 3, milesPerRun: 40, hoursPerRun: 1, minVisitsPerWeek: 0, shareAvoided: 0.5 }] },
  ...more,
});

test("the USU water example: $1,560 baseline mileage, $780 a year at 50%, payback 2.31 years (B7 acceptance)", () => {
  const a = usu();
  assert.deepEqual(validate(a), []);
  const r = analyze(a);
  // Baseline mileage through the engine: with every run avoided (no minimum visits, so the cap is 100%), the vehicle
  // saves 26 × 3 × 40 mi × $0.50 = $1,560 a year.
  const all = analyze(usu({ water: { ...a.water, blocks: [{ ...a.water.blocks[0], shareAvoided: 1 }] } }));
  closeAll(line(all, "vehicle").series, [0, ...repeat(1560, 10)]);
  closeAll(r.pools.waterRuns.baseline, repeat(78, 11)); // 26 weeks × 3 runs
  closeAll(line(r, "vehicle").series, [0, ...repeat(780, 10)]);
  let cum = 0;
  closeAll(r.N.slice(0, 4).map((x) => (cum += x)), [-1800, -1020, -240, 540]);
  close(r.payback.years, 2.31, 0.01);
  assert.equal(paybackText(r.payback), "2.31 years");
});

test("the minimum visits cap a block's share; a freeze-flagged block counts 0% unless a share is typed, with a warning (B7, 9.3)", () => {
  const block = { name: "summer", weeks: 22, runsPerWeek: 4, minVisitsPerWeek: 2, shareAvoided: 0.8 };
  assert.equal(shareCap(block), 0.5);
  assert.equal(shareUsed(block), 0.5);
  assert.equal(shareCap({ runsPerWeek: 0, minVisitsPerWeek: 0 }), 0);
  assert.equal(shareCap({ runsPerWeek: 2, minVisitsPerWeek: 3 }), 0);
  assert.equal(shareUsed({ runsPerWeek: 4, minVisitsPerWeek: 0 }), 0); // a blank share is 0
  // Synthetic Ranch A's fall–winter block is flagged and loads at 0%: it claims no runs.
  const a = example("ranchA");
  assert.deepEqual([a.water.blocks[1].freezeOrFeedRoute, a.water.blocks[1].shareAvoided], [true, 0]);
  closeAll(analyze(a).pools.waterRuns.claims, [0, ...repeat(44, 10)]); // 22 × 4 × 50%
});

test("the vehicle is listed as not entered when its cost per mile is blank, or when it counts 0 because a block's share is blank (9.5 item 4)", () => {
  const listed = (f) => texts(run("ranchA", (a) => { a.labor.cut.unitsCut = 0; f(a); }), "notEntered").includes("Vehicle: not entered, not counted");
  assert.ok(listed((a) => (a.water.variableCostPerMile = null)));
  assert.ok(listed((a) => a.water.blocks.forEach((b) => (b.shareAvoided = null))));
  // The summer share cleared and the fall–winter share entered as 0: the vehicle counts 0 only because of the blank.
  assert.ok(listed((a) => (a.water.blocks[0].shareAvoided = null)));
  // Not listed: as loaded; with the summer share blank but the fall–winter block avoiding runs (the blank share is then
  // listed under its own label with the rest of the assumptions list, 9.1 step 6); with the summer share blank on a
  // block whose minimum visits leave nothing to avoid (cap 0); and with both shares typed as 0.
  assert.ok(!listed(() => {}));
  assert.ok(!listed((a) => { a.water.blocks[0].shareAvoided = null; a.water.blocks[1].shareAvoided = 0.5; }));
  assert.ok(!listed((a) => { a.water.blocks[0].shareAvoided = null; a.water.blocks[0].minVisitsPerWeek = 4; }));
  assert.ok(!listed((a) => (a.water.blocks[0].shareAvoided = 0)));
});

test("row 50(a) and (d): the freeze and cap warnings in full; the cap is what counts", () => {
  const winter = run("ranchA", (a) => (a.water.blocks[1].shareAvoided = 0.5));
  close(winter.cashNPV, -965.15, 0.01);
  assert.deepEqual(texts(winter, "freezeShare"),
    ["The fall–winter block is marked 'tanks freeze / water checked on the feeding route', so its share of runs avoided is normally 0%. Check the 50% you entered."]);
  const summer = ex("ranchA", (a) => (a.water.blocks[0].shareAvoided = 0.8));
  assert.deepEqual(validate(summer), []);
  const r = analyze(summer);
  assert.deepEqual(texts(r, "shareAboveCap"), ["The summer block's share of runs avoided is limited to 50% by the minimum visits; you entered 80%."]);
  assert.equal(summer.water.blocks[0].shareAvoided, 0.8); // the input keeps what was typed
  close(r.cashNPV, -11079, 1);
  // With 34 days cut, the paid-hours check uses the 264 hours saved at the cap (not 422.4 h at 80%): row 23's error.
  summer.labor.cut.unitsCut = 34;
  assert.deepEqual(validate(summer).map((e) => [e.path, e.label, e.message]), [["labor.cut.unitsCut", "Hired labor cut",
    "Hired labor cut: the paid hours cut in year 1 (272 h) are more than the hours saved that can support them (264 h)."]]);
});

test("row 23: 34 day-labor days (272 h) against 264 h saved is a validation error naming 'Hired labor cut'", () => {
  const a = ex("ranchA", (x) => (x.labor.cut.unitsCut = 34));
  assert.deepEqual(validate(a), [{ path: "labor.cut.unitsCut", label: "Hired labor cut",
    message: "Hired labor cut: the paid hours cut in year 1 (272 h) are more than the hours saved that can support them (264 h)." }]);
  assert.deepEqual(validate(ex("ranchA", (x) => (x.labor.cut.unitsCut = 33))), []); // 264 h: exactly the hours saved
});

test("row 10: buying monitors plus a service fee against an all-in lease", () => {
  const water = (costs) => ({ module: "water", settings: { T: 10, discountRate: 0.07 }, startYear: 0, water: { monitors: 10 }, costs });
  const bought = analyze(water({
    monitors: { timing: "capital", basis: "perDevice", unitCost: 1490, lifeYears: 10, residual: { mode: "straightLine" } },
    subscription: { timing: "annual", basis: "perDevice", unitCost: 365, billing: "advance" },
  }));
  const annuityDue = factor(0.07, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  close(annuityDue, 7.515232, 1e-6);
  close(bought.pv.C, 42330.60, 0.01);
  assert.equal(bought.R[10], 0);
  const lease = (X) => analyze(water({ subscription: { timing: "annual", basis: "perDevice", unitCost: X, billing: "advance" } })).pv.C;
  close(lease(365 + 1490 / annuityDue), bought.pv.C, 1);
  close(lease(563.26), bought.pv.C, 1);
  close(lease(600), 45091.39, 0.01);
});

test("rows 35(a) and (b) on Synthetic Ranch A: half the subscription paid by others; a leased unit's benefits stop at year 3, by land unit", () => {
  const half = run("ranchA", (a) => (a.costs.subscription.operatorShare = 0.5));
  close(half.cashNPV - -11079.04, 13715.30, 0.5);
  assert.deepEqual(half.paidByOthers.map((o) => [o.lineId, o.unitId, o.series[0]]), [["subscription", "u1", 1825]]);
  const two = [{ id: "u1", kind: "owned", share: 0.6 }, { id: "u2", kind: "leased", leaseYears: 3, share: 0.4 }];
  const r = run("ranchA", (a) => (a.settings.landUnits = two));
  close(r.cashNPV, -19434, 1);
  close(r.cashNPV, -11079.04 - 0.4 * 4747.78 * factor(0.07, [4, 5, 6, 7, 8, 9, 10]), 0.5);
  close(r.cashNPVWithRisk, -11439, 1);
  assert.deepEqual(r.receivedByOthers, []);
  // Each line shown by land unit: the owned 60% runs through year 10, the leased 40% counts in years 1–3 only.
  const byUnit = (id) => Object.fromEntries(line(r, id).byUnit.map((u) => [u.unitId, u.series]));
  for (const [id, yearly] of [["vehicle", 2112], ["laborCut", 2635.776], ["risk:0", 0.15 * 5 * 0.75 * 2700]]) {
    closeAll(byUnit(id).u1, [0, ...repeat(0.6 * yearly, 10)], 1e-6);
    closeAll(byUnit(id).u2, [0, ...repeat(0.4 * yearly, 3), ...repeat(0, 7)], 1e-6);
  }
  // Costs are unchanged and stay whole on each unit's part.
  const subscription = Object.fromEntries(line(r, "subscription").byUnit.map((u) => [u.unitId, u.series[0]]));
  closeAll([subscription.u1, subscription.u2], [2190, 1460]);
  assert.deepEqual(texts(r, "leaseEnds"),
    ["The lease on land unit 2 ends in year 3, inside the 10-year horizon. Its share of each benefit stops then; its costs run as entered, except improvements that stay with the land, which stop at the lease end and are credited any reimbursement."]);
});

test("rows 47(a) and (b): water care by the landlord, or in the lease rate, gives the vehicle, labor and hours freed to the landowner", () => {
  const landlord = [{ id: "u1", kind: "leased", leaseYears: 15, share: 1, waterBy: "landlord" }];
  const r = run("ranchA", (a) => (a.settings.landUnits = landlord));
  close(r.cashNPV, -44426, 1);
  close(r.cashNPV, -11079.04 - 2112 * 7.023582 - 2635.776 * 7.023582, 0.5);
  const others = Object.fromEntries(r.receivedByOthers.map((o) => [o.lineId, o]));
  assert.deepEqual(Object.keys(others).sort(), ["hoursFreed", "laborCut", "vehicle"]);
  close(others.vehicle.pv, 14834, 1);
  close(others.laborCut.pv, 18513, 1);
  assert.equal(others.hoursFreed.pv, null);
  close(line(r, "risk:0").pv, line(run("ranchA"), "risk:0").pv, 1e-9); // the risk line stays the operator's
  assert.deepEqual(texts(r, "waterCare"),
    ["On land unit 1, the landlord provides and checks the water, so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'."]);
  close(run("ranchA", (a) => { a.settings.landUnits = landlord; a.benefitShares = { vehicle: 1 }; }).cashNPV, -29592, 1);
  const rate = run("ranchA", (a) => (a.settings.landUnits = [{ id: "u1", kind: "leased", leaseYears: 15, share: 1, careInLeaseRate: true }]));
  close(rate.cashNPV, -44426, 1);
  assert.deepEqual(texts(rate, "waterCare"),
    ["On land unit 1, water care is included in the lease rate, so the vehicle, labor and hours-freed savings there go to the landowner by default and are listed under 'Received by others'."]);
});

test("row 9 with the water module: it and a fixture module share 100 water runs, each scaled by 0.5", () => {
  // The water module avoids all 100 runs of its one block (25 weeks × 4 runs, no minimum visits), at 2 h a run, and
  // cuts 200 paid hours; the fixture module claims the same 100 runs.
  const blocks = [{ name: "summer", weeks: 25, runsPerWeek: 4, milesPerRun: 10, hoursPerRun: 2, minVisitsPerWeek: 0, shareAvoided: 1 }];
  const water = { module: "water", settings: { T: 3, discountRate: 0.07 }, startYear: 0, classes: { cows: { head: 100 } }, served: { cows: {} },
    water: { monitors: 1, variableCostPerMile: 0.5, blocks },
    labor: { freedTimeUse: "replacesPaidWork", cut: { laborUnit: "hour", unitsCut: 200, hoursPerUnit: 1, paidRate: 20, loadPct: 0 } } };
  const fixture = { ...water, module: "Module B", labor: undefined, water: { blocks } };
  const runs = { id: "runs", label: "Runs avoided", kind: "cash", pool: "waterRuns", claim: () => 100, valuePerUnit: () => 5 };
  const c = combine([water, fixture], (a) => (a.module === "water" ? buildLines(a) : [...buildLines(a), runs]));
  closeAll(c.pools.waterRuns.scale, [1, 0.5, 0.5, 0.5]);
  const [w, f] = c.results;
  closeAll(line(w, "vehicle").claims, [0, 50, 50, 50]);
  closeAll(line(f, "runs").claims, [0, 50, 50, 50]);
  closeAll(w.hours.saved, [0, 100, 100, 100]); // 200 h halved
  closeAll(w.hours.paidCut, [0, 100, 100, 100]); // 200 paid hours halved through f_t
  closeAll(line(w, "laborCut").series, [0, 2000, 2000, 2000]);
  assert.deepEqual(c.warnings.map(noticeText),
    ["Remote water monitoring and Module B claim the same water runs: together 200 against a baseline of 100 in year 1, so each claim is scaled down in proportion."]);

  // Baselines of 100 and 120 runs reported by the two analyses: 120 is used, with its warning (10.1 row 9).
  const wider = { ...fixture, water: { blocks: [{ ...blocks[0], weeks: 30 }] } };
  const d = combine([water, wider], (a) => (a.module === "water" ? buildLines(a) : [...buildLines(a), runs]));
  closeAll(d.pools.waterRuns.baseline, [120, 120, 120, 120]);
  closeAll(d.pools.waterRuns.scale, [1, 0.6, 0.6, 0.6]);
  closeAll(line(d.results[0], "vehicle").claims, [0, 60, 60, 60]);
  assert.deepEqual(d.warnings.map(noticeText).sort(), [
    "Remote water monitoring and Module B claim the same water runs: together 200 against a baseline of 120 in year 1, so each claim is scaled down in proportion.",
    "Remote water monitoring and Module B report different baselines for water runs in year 1 (100 and 120); the largest, 120, is used.",
  ]);
});

test("the ramp reaches every module benefit line: water runs and hours, the labor cut and losses avoided; EID premium and dosing; never the fence (B3)", () => {
  const RAMP = [1, 0.5, 0.8, 1];
  const factor = [1, 0.5, 0.8, 1, 1, 1, 1, 1, 1, 1, 1];
  const compare = (id, f, ids) => {
    const base = run(id, f), ramped = run(id, (a) => { f?.(a); a.ramp = RAMP; });
    for (const lid of ids) closeAll(line(ramped, lid).series, line(base, lid).series.map((x, t) => x * factor[t]), 1e-6);
    closeAll(ramped.C, base.C, 1e-9); // no cost changes
    return { base, ramped };
  };
  const a = compare("ranchA", null, ["vehicle", "laborCut", "risk:0"]);
  closeAll(a.ramped.hours.saved, [0, 132, 211.2, 264, 264, 264, 264, 264, 264, 264, 264]);
  closeAll(line(a.ramped, "vehicle").series.slice(0, 4), [0, 1056, 1689.6, 2112]);
  compare("ranchC", (c) => { c.eid.premium = { saleCwt: 5.5, premiumPerCwt: 2, verificationFee: 1.5 }; }, ["premium", "dosing"]);
  const d = compare("ranchD", null, ["laborCut"]);
  closeAll(line(d.ramped, "fence").series, line(d.base, "fence").series, 1e-9); // the avoided fence is not ramped
  // Health-check riding hours and EID recording time are ramped like the other hours saved (9.3 Ramp).
  const hc = compare("ranchD", (x) => (x.vf.healthCheckHoursCut = 100), ["laborCut"]);
  closeAll(hc.ramped.hours.saved.slice(0, 5), [0, 150, 240, 300, 300]);
  const rec = compare("ranchC", (x) => (x.eid.recordingHoursToday = 40), []);
  closeAll(rec.ramped.hours.saved.slice(0, 5), [0, 20, 32, 40, 40]);
});

test("Synthetic Ranch A with startYear 2: install hours in entry 2 fall in year 2 (K₂); benefits start in year 3 (9.7)", () => {
  const r = run("ranchA", (a) => {
    a.startYear = 2;
    a.labor.added[0].hours = [0, 0, 30, 0];
  });
  assert.deepEqual(r.hours.freed.slice(0, 4), [0, 0, -30, 84]);
  close(r.K[2], -600, 1e-9);
  closeAll(r.B.slice(0, 3), [0, 0, 0]);
  assert.ok(r.B[3] > 0);
  // The install entered for year 0 is before the module starts: a validation error.
  const early = ex("ranchA", (a) => (a.startYear = 2));
  assert.deepEqual(validate(early).map((e) => e.path), ["labor.added.0.hours"]);
});

test("Synthetic Ranch A with its install done by a paid hand, its rate and load not yet entered: 'Pay rate' and 'Payroll load' (9.7)", () => {
  const a = ex("ranchA", (x) => (x.labor.added[0].doneBy = "paid"));
  assert.deepEqual(validate(a).map((e) => [e.label, e.message]), [
    ["Pay rate", "Pay rate (install): enter it, because a paid hand does these hours."],
    ["Payroll load", "Payroll load (install): enter it (0% if none), because a paid hand does these hours."],
  ]);
  // Entered: the 30 hours are a year-0 cost and no longer lower the hours freed.
  const paid = run("ranchA", (x) => Object.assign(x.labor.added[0], { doneBy: "paid", paidRate: 20, loadPct: 0 }));
  closeAll(line(paid, "added:0").series, [600, ...repeat(0, 10)]);
  assert.equal(paid.hours.freed[0], 0);
});

// ---------------------------------------------------------------- virtual fence

test("handling hours: Ranch B 372 h a year; Ranch D 172 h in year 1 and 88 h after (Appendix A, 9.3 Labor)", () => {
  const b = run("ranchB");
  closeAll(b.hours.handling, [0, ...repeat(372, 7)]); // 240 collar on and off + 48 refits + 84 training
  closeAll(line(b, "handling").series, [0, ...repeat(372 * 25, 7)]);
  const d = run("ranchD");
  closeAll(d.hours.handling, [0, 172, 88, 88, 88, 88, 88, 88]);
  closeAll(line(d, "handling").series, [0, 4300, ...repeat(2200, 6)]);
  const a = example("ranchD");
  closeAll(handlingHours(a, herdOf(a, 7), 0, 7), [0, 172, 88, 88, 88, 88, 88, 88]);
  // Events count enrolled head: 300 of the 400 cows enrolled gives a 30 h fit check (300 × 1.5 min × 4 ÷ 60).
  closeAll(run("ranchD", (x) => (x.enrolled.cows.head = 300)).hours.handling, [0, 162, ...repeat(78, 6)]);
  // A paid hand's hours cost pay rate × (1 + payroll load): 372 h × $25 × 1.1.
  closeAll(line(run("ranchB", (x) => (x.labor.handling.loadPct = 0.1)), "handling").series, [0, ...repeat(10230, 7)], 1e-6);
});

test("a paid handling hand needs a pay rate and a payroll load (9.2): each blank one is an error naming 'Handling labor'", () => {
  const RATE = { path: "labor.handling.paidRate", label: "Pay rate", message: "Pay rate (Handling labor): enter it, because a paid hand does the handling." };
  const LOAD = { path: "labor.handling.loadPct", label: "Payroll load",
    message: "Payroll load (Handling labor): enter it (0% if none), because a paid hand does the handling." };
  for (const id of ["ranchB", "ranchD"]) {
    const a = example(id);
    assert.deepEqual(validate(setInput(a, "labor.handling.paidRate", null)), [RATE]);
    assert.deepEqual(validate(setInput(a, "labor.handling.loadPct", null)), [LOAD]);
    const both = setInput(setInput(a, "labor.handling.paidRate", null), "labor.handling.loadPct", null);
    assert.deepEqual(validate(both), [RATE, LOAD]);
    assert.deepEqual(validate(setInput(both, "labor.handling.doneBy", "unpaid")), []);
  }
});

test("Synthetic Ranch D with startYear 2: fence avoided in year 2, training in year 3, handling in years 3–7; early entries are errors (9.7)", () => {
  const late = (fence, trainingDays) => ex("ranchD", (a) => {
    a.startYear = 2;
    a.vf.fence.k = fence;
    a.labor.handling.trainingDays = trainingDays;
  });
  const a = late(2, [0, 0, 0, 7, 0]);
  assert.deepEqual(validate(a), []);
  const r = analyze(a);
  closeAll(r.hours.handling, [0, 0, 0, 172, 88, 88, 88, 88]);
  const cost = 15100 * a.vf.fence.miles; // $213,546
  closeAll(line(r, "fence").series.slice(0, 3), [0, 0, cost]);
  closeAll(r.B.slice(0, 3), [0, 0, cost]); // no benefit other than the avoided fence before year 3
  assert.ok(line(r, "laborCut").series.slice(0, 3).every((x) => x === 0));
  assert.deepEqual(validate(late(2, [0, 7, 0])).map((e) => [e.path, e.label, e.message]), [["labor.handling.trainingDays", "Training days",
    "Training days: year 1 comes before year 3, the module's first operating year, so it cannot have training days."]]);
  // Year s itself is not an operating year either (9.2: "up to" the start year).
  assert.deepEqual(validate(late(2, [0, 0, 7, 0])).map((e) => e.message),
    ["Training days: year 2 comes before year 3, the module's first operating year, so it cannot have training days."]);
  assert.deepEqual(validate(late(0, [0, 0, 0, 7, 0])).map((e) => [e.path, e.message]),
    [["vf.fence.k", "Fence build year: cannot be before year 2, when the module starts."]]);
});

test("Synthetic Ranch D's fence: $213,546 avoided in year 0, $10,677 upkeep a year, $153,753 lost residual at year 7 (Appendix A)", () => {
  const f = line(run("ranchD"), "fence").series;
  const cost = 15100 * 2 * Math.sqrt(2000 / 640) * 4;
  close(cost, 213546, 1);
  closeAll(f, [cost, ...repeat(0.05 * cost, 6), 0.05 * cost - (18 / 25) * cost], 1e-6);
  close((18 / 25) * cost, 153753, 1);
});

test("row 2: zero cattle under a 36-month commitment; −$134,230, −$4,500 without it", () => {
  const zero = (commit) => ex("ranchB", (a) => {
    a.classes.yearlings.head = 0;
    a.enrolled.yearlings.head = 0;
    if (commit) Object.assign(a.costs.subscription, { minQty: 6600, commitYears: 3 });
  });
  const r = analyze(zero(true));
  assert.deepEqual(validate(zero(true)), []);
  closeAll(r.B, repeat(0, 8)); // the fence too
  closeAll(r.hours.handling, repeat(0, 8));
  closeAll(line(r, "subscription").series, [46200, 46200, 46200, 0, 0, 0, 0, 0]);
  close(r.cashNPV, -134230, 1);
  assert.deepEqual(texts(r, "noCattle"), [1, 2, 3, 4, 5, 6, 7].map((t) => `No cattle in year ${t}: benefits not counted.`));
  assert.equal(r.costPerHeadMonth, null);
  assert.equal(tiles(zero(true), r).find((t) => t.label.startsWith("Cost per head-month")).value, "n/a");
  assert.match(verdictSentence(zero(true), r), / It does not pay\./);
  close(analyze(zero(false)).cashNPV, -4500, 1);
});

test("row 8: freed time absorbed, then 500 or 0 gathering hours cut: identical cash, 500 h of capacity, no error", () => {
  const absorbed = (hours) => ex("ranchB", (a) => {
    a.labor.freedTimeUse = "absorbed";
    a.vf.gatherHoursCut = hours;
  });
  assert.deepEqual(validate(absorbed(0)), []); // unitsCut 200 stays as entered and is not checked
  const [five, none] = [analyze(absorbed(500)), analyze(absorbed(0))];
  close(five.cashNPV, none.cashNPV, 1e-9);
  closeAll(five.hours.freed, [0, ...repeat(500, 7)]);
  assert.equal(absorbed(500).labor.cut.unitsCut, 200);
  close(five.economicNPV, five.cashNPV, 1e-9); // Ranch B enters no owner rate
  assert.deepEqual(texts(five, "absorbed"), ["Freed time is absorbed, so no cash labor saving is counted."]);
});

test("row 16: a drought year under the commitment bills the committed $46,200 and counts no benefits", () => {
  const head = [1200, 1200, 1200, 0, 1200];
  const r = run("ranchB", (a) => {
    a.classes.yearlings.head = head;
    a.enrolled.yearlings.head = head;
    Object.assign(a.costs.subscription, { minQty: 6600, commitYears: 3 });
  });
  closeAll(line(r, "subscription").series, [...repeat(46200, 7), 0]); // season 3 billed in year 2 at the minimum
  assert.equal(r.B[3], 0);
  assert.equal(r.hours.handling[3], 0);
  assert.deepEqual(texts(r, "noCattle"), ["No cattle in year 3: benefits not counted."]);
  closeAll(run("ranchB", (a) => { a.classes.yearlings.head = head; a.enrolled.yearlings.head = head; }).lines.find((l) => l.id === "subscription").series,
    [46200, 46200, 0, 46200, 46200, 46200, 46200, 0]); // $0 without the commitment
});

test("row 17: Ranch B with the 6-wire high-tensile fence has no net outlay in year 0, then a negative cumulative", () => {
  const r = run("ranchB", (a) => Object.assign(a.vf.fence, { F: 15100, Lf: 25, m: 0.05 }));
  close(r.cashNPV, -194901, 1);
  assert.equal(paybackText(r.payback), "none within 7 years (no net outlay in year 0; cumulative negative from year 2)");
  assert.equal(irrText(r.irr), "n/a: no net outlay in year 0");
});

test("row 22: land tenure on Ranch B; a lease that ends at T", () => {
  const leased = (unit) => run("ranchB", (a) => (a.settings.landUnits = [{ id: "u1", kind: "leased", share: 1, ...unit }]));
  // (a) A lease of 7 years or more, landlord provides the fence: the whole avoided-fence stream, with its straight-line
  // residual (−$6,880 in year 7), is the landlord's and listed under "Received by others" (9.3 Fence).
  for (const leaseYears of [7, 8]) {
    const landlord = leased({ leaseYears, fenceBuiltBy: "landlord" });
    closeAll(line(landlord, "fence").series, repeat(0, 8));
    close(landlord.cashNPV, -294088, 1);
    assert.deepEqual(landlord.receivedByOthers.map((o) => o.lineId), ["fence"]);
    closeAll(landlord.receivedByOthers[0].series, [34400, 1720, 1720, 1720, 36120, 1720, 1720, -6880], 1e-9);
    close(landlord.receivedByOthers[0].pv, 64557.53, 0.01);
  }
  // A landlord's fence on a lease that ends before T stops at the lease end, with no purchase in year T' or later and
  // its straight-line residual at T' (0 here, at the end of the fence's 4-year life); answering that the saving is the
  // operator's gives the same cash as the tenant-built fence.
  const four = leased({ leaseYears: 4, fenceBuiltBy: "landlord" });
  closeAll(four.receivedByOthers.find((o) => o.lineId === "fence").series, [34400, 1720, 1720, 1720, 1720, 0, 0, 0], 1e-9);
  close(four.receivedByOthers.find((o) => o.lineId === "fence").pv, 40226.00, 0.01);
  close(run("ranchB", (a) => {
    a.settings.landUnits = [{ id: "u1", kind: "leased", share: 1, leaseYears: 4, fenceBuiltBy: "landlord" }];
    a.benefitShares = { fence: 1 };
  }).cashNPV, leased({ leaseYears: 4 }).cashNPV, 1e-6);
  const built4 = run("ranchB", (a) => {
    a.vf.fence.k = 4;
    a.settings.landUnits = [{ id: "u1", kind: "leased", share: 1, leaseYears: 4, fenceBuiltBy: "landlord" }];
  });
  assert.equal(built4.receivedByOthers.some((o) => o.lineId === "fence"), false); // built in year T': nothing
  const three = leased({ leaseYears: 3 });
  closeAll(line(three, "fence").series, [34400, 1720, 1720, 1720, 0, 0, 0, 0]);
  closeAll(line(three, "laborCut").series, [0, 5000, 5000, 5000, 0, 0, 0, 0]);
  closeAll(three.C, run("ranchB").C);
  close(three.cashNPV, -268999, 1);
  close(leased({ leaseYears: 3, renewalExpected: true }).cashNPV, -229531, 1);
  // Ending exactly at T: the lease-end rule, so year 7 has its upkeep and no residual deducted (9.7).
  const atT = leased({ leaseYears: 7 });
  close(line(atT, "fence").series[7], 1720, 1e-9);
  close(atT.cashNPV, -224175, 1);
});

test("row 47(c): Ranch D's tenant builds and the landlord maintains: the fence loses its upkeep", () => {
  const r = run("ranchD", (a) => (a.settings.landUnits = [{ id: "u1", kind: "leased", leaseYears: 10, share: 1, fenceBuiltBy: "tenant", fenceMaintainedBy: "landlord" }]));
  close(r.cashNPV, -67332, 1);
  close(r.cashNPV, -9789.25 - 10677.31 * factor(0.07, [1, 2, 3, 4, 5, 6, 7]), 0.5);
});

test("the pricing model picks the lines: leased collars with a subscription, or purchased collars with a service fee (9.4)", () => {
  const priced = (pricing) => ex("ranchB", (a) => {
    a.vf.pricing = pricing;
    a.costs.collars = { unitCost: 150, lifeYears: 5 };
    a.costs.serviceFee = { unitCost: 30 };
  });
  const ids = (a) => buildLines(a).filter((l) => l.kind === "cost").map((l) => l.id);
  assert.deepEqual(ids(priced("leased")), ["subscription", "infrastructure", "collarLoss", "handling"]);
  assert.deepEqual(ids(priced("purchased")), ["infrastructure", "collars", "serviceFee", "collarLoss", "handling"]);
  // Purchased collars come from enrolled head and are bought at year 0 and again at year 5; the fee is billed in advance.
  const r = analyze(priced("purchased"));
  closeAll(line(r, "collars").series, [180000, 0, 0, 0, 0, 180000, 0, 0]);
  closeAll(line(r, "serviceFee").series, [...repeat(36000, 7), 0]);
});

test("validation checks the cost lines as the module builds them, named by their labels (9.2, 9.4)", () => {
  const purchased = (collars) => ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { unitCost: 150, ...collars };
    a.costs.serviceFee = { unitCost: 30 };
  });
  const messages = (a) => validate(a).map((e) => `${e.path}: ${e.message}`);
  assert.deepEqual(messages(purchased({ lifeYears: 2.5 })), ["costs.collars.lifeYears: Enter a whole number of years, 1 or more."]);
  assert.deepEqual(messages(purchased({ lifeYears: 5, residual: { mode: "pctOfCost", pct: 1.5 } })),
    ["costs.collars.residual: Residual (Purchased collars): cannot be more than 100% of the purchase cost."]);
  // An amount residual is checked against the cost of the collars bought for the enrolled head: 1,200 × $150.
  assert.deepEqual(messages(purchased({ lifeYears: 5, residual: { mode: "amount", dollars: 1000 } })), []);
  assert.deepEqual(messages(purchased({ lifeYears: 5, residual: { mode: "amount", dollars: 200000 } })),
    ["costs.collars.residual: Residual (Purchased collars): $200,000 is more than the $180,000 that the purchases it values cost."]);
  // A collars line stored on a leased-collar analysis is left out by the pricing model, so it is not checked.
  assert.deepEqual(messages(ex("ranchB", (a) => (a.costs.collars = { unitCost: 150, lifeYears: 2.5 }))), []);
  // Water monitors count water.monitors (10 × $1,490); EID cow tags count the cows (300 × $3.14).
  assert.deepEqual(messages(ex("ranchA", (a) => (a.costs.monitors.residual = { mode: "amount", dollars: 1000 }))), []);
  assert.deepEqual(messages(ex("ranchA", (a) => (a.costs.monitors.residual = { mode: "amount", dollars: 15000 }))),
    ["costs.monitors.residual: Residual (Monitors): $15,000 is more than the $14,900 that the purchases it values cost."]);
  assert.deepEqual(messages(ex("ranchC", (a) => (a.costs.cowTags.residual = { mode: "amount", dollars: 100 }))), []);
  // Module lines are named by their labels.
  assert.deepEqual(messages(ex("ranchB", (a) => (a.costs.subscription.commitYears = 2.5))),
    ["costs.subscription.commitYears: Commit years (Subscription): enter a whole number of years."]);
  assert.deepEqual(messages(ex("ranchB", (a) => (a.costs.infrastructure.startYear = 9))),
    ["costs.infrastructure.startYear: Start year (Infrastructure): must be before year 7, the end of the horizon."]);
});

test("a cost line's inputs are what it multiplies: months only on a per-head-month line (9.2 paths)", () => {
  const b = ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { unitCost: 150, lifeYears: 5 };
    a.costs.serviceFee = { unitCost: 30 };
  });
  const paths = (a, id) => buildLines(a).find((l) => l.id === id).paths;
  assert.deepEqual(paths(b, "collars"), ["costs.collars.unitCost", "enrolled.yearlings.head"]);
  assert.deepEqual(paths(b, "serviceFee"), ["costs.serviceFee.unitCost", "enrolled.yearlings.head"]);
  assert.deepEqual(paths(example("ranchB"), "subscription"), ["costs.subscription.unitCost", "enrolled.yearlings.head", "enrolled.yearlings.months"]);
});

test("row 24: a collar repair percentage and a collar loss each lower cash NPV by exactly their own line's PV", () => {
  const purchased = (f) => ex("ranchB", (a) => {
    a.vf.pricing = "purchased";
    a.costs.collars = { unitCost: 150, lifeYears: 5, repairPct: 0 };
    a.costs.serviceFee = { unitCost: 30 };
    f?.(a);
  });
  const base = analyze(purchased());
  const repaired = analyze(purchased((a) => (a.costs.collars.repairPct = 0.05)));
  const repairPV = npv(0.07, [0, ...repeat(9000, 7)]); // 5% of 1,200 × $150 in each year of service
  close(line(repaired, "collars").pv - line(base, "collars").pv, repairPV, 1e-6);
  close(base.cashNPV - repaired.cashNPV, repairPV, 1e-6);
  const lost = analyze(purchased((a) => (a.vf.collarLoss = { pctPerYear: 0.05, chargePerCollar: 150 })));
  closeAll(line(lost, "collarLoss").series, [0, ...repeat(9000, 7)]); // 60 collars × $150, billed in arrears
  close(base.cashNPV - lost.cashNPV, line(lost, "collarLoss").pv, 1e-6);
});

test("collar loss at 7% on Ranch B: 84 collars × $150 a year in arrears, $67,905 lower (row 25's arithmetic)", () => {
  const r = run("ranchB", (a) => (a.vf.collarLoss = { pctPerYear: 0.07, chargePerCollar: 150 }));
  closeAll(line(r, "collarLoss").series, [0, ...repeat(12600, 7)]);
  close(-229531 - r.cashNPV, 67905, 1);
  // Ranch B as loaded: a blank charge on a share of 0 is not listed as "Quote required".
  assert.ok(!run("ranchB").notices.some((n) => n.type === "quoteRequired"));
});

test("health-check hours are capacity, and support paid hours cut only with a validated alert (9.3 Labor)", () => {
  const checks = (validatedAlert, unitsCut) => ex("ranchB", (a) => {
    Object.assign(a.vf, { healthCheckHoursCut: 100, validatedAlert });
    a.labor.cut.unitsCut = unitsCut;
  });
  assert.deepEqual(validate(checks(false, 300)).map((e) => e.message),
    ["Hired moving and gathering hours cut: the paid hours cut in year 1 (300 h) are more than the hours saved that can support them (200 h)."]);
  assert.deepEqual(validate(checks(true, 300)), []);
  const r = analyze(checks(false, 200));
  closeAll(r.hours.freed, [0, ...repeat(100, 7)]); // 300 saved − 200 paid
  close(r.cashNPV, -229531, 1);
});

test("the module's notices: gathering hours today left blank asks for it, on Ranches B and D (row 49)", () => {
  const prompt = "Enter moving and gathering hours today to check the claim on moving and gathering hours.";
  assert.deepEqual(texts(run("ranchB"), "baselineBlank"), [prompt]);
  assert.deepEqual(texts(run("ranchD"), "baselineBlank"), [prompt]);
  // Entered, the claim is checked against it.
  const r = run("ranchB", (a) => (a.vf.gatherHoursToday = 150));
  assert.deepEqual(texts(r, "poolClamp")[0],
    "The claim on moving and gathering hours is above the baseline in year 1 (200 against 150), so it is counted only up to the baseline.");
});

test("row 49's verdict sentence and Cash NPV tile on Ranch B as loaded, before the drivers join (9.5 items 1, 2)", () => {
  const a = example("ranchB");
  const r = analyze(a);
  assert.equal(verdictSentence(a, r),
    "Over 7 years at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $230,000 more than it saves in cash. It does not pay. Cash benefits would need to rise about 3.5-fold.");
  assert.equal(tiles(a, r)[0].value, "about −$230,000");
  assert.equal(r.hoursFreedPerYear, 0);
});

test("Synthetic Ranch A with T 1: the verdict's singular year and the payback tile (9.7 Page text)", () => {
  const a = ex("ranchA", (x) => (x.settings.T = 1));
  const r = analyze(a);
  close(r.cashNPV, -2330.12, 0.01);
  assert.ok(verdictSentence(a, r).startsWith(
    "Over 1 year at the example's 7% real rate (an assumption, not a recommendation), before tax, this costs about $2,000 more than it saves in cash."));
  assert.equal(tiles(a, r).find((t) => t.label.startsWith("Cash payback")).value, "none within 1 year");
});

// ---------------------------------------------------------------- EID and scale (B4a)

test("the EID tag lines: cow tags at year 0, calf tags and retags each season in arrears, at the tag price (9.3)", () => {
  const r = run("ranchC");
  closeAll(line(r, "cowTags").series, [942, ...repeat(0, 7)]);
  closeAll(line(r, "calfTags").series, [0, ...repeat(285 * 3.14, 7)]);
  closeAll(line(r, "retags").series, [0, ...repeat(300 * 0.015 * 3.14, 7)]);
  closeAll(line(r, "software").series, [...repeat(360, 7), 0]);
  closeAll(r.R, [...repeat(0, 7), 0.15 * (1919 + 1830 + 800)]);
});

test("dosing: (300 × 2 + 285 × 1) × $0.45 = $398.25 a year on Ranch C (9.3)", () => {
  closeAll(line(run("ranchC"), "dosing").series, [0, ...repeat(398.25, 7)]);
  // Left blank: 0 and listed as not entered.
  const blank = run("ranchC", (a) => (a.eid.dosing.perApplication = null));
  closeAll(line(blank, "dosing").series, repeat(0, 8));
  assert.ok(texts(blank, "notEntered").includes("Dosing savings: not entered, not counted"));
});

test("the net program premium: head in program × (sale cwt × premium − verification fee), from calves sold (9.3)", () => {
  const r = run("ranchC", (a) => (a.eid.premium = { saleCwt: 5.5, premiumPerCwt: 2.25, verificationFee: 0.9 }));
  closeAll(line(r, "premium").series, [0, ...repeat(240 * (5.5 * 2.25 - 0.9), 7)]);
  // Ranch C enters none: 0, listed as not entered.
  assert.ok(texts(run("ranchC"), "notEntered").includes("Net program premium: not entered, not counted"));
  // A verification fee entered alone counts, with the blank sale weight and premium as 0 (9.5 item 7), so the line is
  // not listed as left out: 240 × −$0.90 a year. A fee of 0 leaves it at 0 again, listed.
  const fee = run("ranchC", (a) => (a.eid.premium = { verificationFee: 0.9 }));
  closeAll(line(fee, "premium").series, [0, ...repeat(-216, 7)]);
  assert.ok(!texts(fee, "notEntered").includes("Net program premium: not entered, not counted"));
  const none = run("ranchC", (a) => (a.eid.premium = { saleCwt: 5.5, verificationFee: 0 }));
  assert.ok(texts(none, "notEntered").includes("Net program premium: not entered, not counted"));
});

test("dosing applications typed as 0 are entered: the line counts 0 and is not listed; cleared, it is listed (9.5 item 4)", () => {
  const zero = setInput(setInput(example("ranchC"), "eid.dosing.applications.cows", 0), "eid.dosing.applications.calvesBorn", 0);
  closeAll(line(analyze(zero), "dosing").series, repeat(0, 8));
  assert.ok(!texts(analyze(zero), "notEntered").includes("Dosing savings: not entered, not counted"));
  const cleared = setInput(setInput(example("ranchC"), "eid.dosing.applications.cows", null), "eid.dosing.applications.calvesBorn", null);
  assert.ok(texts(analyze(cleared), "notEntered").includes("Dosing savings: not entered, not counted"));
});

test("the tag lines keep their 9.3 timing whatever the stored line holds: cow tags bought once, calf tags in arrears", () => {
  for (const f of [(a) => delete a.costs.cowTags.timing, (a) => (a.costs.cowTags = { timing: "annual", billing: "advance" }),
    (a) => (a.costs.calfTags.billing = "advance"), (a) => delete a.costs.calfTags.timing, (a) => (a.costs.retags = {})]) {
    const r = run("ranchC", f);
    closeAll(line(r, "cowTags").series, [942, 0, 0, 0, 0, 0, 0, 0]);
    close(r.cashNPV, -9895, 1);
  }
});

test("free tags on Ranch C: 300 in year 0 raise cash NPV by exactly $942; 285 more in years 1–7 by a further $4,822.88 (B4a)", () => {
  const base = run("ranchC").cashNPV;
  const year0 = run("ranchC", (a) => (a.eid.freeTags = { qty: 300, years: [0] }));
  close(year0.cashNPV - base, 942, 1e-6);
  close(year0.cashNPV, -8953, 1);
  const all = run("ranchC", (a) => (a.eid.freeTags = { qty: [300, 285], years: [0, 1, 2, 3, 4, 5, 6, 7] }));
  close(all.cashNPV - year0.cashNPV, 4822.88, 0.01);
  close(all.cashNPV, -4130, 1);
  closeAll(line(all, "calfTags").series, repeat(0, 8));
  closeAll(line(all, "retags").series, [0, ...repeat(4.5 * 3.14, 7)]); // the 285 free tags are all used on calf tags
});

test("free tags are never more than a year's tags, go to cow, calf and retags in that order, and do not carry over (9.3)", () => {
  const base = run("ranchC");
  // 1,000 free in year 0: only the 300 cow tags billed that year are freed; the rest is lost, not carried to year 1.
  const many = run("ranchC", (a) => (a.eid.freeTags = { qty: 1000, years: [0] }));
  close(many.cashNPV - base.cashNPV, 942, 1e-6);
  closeAll(line(many, "calfTags").series, line(base, "calfTags").series);
  // 287 free in year 1: the 285 calf tags, then 2 of the 4.5 retags.
  const some = run("ranchC", (a) => (a.eid.freeTags = { qty: 287, years: [1] }));
  close(line(some, "calfTags").series[1], 0, 1e-9);
  close(line(some, "retags").series[1], 2.5 * 3.14, 1e-9);
  close(line(some, "retags").series[2], 4.5 * 3.14, 1e-9);
  assert.ok(line(some, "cowTags").series.every((x, t) => x === line(base, "cowTags").series[t]));
});

test("row 36: the EID rule answered yes for the cows changes no line and shows the pending notice; no again removes it", () => {
  const a = example("ranchC");
  assert.deepEqual(eidRuleClasses(a), ["cows", "calvesBorn"]); // calves sold are a sale flow
  const yes = run("ranchC", (x) => (x.eid.ruleApplies.cows = true));
  close(yes.cashNPV, -9895, 1);
  closeAll(yes.C, run("ranchC").C);
  assert.deepEqual(texts(yes, "eidRulePending"), [EID_RULE_NOTICE]);
  assert.equal(EID_RULE_NOTICE, "Compliance treatment is pending verification of the rule's current status. All tags are counted as project costs here, which may understate the case for EID if your tags are required anyway. Check with your state veterinarian.");
  assert.deepEqual(texts(run("ranchC", (x) => (x.eid.ruleApplies.cows = false)), "eidRulePending"), []);
  // The classes asked follow the head: a class with no head in any year is not asked.
  assert.deepEqual(eidRuleClasses({ ...a, classes: { cows: { head: 300 }, bulls: { head: 0 }, calvesBorn: { head: [0, 285] } } }), ["cows", "calvesBorn"]);
});

test("the EID lines are not split by land unit, and an absorbed labor answer keeps the weighings unpaid (9.3)", () => {
  const r = run("ranchC", (a) => (a.settings.landUnits = [{ id: "u1", kind: "leased", leaseYears: 2, share: 1 }]));
  close(r.cashNPV, -9895, 1);
  assert.deepEqual(texts(run("ranchC"), "absorbed"), ["Freed time is absorbed, so no cash labor saving is counted."]);
});
