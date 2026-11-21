/**
 * 자막 파일 파싱, 영상-자막 자동 매칭, CC 뱃지 포맷 및 플레이어 자막 스타일·설정 유틸리티
 */

export const SUBTITLE_PREFS_STORAGE_KEY = 'vdtn_subtitle_prefs';

export const SUBTITLE_LANGUAGE_OPTIONS = [
  { code: 'ko', short: 'KO', labelKey: 'subtitles.lang.ko' },
  { code: 'en', short: 'EN', labelKey: 'subtitles.lang.en' },
  { code: 'ja', short: 'JA', labelKey: 'subtitles.lang.ja' },
  { code: 'zh-Hans', short: 'ZH', labelKey: 'subtitles.lang.zhHans' },
  { code: 'zh-Hant', short: 'ZH-TW', labelKey: 'subtitles.lang.zhHant' }
];

export const DEFAULT_PLAYER_SUBTITLE_PREFS = {
  autoShow: true,
  preferredLang: 'auto',
  fontSize: 'md',
  fontFamily: 'default',
  textColor: 'white',
  bgOpacity: 'high',
  position: 'medium'
};

export const SUBTITLE_FONT_SIZE_CSS = {
  sm: '0.95rem',
  md: '1.2rem',
  lg: '1.5rem',
  xl: '1.85rem'
};

export const SUBTITLE_FONT_FAMILY_CSS = {
  default: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  gothic: '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "NanumGothic", sans-serif',
  serif: '"AppleMyungjo", "Batang", "Noto Serif KR", Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
};

export const SUBTITLE_TEXT_COLOR_CSS = {
  white: '#FFFFFF',
  yellow: '#FACC15',
  lime: '#A3E635',
  cyan: '#38BDF8'
};

export const SUBTITLE_BG_OPACITY_CSS = {
  none: 'rgba(0, 0, 0, 0)',
  medium: 'rgba(0, 0, 0, 0.5)',
  high: 'rgba(0, 0, 0, 0.75)',
  solid: 'rgba(0, 0, 0, 1)'
};

export const SUBTITLE_POSITION_BOTTOM_CSS = {
  low: '5%',
  medium: '10%',
  high: '18%'
};

const KNOWN_3_LETTER_LANGS = new Set(['kor', 'eng', 'jpn', 'zho', 'chi', 'spa', 'fra', 'deu', 'und']);
const LANG_TAG_REGEX = /^[a-zA-Z]{2}(?:-[a-zA-Z]{2,4})?(?:-[a-zA-Z0-9]{2,6})?$/;

function isLikelyLangTag(segment) {
  if (!segment) return false;
  if (LANG_TAG_REGEX.test(segment)) return true;
  return KNOWN_3_LETTER_LANGS.has(segment.toLowerCase());
}

export function getSubtitleShortLabel(lang) {
  if (!lang) return 'CC';
  const normalized = String(lang).trim();
  const lower = normalized.toLowerCase();
  if (lower === 'zh-hans' || lower === 'zh-cn' || lower === 'zh-sg') return 'ZH';
  if (lower === 'zh-hant' || lower === 'zh-tw' || lower === 'zh-hk') return 'ZH-TW';
  if (lower.startsWith('ko')) return 'KO';
  if (lower.startsWith('en')) return 'EN';
  if (lower.startsWith('ja')) return 'JA';
  return normalized.toUpperCase();
}

export function parseSubtitleInfo(filename = '') {
  const normalized = String(filename || '').replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  const dir = slashIdx >= 0 ? normalized.slice(0, slashIdx) : '';
  const basename = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;

  const lastDot = basename.lastIndexOf('.');
  const format = lastDot > 0 ? basename.slice(lastDot + 1).toUpperCase() : 'SUB';
  const stemWithoutExt = lastDot > 0 ? basename.slice(0, lastDot) : basename;

  let baseStem = stemWithoutExt;
  let lang = '';

  const langDot = stemWithoutExt.lastIndexOf('.');
  if (langDot > 0) {
    const candidateLang = stemWithoutExt.slice(langDot + 1);
    if (isLikelyLangTag(candidateLang)) {
      lang = candidateLang;
      baseStem = stemWithoutExt.slice(0, langDot);
    }
  }

  return {
    dir,
    basename,
    baseStem,
    lang,
    shortLabel: getSubtitleShortLabel(lang),
    format
  };
}

export function extractMediaDirAndStem(filename = '') {
  const normalized = String(filename || '').replace(/\\/g, '/');
  const slashIdx = normalized.lastIndexOf('/');
  const dir = slashIdx >= 0 ? normalized.slice(0, slashIdx) : '';
  const basename = slashIdx >= 0 ? normalized.slice(slashIdx + 1) : normalized;
  const lastDot = basename.lastIndexOf('.');
  const stem = lastDot > 0 ? basename.slice(0, lastDot) : basename;
  return { dir, stem };
}

/**
 * 라이브러리 파일 목록에서 영상(비디오)과 매칭되는 자막 트랙들을 연결한다.
 * 1순위: 같은 폴더 + 동일한 파일명 stem
 * 2순위: 동일한 original_url (비어있지 않은 경우)
 */
export function attachSubtitlesToFiles(files = []) {
  if (!Array.isArray(files) || files.length === 0) return [];

  const parsedSubtitles = files
    .filter((file) => file && file.file_type === 'subtitle')
    .map((sub) => {
      const meta = parseSubtitleInfo(sub.filename);
      return {
        file: sub,
        meta,
        descriptor: {
          id: sub.id,
          filename: sub.filename,
          lang: meta.lang,
          shortLabel: meta.shortLabel,
          format: meta.format,
          isPublic: Boolean(sub.is_public)
        }
      };
    });

  const byDirStem = new Map();
  const byUrl = new Map();

  for (const item of parsedSubtitles) {
    const key = `${item.meta.dir.toLowerCase()}::${item.meta.baseStem.toLowerCase()}`;
    if (!byDirStem.has(key)) byDirStem.set(key, []);
    byDirStem.get(key).push(item.descriptor);

    const url = (item.file.original_url || '').trim();
    if (url) {
      if (!byUrl.has(url)) byUrl.set(url, []);
      byUrl.get(url).push(item.descriptor);
    }
  }

  return files.map((file) => {
    if (!file) return file;

    if (file.file_type === 'subtitle') {
      return {
        ...file,
        subtitleMeta: parseSubtitleInfo(file.filename)
      };
    }

    if (file.file_type !== 'video') {
      return file;
    }

    const { dir, stem } = extractMediaDirAndStem(file.filename);
    const stemKey = `${dir.toLowerCase()}::${stem.toLowerCase()}`;
    const urlKey = (file.original_url || '').trim();

    const matched = [];
    const seenIds = new Set();

    const addMatches = (list) => {
      if (!Array.isArray(list)) return;
      for (const sub of list) {
        if (sub && !seenIds.has(sub.id)) {
          seenIds.add(sub.id);
          matched.push(sub);
        }
      }
    };

    // 공개 게시판 등 백엔드에서 이미 첨부해 준 자막 목록을 우선 보존한다.
    addMatches(file.subtitles);
    addMatches(byDirStem.get(stemKey));
    if (urlKey) {
      addMatches(byUrl.get(urlKey));
    }

    return {
      ...file,
      subtitles: matched
    };
  });
}

export function formatSubtitleBadgeSummary(subtitles = []) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) return '';

  const langLabels = [];
  for (const sub of subtitles) {
    const label = sub.shortLabel || getSubtitleShortLabel(sub.lang);
    if (label && label !== 'CC' && !langLabels.includes(label)) {
      langLabels.push(label);
    }
  }

  if (langLabels.length === 0) {
    return 'CC';
  }
  if (langLabels.length <= 2) {
    return `CC ${langLabels.join('·')}`;
  }
  return `CC ${langLabels.slice(0, 2).join('·')} +${langLabels.length - 2}`;
}

export function sanitizePlayerSubtitlePrefs(prefs = {}) {
  return {
    autoShow: typeof prefs?.autoShow === 'boolean' ? prefs.autoShow : DEFAULT_PLAYER_SUBTITLE_PREFS.autoShow,
    preferredLang: typeof prefs?.preferredLang === 'string' && prefs.preferredLang
      ? prefs.preferredLang
      : DEFAULT_PLAYER_SUBTITLE_PREFS.preferredLang,
    fontSize: SUBTITLE_FONT_SIZE_CSS[prefs?.fontSize] ? prefs.fontSize : DEFAULT_PLAYER_SUBTITLE_PREFS.fontSize,
    fontFamily: SUBTITLE_FONT_FAMILY_CSS[prefs?.fontFamily] ? prefs.fontFamily : DEFAULT_PLAYER_SUBTITLE_PREFS.fontFamily,
    textColor: SUBTITLE_TEXT_COLOR_CSS[prefs?.textColor] ? prefs.textColor : DEFAULT_PLAYER_SUBTITLE_PREFS.textColor,
    bgOpacity: SUBTITLE_BG_OPACITY_CSS[prefs?.bgOpacity] ? prefs.bgOpacity : DEFAULT_PLAYER_SUBTITLE_PREFS.bgOpacity,
    position: SUBTITLE_POSITION_BOTTOM_CSS[prefs?.position] ? prefs.position : DEFAULT_PLAYER_SUBTITLE_PREFS.position
  };
}

export function getPlayerSubtitlePrefs() {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_PLAYER_SUBTITLE_PREFS };
  }
  try {
    const raw = localStorage.getItem(SUBTITLE_PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PLAYER_SUBTITLE_PREFS };
    return sanitizePlayerSubtitlePrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAYER_SUBTITLE_PREFS };
  }
}

export function savePlayerSubtitlePrefs(prefs) {
  const sanitized = sanitizePlayerSubtitlePrefs(prefs);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SUBTITLE_PREFS_STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

/**
 * 플레이어 자막 오버레이 텍스트 박스 인라인 스타일을 생성한다.
 */
export function buildSubtitleOverlayStyle(prefs = DEFAULT_PLAYER_SUBTITLE_PREFS) {
  const safe = sanitizePlayerSubtitlePrefs(prefs);
  const isTransparentBg = safe.bgOpacity === 'none';
  return {
    fontSize: SUBTITLE_FONT_SIZE_CSS[safe.fontSize],
    fontFamily: SUBTITLE_FONT_FAMILY_CSS[safe.fontFamily],
    color: SUBTITLE_TEXT_COLOR_CSS[safe.textColor],
    backgroundColor: SUBTITLE_BG_OPACITY_CSS[safe.bgOpacity],
    textShadow: isTransparentBg
      ? '0 0 4px #000, 0 0 8px #000, 1px 1px 2px #000, -1px -1px 2px #000'
      : '0 1px 3px rgba(0, 0, 0, 0.9)',
    padding: isTransparentBg ? '0.15em 0.35em' : '0.22em 0.6em'
  };
}

/**
 * WebVTT cue 텍스트의 인라인 마크업 태그 및 HTML 엔티티를 안전하게 정리한다.
 */
export function cleanCueText(rawText = '') {
  return String(rawText || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function matchesPreferredLang(track, targetLang) {
  if (!track || !targetLang) return false;
  const trackLang = (track.lang || '').toLowerCase();
  const target = targetLang.toLowerCase();
  if (!trackLang) return false;
  if (trackLang === target) return true;
  if (trackLang.startsWith(`${target}-`) || target.startsWith(`${trackLang}-`)) return true;
  if (target === 'zh-hans' && (trackLang === 'zh' || trackLang === 'zh-cn')) return true;
  if (target === 'zh-hant' && (trackLang === 'zh-tw' || trackLang === 'zh-hk')) return true;
  return false;
}

export function pickDefaultSubtitleTrack(subtitles = [], prefs = DEFAULT_PLAYER_SUBTITLE_PREFS, uiLanguage = 'ko') {
  if (!prefs?.autoShow || !Array.isArray(subtitles) || subtitles.length === 0) {
    return null;
  }

  const preferred = prefs.preferredLang || 'auto';
  if (preferred !== 'auto') {
    const direct = subtitles.find((track) => matchesPreferredLang(track, preferred));
    if (direct) return direct;
  }

  const uiBase = String(uiLanguage || 'ko').split('-')[0];
  const fallbackOrder = [uiBase, 'ko', 'en'];
  for (const lang of fallbackOrder) {
    const found = subtitles.find((track) => matchesPreferredLang(track, lang));
    if (found) return found;
  }

  return subtitles[0];
}
