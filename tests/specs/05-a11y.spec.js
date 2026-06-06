/* eslint-disable */
// Accessibility audit driven by axe-core via @axe-core/playwright.
// Runs WCAG 2.1 A + AA + best-practice rules against home + every tool view, then writes
// a single consolidated report so the punch list is one diff away.
//
// Standard: W3C WCAG 2.1 (https://www.w3.org/TR/WCAG21/)
// Engine:   axe-core (Deque). Rules tagged wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice.

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const TOOLS = [
  'home',
  'generate','key-info','revoke','qr','tls-cert','ssh-key','pem-der','bip39',
  'encrypt','decrypt','text-crypto','password-encrypt','stego','age',
  'sign','verify','hmac','jwt',
  'passwords','armor','shamir','exif',
  'hash','encode','uuid','timestamp','url','totp','diff','csv','regex','cron','color','format','cidr','pbkdf2','argon2','base',
  'iban','bic','gs1','vat','ed25519','x25519'
];

async function gotoView(page, view) {
  if (view === 'home') {
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForFunction(() => document.getElementById('home-view')?.classList.contains('active'));
  } else {
    await page.evaluate(t => { location.hash = `#${t}`; }, view);
    await page.waitForFunction(t => document.getElementById(t + '-view')?.classList.contains('active'), view);
  }
}

const REPORT_PATH = path.resolve('reports/a11y-report.json');
const SUMMARY_PATH = path.resolve('reports/a11y-summary.md');
const allFindings = {};
const THEMES = ['light', 'dark'];

test.beforeAll(() => {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(allFindings, null, 2));

  // Collate by rule across views for a clean punch-list.
  const byRule = {};
  for (const [view, vios] of Object.entries(allFindings)) {
    for (const v of vios) {
      const e = byRule[v.id] ||= { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, views: new Set(), nodes: 0 };
      e.views.add(view);
      e.nodes += v.nodes.length;
    }
  }
  const rows = Object.values(byRule).sort((a, b) => {
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return (order[a.impact] ?? 9) - (order[b.impact] ?? 9) || b.nodes - a.nodes;
  });

  const lines = [
    `# A11y audit (axe-core)`,
    ``,
    `Run: ${new Date().toISOString()}`,
    `Total rules with violations: **${rows.length}**`,
    `Total violation node-instances across all views: **${rows.reduce((s, r) => s + r.nodes, 0)}**`,
    ``,
    `| Rule | Impact | Total nodes | Views affected |`,
    `|---|---|---:|---|`,
    ...rows.map(r => `| [${r.id}](${r.helpUrl}) — ${r.help} | ${r.impact || '—'} | ${r.nodes} | ${r.views.size} |`),
  ];
  fs.writeFileSync(SUMMARY_PATH, lines.join('\n'));
  // eslint-disable-next-line no-console
  console.log(`\n[a11y] wrote ${REPORT_PATH}\n[a11y] wrote ${SUMMARY_PATH}`);
});

for (const theme of THEMES) for (const view of TOOLS) {
  test(`a11y[${theme}]: ${view}`, async ({ page }) => {
    // Emulate reduced motion explicitly so decorative fadeIn animations don't leave axe
    // measuring partial-opacity colors. Site honours this via @media (prefers-reduced-motion).
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
    await page.goto('/index.html');
    // Force the site into the requested theme regardless of system pref so light & dark
    // both get audited deterministically. The site's pre-paint script reads localStorage,
    // so we set it before navigating-content settles by toggling and reloading.
    await page.evaluate(t => {
      localStorage.setItem('theme', t);
      if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else document.documentElement.removeAttribute('data-theme');
    }, theme);
    await gotoView(page, view);
    await page.waitForTimeout(1000);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .include('header')
      .include('main')
      .include('footer')
      .analyze();

    allFindings[`${theme}:${view}`] = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map(n => ({
        target: n.target,
        html: n.html.slice(0, 200),
        failureSummary: (n.failureSummary || '').slice(0, 300),
      })),
    }));

    // We deliberately do NOT fail the test on violations — first run is a snapshot.
    // The afterAll() hook collates everything into reports/a11y-summary.md so the
    // user can see the full picture before deciding what to fix.
    expect(results.violations).toBeDefined();
  });
}
