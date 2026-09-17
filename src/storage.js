const BEST_SCORE_KEY = 'slice-snake-best';

/** Storage may be blocked or contain stale/edited values. Never prevent play. */
export function readBestScore(storage, mode = 'classic') {
  try {
    const value = Number(storage.getItem(mode === 'endless' ? `${BEST_SCORE_KEY}-endless` : BEST_SCORE_KEY));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeBestScore(storage, score, mode = 'classic') {
  try {
    storage.setItem(mode === 'endless' ? `${BEST_SCORE_KEY}-endless` : BEST_SCORE_KEY, String(score));
  } catch {
    // In-memory scoring remains available in restricted browsing contexts.
  }
}
