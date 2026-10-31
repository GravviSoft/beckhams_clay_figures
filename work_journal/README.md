# Daily engineering journal

Journaling is an essential task, not an end-of-session afterthought. Create or
append `work_journal/YYYY-MM-DD.txt` as work progresses: when an investigation
concludes, when a plan is set, and when a change is implemented and verified.
If work continues on the same date, append to that file.

The journal is the session log; the root `README.md` is the current operating
manual. Future sessions read both (README first, then the latest journal)
before making product or architecture decisions.

## AI attribution

Every new note or appended workstream begins with exactly one of these
headings, placed immediately before the note it identifies:

```md
# AI Used: ChatGPT
```

```md
# AI Used: Claude
```

Repeat the heading for every new note; attribution never carries forward from
the previous note. Do not rewrite older history.

## Entry structure

```md
# AI Used: Claude

- Workstream title:
  - Reason:            why the change was needed
  - Investigation:     what was inspected, traced, or reproduced
  - Root cause:        what actually caused the issue
  - Change made:       what changed in code, behavior, or structure
  - Why this approach: why this fix over the alternatives (shared, local, temporary, structural)

- Files touched:
- Database changes or migrations applied:
- Tests and verification commands run:
- Results:             what passed, what was not verified, remaining risk
- Current blockers or risks:
- Prevent next time:
- Important implementation decisions:
```

Group entries by workstream, not minute-by-minute. Journals are committed to
git. When starting a new app from this starter, begin with an empty journal;
do not copy another project's history.
