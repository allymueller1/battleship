import { fleetStatus } from '../game/shots';
import { FLEET } from '../game/ships';
import type { Board } from '../game/types';
import { shipDisplayName } from './theme';
import { shipSvg } from './shipArt';

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
    const icon = document.createElement('span');
    icon.className = 'ship-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = shipSvg(spec.type);
    const name = document.createElement('span');
    name.className = 'tracker-name';
    name.textContent = shipDisplayName(spec.type);
    const state = document.createElement('span');
    state.className = 'tracker-state';
    li.append(icon, name, state);
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
