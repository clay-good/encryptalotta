// ===================================================================
// 27 — Document Metadata Cleaner (draft 312, new tool #57). Fixtures in
// tests/fixtures/office/ were built with Python's zipfile — an independent
// ZIP implementation — and every cleaned download is re-verified with
// Python (archive integrity, untouched parts byte-identical, XML parses,
// no dangling relationships) so the page's ZIP writer never grades itself.
// ===================================================================

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FX = path.resolve(HERE, '../fixtures/office');
const OUT = path.resolve(HERE, '../reports');

let hasPython = true;
try { execFileSync('python3', ['-c', 'import zipfile']); } catch (e) { hasPython = false; }

const VERIFY_PY = `
import zipfile, sys, xml.etree.ElementTree as ET
orig, clean = zipfile.ZipFile(sys.argv[1]), zipfile.ZipFile(sys.argv[2])
assert clean.testzip() is None
scrubbed = {'docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml'}
for i in clean.infolist():
    d = clean.read(i.filename)
    assert i.date_time == (1980, 1, 1, 0, 0, 0) and not i.extra, i.filename
    if i.filename not in scrubbed and not i.filename.endswith('.rels'):
        assert d == orig.read(i.filename), 'changed: ' + i.filename
    if i.filename.endswith(('.xml', '.rels')):
        ET.fromstring(d)
for r in ET.fromstring(clean.read('_rels/.rels')):
    assert r.get('Target').lstrip('/') in clean.namelist(), 'dangling: ' + r.get('Target')
print('ok')
`;

async function open(page, lang) {
  await page.goto('/index.html');
  if (lang) await page.selectOption('#lang-select', lang);
  await page.evaluate(() => { location.hash = '#docmeta'; });
  await page.waitForFunction(() => document.getElementById('docmeta-view')?.classList.contains('active'));
}

async function load(page, file) {
  await page.setInputFiles('#docmeta-file', file);
  await expect(page.locator('#docmeta-results')).toBeVisible();
  await expect(page.locator('#docmeta-results .kv-row').first()).toBeVisible();
  const v = page.locator('#docmeta-verdict');
  return { level: (await v.count()) ? await v.getAttribute('data-level') : null, text: (await page.locator('#docmeta-results').textContent()).replace(/\s+/g, ' ') };
}

async function cleanAndSave(page, name) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-docmeta-clean')]);
  const saved = path.join(OUT, 'docmeta-' + dl.suggestedFilename());
  await dl.saveAs(saved);
  await expect(page.locator('#docmeta-done-msg')).toBeVisible();
  return { saved, suggested: dl.suggestedFilename(), done: (await page.locator('#docmeta-done').textContent()).replace(/\s+/g, ' ') };
}

test('docmeta: a leaky .docx lists every identifying field', async ({ page }) => {
  await open(page);
  const r = await load(page, path.join(FX, 'leaky.docx'));
  expect(r.level).toBe('leaky');
  for (const s of ['Jane Smith', 'J. Smith (Acme Legal)', 'Acme Legal LLP', 'R. Partner', '312 minutes', '42',
                   'file:///C:\\Users\\jsmith', 'ClientMatter and Reviewer', 'an embedded image of the first page',
                   '2 tracked changes', '12 internal files carry a date and time']) expect(r.text, s).toContain(s);
  await expect(page.locator('#docmeta-review')).toContainText('not removed by this tool');
  await expect(page.locator('#btn-docmeta-clean')).toBeVisible();
});

test('docmeta: cleaning downloads a valid, scrubbed copy (verified independently)', async ({ page }) => {
  await open(page);
  await load(page, path.join(FX, 'leaky.docx'));
  const c = await cleanAndSave(page);
  expect(c.suggested).toBe('leaky-clean.docx');
  expect(c.done).toContain('author and document properties');
  expect(c.done).toContain('the preview thumbnail');
  expect(c.done).toContain('the template’s folder path');
  expect(c.done).toContain('kept: “Q3 Settlement Draft”');
  if (hasPython) expect(execFileSync('python3', ['-I', '-c', VERIFY_PY, path.join(FX, 'leaky.docx'), c.saved]).toString().trim()).toBe('ok');
  // Re-inspect the cleaned file in the tool itself.
  const again = await load(page, c.saved);
  // Metadata is gone, but comments / tracked changes (content) still name people: "review", not "clean".
  expect(again.level).toBe('review');
  expect(again.text).toContain('still name people');
  expect(again.text).not.toContain('J. Smith (Acme Legal)');
  expect(again.text).not.toContain('Acme Legal LLP');
  expect(again.text).toContain('Acme-Letterhead.dotm');         // template name kept, path dropped
  expect(again.text).not.toContain('C:\\Users');
  expect(again.text).toContain('2 tracked changes');            // content untouched, still reported
  await expect(page.locator('#btn-docmeta-clean')).toBeHidden();
});

test('docmeta: spreadsheets and stored (uncompressed) packages with non-ASCII names', async ({ page }) => {
  await open(page);
  let r = await load(page, path.join(FX, 'budget.xlsx'));
  expect(r.text).toContain('.xlsx');
  expect(r.text).toContain('Fabrikam Inc.');
  let c = await cleanAndSave(page);
  if (hasPython) expect(execFileSync('python3', ['-I', '-c', VERIFY_PY, path.join(FX, 'budget.xlsx'), c.saved]).toString().trim()).toBe('ok');
  r = await load(page, path.join(FX, 'stored.docx'));
  expect(r.text).toContain('Zoë Ångström');
  c = await cleanAndSave(page);
  // No comments or tracked changes in this one, so the cleaned copy is fully clean.
  expect((await load(page, c.saved)).level).toBe('clean');
  await expect(page.locator('#docmeta-verdict')).toContainText('No identifying metadata found');
  if (hasPython) expect(execFileSync('python3', ['-I', '-c', VERIFY_PY + "\nassert 'word/media/résumé.txt' in clean.namelist()\n", path.join(FX, 'stored.docx'), c.saved]).toString().trim()).toBe('ok');
});

test('docmeta: non-Office input is rejected with a clear message', async ({ page }) => {
  await open(page);
  expect((await load(page, path.join(FX, 'plain.zip'))).text).toContain('isn’t an Office document');
  expect((await load(page, { name: 'notes.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('not a zip at all') })).text)
    .toContain('or it is password-protected');
  await expect(page.locator('#btn-docmeta-clean')).toBeHidden();
});

test('docmeta: metadata values are rendered as inert text', async ({ page }) => {
  await open(page);
  const r = await load(page, path.join(FX, 'xss.docx'));
  expect(r.text).toContain('<img src=x onerror="window.__xss=1">');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#docmeta-results img').count()).toBe(0);
});

test('docmeta: French UI and plurals', async ({ page }) => {
  await open(page, 'fr');
  const r = await load(page, path.join(FX, 'leaky.docx'));
  expect(r.text).toContain('Auteur');
  expect(r.text).toContain('2 modifications suivies');
  expect(r.text).toContain('12 fichiers internes portent une date et une heure');
});

test('docmeta: palette finds it by "docx"; no overflow at 320 px', async ({ page }) => {
  await page.goto('/index.html');
  await page.keyboard.press('Control+k');
  await page.fill('#palette-input', 'docx');
  await expect(page.locator('#palette-results li').first()).toContainText('Document Metadata Cleaner');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 800 });
  await open(page);
  await load(page, path.join(FX, 'leaky.docx'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
