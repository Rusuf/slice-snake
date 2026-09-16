# Slice Snake 🍕

**One more bite.** A playable 3D Snake concept for a pizza-box experience: scan a QR code, open the browser game, collect pixel bites, and beat your best score.

Prepared as an independent concept for a potential Pizza Inn box activation. This repository does not imply partnership or brand approval.

## What is included

- LCD-green Three.js board, connected pixel snake, shallow 3D depth, and pixel-style food
- Classic grid movement with four touch buttons, arrow keys, and WASD
- Three speeds, score, device-local best score, pause, resume, and restart
- Automatic pause when the tab loses focus
- Viewport-fitted mobile/desktop layouts, landscape side controls, keyboard focus, and status announcements
- Game, storage, and HTTP regression tests; continuous integration; a pizza-box panel concept

**Status:** playable prototype source. Not deployed. Browser/device visual QA is still required. This version opens a 3D game in the browser; camera AR and tracking the physical box are not implemented.

## Run locally

Requires Node.js 20.11+ and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. On Windows with the project running in WSL, try this same localhost address in your Windows browser. The development server binds to loopback by default. For a deliberate local-network preview, use `HOST=0.0.0.0 npm run dev`; phone access also depends on your WSL/firewall configuration.

No environment variables, backend, accounts, or API keys are required. Fonts and application assets are local; gameplay makes no third-party network requests. `node_modules` is installed locally and is not committed.

## Play

Choose a pace and select **LET'S PLAY**. Use the on-screen arrows, keyboard arrows, WASD, or the 2/4/6/8 keypad. Collect a bite for 10 points. Hitting the board edge or your body ends the run. Immediate reversal is disabled. After starting, keyboard focus moves to the board. Space pauses/resumes there; Escape pauses. Buttons retain their normal Enter/Space behavior. **Start over** immediately resets the run. Difficulty can be changed between runs.

Best scores are saved only in this browser. If browser storage is unavailable, the game still works, but the score will not persist after reload.

The board uses the remaining viewport height so the score and controls stay on screen. On short landscape screens, controls move beside the board. Extreme zoom/tiny viewports retain a scrolling fallback to keep controls accessible.

## Checks

```sh
npm test
npm run check
```

The 18 tests cover game rules, invalid/buffered inputs, all four walls, the vacating-tail case, full-board completion, optional/corrupt storage, asset serving, and denied private-file requests. Syntax checks cover all application, server, script, and test modules. GitHub Actions runs these checks on pushes and pull requests. These checks do not replace browser/device QA.

Before sharing a live demo, play one full game in a desktop browser and one on a phone. Confirm controls, pause/resume, restart, layout, and stored best score. Automated browser screenshots were not captured during initial preparation.

## Pizza-box experience

1. Print a small “Scan. Play. One more bite.” panel on the lid or side.
2. Its QR code opens the eventual HTTPS game URL, **not this repository**.
3. The customer plays immediately, with no download or account.

See [the concept panel](docs/box-panel.svg) and [the handoff brief](docs/HANDOFF.md). The panel has an explicitly labeled placeholder, not a working QR code. Generate and phone-test a real QR only after the final live URL exists.

## Hosting later

This is a static application. Upload `index.html`, `src/`, and both `three.module.js` and `three.core.js` from `node_modules/three/build/`, retaining their current `node_modules/three/build/` paths. Relative paths allow hosting under a repository subpath. Do not upload the whole project or use the development server as a production server.

An optional **Deploy demo to GitHub Pages** workflow is included. It runs manually only: enable Pages with GitHub Actions in repository Settings, then run the workflow when you are ready to publish. It does not deploy on push.

## Structure

```text
src/game.js       Independent Snake rules
src/main.js       UI state, keyboard/touch input, fixed-step scheduling
src/scene.js      Three.js resources, instancing, resize, disposal
src/storage.js    Optional local best-score persistence
src/style.css     Responsive layout and visual treatment
index.html        Game screen
server.mjs        Local development server
scripts/check.mjs Syntax checks
tests/            Game, storage, and local HTTP tests
docs/             Box concept, handoff, and engineering notes
```

See [engineering decisions and verification limits](docs/ENGINEERING.md) for the implementation rationale.

## Next phase

- Browser/device QA and live hosting
- Approved brand assets and tested box QR artwork
- Optional AR investigation: confirm target phones, tracking method, and print artwork before implementation

AR scope is separate: attaching the game to a viewed pizza box needs camera access, image tracking, and device testing. No reward redemption or customer data collection is implemented.
