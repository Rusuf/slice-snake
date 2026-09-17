import { createGame, step, turn, steer } from './game.js';
import { readBestScore, writeBestScore } from './storage.js';
import { bindJoystick } from './joystick.js';
import { readChallenge, challengeURL, createMatch, advanceMatch, finishMatchRound } from './social.js';

const element = id => document.getElementById(id);
const ui = {
  arcade: element('arcade'), board: element('canvas-host'), overlay: element('overlay'),
  tag: element('overlay-tag'), title: element('overlay-title'), copy: element('overlay-copy'),
  start: element('start'), pause: element('pause'), restart: element('restart'),
  endless: element('endless'), stageLabel: element('stage-label'),
  speed: element('speed'), levelName: element('level-name'), levelHelp: element('level-help'), score: element('score'), best: element('best'), status: element('status'),
  joystick: element('joystick'), handedness: element('handedness'),
  screenControls: element('screen-controls'),
  arToggle: element('ar-toggle'), arStatus: element('ar-status'), arCard: element('ar-card-link'),
  arChooser: element('ar-chooser'), arOptions: element('ar-options'), surfaceButton: element('surface-ar'), imageButton: element('image-ar'), eighthWallButton: element('eighth-wall-ar'), arCancel: element('ar-cancel'),
  surfaceTools: element('surface-tools'), smaller: element('board-smaller'), larger: element('board-larger'), size: element('board-size'), reposition: element('reposition'),
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
let arKind = null;
let arPlaced = false;
let arCanPlace = false;
let arPlacementKind = null;
let closingAR = false;
let screenControls = false;
let boardSize = 24;
let match = createMatch();
const challenge = readChallenge(window.location.search);
let gameMode = challenge?.mode ?? 'classic';
if (challenge) {
  ui.speed.querySelector(`input[value="${challenge.level}"]`).checked = true;
  ui.levelName.textContent = LEVELS.get(challenge.level);
  ui.bestLabel.textContent = 'TO BEAT';
}
const joystick = bindJoystick(ui.joystick, direction => steer(game, scene?.directionForScreen(direction) ?? direction), listeners.signal);

try { storage = window.localStorage; } catch { /* Storage is optional. */ }
let best = readBestScore(storage, gameMode);
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

function syncSpatialControls() {
  if (arKind !== 'surface') return;
  scene?.setARControls({
    score: game.score, best: challenge?.score ?? best, status: game.status,
    placed: arPlaced, ready: Boolean(arSession) && (arPlaced ? arTracked : arCanPlace),
    kind: arPlacementKind, size: boardSize, mode: gameMode,
    player: match.enabled ? match.player : null,
  });
}

function syncScore() {
  ui.score.textContent = formatScore(game.score);
  if (game.score > best) {
    best = game.score;
    ui.best.textContent = formatScore(challenge?.score ?? best);
    writeBestScore(storage, best, gameMode);
  }
  syncSpatialControls();
}

function syncControls() {
  const playing = game.status === 'playing' && !fault;
  const surface = arRequested && arKind === 'surface';
  const spatialReady = surface && (arPlaced ? arTracked : arCanPlace);
  document.body.classList.toggle('spatial-ar', spatialReady && !screenControls);
  ui.screenControls.hidden = !surface;
  ui.screenControls.setAttribute('aria-pressed', String(screenControls));
  ui.screenControls.textContent = screenControls ? '3D CONTROLS' : 'SCREEN CONTROLS';
  document.body.classList.toggle('surface-scanning', arRequested && arKind === 'surface' && !arPlaced);
  const active = ['playing', 'paused'].includes(game.status) && !fault;
  ui.overlay.hidden = playing;
  ui.pause.disabled = !active || (arRequested && !arTracked);
  ui.pause.textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
  const pauseLabel = game.status === 'paused' ? 'Resume game' : 'Pause game';
  ui.pause.setAttribute('aria-label', pauseLabel);
  ui.pause.title = pauseLabel;
  const sharedLevel = match.enabled && match.scores.length === 1;
  ui.speed.disabled = playing || fault || sharedLevel;
  ui.endless.disabled = active || fault || sharedLevel || Boolean(challenge);
  ui.endless.setAttribute('aria-pressed', String(gameMode === 'endless'));
  ui.endless.textContent = gameMode === 'endless' ? 'Endless mode · on' : 'Endless mode';
  ui.stageLabel.textContent = gameMode === 'endless' ? '16 × 16 · ENDLESS PLAY' : '16 × 16 · CLASSIC PLAY';
  ui.levelHelp.textContent = fault ? 'Game unavailable' : sharedLevel ? 'Same level for both' : playing ? 'Pause to change' : 'Choose your speed';
  ui.restart.disabled = !scene || fault || game.status === 'ready' || (arRequested && !arTracked);
  joystick.setEnabled(playing);
  ui.arToggle.disabled = !scene || fault || closingAR;
  const waiting = arKind === 'surface' && !arPlaced ? !arCanPlace : !arTracked;
  ui.start.disabled = !scene || (!fault && arRequested && waiting);
  ui.arCard.hidden = !arRequested || !['image', 'eighth-wall'].includes(arKind);
  ui.arCard.href = arKind === 'eighth-wall' ? './eighth-wall-target.html' : './target.html';
  ui.surfaceTools.hidden = !arRequested || arKind !== 'surface' || !arPlaced || playing;
  ui.reposition.disabled = !arPlaced;
  ui.smaller.disabled = ui.larger.disabled = !arSession;
  ui.arStatus.hidden = !arRequested;
  ui.players.disabled = !scene || active || fault;
  ui.scoreLabel.textContent = match.enabled ? `PLAYER ${match.player}` : 'YOUR SCORE';
  ui.share.hidden = !['over', 'won'].includes(game.status) || game.score === 0;
  syncSpatialControls();
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
    const held = joystick.getDirection();
    if (held) steer(game, scene.directionForScreen(held));
    const previousScore = game.score;
    step(game);
    scene.update(game, { animate: !reducedMotion.matches && game.status === 'playing', time: time - elapsed, stepDuration: interval });
    syncScore();
    if (previousScore !== game.score) ui.status.textContent = `Bite collected. Score ${game.score}.`;
  }

  if (game.status !== 'playing') finish();
  else {
    scene.animate(time);
    if (arKind !== 'surface' && arKind !== 'eighth-wall') frame = requestAnimationFrame(tick);
  }
}

function play({ restart = false } = {}) {
  if (fault) { window.location.reload(); return; }
  if (arKind === 'surface' && !arPlaced && !arSession?.place()) return;
  if (!scene || (arRequested && !arTracked) || game.status === 'playing' && !restart) return;
  stopClock();
  if (!restart && ['over', 'won'].includes(game.status)) advanceMatch(match);
  if (restart || game.status !== 'paused') game = createGame(Math.random, gameMode);
  const selected = Number(ui.speed.querySelector('input:checked')?.value);
  interval = LEVELS.has(selected) ? selected : 140;
  game.status = 'playing';
  scene.update(game);
  syncScore();
  syncControls();
  ui.status.textContent = gameMode === 'endless' ? 'Game running. Cross an edge to wrap around. Avoid your tail.' : 'Game running. Collect bites and avoid the edges and your tail.';
  ui.board.focus({ preventScroll: true });
  if (arKind !== 'surface' && arKind !== 'eighth-wall') frame = requestAnimationFrame(tick);
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
on(ui.endless, 'click', () => {
  if (ui.endless.disabled) return;
  gameMode = gameMode === 'endless' ? 'classic' : 'endless';
  match = createMatch(match.enabled);
  game = createGame(Math.random, gameMode);
  best = readBestScore(storage, gameMode);
  ui.best.textContent = formatScore(best);
  scene?.update(game);
  syncScore();
  showReadyAction();
  syncControls();
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
  game = createGame(Math.random, gameMode);
  scene.update(game);
  syncScore();
  showReadyAction();
  syncControls();
});
on(ui.share, 'click', async () => {
  const url = challengeURL(window.location.href, game.score, interval, gameMode);
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
    showOverlay('HOT & READY', 'Feed your competitive side.', gameMode === 'endless' ? 'Collect pizza. Cross an edge to come out the other side. Avoid your tail.' : 'Drag the joystick to collect pizza. Avoid the edges and your tail.', 'LET’S PLAY ↗');
  }
}
function exitAR() {
  pause({ focus: false });
  arRequested = false;
  arTracked = false;
  arPlaced = false;
  arCanPlace = false;
  arKind = null;
  spatialTap = null;
  closingAR = true;
  arAbort?.abort();
  const closing = arSession?.stop();
  arSession = null;
  document.body.classList.remove('camera-mode', 'surface-mode');
  ui.arToggle.textContent = 'PLAY IN AR';
  ui.arToggle.setAttribute('aria-pressed', 'false');
  showReadyAction();
  syncControls();
  Promise.resolve(closing).finally(() => { closingAR = false; syncControls(); });
}
function scanningSurface() {
  showOverlay('SURFACE AR', 'Place your board.',
    !arCanPlace ? 'Hold your phone steady to show the placement preview.' : arPlacementKind === 'surface' ? 'Surface found. Tap the 3D board or Place & Play.' : 'Aim the 3D board, then tap to place. Amber means manual placement; green means a surface was found.',
    !arCanPlace ? 'STARTING CAMERA…' : arPlacementKind === 'surface' ? 'PLACE & PLAY ↗' : 'PLACE MANUALLY & PLAY ↗');
}
on(ui.screenControls, 'click', () => { screenControls = !screenControls; syncControls(); });
on(ui.arToggle, 'click', () => {
  if (arRequested) exitAR();
  else beginAR('surface');
});
on(ui.arOptions, 'click', () => {
  pause({ focus: false });
  ui.arChooser.showModal();
});
on(ui.arCancel, 'click', () => ui.arChooser.close());
on(ui.surfaceButton, 'click', () => { ui.arChooser.close(); beginAR('surface'); });
on(ui.imageButton, 'click', () => { ui.arChooser.close(); beginAR('image'); });
on(ui.eighthWallButton, 'click', () => { ui.arChooser.close(); beginAR('eighth-wall'); });
function resizeARBoard(delta) {
  if (!arSession) return;
  boardSize = arSession.resize(delta);
  ui.size.textContent = `${boardSize} cm`;
  syncSpatialControls();
}
on(ui.smaller, 'click', () => resizeARBoard(-.03));
on(ui.larger, 'click', () => resizeARBoard(.03));

// DOM overlay taps are projected into the XR camera, so raised buttons are real targets.
let spatialTap = null;
function spatialAction(action) {
  if (['up', 'down', 'left', 'right'].includes(action)) turn(game, scene?.directionForScreen(action) ?? action);
  else {
    const control = ui[action];
    if (control && !control.disabled) control.click();
  }
}
on(document, 'pointerdown', event => {
  if (arKind !== 'surface' || event.button !== 0 || spatialTap || event.target.closest('button, a, .overlay, .control-panel, .surface-tools, .masthead')) return;
  const action = scene?.pickARAction(event.clientX, event.clientY, window.innerWidth, window.innerHeight);
  if (!action) return;
  event.preventDefault();
  spatialTap = { id: event.pointerId, x: event.clientX, y: event.clientY, action };
  if (['up', 'down', 'left', 'right'].includes(action)) spatialAction(action);
});
on(document, 'pointerup', event => {
  if (event.pointerId !== spatialTap?.id) return;
  const tap = spatialTap;
  spatialTap = null;
  if (Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 16 || ['up', 'down', 'left', 'right'].includes(tap.action)) return;
  event.preventDefault();
  spatialAction(tap.action);
});
on(document, 'pointercancel', () => { spatialTap = null; });
on(ui.reposition, 'click', () => {
  pause({ focus: false });
  arPlaced = arTracked = arCanPlace = false;
  arSession?.reposition();
  scanningSurface();
  syncControls();
});

async function beginAR(kind) {
  if (arRequested || closingAR || !scene || fault) return;
  pause({ focus: false });
  arRequested = true;
  arTracked = arPlaced = arCanPlace = false;
  arKind = kind;
  arAbort = new AbortController();
  const currentAttempt = arAbort;
  document.body.classList.add('camera-mode');
  document.body.classList.toggle('surface-mode', kind === 'surface');
  ui.arToggle.textContent = 'BACK TO 3D';
  ui.arToggle.setAttribute('aria-pressed', 'true');
  boardSize = 24;
  ui.size.textContent = '24 cm';
  if (kind === 'surface') scanningSurface();
  else if (kind === 'eighth-wall') showOverlay('8TH WALL · EXPERIMENTAL', 'Find your printed square.', 'Print the prototype card, open this preview on your phone, allow the camera, then point at the artwork.', 'FINDING SQUARE…');
  else showOverlay('AR DEMO', 'Find your demo card.', 'Print the tracking card, place it flat, and point your camera at it.', 'FINDING CARD…');
  syncControls();
  const callbacks = {
    view: scene, signal: currentAttempt.signal,
    onStatus: text => { if (!currentAttempt.signal.aborted) ui.arStatus.textContent = text; },
    onError: error => {
      if (currentAttempt.signal.aborted) return;
      exitAR();
      showOverlay('CAMERA STOPPED', 'Keep playing in 3D.', error.message, 'PLAY IN 3D ↗');
    },
    onTracking: found => {
      if (currentAttempt.signal.aborted) return;
      arTracked = found;
      if (found) {
        if (kind === 'surface') arPlaced = true;
        showReadyAction();
        ui.arStatus.textContent = kind === 'surface' ? 'Board placed · ready to play' : 'Card found · ready to play';
      } else {
        pause({ focus: false });
        if (kind === 'surface' && !arPlaced) scanningSurface();
        else showOverlay('GAME PAUSED', kind === 'surface' ? 'Hold your phone steady.' : 'Point back at the card.',
          'Tracking was interrupted. Your game is paused safely.', 'WAITING FOR TRACKING…');
        ui.arStatus.textContent = 'Tracking interrupted · game paused';
      }
      syncControls();
    },
  };
  try {
    if (kind === 'surface') {
      if (!navigator.xr?.requestSession) throw new Error('Surface placement needs a supported Android phone and browser. Keep playing in 3D, or open Other AR options below.');
      // Request immediately on the button gesture, before downloading another module.
      const sessionPromise = navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['dom-overlay'], optionalFeatures: ['hit-test'], domOverlay: { root: document.body },
      });
      sessionPromise.catch(() => {});
      const { startSurfaceSession } = await import('./surface-ar.js').catch(error => {
        sessionPromise.then(session => session.end()).catch(() => {});
        throw error;
      });
      if (currentAttempt.signal.aborted) { sessionPromise.then(session => session.end()).catch(() => {}); return; }
      arSession = await startSurfaceSession({
        ...callbacks, sessionPromise, overlay: document.body,
        onFrame: time => tick(time),
        onPlacement: (ready, kind) => {
          if (currentAttempt.signal.aborted || arPlaced) return;
          arCanPlace = ready;
          arPlacementKind = kind;
          scanningSurface();
          syncControls();
        },
        onEnd: () => { if (!currentAttempt.signal.aborted) exitAR(); },
      });
    } else if (kind === 'eighth-wall') {
      const { startEighthWallSession } = await import('./eighth-wall-session.js');
      if (currentAttempt.signal.aborted) return;
      arSession = await startEighthWallSession({ ...callbacks, host: ui.board, onFrame: tick });
    } else {
      const { startARSession } = await import('./ar-session.js');
      if (currentAttempt.signal.aborted) return;
      arSession = await startARSession({ ...callbacks, host: ui.board });
    }
    syncControls();
  } catch (error) {
    if (currentAttempt.signal.aborted) return;
    exitAR();
    const message = error.name === 'NotSupportedError'
      ? 'Surface placement is unavailable on this device. Keep playing in 3D, or open Other AR options below.'
      : error.message || 'Camera mode could not start. Try Chrome on Android.';
    showOverlay('CAMERA UNAVAILABLE', 'Keep playing in 3D.', message, 'PLAY IN 3D ↗');
  }
}
on(ui.arcade, 'keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches('select, input, textarea')) return;
  const direction = KEYS[event.key] ?? KEYS[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    if (!event.repeat) turn(game, scene?.directionForScreen(direction) ?? direction);
  }
  if (event.code === 'Space' && !event.target.matches('button, a')) {
    event.preventDefault();
    if (!event.repeat) togglePause();
  }
  if (event.key === 'Escape') pause();
});
on(document, 'visibilitychange', () => {
  if (document.hidden) {
    if (arKind === 'surface') pause({ focus: false });
    else if (arRequested) exitAR();
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
  showReadyAction();
  syncControls();
} catch (error) {
  console.error('Unable to initialize the 3D scene:', error);
  failGraphics();
}
