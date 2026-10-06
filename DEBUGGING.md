# Debugging log

This file is a log of every bug found during development, including ones caught
in self-testing, so that recurring failure modes stay visible.

## Entry template

- **What happened:**
- **How it was found:**
- **Root cause:**
- **Fix:**
- **PR:**

## Entries

### 1. Fractional coordinates accepted as valid

- **What happened:** A coordinate like `{ row: 0.5, col: 0 }` passed the
  bounds check, so a ship could be placed off the integer grid where no
  shot can ever reach it, making the game unwinnable.
- **How it was found:** Devin Review on PR 2. Confirmed with a failing
  regression test.
- **Root cause:** `isInBounds` only compared `row`/`col` against 0 and
  `BOARD_SIZE`; fractional and NaN values satisfy those comparisons.
- **Fix:** `isInBounds` now requires `Number.isInteger` on both components.
  Covered by 'rejects non-integer coords' (coord.test.ts), 'rejects a
  fractional origin' (board.test.ts) and the fractional `fire` rejection in
  game.test.ts.
- **PR:** https://github.com/allymueller1/battleship/pull/2
