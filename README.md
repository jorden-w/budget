# budget

A personal budgeting app that runs entirely in one HTML file.

No build step, no server, no account, no analytics. Open `index.html` and it
works. Everything you enter stays in your browser's local storage — nothing is
uploaded anywhere, because there is nowhere for it to go.

## Running it

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8899
```

Then visit `http://localhost:8899/index.html`. It's a PWA, so on a phone you can
add it to the home screen and it works offline.

## What it does

**Today** — what's actually free to spend after every card statement clears, the
next paycheck, and a day-by-day projection of your checking balance for the next
60 days. Bills and card statements land on their real dates, so a shortfall
shows up as a date rather than a vague sense of tightness.

**Plan** — income, then where it goes. Full 2026 federal brackets, FICA with the
Social Security wage base, and all 50 states, so the take-home figure is a real
one. A Traditional/Roth 401(k) split with the employer match modelled, and an
ordered priority waterfall where money flows down a list, respects annual caps,
and cascades the overflow.

**Spend** — categories against budget, with actuals either typed in or derived
from imported statements. Transactions can be edited, split between people or
across categories, and searched across every month.

**Bills** — a due-date calendar, credit cards with their rotating quarterly
bonus categories, a which-card-to-use picker, and recurring charges detected
from your own statements including price rises.

**Grow** — emergency fund, car buyout and running costs, retirement contribution
limits, net worth over time, and a rent affordability calculator.

## Ideas it's opinionated about

- **A credit card balance is a claim on checking, not an expense.** Counting the
  purchases *and* the payment double-counts the money.
- **Money you fronted for other people is a debt owed to you**, not a silent
  exclusion — it stays visible until it's repaid or you decide it never will be,
  and only the unpaid part ever becomes your spending.
- **Biweekly pay is 2.1667 cheques a month**, not 2. The two extra paycheque
  months get called out rather than quietly smeared across the year.
- **A return needs a denominator you actually know.** Performance on a pool of
  money is measured time-weighted across balance marks, not profit over
  deposits, and it declines to report anything until it has enough marks.

## Tests

There's no build step, so the file ships its own test runner:

```
index.html?test=1
```

It renders an assertion suite over the pure functions — tax, waterfall, car
costs, rollover, splits, forecasting, migrations — instead of the app.

## Statements

`.claude/skills/statements/` is a skill for reading credit-card and bank PDFs,
categorising the purchases and producing an import file the app merges into the
right month. Drop statements into `statements/` and run `/statements`.

Statements, generated import files, and the learned merchant rules are all
gitignored. This repo is public; that data is not.

## Layout

```
index.html        the whole app, sectioned §1–§16
legacy-v2.html    the original paycheck allocator, kept for reference
sw.js             service worker, so it works offline
manifest.json     PWA manifest
statements/       drop statements here (gitignored)
```
