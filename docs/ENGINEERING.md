# Engineering notes

## Scope and boundaries

This is a small client-only game. Native JavaScript modules and one runtime dependency keep installation and hosting straightforward. There is no framework, database, custom build pipeline, or account system because none is required by the prototype's behavior. JSDoc records the game-state model; it is documentation, not a claim of static type checking.

- `game.js` owns grid rules. It mutates the supplied game state one tick at a time and accepts an injectable random source for repeatable tests. It does not access the DOM, storage, time, or Three.js.
- `scene.js` owns meshes, materials, cameras, resizing, rendering, and disposal. It consumes game state but does not modify it.
- `main.js` coordinates explicit ready, playing, paused, over, and won states. A graphics fault stops scheduling and disables gameplay until reload.
- `storage.js` treats persistence as optional. Invalid saved values and blocked/quota-limited storage do not prevent play.

## Input and timing

The simulation moves by one cell per fixed interval. The renderer does not determine game speed. At most two legal direction changes are queued; legality is checked against the last accepted direction. This preserves quick corner inputs without allowing a reversal into the snake. Key-repeat events do not refill the buffer. The tail's departing cell is available on a non-growing move.

The controller cancels its animation callback when paused, finished, hidden, or unfocused. Resuming resets the elapsed clock, preventing a large catch-up jump. Rendering occurs after simulation changes and resize events, not continuously while the board is static. Movement deliberately retains the classic discrete-cell appearance.

## Rendering and device cost

The subtle LCD pixel matrix uses one instanced mesh rather than 256 separate draw calls. A second set of body joints connects the snake cells into a continuous pixel silhouette. Body instances and the head/eyes are reused for the entire session instead of being rebuilt per tick. Geometries and materials are shared, pixel ratio is capped at two, and a fixed orthographic camera keeps directions predictable. Resource cleanup disconnects the resize observer and releases GPU resources on final page exit.

These are implementation choices, not measured performance guarantees. Frame rate, GPU memory use, and battery impact still need checks on actual target phones.

## Interaction and visual system

The viewport layout prioritizes score, game board, and controls. The desktop introduction disappears on narrow or short screens; landscape controls move beside the board. Dynamic viewport units and safe-area insets account for mobile browser chrome. Extreme magnification retains a scroll fallback rather than clipping controls. Cream and tomato red keep the pizza-box identity around an LCD-green playfield. A shallow top-down camera, continuous dark pixel snake, and small food marker recall monochrome handset Snake without claiming a pixel-perfect replica of a specific handset. Local font stacks eliminate remote-font dependencies, though exact letterforms can differ by operating system.

Directional buttons, pause, restart, and the difficulty selector have a minimum 44-pixel touch height. The controller transfers keyboard focus to the board when play starts and to the next action when a run ends. Direction buttons are disabled outside play. Semantic buttons, visible focus, a skip link, and a live status region support keyboard/assistive navigation. This visual reaction game has not undergone a complete accessibility audit and should not be described as fully screen-reader playable.

## Development server

The server defaults to loopback. It serves only the entry HTML, first-level JavaScript/CSS source assets, and the two required Three.js modules. Repository metadata, manifests, environment files, and symlinked assets are excluded. GET and HEAD are supported; other methods are rejected. The server is a development convenience, not a production hosting service.

## Verification record

- 18 automated tests passed: game rules, storage behavior, and HTTP boundaries.
- Syntax checks passed for all nine JavaScript modules, including scripts and tests.
- Whitespace/diff checks passed.
- Browser interaction, screenshots, WebGL recovery, zoom/layout, and real phone performance have not yet been verified. Browser installation requires approval in this workspace.
- No production build or deployment was run. Deployment remains a manual workflow.

## Browser acceptance checklist

1. Inspect at 1440 × 900, 390 × 844, and 320 × 568; check all text and controls without horizontal overflow. Also check enlarged text/zoom.
2. Start with keyboard and pointer. Confirm arrow/WASD turns, button taps, and rapid corners. Confirm held keys do not introduce delayed turns.
3. Pause/resume from the button and board keyboard focus; background the tab and return. No movement should occur while paused.
4. Collect food, lose, restart, and change difficulty between runs. Confirm score and best-score behavior, including reload.
5. Block storage and verify the game still runs. Disable WebGL or simulate context loss: the reload action must replace gameplay and other controls must remain disabled.
6. Inspect browser errors and module requests. Confirm the hosted repository subpath works before generating a printed QR.

## Deliberate omissions

No AR, reward redemption, analytics, remote leaderboard, deployment, or printable working QR is claimed. Actual box tracking needs a separate device/print experiment and acceptance criteria. The current box SVG is concept artwork with an explicitly labeled QR placeholder.
