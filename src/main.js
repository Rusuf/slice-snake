import { createGame, step, turn } from './game.js';
import { readBestScore, writeBestScore } from './storage.js';

const element = id => document.getElementById(id);
const ui = {
  arcade: element('arcade'), board: element('canvas-host'), overlay: element('overlay'),
  tag: element('overlay-tag'), title: element('overlay-title'), copy: element('overlay-copy'),
  start: element('start'), pause: element('pause'), restart: element('restart'),
  speed: element('speed'), levelName: element('level-name'), levelHelp: element('level-help'), score: element('score'), best: element('best'), status: element('status'),
  directions: [...document.querySelectorAll('[data-dir]')],
};
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  '2': 'up', '8': 'down', '4': 'left', '6': 'right',
};
const LEVELS = new Map([[190, 'EASY'], [140, 'CLASSIC'], [95, 'FAST']]);
const listeners = new AbortController();
let game = createGame();
let scene;
let storage;
let fault = false;
let frame = null;
let previousTime = null;
let elapsed = 0;
let interval = 140;

try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let best = readBestScore(storage);
const formatScore = value => String(value).padStart(3, '0');
ui.best.textContent = formatScore(best);

function on(target, event, handler) {
  target.addEventListener(event, handler, { signal: listeners.signal });
}

function stopClock() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  previousTime = null;
  elapsed = 0;
}

function syncScore() {
  ui.score.textContent = formatScore(game.score);
  if (game.score > best) {
    best = game.score;
    ui.best.textContent = formatScore(best);
    writeBestScore(storage, best);
  }
}

function syncControls() {
  const playing = game.status === 'playing' && !fault;
  const active = ['playing', 'paused'].includes(game.status) && !fault;
  ui.overlay.hidden = playing;
  ui.pause.disabled = !active;
  ui.pause.textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
  const pauseLabel = game.status === 'paused' ? 'Resume game' : 'Pause game';
  ui.pause.setAttribute('aria-label', pauseLabel);
  ui.pause.title = pauseLabel;
  ui.speed.disabled = playing || fault;
  ui.levelHelp.textContent = fault ? 'Game unavailable' : playing ? 'Pause to change' : 'Choose your speed';
  ui.restart.disabled = !scene || fault || game.status === 'ready';
  ui.directions.forEach(button => { button.disabled = !playing; });
}

function showOverlay(tag, title, copy, action) {
  ui.tag.textContent = tag;
  ui.title.textContent = title;
  ui.copy.textContent = copy;
  ui.start.textContent = action;
  ui.status.textContent = copy;
}

function failGraphics() {
  fault = true;
  stopClock();
  if (game.status === 'playing') game.status = 'paused';
  syncControls();
  showOverlay('LET’S RECONNECT', 'A little technical hiccup.',
    '3D graphics are unavailable. Reload, or try a browser with WebGL enabled.', 'RELOAD GAME ↗');
  ui.start.disabled = false;
  ui.start.focus({ preventScroll: true });
}

function finish() {
  stopClock();
  syncControls();
  showOverlay(
    game.status === 'won' ? 'CLEAN PLATE CLUB' : 'THAT’S A WRAP',
    game.status === 'won' ? 'Every bite. Yours.' : 'Hungry for another?',
    `You scored ${game.score} points. ${game.status === 'won' ? 'You filled the whole board!' : 'There’s always room for one more go.'}`,
    'PLAY AGAIN ↗',
  );
  ui.start.focus({ preventScroll: true });
}

function tick(time) {
  frame = null;
  if (game.status !== 'playing' || fault) return;
  if (previousTime !== null) elapsed += Math.min(time - previousTime, 250);
  previousTime = time;

  while (elapsed >= interval && game.status === 'playing') {
    elapsed -= interval;
    const previousScore = game.score;
    step(game);
    scene.update(game);
    syncScore();
    if (previousScore !== game.score) ui.status.textContent = `Bite collected. Score ${game.score}.`;
  }

  if (game.status !== 'playing') finish();
  else frame = requestAnimationFrame(tick);
}

function play({ restart = false } = {}) {
  if (fault) { window.location.reload(); return; }
  if (!scene || game.status === 'playing' && !restart) return;
  stopClock();
  if (restart || game.status !== 'paused') game = createGame();
  const selected = Number(ui.speed.querySelector('input:checked')?.value);
  interval = LEVELS.has(selected) ? selected : 140;
  game.status = 'playing';
  scene.update(game);
  syncScore();
  syncControls();
  ui.status.textContent = 'Game running. Collect bites and avoid the edges and your tail.';
  ui.board.focus({ preventScroll: true });
  frame = requestAnimationFrame(tick);
}

function pause({ focus = true } = {}) {
  if (fault || game.status !== 'playing') return;
  game.status = 'paused';
  stopClock();
  syncControls();
  showOverlay('TAKE A BREATHER', 'Saving your slice.',
    'Your game is paused. Jump back in when you’re ready.', 'KEEP GOING ↗');
  if (focus) ui.start.focus({ preventScroll: true });
}

function togglePause() {
  if (game.status === 'paused') play();
  else pause();
}

on(ui.start, 'click', () => play());
on(ui.pause, 'click', togglePause);
on(ui.restart, 'click', () => play({ restart: true }));
on(ui.speed, 'change', () => {
  const selected = Number(ui.speed.querySelector('input:checked')?.value);
  ui.levelName.textContent = LEVELS.get(selected) ?? 'CLASSIC';
});
for (const button of ui.directions) {
  on(button, 'pointerdown', event => {
    if (event.button !== 0 || button.disabled) return;
    event.preventDefault();
    turn(game, button.dataset.dir);
  });
  // Keyboard/assistive activation has no pointerdown; avoid a second turn for taps.
  on(button, 'click', event => {
    if (event.detail === 0) turn(game, button.dataset.dir);
  });
}
on(ui.arcade, 'keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('select, input, textarea')) return;
  const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    if (!event.repeat) turn(game, direction);
  }
  if (event.code === 'Space' && !event.target.matches('button, a')) {
    event.preventDefault();
    if (!event.repeat) togglePause();
  }
  if (event.key === 'Escape') pause();
});
on(document, 'visibilitychange', () => { if (document.hidden) pause({ focus: false }); });
on(window, 'blur', () => pause({ focus: false }));
on(window, 'pagehide', event => {
  pause({ focus: false });
  if (!event.persisted) {
    stopClock();
    listeners.abort();
    scene?.dispose();
  }
});

syncControls();
// Dynamic import allows dependency/network failures to use the same recoverable UI.
try {
  const { createScene } = await import('./scene.js');
  scene = createScene(ui.board, failGraphics);
  scene.update(game);
  ui.start.disabled = false;
  showOverlay('HOT & READY', 'Feed your competitive side.',
    'Collect bites. Keep moving. Stay clear of the edges and your tail.', 'LET’S PLAY ↗');
  syncControls();
} catch (error) {
  console.error('Unable to initialize the 3D scene:', error);
  failGraphics();
}
