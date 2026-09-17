import * as THREE from 'three';
import { SIZE } from './game.js';
import { createARControls } from './ar-controls.js';
import { fitBoardCamera, configureARCamera } from './board-layout.js';

const CENTER = (SIZE - 1) / 2;
const SNAKE_HEIGHT = .43;
const HEAD_ROTATION = { up: 0, right: -Math.PI / 2, down: Math.PI, left: Math.PI / 2 };

/** Owns GPU resources and visual interpolation, never game rules or input. */
export function createScene(host, onContextLost) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ece4d5');
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 120);
  const board = new THREE.Group();
  scene.add(board);
  const normalOnly = [];
  let arMode = false;
  let externalFrames = false;
  let spatialControls;
  let spatialMode = false;
  let spatialUIEnabled = true;
  let arPreview = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const geometries = new Set();
  const materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, roughness = .65) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness });
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
  function bevelBox(width, height, depth, radius = .07) {
    const x = width / 2 - radius;
    const y = height / 2 - radius;
    const shape = new THREE.Shape();
    shape.moveTo(-x, -y);
    shape.lineTo(x, -y);
    shape.lineTo(x, y);
    shape.lineTo(-x, y);
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: depth - radius * 2,
      bevelEnabled: true,
      bevelThickness: radius,
      bevelSize: radius,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 1,
    });
    result.translate(0, 0, -depth / 2 + radius);
    return geometry(result);
  }

  scene.add(new THREE.HemisphereLight(0xfff8ec, 0x6c7968, 2));
  const sun = new THREE.DirectionalLight(0xfff2d9, 3.2);
  sun.position.set(-10, 20, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 55 });
  sun.shadow.normalBias = .025;
  sun.shadow.bias = -.0002;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe5efff, 1);
  fill.position.set(9, 10, -8);
  scene.add(fill);

  const tabletop = mesh(geometry(new THREE.PlaneGeometry(200, 200)), material('#ece4d5'), [0, -1.44, 0]);
  tabletop.rotation.x = -Math.PI / 2;
  tabletop.castShadow = false;
  scene.add(tabletop);

  const terracotta = material('#a94831', .48);
  const cream = material('#f5e7c8', .38);
  const edge = material('#543329', .52);
  normalOnly.push(mesh(bevelBox(18.4, .94, 18.4, .16), terracotta, [0, -.75, 0]));
  normalOnly.push(mesh(bevelBox(18.15, .16, 18.15, .05), edge, [0, -1.24, 0]));
  board.add(mesh(box(16.5, .22, 16.5), cream, [0, -.13, 0]));
  const footShape = bevelBox(1.5, .18, 1.5, .04);
  for (const x of [-7.5, 7.5]) {
    for (const z of [-7.5, 7.5]) normalOnly.push(mesh(footShape, edge, [x, -1.35, z]));
  }

  // A recessed dark seam and inset lid make the box read as a solid crafted object.
  normalOnly.push(mesh(bevelBox(18.28, .10, 18.28, .035), edge, [0, -.31, 0]));
  normalOnly.push(mesh(bevelBox(18.16, .14, 18.16, .045), cream, [0, -.22, 0]));

  // The inner rim starts just outside the collision boundary at +/- 8 cells.
  normalOnly.forEach(object => board.add(object));
  const horizontalRim = bevelBox(18.4, .62, 1.1, .09);
  const verticalRim = bevelBox(1.1, .62, 16.2, .09);
  for (const side of [-1, 1]) {
    board.add(mesh(horizontalRim, cream, [0, .13, side * 8.65]));
    board.add(mesh(verticalRim, cream, [side * 8.65, .13, 0]));
  }

  const innerEdge = material('#a89368', .55);
  const innerHorizontal = box(16.22, .07, .10);
  const innerVertical = box(.10, .07, 16.22);
  for (const side of [-1, 1]) {
    board.add(mesh(innerHorizontal, innerEdge, [0, .04, side * 8.08]));
    board.add(mesh(innerVertical, innerEdge, [side * 8.08, .04, 0]));
  }

  const matrix = new THREE.Matrix4();
  const tileShape = bevelBox(.965, .055, .965, .014);
  for (const [parity, color] of ['#f1e5c9', '#d7c49f'].entries()) {
    const tiles = new THREE.InstancedMesh(tileShape, material(color, .48), SIZE * SIZE / 2);
    let index = 0;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if ((x + y) % 2 === parity) tiles.setMatrixAt(index++, matrix.makeTranslation(x - CENTER, 0, y - CENTER));
      }
    }
    tiles.receiveShadow = true;
    tiles.instanceMatrix.needsUpdate = true;
    board.add(tiles);
  }

  const green = material('#318958', .3);
  const darkGreen = material('#164f37', .28);
  const segmentShape = bevelBox(.88, .78, .88, .09);
  const body = new THREE.InstancedMesh(segmentShape, green, SIZE * SIZE - 1);
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  body.frustumCulled = false;
  body.castShadow = true;
  body.receiveShadow = true;
  body.count = 0;
  board.add(body);

  // Lower connectors keep the silhouette continuous while individual blocks retain depth.
  const joints = new THREE.InstancedMesh(box(.65, .58, 1), green, SIZE * SIZE - 1);
  joints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  joints.frustumCulled = false;
  joints.castShadow = true;
  joints.receiveShadow = true;
  joints.count = 0;
  board.add(joints);

  const head = mesh(bevelBox(.94, .84, .94, .10), darkGreen);
  const eyeShape = bevelBox(.22, .06, .25, .018);
  const pupilShape = box(.09, .02, .12);
  const ivory = material('#fff7dc');
  const black = material('#142d23');
  for (const x of [-.23, .23]) {
    head.add(mesh(eyeShape, ivory, [x, .425, -.20]));
    head.add(mesh(pupilShape, black, [x, .465, -.245]));
  }
  board.add(head);

  const food = new THREE.Group();
  const triangle = new THREE.Shape();
  triangle.moveTo(0, -.55);
  triangle.lineTo(.48, .38);
  triangle.quadraticCurveTo(0, .57, -.48, .38);
  triangle.closePath();
  const sliceShape = geometry(new THREE.ExtrudeGeometry(triangle, {
    depth: .17, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1,
  }));
  const slice = mesh(sliceShape, material('#f3bd43', .5));
  slice.rotation.x = -Math.PI / 2;
  food.add(slice);
  food.add(mesh(bevelBox(.94, .22, .20, .06), material('#c88037'), [0, .12, -.39]));
  const toppingShape = geometry(new THREE.CylinderGeometry(.11, .11, .035, 10));
  const tomato = material('#ba3a26', .55);
  for (const [x, z] of [[0, .12], [-.18, -.19], [.18, -.19]]) {
    food.add(mesh(toppingShape, tomato, [x, .205, z]));
  }
  food.rotation.y = -.2;
  board.add(food);

  let available = true;
  let targetCells = [];
  let sourceCells = [];
  let startTime = 0;
  let duration = 0;
  let moving = false;
  const positions = Array.from({ length: SIZE * SIZE }, () => new THREE.Vector3());
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const midpoint = new THREE.Vector3();

  function drawSnake(progress) {
    for (let index = 0; index < targetCells.length; index++) {
      const to = targetCells[index];
      const source = sourceCells[index] ?? to;
      // Teleport at a wrapped edge instead of sliding across the whole board.
      const from = Math.abs(source.x - to.x) > 1 || Math.abs(source.y - to.y) > 1 ? to : source;
      positions[index].set(
        THREE.MathUtils.lerp(from.x, to.x, progress) - CENTER,
        SNAKE_HEIGHT,
        THREE.MathUtils.lerp(from.y, to.y, progress) - CENTER,
      );
    }
    if (!targetCells.length) return;
    head.position.copy(positions[0]);
    body.count = targetCells.length - 1;
    joints.count = body.count;
    for (let index = 1; index < targetCells.length; index++) {
      body.setMatrixAt(index - 1, matrix.makeTranslation(positions[index].x, positions[index].y, positions[index].z));
      const current = positions[index];
      const previous = positions[index - 1];
      midpoint.copy(current).add(previous).multiplyScalar(.5);
      midpoint.y -= .05;
      rotation.setFromAxisAngle(axis, Math.atan2(previous.x - current.x, previous.z - current.z));
      const distance = current.distanceTo(previous);
      // Segments on opposite edges must not form a connector across the board.
      scale.set(1, 1, distance > 2 ? 0 : distance);
      joints.setMatrixAt(index - 1, matrix.compose(midpoint, rotation, scale));
    }
    body.instanceMatrix.needsUpdate = true;
    joints.instanceMatrix.needsUpdate = true;
  }

  function render(force = false) {
    if (externalFrames && !force) return;
    if (available && !renderer.xr.isPresenting) renderer.render(scene, camera);
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || renderer.xr.isPresenting) return;
    if (!arMode) fitBoardCamera(camera, width / height);
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
    getXRContext() { return { renderer, scene, camera }; },
    directionForScreen(direction) {
      if (!arMode || !board.visible) return direction;
      board.updateWorldMatrix(true, false);
      const activeCamera = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
      const projectionCamera = activeCamera.cameras?.[0] ?? activeCamera;
      const center = board.localToWorld(new THREE.Vector3(0, SNAKE_HEIGHT, 0)).project(projectionCamera);
      const requested = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[direction];
      let best = direction;
      let bestDot = -Infinity;
      for (const [name, [x, z]] of Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] })) {
        const projected = board.localToWorld(new THREE.Vector3(x, SNAKE_HEIGHT, z)).project(projectionCamera).sub(center);
        const length = Math.hypot(projected.x, projected.y);
        if (length < .00001) continue;
        const dot = (projected.x * requested[0] + projected.y * requested[1]) / length;
        if (dot > bestDot) { bestDot = dot; best = name; }
      }
      return best;
    },
    enterAR(options = {}) {
      externalFrames = Boolean(options.externalFrames);
      spatialMode = Boolean(options.solidBoard);
      arMode = true;
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.shadowMap.enabled = false;
      tabletop.visible = false;
      normalOnly.forEach(object => { object.visible = Boolean(options.solidBoard); });
      if (options.solidBoard) {
        spatialControls ??= createARControls();
        scene.add(spatialControls.group);
        spatialControls.group.visible = true;
      }
      board.matrixAutoUpdate = false;
      board.visible = false;
      configureARCamera(camera);
    },
    layoutARControls(pose) { spatialControls?.layout(pose); },
    setARControls(state) {
      spatialUIEnabled = !state.screenControls;
      spatialControls?.update(state);
      if (spatialControls) spatialControls.group.visible = board.visible && spatialMode && spatialUIEnabled;
    },
    setARPreview(value) { arPreview = value; },
    pickARAction(clientX, clientY, width, height) {
      if (!arMode || !board.visible || !renderer.xr.isPresenting || !width || !height) return null;
      const xrCamera = renderer.xr.getCamera();
      const activeCamera = xrCamera.cameras[0] ?? xrCamera;
      pointer.set(clientX / width * 2 - 1, 1 - clientY / height * 2);
      raycaster.setFromCamera(pointer, activeCamera);
      const action = spatialControls?.pick(raycaster);
      if (action) return action;
      // The whole board is also a placement target, not just the small button.
      if (arPreview && raycaster.intersectObjects(board.children, true).length) return 'start';
      return null;
    },
    setARProjection(elements) {
      camera.projectionMatrix.fromArray(elements);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    },
    trackAR(matrix, visible) {
      if (!arMode) return;
      board.visible = visible;
      if (spatialControls) spatialControls.group.visible = visible && spatialMode && spatialUIEnabled;
      if (matrix) board.matrix.copy(matrix);
      board.matrixWorldNeedsUpdate = true;
    },
    renderAR() { if (arMode) render(true); },
    exitAR() {
      externalFrames = false;
      arMode = false;
      spatialMode = false;
      arPreview = false;
      if (spatialControls) spatialControls.group.visible = false;
      scene.background = new THREE.Color('#ece4d5');
      renderer.shadowMap.enabled = true;
      tabletop.visible = true;
      normalOnly.forEach(object => { object.visible = true; });
      board.matrixAutoUpdate = true;
      board.position.set(0, 0, 0);
      board.quaternion.identity();
      board.scale.set(1, 1, 1);
      board.updateMatrix();
      board.visible = true;
      resize();
    },
    update(game, { animate = false, time = 0, stepDuration = 140 } = {}) {
      sourceCells = targetCells;
      targetCells = game.snake.map(cell => ({ ...cell }));
      if (targetCells.length > sourceCells.length && sourceCells.length) {
        sourceCells = [...sourceCells, { ...sourceCells.at(-1) }];
      }
      moving = animate && sourceCells.length > 0;
      startTime = time;
      duration = stepDuration;
      head.rotation.y = HEAD_ROTATION[game.direction];
      food.visible = game.food !== null;
      if (game.food) food.position.set(game.food.x - CENTER, .06, game.food.y - CENTER);
      drawSnake(moving ? 0 : 1);
      render();
    },
    animate(time) {
      if (!moving || !available) return;
      const progress = Math.min(1, Math.max(0, (time - startTime) / duration));
      drawSnake(progress);
      render();
      if (progress === 1) moving = false;
    },
    settle() {
      moving = false;
      drawSnake(1);
      render();
    },
    dispose() {
      available = false;
      observer.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      scene.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
      spatialControls?.dispose();
      geometries.forEach(value => value.dispose());
      materials.forEach(value => value.dispose());
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
