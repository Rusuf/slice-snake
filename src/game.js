export const SIZE = 16;
export const DIRECTIONS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export function spawnFood(snake, random = Math.random) {
  const free = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!snake.some(p => p.x === x && p.y === y)) free.push({ x, y });
  }
  return free.length ? free[Math.floor(random() * free.length)] : null;
}
export function createGame(random = Math.random) {
  const snake = [{ x: 6, y: 8 }, { x: 5, y: 8 }, { x: 4, y: 8 }];
  return { snake, direction: 'right', queue: [], food: spawnFood(snake, random), score: 0, status: 'ready' };
}
export function turn(game, direction) {
  if (!DIRECTIONS[direction] || game.queue.length >= 2 || game.status !== 'playing') return;
  const prior = game.queue.at(-1) || game.direction;
  const a = DIRECTIONS[prior], b = DIRECTIONS[direction];
  if (prior !== direction && !(a[0] + b[0] === 0 && a[1] + b[1] === 0)) game.queue.push(direction);
}
export function step(game, random = Math.random) {
  if (game.status !== 'playing') return;
  game.direction = game.queue.shift() || game.direction;
  const [dx, dy] = DIRECTIONS[game.direction];
  const head = { x: game.snake[0].x + dx, y: game.snake[0].y + dy };
  const eats = game.food && head.x === game.food.x && head.y === game.food.y;
  const body = eats ? game.snake : game.snake.slice(0, -1);
  if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE || body.some(p => p.x === head.x && p.y === head.y)) {
    game.status = 'over'; return;
  }
  game.snake.unshift(head);
  if (eats) { game.score += 10; game.food = spawnFood(game.snake, random); if (!game.food) game.status = 'won'; }
  else game.snake.pop();
}
