import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFolderSegments,
  extractDisplayFilename,
  extractDomainLabel,
  extractMonthLabel,
  buildFolderViewData
} from './folderTree.js';
import {
  getNextRepeatMode,
  resolveNextTrack,
  resolvePreviousTrack
} from './playbackOrder.js';

const sampleFiles = [
  {
    id: 1,
    filename: 'sruinz/2026-11-01/youtube/video1.mp4',
    original_url: 'https://www.youtube.com/watch?v=abc',
    file_type: 'video',
    file_size: 1000,
    thumbnail: 'thumb1.jpg',
    created_at: '2026-11-01T10:00:00Z',
    uploader: { id: 1, username: 'sruinz' }
  },
  {
    id: 2,
    filename: 'sruinz/2026-11-01/x.com/clip2.mp4',
    original_url: 'https://x.com/user/status/123',
    file_type: 'video',
    file_size: 2000,
    thumbnail: null,
    created_at: '2026-11-02T10:00:00Z',
    uploader: { id: 2, username: 'guest' }
  },
  {
    id: 3,
    filename: 'sruinz/root_clip.mp4',
    original_url: 'https://x.com/user/status/456',
    file_type: 'video',
    file_size: 3000,
    thumbnail: 'thumb3.jpg',
    created_at: '2026-10-15T10:00:00Z',
    uploader: { id: 1, username: 'sruinz' }
  }
];

test('실제 NAS 경로에서 사용자 루트 접두사를 제거하고 폴더 세그먼트를 정확히 파싱한다', () => {
  assert.deepEqual(extractFolderSegments('sruinz/2026-11-01/youtube/video1.mp4', 'sruinz'), ['2026-11-01', 'youtube']);
  assert.deepEqual(extractFolderSegments('sruinz/root_clip.mp4', 'sruinz'), []);
  assert.equal(extractDisplayFilename('sruinz/2026-11-01/youtube/video1.mp4'), 'video1.mp4');
  assert.equal(extractDomainLabel('https://www.youtube.com/watch?v=abc'), 'youtube.com');
  assert.equal(extractMonthLabel('2026-11-01T10:00:00Z'), '2026-11');
});

test('실제 폴더(actual) 모드에서 계층별 하위 폴더와 직속 파일을 정확히 분리한다', () => {
  const rootView = buildFolderViewData(sampleFiles, {
    mode: 'actual',
    currentPath: [],
    username: 'sruinz'
  });
  assert.equal(rootView.folders.length, 1);
  assert.equal(rootView.folders[0].name, '2026-11-01');
  assert.equal(rootView.folders[0].fileCount, 2);
  assert.equal(rootView.folders[0].totalSize, 3000);
  assert.equal(rootView.files.length, 1);
  assert.equal(rootView.files[0].id, 3);

  const subView = buildFolderViewData(sampleFiles, {
    mode: 'actual',
    currentPath: ['2026-11-01'],
    username: 'sruinz'
  });
  assert.deepEqual(subView.folders.map((f) => f.name), ['x.com', 'youtube']);
  assert.equal(subView.files.length, 0);

  const leafView = buildFolderViewData(sampleFiles, {
    mode: 'actual',
    currentPath: ['2026-11-01', 'youtube'],
    username: 'sruinz'
  });
  assert.equal(leafView.folders.length, 0);
  assert.equal(leafView.files.length, 1);
  assert.equal(leafView.files[0].id, 1);
});

test('가상 폴더 모드(월별·사이트별·작성자별)에서 그룹핑과 폴더 진입이 정확히 동작한다', () => {
  const dateRoot = buildFolderViewData(sampleFiles, { mode: 'date', currentPath: [] });
  assert.deepEqual(dateRoot.folders.map((f) => f.name), ['2026-11', '2026-10']);
  assert.equal(dateRoot.folders[0].fileCount, 2);

  const dateLeaf = buildFolderViewData(sampleFiles, { mode: 'date', currentPath: ['2026-11'] });
  assert.deepEqual(dateLeaf.files.map((f) => f.id), [1, 2]);

  const siteRoot = buildFolderViewData(sampleFiles, { mode: 'site', currentPath: [] });
  assert.deepEqual(siteRoot.folders.map((f) => f.name), ['x.com', 'youtube.com']);

  const uploaderRoot = buildFolderViewData(sampleFiles, { mode: 'uploader', currentPath: [] });
  assert.deepEqual(uploaderRoot.folders.map((f) => f.name), ['sruinz', 'guest']);
});

test('반복 모드 순환과 1개 반복·전체 반복·셔플 재생 순서가 정확히 계산된다', () => {
  assert.equal(getNextRepeatMode('off'), 'all');
  assert.equal(getNextRepeatMode('all'), 'one');
  assert.equal(getNextRepeatMode('one'), 'off');

  // 1개 반복은 종료 시 같은 곡 재생
  assert.deepEqual(
    resolveNextTrack({ playlistLength: 3, currentIndex: 1, repeatMode: 'one', isShuffle: false, fromEnded: true }),
    { action: 'replay', nextIndex: 1, resetVisited: false }
  );

  // 전체 반복 시 마지막 곡에서 0번으로 순환
  assert.deepEqual(
    resolveNextTrack({ playlistLength: 3, currentIndex: 2, repeatMode: 'all', isShuffle: false, fromEnded: true }),
    { action: 'move', nextIndex: 0, resetVisited: false }
  );

  // 반복 끔 시 마지막 곡에서 정지
  assert.deepEqual(
    resolveNextTrack({ playlistLength: 3, currentIndex: 2, repeatMode: 'off', isShuffle: false, fromEnded: true }),
    { action: 'stop', nextIndex: 2, resetVisited: false }
  );

  // 셔플 모드에서 미방문 인덱스 선택
  const shuffled = resolveNextTrack({
    playlistLength: 3,
    currentIndex: 0,
    repeatMode: 'off',
    isShuffle: true,
    visitedIndices: [0, 1],
    fromEnded: true,
    randomFn: () => 0
  });
  assert.deepEqual(shuffled, { action: 'move', nextIndex: 2, resetVisited: false });

  // 셔플 모드에서 모든 곡 방문 후 전체 반복이면 히스토리 초기화 후 현재 제외 재선택
  const shuffledWrap = resolveNextTrack({
    playlistLength: 3,
    currentIndex: 2,
    repeatMode: 'all',
    isShuffle: true,
    visitedIndices: [0, 1, 2],
    fromEnded: true,
    randomFn: () => 0
  });
  assert.deepEqual(shuffledWrap, { action: 'move', nextIndex: 0, resetVisited: true });

  // 셔플 이전 곡은 히스토리 스택에서 pop
  assert.deepEqual(
    resolvePreviousTrack({ playlistLength: 3, currentIndex: 2, repeatMode: 'off', isShuffle: true, historyStack: [0, 1] }),
    { action: 'move', prevIndex: 1, popHistory: true }
  );

  // 전체 반복 시 첫 곡에서 이전 버튼 누르면 마지막 곡으로 순환
  assert.deepEqual(
    resolvePreviousTrack({ playlistLength: 3, currentIndex: 0, repeatMode: 'all', isShuffle: false, historyStack: [] }),
    { action: 'move', prevIndex: 2, popHistory: false }
  );
});
