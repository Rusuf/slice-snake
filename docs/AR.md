# Android AR

## Place on a surface

Requires Chrome on an ARCore-supported Android phone, Google Play Services for AR, and HTTPS. Choose **Play in AR → Place on a surface**, move slowly over a well-lit horizontal surface, then align the square guide. Adjust its width from 15–45 cm with −/+, choose **Place board**, then Play. **Reposition** pauses the game and lets you place it again.

A table, tile, or paper square works for the demo; no box is needed. The guide is manually aligned, not automatic square-edge recognition. Featureless white paper, glare, and dim lighting may make detection harder: include textured surroundings while scanning. The board stays at its placed location; it does not follow paper moved afterward.

Surface mode uses WebXR hit testing and DOM overlay controls. Devices without these features can use card tracking or normal 3D. Placement uses a local reference space, not persistent anchors across sessions.

## Track a demo card

Print `/target.html` without cropping, lay it flat, and choose **Play in AR → Track a demo card**. Allow the rear camera, point at the whole image, and press Play once detected. A second screen can also display the card for an experiment.

This mode uses vendored MindAR 1.2.5 and does not require WebXR. The example image is not Pizza Inn packaging. For final box recognition, replace `public/assets/demo-target.png` and `demo-target.mind` together with the approved box artwork and compiled target. The board scales to 92% of the target’s shorter dimension.

## Controls and tracking

The joystick snaps to four directions with a dead zone and diagonal hysteresis. Its latest valid direction replaces pending thumb turns; keyboard players keep a two-turn buffer. In AR, directions are mapped to the phone’s view. Releasing the joystick keeps the snake moving. Left-handed layout is available.

Tracking loss pauses play. Reacquisition requires an explicit resume. Ending AR releases its session or camera stream. Card mode also closes when the tab is hidden; surface mode pauses when interrupted by native XR visibility changes. Camera images are processed on the device.

## Device validation

Automated tests cover steering, placement geometry, and session cleanup; they cannot establish physical tracking quality. Before a demo, check permissions, surface detection, placement and resizing, orientation, tracking loss, thumb steering, and repeated entry/exit on the presenting phone. Confirm the camera indicator clears after exiting AR.

Requirements: https://developers.google.com/ar/develop/webxr/requirements
