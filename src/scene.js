import * as THREE from 'three';
import { SIZE } from './game.js';

const CENTER = (SIZE - 1) / 2;
const HEAD_ROTATION = { up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 };

/** Owns GPU resources only. Game rules and DOM controls never enter this module. */
export function createScene(host, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e6e8d9');
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, .1, 100);
  camera.position.set(0, 22, 19);
  camera.lookAt(0, 0, 0);

  const geometries = new Set();
  const materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = color => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .8 });
    materials.add(value);
    return value;
  };
  const mesh = (shape, surface, position = [0, 0, 0]) => {
    const value = new THREE.Mesh(shape, surface);
    value.position.set(...position);
    value.castShadow = true;
    value.receiveShadow = true;
    return value;
  };
  const box = (width, height, depth) => geometry(new THREE.BoxGeometry(width, height, depth));

  scene.add(new THREE.HemisphereLight(0xffffff, 0x718365, 2.7));
  const sun = new THREE.DirectionalLight(0xfff5d9, 3.3);
  sun.position.set(-7, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
  sun.shadow.bias = -.001;
  scene.add(sun);

  scene.add(mesh(box(17.4, .65, 17.4), material('#496743'), [0, -.55, 0]));
  scene.add(mesh(box(16.6, .18, 16.6), material('#d7dfbc'), [0, -.12, 0]));

  // Two instanced meshes replace 256 individual tile draw calls.
  const tileGeometry = box(.97, .025, .97);
  const matrix = new THREE.Matrix4();
  for (const [parity, color] of ['#ced8b2', '#dbe2c3'].entries()) {
    const tiles = new THREE.InstancedMesh(tileGeometry, material(color), SIZE * SIZE / 2);
    let index = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y) % 2 === parity) {
          tiles.setMatrixAt(index++, matrix.makeTranslation(x - CENTER, 0, y - CENTER));
        }
      }
    }
    tiles.receiveShadow = true;
    tiles.instanceMatrix.needsUpdate = true;
    scene.add(tiles);
  }

  const segmentGeometry = box(.88, .66, .88);
  const body = new THREE.InstancedMesh(segmentGeometry, material('#48874b'), SIZE * SIZE - 1);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.frustumCulled = false; // Instances move within the fixed board bounds.
  body.castShadow = true;
  body.count = 0;
  scene.add(body);

  const head = mesh(segmentGeometry, material('#244e36'));
  const eyeGeometry = geometry(new THREE.SphereGeometry(.10, 10, 8));
  const pupilGeometry = geometry(new THREE.SphereGeometry(.055, 8, 6));
  const white = material('#fff9df');
  const black = material('#1f2921');
  for (const x of [-.22, .22]) {
    head.add(mesh(eyeGeometry, white, [x, .28, -.25]));
    head.add(mesh(pupilGeometry, black, [x, .33, -.31]));
  }
  scene.add(head);

  const pizza = new THREE.Group();
  const triangle = new THREE.Shape();
  triangle.moveTo(0, -.52);
  triangle.lineTo(.47, .40);
  triangle.lineTo(-.47, .40);
  triangle.closePath();
  const sliceGeometry = geometry(new THREE.ExtrudeGeometry(triangle, { depth: .13, bevelEnabled: false }));
  const slice = mesh(sliceGeometry, material('#f0b63e'));
  slice.rotation.x = -Math.PI / 2;
  pizza.add(slice);
  pizza.add(mesh(box(.94, .17, .15), material('#c98437'), [0, .1, -.4]));
  const toppingGeometry = geometry(new THREE.CylinderGeometry(.11, .11, .04, 12));
  const toppingMaterial = material('#bf3d25');
  for (const [x, z] of [[0, .1], [-.19, -.2], [.18, -.2]]) {
    pizza.add(mesh(toppingGeometry, toppingMaterial, [x, .15, z]));
  }
  scene.add(pizza);

  let available = true;
  function render() {
    if (available) renderer.render(scene, camera);
  }

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(9.7, 10 / aspect);
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }

  function handleContextLost(event) {
    event.preventDefault();
    available = false;
    onContextLost();
  }
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    update(game) {
      const first = game.snake[0];
      head.position.set(first.x - CENTER, .4, first.y - CENTER);
      head.rotation.y = HEAD_ROTATION[game.direction];
      body.count = game.snake.length - 1;
      for (let index = 1; index < game.snake.length; index++) {
        const cell = game.snake[index];
        body.setMatrixAt(index - 1, matrix.makeTranslation(cell.x - CENTER, .4, cell.y - CENTER));
      }
      body.instanceMatrix.needsUpdate = true;
      pizza.visible = game.food !== null;
      if (game.food) pizza.position.set(game.food.x - CENTER, .23, game.food.y - CENTER);
      render();
    },
    dispose() {
      available = false;
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      scene.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
