import test from 'node:test';
import assert from 'node:assert/strict';
import { readBestScore, writeBestScore } from '../src/storage.js';

test('loads only finite, non-negative integer scores', () => {
  for (const value of [null, 'NaN', 'Infinity', '-10', '3.5', '9007199254740992', 'oops']) {
    assert.equal(readBestScore({ getItem: () => value }), 0);
  }
  assert.equal(readBestScore({ getItem: () => '120' }), 120);
});

test('blocked or missing storage cannot prevent play', () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota exceeded'); },
  };
  assert.equal(readBestScore(blocked), 0);
  assert.equal(readBestScore(undefined), 0);
  assert.doesNotThrow(() => writeBestScore(blocked, 10));
  assert.doesNotThrow(() => writeBestScore(undefined, 10));
});

test('scores round-trip under the same storage key', () => {
  const entries = new Map();
  const storage = {
    getItem: key => entries.get(key),
    setItem: (key, value) => entries.set(key, value),
  };
  writeBestScore(storage, 90);
  assert.equal(readBestScore(storage), 90);
});
