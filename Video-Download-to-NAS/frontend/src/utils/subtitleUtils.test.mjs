import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseSubtitleInfo,
  attachSubtitlesToFiles,
  formatSubtitleBadgeSummary,
  pickDefaultSubtitleTrack,
  sanitizePlayerSubtitlePrefs,
  buildSubtitleOverlayStyle,
  cleanCueText
} from './subtitleUtils.js';

test('parseSubtitleInfo extracts folder, base stem, language, and format accurately', () => {
  const ko = parseSubtitleInfo('sruinz/2026-11/주머니쥐의 습성.ko.srt');
  assert.equal(ko.dir, 'sruinz/2026-11');
  assert.equal(ko.baseStem, '주머니쥐의 습성');
  assert.equal(ko.lang, 'ko');
  assert.equal(ko.shortLabel, 'KO');
  assert.equal(ko.format, 'SRT');

  const zh = parseSubtitleInfo('sruinz/demo.zh-Hans.vtt');
  assert.equal(zh.baseStem, 'demo');
  assert.equal(zh.lang, 'zh-Hans');
  assert.equal(zh.shortLabel, 'ZH');
  assert.equal(zh.format, 'VTT');

  const noLang = parseSubtitleInfo('sruinz/plain_caption.srt');
  assert.equal(noLang.baseStem, 'plain_caption');
  assert.equal(noLang.lang, '');
  assert.equal(noLang.shortLabel, 'CC');
});

test('attachSubtitlesToFiles matches subtitles by folder+stem and original_url', () => {
  const files = [
    { id: 1, filename: 'sruinz/주머니쥐의 습성.mp4', file_type: 'video', original_url: 'https://yt/1' },
    { id: 2, filename: 'sruinz/주머니쥐의 습성.ko.srt', file_type: 'subtitle', original_url: 'https://yt/1' },
    { id: 3, filename: 'sruinz/renamed_sub.en.vtt', file_type: 'subtitle', original_url: 'https://yt/1' },
    { id: 4, filename: 'sruinz/other.mp4', file_type: 'video', original_url: 'https://yt/2' }
  ];

  const enriched = attachSubtitlesToFiles(files);
  const video1 = enriched.find((f) => f.id === 1);
  const video2 = enriched.find((f) => f.id === 4);

  assert.equal(video1.subtitles.length, 2);
  assert.deepEqual(video1.subtitles.map((s) => s.shortLabel), ['KO', 'EN']);
  assert.equal(formatSubtitleBadgeSummary(video1.subtitles), 'CC KO·EN');
  assert.equal(video2.subtitles.length, 0);
});

test('pickDefaultSubtitleTrack respects autoShow and preferredLang settings', () => {
  const tracks = [
    { id: 10, lang: 'en', shortLabel: 'EN' },
    { id: 11, lang: 'ko', shortLabel: 'KO' },
    { id: 12, lang: 'ja', shortLabel: 'JA' }
  ];

  assert.equal(
    pickDefaultSubtitleTrack(tracks, { autoShow: false, preferredLang: 'ko', fontSize: 'md' }),
    null
  );
  assert.equal(
    pickDefaultSubtitleTrack(tracks, { autoShow: true, preferredLang: 'ja', fontSize: 'md' }).id,
    12
  );
  assert.equal(
    pickDefaultSubtitleTrack(tracks, { autoShow: true, preferredLang: 'auto', fontSize: 'md' }, 'ko').id,
    11
  );
});

test('sanitizePlayerSubtitlePrefs and buildSubtitleOverlayStyle handle all style options safely', () => {
  const prefs = sanitizePlayerSubtitlePrefs({
    autoShow: true,
    preferredLang: 'ko',
    fontSize: 'lg',
    fontFamily: 'serif',
    textColor: 'yellow',
    bgOpacity: 'none',
    position: 'high'
  });
  assert.equal(prefs.fontFamily, 'serif');
  assert.equal(prefs.textColor, 'yellow');
  assert.equal(prefs.bgOpacity, 'none');
  assert.equal(prefs.position, 'high');

  const style = buildSubtitleOverlayStyle(prefs);
  assert.equal(style.color, '#FACC15');
  assert.equal(style.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.match(style.fontFamily, /serif/);
  assert.match(style.textShadow, /#000/);

  const fallback = sanitizePlayerSubtitlePrefs({
    fontSize: 'invalid',
    fontFamily: 'invalid',
    textColor: 'invalid',
    bgOpacity: 'invalid',
    position: 'invalid'
  });
  assert.equal(fallback.fontSize, 'md');
  assert.equal(fallback.fontFamily, 'default');
  assert.equal(fallback.textColor, 'white');
  assert.equal(fallback.bgOpacity, 'high');
  assert.equal(fallback.position, 'medium');
});

test('cleanCueText strips VTT tags and decodes HTML entities cleanly', () => {
  assert.equal(
    cleanCueText('<c.colorE5E5E5>안녕 &amp; <i>반가워요</i></c>\n두 번째 줄'),
    '안녕 & 반가워요\n두 번째 줄'
  );
});

test('attachSubtitlesToFiles preserves server-attached subtitles for Public Board videos', () => {
  const publicFiles = [
    {
      id: 99,
      filename: 'sruinz/public_clip.mp4',
      file_type: 'video',
      original_url: 'https://yt/public',
      subtitles: [
        { id: 100, filename: 'sruinz/public_clip.ko.srt', lang: 'ko', shortLabel: 'KO', format: 'SRT' }
      ]
    }
  ];

  const enriched = attachSubtitlesToFiles(publicFiles);
  assert.equal(enriched[0].subtitles.length, 1);
  assert.equal(enriched[0].subtitles[0].id, 100);
  assert.equal(formatSubtitleBadgeSummary(enriched[0].subtitles), 'CC KO');
});
