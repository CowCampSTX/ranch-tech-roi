# Ranch Tech ROI: handoff

Written 2026-10-14 for Jeremiah's own Claude project for this one repository. In the project's first chat, attach
this zip and say: "Read HANDOFF.md and push this project to my GitHub."

## Who this is for

Jeremiah Fleming (GitHub: CowCampSTX, LinkedIn: linkedin.com/in/jeremiahfleming88) is looking for a mid-to-high level
management job in AgTech (roles that require a bachelor's degree), in South Dakota, Nebraska and that part of the
Plains. This project is one of three portfolio pieces that show employers how he thinks about ag operations,
technology and decisions; each lives in its own repository and its own Claude project. He isn't a programmer and is
new to GitHub, so explain any GitHub step in plain words, one click at a time.

Facts about him that he has approved for public use:
- Bachelor's degree in business administration from APUS (American Public University System); MBA in progress
- About 10 years of ranching, on and off, between professional ranch jobs and corporate roles
- Grew up in Texas around rodeos, ranching and livestock

Don't add anything about his background beyond these unless he says it. Never commit `.env` files, tokens or passwords.

## The project

A browser calculator for "will this ranch technology pay for itself?": NPV, payback, IRR, return on cost, a sensitivity
chart, break-even values, a two-way table, and every formula shown with the numbers filled in. Plain HTML and
JavaScript, no build step.

- Tests: `node --test tests/roi.test.mjs` (9 tests, including a small case checked by hand)
- The starting values are illustrative assumptions, not vendor prices, and the page says so. Keep it that way.

## What to do

1. Create an empty public repo on CowCampSTX named `ranch-tech-roi` (no README or license; the folder has them).
   Push the folder to its `main` branch.
2. Turn on GitHub Pages: repo **Settings > Pages**, Branch **main**, folder **/(root)**, **Save**. After about a
   minute it's live at https://cowcampstx.github.io/ranch-tech-roi/ (the README already links there). Open the link to confirm.
3. Pin it on his GitHub profile (profile page > **Customize your pins**).
4. Optional: add the live link to his LinkedIn **Featured** section and his resume.
