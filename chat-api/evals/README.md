# Evals for the Ask me anything assistant

These tests check the assistant that answers questions on ethanbidna.com. The method starts from the ways the assistant can fail, tests each one with a plain pass or fail, and checks every AI judge against hand-labeled answers before trusting it.

## The idea in four steps
1. **Start from how it can fail, not from a score.** `criteria.mjs` lists ten separate failure modes (inventing facts, guessing instead of admitting ignorance, making promises for Ethan, drifting off topic, obeying instructions hidden in a message, claiming to be human, and so on). Each one is its own pass or fail test. There are no 1-to-5 scales.
2. **Use code wherever code can decide.** Nine of the checks are plain code (`checks.mjs`): formatting, length, leaking the instructions, private data, whether it says it's an AI, whether the last answer hands off to the real Ethan. They are cheap, exact and never wrong about themselves.
3. **Use an AI judge only for what code can't decide.** Five failure modes need judgment (`judge.mjs`). Each gets its own judge with one narrow question, a short written critique before the verdict, and worked examples taken from the hand-labeled **train** split.
4. **Don't trust a judge until it has been checked against human labels.** `labeled.json` holds 80 hand-labeled answers (16 per judge: 4 train, 12 test, evenly balanced). Each judge is run on the 12 test items. We report its true-positive rate and true-negative rate (`metrics.mjs`). A judge is trusted only if both are at least 80%. For trusted judges the pass rate is corrected for the judge's own error rate and shown with a bootstrap interval.

## Files
| File | What it is |
|---|---|
| `cases.json` | 65 test conversations in 9 categories, including adversarial and multi-turn ones |
| `criteria.mjs` | The failure modes, which categories each applies to, thresholds, and the version-0 failure taxonomy |
| `checks.mjs` | The nine code checks |
| `judge.mjs` | The binary LLM judge: prompt, parsing, runner |
| `labeled.json` | Human-labeled answers used to validate the judges |
| `metrics.mjs` | Confusion matrix, TPR/TNR, F1, corrected pass rate, bootstrap interval |
| `run.mjs` | The runner. It calls the same `answer()` code the website uses |
| `analyze.mjs` | Samples traces for error analysis (open coding) |
| `error-analysis.md` | How to do the error-analysis loop that decides what to test next |
| `fixtures/outputs.json` | Recorded answers, with deliberate failures, used to test the harness itself |

## Running it
```bash
npm test                       # unit tests and a harness run on fixtures. Free, no API key.
npm run evals:fixtures         # the harness on recorded answers (never publishable)
OPENROUTER_API_KEY=... npm run evals:live -- --yes   # the real thing: about 200 API calls, roughly $1 to $3
node evals/analyze.mjs         # after a live run: sample traces for error analysis
```
A live run writes `evals/results/latest.json` and `traces.jsonl`. `node scripts/build-evals-page.mjs` regenerates the public `/evals/` page, which lists only the checks and test conversations.

## Honest limits
- **No real run has happened yet.** This session had no API key. The harness is tested end to end on fixtures (recorded answers with deliberate failures, and a scripted judge), so the plumbing and the math are verified, but there are no scores yet and none are published.
- **The labels are a first draft.** I wrote the 80 labeled answers by hand as realistic good and bad examples. Ethan should review them. A judge validated on labels nobody has audited is only as trustworthy as those labels.
- **The failure taxonomy is version 0.** It comes from the assistant's spec. Real error analysis on real conversations will find failure modes nobody guessed, and the taxonomy and the criteria should then change.
- **Twelve test items per judge is small.** The TPR and TNR are noisy at that size. The bootstrap interval says so honestly. More labels tighten it.
- **Code checks are rules, so they have blind spots.** The leak check looks for seven-word overlaps with the instructions. A paraphrased leak would slip past it, which is why the injection judge also exists.
