# Reference prototype for the synthetic examples

These two files reproduce the numbers in section 11 of `ranch-tech-roi-audit.md` and in Appendix A of
`phase1-spec.md`, both in the folder above this one. They are a reference model of the proposed phase-1 formulas
(section 9, also in `phase1-spec.md`) for the pinned numbers only: not part of the calculator's code (`roi.js`, `app.js`) and not a proposed implementation. Every example ranch
is synthetic. All results are before tax.

The prototype does not implement operator share, land units, the discount-rate review prompt or the
synthetic-placeholder flags. For "what would make it pay" (B9) it does not implement `PAYBACK_DRIVERS(a)`, `setPath()`
or the validation clip: each value is solved one input at a time with `breakEven()`. Every example line has operator share 1, and each ranch's inputs are fixed values
(Appendix A).

Run with Node 18 or later:

    node examples.mjs

That prints the nine headline runs (Ranches A, B and C, each in three scenarios), the good-fit Ranch D, and the
five-year test for every ranch. Each sensitivity row and "what would make it pay" value in section 11 is one function
call listed in Appendix A, except Ranch A's subscription per monitor and monitor price, which Appendix A derives from
one `targetTest()` call by a stated linear expression.

`proto.mjs` holds the engine (line kinds, NPV, BCR, IRR and payback states per section 9.3 with its $0.005 zero tolerance, capital scheduler,
fence function). `examples.mjs` holds the four ranches (A, B and C with conservative, expected and optimistic inputs;
D, the good-fit virtual-fence example), `targetTest()` for the five-year test (the same ranch re-run with a 5-year
horizon), and `breakEven()` for solving one input. Every ranch function takes an override object, for example
`ranchB("exp", {T: 5, subRate: 2})`. Every ranch takes a `T` override; Ranch B takes `head`, and Ranches C and D
take `cows`, for the herd-size driver.
