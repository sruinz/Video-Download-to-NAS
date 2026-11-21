/**
 * 라이브러리 및 공개 게시판 폴더 뷰를 위한 경로 파싱 및 그룹핑 유틸리티
 */

/**
 * 경로 구분자를 슬래시(/)로 통일하고 앞뒤 슬래시를 정리한다.
 */
export function normalizeRelativePath(filename) {
  if (!filename || typeof filename !== 'string') return '';
  return filename.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

/**
 * DB에 저장된 filename(예: "username/2026-11-01/video.mp4")에서
 * 사용자 루트 디렉토리("username/")를 제거한 상대 경로를 반환한다.
 */
export function stripUsernamePrefix(filename, username) {
  const normalized = normalizeRelativePath(filename);
  if (!normalized) return '';
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return normalized;

  if (username && parts[0].toLowerCase() === String(username).toLowerCase()) {
    return parts.slice(1).join('/');
  }
  return normalized;
}

/**
 * 경로에서 순수 파일명만 추출한다.
 */
export function extractDisplayFilename(filename) {
  const normalized = normalizeRelativePath(filename);
  if (!normalized) return '';
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

/**
 * 파일이 속한 실제 폴더 세그먼트 배열을 반환한다.
 * 예: "sruinz/2026-11-01/youtube/clip.mp4" (username="sruinz") -> ["2026-11-01", "youtube"]
 */
export function extractFolderSegments(filename, username) {
  const withoutUser = stripUsernamePrefix(filename, username);
  if (!withoutUser) return [];
  const parts = withoutUser.split('/').filter(Boolean);
  if (parts.length <= 1) return [];
  return parts.slice(0, -1);
}

/**
 * 파일의 폴더 경로 문자열(표시용)을 반환한다. 루트에 있으면 빈 문자열 반환.
 */
export function extractFolderPathString(filename, username) {
  return extractFolderSegments(filename, username).join('/');
}

/**
 * original_url에서 도메인(사이트명)을 추출한다.
 */
export function extractDomainLabel(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string') return '';
  try {
    const parsed = new URL(originalUrl);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch (_error) {
    return '';
  }
}

/**
 * created_at에서 YYYY-MM 형식의 월 문자열을 추출한다.
 */
export function extractMonthLabel(createdAt) {
  if (!createdAt) return '';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 폴더 메타데이터 누적 헬퍼
 */
function upsertFolderEntry(folderMap, key, path, file) {
  if (!folderMap.has(key)) {
    folderMap.set(key, {
      name: key,
      path,
      fileCount: 0,
      totalSize: 0,
      previewFile: null,
      latestCreatedAt: null
    });
  }
  const entry = folderMap.get(key);
  entry.fileCount += 1;
  entry.totalSize += file.file_size || 0;

  if (!entry.previewFile && file.thumbnail) {
    entry.previewFile = file;
  }

  const fileTime = file.created_at ? new Date(file.created_at).getTime() : 0;
  const currentTime = entry.latestCreatedAt ? new Date(entry.latestCreatedAt).getTime() : 0;
  if (fileTime > currentTime) {
    entry.latestCreatedAt = file.created_at;
    if (file.thumbnail && !entry.previewFile) {
      entry.previewFile = file;
    }
  }
}

/**
 * 주어진 파일 목록과 그룹핑 모드, 현재 경로에 따라
 * 현재 위치의 하위 폴더 목록과 파일 목록을 계산한다.
 *
 * @param {Array} files - 필터 및 정렬이 완료된 파일 배열
 * @param {Object} options
 * @param {'actual'|'date'|'site'|'uploader'} options.mode - 폴더 그룹핑 방식
 * @param {string[]} options.currentPath - 현재 탐색 중인 폴더 경로 배열 (루트는 [])
 * @param {string} [options.username] - 현재 사용자명 (실제 폴더 경로에서 루트 접두사 제거용)
 * @param {string} [options.uncategorizedLabel] - 날짜/도메인/작성자 미분류 시 폴더 라벨
 * @returns {{ folders: Array, files: Array, totalSubfoldersAtRoot: number }}
 */
export function buildFolderViewData(
  files,
  {
    mode = 'actual',
    currentPath = [],
    username = '',
    uncategorizedLabel = '기타'
  } = {}
) {
  const safeFiles = Array.isArray(files) ? files : [];
  const safePath = Array.isArray(currentPath) ? currentPath.filter(Boolean) : [];
  const folderMap = new Map();
  const directFiles = [];

  if (mode === 'actual') {
    const rootFolderNames = new Set();

    for (const file of safeFiles) {
      const segments = extractFolderSegments(file.filename, username);
      if (segments.length > 0) {
        rootFolderNames.add(segments[0]);
      }

      // 현재 경로 접두사와 일치하는지 검사
      const matchesPrefix = safePath.every((seg, idx) => segments[idx] === seg);
      if (!matchesPrefix) continue;

      if (segments.length === safePath.length) {
        directFiles.push(file);
      } else {
        const nextFolderName = segments[safePath.length];
        const nextPath = [...safePath, nextFolderName];
        upsertFolderEntry(folderMap, nextFolderName, nextPath, file);
      }
    }

    const folders = Array.from(folderMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

    return {
      folders,
      files: directFiles,
      totalSubfoldersAtRoot: rootFolderNames.size
    };
  }

  // 가상 그룹핑 모드 ('date' | 'site' | 'uploader') — 1단계 폴더 구조
  const getGroupName = (file) => {
    if (mode === 'date') {
      return extractMonthLabel(file.created_at) || uncategorizedLabel;
    }
    if (mode === 'site') {
      return extractDomainLabel(file.original_url) || uncategorizedLabel;
    }
    if (mode === 'uploader') {
      return file.uploader?.username || uncategorizedLabel;
    }
    return uncategorizedLabel;
  };

  if (safePath.length === 0) {
    for (const file of safeFiles) {
      const groupName = getGroupName(file);
      upsertFolderEntry(folderMap, groupName, [groupName], file);
    }

    const folders = Array.from(folderMap.values()).sort((a, b) => {
      if (mode === 'date') {
        if (a.name === uncategorizedLabel) return 1;
        if (b.name === uncategorizedLabel) return -1;
        return b.name.localeCompare(a.name); // 최신 월 우선
      }
      if (a.name === uncategorizedLabel) return 1;
      if (b.name === uncategorizedLabel) return -1;
      return b.fileCount - a.fileCount || a.name.localeCompare(b.name);
    });

    return {
      folders,
      files: [],
      totalSubfoldersAtRoot: folders.length
    };
  }

  const targetGroup = safePath[0];
  for (const file of safeFiles) {
    if (getGroupName(file) === targetGroup) {
      directFiles.push(file);
    }
  }

  return {
    folders: [],
    files: directFiles,
    totalSubfoldersAtRoot: 1
  };
}
