import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const TOOLS = [
  'generate','key-info','revoke','qr','tls-cert','ssh-key','pem-der','asn1','csr','jwk','bip39',
  'encrypt','decrypt','text-crypto','password-encrypt','stego','age',
  'sign','verify','hmac','jwt',
  'passwords','strength','armor','shamir','exif',
  'hash','encode','uuid','timestamp','url','totp','diff','csv','regex','cron','color','format','cidr','pbkdf2','argon2','base','filetype',
  'iban','bic','gs1','vat','sepa','lotl','ed25519','x25519'
];

test('introspect all tool views', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });

  await page.goto('/index.html');
  await page.waitForLoadState('networkidle');

  const map = {};
  for (const tool of TOOLS) {
    await page.evaluate(t => { location.hash = `#${t}`; }, tool);
    await page.waitForTimeout(120);
    const view = page.locator(`#${tool}-view`);
    const isVisible = await view.isVisible().catch(() => false);
    if (!isVisible) {
      map[tool] = { error: 'view not visible' };
      continue;
    }
    const info = await view.evaluate(el => {
      const summarize = sel => Array.from(el.querySelectorAll(sel)).map(n => ({
        id: n.id || null,
        type: n.type || n.tagName.toLowerCase(),
        name: n.name || null,
        text: (n.textContent || '').trim().slice(0, 60),
        placeholder: n.placeholder || null,
      }));
      return {
        forms: Array.from(el.querySelectorAll('form')).map(f => f.id || '(no id)'),
        inputs: summarize('input,textarea,select'),
        buttons: summarize('button'),
        outputs: summarize('[id$="-output"], [id$="-result"], pre, code.output, .result'),
      };
    });
    map[tool] = info;
  }

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(path.join('reports', 'tool-map.json'), JSON.stringify(map, null, 2));
  fs.writeFileSync(path.join('reports', 'introspect-errors.json'), JSON.stringify(errors, null, 2));

  // Sanity: every tool view exists
  for (const t of TOOLS) {
    expect(map[t], `tool ${t} should be reachable`).not.toHaveProperty('error');
  }
});
