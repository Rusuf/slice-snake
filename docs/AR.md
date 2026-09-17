# Android AR

## Place on a surface

Requires Chrome on an ARCore-supported Android phone, Google Play Services for AR, and HTTPS. Choose **Play in AR** to see the full 3D pizza-box board immediately while camera tracking is available. Aim the preview, then tap the board to place and play. The thick green tracing frame indicates a detected horizontal surface; amber indicates an estimated manual position that may float above the real surface. The preview follows smoothly and placement locks its displayed transform without replacing the model. The box feet rest on detected surfaces. Detection results survive brief gaps for up to 1.5 seconds, scanning queries are limited to 20 per second, and surface queries stop after placement.

Placement shows the 3D board, its tracing frame, and one short unframed tap hint. Scores, extra banners, and placement buttons stay hidden. During play, only a small scene-lit score and pause button float in the camera view. Swipe in open camera space to steer; the steering hint disappears after the first swipe. The best score and board adjustments appear when paused or at the end of a run. There are no permanent directional buttons or separate best-score panel.

**Controls** switches to the on-screen joystick and menus and hides the floating 3D interface, preventing duplicate buttons. **AR view** returns to the compact interface. Exit stays available. A brief tracking interruption pauses the game but retains the last board image for up to half a second to avoid flicker. Once tracking returns, choose Resume. Longer interruptions show recovery instructions.

AR uses a 1 cm near clipping plane, independent of the desktop camera fit. The box has a layered edge, softly bevelled grid tiles, a cream rim, and contrasting green snake pieces. The full box, rim, snake, food, and floating controls are 3D geometry. AR rendering keeps shadows disabled and reuses control textures until their labels change.

Enable **Endless mode** before starting a run to wrap across all four edges. Self-collisions still end the run, and filling the grid wins. The choice stays locked during a run and between the two players of a match. Endless has a separate personal best, and shared challenge links preserve its rules.

A table, tile, or paper square works for the demo; no box is needed. The guide is manually aligned, not automatic square-edge recognition. Featureless white paper, glare, and dim lighting may make detection harder: include textured surroundings while scanning. The board stays at its placed location; it does not follow paper moved afterward.

Surface mode uses WebXR hit testing and DOM overlay controls. Devices without these features can use card tracking or normal 3D. Placement uses a local reference space, not persistent anchors across sessions.

## Track a demo card

Print `/target.html` without cropping, lay it flat, and choose **Other AR options → Track a demo card**. Allow the rear camera, point at the whole image, and press Play once detected. A second screen can also display the card for an experiment.

This mode uses vendored MindAR 1.2.5 and does not require WebXR. The example image is not Pizza Inn packaging. For final box recognition, replace `public/assets/demo-target.png` and `demo-target.mind` together with the approved box artwork and compiled target. The board scales to 92% of the target’s shorter dimension.

## Controls and tracking

The joystick snaps to four directions with a dead zone and diagonal hysteresis. Its latest valid direction replaces pending thumb turns; keyboard players keep a two-turn buffer. In AR, directions are mapped to the phone’s view. Releasing the joystick keeps the snake moving. Left-handed layout is available.

Tracking loss pauses play. Reacquisition requires an explicit resume. Ending AR releases its session or camera stream. Card mode also closes when the tab is hidden; surface mode pauses when interrupted by native XR visibility changes. Camera images are processed on the device.

## Surface rendering budget

Surface sessions request an XR framebuffer at 80% resolution per axis (36% fewer requested scene pixels); DOM controls retain their normal resolution. Placement reuses guide vectors and its matrix. Once placed, the app cancels surface hit testing and keeps the board transform until resizing, repositioning, or tracking recovery. Repositioning requests a fresh hit-test source; late sources are cancelled after exit.

A regression test runs 120 placed frames with no additional hit-test queries, board-transform writes, or placement callbacks. This verifies reduced application work, not a measured phone frame-rate improvement. Native camera tracking still depends on the device and surroundings.

## Device validation

Automated tests cover steering, placement geometry, and session cleanup; they cannot establish physical tracking quality. Before a demo, check permissions, surface detection, placement and resizing, orientation, tracking loss, thumb steering, and repeated entry/exit on the presenting phone. Confirm the camera indicator clears after exiting AR.

Requirements: https://developers.google.com/ar/develop/webxr/requirements
