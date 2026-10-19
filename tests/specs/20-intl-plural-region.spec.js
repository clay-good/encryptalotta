// ===================================================================
// 20 — SPEC §1.5 Intl slice (draft 304): Intl.PluralRules for count
// strings (hash byte counts, PAdES / XAdES signature counts, EXIF tag /
// PNG-chunk counts) and Intl.DisplayNames + Intl.Collator for country
// names (IBAN / BIC / VAT rows, IBAN generator dropdown).
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

async function hashHeading(page, lang, text) {
  await page.goto('/index.html');
  await page.selectOption('#lang-select', lang);
  await gotoTool(page, 'hash');
  await page.fill('#hash-text', text);
  await page.click('#btn-hash-compute');
  const heading = page.locator('#hash-results > div').first();
  await expect(heading).not.toBeEmpty();
  return (await heading.textContent()).trim();
}

// --- PluralRules ---------------------------------------------------
test('plural: hash byte count picks one / other in English', async ({ page }) => {
  expect(await hashHeading(page, 'en', 'a')).toBe('Text input (1 byte)');
  expect(await hashHeading(page, 'en', 'ab')).toBe('Text input (2 bytes)');
});

test('plural: hash byte count in French and German', async ({ page }) => {
  expect(await hashHeading(page, 'fr', 'a')).toBe('Texte (1 octet)');
  expect(await hashHeading(page, 'fr', 'abc')).toBe('Texte (3 octets)');
  expect(await hashHeading(page, 'de', 'a')).toBe('Text (1 Byte)');
  expect(await hashHeading(page, 'de', 'abc')).toBe('Text (3 Bytes)');
});

test('plural: hash byte count is number-formatted for the locale', async ({ page }) => {
  expect(await hashHeading(page, 'en', 'x'.repeat(1234))).toBe('Text input (1,234 bytes)');
  expect(await hashHeading(page, 'de', 'x'.repeat(1234))).toBe('Text (1.234 Bytes)');
});

test('plural: signature summaries select by count', async ({ page }) => {
  await page.goto('/index.html');
  const out = await page.evaluate(() => {
    const r = {};
    for (const lang of ['en', 'fr', 'de']) {
      setLang(lang);
      r[lang] = [intlPlural('xades.summary', 1), intlPlural('xades.summary', 2),
                 intlPlural('pades.summary', 1, { name: 'a.pdf' }), intlPlural('pades.summary', 3, { name: 'a.pdf' })];
    }
    setLang('en');
    return r;
  });
  expect(out.en).toEqual(['XAdES / XML-DSig — 1 signature', 'XAdES / XML-DSig — 2 signatures',
    'PAdES — 1 signature found in a.pdf', 'PAdES — 3 signatures found in a.pdf']);
  expect(out.fr[2]).toBe('PAdES — 1 signature trouvée dans a.pdf');
  expect(out.fr[3]).toBe('PAdES — 3 signatures trouvées dans a.pdf');
  expect(out.de[0]).toBe('XAdES / XML-DSig — 1 Signatur');
  expect(out.de[1]).toBe('XAdES / XML-DSig — 2 Signaturen');
});

test('plural: no "(s)" / "(en)" placeholders remain in the converted groups', async ({ page }) => {
  await page.goto('/index.html');
  const leftovers = await page.evaluate(() => {
    const bad = [];
    const groups = ['pades.summary', 'xades.summary', 'hash.results.text', 'hash.results.file', 'exif.tags.found', 'exif.png.text'];
    for (const lang of Object.keys(STRINGS)) for (const g of groups) for (const f of ['one', 'other']) {
      const v = STRINGS[lang][g + '.' + f];
      if (v === undefined) bad.push(`${lang}:${g}.${f} missing`);
      else if (/\((s|en)\)/.test(v)) bad.push(`${lang}:${g}.${f}`);
    }
    return bad;
  });
  expect(leftovers).toEqual([]);
});

test('plural: EXIF summary re-selects its plural form on language switch', async ({ page }) => {
  // French treats 0 as singular ("0 balise"), English as plural ("0 EXIF tags"), so a
  // form picked once at render time would go wrong on switch. applyI18n must re-select.
  await page.goto('/index.html');
  const out = await page.evaluate(() => {
    const span = document.createElement('span');
    span.dataset.i18n = 'exif.tags.found';
    span.dataset.i18nVars = JSON.stringify({ gps: '@:exif.gps.no' });
    span.dataset.i18nPlural = '0';
    document.body.appendChild(span);
    const seen = [];
    for (const lang of ['en', 'fr', 'de']) { setLang(lang); seen.push(span.textContent); }
    span.dataset.i18nPlural = '1';
    setLang('en'); seen.push(span.textContent);
    span.remove();
    return seen;
  });
  expect(out[0]).toMatch(/^0 EXIF tags · GPS: /);
  expect(out[1]).toMatch(/^0 balise EXIF · GPS : /);
  expect(out[2]).toMatch(/^0 EXIF-Tags · GPS: /);
  expect(out[3]).toMatch(/^1 EXIF tag · GPS: /);
});

// --- DisplayNames + Collator ---------------------------------------
test('region: IBAN country row is localized in French and German', async ({ page }) => {
  for (const [lang, name] of [['fr', 'Allemagne'], ['de', 'Deutschland'], ['en', 'Germany']]) {
    await page.goto('/index.html');
    await page.selectOption('#lang-select', lang);
    await gotoTool(page, 'iban');
    await page.fill('#iban-input', 'DE89 3704 0044 0532 0130 00');
    await page.click('#btn-iban-validate');
    await expect(page.locator('#iban-results')).toContainText(`DE — ${name}`, { timeout: 5_000 });
  }
});

test('region: BIC and VAT country rows are localized', async ({ page }) => {
  await page.goto('/index.html');
  await page.selectOption('#lang-select', 'fr');
  await gotoTool(page, 'bic');
  await page.fill('#bic-input', 'DEUTDEFFXXX');
  await page.click('#btn-bic-validate');
  await expect(page.locator('#bic-results')).toContainText('DE — Allemagne', { timeout: 5_000 });
  await gotoTool(page, 'vat');
  await page.fill('#vat-input', 'FR40303265045');
  await page.click('#btn-vat-validate');
  await expect(page.locator('#vat-results')).toContainText('FR — France', { timeout: 5_000 });
});

test('region: VAT "EL" maps to Greece; unknown codes fall back to the table name', async ({ page }) => {
  await page.goto('/index.html');
  const r = await page.evaluate(() => {
    setLang('fr');
    const out = { el: intlRegion('EL', 'Greece'), unknown: intlRegion('XI', 'Northern Ireland') };
    setLang('en');
    out.enKeepsTable = intlRegion('CZ', 'Czech Republic');
    return out;
  });
  expect(r.el).toBe('Grèce');
  expect(r.unknown).toBe('Northern Ireland');
  expect(r.enKeepsTable).toBe('Czech Republic');
});

test('region: IBAN generator dropdown is localized, collated, and keeps the selection', async ({ page }) => {
  await page.goto('/index.html');
  await gotoTool(page, 'iban');
  await page.selectOption('#iban-gen-country', 'FR');
  await page.selectOption('#lang-select', 'de');
  const r = await page.evaluate(() => {
    const sel = document.getElementById('iban-gen-country');
    const names = Array.from(sel.options).map(o => o.textContent.replace(/^[A-Z]{2} — /, ''));
    const coll = new Intl.Collator('de');
    const sorted = names.every((n, i) => i === 0 || coll.compare(names[i - 1], n) <= 0);
    return { value: sel.value, de: sel.querySelector('option[value="DE"]').textContent, count: names.length, sorted };
  });
  expect(r.value).toBe('FR');
  expect(r.de).toBe('DE — Deutschland');
  expect(r.sorted).toBe(true);
  expect(r.count).toBeGreaterThan(70);
});
