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
  scene.background = new THREE.Color('#afbd80');
  const camera = new THREE.OrthographicCamera(-12, 12, 10, -10, .1, 100);
  camera.position.set(0, 28, 12);
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

  scene.add(new THREE.HemisphereLight(0xeaf0d4, 0x67724d, 2.2));
  const sun = new THREE.DirectionalLight(0xf5f5da, 2.2);
  sun.position.set(-7, 16, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
  sun.shadow.bias = -.001;
  scene.add(sun);

  const ink = material('#263a24');
  const lcd = material('#a9b977');
  const rim = material('#657649');
  scene.add(mesh(box(17.2, .36, 17.2), rim, [0, -.35, 0]));
  scene.add(mesh(box(16.6, .14, 16.6), lcd, [0, -.10, 0]));

  // A faint pixel matrix gives alignment cues without the old checkerboard noise.
  const matrix = new THREE.Matrix4();
  const tiles = new THREE.InstancedMesh(box(.986, .012, .986), material('#aebd7d'), SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      tiles.setMatrixAt(y * SIZE + x, matrix.makeTranslation(x - CENTER, 0, y - CENTER));
    }
  }
  tiles.receiveShadow = true;
  tiles.instanceMatrix.needsUpdate = true;
  scene.add(tiles);

  // The visible boundary matches the rules: the playable cells end at +/- 8.
  for (const side of [-1, 1]) {
    scene.add(mesh(box(16.3, .10, .13), ink, [0, .015, side * 8.12]));
    scene.add(mesh(box(.13, .10, 16.3), ink, [side * 8.12, .015, 0]));
  }

  const segmentGeometry = box(.92, .42, .92);
  const body = new THREE.InstancedMesh(segmentGeometry, ink, SIZE * SIZE - 1);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.frustumCulled = false;
  body.castShadow = true;
  body.count = 0;
  scene.add(body);

  // Bridge consecutive cells, including corners, into one continuous pixel snake.
  const joints = new THREE.InstancedMesh(box(.18, .42, .82), ink, SIZE * SIZE - 1);
  joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  joints.frustumCulled = false;
  joints.castShadow = true;
  joints.count = 0;
  scene.add(joints);

  const head = mesh(segmentGeometry, ink);
  const eyeGeometry = box(.12, .012, .12);
  const eyeMaterial = material('#d1db9e');
  for (const x of [-.23, .23]) {
    head.add(mesh(eyeGeometry, eyeMaterial, [x, .216, -.23]));
  }
  scene.add(head);

  // A compact monochrome pixel bite preserves the old LCD game's visual language.
  const food = new THREE.Group();
  const pixelGeometry = box(.24, .20, .24);
  for (const [x, z] of [[0, 0], [-.24, 0], [.24, 0], [0, -.24], [0, .24]]) {
    food.add(mesh(pixelGeometry, ink, [x, .10, z]));
  }
  scene.add(food);

  let available = true;
  function render() {
    if (available) renderer.render(scene, camera);
  }

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(8.7, 9.1 / aspect);
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
      head.position.set(first.x - CENTER, .23, first.y - CENTER);
      head.rotation.y = HEAD_ROTATION[game.direction];
      body.count = game.snake.length - 1;
      joints.count = body.count;
      for (let index = 1; index < game.snake.length; index++) {
        const cell = game.snake[index];
        body.setMatrixAt(index - 1, matrix.makeTranslation(cell.x - CENTER, .23, cell.y - CENTER));
        const previous = game.snake[index - 1];
        matrix.makeRotationY(previous.x === cell.x ? Math.PI / 2 : 0);
        matrix.setPosition((previous.x + cell.x) / 2 - CENTER, .23, (previous.y + cell.y) / 2 - CENTER);
        joints.setMatrixAt(index - 1, matrix);
      }
      body.instanceMatrix.needsUpdate = true;
      joints.instanceMatrix.needsUpdate = true;
      food.visible = game.food !== null;
      if (game.food) food.position.set(game.food.x - CENTER, .02, game.food.y - CENTER);
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
