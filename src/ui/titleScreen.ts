export const BRIEFING_LINES = [
  'Incoming transmission…',
  'An enemy fleet has entered your sector.',
  'Find it and destroy it before it finds you.',
] as const;

export const TYPE_CHAR_MS = 28;
export const LINE_PAUSE_MS = 250;
export const START_DELAY_MS = 300;

/** How long the full briefing takes to type, including the start delay and line pauses. */
export function briefingDuration(): number {
  const chars = BRIEFING_LINES.reduce((n, line) => n + line.length, 0);
  return START_DELAY_MS + chars * TYPE_CHAR_MS + (BRIEFING_LINES.length - 1) * LINE_PAUSE_MS;
}

export interface TitleScreenOptions {
  readonly briefing: HTMLElement;
  readonly launch: HTMLButtonElement;
  readonly reducedMotion: () => boolean;
  readonly onLaunch: () => void;
}

export interface TitleScreen {
  start(): void;
  skip(): void;
  stop(): void;
}

/**
 * Types the mission briefing line by line into the title screen. Any key or click
 * skips to the end; with reduced motion it finishes immediately.
 */
export function createTitleScreen(options: TitleScreenOptions): TitleScreen {
  const { briefing, launch, reducedMotion, onLaunch } = options;
  const title = briefing.closest<HTMLElement>('.title-screen');
  const lines = Array.from(briefing.querySelectorAll<HTMLElement>('.briefing-line'));
  let timers: ReturnType<typeof setTimeout>[] = [];
  let done = false;

  const onSkip = (): void => {
    skip();
  };

  function addListeners(): void {
    document.addEventListener('keydown', onSkip);
    title?.addEventListener('click', onSkip);
  }

  function removeListeners(): void {
    document.removeEventListener('keydown', onSkip);
    title?.removeEventListener('click', onSkip);
  }

  function finish(): void {
    if (done) {
      return;
    }
    done = true;
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers = [];
    removeListeners();
    lines.forEach((el, i) => {
      el.textContent = BRIEFING_LINES[i] ?? '';
    });
    launch.hidden = false;
    launch.focus();
    if (title) {
      title.dataset.briefing = 'done';
    }
  }

  function start(): void {
    if (reducedMotion()) {
      finish();
      return;
    }
    addListeners();
    let at = START_DELAY_MS;
    lines.forEach((el, i) => {
      const line = BRIEFING_LINES[i] ?? '';
      for (let k = 0; k < line.length; k++) {
        const text = line.slice(0, k + 1);
        timers.push(
          setTimeout(() => {
            el.textContent = text;
          }, at),
        );
        at += TYPE_CHAR_MS;
      }
      at += LINE_PAUSE_MS;
    });
    timers.push(setTimeout(finish, at - LINE_PAUSE_MS));
  }

  function skip(): void {
    finish();
  }

  function stop(): void {
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers = [];
    removeListeners();
  }

  launch.addEventListener('click', onLaunch);

  return { start, skip, stop };
}
