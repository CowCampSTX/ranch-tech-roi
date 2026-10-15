// Tests of the synthetic examples' values and provenance (examples.js): docs/audit/phase1-spec.md 9.7 Provenance,
// F10 criterion 2, 9.5 items 4, 5 and 7, and Appendix A. Their pinned results are in modules.test.mjs.
// Run: node --test tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, validate } from "../roi.js";
import { EXAMPLE_IDS, EXAMPLE_NAMES, VENDOR_FILLS, example, valuePaths, vendorFill } from "../examples.js";
import { setInput, useVendorPrice } from "../state.js";
import { EXAMPLE_BANNERS, priceLabel, noticeText } from "../text.js";

const examples = EXAMPLE_IDS.map((id) => [id, example(id)]);
const MONEY = /(\.unitCost|\.paidRate|\.salary|^vf\.fence\.F|^eid\.tagPrice|\.chargePerCollar|\.valuePerHead|\.valueOfGain|^settings\.oppCostPerHour|^water\.variableCostPerMile)$/;
const PUB = /^((\d{1,2} )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}|undated; checked \d{1,2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4})$/;
const CHECKED = "undated; checked 15 Oct 2026";
// The price inputs of 9.4 intro: a cost line's unit cost, the collar-loss charge and the tag price.
const pricePaths = (a) => [...Object.keys(a.costs ?? {}).map((id) => `costs.${id}.unitCost`),
  ...(a.module === "vf" ? ["vf.collarLoss.chargePerCollar"] : []), ...(a.module === "eid" ? ["eid.tagPrice"] : [])];

test("the four examples, their names and banners: synthetic, made up, and validated as loaded (9.5 item 5)", () => {
  assert.deepEqual(EXAMPLE_IDS, ["ranchA", "ranchB", "ranchC", "ranchD"]);
  assert.deepEqual(examples.map(([, a]) => a.module), ["water", "vf", "eid", "vf"]);
  for (const [id, a] of examples) {
    assert.equal(a.example, id);
    assert.match(EXAMPLE_NAMES[id], /^Synthetic Ranch [A-D]$/);
    assert.deepEqual(validate(a), [], id);
    assert.deepEqual([a.settings.discountRate, a.settings.paybackTarget, a.settings.ownAnalysis, a.settings.rateReviewed], [0.07, 5, false, false], id);
    assert.match(EXAMPLE_BANNERS[id], /Made-up numbers for demonstration, not any real operation's data\./);
  }
  assert.equal(EXAMPLE_BANNERS.ranchA, "Synthetic example ranch. Made-up numbers for demonstration, not any real operation's data.");
  assert.equal(EXAMPLE_BANNERS.ranchD, "Good-fit synthetic example: conditions where this technology is most likely to pay. Made-up numbers for demonstration, not any real operation's data. Check whether your operation matches.");
  // Herd sizes as the page lists them: 900 cows, 1,200 yearlings, 300 cows, 400 cows.
  assert.deepEqual(examples.map(([, a]) => Object.values(a.classes)[0].head), [900, 1200, 300, 400]);
});

test("each example() is a fresh copy: a change to one never reaches another", () => {
  const a = example("ranchB");
  a.settings.landUnits[0].kind = "leased";
  a.prov["vf.fence.F"].cls = "D";
  const b = example("ranchB");
  assert.equal(b.settings.landUnits[0].kind, "owned");
  assert.equal(b.prov["vf.fence.F"].cls, "B");
  assert.equal(example("ranchD").settings.landUnits[0].kind, "owned");
});

test("every example value has a prov record with cls and src, and every record names a value (9.7 Provenance, F10 2)", () => {
  for (const [id, a] of examples) {
    assert.deepEqual(Object.keys(a.prov).sort(), valuePaths(a).sort(), id);
    for (const [path, p] of Object.entries(a.prov)) {
      assert.ok(["A", "B", "C", "D", "E"].includes(p.cls), `${id} ${path}`);
      assert.equal(typeof p.src, "string", `${id} ${path}`);
      assert.ok(p.src.length > 0);
    }
  }
  // The rate is the examples' assumption, not a recommendation (9.5 item 5).
  for (const [, a] of examples) {
    assert.deepEqual(a.prov["settings.discountRate"], { cls: "E", src: "The synthetic examples' real rate: an example assumption, not a recommendation" });
  }
  // Labels, names and ids are not values; a per-year array is one value, and so is a list of classes; the herd's head
  // counts, a line's timing and basis, and the fence's land unit are values; each ramp entry from ramp[1] is its own
  // value, as a version 1 link records "ramp.1" (9.5 item 8).
  const a = example("ranchA");
  assert.ok(a.prov["costs.batteries.unitCost"]);
  assert.ok(!a.prov["costs.batteries.unitCost.4"]);
  assert.ok(!a.prov["water.blocks.0.name"] && !a.prov["settings.landUnits.0.id"] && !a.prov["labor.added.0.label"]);
  assert.ok(a.prov["classes.cows.head"] && a.prov["classes.cows.valuePerHead"] && a.prov["costs.monitors.timing"]);
  assert.deepEqual(Object.keys(a.prov).filter((k) => k.startsWith("ramp")), ["ramp.1", "ramp.2", "ramp.3"]);
  const c = example("ranchC");
  assert.ok(c.prov["classes.calvesSold.head"] && c.prov["costs.cowTags.classes"] && c.prov["costs.software.timing"]);
  assert.ok(!c.prov["costs.cowTags.classes.0"] && c.prov["labor.handling.events.1.classes"]);
  const b = example("ranchB");
  assert.ok(b.prov["costs.subscription.basis"] && b.prov["vf.fence.landUnitId"]);
});

test("every record that is not a made-up [E] value is pinned: class and source, by path (Appendix A, section 11)", () => {
  const sourced = (a) => Object.fromEntries(Object.entries(a.prov)
    .filter(([, p]) => p.cls !== "E" || p.note || p.src !== `${EXAMPLE_NAMES[a.example]}: made-up example value`)
    .map(([k, p]) => [k, `${p.cls} ${p.src}${p.reported ? " (reported)" : ""}`]));
  const RATE = "E The synthetic examples' real rate: an example assumption, not a recommendation";
  const ALLTEX = "C All-Tex dealer flyer", DTN = "C DTN (reported)", JEFFERS = "C Jeffers retail listing";
  const IOWA = "B Iowa State University Extension, FM-1855 Estimated Costs for Livestock Fencing (Table 6)";
  const MISSOURI = "B University of Missouri Extension, G1193 Pasture Fence Construction Budget";
  const vf = { "settings.discountRate": RATE, "costs.subscription.unitCost": DTN, "costs.infrastructure.unitCost": DTN,
    "vf.fence.F": MISSOURI, "vf.fence.Lf": IOWA, "vf.fence.m": IOWA };
  assert.deepEqual(sourced(example("ranchA")), {
    "settings.discountRate": RATE,
    "labor.cut.paidRate": "A USDA NASS, Farm Labor (Northern Plains livestock workers, reference week 6–12 April 2025)",
    "labor.cut.loadPct": "B U.S. Bureau of Labor Statistics, Employer Costs for Employee Compensation (legally required benefits)",
    "costs.monitors.unitCost": ALLTEX,
    "costs.monitors.lifeYears": "B USDA NRCS, E614A enhancement sheet (enhancement life span 10 years)",
    "costs.subscription.unitCost": ALLTEX,
    "water.blocks.0.shareAvoided": "E Synthetic Ranch A: made-up example value",
  });
  assert.deepEqual(sourced(example("ranchB")), vf);
  assert.deepEqual(sourced(example("ranchD")), vf);
  assert.deepEqual(sourced(example("ranchC")), {
    "settings.discountRate": RATE, "eid.tagPrice": JEFFERS, "costs.reader.unitCost": JEFFERS,
    "costs.indicatorBars.unitCost": "C Valley Vet retail listing",
  });
});

test("every [B] and [C] record has url, pub and region, and currency USD when it is money; every region is in the US (9.7)", () => {
  const records = [...examples.flatMap(([id, a]) => Object.entries(a.prov).map(([path, p]) => [`${id} ${path}`, path, p])),
    ...Object.values(VENDOR_FILLS).flatMap((fills) => Object.entries(fills).map(([path, f]) => [`fill ${path}`, path, f.prov]))];
  for (const [name, path, p] of records) {
    if (p.region !== undefined) assert.match(p.region, /^US( \(.+\))?$/, name); // a non-US study appears only in a note
    if (!["B", "C"].includes(p.cls)) continue;
    assert.match(p.url, /^https:\/\//, name);
    assert.match(p.pub, PUB, name);
    assert.equal(typeof p.region, "string", name);
    if (MONEY.test(path)) assert.equal(p.currency, "USD", name);
    else assert.notEqual(p.currency, "USD", name);
  }
  // An undated [C] value shows the undated label (9.5 item 4).
  const a = example("ranchA");
  assert.equal(a.prov["costs.monitors.unitCost"].pub, CHECKED);
  assert.equal(priceLabel(a.prov["costs.monitors.unitCost"]),
    "Vendor information: published list price (All-Tex dealer flyer, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote.");
});

test("the synthetic cost placeholders and reported prices are exactly those of Appendix A (9.7)", () => {
  const flagged = (a, key) => Object.keys(a.prov).filter((p) => a.prov[p][key]).sort();
  assert.deepEqual(flagged(example("ranchA"), "placeholder"), ["costs.batteries.unitCost", "costs.mounting.unitCost"]);
  assert.deepEqual(flagged(example("ranchB"), "placeholder"), ["labor.cut.paidRate", "labor.handling.paidRate"]);
  assert.deepEqual(flagged(example("ranchD"), "placeholder"), ["labor.cut.paidRate", "labor.handling.paidRate"]);
  assert.deepEqual(flagged(example("ranchC"), "placeholder"), ["costs.platform.unitCost", "costs.software.unitCost", "eid.dosing.perApplication"]);
  for (const id of ["ranchB", "ranchD"]) {
    assert.deepEqual(flagged(example(id), "reported"), ["costs.infrastructure.unitCost", "costs.subscription.unitCost"]);
  }
  for (const id of ["ranchA", "ranchC"]) assert.deepEqual(flagged(example(id), "reported"), []);
  // Each placeholder is an [E] value with the placeholder label; each reported price a [C] value with its own label.
  const a = example("ranchA");
  assert.equal(a.prov["costs.mounting.unitCost"].cls, "E");
  assert.equal(priceLabel(a.prov["costs.mounting.unitCost"]), "Synthetic placeholder, not a price. Replace with your quote.");
  const b = example("ranchB");
  for (const path of ["costs.subscription.unitCost", "costs.infrastructure.unitCost"]) {
    assert.equal(b.prov[path].cls, "C");
    assert.equal(priceLabel(b.prov[path]),
      "Vendor information: reported price (DTN, 31 Mar 2025), not a published list price. Not an endorsement. Replace with your quote.");
  }
});

test("the vendor fills: exactly the table of 9.5 item 7, each a first-hand [C] price, none reported (9.7)", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(VENDOR_FILLS).map(([m, f]) => [m, Object.entries(f).map(([p, x]) => [p, x.value])])), {
    water: [["costs.monitors.unitCost", 1490], ["costs.subscription.unitCost", 365]],
    eid: [["eid.tagPrice", 156.99 / 50], ["costs.reader.unitCost", 1919], ["costs.indicatorBars.unitCost", 1829.95]],
  });
  for (const fills of Object.values(VENDOR_FILLS)) {
    for (const { prov } of Object.values(fills)) {
      assert.equal(prov.cls, "C");
      assert.ok(!prov.reported && !prov.placeholder);
      assert.equal(prov.currency, "USD");
      assert.equal(prov.region, "US");
      assert.equal(prov.pub, CHECKED);
    }
  }
  // No price input of any example offers a fill outside that table: the virtual fence publishes no US price.
  const offered = examples.flatMap(([id, a]) => pricePaths(a).filter((path) => vendorFill(a, path) !== null).map((path) => `${id} ${path}`));
  assert.deepEqual(offered, ["ranchA costs.monitors.unitCost", "ranchA costs.subscription.unitCost", "ranchC costs.reader.unitCost",
    "ranchC costs.indicatorBars.unitCost", "ranchC eid.tagPrice"]);
  assert.equal(vendorFill(example("ranchB"), "costs.subscription.unitCost"), null);
  assert.equal(vendorFill(example("ranchB"), "vf.collarLoss.chargePerCollar"), null);
});

test("each fill sets its value, its [C] record with source, link and date, and its label (9.7 Provenance, 9.5 items 4 and 7)", () => {
  const label = (src, note) => `Vendor information: published list price (${src}, undated; checked 15 Oct 2026). Not an endorsement. `
    + `Replace with your quote.${note ? ` (${note})` : ""}`;
  const record = (src, url, more = {}) => ({ cls: "C", src, url, pub: CHECKED, region: "US", currency: "USD", ...more });
  const ALLTEX = "https://www.alltexirrigation.com/storage/UserFileFolder/Ranchbot_Flyer_-_All-Tex.pdf";
  const expected = {
    ranchA: {
      "costs.monitors.unitCost": [1490, record("All-Tex dealer flyer", ALLTEX), label("All-Tex dealer flyer")],
      "costs.subscription.unitCost": [365, record("All-Tex dealer flyer", ALLTEX), label("All-Tex dealer flyer")],
    },
    ranchC: {
      "eid.tagPrice": [156.99 / 50, record("Jeffers retail listing", "https://jefferspet.com/products/usda-840-hdx-eid-tags", { note: "$156.99 per 50" }),
        label("Jeffers retail listing", "$156.99 per 50")],
      "costs.reader.unitCost": [1919, record("Jeffers retail listing", "https://jefferspet.com/products/xrs2-eid-stick-reader"), label("Jeffers retail listing")],
      "costs.indicatorBars.unitCost": [1829.95, record("Valley Vet retail listing", "https://www.valleyvet.com/s3-weigh-scale-indicator-system-mp600/"),
        label("Valley Vet retail listing")],
    },
  };
  for (const [id, fills] of Object.entries(expected)) {
    for (const [path, [value, prov, text]] of Object.entries(fills)) {
      const a = useVendorPrice(setInput(example(id), path, null), path); // from a cleared price, so the fill is written
      assert.equal(path.split(".").reduce((o, k) => o[k], a), value, path);
      assert.deepEqual(a.prov[path], prov, path);
      assert.equal(priceLabel(a.prov[path]), text, path);
    }
  }
  assert.equal(Math.round(156.99 / 50 * 100) / 100, 3.14); // shown as $3.14
});

test("Synthetic Ranch C loads two prices rounded from their listings, labeled as rounded (9.5 item 4)", () => {
  const c = example("ranchC");
  assert.deepEqual([c.eid.tagPrice, c.costs.indicatorBars.unitCost], [3.14, 1830]);
  assert.equal(priceLabel(c.prov["costs.indicatorBars.unitCost"]),
    "Vendor information: published list price (Valley Vet retail listing, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote. (rounded from $1,829.95)");
  assert.equal(priceLabel(c.prov["eid.tagPrice"]),
    "Vendor information: published list price (Jeffers retail listing, undated; checked 15 Oct 2026). Not an endorsement. Replace with your quote. (rounded from $156.99 per 50)");
});

test("Synthetic Ranch A's summer share is a made-up value whose note names the USU example and, as non-US context only, PIRSA", () => {
  const p = example("ranchA").prov["water.blocks.0.shareAvoided"];
  assert.equal(p.cls, "E");
  assert.equal(p.region, undefined);
  assert.match(p.note, /Utah State University Extension worked example/);
  assert.match(p.note, /US, Utah/);
  assert.match(p.note, /https:\/\/extension\.usu\.edu\/rangelands\/research\/save-time-money/);
  assert.match(p.note, /PIRSA \(South Australia, February 2022 prices\)/);
  assert.match(p.note, /non-US context only/);
});

test("Ranches B and D load the collar-loss charge blank with a share of 0, and show no 'Quote required' (9.5 item 7)", () => {
  for (const id of ["ranchB", "ranchD"]) {
    const a = example(id);
    assert.deepEqual(a.vf.collarLoss, { pctPerYear: 0, chargePerCollar: null });
    assert.equal(a.prov["vf.collarLoss.chargePerCollar"], undefined);
    const r = analyze(a);
    assert.ok(!r.notices.some((n) => n.type === "quoteRequired"), id);
  }
  // A charge left blank on a share above 0 is listed.
  const b = example("ranchB");
  b.vf.collarLoss.pctPerYear = 0.05;
  assert.deepEqual(analyze(b).notices.filter((n) => n.type === "quoteRequired").map((n) => n.lineId), ["collarLoss"]);
});

test("no example names a company or product outside its linked source citations (owner rule)", () => {
  // Every brand in the examples is in a prov record's src or url, never in a value, label or note of the inputs.
  const brands = /Ranchbot|All-Tex|Jeffers|Valley Vet|Nofence|Halter|Vence|Gallagher|Tru-Test|Datamars|Allflex/i;
  for (const [id, a] of examples) {
    const { prov, ...inputs } = a;
    assert.ok(!brands.test(JSON.stringify(inputs)), id);
    for (const [path, p] of Object.entries(prov)) assert.ok(!brands.test(p.note ?? ""), `${id} ${path}`);
  }
  assert.ok(!Object.values(EXAMPLE_BANNERS).some((b) => brands.test(b)));
  assert.equal(noticeText({ type: "eidRulePending" }).includes("APHIS"), false);
});
