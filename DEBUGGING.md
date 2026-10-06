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

### 2. Starting a game with pre-fired shots

- **What happened:** `startGame` accepted a player board that already had
  shots recorded on it, so a game could begin with pre-fired hits.
- **How it was found:** Devin Review on PR 2. Confirmed with a failing
  regression test.
- **Root cause:** `startGame` checked the phase and fleet completeness but
  never checked `playerBoard.shots`.
- **Fix:** `startGame` now throws when `playerBoard.shots.size > 0`.
  Covered by 'rejects a board that already has shots' (game.test.ts).
- **PR:** https://github.com/allymueller1/battleship/pull/2

### 3. Aliased coordinates break immutability

- **What happened:** Mutating a caller's coordinate object after `placeShip`
  or `fireShot` changed already-recorded game state — a ship's stored
  `origin` and a shot result's `coord` referenced the caller's object.
- **How it was found:** Devin Review on PR 2. Confirmed with a failing
  regression test.
- **Root cause:** `placeShip` stored the `origin` reference in `PlacedShip`,
  and `fireShot` put the `coord` reference into `ShotResult`; neither made
  a defensive copy.
- **Fix:** `placeShip` stores `{ ...origin }` and `fireShot` uses a copied
  `shot` in every result branch. Covered by 'stores a copy of the origin,
  not the caller object' (board.test.ts) and 'stores a copy of the coord in
  the result, not the caller object' (shots.test.ts).
- **PR:** https://github.com/allymueller1/battleship/pull/2

### 4. Rejected computer turns consumed randomness

- **What happened:** A `playComputerTurn` call that was later rejected (the
  player's turn, still placing, game over) still drew from the seeded rng,
  so every subsequent computer shot came out different — a rejected move
  had a side effect.
- **How it was found:** Devin Review on PR 3. Confirmed with a failing
  regression test.
- **Root cause:** `playComputerTurn` called `chooseShot`, which draws from
  `rng`, before `fire` got the chance to reject the move on phase or turn
  grounds.
- **Fix:** New `turnRejection` helper in game.ts performs the phase/turn
  checks; `fire` uses it, and `playComputerTurn` returns the rejection
  before calling `chooseShot`. Covered by 'does not draw from the rng when
  the turn is rejected' and 'a rejected call does not change the next
  computer shot' (ai/index.test.ts), plus 'covers all four results'
  (game.test.ts).
- **PR:** https://github.com/allymueller1/battleship/pull/3

### 5. Hover colour hid the placement preview under the mouse

- **What happened:** While placing a ship, the cell under the mouse showed
  the plain hover colour instead of green or orange. The cell you're
  pointing at is the ship's starting cell, so you couldn't tell whether
  that cell itself was valid.
- **How it was found:** My own browser testing, from a screenshot taken
  while hovering a carrier that hung off the right edge.
- **Root cause:** The CSS hover rule `.board:not(.board--passive) .cell:hover`
  is more specific than `.cell.preview-valid` / `.cell.preview-invalid`,
  so on the hovered cell it won.
- **Fix:** The hover rule now skips cells that are showing a preview, a hit
  or a sunk ship (`:not(.preview-valid, .preview-invalid, .hit, .sunk)`).
  Checked in the browser: the hovered origin cell now computes to the
  invalid-preview orange.
- **PR:** https://github.com/allymueller1/battleship/pull/4

### 6. Boards cut off at medium desktop widths

- **What happened:** At viewport widths of about 832–990px, the two-column
  battle layout was wider than the window. The right-hand "Your fleet"
  board was cut off (columns H–J hidden) and the page scrolled sideways.
- **How it was found:** Devin Review on PR 4. Confirmed in the browser: at
  832px the page was 965px wide and the board was clipped (before
  screenshot).
- **Root cause:** The layout switched to two columns at 52rem (832px). Two
  boards with fixed-size cells need about 980px, so the grid columns grew
  past the window.
- **Fix:** The layout switches to two columns only at 62rem, the width
  where two padded boards fit. Below that, the boards stack.
- **PR:** https://github.com/allymueller1/battleship/pull/4

### 7. Sunk enemy ships looked like ordinary hits

- **What happened:** After you sank an enemy ship, its cells kept the dark
  hit colour instead of turning the sunk red, so you couldn't tell a sunk
  ship from hits on a ship still afloat. Your own sunk ships looked right.
- **How it was found:** Devin Review on PR 4. Confirmed in the browser: a
  sunk enemy cell computed to the hit colour rgb(58, 36, 48) instead of
  `--sunk` #7a1d22 (before screenshot).
- **Root cause:** `.cell.hit:not(.ship)` is more specific than `.cell.sunk`.
  Enemy cells don't get `.ship` until the game ends, so the hit rule always
  won on them.
- **Fix:** The hit rule now skips sunk cells
  (`.cell.hit:not(.ship, .sunk)`).
- **PR:** https://github.com/allymueller1/battleship/pull/4
