/* eslint-disable */
// ===================================================================
// 16 — Localized OpenGraph / Twitter card metadata (spec §5.4)
//
// build-i18n-variants.js pre-renders /fr/, /zh/, /de/, /hi/ with
// localized social-share metadata. Most checks here are static-file
// assertions: each variant must advertise its OWN og:locale and list
// every OTHER locale (including en) as og:locale:alternate — otherwise a
// shared /fr/ link previews as en_US on Facebook / LinkedIn / Slack.
// Also locks in the localized og/twitter title+description, the
// per-variant canonical/og:url, and <html lang>. A final browser-based
// block guards against long-compound-word heading overflow in the
// verbose German variant at 320px (the h2/h3/h4 overflow-wrap rule).
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// lang code → { dir, ogLocale, htmlLang }
const LOCALES = {
  en:      { file: 'index.html',    ogLocale: 'en_US', htmlLang: 'en',    url: 'https://encryptalotta.com/' },
  fr:      { file: 'fr/index.html', ogLocale: 'fr_FR', htmlLang: 'fr',    url: 'https://encryptalotta.com/fr/' },
  'zh-CN': { file: 'zh/index.html', ogLocale: 'zh_CN', htmlLang: 'zh-CN', url: 'https://encryptalotta.com/zh/' },
  de:      { file: 'de/index.html', ogLocale: 'de_DE', htmlLang: 'de',    url: 'https://encryptalotta.com/de/' },
  hi:      { file: 'hi/index.html', ogLocale: 'hi_IN', htmlLang: 'hi',    url: 'https://encryptalotta.com/hi/' },
};
const ALL_OG = ['en_US', 'fr_FR', 'zh_CN', 'de_DE', 'hi_IN'];

const ogContent = (html, prop) => {
  const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)">`));
  return m ? m[1] : null;
};
const ogAll = (html, prop) => {
  const re = new RegExp(`<meta property="${prop}" content="([^"]*)">`, 'g');
  return [...html.matchAll(re)].map(m => m[1]);
};

for (const [lang, meta] of Object.entries(LOCALES)) {
  test(`SEO §5.4 [${lang}]: og:locale is self and alternates are the other four`, () => {
    const html = read(meta.file);

    // Primary og:locale is this variant's own locale.
    expect(ogContent(html, 'og:locale'), `${lang} og:locale`).toBe(meta.ogLocale);

    // Alternates are exactly every OTHER supported locale — no self, no missing.
    const alts = ogAll(html, 'og:locale:alternate').sort();
    const expected = ALL_OG.filter(l => l !== meta.ogLocale).sort();
    expect(alts, `${lang} og:locale:alternate set`).toEqual(expected);
    expect(alts, `${lang} must not list itself as an alternate`).not.toContain(meta.ogLocale);
  });

  test(`SEO §5.4 [${lang}]: html lang, canonical, og:url, twitter:url localized`, () => {
    const html = read(meta.file);
    expect(html).toMatch(new RegExp(`<html lang="${meta.htmlLang}">`));
    expect(html.match(/<link rel="canonical" href="([^"]*)">/)[1]).toBe(meta.url);
    expect(ogContent(html, 'og:url')).toBe(meta.url);
    expect(ogContent(html, 'twitter:url')).toBe(meta.url);
  });
}

test('SEO §5.4: non-en variants have a localized (non-English) og:title', () => {
  const en = ogContent(read('index.html'), 'og:title');
  for (const lang of ['fr', 'zh-CN', 'de', 'hi']) {
    const title = ogContent(read(LOCALES[lang].file), 'og:title');
    expect(title, `${lang} og:title present`).toBeTruthy();
    expect(title, `${lang} og:title should differ from en`).not.toBe(en);
    // og:title and twitter:title use the same localized meta.title.
    expect(ogContent(read(LOCALES[lang].file), 'twitter:title')).toBe(title);
  }
});

// Regression guard: long compound words in localized headings (e.g. German
// "Dateiverschlüsselung", "Rechnungsinspektor") must wrap, not overflow the
// viewport. The h2/h3/h4 `overflow-wrap: break-word` rule enforces this. Checked
// against the verbose German variant on the views that previously overflowed at 320px.
for (const route of ['#/crypt/age', '#/utilities/ubl', '#/']) {
  test(`responsive: German variant has no horizontal overflow at 320px (${route})`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/de/index.html${route}`, { waitUntil: 'load' });
    await page.waitForTimeout(120);
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(scrollW, `de ${route} should not scroll horizontally`).toBeLessThanOrEqual(clientW);
  });
}
