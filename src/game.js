/** @typedef {{ x: number, y: number }} Cell */
/** @typedef {'up' | 'down' | 'left' | 'right'} Direction */
/** @typedef {'ready' | 'playing' | 'paused' | 'over' | 'won'} Status */
/**
 * @typedef {object} Game
 * @property {Cell[]} snake Head first; every segment occupies one grid cell.
 * @property {Direction} direction
 * @property {Direction[]} queue Accepted turns, consumed one per simulation tick.
 * @property {Cell | null} food
 * @property {number} score
 * @property {Status} status
 */

export const SIZE = 16;
export const POINTS_PER_SLICE = 10;
const INPUT_BUFFER_SIZE = 2;
const DIRECTIONS = Object.freeze({
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
});

/** Pick uniformly from free cells; terminate even when the board is full. */
export function spawnFood(snake, random = Math.random) {
  const occupied = new Set(snake.map(({ x, y }) => y * SIZE + x));
  const free = [];

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!occupied.has(y * SIZE + x)) free.push({ x, y });
    }
  }

  return free.length > 0 ? free[Math.floor(random() * free.length)] : null;
}

/** @returns {Game} A fresh run, waiting for an explicit start. */
export function createGame(random = Math.random) {
  const snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];

  return {
    snake,
    direction: 'right',
    queue: [],
    food: spawnFood(snake, random),
    score: 0,
    status: 'ready',
  };
}

/** Queue a legal turn relative to the last accepted direction, not just the head. */
export function turn(game, direction) {
  if (
    !Object.hasOwn(DIRECTIONS, direction) ||
    game.queue.length >= INPUT_BUFFER_SIZE ||
    game.status !== 'playing'
  ) return;

  const prior = game.queue.at(-1) ?? game.direction;
  const [priorX, priorY] = DIRECTIONS[prior];
  const [nextX, nextY] = DIRECTIONS[direction];
  const reverses = priorX + nextX === 0 && priorY + nextY === 0;

  if (prior !== direction && !reverses) game.queue.push(direction);
}

/** Mutate exactly one simulation tick. Rendering and wall-clock time live elsewhere. */
export function step(game, random = Math.random) {
  if (game.status !== 'playing') return;

  game.direction = game.queue.shift() ?? game.direction;
  const [dx, dy] = DIRECTIONS[game.direction];
  const head = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  const eats = game.food !== null && head.x === game.food.x && head.y === game.food.y;
  // The tail vacates its cell on a normal move, so moving into it is legal.
  const body = eats ? game.snake : game.snake.slice(0, -1);
  const hitsWall = head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE;
  const hitsBody = body.some(cell => cell.x === head.x && cell.y === head.y);

  if (hitsWall || hitsBody) {
    game.status = 'over';
    return;
  }

  game.snake.unshift(head);
  if (!eats) {
    game.snake.pop();
    return;
  }

  game.score += POINTS_PER_SLICE;
  game.food = spawnFood(game.snake, random);
  if (game.food === null) game.status = 'won';
}

/** A held joystick represents current intent, not a history of flicks. */
export function steer(game, direction) {
  if (game.status !== 'playing' || !Object.hasOwn(DIRECTIONS, direction)) return false;
  const [dx, dy] = DIRECTIONS[game.direction];
  const [nextX, nextY] = DIRECTIONS[direction];
  if (dx + nextX === 0 && dy + nextY === 0) return false;
  game.queue = direction === game.direction ? [] : [direction];
  return true;
}
