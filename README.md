# Ranch Tech ROI

A calculator for the question every ranch asks before buying new technology: **will it pay for itself here?**
Pick a starting point (virtual fencing, remote water monitoring, or EID tags and a scale), replace the numbers with
your own quotes and records, and it shows the payback, the net present value, and which assumptions the answer really
depends on. Every number on the page is calculated in the open, with the formula and the values that went into it.

**Try it:** https://cowcampstx.github.io/ranch-tech-roi/ (runs in the browser; nothing is uploaded or saved).

![Ranch Tech ROI: inputs, verdict, key numbers and the cumulative cash chart](docs/screenshot.png)

> The starting values are illustrative assumptions for a demonstration, not vendor prices or research results.
> Use your own quotes and records for a real decision.

## What it answers

| Question | Where on the page |
|---|---|
| Does it pay, and how soon? | Verdict line, net present value, payback, internal rate of return, return on cost |
| What does it cost per head, all in? | All-in cost per head per year |
| Which of my assumptions matter most? | Sensitivity chart: each input moved 20% down and up, longest bars first |
| How wrong can I be before it stops paying? | Break-even table: the value of each key input where NPV hits zero |
| What if two things change at once? | Two-way table for the two biggest drivers, from 40% below to 40% above |
| Where does each number come from? | Year-by-year table and the written-out formulas |

A scenario can be shared: **Copy link to this scenario** puts every input in the link.

![Sensitivity chart and break-even table](docs/sensitivity.png)

## The model

Year 0 is the purchase. Years 1 to N are operating years.

| Line | Formula |
|---|---|
| Hardware | herd size × hardware per head |
| Upfront cost (year 0) | hardware + base station, setup and install |
| Running cost (each year) | herd × subscription per head + hardware × repairs % + hardware × devices replaced % |
| Labor benefit | hours saved per week × 52 × loaded labor cost per hour |
| Death loss benefit | herd × death loss avoided (% of herd) × value per head |
| Weight benefit | herd × extra pounds sold per head × price per pound |
| Full-year benefit | labor + death loss + weight + fuel, vehicle and fence savings |
| Year 1 benefit | full-year benefit × share realized in year 1 (the crew is still learning the system) |
| Net cash | benefit − cost for each year |
| NPV | Σ net<sub>t</sub> ÷ (1 + discount rate)<sup>t</sup>, t = 0…N |
| IRR | the discount rate where NPV = 0 (found by bisection) |
| Payback | years until cumulative net cash ≥ 0, interpolated within the year |
| Return on cost | (total benefit − total cost) ÷ total cost |
| Sensitivity | NPV with one input at −20% and +20%, everything else held as entered |
| Break-even | the value of one input where NPV = 0, searched from 0 to 10× its current value |

Not included, on purpose, to keep it readable: taxes and depreciation, financing, resale value at the end, and price
changes over time. They can be folded into the inputs (for example, a lower hardware cost to reflect resale).

## What the example shows

With the virtual fencing starting values, a 300-head operation doesn't recover the cost in 5 years. The sensitivity
chart shows why: hardware price per head and herd size swing the answer most. Because the per-head running cost is
higher than the per-head benefit at these numbers, adding head makes it worse, not better. The break-even table puts a
number on it: at about $167 per head of hardware, it pays. That is the conversation a ranch manager and a vendor would
actually have, and the tool gets you to it in a minute.

## Run it locally

No build step and no dependencies. The page uses JavaScript modules, so serve the folder instead of opening the file:

```bash
python -m http.server 8000      # then open http://localhost:8000
node --test tests/roi.test.mjs  # 9 tests: hand-checked cash flows, NPV, IRR, payback, break-even, sensitivity
```

## Files

```
index.html        the page and its styles (light and dark mode, works on a phone)
app.js            page wiring: inputs, charts, tables, written-out formulas
roi.js            the model: pure functions, no dependencies, shared by the page and the tests
tests/            node:test unit tests, including a small case checked by hand
docs/             screenshots
```

## License

MIT
