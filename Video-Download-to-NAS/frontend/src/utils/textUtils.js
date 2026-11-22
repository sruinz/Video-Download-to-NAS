/**
 * 메모/설명 텍스트에서 HTTP/HTTPS URL을 안전하게 분리하는 순수 유틸리티 (XSS 방지)
 */

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/g;
const TRAILING_PUNCT_REGEX = /[),.;:!?\]}>]+$/;

export function parseTextWithLinks(text = '') {
  if (!text) return [];

  const tokens = [];
  let lastIndex = 0;
  let match;
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    const rawUrl = match[0];
    const punctMatch = rawUrl.match(TRAILING_PUNCT_REGEX);
    const trailing = punctMatch ? punctMatch[0] : '';
    const cleanUrl = trailing ? rawUrl.slice(0, rawUrl.length - trailing.length) : rawUrl;

    if (cleanUrl) {
      tokens.push({ type: 'link', value: cleanUrl, href: cleanUrl });
    }
    if (trailing) {
      tokens.push({ type: 'text', value: trailing });
    }

    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}
