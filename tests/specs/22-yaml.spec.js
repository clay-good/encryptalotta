// ===================================================================
// 22 — Format tool YAML path over the vendored js-yaml (draft 305:
// 4.1.1 → 4.3.2). Covers the YAML features the formatter relies on
// (anchors, merge keys, round-trips) and pins the advisory fixes:
// GHSA-2883-xcg3-v3hh / GHSA-h67p-54hq-rp68 let a merge-key alias chain
// burn quadratic CPU. 4.3.2 caps it with maxTotalMergeKeys.
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

async function convert(page, input, from, to) {
  await page.evaluate(v => { document.getElementById('format-output').value = ''; document.getElementById('format-input').value = v; }, input);
  await page.selectOption('#format-from', from);
  await page.selectOption('#format-to', to);
  await page.click('#btn-format-run');
}

// Merge-key alias chain: each level merges the previous anchor `width` times.
function mergeBomb(depth, width) {
  let s = 'a0: &a0 {k: 0}\n';
  for (let i = 1; i <= depth; i++) s += `a${i}: &a${i}\n  <<: [${Array(width).fill('*a' + (i - 1)).join(', ')}]\n  k${i}: ${i}\n`;
  return s;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await gotoTool(page, 'format');
});

test('yaml: anchors and merge keys resolve to JSON', async ({ page }) => {
  await convert(page, 'base: &b\n  x: 1\n  y: 2\nderived:\n  <<: *b\n  y: 3\nlist: [1, two, {three: 3}]\n', 'yaml', 'json');
  await page.waitForFunction(() => document.getElementById('format-output').value.length > 0);
  const out = JSON.parse(await page.inputValue('#format-output'));
  expect(out).toEqual({ base: { x: 1, y: 2 }, derived: { x: 1, y: 3 }, list: [1, 'two', { three: 3 }] });
});

test('yaml: JSON → YAML → JSON round-trips', async ({ page }) => {
  const src = { s: 'héllo: "quoted"', n: -1.5, b: false, z: null, arr: [[], {}, ['x']], nested: { deep: { er: 'yes' } } };
  await convert(page, JSON.stringify(src), 'json', 'yaml');
  await page.waitForFunction(() => document.getElementById('format-output').value.length > 0);
  const yaml = await page.inputValue('#format-output');
  await convert(page, yaml, 'yaml', 'json');
  await page.waitForFunction(() => document.getElementById('format-output').value.length > 0);
  expect(JSON.parse(await page.inputValue('#format-output'))).toEqual(src);
});

test('yaml: a merge-key alias bomb is rejected fast, not ground through (4.3.2 fix)', async ({ page }) => {
  // 2000 levels × 50 aliases: js-yaml 4.1.1 spends seconds (quadratic); 4.3.2 throws
  // "exceeded maxTotalMergeKeys" in milliseconds.
  const r = await page.evaluate(src => {
    const t = performance.now();
    try { jsyaml.load(src); return { threw: false, ms: performance.now() - t }; }
    catch (e) { return { threw: true, msg: String(e.message), ms: performance.now() - t }; }
  }, mergeBomb(2000, 50));
  expect(r.threw).toBe(true);
  expect(r.msg).toMatch(/maxTotalMergeKeys/);
  expect(r.ms).toBeLessThan(500);
});

test('yaml: the formatter reports the rejected bomb as an error and stays usable', async ({ page }) => {
  await convert(page, mergeBomb(2000, 50), 'yaml', 'json');
  await expect(page.locator('#format-status')).toContainText(/maxTotalMergeKeys/, { timeout: 5_000 });
  expect(await page.inputValue('#format-output')).toBe('');
  await convert(page, 'ok: true', 'yaml', 'json');
  await page.waitForFunction(() => document.getElementById('format-output').value.length > 0);
  expect(JSON.parse(await page.inputValue('#format-output'))).toEqual({ ok: true });
});
