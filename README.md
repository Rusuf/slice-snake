# Slice Snake

**One more bite.** Classic Snake, reimagined in 3D for a pizza-box arcade experience.

An LCD-green board, a raised pixel snake, and familiar button controls. Collect bites, grow your snake, and beat your best score—all in the browser.

## Run

Requires **Node.js 20.11+**.

```bash
git clone https://github.com/Rusuf/slice-snake.git
cd slice-snake
npm ci
npm run dev
```

Open **http://localhost:5173**.

## Play

Choose **1 · Easy**, **2 · Classic**, or **3 · Fast**, then press **LET’S PLAY**. Each bite earns 10 points. Hitting the edge or your own body ends the run.

| Action | Controls |
| --- | --- |
| Move | On-screen arrows, arrow keys, WASD, or 2/4/6/8 |
| Pause / resume | Pause button, or Space while the board is focused |
| Pause | Escape |
| Restart | ↻ beside the score |
| Change level | Before a run or while paused |

Your best score stays in your browser. The game pauses automatically when you leave the tab.

## Development

Built with **Three.js**, native JavaScript modules, and CSS. No backend or API keys.

```bash
npm test        # Game, storage, and HTTP regression tests
npm run check   # JavaScript syntax checks
```

[Engineering notes](docs/ENGINEERING.md) · [Box concept](docs/box-panel.svg) · [Handoff brief](docs/HANDOFF.md)

## Pizza-box concept

A printed QR code opens the game—no download or account. The repository includes concept artwork; a hosted URL and final QR are the next steps. Camera AR is not part of this version.
