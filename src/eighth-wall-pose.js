import { Matrix4, Quaternion, Vector3 } from 'three';

/** XR8 planar targets use local XY; the game board uses XZ with +Y above it.
 * The centered portrait crop spans the full square's height, not its full width.
 */
export function createTargetPose() {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();
  const planeToBoard = new Matrix4().makeRotationX(Math.PI / 2);
  const result = new Matrix4();
  return detail => {
    const p = detail?.position;
    const q = detail?.rotation;
    if (!p || !q || ![p.x, p.y, p.z, q.x, q.y, q.z, q.w, detail.scale, detail.scaledHeight].every(Number.isFinite)) return null;
    if (detail.scale <= 0 || detail.scaledHeight <= 0 || Math.hypot(q.x, q.y, q.z, q.w) < .00001) return null;
    const size = detail.scale * detail.scaledHeight * .92 / 18.4;
    position.set(p.x, p.y, p.z);
    rotation.set(q.x, q.y, q.z, q.w).normalize();
    scale.setScalar(size);
    return result.compose(position, rotation, scale).multiply(planeToBoard);
  };
}
