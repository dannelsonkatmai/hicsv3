/*
# Fix UTC date shift on date column defaults

## Problem
The `time_entries.work_date` and `cost_records.incurred_on` columns are `date`
columns with `DEFAULT CURRENT_DATE`. The Postgres server runs in UTC, so
`CURRENT_DATE` returns the UTC calendar date. For users in negative UTC offsets
(e.g. AKDT −8h), after 4 pm local time the UTC date rolls to the next day.
If the application ever omits the date on an insert (e.g. an empty string
parsed as NULL), the column silently picks up the wrong (UTC) date instead of
the user's local date.

## Fix
Remove the `DEFAULT CURRENT_DATE` from both columns. The application already
sends `todayLocal()` (the user's local calendar date) on every insert. Removing
the default means a missing date produces an explicit NOT NULL error rather
than a silently wrong UTC date — fail-fast over silent data corruption.

## Tables modified
- `time_entries` — `work_date` default removed
- `cost_records` — `incurred_on` default removed

No columns are dropped, renamed, or retyped. Existing rows are untouched.
*/

ALTER TABLE time_entries ALTER COLUMN work_date DROP DEFAULT;
ALTER TABLE cost_records ALTER COLUMN incurred_on DROP DEFAULT;
