import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, turn, spawnFood, SIZE } from '../src/game.js';

const playing = () => ({ ...createGame(() => 0), status: 'playing' });

test('moves one square without changing length', () => {
  const game = playing();
  step(game);
  assert.deepEqual(game.snake[0], { x: 7, y: 8 });
  assert.equal(game.snake.length, 3);
});

test('food grows the snake and adds ten points', () => {
  const game = playing();
  game.food = { x: 7, y: 8 };
  step(game, () => 0);
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 4);
  assert.ok(!game.snake.some(cell => cell.x === game.food.x && cell.y === game.food.y));
});

test('reversal is ignored; fast valid turns happen on separate ticks', () => {
  const game = playing();
  turn(game, 'left');
  assert.deepEqual(game.queue, []);
  turn(game, 'up');
  turn(game, 'left');
  step(game);
  assert.deepEqual(game.snake[0], { x: 6, y: 7 });
  step(game);
  assert.deepEqual(game.snake[0], { x: 5, y: 7 });
});

test('ignores unknown directions, duplicate input, and excess buffered turns', () => {
  const game = playing();
  for (const direction of ['constructor', 'toString', 'diagonal', 'right']) turn(game, direction);
  assert.deepEqual(game.queue, []);
  for (const direction of ['up', 'up', 'down', 'left', 'down']) turn(game, direction);
  assert.deepEqual(game.queue, ['up', 'left']);
});

test('each board edge ends the run without moving outside the grid', () => {
  for (const [direction, cell] of [
    ['right', { x: 15, y: 8 }], ['left', { x: 0, y: 8 }],
    ['up', { x: 8, y: 0 }], ['down', { x: 8, y: 15 }],
  ]) {
    const game = playing();
    game.snake = [cell];
    game.direction = direction;
    step(game);
    assert.equal(game.status, 'over', direction);
    assert.deepEqual(game.snake, [cell]);
  }
});

test('body collision ends the run', () => {
  const game = playing();
  game.snake = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }];
  step(game);
  assert.equal(game.status, 'over');
});

test('moving into the vacating tail is valid', () => {
  const game = playing();
  game.snake = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 2 }];
  step(game);
  assert.equal(game.status, 'playing');
});

test('non-playing states ignore both movement and input', () => {
  for (const status of ['ready', 'paused', 'over', 'won']) {
    const game = { ...playing(), status };
    const before = structuredClone(game);
    turn(game, 'up');
    step(game);
    assert.deepEqual(game, before);
  }
});

test('a full board has no food; collecting the final free cell wins', () => {
  const cells = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) cells.push({ x, y });
  }
  assert.equal(spawnFood(cells), null);
  const game = playing();
  game.snake = [
    { x: 14, y: 15 },
    ...cells.filter(cell => !(cell.y === 15 && cell.x >= 14)),
  ];
  game.food = { x: 15, y: 15 };
  step(game);
  assert.equal(game.status, 'won');
  assert.equal(game.snake.length, SIZE * SIZE);
  assert.equal(game.food, null);
});

test('food selection reaches both extremes of the available-cell list', () => {
  assert.deepEqual(spawnFood([], () => 0), { x: 0, y: 0 });
  assert.deepEqual(spawnFood([], () => .999999), { x: SIZE - 1, y: SIZE - 1 });
});

test('a fresh run does not inherit score, queue, or segments from a previous run', () => {
  const first = playing();
  first.score = 50;
  turn(first, 'up');
  const next = createGame();
  assert.equal(next.score, 0);
  assert.equal(next.status, 'ready');
  assert.equal(next.snake.length, 3);
  assert.deepEqual(next.queue, []);
  assert.notEqual(next.snake, first.snake);
});


test('endless wraps all four edges and continues playing', () => {
  for (const [direction, start, expected] of [
    ['right', { x: 15, y: 8 }, { x: 0, y: 8 }],
    ['left', { x: 0, y: 8 }, { x: 15, y: 8 }],
    ['up', { x: 8, y: 0 }, { x: 8, y: 15 }],
    ['down', { x: 8, y: 15 }, { x: 8, y: 0 }],
  ]) {
    const game = { ...createGame(() => 0, 'endless'), status: 'playing', snake: [start], direction, food: null };
    step(game);
    assert.deepEqual(game.snake[0], expected);
    assert.equal(game.status, 'playing');
  }
});

test('endless collects food across the edge and still collides with its body', () => {
  const game = { ...createGame(() => 0, 'endless'), status: 'playing', snake: [{ x: 15, y: 8 }, { x: 14, y: 8 }], food: { x: 0, y: 8 } };
  step(game, () => 0);
  assert.equal(game.score, 10);
  assert.equal(game.snake.length, 3);
  game.snake = [{ x: 15, y: 8 }, { x: 0, y: 8 }, { x: 1, y: 8 }];
  game.food = null;
  step(game);
  assert.equal(game.status, 'over');
});

test('endless can enter the tail cell when it wraps and the tail vacates', () => {
  const game = { ...createGame(() => 0, 'endless'), status: 'playing', snake: [{ x: 15, y: 8 }, { x: 0, y: 8 }], food: null };
  step(game);
  assert.equal(game.status, 'playing');
  assert.deepEqual(game.snake[0], { x: 0, y: 8 });
});
