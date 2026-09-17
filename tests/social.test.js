import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMatch, finishMatchRound, readChallenge, challengeURL } from '../src/social.js';

test('pass-and-play advances through two players then resets for a rematch', () => {
  const match = createMatch(true);
  assert.match(finishMatchRound(match, 30).title, /Pass/);
  advanceMatch(match);
  assert.equal(match.player, 2);
  assert.equal(finishMatchRound(match, 50).title, 'Player 2 wins!');
  assert.deepEqual(match.scores, [30, 50]);
  advanceMatch(match);
  assert.equal(match.player, 1);
  assert.deepEqual(match.scores, []);
});

test('pass-and-play distinguishes ties and solo mode', () => {
  const match = createMatch(true);
  finishMatchRound(match, 10);
  advanceMatch(match);
  assert.equal(finishMatchRound(match, 10).title, 'It’s a draw.');
  assert.equal(finishMatchRound(createMatch(), 20), null);
});

test('shared score challenges preserve level and reject invalid values', () => {
  const url = challengeURL('https://example.com/game/?old=1#anchor', 120, 95);
  assert.deepEqual(readChallenge(new URL(url).search), { score: 120, level: 95 });
  for (const query of ['', '?challenge=-10&level=95', '?challenge=999999&level=95', '?challenge=5&level=95', '?challenge=20&level=1']) {
    assert.equal(readChallenge(query), null);
  }
});


test('endless challenges preserve the rules and reject unknown modes', () => {
  const url = challengeURL('https://example.com/', 30, 140, 'endless');
  assert.deepEqual(readChallenge(new URL(url).search), { score: 30, level: 140, mode: 'endless' });
  assert.equal(readChallenge('?challenge=30&level=140&mode=unknown'), null);
});
