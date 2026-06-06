/* eslint-disable */
// ===================================================================
// 11 — Output sanitization / DOM-injection invariants.
//
// Every tool that echoes user-controlled text back into the page is a
// potential stored/reflected XSS sink. Because the whole app runs
// client-side and processes pasted keys, certificates, XML invoices,
// JWTs, and URLs from untrusted third parties, an injection that
// executed script could exfiltrate a private key the user pasted
// moments earlier. This is the highest-severity class for this app.
//
// Method (definitive, not heuristic): the payload, IF rendered as live
// HTML, would either set window.__xss = 1 (via onerror/onload/script)
// or materialize an element carrying a known id. We assert neither
// happens — the payload must survive only as inert text.
//
// CSP note: index.html ships a Content-Security-Policy; these tests
// exercise the DOM-construction path directly (textContent vs innerHTML)
// which CSP does not cover for non-inline DOM injection, so they remain
// meaningful even with CSP enabled.
// ===================================================================

import { test, expect } from '@playwright/test';

async function gotoTool(page, tool) {
  await page.evaluate(t => { location.hash = `#${t}`; }, tool);
  await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), tool);
}

// One combined payload exercising the three common breakout vectors.
const XSS =
  '<img src=x onerror="window.__xss=1" id="xss-img">' +
  '"><svg onload="window.__xss=1" id="xss-svg"></svg>' +
  '<script id="xss-script">window.__xss=1<\/script>';

async function assertInert(page) {
  // No flag set by any inline handler.
  expect(await page.evaluate(() => window.__xss || null), 'an injected handler executed').toBeNull();
  // No live element materialized from the payload.
  const live = await page.evaluate(() =>
    ['xss-img', 'xss-svg', 'xss-script'].filter(id => document.getElementById(id)));
  expect(live, `payload materialized live element(s): ${live.join(', ')}`).toEqual([]);
}

// A crafted, structurally-valid JWT whose claims carry the payload, so the
// decoder actually renders it (alg:none → no signature needed to decode).
function craftJwt() {
  const b64u = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ sub: XSS, name: XSS })}.`;
}

// Each target: how to fill its input(s) + the button that renders output.
const TARGETS = [
  { tool: 'url',     fill: p => p.fill('#url-input', 'https://e.com/' + XSS + '?q=' + XSS), act: '#btn-url-parse' },
  { tool: 'regex',   fill: async p => { await p.fill('#regex-pattern', '.+'); await p.fill('#regex-input', XSS); }, act: '#btn-regex-run' },
  { tool: 'diff',    fill: async p => { await p.fill('#diff-left', XSS); await p.fill('#diff-right', XSS + ' changed'); }, act: '#btn-diff-compute' },
  { tool: 'iban',    fill: p => p.fill('#iban-input', XSS), act: '#btn-iban-validate' },
  { tool: 'bic',     fill: p => p.fill('#bic-input', XSS), act: '#btn-bic-validate' },
  { tool: 'vat',     fill: p => p.fill('#vat-input', XSS), act: '#btn-vat-validate' },
  { tool: 'gs1',     fill: p => p.fill('#gs1-input', XSS), act: '#btn-gs1-validate' },
  { tool: 'cidr',    fill: p => p.fill('#cidr-input', XSS), act: '#btn-cidr-decode' },
  { tool: 'base',    fill: p => p.fill('#base-input', XSS), act: '#btn-base-convert' },
  { tool: 'color',   fill: p => p.fill('#color-input', XSS), act: '#btn-color-convert' },
  { tool: 'cron',    fill: p => p.fill('#cron-input', XSS), act: '#btn-cron-decode' },
  { tool: 'timestamp', fill: p => p.fill('#ts-input', XSS), act: '#btn-ts-convert' },
  { tool: 'ssh-key', fill: p => p.fill('#ssh-key-input', 'ssh-ed25519 ' + XSS + ' ' + XSS), act: '#btn-ssh-key-parse' },
  { tool: 'hash',    fill: p => p.fill('#hash-text', XSS), act: '#btn-hash-compute' },
  { tool: 'hmac',    fill: async p => { await p.fill('#hmac-key', XSS); await p.fill('#hmac-msg', XSS); }, act: '#btn-hmac-sign' },
  { tool: 'jwt',     fill: p => p.fill('#jwt-input', craftJwt()), act: '#btn-jwt-decode' },
  // XML-parsing tools: payload embedded in a well-formed-ish element so it reaches the renderer.
  { tool: 'sepa',    fill: p => p.fill('#sepa-input', `<Document><Nm>${XSS}</Nm></Document>`), act: '#btn-sepa-parse' },
  { tool: 'lotl',    fill: p => p.fill('#lotl-input', `<TrustServiceStatusList><Name>${XSS}</Name></TrustServiceStatusList>`), act: '#btn-lotl-parse' },
  { tool: 'ubl',     fill: p => p.fill('#ubl-input', `<Invoice><ID>${XSS}</ID></Invoice>`), act: '#btn-ubl-parse' },
  { tool: 'tls-cert',fill: p => p.fill('#tls-cert-input', XSS), act: '#btn-tls-cert-parse' },
  { tool: 'key-info',fill: p => p.fill('#key-info-input', XSS), act: '#btn-key-info' },
];

for (const tgt of TARGETS) {
  test(`xss[${tgt.tool}]: echoed input is inert (never executes)`, async ({ page }) => {
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); }); // err alerts are fine; not XSS
    await page.goto('/index.html');
    await gotoTool(page, tgt.tool);
    await tgt.fill(page);
    await page.click(tgt.act, { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(200);
    await assertInert(page);
  });
}

// Defense-in-depth: a Content-Security-Policy should be present in the document head.
test('document ships a Content-Security-Policy', async ({ page }) => {
  await page.goto('/index.html');
  const csp = await page.evaluate(() =>
    document.querySelector('meta[http-equiv="Content-Security-Policy" i]')?.getAttribute('content') || '');
  expect(csp, 'no CSP <meta> found in index.html').not.toBe('');
  expect(csp).toMatch(/default-src|script-src/);
});
