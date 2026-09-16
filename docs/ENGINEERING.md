# Engineering notes

## Scope and boundaries

This is a small client-only game. Native JavaScript modules and Three.js plus a lazily loaded, pinned MindAR runtime keep installation and hosting straightforward. There is no frontend framework, database, or account system because none is required by the prototype's behavior. JSDoc records the game-state model; it is documentation, not a claim of static type checking.

- `game.js` owns grid rules. It mutates the supplied game state one tick at a time and accepts an injectable random source for repeatable tests. It does not access the DOM, storage, time, or Three.js.
- `scene.js` owns meshes, materials, cameras, resizing, rendering, and disposal. It consumes game state but does not modify it.
- `main.js` coordinates explicit ready, playing, paused, over, and won states. A graphics fault stops scheduling and disables gameplay until reload.
- `storage.js` treats persistence as optional. Invalid saved values and blocked/quota-limited storage do not prevent play.

## Input and timing

The simulation moves by one cell per fixed interval. The renderer does not determine game speed; mesh positions interpolate between completed simulation states. At most two legal direction changes are queued; legality is checked against the last accepted direction. This preserves quick corner inputs without allowing a reversal into the snake. Key-repeat events do not refill the buffer. The tail's departing cell is available on a non-growing move.

The controller cancels its animation callback when paused, finished, hidden, or unfocused. Resuming resets the elapsed clock, preventing a large catch-up jump. Rendering continues during the short transition between cells and stops once it completes. Pause settles that transition, and reduced-motion preferences use immediate cell updates. The simulation remains discrete and deterministic.

## Rendering and device cost

The cream checkerboard uses two instanced meshes rather than 256 separate tile draw calls. The snake's bevelled segments and lower connectors are reused, including during interpolation. Shared geometries and materials, capped pixel ratio, and a fixed perspective camera keep the scene bounded. The camera fits all corners of the board's 3D bounding box for the actual viewport aspect ratio. A single shadow-casting key light and a fill light reveal height, bevels, and the recessed surface. Resource cleanup disconnects the resize observer and releases GPU resources on final page exit.

These are implementation choices, not measured performance guarantees. Frame rate, GPU memory use, and battery impact still need checks on actual target phones.

## Interaction and visual system

The viewport layout prioritizes score, game board, and controls. The desktop introduction disappears on narrow or short screens; landscape controls move beside the board. Dynamic viewport units and safe-area insets account for mobile browser chrome. Extreme magnification retains a scroll fallback rather than clipping controls. Cream and tomato red keep the pizza-box identity around a miniature tabletop playfield. The camera angle, terracotta chassis, cream rim, raised green snake, and pizza food emphasize physical depth while retaining classic grid controls. Local font stacks eliminate remote-font dependencies, though exact letterforms can differ by operating system.

The thumb joystick replaces the directional buttons, with four-way snapping and left-handed placement. Pause, restart, and level buttons retain 44-pixel touch height. The controller transfers keyboard focus to the board when play starts and to the next action when a run ends. The joystick is disabled outside play. Semantic buttons, visible focus, a skip link, and a live status region support keyboard/assistive navigation. This visual reaction game has not undergone a complete accessibility audit and should not be described as fully screen-reader playable.

## Development server

The server defaults to loopback. It serves the entry HTML, printable target page, first-level JavaScript/CSS source assets, two required Three.js modules, and allowlisted asset/runtime files under public/. Repository metadata, manifests, environment files, and symlinked assets are excluded. GET and HEAD are supported; other methods are rejected. The server is a development convenience, not a production hosting service.

## Verification record

- Tests cover game rules, camera framing, joystick gestures, camera cancellation/denial, local social play, storage, and public HTTP assets.
- Syntax checks cover application modules, scripts, and tests.
- Whitespace/diff checks passed.
- Browser interaction, screenshots, WebGL recovery, zoom/layout, and real phone performance have not yet been verified. Browser installation requires approval in this workspace.
- Vercel handles production builds and deployment after push. No local production build is run.

## Browser acceptance checklist

1. Inspect at 1440 × 900, 390 × 844, and 320 × 568; check all text and controls without horizontal overflow. Also check enlarged text/zoom.
2. Start with keyboard and pointer. Confirm arrow/WASD turns, button taps, and rapid corners. Confirm held keys do not introduce delayed turns.
3. Pause/resume from the button and board keyboard focus; background the tab and return. No movement should occur while paused.
4. Collect food, lose, restart, and change difficulty between runs. Confirm score and best-score behavior, including reload.
5. Block storage and verify the game still runs. Disable WebGL or simulate context loss: the reload action must replace gameplay and other controls must remain disabled.
6. Inspect browser errors and module requests. Confirm the hosted repository subpath works before generating a printed QR.

## Deliberate omissions

The Android camera prototype uses the included MindAR test card and still needs physical-phone acceptance testing. Actual Pizza Inn box artwork has not been supplied. Pass-and-play and shared score links are client-side; there is no authoritative online leaderboard, reward redemption, analytics, or live networked multiplayer. See AR.md for the device checklist and ASSETS.md for provenance.
