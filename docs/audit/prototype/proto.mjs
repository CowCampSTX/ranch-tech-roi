// Reference prototype of the proposed phase-1 cash model (section 9 conventions), used only to compute the
// synthetic examples in the audit. Not part of the calculator's code. All results are before tax.
// Not implemented: operator share, land units, the discount-rate review prompt, synthetic-placeholder flags.
//
// Line kinds:
//   cost        C_t  cash cost (capital, subscription, paid labor added)
//   cash        B_t  cash benefit (includes avoided capital, net of its lost residual)
//   residual    R_t  residual value of purchased assets (nonzero only at T)
//   risk        expected value of rare losses avoided; separate subtotal, never in cash NPV, BCR or payback
//   capacity    unpaid hours freed (+) or added (-), valued at the user's rate; economic view only
//   production  production effects not from the ranch's own records; economic view only
export const npv = (r, xs) => xs.reduce((s, x, t) => s + x / (1 + r) ** t, 0);

// Zero tolerance of spec 9.3: in the IRR and payback rules a value, sum or cumulative with |x| < 0.005 counts as 0.
export const ZERO = 0.005;
const signsOf = (xs) => xs.filter((x) => Math.abs(x) >= ZERO).map(Math.sign);

// Bisection on [0%, 10,000%]; called by irrState only after it has ruled out every other state (sum of flows > 0).
export function irr(xs) {
  const signs = signsOf(xs);
  const changes = signs.slice(1).filter((s, i) => s !== signs[i]).length;
  if (changes !== 1 || !(xs[0] <= -ZERO)) return null;
  let lo = 0, hi = 100; const f = (r) => npv(r, xs);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 300; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
  return (lo + hi) / 2;
}

// IRR states in the order of spec 9.3. Returns a state string, or the IRR as a fraction (0 when the flows sum to 0).
export function irrState(xs) {
  if (xs.every((x) => Math.abs(x) < ZERO)) return "n/a: no cash flows";
  if (xs[0] > -ZERO) return "n/a: no net outlay in year 0";
  const s = signsOf(xs);
  if (s.slice(1).filter((v, i) => v !== s[i]).length > 1) return "n/a: cash flows change sign more than once";
  const sum = xs.reduce((a, b) => a + b, 0);
  if (sum <= -ZERO) return "below 0%";
  if (sum < ZERO) return 0;
  if (npv(100, xs) > 0) return "above 10,000%";
  return irr(xs);
}

// Payback state machine (spec 9.3).
export function payback(xs) {
  const eps = ZERO;
  if (xs.every((x) => Math.abs(x) < eps)) return { state: "n/a", text: "n/a: no cash flows" };
  const cum = []; xs.reduce((c, x, t) => (cum[t] = c + x), 0);
  const T = xs.length - 1;
  if (cum[T] < -eps) {
    const pos = cum.map((c, t) => (c >= -eps ? t : -1)).filter((t) => t >= 0);
    let text = `none within ${T} years`;
    if (xs[0] > -eps && pos.length) {
      const firstNeg = cum.findIndex((c) => c < -eps);
      text = `none within ${T} years (no net outlay in year 0; cumulative negative from year ${firstNeg})`;
      const later = pos.filter((t) => t > firstNeg); if (later.length) text += ` (positive in year(s) ${later.join(", ")}, negative again by year ${T})`;
    } else if (pos.length) text += ` (positive in year(s) ${pos.join(", ")}, negative again by year ${T})`;
    return { state: "none", text };
  }
  let k = T; while (k > 0 && cum[k - 1] >= -eps) k--;
  if (k === 0) return { state: "no-outlay", years: 0, text: "no net outlay: cumulative cash never negative" };
  const yrs = k - 1 + -cum[k - 1] / xs[k];
  const early = cum.slice(0, k).map((c, t) => (c >= -eps ? t : -1)).filter((t) => t >= 0);
  const note = early.length ? ` (cumulative was positive in year ${early[0]}, then negative again before year ${k})` : "";
  return { state: "years", years: yrs, text: `${yrs.toFixed(2)} years${note}` };
}

export function run(name, T, rate, lines) {
  const yrs = [...Array(T + 1).keys()];
  const series = (k) => yrs.map((t) => lines.filter((l) => l.kind === k).reduce((s, l) => s + (l.by(t) || 0), 0));
  const C = series("cost"), B = series("cash"), R = series("residual"), K = series("risk"), H = series("capacity"), P = series("production");
  const net = yrs.map((t) => B[t] + R[t] - C[t]);
  const pv = (xs) => npv(rate, xs);
  const res = {
    name, T, rate, C, B, R, K, H, P, net,
    pvC: pv(C), pvB: pv(B), pvR: pv(R), pvK: pv(K), pvH: pv(H), pvP: pv(P),
    cashNPV: pv(net),
    withRisk: pv(net) + pv(K),
    econNPV: pv(net) + pv(K) + pv(H) + pv(P),
    bcr: pv(C) ? (pv(B) + pv(R)) / pv(C) : null,
    irr: irrState(net), payback: payback(net),
    lines: lines.map((l) => ({ label: l.label, kind: l.kind, pv: pv(yrs.map(l.by)) })),
  };
  return res;
}

export const $ = (x) => (x < 0 ? "−$" : "$") + Math.round(Math.abs(x)).toLocaleString("en-US");
export const fmt = (r) => {
  console.log(`\n== ${r.name}  (T=${r.T}, ${(r.rate * 100).toFixed(0)}% real, before tax)`);
  console.log("year      cost      cash   residual       net   risk   capacity  production");
  r.C.forEach((_, t) => console.log(String(t).padEnd(4), ...[r.C, r.B, r.R, r.net, r.K, r.H, r.P].map((s) => $(s[t]).padStart(9))));
  console.log(`cash NPV ${$(r.cashNPV)} | +risk ${$(r.withRisk)} | econ ${$(r.econNPV)} | BCR ${r.bcr?.toFixed(3)} | IRR ${r.irr === null ? "n/a" : typeof r.irr === "string" ? r.irr : (r.irr * 100).toFixed(1) + "%"} | payback ${r.payback.text}`);
  console.log(`PV(C) ${$(r.pvC)} PV(B) ${$(r.pvB)} PV(R) ${$(r.pvR)} PV(risk) ${$(r.pvK)} PV(cap) ${$(r.pvH)} PV(prod) ${$(r.pvP)}`);
  for (const l of r.lines) console.log("  PV", l.kind.padEnd(10), l.label.padEnd(70), $(l.pv));
};

// Schedule helpers
export const at = (t0) => (t) => (t === t0 ? 1 : 0);
export const advance = (T) => (t) => (t >= 0 && t <= T - 1 ? 1 : 0); // billed at the start of each operating year
export const arrears = (T) => (t) => (t >= 1 && t <= T ? 1 : 0);     // incurred during / at the end of each year

// Capital line through the F5 scheduler: bought at s + n*L for s + n*L < T; repairs in service years; straight-line residual at T.
export function capital({ unit, qty, start = 0, life = null, repairPct = 0, T }) {
  if (start >= T) return { cost: () => 0, residual: () => 0, buys: [], resid: 0 }; // startYear must be < T
  const buys = []; if (life === null) buys.push(start); else for (let b = start; b < T; b += life) buys.push(b);
  const last = buys[buys.length - 1];
  const resid = life === null ? 0 : Math.min(1, Math.max(0, (last + life - T) / life)) * unit * qty;
  return {
    cost: (t) => (buys.includes(t) ? unit * qty : 0) + (t > start && t <= T ? repairPct * unit * qty : 0),
    residual: (t) => (t === T ? resid : 0),
    buys, resid,
  };
}
// Avoided or deferred fence = negation of a capital line (spec 9.3 Fence).
export function fenceBenefit({ F, miles, k, life, m, T, deferBy = null }) {
  const stream = (b) => {
    if (b >= T) return () => 0; // a fence first built in year T or later never serves a year inside the horizon
    const c = capital({ unit: F, qty: miles, start: b, life, repairPct: m, T });
    return (t) => c.cost(t) - c.residual(t);
  };
  const a = stream(k), d = deferBy === null ? () => 0 : stream(k + deferBy);
  return (t) => a(t) - d(t);
}
