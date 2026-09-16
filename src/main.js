import * as THREE from 'three';
import { SIZE, createGame, turn, step } from './game.js';
const $ = id => document.getElementById(id);
let game = createGame(), best = 0, elapsed = 0, last = 0, renderer;
try { best = Number(localStorage.getItem('slice-snake-best')) || 0; } catch {}
$('best').textContent = String(best).padStart(3, '0');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#e6e8d9');
const camera = new THREE.PerspectiveCamera(37, 1, .1, 100);
camera.position.set(0, 20, 19); camera.lookAt(0, 0, 0);
const host = $('canvas-host');
try {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
} catch {
  $('overlay-title').textContent = 'A little technical hiccup.';
  $('overlay-copy').textContent = '3D graphics are unavailable. Try a browser with WebGL enabled.';
  $('start').hidden = true;
  $('restart').disabled = true;
  $('speed').disabled = true;
}
scene.add(new THREE.HemisphereLight(0xffffff, 0x718365, 2.7));
const sun = new THREE.DirectionalLight(0xfff5d9, 3.3);
sun.position.set(-7, 16, 8); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
sun.shadow.bias = -.001;
scene.add(sun);
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .75 });
const dark = material('#244e36'), green = material('#48874b'), pale = material('#d7dfbc');
const box = (w, h, d, mat, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
};
scene.add(box(17.4, .65, 17.4, material('#496743'), 0, -.55, 0));
scene.add(box(16.6, .18, 16.6, pale, 0, -.12, 0));
const tileA = material('#ced8b2'), tileB = material('#dbe2c3');
for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) scene.add(box(.97, .025, .97, (x+y)%2 ? tileA : tileB, x-7.5, 0, y-7.5));
const snakeGroup = new THREE.Group(); scene.add(snakeGroup);
const segmentGeo = new THREE.BoxGeometry(.88, .66, .88);
const eyeGeo = new THREE.SphereGeometry(.10, 10, 8), pupilGeo = new THREE.SphereGeometry(.055, 8, 6);
const white = material('#fff9df'), black = material('#1f2921');
const pizza = new THREE.Group();
const shape = new THREE.Shape(); shape.moveTo(0, -.52); shape.lineTo(.47, .40); shape.lineTo(-.47, .40); shape.closePath();
const slice = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: false }), material('#f0b63e'));
slice.rotation.x = -Math.PI/2; slice.castShadow = true; pizza.add(slice);
const crust = box(.94, .17, .15, material('#c98437'), 0, .1, -.4); pizza.add(crust);
for (const [x,z] of [[0,.10],[-.19,-.20],[.18,-.20]]) {
  const topping = new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.04,12), material('#bf3d25'));
  topping.position.set(x,.15,z); pizza.add(topping);
}
scene.add(pizza);
function draw() {
  while (snakeGroup.children.length) snakeGroup.remove(snakeGroup.children[0]);
  game.snake.forEach((point, i) => {
    const mesh = new THREE.Mesh(segmentGeo, i === 0 ? dark : green);
    mesh.position.set(point.x - 7.5, .40, point.y - 7.5); mesh.castShadow = true;
    if (i === 0) {
      mesh.rotation.y = { up: 0, right: -Math.PI/2, down: Math.PI, left: Math.PI/2 }[game.direction];
      for (const x of [-.22,.22]) {
        const eye = new THREE.Mesh(eyeGeo,white); eye.position.set(x,.28,-.25); mesh.add(eye);
        const pupil = new THREE.Mesh(pupilGeo,black); pupil.position.set(x,.33,-.31); mesh.add(pupil);
      }
    }
    snakeGroup.add(mesh);
  });
  pizza.visible = !!game.food;
  if (game.food) pizza.position.set(game.food.x-7.5,.23,game.food.y-7.5);
  $('score').textContent = String(game.score).padStart(3,'0');
  if (game.score > best) {
    best = game.score; $('best').textContent = String(best).padStart(3,'0');
    try { localStorage.setItem('slice-snake-best', String(best)); } catch {}
  }
}
function syncUI() {
  const playing = game.status === 'playing';
  $('overlay').hidden = playing;
  $('pause').disabled = !['playing','paused'].includes(game.status);
  $('pause').textContent = game.status === 'paused' ? '▷' : 'Ⅱ';
  $('pause').setAttribute('aria-label', game.status === 'paused' ? 'Resume game' : 'Pause game');
  $('speed').disabled = ['playing','paused'].includes(game.status);
  const states = {
    paused: ['TAKE A BREATHER', 'Saving your slice.', 'Your game is paused. Jump back in when you’re ready.', 'KEEP GOING'],
    over: ['THAT’S A WRAP', 'Hungry for another?', `You scored ${game.score} points. There’s always room for one more go.`, 'PLAY AGAIN'],
    won: ['CLEAN PLATE CLUB', 'Every bite. Yours.', `You filled the board! Final score: ${game.score}.`, 'PLAY AGAIN'],
  };
  const content = states[game.status];
  if (content) {
    $('overlay-tag').textContent = content[0]; $('overlay-title').textContent = content[1];
    $('overlay-copy').textContent = content[2]; $('start').innerHTML = content[3] + ' <span>↗</span>';
  }
  $('status').textContent = playing ? 'Game started. Use direction buttons or arrow keys.' : content?.[2] || 'Ready to play.';
}
function start() {
  if (!renderer) return;
  if (game.status !== 'paused') game = createGame();
  game.status = 'playing'; elapsed = 0; draw(); syncUI(); $('start').blur();
}
function pause() {
  if (game.status === 'playing') game.status = 'paused';
  else if (game.status === 'paused') { game.status = 'playing'; elapsed = 0; }
  syncUI();
}
$('start').addEventListener('click',start);
$('pause').addEventListener('click',pause);
$('restart').addEventListener('click',() => { game = createGame(); start(); });
document.querySelectorAll('[data-dir]').forEach(button => button.addEventListener('pointerdown',event => { event.preventDefault(); turn(game,button.dataset.dir); }));
document.querySelectorAll('[data-dir]').forEach(button => button.addEventListener('click',event => { if (event.detail === 0) turn(game,button.dataset.dir); }));
const keys = { ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right' };
window.addEventListener('keydown',event => {
  if (event.target.matches('select, input, textarea')) return;
  const direction = keys[event.key] || keys[event.key.toLowerCase()];
  if (direction) { event.preventDefault(); turn(game,direction); }
  if (event.code === 'Space' && !event.target.matches('button, a')) { event.preventDefault(); if (!event.repeat) pause(); }
});
document.addEventListener('visibilitychange',() => { if (document.hidden && game.status === 'playing') pause(); });
window.addEventListener('blur',() => { if (game.status === 'playing') pause(); });
if (renderer) {
  renderer.domElement.addEventListener('webglcontextlost',event => {
    event.preventDefault(); if (game.status === 'playing') pause();
    $('overlay').hidden = false; $('overlay-title').textContent = 'Let’s reconnect.';
    $('overlay-copy').textContent = 'The graphics connection was interrupted. Reload the page to play again.';
    $('start').textContent = 'RELOAD GAME'; $('start').onclick = () => location.reload();
  });
  new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width,height); camera.aspect = width / height; camera.updateProjectionMatrix();
  }).observe(host);
  draw();
  renderer.setAnimationLoop(time => {
    const delta = Math.min(time - (last || time),250); last = time;
    if (game.status === 'playing') {
      elapsed += delta;
      const interval = Number($('speed').value);
      while (elapsed >= interval && game.status === 'playing') {
        elapsed -= interval; const score = game.score; step(game); draw();
        if (score !== game.score) $('status').textContent = `Pizza collected. Score ${game.score}.`;
        if (game.status !== 'playing') syncUI();
      }
    }
    renderer.render(scene,camera);
  });
}
