# Statements

Drop your credit-card and bank PDF statements in this folder, then run:

```
/statements
```

Everything in here **except this file is gitignored**, so real statements can't
be committed to the public repo. Verify before your first run:

```bash
git check-ignore -q statements/whatever.pdf; echo $?
```

`0` means ignored. `1` means it is **not** — stop and fix `.gitignore` before
committing anything. Check the exit status rather than the printed output:
`check-ignore -v` also prints a rule when a negation *re-includes* a file, so
seeing a line is not proof it's excluded.

## Naming

Anything readable works. The skill reads the issuer and period out of the PDF
itself, but clear names make the summary easier to follow:

```
statements/
  freedom-flex-2026-07.pdf
  discover-it-2026-07.pdf
  checking-2026-07.pdf
```

## What comes out

- A breakdown on screen of where every dollar went, by category and merchant.
- `budget-import-2026-07.json` — load it via **Settings → Data → Import
  statements** in the app. It merges into that month; it does not overwrite
  anything else.

## merchant-rules.json

Built up as you go. Once a merchant is categorised it stays categorised, so
repeat runs are fast and consistent.

**Gitignored, deliberately.** It carries no amounts, dates or account numbers —
but the merchant names are the specific shops, bars and services you actually
use, which on a public repo amounts to a map of where you spend your time. It
lives on your machine only. A fresh clone starts without it and the skill
rebuilds it on the first run.

Edit it by hand any time; the skill respects what's already there.
