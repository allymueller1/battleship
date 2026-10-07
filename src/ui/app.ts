import { playComputerTurn, type Difficulty } from '../game/ai';
import { isFleetComplete, shipAt } from '../game/board';
import { coordKey } from '../game/coord';
import { createGame, fire, startGame, type GameState } from '../game/game';
import type { Rng } from '../game/rng';
import { FLEET } from '../game/ships';
import { isShipSunk } from '../game/shots';
import type { Board, Coord } from '../game/types';
import { createBoardView, type CellView } from './boardView';
import { LEVELS, levelName } from './levels';
import { createFleetTracker } from './fleetTracker';
import {
  coordLabel,
  placementMessage,
  rejectionMessage,
  shotMessage,
  turnMessage,
} from './messages';
import {
  initialPlacement,
  pickUpAt,
  placeSelected,
  previewAt,
  randomizePlacement,
  rotate,
  selectShip,
  type PlacementState,
} from './placement';

const COMPUTER_DELAY_MS = 700;

const TEMPLATE = `
  <section class="intro" aria-labelledby="intro-title" data-ref="intro">
    <h1 id="intro-title" class="intro-title">Welcome to Battleship</h1>
    <p class="intro-subtitle">Sink the computer's fleet before it sinks yours.</p>
    <fieldset class="level-picker">
      <legend class="visually-hidden">Choose a level</legend>
      <div class="level-cards" data-ref="levelCards"></div>
    </fieldset>
    <p class="intro-note">No level can see your ships. Each one only knows its own hits and misses. A good human player usually needs about 50 to 60 shots.</p>
    <button type="button" class="primary intro-start" data-ref="introStart">Start</button>
  </section>
  <header class="top" data-ref="top">
    <h1>Battleship</h1>
    <button type="button" class="secondary" data-ref="newGame" hidden>New game</button>
  </header>
  <p class="status" role="status" aria-live="polite" data-ref="status"></p>
  <main class="layout" data-ref="layout">
    <section class="panel setup" aria-labelledby="setup-title" data-ref="setup">
      <h2 id="setup-title">Place your fleet</h2>
      <p class="hint">Choose a ship, then a cell on your board. Use the arrow keys to move, Enter to place, and R to rotate. Select a placed ship to move it.</p>
      <div class="ship-list" role="group" aria-label="Ships" data-ref="shipList"></div>
      <div class="controls">
        <button type="button" data-ref="rotate">Rotate</button>
        <button type="button" data-ref="randomize">Randomize</button>
      </div>
      <p class="level-line">Level: <strong data-ref="levelName"></strong> <button type="button" class="link-button" data-ref="changeLevel">Change</button></p>
      <button type="button" class="primary" data-ref="start">Start battle</button>
    </section>
    <section class="panel" aria-labelledby="enemy-title" data-ref="enemyPanel">
      <h2 id="enemy-title">Enemy waters</h2>
      <div data-ref="enemyBoard"></div>
      <div data-ref="enemyTracker"></div>
    </section>
    <section class="panel" aria-labelledby="player-title" data-ref="playerPanel">
      <h2 id="player-title">Your fleet</h2>
      <div data-ref="playerBoard"></div>
      <div data-ref="playerTracker"></div>
    </section>
  </main>
  <dialog class="end" aria-labelledby="end-title" data-ref="endDialog">
    <h2 id="end-title" data-ref="endTitle"></h2>
    <p data-ref="endText"></p>
    <button type="button" class="primary" data-ref="playAgain" autofocus>Play again</button>
  </dialog>
`;

function ref<T extends HTMLElement>(root: HTMLElement, name: string): T {
  const el = root.querySelector<T>(`[data-ref="${name}"]`);
  if (!el) {
    throw new Error(`Missing element: ${name}`);
  }
  return el;
}

function sunkCellKeys(board: Board): Set<string> {
  const keys = new Set<string>();
  for (const ship of board.ships) {
    if (isShipSunk(board, ship)) {
      ship.cells.forEach((c) => keys.add(coordKey(c)));
    }
  }
  return keys;
}

/** Wires the pure game logic to the DOM. `rng` is injectable so tests can seed it. */
export function mountApp(root: HTMLElement, rng: Rng = Math.random): void {
  root.innerHTML = TEMPLATE;
  const el = {
    newGame: ref<HTMLButtonElement>(root, 'newGame'),
    status: ref(root, 'status'),
    setup: ref(root, 'setup'),
    shipList: ref(root, 'shipList'),
    rotate: ref<HTMLButtonElement>(root, 'rotate'),
    randomize: ref<HTMLButtonElement>(root, 'randomize'),
    intro: ref(root, 'intro'),
    introStart: ref<HTMLButtonElement>(root, 'introStart'),
    levelCards: ref(root, 'levelCards'),
    top: ref(root, 'top'),
    layout: ref(root, 'layout'),
    levelName: ref(root, 'levelName'),
    changeLevel: ref<HTMLButtonElement>(root, 'changeLevel'),
    start: ref<HTMLButtonElement>(root, 'start'),
    enemyPanel: ref(root, 'enemyPanel'),
    endDialog: ref<HTMLDialogElement>(root, 'endDialog'),
    endTitle: ref(root, 'endTitle'),
    endText: ref(root, 'endText'),
    playAgain: ref<HTMLButtonElement>(root, 'playAgain'),
  };

  let screen: 'intro' | 'game' = 'intro';
  let game: GameState = createGame(rng);
  let placement: PlacementState = initialPlacement();
  let difficulty: Difficulty = 'normal';
  let hover: Coord | null = null;
  let message = '';
  let computerTimer: ReturnType<typeof setTimeout> | undefined;
  // Recomputed once per render; playerCell/enemyCell close over them.
  let playerSunk = new Set<string>();
  let enemySunk = new Set<string>();

  const playerView = createBoardView({
    label: 'Your fleet',
    onActivate: onPlayerCell,
    onHover: (c) => {
      hover = c;
      render();
    },
  });
  const enemyView = createBoardView({ label: 'Enemy waters', onActivate: onEnemyCell });
  const playerTracker = createFleetTracker('Your ships');
  const enemyTracker = createFleetTracker('Enemy ships');
  ref(root, 'playerBoard').append(playerView.element);
  ref(root, 'enemyBoard').append(enemyView.element);
  ref(root, 'playerTracker').append(playerTracker.element);
  ref(root, 'enemyTracker').append(enemyTracker.element);

  const shipButtons = FLEET.map((spec) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ship-button';
    button.addEventListener('click', () => {
      placement = selectShip(placement, spec.type);
      message = '';
      render();
    });
    el.shipList.append(button);
    return { spec, button };
  });

  for (const { level, name, description, averageShots } of LEVELS) {
    const label = document.createElement('label');
    label.className = 'level-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.className = 'level-input';
    input.name = 'difficulty';
    input.value = level;
    input.checked = level === difficulty;
    input.addEventListener('change', () => {
      difficulty = level;
      render();
    });
    const nameEl = document.createElement('span');
    nameEl.className = 'level-name';
    nameEl.textContent = name;
    const descEl = document.createElement('span');
    descEl.className = 'level-desc';
    descEl.textContent = description;
    const statEl = document.createElement('span');
    statEl.className = 'level-stat';
    statEl.textContent = 'About ';
    const strong = document.createElement('strong');
    strong.textContent = String(averageShots);
    statEl.append(strong, ' shots to sink your fleet');
    label.append(input, nameEl, descEl, statEl);
    el.levelCards.append(label);
  }

  el.introStart.addEventListener('click', () => {
    screen = 'game';
    render();
    shipButtons[0]?.button.focus();
  });

  el.changeLevel.addEventListener('click', () => {
    screen = 'intro';
    render();
    el.levelCards.querySelector<HTMLInputElement>('input:checked')?.focus();
  });

  el.rotate.addEventListener('click', () => {
    placement = rotate(placement);
    render();
  });
  el.randomize.addEventListener('click', () => {
    placement = randomizePlacement(placement, rng);
    message = 'Fleet placed at random. Start the battle, or select a ship to move it.';
    render();
  });
  el.start.addEventListener('click', () => {
    if (!isFleetComplete(placement.board)) {
      return;
    }
    game = startGame(game, placement.board);
    hover = null;
    message = `Battle started on ${levelName(difficulty)}.`;
    render();
    enemyView.focus();
  });
  el.newGame.addEventListener('click', reset);
  el.playAgain.addEventListener('click', reset);

  document.addEventListener('keydown', (event) => {
    if (screen !== 'game' || game.phase !== 'placing' || event.key.toLowerCase() !== 'r') {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    placement = rotate(placement);
    render();
  });

  function onPlayerCell(c: Coord): void {
    if (game.phase !== 'placing') {
      return;
    }
    const picked = placement.selected ? null : pickUpAt(placement, c);
    if (picked) {
      placement = picked;
      message = '';
    } else if (shipAt(placement.board, c) && placement.selected) {
      message = placementMessage('overlap', placement.selected);
    } else {
      const { state, error } = placeSelected(placement, c);
      placement = state;
      message = error ? placementMessage(error, placement.selected) : '';
    }
    render();
  }

  function onEnemyCell(c: Coord): void {
    const outcome = fire(game, 'player', c);
    if (!outcome.ok) {
      message = rejectionMessage(outcome.reason, c);
      render();
      return;
    }
    game = outcome.state;
    message = shotMessage('player', outcome.result);
    render();
    if (game.phase === 'over') {
      showEnd();
    } else {
      computerTimer = setTimeout(computerMove, COMPUTER_DELAY_MS);
    }
  }

  function computerMove(): void {
    computerTimer = undefined;
    const outcome = playComputerTurn(game, difficulty, rng);
    if (!outcome.ok) {
      return;
    }
    game = outcome.state;
    message = shotMessage('computer', outcome.result);
    render();
    if (game.phase === 'over') {
      showEnd();
    }
  }

  function showEnd(): void {
    const won = game.winner === 'player';
    const shots = won ? game.computerBoard.shots.size : game.playerBoard.shots.size;
    el.endTitle.textContent = won ? 'You win!' : 'You lose';
    el.endText.textContent = won
      ? `You sank the enemy fleet in ${shots} shots on ${levelName(difficulty)}.`
      : `The computer sank your fleet in ${shots} shots on ${levelName(difficulty)}.`;
    el.endDialog.showModal();
  }

  function reset(): void {
    clearTimeout(computerTimer);
    computerTimer = undefined;
    if (el.endDialog.open) {
      el.endDialog.close();
    }
    game = createGame(rng);
    placement = initialPlacement();
    hover = null;
    message = '';
    render();
    shipButtons[0]?.button.focus();
  }

  function playerCell(c: Coord): CellView {
    const label = coordLabel(c);
    if (game.phase === 'placing') {
      const preview = previewAt(placement, hover);
      const inPreview = preview?.cells.some((p) => coordKey(p) === coordKey(c));
      const ship = shipAt(placement.board, c);
      const classes: string[] = [];
      if (ship) classes.push('ship');
      if (inPreview) classes.push(preview?.valid ? 'preview-valid' : 'preview-invalid');
      const shipName = ship ? FLEET.find((s) => s.type === ship.type)?.name : undefined;
      return { classes, label: shipName ? `${label}, ${shipName}` : `${label}, empty` };
    }
    const board = game.playerBoard;
    const ship = shipAt(board, c);
    const mark = board.shots.get(coordKey(c));
    const sunk = playerSunk.has(coordKey(c));
    const classes = [ship ? 'ship' : '', mark ?? '', sunk ? 'sunk' : ''].filter(Boolean);
    const parts = [label, ship ? FLEET.find((s) => s.type === ship.type)?.name : 'water'];
    if (mark) parts.push(sunk ? 'sunk' : mark);
    return { classes, label: parts.join(', ') };
  }

  function enemyCell(c: Coord): CellView {
    const board = game.computerBoard;
    const key = coordKey(c);
    const mark = board.shots.get(key);
    const sunk = enemySunk.has(key);
    const revealed = game.phase === 'over' && shipAt(board, c) !== undefined;
    const classes = [mark ?? '', sunk ? 'sunk' : '', revealed ? 'ship' : ''].filter(Boolean);
    const state = sunk ? 'hit, ship sunk' : (mark ?? (revealed ? 'enemy ship' : 'not fired'));
    return { classes, label: `${coordLabel(c)}, ${state}` };
  }

  function render(): void {
    const intro = screen === 'intro';
    const placing = game.phase === 'placing';
    root.dataset.screen = intro ? 'intro' : placing ? 'placing' : 'battle';
    root.dataset.phase = placing ? 'placing' : 'battle';
    el.intro.hidden = !intro;
    el.top.hidden = intro;
    el.status.hidden = intro;
    el.layout.hidden = intro;
    el.levelName.textContent = levelName(difficulty);
    el.setup.hidden = !placing;
    el.enemyPanel.hidden = placing;
    el.newGame.hidden = placing;

    const status = [message, turnMessage(game)].filter(Boolean).join(' ');
    if (el.status.textContent !== status) {
      el.status.textContent = status;
    }

    playerSunk = sunkCellKeys(game.playerBoard);
    enemySunk = sunkCellKeys(game.computerBoard);

    playerView.setInteractive(placing);
    enemyView.setInteractive(game.phase === 'playing');
    playerView.update(playerCell);
    enemyView.update(enemyCell);
    playerTracker.update(game.playerBoard);
    enemyTracker.update(game.computerBoard);

    for (const { spec, button } of shipButtons) {
      const placed = placement.board.ships.some((s) => s.type === spec.type);
      const selected = placement.selected === spec.type;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('placed', placed);
      button.textContent = `${spec.name} (${spec.length})${placed ? ' ✓' : ''}`;
      button.setAttribute(
        'aria-label',
        `${spec.name}, length ${spec.length}, ${placed ? 'placed' : 'not placed'}`,
      );
    }
    el.rotate.textContent = `Rotate (${placement.orientation})`;
    el.start.disabled = !isFleetComplete(placement.board);
  }

  render();
}
