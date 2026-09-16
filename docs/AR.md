# Android AR prototype

## Try it

1. Open `/target.html` on a computer and print the included image without cropping. It can also be shown on a second screen for a quick experiment.
2. Lay the card flat with its top facing away from the player.
3. Open the game over HTTPS in Chrome on an Android phone.
4. Choose **Play in AR**, allow the rear camera, and point at the entire card.
5. Once the card is found, press Play. Drag the joystick to steer. Keep the card visible.

The default card is MindAR's example image, not Pizza Inn packaging. The real box image and its compiled tracking data must replace `public/assets/demo-target.png` and `demo-target.mind` together. The board is scaled to 92% of the target's shorter dimension. A square target printed on the lid gives a larger playing surface than this portrait test image.

## Implementation

The camera feed stays on the device. MindAR 1.2.5 image tracking is loaded lazily from vendored files when camera mode is requested. The existing Three.js renderer consumes the tracking matrix and a projection matrix adjusted for the video crop. The physical target supplies the base: the tabletop floor, thick chassis, and feet are hidden in AR. Native WebXR is not required.

Joystick directions are relative to the printed card. Four-way snapping, a dead zone, and diagonal hysteresis preserve predictable grid steering. The snake keeps moving when the thumb is released. Left-handed layout is available.

Tracking loss pauses play and hides the unanchored board. Reacquisition requires an explicit resume. Leaving AR, hiding the tab, or exiting the page stops the camera stream and tracking worker. Camera denial, missing hardware, or setup failures return to normal 3D play. Restart/resume are disabled while the target is missing.

## Validation needed on Android hardware

Automated checks cover joystick decisions and asset delivery. They do not establish tracking quality. Before presenting AR as complete, test camera permission, denied permission, printed-card detection, portrait/landscape alignment, loss/reacquisition, thumb gestures, repeated entry/exit, backgrounding, and camera-indicator shutdown on an actual Android phone. Test under normal indoor lighting with a printed target; glare and occlusion can change the result.

The brand logo is sourced from Simbisa's official Pizza Inn page. The final packaging image and brand guidelines have not been supplied. Pass-and-play and shareable score challenges are available. Live networked multiplayer is not implemented.
