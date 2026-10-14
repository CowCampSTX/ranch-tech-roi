// Run: node --test tests/roi.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, FIELDS, cashFlows, npv, irr, payback, analyze, tornado, breakEven, grid } from "../roi.js";

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

// A small hand-checkable case: $1,000 upfront, $100/yr running cost, $500/yr benefit, 3 years.
const SIMPLE = {
  head: 10, years: 3, discountRate: 10,
  hardwarePerHead: 50, fixedCost: 500,
  subscriptionPerHead: 10, maintenancePct: 0, replacementPct: 0,
  laborHoursPerWeek: 0, wage: 0, deathLossPts: 0, valuePerHead: 0,
  gainLbsPerHead: 0, pricePerLb: 0, otherSavings: 500, year1Realized: 100,
};

test("cash flows match a hand calculation", () => {
  const { rows, upfront, yearlyCost, benefitTotal } = cashFlows(SIMPLE);
  assert.equal(upfront, 1000);
  assert.equal(yearlyCost, 100);
  assert.equal(benefitTotal, 500);
  assert.deepEqual(rows.map((r) => r.net), [-1000, 400, 400, 400]);
  assert.deepEqual(rows.map((r) => r.cumulative), [-1000, -600, -200, 200]);
});

test("NPV, IRR and payback", () => {
  const nets = [-1000, 400, 400, 400];
  close(npv(0.1, nets), -1000 + 400 / 1.1 + 400 / 1.21 + 400 / 1.331);   // -5.26
  close(npv(irr(nets), nets), 0, 1e-6);
  close(irr(nets), 0.0970, 0.0005);
  close(payback(cashFlows(SIMPLE).rows), 2.5);                         // -200 left after year 2, +400 in year 3
});

test("payback and IRR are null when it never pays", () => {
  const a = analyze({ ...SIMPLE, otherSavings: 50 });
  assert.equal(a.payback, null);
  assert.equal(a.irr, null);
  assert.ok(a.npv < 0);
});

test("year 1 counts only the realized share, capped at 100%", () => {
  assert.equal(cashFlows({ ...SIMPLE, year1Realized: 50 }).rows[1].benefit, 250);
  assert.equal(cashFlows({ ...SIMPLE, year1Realized: 150 }).rows[1].benefit, 500);
  assert.equal(cashFlows({ ...SIMPLE, year1Realized: 50 }).rows[2].benefit, 500);
});

test("each benefit line uses its own formula", () => {
  const b = cashFlows({ ...SIMPLE, laborHoursPerWeek: 2, wage: 20, deathLossPts: 1, valuePerHead: 2000,
    gainLbsPerHead: 10, pricePerLb: 2, otherSavings: 0 }).fullBenefit;
  assert.equal(b.labor, 2 * 52 * 20);
  assert.equal(b.deathLoss, 10 * 0.01 * 2000);
  assert.equal(b.gain, 10 * 10 * 2);
});

test("break-even finds the value where NPV is zero", () => {
  const be = breakEven(SIMPLE, "otherSavings");
  close(analyze({ ...SIMPLE, otherSavings: be.value }).npv, 0, 0.5);
  const fixed = breakEven(SIMPLE, "fixedCost").value;                    // a bit under the $500 entered
  assert.ok(fixed > 490 && fixed < 500, String(fixed));
  assert.equal(breakEven({ ...SIMPLE, otherSavings: 50000 }, "wage").none, "positive");
});

test("tornado is sorted by spread and skips inputs set to zero", () => {
  const t = tornado(PRESETS["Halter virtual fencing"]);
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].spread >= t[i].spread);
  assert.ok(!tornado(SIMPLE).some((r) => r.key === "wage"));
});

test("two-way grid returns the base NPV at the base point", () => {
  const p = PRESETS["EID tags and scale"];
  const g = grid(p, "head", [p.head], "pricePerLb", [p.pricePerLb]);
  close(g[0][0], analyze(p).npv);
});

test("every preset fills every input", () => {
  for (const [name, p] of Object.entries(PRESETS))
    for (const [, k] of FIELDS) assert.equal(typeof p[k], "number", `${name}.${k}`);
});
