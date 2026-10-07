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

### 8. Picking up a placed ship forgot which way it faced

- **What happened:** Clicking a placed ship's button to move it kept
  whatever orientation was last used, not the ship's own. A vertical ship
  would suddenly preview horizontally, and putting it back in its old spot
  was rejected.
- **How it was found:** Devin Review on PR 4. Confirmed with a failing
  regression test.
- **Root cause:** `selectShip` removed the ship but kept
  `state.orientation`. Only `pickUpAt` (clicking the ship on the board)
  restored it.
- **Fix:** `selectShip` restores the placed ship's orientation, and
  `pickUpAt` reuses it. Covered by 'selecting a placed ship restores its
  orientation' and 'selecting an unplaced ship keeps the current
  orientation' (placement.test.ts).
- **PR:** https://github.com/allymueller1/battleship/pull/4

### 9. The board was cut off on phones

- **What happened:** On screens narrower than about 470px (most phones),
  both boards were slightly wider than their panel. Column J and the
  "Afloat"/"Sunk" labels were cut off at the right edge, and the page could
  scroll sideways.
- **How it was found:** Taking "before" screenshots of the live site at
  phone size (390px, mobile emulation) for the design pass. The PR 4 phone
  check missed it.
- **Root cause:** The cell size was `(100vw - 3rem) / 11`, but the page and
  panel padding add up to 3.5rem, and the 10 gaps between cells (20px) were
  not counted at all, so the board overflowed by about 28px.
- **Fix:** Panels are now CSS size containers, and the cell size is worked
  out from the panel's own width, including the gaps:
  `min(2.4rem, calc((100cqi - 10 * var(--gap)) / 11))`. Checked from 360px
  to 1280px wide with no overflow.
- **PR:** https://github.com/allymueller1/battleship/pull/6

### 10. The enemy board stayed clickable during the computer's turn

- **What happened:** If you clicked Enemy waters again while the computer
  was taking its turn, the result of the shot you had just fired ("You
  fired at A1: miss.") was replaced by "Hold on, it's the computer's turn."
  The board also still lit up under the mouse, as if it were your turn. No
  extra shot was fired.
- **How it was found:** Devin QA session (scripted browser run against the
  live site). Filed as issue #7 and confirmed with a failing regression
  test.
- **Root cause:** `render()` made the enemy board interactive whenever the
  game was in the playing phase, without checking whose turn it was.
- **Fix:** The rules for which board is clickable now live in
  `boardInteractivity` (src/ui/interactivity.ts). The enemy board is only
  interactive when `turnRejection(state, 'player')` is null. Covered by
  'neither board is interactive on the computer's turn'
  (interactivity.test.ts).
- **PR:** https://github.com/allymueller1/battleship/pull/9

### 11. On phones, a red preview covered the ship you had just placed

- **What happened:** On a phone, tapping a cell to place a ship turned that
  ship red straight away, as if the placement had failed. It was really the
  next ship's "doesn't fit" preview, drawn where your finger had been, and
  it stayed there until your next tap.
- **How it was found:** Devin QA session (scripted browser run against the
  live site with phone touch emulation). Filed as issue #8 and confirmed
  with before/after screenshots.
- **Root cause:** The board took its hover cell from `mouseover` and
  `focusin`, and browsers fire both on a tap. Touch never sends
  `mouseleave`, so the hover cell was never cleared.
- **Fix:** Hover now comes from `pointerover` for mouse and pen only, and
  from `focusin` only for keyboard focus (`:focus-visible`). The hover
  highlight in the CSS only applies on devices that can hover
  (`@media (hover: hover)`).
- **PR:** https://github.com/allymueller1/battleship/pull/10
