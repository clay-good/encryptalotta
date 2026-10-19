// ===================================================================
// 24 — Link Cleaner (draft 309, new tool #54). Offline tracking-parameter
// remover + redirect unwrapper. Vectors pin: exact removal (kept bytes
// untouched), host-scoped params, nested unwrapping, refusal to unwrap a
// non-http(s) target, sentence punctuation vs. Wikipedia-style parens.
// ===================================================================

import { test, expect } from '@playwright/test';

async function open(page, lang) {
  await page.goto('/index.html');
  if (lang) await page.selectOption('#lang-select', lang);
  await page.evaluate(() => { location.hash = '#linkclean'; });
  await page.waitForFunction(() => document.getElementById('linkclean-view')?.classList.contains('active'));
}

async function clean(page, text) {
  await page.fill('#linkclean-input', text);
  await page.click('#btn-linkclean-run');
  await expect(page.locator('#linkclean-output-wrap')).toBeVisible();
  return page.inputValue('#linkclean-output');
}

const VECTORS = [
  ['https://example.com/a?utm_source=x&id=7&utm_medium=y#top', 'https://example.com/a?id=7#top'],
  ['https://example.com/s?q=a%20b+c&gclid=Z&lang=fr', 'https://example.com/s?q=a%20b+c&lang=fr'],
  ['https://www.google.com/url?sa=t&url=https%3A%2F%2Fnews.example%2Fstory%3Futm_campaign%3Dz%26p%3D2&usg=AOv', 'https://news.example/story?p=2'],
  ['https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.org%2F%3Ffbclid%3Dabc&h=AT0', 'https://example.org/'],
  ['https://eur01.safelinks.protection.outlook.com/?url=https%3A%2F%2Fexample.com%2Fdoc&data=05%7C01&reserved=0', 'https://example.com/doc'],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=AbC123&t=42', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42'],
  ['https://example.com/?si=keep', 'https://example.com/?si=keep'],
  ['https://www.amazon.de/dp/B08N5WRWNW/ref=sr_1_1?crid=2X&keywords=kindle&qid=169&sr=8-1', 'https://www.amazon.de/dp/B08N5WRWNW?keywords=kindle'],
  ['https://www.google.com/url?q=javascript:alert(1)', 'https://www.google.com/url?q=javascript:alert(1)'],
  ['https://example.com/p?UTM_Source=caps&a=1', 'https://example.com/p?a=1'],
];

test('linkclean: published-pattern vectors clean exactly (kept bytes untouched)', async ({ page }) => {
  await open(page);
  for (const [input, want] of VECTORS) expect(await clean(page, input), input).toBe(want);
});

test('linkclean: cleans links inside free text and leaves the prose alone', async ({ page }) => {
  await open(page);
  const out = await clean(page, 'See https://a.example/x?utm_source=n. Also (https://en.wikipedia.org/wiki/Foo_(bar)?fbclid=1), done!');
  expect(out).toBe('See https://a.example/x. Also (https://en.wikipedia.org/wiki/Foo_(bar)), done!');
  const res = page.locator('#linkclean-results');
  await expect(res).toContainText('Links found');
  await expect(res).toContainText('removed: utm_source');
  await expect(res).toContainText('removed: fbclid');
});

test('linkclean: nested redirects unwrap and are reported', async ({ page }) => {
  await open(page);
  const nested = 'https://www.google.com/url?url=https%3A%2F%2Fl.facebook.com%2Fl.php%3Fu%3Dhttps%253A%252F%252Fdeep.example%252F%253Fgclid%253D1';
  expect(await clean(page, nested)).toBe('https://deep.example/');
  await expect(page.locator('#linkclean-results')).toContainText('unwrapped from www.google.com and l.facebook.com');
});

test('linkclean: unwrap toggle off keeps the wrapper but still strips its tracking', async ({ page }) => {
  await open(page);
  await page.uncheck('#linkclean-unwrap');
  expect(await clean(page, 'https://www.google.com/url?url=https%3A%2F%2Fexample.com&utm_source=x'))
    .toBe('https://www.google.com/url?url=https%3A%2F%2Fexample.com');
});

test('linkclean: an already-clean link is reported as clean', async ({ page }) => {
  await open(page);
  expect(await clean(page, 'https://example.com/plain')).toBe('https://example.com/plain');
  await expect(page.locator('#linkclean-results')).toContainText('already clean');
});

test('linkclean: empty input and text without links show errors, no output', async ({ page }) => {
  await open(page);
  await page.click('#btn-linkclean-run');
  await expect(page.locator('#linkclean-results')).toContainText('Paste at least one link');
  await expect(page.locator('#linkclean-output-wrap')).toBeHidden();
  await page.fill('#linkclean-input', 'no links here, just www.example.com and mailto:a@b.c');
  await page.click('#btn-linkclean-run');
  await expect(page.locator('#linkclean-results')).toContainText('No http(s) links found');
  await expect(page.locator('#linkclean-output-wrap')).toBeHidden();
});

test('linkclean: French UI labels and localized report', async ({ page }) => {
  await open(page, 'fr');
  await expect(page.locator('#linkclean-h2')).toHaveText(/Nettoyeur de liens/);
  await clean(page, 'https://example.com/?utm_source=x');
  await expect(page.locator('#linkclean-results')).toContainText('Liens trouvés');
  await expect(page.locator('#linkclean-results')).toContainText('retiré : utm_source');
});

test('linkclean: palette finds the tool by "utm" and "fbclid"', async ({ page }) => {
  await page.goto('/index.html');
  for (const q of ['utm', 'fbclid']) {
    await page.keyboard.press('Control+k');
    await page.fill('#palette-input', q);
    await expect(page.locator('#palette-results li').first()).toContainText('Link Cleaner');
    await page.keyboard.press('Escape');
  }
});

test('linkclean: no horizontal overflow at 320 px with a very long link', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  await clean(page, 'https://example.com/' + 'a'.repeat(400) + '?utm_source=' + 'b'.repeat(200) + '&keep=' + 'c'.repeat(200));
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
