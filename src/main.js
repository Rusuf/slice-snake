import { createGame, step, turn } from './game.js';
import { readBestScore, writeBestScore } from './storage.js';
import { bindJoystick } from './joystick.js';
import { readChallenge, challengeURL, createMatch, advanceMatch, finishMatchRound } from './social.js';

const element = id => document.getElementById(id);
const ui = {
  arcade: element('arcade'), board: element('canvas-host'), overlay: element('overlay'),
  tag: element('overlay-tag'), title: element('overlay-title'), copy: element('overlay-copy'),
  start: element('start'), pause: element('pause'), restart: element('restart'),
  speed: element('speed'), levelName: element('level-name'), levelHelp: element('level-help'), score: element('score'), best: element('best'), status: element('status'),
  joystick: element('joystick'), handedness: element('handedness'),
  arToggle: element('ar-toggle'), arStatus: element('ar-status'), arCard: element('ar-card-link'),
  players: element('players'), share: element('share-score'), scoreLabel: element('score-label'), bestLabel: element('best-label'),
};
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right',
  '2': 'up', '8': 'down', '4': 'left', '6': 'right',
};
const LEVELS = new Map([[190, 'EASY'], [140, 'CLASSIC'], [95, 'FAST']]);
const listeners = new AbortController();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let game = createGame();
let scene;
let storage;
let fault = false;
let frame = null;
let previousTime = null;
let elapsed = 0;
let interval = 140;
let arRequested = false;
let arTracked = false;
let arAbort;
let arSession;
let match = createMatch();
const challenge = readChallenge(window.location.search);
if (challenge) {
  ui.speed.querySelector(`input[value="${challenge.level}"]`).checked = true;
  ui.levelName.textContent = LEVELS.get(challenge.level);
  ui.bestLabel.textContent = 'TO BEAT';
}
const joystick = bindJoystick(ui.joystick, direction => turn(game, direction), listeners.signal);

try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let best = readBestScore(storage);
const formatScore = value => String(value).padStart(3, '0');
ui.best.textContent = formatScore(challenge?.score ?? best);

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
    ui.best.textContent = formatScore(challenge?.score ?? best);
    writeBestScore(storage, best);
  }
}

function syncControls() {
  const playing = game.status === 'playing' && !fault;
  const active = ['playing', 'paused'].includes(game.status) && !fault;
  ui.overlay.hidden = playing;
  ui.pause.disabled = !active || (arRequested && !arTracked);
  ui.pause.textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
  const pauseLabel = game.status === 'paused' ? 'Resume game' : 'Pause game';
  ui.pause.setAttribute('aria-label', pauseLabel);
  ui.pause.title = pauseLabel;
  const sharedLevel = match.enabled && match.scores.length === 1;
  ui.speed.disabled = playing || fault || sharedLevel;
  ui.levelHelp.textContent = fault ? 'Game unavailable' : sharedLevel ? 'Same level for both' : playing ? 'Pause to change' : 'Choose your speed';
  ui.restart.disabled = !scene || fault || game.status === 'ready' || (arRequested && !arTracked);
  joystick.setEnabled(playing);
  ui.arToggle.disabled = !scene || fault;
  ui.start.disabled = !scene || (!fault && arRequested && !arTracked);
  ui.arCard.hidden = !arRequested;
  ui.arStatus.hidden = !arRequested;
  ui.players.disabled = !scene || active || fault;
  ui.scoreLabel.textContent = match.enabled ? `PLAYER ${match.player}` : 'YOUR SCORE';
  ui.share.hidden = !['over', 'won'].includes(game.status) || game.score === 0;
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
  arAbort?.abort();
  arRequested = false;
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
  const round = finishMatchRound(match, game.score);
  syncControls();
  showOverlay(
    game.status === 'won' ? 'CLEAN PLATE CLUB' : 'THAT’S A WRAP',
    game.status === 'won' ? 'Every bite. Yours.' : 'Hungry for another?',
    `You scored ${game.score} points. ${game.status === 'won' ? 'You filled the whole board!' : 'There’s always room for one more go.'}`,
    'PLAY AGAIN ↗',
  );
  if (round) showOverlay('2 PLAYERS', round.title, round.copy, round.action);
  else if (challenge && game.score > challenge.score) {
    showOverlay('CHALLENGE BEATEN', 'That’s how it’s done.', `You scored ${game.score} and beat the ${challenge.score}-point challenge.`, 'PLAY AGAIN ↗');
  }
  ui.share.textContent = 'Challenge a friend ↗';
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
    scene.update(game, { animate: !reducedMotion.matches && game.status === 'playing', time, stepDuration: interval });
    syncScore();
    if (previousScore !== game.score) ui.status.textContent = `Bite collected. Score ${game.score}.`;
  }

  if (game.status !== 'playing') finish();
  else {
    scene.animate(time);
    frame = requestAnimationFrame(tick);
  }
}

function play({ restart = false } = {}) {
  if (fault) { window.location.reload(); return; }
  if (!scene || (arRequested && !arTracked) || game.status === 'playing' && !restart) return;
  stopClock();
  if (!restart && ['over', 'won'].includes(game.status)) advanceMatch(match);
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
  scene?.settle();
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
on(ui.handedness, 'click', () => {
  const left = ui.handedness.getAttribute('aria-pressed') !== 'true';
  ui.handedness.setAttribute('aria-pressed', String(left));
  ui.handedness.textContent = left ? 'Right thumb' : 'Left thumb';
  ui.arcade.classList.toggle('left-handed', left);
});

on(ui.players, 'click', () => {
  match = createMatch(!match.enabled);
  ui.players.setAttribute('aria-pressed', String(match.enabled));
  ui.players.textContent = match.enabled ? 'Solo mode' : '2 players';
  game = createGame();
  scene.update(game);
  syncScore();
  showReadyAction();
  syncControls();
});
on(ui.share, 'click', async () => {
  const url = challengeURL(window.location.href, game.score, interval);
  const text = `I scored ${game.score} in Slice Snake. Can you beat it?`;
  try {
    if (navigator.share) await navigator.share({ title: 'Slice Snake', text, url });
    else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      ui.share.textContent = 'Challenge link copied ✓';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      ui.share.textContent = 'Copy link';
      window.prompt('Copy your challenge link:', url);
    }
  }
});

function showReadyAction() {
  if (game.status === 'paused') {
    showOverlay('READY', 'Ready when you are.', 'Your game is paused. Continue when you’re ready.', 'KEEP GOING ↗');
  } else if (game.status === 'over' || game.status === 'won') {
    const round = finishMatchRound(match, game.score);
    if (round) { showOverlay('2 PLAYERS', round.title, round.copy, round.action); return; }
    showOverlay('ONE MORE GO', 'Hungry for another?', `You scored ${game.score} points. Ready for another round?`, 'PLAY AGAIN ↗');
  } else if (match.enabled) {
    showOverlay('2 PLAYERS', 'Player 1, you’re up.', 'Take turns on this phone. Highest score wins.', 'PLAYER 1 · PLAY ↗');
  } else {
    showOverlay('HOT & READY', 'Feed your competitive side.', 'Drag the joystick to collect pizza. Avoid the edges and your tail.', 'LET’S PLAY ↗');
  }
}
function exitAR() {
  pause({ focus: false });
  arRequested = false;
  arTracked = false;
  arAbort?.abort();
  arSession?.stop();
  arSession = null;
  document.body.classList.remove('camera-mode');
  ui.arToggle.textContent = 'PLAY IN AR';
  ui.arToggle.setAttribute('aria-pressed', 'false');
  showReadyAction();
  syncControls();
}
on(ui.arToggle, 'click', async () => {
  if (arRequested) { exitAR(); return; }
  pause({ focus: false });
  arRequested = true;
  arTracked = false;
  arAbort = new AbortController();
  const currentAttempt = arAbort;
  document.body.classList.add('camera-mode');
  ui.arToggle.textContent = 'BACK TO 3D';
  ui.arToggle.setAttribute('aria-pressed', 'true');
  showOverlay('AR DEMO', 'Find your demo card.', 'Print the tracking card, place it flat, and point your camera at it.', 'FINDING CARD…');
  syncControls();
  try {
    const { startARSession } = await import('./ar-session.js');
    if (currentAttempt.signal.aborted) return;
    arSession = await startARSession({
      host: ui.board, view: scene, signal: currentAttempt.signal,
      onStatus: text => { ui.arStatus.textContent = text; },
      onError: error => {
        if (currentAttempt.signal.aborted) return;
        exitAR();
        showOverlay('CAMERA STOPPED', 'Keep playing in 3D.', error.message, 'PLAY IN 3D ↗');
      },
      onTracking: found => {
        if (currentAttempt.signal.aborted) return;
        arTracked = found;
        if (!found) {
          pause({ focus: false });
          showOverlay('AR DEMO', 'Point back at the card.', 'Keep the whole demo card in view. Your game is paused safely.', 'FINDING CARD…');
          ui.arStatus.textContent = 'Card out of view · game paused';
        } else {
          showReadyAction();
          ui.arStatus.textContent = 'Card found · press play when ready';
        }
        syncControls();
      },
    });
  } catch (error) {
    if (currentAttempt.signal.aborted) return;
    exitAR();
    showOverlay('CAMERA UNAVAILABLE', 'Keep playing in 3D.', error.message || 'Camera mode could not start. Try Chrome on Android.', 'PLAY IN 3D ↗');
  }
});
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
on(document, 'visibilitychange', () => {
  if (document.hidden) {
    if (arRequested) exitAR();
    else pause({ focus: false });
  }
});
on(window, 'blur', () => pause({ focus: false }));
on(window, 'pagehide', event => {
  if (arRequested) exitAR();
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
  // A stationary preview shows the board's depth; starting still creates a fresh run.
  scene.update({
    ...game,
    direction: 'right',
    snake: [
      { x: 10, y: 4 }, { x: 9, y: 4 }, { x: 8, y: 4 }, { x: 7, y: 4 },
      { x: 6, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 5 },
      { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
    ],
    food: { x: 12, y: 5 },
  });
  ui.start.disabled = false;
  showOverlay('HOT & READY', 'Feed your competitive side.',
    'Collect bites. Keep moving. Stay clear of the edges and your tail.', 'LET’S PLAY ↗');
  syncControls();
} catch (error) {
  console.error('Unable to initialize the 3D scene:', error);
  failGraphics();
}
