# Slice Snake

**One more bite.** Classic Snake, reimagined in 3D.

A miniature tabletop board, a chunky green snake, and thumb-friendly joystick controls. Collect pizza, grow your snake, and beat your best score—all in the browser.

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
| Move | Thumb joystick, arrow keys, WASD, or 2/4/6/8 |
| Pause / resume | Pause button, or Space while the board is focused |
| Pause | Escape |
| Restart | ↻ beside the score |
| Change level | Before a run or while paused |

Switch the joystick side with **Left thumb**. Your best score stays in your browser. The game pauses automatically when you leave the tab.

## Play with friends

Choose **2 players** to take turns on one phone. Both players use the same level; the higher score wins. After a run, **Challenge a friend** shares your score and difficulty as a link.

## Play in AR

On a supported Android phone, open [Slice Snake](https://slice-snake.vercel.app/) in Chrome and choose **Play in AR → Place on a surface**. Scan a well-lit table, tile, or sheet of paper. Align the square guide, adjust its size, then choose **Place board** and Play. No pizza box or printed card needed.

Alternatively, choose **Track a demo card** with the [printed target](https://slice-snake.vercel.app/target.html). [Device requirements and AR setup](docs/AR.md).

## Development

Built with **Three.js**, native JavaScript modules, and CSS. No backend or API keys.

```bash
npm test        # Game, storage, and HTTP regression tests
npm run check   # JavaScript syntax checks
```

[Engineering notes](docs/ENGINEERING.md)
