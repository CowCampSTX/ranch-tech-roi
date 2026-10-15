import { pathToFileURL } from "node:url";
import { run, fmt, at, advance, arrears, capital, fenceBenefit, $ } from "./proto.mjs";

const RATE = 0.07; // real discount rate [E]
const OPP = 20;    // $/h the owner puts on their own time [E], economic view only

// ---------------- Ranch A: remote water monitoring, 900-cow northern cow-calf, 10 remote tanks, T=10
export const A = {
  cons: { shareSummer: 0.25, shareOther: 0, mile: 0.30, daysCut: 0, addHrsWk: 2, outage: 0 },
  exp:  { shareSummer: 0.50, shareOther: 0, mile: 0.40, daysCut: 16, addHrsWk: 1, outage: 0.15 * 5 * 2700 * 0.75 },
  opt:  { shareSummer: 0.50, shareOther: 0, mile: 0.50, daysCut: 33, addHrsWk: 0.5, outage: 0.25 * 5 * 2700 * 0.9 },
};
export function ranchA(s, o = {}) {
  const S = { ...A[s], ...o }, T = o.T ?? 10, rate = o.rate ?? RATE;
  const runsSummer = 22 * 4, runsOther = 30 * 2, miles = 120, hrsPerRun = 6;
  const floorShare = (4 - 2) / 4; // 2 visits a week needed anyway in summer
  const shareS = Math.min(S.shareSummer, floorShare);
  const runsAvoided = runsSummer * shareS + runsOther * S.shareOther;
  const hoursSaved = runsAvoided * hrsPerRun;
  const dayRate = 18.72 * 1.10 * 8;
  const paidHrs = S.daysCut * 8;
  if (paidHrs > hoursSaved + 1e-9) throw new Error("paid hours cut exceed hours saved");
  const freed = hoursSaved - paidHrs - S.addHrsWk * 52;
  const mon = capital({ unit: 1490, qty: 10, start: 0, life: 10, T });
  const r = run(`Ranch A water monitoring (${s})`, T, rate, [
    { label: "10 monitors × $1,490 [C], 10-yr life [B]", kind: "cost", by: mon.cost },
    { label: "Mounting materials 10 × $75 [E]", kind: "cost", by: (t) => at(0)(t) * 750 },
    { label: "Subscription 10 × $365/yr, billed in advance [C]", kind: "cost", by: (t) => advance(T)(t) * 3650 },
    { label: "Batteries and repairs $100/monitor in years 4 and 8 [E]", kind: "cost", by: (t) => (t === 4 || t === 8 ? 1000 : 0) },
    { label: "Residual value of monitors at year 10", kind: "residual", by: mon.residual },
    { label: `Vehicle: ${runsAvoided} runs × ${miles} mi × $${S.mile.toFixed(2)}/mi`, kind: "cash", by: (t) => arrears(T)(t) * runsAvoided * miles * S.mile },
    { label: `Day-labor days not hired: ${S.daysCut} × $${dayRate.toFixed(2)}`, kind: "cash", by: (t) => arrears(T)(t) * S.daysCut * dayRate },
    { label: "Expected water-outage losses avoided [E] (risk)", kind: "risk", by: (t) => arrears(T)(t) * S.outage },
    { label: `Owner hours freed ${freed.toFixed(0)} h/yr × $${OPP}`, kind: "capacity", by: (t) => arrears(T)(t) * freed * OPP },
    { label: "Install time 30 h × $20 (capacity cost)", kind: "capacity", by: (t) => at(0)(t) * -600 },
  ]);
  return Object.assign(r, { runsAvoided, hoursSaved, paidHrs, freed, dayRate });
}

// ---------------- Ranch B: virtual fence, 1,200 yearlings, 150-day season, T=7, owned grass
export const B = {
  cons: { infra: 9000, subMode: "year", subRate: 7, months: 12, minPerHead: 2.0, crew: 4, refitGathers: 3, refitRiders: 3, refitHrs: 8, trainDays: 10, trainRiders: 2, trainHrs: 8, loss: 3000, riderCut: 0, gain: 0 },
  exp:  { infra: 4500, subMode: "month", subRate: 7, months: 5.5, minPerHead: 1.5, crew: 4, refitGathers: 2, refitRiders: 3, refitHrs: 8, trainDays: 7, trainRiders: 2, trainHrs: 6, loss: 0, riderCut: 200, gain: 0 },
  opt:  { infra: 4500, subMode: "month", subRate: 5.5, months: 5, minPerHead: 1.0, crew: 3, refitGathers: 2, refitRiders: 2, refitHrs: 6, trainDays: 5, trainRiders: 1, trainHrs: 6, loss: 0, riderCut: 400, gain: 0.1 * 150 * 1176 * 3.40 },
};
export function ranchB(s, o = {}) {
  const S = { ...B[s], ...o }, T = o.T ?? 7, rate = o.rate ?? RATE, head = o.head ?? 1200, contract = 25;
  const fence = o.fence ?? { F: 4300, life: 4, m: 0.05 }; // 2-strand polywire [B] Missouri G1193; FM-1855 4 yr / 5%
  const leasedLandlordFence = !!o.leasedLandlordFence;
  const sub = head * S.subRate * S.months;
  const handleH = head * 2 * S.minPerHead * S.crew / 60;
  const refitH = S.refitGathers * S.refitRiders * S.refitHrs;
  const trainH = S.trainDays * S.trainRiders * S.trainHrs;
  const laborH = handleH + refitH + trainH;
  const fb = leasedLandlordFence ? () => 0 : fenceBenefit({ F: fence.F, miles: 8, k: 0, life: fence.life, m: fence.m, T });
  const r = run(`Ranch B virtual fence (${s})`, T, rate, [
    { label: "Infrastructure [C]", kind: "cost", by: (t) => at(0)(t) * S.infra },
    { label: `Subscription ${head.toLocaleString()} × $${S.subRate}/head/month × ${S.months} months, in advance [C]`, kind: "cost", by: (t) => advance(T)(t) * sub },
    { label: `Contract labor ${laborH.toFixed(0)} h × $${contract} (collar on/off ${handleH.toFixed(0)}, refits ${refitH}, training ${trainH}) [E]`, kind: "cost", by: (t) => arrears(T)(t) * laborH * contract },
    { label: "Collar loss charges [E]", kind: "cost", by: (t) => arrears(T)(t) * S.loss },
    { label: `Interior fence avoided: 8 mi × $${fence.F.toLocaleString()} (life ${fence.life} yr, ${fence.m * 100}% upkeep), net of residual`, kind: "cash", by: fb },
    { label: `Contract moving/gathering hours cut ${S.riderCut} h × $${contract} [E]`, kind: "cash", by: (t) => arrears(T)(t) * S.riderCut * contract },
    { label: "Extra weight gain [E], unsupported; upper-bound price", kind: "production", by: (t) => arrears(T)(t) * S.gain },
  ]);
  return Object.assign(r, { sub, laborH, handleH, refitH, trainH });
}

// ---------------- Ranch C: EID tags + reader + scale, 300-cow cow-calf, 285 calves born, 240 sold at a local auction, T=7
export const Cc = {
  cons: { cowTag: 3.14, calfTag: 3.14, tagLoss: 0.043, resid: 0, dose: 0, prem: 0, secPerRead: 30, dataHrs: 20 },
  exp:  { cowTag: 3.14, calfTag: 3.14, tagLoss: 0.015, resid: 0.15, dose: 885 * 0.45, prem: 0, secPerRead: 20, dataHrs: 15 },
  opt:  { cowTag: 0, calfTag: 3.14, tagLoss: 0.015, resid: 0.25, dose: 885 * 0.45, prem: 240 * 5.5 * 2.25 - 240 * 1.10, secPerRead: 15, dataHrs: 10 },
};
export function ranchC(s, o = {}) {
  const S = { ...Cc[s], ...o }, T = o.T ?? 7, rate = o.rate ?? RATE;
  const k = (o.cows ?? 300) / 300; // herd-size driver (B9): cows, calves, weighings, doses and premium head scale together
  const equip = 1919 + 1830 + 800;
  const weighings = (300 * 2 + 285) * k; // cows at two chute workings, calves at weaning
  const chuteH = weighings * S.secPerRead * 3 / 3600; // crew of 3
  const addedH = chuteH + S.dataHrs;
  const r = run(`Ranch C EID + scale (${s})`, T, rate, [
    { label: `Tag ${300 * k} cows once at $${S.cowTag} [C]`, kind: "cost", by: (t) => at(0)(t) * 300 * k * S.cowTag },
    { label: `Tag ${285 * k} calves/yr at $${S.calfTag} [C]`, kind: "cost", by: (t) => arrears(T)(t) * 285 * k * S.calfTag },
    { label: `Retag lost or unreadable cow tags ${(S.tagLoss * 100).toFixed(1)}%/yr [E], set at Roberts et al. 2012 rates [B]`, kind: "cost", by: (t) => arrears(T)(t) * 300 * k * S.tagLoss * 3.14 },
    { label: "Reader $1,919 + indicator/bars $1,830 [C] + platform $800 [E]", kind: "cost", by: (t) => at(0)(t) * equip },
    { label: "Software $360/yr, in advance [E] (set at a published plan price; quote required)", kind: "cost", by: (t) => advance(T)(t) * 360 },
    { label: `Residual value of reader, scale and platform ${S.resid * 100}% [E]`, kind: "residual", by: (t) => at(T)(t) * equip * S.resid },
    { label: `Dewormer dosed by weight, ${885 * k} applications × $0.45 [E]`, kind: "cash", by: (t) => arrears(T)(t) * S.dose * k },
    { label: "Age-and-source premium net of verification fee [B]/[C], video sale assumed", kind: "cash", by: (t) => arrears(T)(t) * S.prem * k },
    { label: `Added chute and data time ${addedH.toFixed(1)} h × $${OPP} (owner and family)`, kind: "capacity", by: (t) => arrears(T)(t) * -addedH * OPP },
  ]);
  return Object.assign(r, { addedH, chuteH, equip });
}

// Bisection helper for break-evens on cash NPV
export function breakEven(f, lo, hi) {
  const g = (x) => f(x).cashNPV;
  if (g(lo) * g(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (g(lo) * g(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}


// ---------------- Ranch D: good-fit virtual fence (section 11), 400-cow cow-calf on 8,000 owned acres, T=7
// Four 2,000-acre pastures, each to be split into 3 paddocks by 2 cross-fences. A square 2,000-acre pasture is
// sqrt(2000/640) = 1.768 mi on a side, so the plan needs 2 × 1.768 × 4 = 14.14 mi of new interior fence in year 0.
// Fence type: 6-wire high-tensile, $15,100/mi [B] (Missouri G1193), 25-yr life and 5%/yr upkeep [B] (FM-1855).
// Virtual fence prices and expected effects are Ranch B's expected values; collars on cows only (calves and bulls
// are not collared), 12 months a year. Inputs were fixed before any result was computed and were not adjusted.
export function ranchD(o = {}) {
  const T = o.T ?? 7, rate = o.rate ?? RATE, cows = o.cows ?? 400, contract = 25;
  const miles = o.miles ?? 2 * Math.sqrt(2000 / 640) * 4;
  const F = o.F ?? 15100, life = 25, m = 0.05;
  const subRate = o.subRate ?? 7, months = 12;
  const sub = cows * subRate * months;
  const handleH = cows * 1 * 1.5 * 4 / 60; // one chute event a year (fit check at the fall working), 1.5 min/head, crew 4
  const refitH = 2 * 3 * 8;                 // as Ranch B expected
  const trainH = 7 * 2 * 6;                 // year 1 only: the cow herd is trained once
  const riderCut = o.riderCut ?? 200;       // as Ranch B expected
  const cs = o.costShare ?? null;           // {year1, laterYears, lastYear}: cost share received at year end (B5, after phase 1)
  const lines = [
    { label: "Infrastructure [C]", kind: "cost", by: (t) => at(0)(t) * 4500 },
    { label: `Subscription ${cows} cows × $${subRate}/head/month × 12, in advance [C]`, kind: "cost", by: (t) => advance(T)(t) * sub },
    { label: `Contract labor: fit check ${handleH} h + refits ${refitH} h a year; training ${trainH} h in year 1 [E]`, kind: "cost", by: (t) => arrears(T)(t) * (handleH + refitH) * contract + at(1)(t) * trainH * contract },
    { label: `Interior cross-fence avoided: ${miles.toFixed(2)} mi × $${F.toLocaleString()} high-tensile (25 yr, 5% upkeep), net of residual`, kind: "cash", by: fenceBenefit({ F, miles, k: 0, life, m, T }) },
    { label: `Contract moving/gathering hours cut ${riderCut} h × $${contract} [E]`, kind: "cash", by: (t) => arrears(T)(t) * riderCut * contract },
  ];
  if (cs) lines.push({ label: "Cost share (sensitivity only; B5 is after phase 1)", kind: "cash", by: (t) => (t === 1 ? cs.year1 : t >= 2 && t <= Math.min(cs.lastYear, T) ? cs.laterYears : 0) });
  return Object.assign(run(`Ranch D good-fit virtual fence`, T, rate, lines), { miles, sub, handleH, refitH, trainH });
}

// Five-year test (B9): the same ranch re-run with a horizon of `target` years, so residuals (and the lost residual
// of avoided fence) are valued at that year. "Pays for itself within the target" means this cash NPV is >= 0.
export const targetTest = (f, target = 5) => f({ T: target }).cashNPV;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const f of [ranchA, ranchB, ranchC]) for (const s of ["cons", "exp", "opt"]) fmt(f(s));
  fmt(ranchD());
  console.log("\n== Five-year test (cash NPV with a 5-year horizon, before tax; B9)");
  for (const [n, f] of [["Ranch A", ranchA], ["Ranch B", ranchB], ["Ranch C", ranchC]])
    console.log(n.padEnd(8), ["cons", "exp", "opt"].map((s) => `${s} ${$(targetTest((o) => f(s, o)))}`).join("  "));
  console.log("Ranch D ", `${$(targetTest((o) => ranchD(o)))}`);
}
