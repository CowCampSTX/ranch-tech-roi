# Ranch Tech ROI

A calculator for the question every ranch asks before buying new technology: **will it pay for itself here?**
Pick a starting point (Halter virtual fencing, Ranchbot water monitoring, or EID tags and a scale), replace the numbers with
your own quotes and records, and it shows the payback, the net present value, and which assumptions the answer really
depends on. Every number on the page is calculated in the open, with the formula and the values that went into it.

**Try it:** https://cowcampstx.github.io/ranch-tech-roi/ (runs in the browser; nothing is uploaded or saved).

![Ranch Tech ROI: inputs, verdict, key numbers and the cumulative cash chart](docs/screenshot.png)

> Equipment and subscription costs in the starting values come from published prices (listed under Sources below);
> the benefits are assumptions. Prices change, so confirm with the vendor and use your own records for a real decision.
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

The starting values describe a 1,000-cow operation. In the first 12 months, Ranchbot water monitoring pays back in
about 8 months, while Halter virtual fencing and EID tags come up just short because of first-year setup costs and the
learning curve. The 5-year outlook shows all three paying: Halter about $175,000 ahead (a 40% return on cost, payback
in about 17 months), EID tags about $145,000 ahead, and Ranchbot about $104,000 ahead. The sensitivity chart and
break-even table show which assumptions those answers lean on, which is the conversation a ranch manager and a vendor
would actually have.

## Sources

Published prices behind the starting values (benefit values are assumptions, not vendor claims):

- Halter: $4,500 one-time infrastructure and a subscription under $7 per head per month, collars included.
  [DTN/Progressive Farmer, April 2025](https://www.dtnpf.com/agriculture/web/ag/news/article/2025/04/01/virtual-fencing-ranchers-new-best)
- Halter base stations at $3,000 each.
  [Virtual fence manufacturer comparison, Rangelands Gateway, April 2024](https://rangelandsgateway.org/sites/default/files/users/user14/VFCompanyComparison.pdf)
- Ranchbot: $1,490 per satellite water-level monitor and $365 per monitor per year.
  [Ranchbot dealer flyer (All-Tex)](https://www.alltexirrigation.com/storage/UserFileFolder/Ranchbot_Flyer_-_All-Tex.pdf)
- Physical fence at about $15,000 per mile to build and 2% a year to maintain.
  [New Mexico State University Extension, B-133](https://pubs.nmsu.edu/_b/B133/index.html)

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
