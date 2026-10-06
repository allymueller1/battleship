import { fleetStatus } from '../game/shots';
import { FLEET } from '../game/ships';
import type { Board } from '../game/types';

export interface FleetTracker {
  readonly element: HTMLElement;
  update(board: Board): void;
}

/** Lists each ship in a fleet and whether it is still afloat. */
export function createFleetTracker(title: string): FleetTracker {
  const wrapper = document.createElement('div');
  wrapper.className = 'tracker';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  wrapper.append(heading, list);

  const items = FLEET.map((spec) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.className = 'tracker-name';
    name.textContent = spec.name;
    const pips = document.createElement('span');
    pips.className = 'tracker-pips';
    pips.setAttribute('aria-hidden', 'true');
    pips.textContent = '■'.repeat(spec.length);
    const state = document.createElement('span');
    state.className = 'tracker-state';
    li.append(name, pips, state);
    list.append(li);
    return { li, state };
  });

  return {
    element: wrapper,
    update(board) {
      fleetStatus(board).forEach(({ sunk }, i) => {
        const item = items[i]!;
        item.li.classList.toggle('sunk', sunk);
        item.state.textContent = sunk ? 'Sunk' : 'Afloat';
      });
    },
  };
}
