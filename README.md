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

The intended layout separates pure game logic from DOM rendering:

- `src/game/` — pure, framework-free game logic, tested with Vitest
- `src/ui/` — DOM rendering and interaction

Neither directory exists yet; they will be added as the game is built.
