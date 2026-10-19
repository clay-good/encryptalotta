// ===================================================================
// 19 — RTL readiness (SPEC §1.4 steps 2–6) + current-locale palette
// synonyms (SPEC §1.6). Closes the Phase 1 acceptance criteria in §8:
// the site renders intentionally under dir=rtl, and the command palette
// accepts a French synonym and finds the right tool.
// ===================================================================

import { test, expect } from '@playwright/test';

// --- Step 2: runtime <html dir> flip --------------------------------
test('rtl: setLang flips <html dir> for an RTL locale and back', async ({ page }) => {
  await page.goto('/index.html');
  expect(await page.evaluate(() => document.documentElement.dir || 'ltr')).toBe('ltr');
  // No RTL locale ships yet — register one for the duration of the test.
  const dirs = await page.evaluate(() => {
    SUPPORTED_LANGS.push('ar');
    setLang('ar');
    const rtl = document.documentElement.dir;
    setLang('en');
    const ltr = document.documentElement.dir;
    SUPPORTED_LANGS.pop();
    return { rtl, ltr };
  });
  expect(dirs).toEqual({ rtl: 'rtl', ltr: 'ltr' });
});

test('rtl: shipped locales all resolve to ltr', async ({ page }) => {
  await page.goto('/index.html');
  for (const lang of ['fr', 'zh-CN', 'de', 'hi', 'en']) {
    await page.selectOption('#lang-select', lang);
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');
  }
});

test('rtl: shipped variants carry no dir attribute (none is RTL)', async ({ request }) => {
  for (const v of ['fr', 'zh', 'de', 'hi']) {
    const html = await (await request.get(`/${v}/index.html`)).text();
    expect(html).toMatch(/<html lang="[^"]+">/);
  }
});

// --- Step 3: the → indicator mirrors -------------------------------
test('rtl: tool-card arrow mirrors horizontally under dir=rtl', async ({ page }) => {
  await page.goto('/index.html');
  const scaleX = () => page.locator('.tool-card').first().evaluate(el => {
    const m = getComputedStyle(el, '::after').transform; // matrix(a, b, c, d, e, f)
    return parseFloat(m.slice(m.indexOf('(') + 1));
  });
  expect(await scaleX()).toBeGreaterThan(0);
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  // The reduced-motion transition still runs for a frame, so poll.
  await expect.poll(scaleX).toBeLessThan(0);
});

test('rtl: mobile arrow position uses the logical inline-end edge', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/index.html');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const left = await page.locator('.tool-card').first().evaluate(el => getComputedStyle(el, '::after').left);
  // Under RTL the inline-end edge is the left, so the mobile 18px offset must land there; a
  // stray physical `right: 18px` leaves the desktop 22px on the left edge instead.
  expect(left).toBe('18px');
});

// --- Step 4: code / crypto output stays LTR ------------------------
test('rtl: pre / code / output / key-display stay ltr inside an rtl page', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  const dirs = await page.evaluate(() => {
    const probe = tag => {
      const el = document.createElement(tag);
      document.body.appendChild(el);
      const d = getComputedStyle(el).direction;
      el.remove();
      return d;
    };
    const kd = document.querySelector('.key-display');
    return {
      body: getComputedStyle(document.body).direction,
      pre: probe('pre'), code: probe('code'), output: probe('output'),
      keyDisplay: kd ? getComputedStyle(kd).direction : 'ltr'
    };
  });
  expect(dirs).toEqual({ body: 'rtl', pre: 'ltr', code: 'ltr', output: 'ltr', keyDisplay: 'ltr' });
});

// --- Step 5: code-like form fields are dir=ltr ---------------------
test('rtl: code-like form fields declare dir=ltr', async ({ page }) => {
  await page.goto('/index.html');
  const ids = ['regex-pattern', 'regex-flags', 'cron-input', 'jwt-input', 'pem-der-input',
    'tls-cert-input', 'ssh-key-input', 'encrypt-public-key', 'text-decrypt-message',
    'cidr-input', 'pbkdf2-salt', 'hmac-expected', 'color-input', 'format-input', 'bip39-mnemonic'];
  const missing = await page.evaluate(list => list.filter(id => {
    const el = document.getElementById(id);
    return !el || el.getAttribute('dir') !== 'ltr';
  }), ids);
  expect(missing).toEqual([]);
});

// --- Step 6: CJK line-breaking -------------------------------------
test('cjk: Korean keeps words whole; Chinese uses strict line-break', async ({ page }) => {
  await page.goto('/index.html');
  const styles = await page.evaluate(() => {
    const probe = lang => {
      const el = document.createElement('p');
      el.lang = lang;
      document.body.appendChild(el);
      const cs = getComputedStyle(el);
      const r = { wordBreak: cs.wordBreak, lineBreak: cs.lineBreak };
      el.remove();
      return r;
    };
    return { ko: probe('ko'), zh: probe('zh-CN'), en: probe('en') };
  });
  expect(styles.ko.wordBreak).toBe('keep-all');
  expect(styles.zh.lineBreak).toBe('strict');
  expect(styles.zh.wordBreak).not.toBe('keep-all'); // would overflow unspaced Chinese
  expect(styles.en.wordBreak).toBe('normal');
});

test('cjk: the /zh/ variant has no horizontal overflow at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  for (const hash of ['', '#/crypt/encrypt', '#/utilities/ubl']) {
    await page.goto('/zh/index.html' + hash);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, `overflow on /zh/${hash}`).toBeLessThanOrEqual(0);
  }
});

// --- §1.6: current-locale palette synonyms -------------------------
async function paletteFirst(page, lang, query) {
  await page.goto('/index.html');
  await page.selectOption('#lang-select', lang);
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', query);
  const items = page.locator('#palette-results li');
  return { count: await items.count(), first: (await items.count()) ? await items.first().textContent() : '' };
}

test('palette: French "crypter" finds the encrypt tools', async ({ page }) => {
  const r = await paletteFirst(page, 'fr', 'crypter');
  expect(r.count).toBeGreaterThan(0);
  expect(r.first).toMatch(/Chiffrer des fichiers/);
});

test('palette: German "chiffrieren" finds the encrypt tools', async ({ page }) => {
  const r = await paletteFirst(page, 'de', 'chiffrieren');
  expect(r.count).toBeGreaterThan(0);
  expect(r.first).toMatch(/Dateien verschlüsseln/);
});

test('palette: locale synonyms apply only in their own locale', async ({ page }) => {
  expect((await paletteFirst(page, 'en', 'crypter')).count).toBe(0);
  expect((await paletteFirst(page, 'fr', 'chiffrieren')).count).toBe(0);
});

test('palette: English synonyms still work alongside locale synonyms', async ({ page }) => {
  const r = await paletteFirst(page, 'de', 'swift');
  expect(r.first).toMatch(/BIC/);
});
