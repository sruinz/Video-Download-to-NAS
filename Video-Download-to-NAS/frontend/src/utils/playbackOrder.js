/**
 * 비디오/오디오 플레이어의 반복(off/all/one) 및 셔플(랜덤) 재생 순서 계산 유틸리티
 */

export const REPEAT_MODES = ['off', 'all', 'one'];

/**
 * 반복 모드를 off -> all -> one -> off 순서로 순환한다.
 */
export function getNextRepeatMode(currentMode) {
  const index = REPEAT_MODES.indexOf(currentMode);
  if (index === -1) return 'all';
  return REPEAT_MODES[(index + 1) % REPEAT_MODES.length];
}

/**
 * 다음 재생할 항목을 결정한다.
 *
 * @param {Object} params
 * @param {number} params.playlistLength - 전체 플레이리스트 길이
 * @param {number} params.currentIndex - 현재 재생 인덱스
 * @param {'off'|'all'|'one'} params.repeatMode - 반복 모드
 * @param {boolean} params.isShuffle - 셔플 여부
 * @param {number[]} params.visitedIndices - 셔플 중 이미 재생한 인덱스 목록
 * @param {boolean} [params.fromEnded=false] - 미디어 자연 종료로 인한 호출 여부
 * @param {() => number} [params.randomFn=Math.random] - 테스트용 난수 함수
 * @returns {{ action: 'replay'|'move'|'stop', nextIndex: number, resetVisited: boolean }}
 */
export function resolveNextTrack({
  playlistLength,
  currentIndex,
  repeatMode = 'off',
  isShuffle = false,
  visitedIndices = [],
  fromEnded = false,
  randomFn = Math.random
}) {
  if (fromEnded && repeatMode === 'one') {
    return { action: 'replay', nextIndex: currentIndex, resetVisited: false };
  }

  if (!playlistLength || playlistLength <= 1) {
    if (repeatMode === 'all' || repeatMode === 'one') {
      return { action: 'replay', nextIndex: 0, resetVisited: false };
    }
    return { action: 'stop', nextIndex: currentIndex, resetVisited: false };
  }

  if (isShuffle) {
    const visitedSet = new Set(visitedIndices);
    visitedSet.add(currentIndex);

    const remaining = [];
    for (let i = 0; i < playlistLength; i += 1) {
      if (!visitedSet.has(i)) {
        remaining.push(i);
      }
    }

    if (remaining.length > 0) {
      const picked = remaining[Math.floor(randomFn() * remaining.length)];
      return { action: 'move', nextIndex: picked, resetVisited: false };
    }

    // 모든 곡을 한 바퀴 재생한 경우
    if (repeatMode === 'all' || !fromEnded) {
      const candidates = [];
      for (let i = 0; i < playlistLength; i += 1) {
        if (i !== currentIndex) candidates.push(i);
      }
      const picked = candidates[Math.floor(randomFn() * candidates.length)];
      return { action: 'move', nextIndex: picked, resetVisited: true };
    }

    return { action: 'stop', nextIndex: currentIndex, resetVisited: false };
  }

  // 순차 재생
  if (currentIndex < playlistLength - 1) {
    return { action: 'move', nextIndex: currentIndex + 1, resetVisited: false };
  }

  if (repeatMode === 'all') {
    return { action: 'move', nextIndex: 0, resetVisited: false };
  }

  return { action: 'stop', nextIndex: currentIndex, resetVisited: false };
}

/**
 * 이전 재생할 항목을 결정한다.
 */
export function resolvePreviousTrack({
  playlistLength,
  currentIndex,
  repeatMode = 'off',
  isShuffle = false,
  historyStack = []
}) {
  if (!playlistLength || playlistLength <= 1) {
    return { action: 'replay', prevIndex: currentIndex, popHistory: false };
  }

  if (isShuffle && historyStack.length > 0) {
    const prevIndex = historyStack[historyStack.length - 1];
    if (prevIndex >= 0 && prevIndex < playlistLength) {
      return { action: 'move', prevIndex, popHistory: true };
    }
  }

  if (currentIndex > 0) {
    return { action: 'move', prevIndex: currentIndex - 1, popHistory: false };
  }

  if (repeatMode === 'all') {
    return { action: 'move', prevIndex: playlistLength - 1, popHistory: false };
  }

  return { action: 'stop', prevIndex: currentIndex, popHistory: false };
}
