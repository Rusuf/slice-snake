import { Group, Mesh, Shape, ExtrudeGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, SRGBColorSpace } from 'three';

/** Independent floating 3D HUD, facing the viewer without inheriting board placement or size. */
export function createARControls(makeCanvas = () => document.createElement('canvas')) {
  const group = new Group();
  group.visible = false;
  const controls = new Map();
  const resources = [];
  const own = resource => { resources.push(resource); return resource; };
  const shape = new Shape();
  shape.moveTo(-.42, -.5);
  shape.lineTo(.42, -.5); shape.quadraticCurveTo(.5, -.5, .5, -.42);
  shape.lineTo(.5, .42); shape.quadraticCurveTo(.5, .5, .42, .5);
  shape.lineTo(-.42, .5); shape.quadraticCurveTo(-.5, .5, -.5, .42);
  shape.lineTo(-.5, -.42); shape.quadraticCurveTo(-.5, -.5, -.42, -.5);
  const panelShape = own(new ExtrudeGeometry(shape, { depth: .008, bevelEnabled: false, curveSegments: 3, steps: 1 }));
  panelShape.translate(0, 0, -.004);
  function add(id, x, y, width, height = .095, depth = .5) {
    const root = new Group();
    root.name = id;
    const base = new Mesh(panelShape, own(new MeshStandardMaterial({ color: '#215c3c', roughness: .38, metalness: .12 })));
    const canvas = makeCanvas();
    canvas.width = 512; canvas.height = 192;
    const context = canvas.getContext('2d');
    const texture = own(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const face = new Mesh(own(new PlaneGeometry(.92, .82)), own(new MeshBasicMaterial({ map: texture, toneMapped: false })));
    face.position.z = .0045;
    root.add(base, face);
    group.add(root);
    for (const object of [base, face]) object.userData.arAction = id;
    controls.set(id, { root, base, face, canvas, context, texture, signature: '', enabled: false, layout: { x, y, width, height, depth } });
  }
  // Coordinates are fractions of the camera view, keeping the centre free for the board.
  add('score', -.52, .65, .42, .13, .56);
  add('best', .52, .65, .42, .13, .56);
  add('status', 0, .43, .86, .065, .56);
  add('start', -.54, -.36, .40);
  add('pause', -.54, -.36, .40);
  add('restart', -.54, -.61, .40);
  add('reposition', .55, -.36, .40);
  add('smaller', .31, -.61, .20);
  add('larger', .77, -.61, .20);
  add('up', .51, -.36, .14);
  add('left', .19, -.61, .14);
  add('down', .51, -.61, .14);
  add('right', .83, -.61, .14);
  function set(id, label, visible, enabled = true, accent = false) {
    const c = controls.get(id);
    c.root.visible = visible;
    c.enabled = enabled && visible;
    const readout = ['score', 'best', 'status'].includes(id);
    const background = readout ? '#17382d' : !enabled ? '#59635b' : accent ? '#bd392c' : '#215c3c';
    const signature = `${label}|${background}`;
    if (signature === c.signature) return;
    c.signature = signature;
    c.base.material.color.set(background);
    c.context.fillStyle = background;
    c.context.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.context.fillStyle = '#fff8eb';
    c.context.font = 'bold 52px sans-serif';
    c.context.textAlign = 'center';
    c.context.textBaseline = 'middle';
    const lines = label.split('\n');
    if (lines.length === 2) {
      c.context.font = 'bold 28px sans-serif';
      c.context.fillText(lines[0], 256, 40, 460);
      c.context.font = 'bold 86px sans-serif';
      c.context.fillText(lines[1], 256, 123, 460);
    } else c.context.fillText(label, 256, 96, 460);
    c.texture.needsUpdate = true;
  }
  return {
    group,
    layout(pose) {
      const projection = pose.views?.[0]?.projectionMatrix;
      if (!projection || !projection[0] || !projection[5]) return;
      group.position.copy(pose.transform.position);
      group.quaternion.copy(pose.transform.orientation);
      for (const c of controls.values()) {
        const { x, y, width, height, depth } = c.layout;
        const halfWidth = depth / projection[0];
        const halfHeight = depth / projection[5];
        c.root.position.set((x + projection[8]) * halfWidth, (y + projection[9]) * halfHeight, -depth);
        c.root.scale.set(width * halfWidth * 2, height * halfHeight * 2, 1);
      }
      group.updateMatrixWorld(true);
    },
    update({ score = 0, best = 0, status = 'ready', placed = false, ready = false, kind = 'manual', size = 24, mode = 'classic', player = null } = {}) {
      const playing = placed && status === 'playing';
      const finished = ['over', 'won'].includes(status);
      const message = !placed ? (kind === 'surface' ? 'SURFACE FOUND · PLACE BOARD' : 'MANUAL PREVIEW · AIM TO PLACE')
        : status === 'won' ? 'BOARD FULL' : status === 'over' ? 'GAME OVER · TRY AGAIN' : status === 'paused' ? 'PAUSED' : `${mode.toUpperCase()} · COLLECT PIZZA`;
      set('score', `${player ? `PLAYER ${player}` : 'SCORE'}\n${String(score).padStart(3, '0')}`, true, false);
      set('best', `BEST\n${String(best).padStart(3, '0')}`, true, false);
      set('status', message, true, false);
      set('start', !placed ? 'PLACE & PLAY' : finished ? 'PLAY AGAIN' : 'RESUME', !playing, ready, true);
      set('pause', 'PAUSE', playing, ready);
      set('restart', 'RESTART', placed, ready);
      set('reposition', 'MOVE BOARD', placed && !playing, ready);
      set('smaller', `−  ${size} CM`, !playing, ready && size > 15);
      set('larger', `+  ${size} CM`, !playing, ready && size < 45);
      for (const [id, text] of [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]) set(id, text, playing, ready);
    },
    pick(raycaster) {
      if (!group.visible) return null;
      group.updateWorldMatrix(true, true);
      const targets = [];
      for (const [id, c] of controls) {
        if (c.root.visible && c.enabled) targets.push(c.base, c.face);
      }
      return raycaster.intersectObjects(targets, false)[0]?.object.userData.arAction ?? null;
    },
    dispose() { resources.forEach(resource => resource.dispose()); group.removeFromParent(); },
  };
}
