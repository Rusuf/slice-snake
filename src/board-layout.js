import { Quaternion, Vector3 } from 'three';

// Includes the board's feet, rim, snake and food, with a little breathing room.
export const BOARD_BOUNDS = Object.freeze({
  min: Object.freeze([-9.4, -1.5, -9.4]),
  max: Object.freeze([9.4, 1.5, 9.4]),
});
const TARGET = new Vector3(0, -.1, 0);
const VIEW_DIRECTION = new Vector3(0, 1.15, 1).normalize();

/** Fit the actual 3D bounds at a fixed viewing angle, including narrow portrait screens. */
export function fitBoardCamera(camera, aspect) {
  camera.aspect = aspect;
  camera.position.copy(TARGET).add(VIEW_DIRECTION);
  camera.lookAt(TARGET);
  const inverseRotation = new Quaternion().copy(camera.quaternion).invert();
  const verticalTangent = Math.tan(camera.fov * Math.PI / 360);
  const horizontalTangent = verticalTangent * aspect;
  let distance = 0;

  for (const x of [BOARD_BOUNDS.min[0], BOARD_BOUNDS.max[0]]) {
    for (const y of [BOARD_BOUNDS.min[1], BOARD_BOUNDS.max[1]]) {
      for (const z of [BOARD_BOUNDS.min[2], BOARD_BOUNDS.max[2]]) {
        const corner = new Vector3(x, y, z).sub(TARGET).applyQuaternion(inverseRotation);
        distance = Math.max(distance,
          Math.abs(corner.x) / horizontalTangent + corner.z,
          Math.abs(corner.y) / verticalTangent + corner.z);
      }
    }
  }

  distance *= 1.08;
  camera.position.copy(TARGET).addScaledVector(VIEW_DIRECTION, distance);
  camera.near = Math.max(.1, distance - 30);
  camera.far = distance + 30;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}


/** Desktop fitting uses scene units; handheld AR uses metres. Never inherit its near plane. */
export function configureARCamera(camera) {
  camera.near = .01;
  camera.far = 30;
  camera.position.set(0, 0, 0);
  camera.quaternion.identity();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
