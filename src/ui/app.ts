import { playComputerTurn, type Difficulty } from '../game/ai';
import { isFleetComplete, shipAt } from '../game/board';
import { coordKey } from '../game/coord';
import { createGame, fire, startGame, type GameState } from '../game/game';
import type { Rng } from '../game/rng';
import { FLEET, getShipSpec } from '../game/ships';
import { isShipSunk } from '../game/shots';
import type { Board, Coord, PlacedShip, ShotResult } from '../game/types';
import { createBoardView, type CellView, type ShipSprite } from './boardView';
import { shipSvg } from './shipArt';
import { LEVELS, levelName } from './levels';
import { createFleetTracker } from './fleetTracker';
import {
  coordLabel,
  endSummary,
  placementMessage,
  rejectionMessage,
  shotMessage,
  turnMessage,
} from './messages';
import {
  dragOrigin,
  dropDrag,
  initialPlacement,
  pickUpAt,
  placeSelected,
  previewAt,
  randomizePlacement,
  rotate,
  selectShip,
  startDrag,
  type Drag,
  type PlacementState,
} from './placement';
import { boardInteractivity } from './interactivity';
import {
  addScore,
  browserStore,
  clearLeaderboard,
  emptyLeaderboard,
  LEADERBOARD_KEY,
  loadLeaderboard,
  localDateString,
  rankMessage,
  saveLeaderboard,
  type Leaderboard,
  type ScoreStore,
} from './leaderboard';
import { effectForShot, SHAKE_MS, VICTORY_DELAY_MS } from './effects';
import { shipDisplayName } from './theme';
import { BRIEFING_LINES, createTitleScreen } from './titleScreen';

export const COMPUTER_DELAY_MS = 700;
export const END_SCREEN_DELAY_MS = 1200;

const TEMPLATE = `
  <div class="starfield" aria-hidden="true"><div class="stars stars--far"></div><div class="stars stars--near"></div></div>
  <section class="title-screen" data-ref="title">
    <h1 class="title-logo">Nebula Strike</h1>
    <p class="visually-hidden">${BRIEFING_LINES.join(' ')}</p>
    <div class="briefing" data-ref="briefing" aria-hidden="true">
      ${BRIEFING_LINES.map(() => '<p class="briefing-line"></p>').join('')}
    </div>
    <button type="button" class="primary launch" data-ref="launch" hidden>Launch</button>
  </section>
  <section class="intro" aria-labelledby="intro-title" data-ref="intro">
    <h1 id="intro-title" class="intro-title">Choose your mission</h1>
    <p class="intro-subtitle">Destroy the enemy fleet before it destroys yours.</p>
    <fieldset class="level-picker">
      <legend class="visually-hidden">Choose a level</legend>
      <div class="level-cards" data-ref="levelCards"></div>
    </fieldset>
    <p class="intro-note">No level can see your ships. Each one only knows its own hits and misses. A good human player usually needs about 50 to 60 shots.</p>
    <button type="button" class="primary intro-start" data-ref="introStart">Start mission</button>
    <section class="leaderboard" aria-labelledby="leaderboard-title" data-ref="leaderboard">
      <h2 id="leaderboard-title">Your best wins</h2>
      <div class="leaderboard-levels" data-ref="leaderboardLevels"></div>
      <button type="button" class="link-button" data-ref="clearScores">Clear scores</button>
    </section>
  </section>
  <header class="top" data-ref="top">
    <h1>Nebula Strike</h1>
    <button type="button" class="secondary" data-ref="newGame" hidden>New game</button>
  </header>
  <div class="status" role="status" aria-live="polite" data-ref="status">
    <p class="status-line" data-ref="playerResult" hidden></p>
    <p class="status-line" data-ref="computerResult" hidden></p>
    <p class="status-line status-turn" data-ref="statusTurn"></p>
  </div>
  <main class="layout" data-ref="layout">
    <section class="panel setup" aria-labelledby="setup-title" data-ref="setup">
      <h2 id="setup-title">Deploy your fleet</h2>
      <p class="hint">Choose a ship, then a cell on your board. Use the arrow keys to move, Enter to place, and R to rotate. Drag a placed ship to move it, or select it and choose a new cell.</p>
      <div class="ship-list" role="group" aria-label="Ships" data-ref="shipList"></div>
      <div class="controls">
        <button type="button" data-ref="rotate">Rotate</button>
        <button type="button" data-ref="randomize">Randomize</button>
      </div>
      <p class="level-line">Level: <strong data-ref="levelName"></strong> <button type="button" class="link-button" data-ref="changeLevel">Change</button></p>
      <button type="button" class="primary" data-ref="start">Start battle</button>
    </section>
    <section class="panel" aria-labelledby="enemy-title" data-ref="enemyPanel">
      <h2 id="enemy-title">Enemy sector</h2>
      <div data-ref="enemyBoard"></div>
      <div data-ref="enemyTracker"></div>
    </section>
    <section class="panel" aria-labelledby="player-title" data-ref="playerPanel">
      <h2 id="player-title">Your fleet</h2>
      <div data-ref="playerBoard"></div>
      <div data-ref="playerTracker"></div>
    </section>
  </main>
  <dialog class="end" aria-labelledby="end-title" aria-describedby="end-text" data-ref="endDialog">
    <h2 id="end-title" data-ref="endTitle"></h2>
    <p id="end-text" class="end-text" data-ref="endText"></p>
    <p class="end-rank" data-ref="endRank" hidden></p>
    <dl class="end-stats" data-ref="endStats"></dl>
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

function shipSprite(ship: PlacedShip, state: 'intact' | 'wreck'): ShipSprite {
  return {
    type: ship.type,
    origin: ship.origin,
    orientation: ship.orientation,
    length: getShipSpec(ship.type).length,
    state,
  };
}

export interface MountOptions {
  readonly reducedMotion?: () => boolean;
  readonly storage?: ScoreStore | null;
}

/** Wires the pure game logic to the DOM. `rng` is injectable so tests can seed it. */
export function mountApp(
  root: HTMLElement,
  rng: Rng = Math.random,
  options: MountOptions = {},
): void {
  const reducedMotion =
    options.reducedMotion ??
    (() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const store = options.storage === undefined ? browserStore() : options.storage;
  let leaderboard: Leaderboard = loadLeaderboard(store);
  let lastRank: number | null = null;
  root.innerHTML = TEMPLATE;
  const el = {
    newGame: ref<HTMLButtonElement>(root, 'newGame'),
    status: ref(root, 'status'),
    playerResult: ref(root, 'playerResult'),
    computerResult: ref(root, 'computerResult'),
    statusTurn: ref(root, 'statusTurn'),
    setup: ref(root, 'setup'),
    shipList: ref(root, 'shipList'),
    rotate: ref<HTMLButtonElement>(root, 'rotate'),
    randomize: ref<HTMLButtonElement>(root, 'randomize'),
    title: ref(root, 'title'),
    briefing: ref(root, 'briefing'),
    launch: ref<HTMLButtonElement>(root, 'launch'),
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
    endRank: ref(root, 'endRank'),
    endStats: ref(root, 'endStats'),
    playAgain: ref<HTMLButtonElement>(root, 'playAgain'),
    leaderboardLevels: ref(root, 'leaderboardLevels'),
    clearScores: ref<HTMLButtonElement>(root, 'clearScores'),
  };

  let screen: 'title' | 'intro' | 'game' = 'title';
  let game: GameState = createGame(rng);
  let placement: PlacementState = initialPlacement();
  let difficulty: Difficulty = 'normal';
  let hover: Coord | null = null;
  let playerResult = '';
  let computerResult = '';
  let note = '';
  let drag: Drag | null = null;
  let computerTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  // Recomputed once per render; playerCell/enemyCell close over them.
  let playerSunk = new Set<string>();
  let enemySunk = new Set<string>();

  const playerView = createBoardView({
    label: 'Your fleet',
    onActivate: onPlayerCell,
    onHover: (c) => {
      if (drag) {
        return;
      }
      hover = c;
      render();
    },
    drag: {
      canStart: (c) => game.phase === 'placing' && shipAt(placement.board, c) !== undefined,
      onStart: (c) => {
        const started = startDrag(placement, c);
        if (!started) {
          return;
        }
        placement = started.state;
        drag = started.drag;
        hover = c;
        render();
      },
      onMove: (c) => {
        if (!drag) {
          return;
        }
        hover = c ? dragOrigin(drag, c, placement.orientation) : null;
        render();
      },
      onEnd: (c) => {
        if (!drag) {
          return;
        }
        const origin = c ? dragOrigin(drag, c, placement.orientation) : null;
        const dropped = dropDrag(placement, drag, origin);
        placement = dropped.state;
        note = dropped.snappedBack
          ? `The ${shipDisplayName(drag.type)} didn't fit there, so it went back.`
          : '';
        drag = null;
        hover = null;
        render();
      },
      onCancel: () => {
        if (!drag) {
          return;
        }
        const dropped = dropDrag(placement, drag, null);
        placement = dropped.state;
        note = `The ${shipDisplayName(drag.type)} didn't fit there, so it went back.`;
        drag = null;
        hover = null;
        render();
      },
    },
  });
  const enemyView = createBoardView({ label: 'Enemy sector', onActivate: onEnemyCell });
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
    const icon = document.createElement('span');
    icon.className = 'ship-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = shipSvg(spec.type);
    const label = document.createElement('span');
    button.append(icon, label);
    button.addEventListener('click', () => {
      cancelActiveDrag();
      placement = selectShip(placement, spec.type);
      note = '';
      render();
    });
    el.shipList.append(button);
    return { spec, button, label };
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
    cancelActiveDrag();
    screen = 'intro';
    render();
    el.levelCards.querySelector<HTMLInputElement>('input:checked')?.focus();
  });

  el.rotate.addEventListener('click', () => {
    placement = rotate(placement);
    render();
  });
  el.randomize.addEventListener('click', () => {
    cancelActiveDrag();
    placement = randomizePlacement(placement, rng);
    note = 'Fleet deployed at random. Start the battle, or select a ship to move it.';
    render();
  });
  el.start.addEventListener('click', () => {
    cancelActiveDrag();
    if (!isFleetComplete(placement.board)) {
      return;
    }
    game = startGame(game, placement.board);
    hover = null;
    note = `Battle started on ${levelName(difficulty)}.`;
    render();
    enemyView.focus();
  });
  el.newGame.addEventListener('click', reset);
  el.playAgain.addEventListener('click', reset);
  window.addEventListener('storage', (event) => {
    if (event.key === LEADERBOARD_KEY || event.key === null) {
      leaderboard = loadLeaderboard(store);
      renderLeaderboard();
    }
  });

  el.clearScores.addEventListener('click', () => {
    if (!window.confirm('Clear all your saved scores?')) {
      return;
    }
    clearLeaderboard(store);
    leaderboard = emptyLeaderboard();
    renderLeaderboard();
  });

  function renderLeaderboard(): void {
    el.leaderboardLevels.replaceChildren(
      ...LEVELS.map((level) => {
        const section = document.createElement('div');
        section.className = 'leaderboard-level';
        const heading = document.createElement('h3');
        heading.textContent = level.name;
        section.append(heading);
        const entries = leaderboard[level.level];
        if (entries.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'lb-empty';
          empty.textContent = 'No wins yet';
          section.append(empty);
        } else {
          const list = document.createElement('ol');
          for (const entry of entries) {
            const item = document.createElement('li');
            const strikes = document.createElement('span');
            strikes.className = 'lb-strikes';
            strikes.textContent = `${entry.strikes} strikes`;
            const date = document.createElement('span');
            date.className = 'lb-date';
            date.textContent = new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            item.append(strikes, ' ', date);
            list.append(item);
          }
          section.append(list);
        }
        return section;
      }),
    );
    el.clearScores.hidden = LEVELS.every((level) => leaderboard[level.level].length === 0);
  }

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

  /** A live pointer drag can't survive the board changing under it. */
  function cancelActiveDrag(): void {
    if (!drag) {
      return;
    }
    placement = dropDrag(placement, drag, null).state;
    drag = null;
    hover = null;
    playerView.cancelDrag();
  }

  function onPlayerCell(c: Coord): void {
    if (game.phase !== 'placing') {
      return;
    }
    cancelActiveDrag();
    const picked = placement.selected ? null : pickUpAt(placement, c);
    if (picked) {
      placement = picked;
      note = '';
    } else if (shipAt(placement.board, c) && placement.selected) {
      note = placementMessage('overlap', placement.selected);
    } else {
      const { state, error } = placeSelected(placement, c);
      placement = state;
      note = error ? placementMessage(error, placement.selected) : '';
    }
    render();
  }

  function onEnemyCell(c: Coord): void {
    const outcome = fire(game, 'player', c);
    if (!outcome.ok) {
      note = rejectionMessage(outcome.reason, c);
      render();
      return;
    }
    game = outcome.state;
    playerResult = shotMessage('player', outcome.result);
    note = '';
    render();
    afterShot(enemyView, outcome.result);
    if (game.phase === 'over') {
      scheduleEnd();
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
    computerResult = shotMessage('computer', outcome.result);
    note = '';
    render();
    afterShot(playerView, outcome.result);
    if (game.phase === 'over') {
      scheduleEnd();
    }
  }

  function afterShot(view: typeof enemyView, result: ShotResult): void {
    const fx = effectForShot(result);
    view.spawnEffect(fx.kind, fx.cells, !reducedMotion());
    if (fx.kind === 'sunk' && !reducedMotion()) {
      root.classList.add('shake');
      clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => root.classList.remove('shake'), SHAKE_MS);
    }
  }

  function scheduleEnd(): void {
    const won = game.winner === 'player';
    root.classList.add(won ? 'fx-victory' : 'fx-defeat');
    if (won) {
      // Another tab may have saved wins since this page loaded.
      leaderboard = loadLeaderboard(store);
      const scored = addScore(leaderboard, difficulty, {
        strikes: game.computerBoard.shots.size,
        date: localDateString(new Date()),
      });
      leaderboard = scored.board;
      lastRank = scored.rank;
      saveLeaderboard(store, leaderboard);
      renderLeaderboard();
    }
    endTimer = setTimeout(showEnd, won ? VICTORY_DELAY_MS : END_SCREEN_DELAY_MS);
  }

  function showEnd(): void {
    const summary = endSummary(game, levelName(difficulty));
    el.endTitle.textContent = summary.title;
    el.endText.textContent = summary.text;
    const rankText = rankMessage(lastRank, levelName(difficulty));
    el.endRank.textContent = rankText;
    el.endRank.hidden = rankText === '';
    el.endStats.replaceChildren(
      ...[
        ['Your strikes', summary.player.shots],
        ['Your hits', summary.player.hits],
        ['Enemy strikes', summary.computer.shots],
        ['Enemy hits', summary.computer.hits],
      ].map(([term, value]) => {
        const item = document.createElement('div');
        item.className = 'end-stat';
        const dt = document.createElement('dt');
        dt.textContent = String(term);
        const dd = document.createElement('dd');
        dd.textContent = String(value);
        item.append(dt, dd);
        return item;
      }),
    );
    el.endDialog.classList.toggle('end--win', summary.won);
    el.endDialog.classList.toggle('end--lose', !summary.won);
    el.endDialog.showModal();
  }

  function reset(): void {
    titleScreen.stop();
    clearTimeout(computerTimer);
    clearTimeout(endTimer);
    clearTimeout(shakeTimer);
    computerTimer = undefined;
    endTimer = undefined;
    shakeTimer = undefined;
    playerView.clearEffects();
    enemyView.clearEffects();
    root.classList.remove('shake', 'fx-victory', 'fx-defeat');
    if (el.endDialog.open) {
      el.endDialog.close();
    }
    game = createGame(rng);
    cancelActiveDrag();
    placement = initialPlacement();
    hover = null;
    drag = null;
    playerResult = '';
    computerResult = '';
    note = '';
    lastRank = null;
    el.endRank.hidden = true;
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
      const name = ship ? shipDisplayName(ship.type) : undefined;
      return { classes, label: name ? `${label}, ${name}` : `${label}, empty` };
    }
    const board = game.playerBoard;
    const ship = shipAt(board, c);
    const mark = board.shots.get(coordKey(c));
    const sunk = playerSunk.has(coordKey(c));
    const classes = [ship ? 'ship' : '', mark ?? '', sunk ? 'sunk' : ''].filter(Boolean);
    const parts = [label, ship ? shipDisplayName(ship.type) : 'water'];
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
    root.dataset.screen =
      screen === 'title' ? 'title' : intro ? 'intro' : placing ? 'placing' : 'battle';
    root.dataset.phase = placing ? 'placing' : 'battle';
    el.title.hidden = screen !== 'title';
    el.intro.hidden = !intro;
    el.top.hidden = screen !== 'game';
    el.status.hidden = screen !== 'game';
    el.layout.hidden = screen !== 'game';
    el.levelName.textContent = levelName(difficulty);
    el.setup.hidden = !placing;
    el.enemyPanel.hidden = placing;
    el.newGame.hidden = placing;

    if (el.playerResult.textContent !== playerResult) {
      el.playerResult.textContent = playerResult;
    }
    el.playerResult.hidden = !playerResult;
    if (el.computerResult.textContent !== computerResult) {
      el.computerResult.textContent = computerResult;
    }
    el.computerResult.hidden = !computerResult;
    const turn = [note, turnMessage(game)].filter(Boolean).join(' ');
    if (el.statusTurn.textContent !== turn) {
      el.statusTurn.textContent = turn;
    }

    playerSunk = sunkCellKeys(game.playerBoard);
    enemySunk = sunkCellKeys(game.computerBoard);

    const interactivity = boardInteractivity(game);
    playerView.setInteractive(interactivity.player);
    enemyView.setInteractive(interactivity.enemy);

    const playerBoard = placing ? placement.board : game.playerBoard;
    playerView.setShips(
      playerBoard.ships.map((s) => shipSprite(s, isShipSunk(playerBoard, s) ? 'wreck' : 'intact')),
    );
    enemyView.setShips(
      game.computerBoard.ships
        .filter((s) => isShipSunk(game.computerBoard, s) || game.phase === 'over')
        .map((s) => shipSprite(s, isShipSunk(game.computerBoard, s) ? 'wreck' : 'intact')),
    );

    playerView.update(playerCell);
    enemyView.update(enemyCell);
    playerTracker.update(game.playerBoard);
    enemyTracker.update(game.computerBoard);

    for (const { spec, button, label } of shipButtons) {
      const placed = placement.board.ships.some((s) => s.type === spec.type);
      const selected = placement.selected === spec.type;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('placed', placed);
      const name = shipDisplayName(spec.type);
      label.textContent = `${name} (${spec.length})${placed ? ' ✓' : ''}`;
      button.setAttribute(
        'aria-label',
        `${name}, length ${spec.length}, ${placed ? 'placed' : 'not placed'}`,
      );
    }
    el.rotate.textContent = `Rotate (${placement.orientation})`;
    el.start.disabled = !isFleetComplete(placement.board);
  }

  const titleScreen = createTitleScreen({
    briefing: el.briefing,
    launch: el.launch,
    reducedMotion,
    onLaunch: () => {
      screen = 'intro';
      render();
      el.levelCards.querySelector<HTMLInputElement>('input:checked')?.focus();
    },
  });
  titleScreen.start();

  renderLeaderboard();
  render();
}
