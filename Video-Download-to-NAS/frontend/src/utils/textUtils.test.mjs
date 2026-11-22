import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTextWithLinks } from './textUtils.js';

test('parseTextWithLinks splits plain text and clickable URLs while trimming trailing punctuation', () => {
  const input = '설치 가이드: (https://github.com/example/repo), 참고 https://example.com/docs.';
  const tokens = parseTextWithLinks(input);

  assert.deepEqual(tokens, [
    { type: 'text', value: '설치 가이드: (' },
    { type: 'link', value: 'https://github.com/example/repo', href: 'https://github.com/example/repo' },
    { type: 'text', value: '),' },
    { type: 'text', value: ' 참고 ' },
    { type: 'link', value: 'https://example.com/docs', href: 'https://example.com/docs' },
    { type: 'text', value: '.' }
  ]);
});

test('parseTextWithLinks keeps non-http text untouched', () => {
  assert.deepEqual(parseTextWithLinks('docker compose up -d'), [
    { type: 'text', value: 'docker compose up -d' }
  ]);
  assert.deepEqual(parseTextWithLinks(''), []);
});
