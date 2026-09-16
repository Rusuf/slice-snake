import test from 'node:test';
import assert from 'node:assert/strict';
import { joystickDirection } from '../src/joystick.js';
import { createGame, turn, step } from '../src/game.js';

test('thumb motion inside the dead zone does not steer', () => {
  for (const [x, y] of [[0, 0], [5, 5], [-4, 3]]) {
    assert.equal(joystickDirection(x, y), null);
  }
});

test('thumb gestures snap to the dominant axis', () => {
  assert.equal(joystickDirection(30, 12), 'right');
  assert.equal(joystickDirection(-30, 12), 'left');
  assert.equal(joystickDirection(12, -30), 'up');
  assert.equal(joystickDirection(12, 30), 'down');
});

test('small diagonal jitter preserves the prior direction until intent is clear', () => {
  assert.equal(joystickDirection(29, -30, 'right'), 'right');
  assert.equal(joystickDirection(29, -30, 'up'), 'up');
  assert.equal(joystickDirection(20, -35, 'right'), 'up');
  assert.equal(joystickDirection(-30, 29, 'right'), 'left');
});

test('joystick steering retains the game reversal guard and turn buffer', () => {
  const game = createGame(() => 0);
  game.status = 'playing';
  turn(game, joystickDirection(-30, 0));
  assert.deepEqual(game.queue, []);
  turn(game, joystickDirection(0, -30));
  turn(game, joystickDirection(-30, 0));
  step(game);
  assert.deepEqual(game.snake[0], { x: 6, y: 7 });
  step(game);
  assert.deepEqual(game.snake[0], { x: 5, y: 7 });
});
