const LEVELS = new Set([190, 140, 95]);
const MAX_SCORE = (16 * 16 - 3) * 10;

export function readChallenge(search) {
  const params = new URLSearchParams(search);
  const score = Number(params.get('challenge'));
  const level = Number(params.get('level'));
  if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE || score % 10 || !LEVELS.has(level)) return null;
  if (params.has('mode') && !['classic', 'endless'].includes(params.get('mode'))) return null;
  return params.get('mode') === 'endless' ? { score, level, mode: 'endless' } : { score, level };
}

export function challengeURL(location, score, level, mode = 'classic') {
  const url = new URL(location);
  url.search = '';
  url.hash = '';
  url.searchParams.set('challenge', String(score));
  url.searchParams.set('level', String(level));
  if (mode === 'endless') url.searchParams.set('mode', mode);
  return url.href;
}

export function createMatch(enabled = false) {
  return { enabled, player: 1, scores: [] };
}

export function advanceMatch(match) {
  if (!match.enabled) return;
  if (match.scores.length === 1) match.player = 2;
  else if (match.scores.length === 2) {
    match.player = 1;
    match.scores = [];
  }
}

export function finishMatchRound(match, score) {
  if (!match.enabled) return null;
  match.scores[match.player - 1] = score;
  if (match.player === 1) return { title: 'Pass the phone.', copy: `Player 1 scored ${score}. Player 2, your turn.`, action: 'PLAYER 2 · PLAY ↗' };
  const [first, second] = match.scores;
  const title = first === second ? 'It’s a draw.' : `Player ${first > second ? 1 : 2} wins!`;
  return { title, copy: `Player 1: ${first} · Player 2: ${second}. One more round?`, action: 'REMATCH ↗' };
}
