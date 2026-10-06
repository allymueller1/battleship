import { coordKey, isInBounds, neighbors } from '../coord';
import { pickRandom, type Rng } from '../rng';
import type { Coord, TargetView } from '../types';
import { unresolvedHits, untriedCoords } from './view';

/**
 * Hunt-and-target strategy, stateless: everything is re-derived from the view
 * each turn. With unresolved hits it extends hit lines or probes around lone
 * hits; otherwise it hunts on the checkerboard parity.
 */
export function chooseNormalShot(view: TargetView, rng: Rng): Coord {
  const targets = targetCandidates(view);
  if (targets.length > 0) {
    return pickRandom(rng, targets);
  }
  const untried = untriedCoords(view);
  const parity = untried.filter((c) => (c.row + c.col) % 2 === 0);
  return pickRandom(rng, parity.length > 0 ? parity : untried);
}

/**
 * Candidate cells for finishing off unresolved hits. Returns [] when there
 * are no hits or nothing useful around them (caller falls back to hunting).
 */
function targetCandidates(view: TargetView): Coord[] {
  const hits = unresolvedHits(view);
  if (hits.length === 0) {
    return [];
  }
  const untried = new Set(untriedCoords(view).map(coordKey));

  const lineEnds = longestLineEnds(hits, untried);
  if (lineEnds.length > 0) {
    return lineEnds;
  }

  // A lone hit, or a "line" that actually crosses two side-by-side ships:
  // probe the untried orthogonal neighbors of every unresolved hit.
  const seen = new Set<string>();
  const around: Coord[] = [];
  for (const hit of hits) {
    for (const n of neighbors(hit)) {
      const key = coordKey(n);
      if (untried.has(key) && !seen.has(key)) {
        seen.add(key);
        around.push(n);
      }
    }
  }
  return around;
}

/**
 * Finds every maximal run of >= 2 contiguous unresolved hits in a row or
 * column, keeps only the longest runs, and returns the untried cell just past
 * each end of those runs. This gives "follow the line, then reverse when
 * blocked".
 */
function longestLineEnds(hits: Coord[], untried: ReadonlySet<string>): Coord[] {
  const hitSet = new Set(hits.map(coordKey));
  const runs: Coord[][] = [];
  const directions = [
    { dr: 0, dc: 1 }, // rows
    { dr: 1, dc: 0 }, // columns
  ];
  for (const { dr, dc } of directions) {
    for (const hit of hits) {
      const before = { row: hit.row - dr, col: hit.col - dc };
      if (hitSet.has(coordKey(before))) {
        continue; // not the start of a run
      }
      const run: Coord[] = [hit];
      for (let i = 1; ; i++) {
        const next = { row: hit.row + dr * i, col: hit.col + dc * i };
        if (!hitSet.has(coordKey(next))) {
          break;
        }
        run.push(next);
      }
      if (run.length >= 2) {
        runs.push(run);
      }
    }
  }

  const maxLength = Math.max(0, ...runs.map((r) => r.length));
  const ends: Coord[] = [];
  for (const run of runs) {
    if (run.length < maxLength) {
      continue;
    }
    const first = run[0]!;
    const last = run[run.length - 1]!;
    // runs are straight, so the extension direction is fixed by the run
    const dr = run.length > 1 ? last.row - run[run.length - 2]!.row : 0;
    const dc = run.length > 1 ? last.col - run[run.length - 2]!.col : 0;
    for (const end of [
      { row: first.row - dr, col: first.col - dc },
      { row: last.row + dr, col: last.col + dc },
    ]) {
      if (isInBounds(end) && untried.has(coordKey(end))) {
        ends.push(end);
      }
    }
  }
  return ends;
}
