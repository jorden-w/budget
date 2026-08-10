---
name: statements
description: Read credit-card and bank PDF statements, categorise every purchase, and produce a spending breakdown plus an import file for the budget app. Use when the user drops statements in statements/ or asks where their money went, to categorise purchases, to reconcile a month, or to import spending into the budget app. Triggers on "statements", "categorise my spending", "where did my money go", "import my transactions", "reconcile last month".
---

# Statements

Turn PDF statements into a categorised picture of where every dollar went, and
an import file the budget app can merge into the right month.

## What this produces

1. **A breakdown on screen** — totals per budget category, top merchants inside
   each, and anything that couldn't be categorised.
2. **`budget-import-<month>.json`** — loaded via **Settings → Data → Import
   statements**. It merges into that month and touches nothing else.

## Before anything else: check the files are ignored

These are real financial documents and `jorden-w/budget` is public.

```bash
for f in statements/*; do git check-ignore -q "$f" && echo "ok   $f" || echo "EXPOSED $f"; done
```

Check the **exit status**, not the printed output: `git check-ignore -v` prints
a rule even when a negation *re-includes* a file, so seeing a line is not proof
it's excluded. Anything reported `EXPOSED` means stop and say so before doing
anything else — a committed statement stays in git history forever, including
after deletion.

If the repo isn't a git repo yet, note that and carry on.

`merchant-rules.json` is itself gitignored, so it may not exist on a fresh
clone. Create it from the shape below if it's missing rather than failing.

## Step 1 — find the statements

```bash
ls -la statements/
```

If the folder is empty, tell the user where to put files and stop. Don't invent
transactions or work from memory.

## Step 2 — extract the text

Use the **pdf** skill to pull text out of each PDF. Statement layouts differ by
issuer, so extract first and read what's actually there rather than assuming a
format.

If a PDF is scanned rather than digital, the pdf skill's OCR path is needed —
say so, because OCR'd amounts need a closer look before they're trusted.

## Step 3 — parse transactions

Read the extracted text and pull out every transaction. For each one:

| Field | Notes |
|---|---|
| `date` | ISO `YYYY-MM-DD`. Statements often omit the year — take it from the statement period, and watch the December/January boundary. |
| `description` | The raw statement string, unmodified. It's the audit trail. |
| `merchant` | Cleaned name for grouping: `HARRIS TEETER #481 RALEIGH NC` → `Harris Teeter`. Strip store numbers, cities, and processor prefixes (`SQ *`, `TST*`, `PAYPAL *`). |
| `amount` | Positive number for money spent. Statements sign these inconsistently; normalise. |
| `source` | Which card or account, e.g. `Freedom Flex`. Take it from the statement header. |

**Do not guess at unreadable numbers.** If a line is ambiguous, include it and
flag it in the summary rather than inventing a value.

## Step 4 — exclude what isn't spending

This is the step that decides whether the totals are right.

A **credit-card payment from checking is not spending** — it's the same money as
the purchases already itemised on that card's statement. Counting both
double-counts it. Same for transfers between your own accounts, income, refunds
that offset a purchase, and rewards redemptions.

`statements/merchant-rules.json` holds the `exclude` list. Mark matches with
`"excluded": true` and an `excludeReason` — keep them in the output so they're
visible and reversible, rather than dropping them silently.

Read the whole set before deciding: if checking shows a $412 payment and a card
statement shows $412 of purchases the same month, the purchases are the real
spending and the payment is the exclusion.

### Money coming in from a person is its own case

A Venmo, Zelle or Cash App **credit** is almost never income — it's someone
paying back a charge the user fronted. It is neither spending nor earnings: it
cancels a debt. Counting it as income inflates their earnings with money that
was always theirs; ignoring it entirely leaves the debt open forever.

Mark these `"repayment": true` and say which fronted charge you think they
settle. The `repayments` list in `merchant-rules.json` has the strings to watch
for. **Check the direction first** — the same merchant strings appear on money
going out, which is ordinary spending or a fronted charge, not a repayment.

## Step 5 — categorise

For each transaction, in order:

1. **`statements/merchant-rules.json`** — first `match` that is a case-insensitive
   substring of the description wins. Existing rules always take precedence, so
   categories stay stable month to month. These are `"confidence": "high"`.
2. **Your judgement** for anything unmatched, using the list in `_categories`.
3. **Leave it uncategorised** (`"bucketName": null`) if you genuinely can't tell.

### Say when you're unsure — don't quietly guess

Every transaction carries a `confidence` of `"high"` or `"low"`. Mark it **low**
whenever a reasonable person could disagree, and the app will put it in the
"Needs your call" list for the user to confirm in one tap.

Mark **low** when:

- The merchant sells across categories — a convenience store could be fuel or
  snacks; a big-box store could be groceries or household.
- The name is opaque — `SQ *4471`, a bare payment-processor string, a trading name
  that says nothing about what was sold.
- It could be personal or work — and **work-expensed items should be
  `"excluded": true` with `"excludeReason": "expensed by work"`, not categorised
  as spending**, since they're reimbursed.
- It's an unusually large amount for its category, which often means it's
  something else.

A wrong category that looks confident is worse than a flagged one: it lands in a
total and quietly skews it. Flagging costs the user one tap; a silent mistake
costs them a wrong budget.

**Then add what you learned back to `merchant-rules.json`** — but only rules you
would mark high-confidence. A category the user has confirmed by hand is exactly
that: write the rule so the same merchant never gets flagged twice. Never add a
rule for something still unresolved, and never rewrite or reorder existing rules.

A rule's `category` is the card-rewards taxonomy in `_categories`; add
`bucketName` where the budget category differs. A barber is rewards-category
`other` but budget category `Personal care`, and only `bucketName` gets that
right.

## Step 5b — split what wasn't all yours

If a charge covered other people, or spans categories, emit a `split` and the
app will divide it:

```json
{
  "date": "2026-07-20",
  "description": "TICKETS ONLINE 800-555-0100",
  "merchant": "Ticket vendor",
  "amount": 277.00,
  "bucketName": "Fun money",
  "split": { "ways": 5, "yourShare": 55.40 }
}
```

Only the user's share counts as their spending. The remainder does **not**
vanish — it becomes money **owed to them**, which stays on the books until it's
repaid or written off. That distinction matters: excluding it outright quietly
assumes everyone pays up, and if they don't, the month's spending is understated
by whatever went unpaid.

Parts must be positive and sum to the original charge. A `yourShare` larger than
the charge is a misread, not a split.

**Ask rather than assume** — a large ticket, restaurant or travel charge is often
a group buy, and there's no way to tell from the statement. If it looks like one,
flag it and ask.

For a charge that spans categories rather than people, send explicit parts —
these are just spending, and nothing is owed back:

```json
{ "split": { "parts": [
  { "amount": 62.10, "bucketName": "Groceries" },
  { "amount": 18.40, "bucketName": "Shopping" }
] } }
```

## Step 6 — write the import file

```json
{
  "type": "budget-statement-import",
  "version": 1,
  "month": "2026-07",
  "fileId": "freedom-flex-2026-07.pdf|discover-it-2026-07.pdf",
  "generatedAt": "2026-08-05T14:00:00Z",
  "sources": [
    { "file": "freedom-flex-2026-07.pdf", "label": "Freedom Flex", "transactionCount": 62 }
  ],
  "transactions": [
    {
      "date": "2026-07-03",
      "description": "HARRIS TEETER #481 RALEIGH NC",
      "merchant": "Harris Teeter",
      "amount": 88.14,
      "category": "groceries",
      "bucketName": "Groceries",
      "confidence": "high",
      "source": "Freedom Flex"
    },
    {
      "date": "2026-07-05",
      "description": "7-ELEVEN 12345 SPRINGFIELD IL",
      "merchant": "7-Eleven",
      "amount": 7.56,
      "category": "gas",
      "bucketName": "Gas",
      "confidence": "low",
      "source": "Freedom Flex"
    },
    {
      "date": "2026-07-08",
      "description": "AUTOMATIC PAYMENT - THANK YOU",
      "merchant": "Payment",
      "amount": 412.00,
      "excluded": true,
      "excludeReason": "card payment",
      "source": "Freedom Flex"
    },
    {
      "date": "2026-08-02",
      "description": "VENMO CASHOUT",
      "merchant": "Venmo",
      "amount": 110.80,
      "repayment": true,
      "settlesNote": "probably two of the four tickets from 2026-07-20",
      "source": "Checking"
    }
  ]
}
```

Rules for the file:

- **`month`** is required — one file per calendar month. Statements that straddle
  months split into separate files by transaction date, not by statement period.
- **`fileId`** must be stable for the same set of source files. It's how the app
  refuses a duplicate import.
- **`bucketName`** should match a category in the user's app when you're confident
  (`Groceries`, `Gas`, `Subscriptions`, `Fun money`). `category` is the fallback
  the app maps through. Supply both when you can.
- **`repayment`** lines carry no category and no amount of spending. They need a
  human to say which fronted charge they settle, so ask in the report rather
  than picking one.
- Write it to the **project root**, not into `statements/`.

## Step 7 — report

Show category totals against budget, top merchants, exclusions, and anything
uncategorised:

```
July 2026 · 2 statements · 147 transactions
────────────────────────────────────────────
Groceries        $412.33    budget $350   ▲ $62
  Harris Teeter  $268.40  (6)
  Trader Joe's   $ 98.15  (2)
Gas              $118.40    budget $140   ▼ $22
Dining           $205.10    budget $120   ▲ $85
────────────────────────────────────────────
Total spending   $1,842.15
Excluded         $  412.00  card payment
                 $  289.00  expensed by work
Owed to you      $  221.60  fronted for others, unpaid
Needs review     $  173.40  (18 lines) — 4 uncategorised,
                            14 low-confidence guesses
```

**Then ask about the ones you flagged**, grouped so it's a handful of questions
rather than eighteen. Repeated merchants collapse into one: "7-Eleven appears 8
times at $7–15 — fuel, or snacks?" is one question, not eight.

Finally say the file is written and how to load it.

## Things that go wrong

- **Same purchase on two statements.** A card payment appearing as both a
  checking debit and card purchases. Step 4 exists for this.
- **Statement period ≠ calendar month.** A statement running 15 Jun – 14 Jul
  covers two budget months. Split by transaction date.
- **Refunds.** A return offsets its original purchase. Net them within the
  category rather than recording a negative that looks like income.
- **A repayment landing in a later month than the charge.** Concert tickets in
  July, the Venmo in August. They still cancel each other — don't file the
  August credit as August income, and don't leave the July debt open.
- **Pending vs posted.** Use posted transactions; pending ones change.
- **Annual fees and interest** are real spending — categorise them, don't exclude
  them.
- **The user already edited a transaction in the app.** Re-importing won't
  overwrite it; the app protects hand-edited lines. Mention it if it's relevant.

## Privacy

- Never print full account numbers. Last four digits at most.
- Never write statement contents outside this project.
- The import file contains full transaction history and is gitignored — leave it
  that way.
- If asked to commit, check `git status` first and refuse if any statement or
  import file is staged.
