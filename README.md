# Battleship

Play the classic board game Battleship against a computer opponent in your
browser, with three difficulty levels to choose from.

## Getting started

Requires Node.js 22 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

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
- `src/ui/` — DOM rendering and interaction (planned, not yet built)

All of `src/game/` is pure, immutable logic tested with Vitest; tests live
next to their modules as `<module>.test.ts`.
