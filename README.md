# Slice Snake 🍕

**One more bite.** A playable 3D Snake concept for a pizza-box experience: scan a QR code, open the browser game, collect pizza slices, and beat your best score.

Prepared as an independent concept for a potential Pizza Inn box activation. This repository does not imply partnership or brand approval.

## What is included

- Actual Three.js 3D board, snake, lighting, shadows, and pizza-slice food
- Classic grid movement with four touch buttons, arrow keys, and WASD
- Three speeds, score, device-local best score, pause, resume, and restart
- Automatic pause when the tab loses focus
- Mobile and desktop layouts, keyboard focus styles, and status announcements
- Game-rule tests and a pizza-box panel concept

**Status:** playable prototype source. Not deployed. Browser/device visual QA is still required. This version opens a 3D game in the browser; camera AR and tracking the physical box are not implemented.

## Run locally

Requires Node.js 20.11+ and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. On Windows with the project running in WSL, try this same localhost address in your Windows browser. The development server listens on all interfaces; phone access depends on your local network and WSL/firewall configuration.

No environment variables, backend, accounts, or API keys are required. Google Fonts is optional; system fonts are used if it is unavailable. `node_modules` is installed locally and is not committed.

## Play

Choose a pace and select **LET'S PLAY**. Use the on-screen arrows, keyboard arrows, or WASD. Collect pizza for 10 points. Hitting the board edge or your body ends the run. Immediate reversal is disabled. Space pauses/resumes when focus is outside a button or form control. **Start over** immediately resets the run. Difficulty can be changed between runs.

Best scores are saved only in this browser. If browser storage is unavailable, the game still works, but the score will not persist after reload.

## Checks

```sh
npm test
npm run check
```

The rule tests cover movement, growth, input buffering, reversal prevention, wall/body collisions, a vacating tail, pause, the full-board win condition, and initial state. Syntax checks cover the application modules and development server.

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
src/main.js       Three.js scene, rendering, inputs, UI
src/style.css     Responsive layout and visual treatment
index.html        Game screen
server.mjs        Local development server
 tests/           Game-rule tests
 docs/            Box concept and handoff brief
```

## Next phase

- Browser/device QA and live hosting
- Approved brand assets and tested box QR artwork
- Optional AR investigation: confirm target phones, tracking method, and print artwork before implementation

AR scope is separate: attaching the game to a viewed pizza box needs camera access, image tracking, and device testing. No reward redemption or customer data collection is implemented.
