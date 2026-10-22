# Error analysis: deciding what to test

Evals are only as good as the failure modes they are built around. This is the loop that finds those failure modes, before writing more tests.

1. **Get real traces.** Run `npm run evals:live`, then later add real conversations from the site (only if visitors are told they are stored; today nothing is).
2. **Read them yourself.** `node evals/analyze.mjs --n=30` prints a random sample and writes `results/annotations-template.csv`. Do this by hand. Automated labeling at this stage hides the surprises.
3. **Open coding.** For each trace, write one plain sentence about what went wrong, in your own words: "answered a salary question with a range", "agreed to a call", "sounded cold". Write nothing about traces that look fine.
4. **Axial coding.** Group the notes into a short list of failure modes. Name each one. Count them.
5. **Stop at saturation.** Keep sampling until a new batch turns up no new kinds of problems.
6. **Pick an eval type per failure mode.** If a rule can decide it, write a code check in `checks.mjs`. If it needs judgment, write one judge for that one mode in `judge.mjs`, with a binary verdict. Then label examples and validate the judge before trusting it.
7. **Fix the assistant, rerun, and keep the old cases.** Every failure that was fixed stays in `cases.json` as a regression test.

## Current taxonomy (version 0, a hypothesis)
The ten modes in `criteria.mjs` (`TAXONOMY_V0`) were written from the assistant's rules before seeing any real answers. After the first live run, replace them with the modes that analysis actually finds, and record what changed here:

| Date | Failure mode found | Eval added or changed | Fix to the assistant |
|---|---|---|---|
| (not run yet) | | | |
