import { Group, Mesh, Shape, ExtrudeGeometry, PlaneGeometry, MeshStandardMaterial, CanvasTexture, SRGBColorSpace } from 'three';

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
  const panelShape = own(new ExtrudeGeometry(shape, { depth: .003, bevelEnabled: false, curveSegments: 3, steps: 1 }));
  panelShape.translate(0, 0, -.0015);
  function add(id, x, y, width, height = .065, depth = .65) {
    const root = new Group();
    root.name = id;
    const base = new Mesh(panelShape, own(new MeshStandardMaterial({ color: '#215c3c', roughness: .38, metalness: .12 })));
    const canvas = makeCanvas();
    canvas.width = 512; canvas.height = 192;
    const context = canvas.getContext('2d');
    const texture = own(new CanvasTexture(canvas));
    texture.colorSpace = SRGBColorSpace;
    const face = new Mesh(own(new PlaneGeometry(.92, .82)), own(new MeshStandardMaterial({ map: texture, transparent: true, roughness: .65, depthWrite: false })));
    face.position.z = .0017;
    root.add(base, face);
    group.add(root);
    for (const object of [base, face]) object.userData.arAction = id;
    controls.set(id, { root, base, face, canvas, context, texture, signature: '', enabled: false, layout: { x, y, width, height, depth } });
  }
  // Compact, scene-lit text and controls leave almost all of the camera view clear.
  add('score', -.50, .68, .40, .038);
  add('hint', 0, -.68, .62, .035);
  add('start', 0, -.42, .30);
  add('pause', .76, .68, .14);
  add('restart', -.43, -.64, .24);
  add('reposition', .33, -.64, .32);
  add('smaller', -.16, -.82, .14);
  add('larger', .16, -.82, .14);
  function set(id, label, visible, enabled = true, accent = false) {
    const c = controls.get(id);
    c.root.visible = visible;
    c.enabled = enabled && visible;
    const readout = ['score', 'hint'].includes(id);
    c.base.visible = !readout;
    const background = !enabled ? '#59635b' : '#234b3a';
    const signature = `${label}|${background}`;
    if (signature === c.signature) return;
    c.signature = signature;
    c.base.material.color.set(background);
    c.context.clearRect(0, 0, c.canvas.width, c.canvas.height);
    if (!readout) {
      c.context.fillStyle = background;
      c.context.fillRect(0, 0, c.canvas.width, c.canvas.height);
    }
    c.context.fillStyle = '#fff8eb';
    c.context.font = 'bold 132px sans-serif';
    c.context.textAlign = 'center';
    c.context.textBaseline = 'middle';
    if (readout) {
      c.context.strokeStyle = 'rgba(15, 30, 20, .8)';
      c.context.lineWidth = 5;
      c.context.strokeText(label, 256, 96, 460);
    }
    c.context.fillText(label, 256, 96, 460);
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
    update({ score = 0, best = 0, status = 'ready', placed = false, ready = false, kind = 'manual', size = 24, mode = 'classic', player = null, swipeUsed = false } = {}) {
      const playing = placed && status === 'playing';
      const finished = ['over', 'won'].includes(status);
      const result = status === 'won' ? ' · Board full' : status === 'over' ? ' · Game over' : '';
      const scoreText = `${player ? `P${player} · ` : ''}${score} pts${playing ? '' : ` · Best ${best}`}${result}`;
      set('score', scoreText, placed, false);
      set('hint', !placed ? (kind === 'surface' ? 'Tap board to place' : 'Tap board · estimated position') : 'Swipe to steer', !placed || (playing && !swipeUsed), false);
      set('start', finished ? 'Play again' : 'Resume', placed && !playing, ready);
      set('pause', 'Ⅱ', playing, ready);
      set('restart', 'Restart', placed && status === 'paused', ready);
      set('reposition', 'Move board', placed && !playing, ready);
      set('smaller', '−', placed && !playing, ready && size > 15);
      set('larger', '+', placed && !playing, ready && size < 45);
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
