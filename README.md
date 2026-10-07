# Battleship

Play the classic board game Battleship against a computer opponent in your
browser, with three difficulty levels to choose from.

![A game in progress: enemy waters on the left, your fleet on the right](docs/screenshot.png)

## Getting started

Requires Node.js 22 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

## Deployment

Every push to `main` runs the full CI checks (lint, format, typecheck, tests
with coverage, build) and deploys `dist/` to GitHub Pages only if they pass:
https://allymueller1.github.io/battleship/

The deploy workflow (`.github/workflows/deploy.yml`) reuses
`.github/workflows/ci.yml` via `workflow_call`, so pull requests and deploys
run the same checks. Pages must be set to **GitHub Actions** under
Settings → Pages.

## Scripts

| Command                | Description                        |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Start the Vite dev server          |
| `npm run build`        | Typecheck and build for production |
| `npm run preview`      | Preview the production build       |
| `npm run typecheck`    | Typecheck without emitting         |
| `npm test`             | Run tests once with Vitest         |
| `npm run test:watch`   | Run tests in watch mode            |
| `npm run coverage`     | Run tests with coverage            |
| `npm run lint`         | Lint with ESLint                   |
| `npm run format`       | Format with Prettier               |
| `npm run format:check` | Check formatting with Prettier     |

## Project structure

The layout separates pure game logic from DOM rendering:

- `src/game/types.ts` — shared types: coords, ships, boards, shot results
- `src/game/coord.ts` — coordinate keys, bounds checks, neighbors
- `src/game/ships.ts` — the five-ship fleet spec
- `src/game/rng.ts` — seedable RNG (mulberry32) injected everywhere
- `src/game/board.ts` — board creation and ship placement
- `src/game/shots.ts` — shot resolution and fleet status
- `src/game/game.ts` — game state, turn order, win detection
- `src/game/ai/view.ts` — what the opponent can see: untried cells, unresolved hits
- `src/game/ai/easy.ts` — easy opponent: uniform random untried cell
- `src/game/ai/normal.ts` — normal opponent: checkerboard hunt, then targets hit lines
- `src/game/ai/hard.ts` — hard opponent: probability-density targeting (argmax shot)
- `src/game/ai/index.ts` — difficulty dispatch and the computer's turn
- `src/main.ts` — entry point, mounts the app
- `src/ui/app.ts` — mounts the app and wires placement, battle and end screens
- `src/ui/boardView.ts` — accessible, keyboard-navigable board grid
- `src/ui/fleetTracker.ts` — afloat/sunk list per side
- `src/ui/levels.ts` — level names, descriptions and average shots for the intro cards
- `src/ui/placement.ts` — pure placement state
- `src/ui/messages.ts` — status and shot message text

All of `src/game/` is pure, immutable logic tested with Vitest; tests live
next to their modules as `<module>.test.ts`.
