#!/usr/bin/env node
// Release-gate audit. Runs the mechanically-checkable security/quality invariants
// and exits non-zero on the first failure. Run before merging to main and as a
// sanity check before regenerating the locale variants.
//
// Checks performed (each prints PASS / FAIL with a one-line reason):
//   1. innerHTML assignments    — must be 0 in index.html.
//   2. STRINGS parity           — every locale has the same key set as en.
//   3. data-i18n keys resolve   — every static data-i18n / data-i18n-attr key
//                                 in index.html exists in STRINGS.en.
//   4. Vendored SHA-384         — openpgp/qrcode/secrets.min.js bytes match the
//                                 hashes recorded in the HTML comments AND in
//                                 the README.md manifest (no drift between sources).
//   5. CSP integrity            — meta-tag CSP and _headers CSP both keep
//                                 connect-src 'none' and exclude obvious
//                                 outbound vectors (no fetch/XHR/sendBeacon).
//   6. Page weight              — gzipped index.html + 3 vendored libs under
//                                 the spec's 2 MB budget.
//   7. Locale variants in sync  — if /<lang>/index.html exists, its STRINGS
//                                 must match the source. Otherwise warn.
//
// What this script does NOT cover (still manual): Lighthouse a11y, browser
// smoke tests, mobile layout, offline test, native-speaker review.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const HEADERS = path.join(ROOT, '_headers');
const README = path.join(ROOT, 'README.md');

const VENDORED = ['openpgp.min.js', 'qrcode.js', 'secrets.min.js', 'js-yaml.min.js'];
const LOCALE_DIRS = { fr: 'fr', 'zh-CN': 'zh', de: 'de', hi: 'hi' };
const PAGE_WEIGHT_BUDGET_BYTES = 2 * 1024 * 1024;

let failed = 0;
let warned = 0;

function pass(name, msg) { console.log(`PASS  ${name}${msg ? ' — ' + msg : ''}`); }
function fail(name, msg) { console.log(`FAIL  ${name} — ${msg}`); failed++; }
function warn(name, msg) { console.log(`WARN  ${name} — ${msg}`); warned++; }

function extractStrings(source) {
    const start = source.indexOf('const STRINGS =');
    if (start < 0) throw new Error('STRINGS not found');
    const after = source.slice(start);
    const objStart = after.indexOf('{');
    let depth = 0, end = -1, inStr = null, esc = false;
    for (let i = objStart; i < after.length; i++) {
        const c = after[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    return new Function('return ' + after.slice(objStart, end))();
}

const html = fs.readFileSync(SRC, 'utf8');

// 1. innerHTML assignments — code only (regex strips line comments to avoid noise from rule-stating comments).
{
    const stripped = html.replace(/\/\/[^\n]*/g, '');
    const matches = stripped.match(/innerHTML\s*=/g) || [];
    if (matches.length === 0) pass('innerHTML', '0 assignments');
    else fail('innerHTML', `${matches.length} assignment(s) detected`);
}

// 2. STRINGS parity
const STRINGS = extractStrings(html);
const enKeys = new Set(Object.keys(STRINGS.en));
// Phase 7 carve-out: per-tool SEO prose (title, metaDescription, about.{what,how,why})
// is intentionally English-only for v1; t() falls back to en when a non-en locale
// doesn't have the key. The audit allows these keys to be present only in en.
const SEO_EN_ONLY_RE = /^tool\.[a-z0-9-]+\.(title|metaDescription|about\.(what|how|why))$/;
const isSeoEnOnly = (k) => SEO_EN_ONLY_RE.test(k);
{
    const langs = Object.keys(STRINGS);
    let ok = true;
    for (const l of langs) {
        const lk = new Set(Object.keys(STRINGS[l]));
        const missing = [...enKeys].filter(k => !lk.has(k) && !isSeoEnOnly(k));
        const extra = [...lk].filter(k => !enKeys.has(k));
        if (missing.length || extra.length) {
            fail('STRINGS parity', `${l}: missing=${missing.length} extra=${extra.length} (e.g. ${(missing[0] || extra[0])})`);
            ok = false;
        }
    }
    if (ok) pass('STRINGS parity', `${langs.length} locales × ${enKeys.size} keys (Phase 7 SEO prose en-only)`);
}

// 3. data-i18n keys resolve in STRINGS.en
{
    // Strip HTML and JS line/block comments so doc-comment examples like
    // `data-i18n-attr="placeholder:keyA,aria-label:keyB"` aren't treated as real bindings.
    const scrubbed = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
    const i18nKeys = new Set();
    for (const m of scrubbed.matchAll(/data-i18n="([^"]+)"/g)) i18nKeys.add(m[1]);
    const i18nAttrPairs = [];
    for (const m of scrubbed.matchAll(/data-i18n-attr="([^"]+)"/g)) i18nAttrPairs.push(m[1]);
    for (const pair of i18nAttrPairs) {
        for (const sub of pair.split(',')) {
            const idx = sub.indexOf(':');
            if (idx > 0) i18nKeys.add(sub.slice(idx + 1).trim());
        }
    }
    const unresolved = [...i18nKeys].filter(k => !enKeys.has(k));
    if (unresolved.length === 0) pass('i18n keys resolve', `${i18nKeys.size} unique keys checked`);
    else fail('i18n keys resolve', `${unresolved.length} unresolved (e.g. ${unresolved.slice(0, 3).join(', ')})`);
}

// 4. Vendored SHA-384 cross-check (HTML comment, README.md manifest, actual file).
{
    const readmeText = fs.readFileSync(README, 'utf8');
    let allOk = true;
    for (const file of VENDORED) {
        const buf = fs.readFileSync(path.join(ROOT, file));
        const actual = crypto.createHash('sha384').update(buf).digest('base64');
        // Hash declared in the HTML comment immediately above the <script src="./<file>">
        const reHtml = new RegExp(`SHA384 hash:\\s*([A-Za-z0-9+/=]{64,})[\\s\\S]{0,200}?src="\\.\\/${file.replace(/\./g, '\\.')}"`);
        const mHtml = html.match(reHtml);
        const reReadme = new RegExp(`\`${file.replace(/\./g, '\\.')}\`[\\s\\S]*?\`([A-Za-z0-9+/=]{64,})\``);
        const mReadme = readmeText.match(reReadme);
        if (!mHtml) { fail(`SHA-384 ${file}`, 'no hash comment found in index.html'); allOk = false; continue; }
        if (!mReadme) { fail(`SHA-384 ${file}`, 'no row in README.md manifest'); allOk = false; continue; }
        if (mHtml[1] !== actual) { fail(`SHA-384 ${file}`, `HTML comment ${mHtml[1].slice(0, 12)}… ≠ actual ${actual.slice(0, 12)}…`); allOk = false; continue; }
        if (mReadme[1] !== actual) { fail(`SHA-384 ${file}`, `README.md ${mReadme[1].slice(0, 12)}… ≠ actual ${actual.slice(0, 12)}…`); allOk = false; continue; }
    }
    if (allOk) pass('SHA-384 vendored', `${VENDORED.length} files match across HTML, README.md manifest, and bytes on disk`);
}

// 5. CSP integrity
{
    const headersTxt = fs.existsSync(HEADERS) ? fs.readFileSync(HEADERS, 'utf8') : '';
    const metaCsp = (html.match(/<meta[^>]*Content-Security-Policy[^>]*content="([^"]+)"/) || [])[1] || '';
    const headerCsp = (headersTxt.match(/Content-Security-Policy:\s*([^\n]+)/) || [])[1] || '';

    const checks = [
        { name: 'meta CSP connect-src none', text: metaCsp, must: /connect-src\s+'none'/ },
        { name: '_headers CSP connect-src none', text: headerCsp, must: /connect-src\s+'none'/ }
    ];
    let cspOk = true;
    for (const c of checks) {
        if (!c.text) { fail(c.name, 'CSP not found'); cspOk = false; continue; }
        if (!c.must.test(c.text)) { fail(c.name, `connect-src 'none' missing in: ${c.text.slice(0, 80)}…`); cspOk = false; }
    }

    // Outbound vectors in JS (line comments stripped so doc-comments don't trip).
    const codeOnly = html.replace(/\/\/[^\n]*/g, '');
    const vectors = [
        { name: 'no fetch()', re: /\bfetch\s*\(/ },
        { name: 'no XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
        { name: 'no WebSocket', re: /\bnew\s+WebSocket\b/ },
        { name: 'no EventSource', re: /\bnew\s+EventSource\b/ },
        { name: 'no sendBeacon', re: /\bsendBeacon\s*\(/ }
    ];
    for (const v of vectors) {
        if (v.re.test(codeOnly)) { fail(v.name, 'detected in index.html'); cspOk = false; }
    }
    if (cspOk) pass('CSP + outbound', "connect-src 'none' on both surfaces; no fetch/XHR/WebSocket/EventSource/sendBeacon");
}

// 6. Page weight (gzipped sum)
{
    let totalGz = 0;
    const parts = [];
    for (const f of ['index.html', ...VENDORED]) {
        const buf = fs.readFileSync(path.join(ROOT, f));
        const gz = zlib.gzipSync(buf, { level: 9 }).length;
        totalGz += gz;
        parts.push(`${f}=${(gz / 1024).toFixed(1)}KB`);
    }
    const mb = totalGz / 1024 / 1024;
    if (totalGz <= PAGE_WEIGHT_BUDGET_BYTES) pass('page weight', `${mb.toFixed(2)} MB gzipped (budget 2 MB) — ${parts.join(', ')}`);
    else fail('page weight', `${mb.toFixed(2)} MB gzipped > 2 MB budget`);
}

// 7. Locale variants in sync (if generated)
{
    let anyExisted = false;
    for (const [lang, dir] of Object.entries(LOCALE_DIRS)) {
        const variantPath = path.join(ROOT, dir, 'index.html');
        if (!fs.existsSync(variantPath)) continue;
        anyExisted = true;
        const variantHtml = fs.readFileSync(variantPath, 'utf8');
        try {
            const variantStrings = extractStrings(variantHtml);
            // Compare just this lang's block against source — both should match exactly,
            // since the build script copies STRINGS verbatim and the importer rewrites in place.
            const a = STRINGS[lang]; const b = variantStrings[lang];
            const aks = Object.keys(a).sort(); const bks = Object.keys(b).sort();
            if (aks.length !== bks.length || aks.some((k, i) => k !== bks[i] || a[k] !== b[k])) {
                fail(`variant /${dir}/`, 'STRINGS drift vs source — re-run scripts/build-i18n-variants.js');
            } else {
                // Report en + variant key counts — variant is smaller by the
                // Phase 7 en-only prose carve-out, so noting both is informative.
                pass(`variant /${dir}/`, `in sync (${aks.length} ${lang} keys; ${enKeys.size} en keys)`);
            }
        } catch (e) {
            fail(`variant /${dir}/`, `STRINGS extraction failed: ${e.message}`);
        }
    }
    if (!anyExisted) warn('locale variants', 'no /<lang>/index.html found — run scripts/build-i18n-variants.js before deploy');
}

// 8. SEO surface: robots.txt, sitemap.xml, JSON-LD WebApplication block.
{
    const robotsPath = path.join(ROOT, 'robots.txt');
    if (!fs.existsSync(robotsPath)) {
        fail('robots.txt', 'missing — create at repo root');
    } else {
        const txt = fs.readFileSync(robotsPath, 'utf8');
        if (!/sitemap:\s*https?:\/\//i.test(txt)) fail('robots.txt', 'no Sitemap: directive');
        else pass('robots.txt', 'present with Sitemap pointer');
    }

    const sitemapPath = path.join(ROOT, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        fail('sitemap.xml', 'missing — run scripts/build-sitemap.js');
    } else {
        const xml = fs.readFileSync(sitemapPath, 'utf8');
        const expectedLocs = ['https://encryptalotta.com/', 'https://encryptalotta.com/fr/',
            'https://encryptalotta.com/zh/', 'https://encryptalotta.com/de/', 'https://encryptalotta.com/hi/'];
        const missingLocs = expectedLocs.filter(loc => !xml.includes(`<loc>${loc}</loc>`));
        if (missingLocs.length) fail('sitemap.xml', `missing <loc> entries: ${missingLocs.join(', ')}`);
        else if (!xml.includes('</urlset>')) fail('sitemap.xml', 'malformed XML — no </urlset>');
        else pass('sitemap.xml', `5 locale roots listed`);
    }

    // JSON-LD inline block in index.html
    const jsonLdMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (!jsonLdMatch) {
        fail('JSON-LD', 'no application/ld+json <script> found in index.html');
    } else {
        try {
            const data = JSON.parse(jsonLdMatch[1]);
            const graph = data['@graph'] || [data];
            const webapp = graph.find(n => n['@type'] === 'WebApplication');
            if (!webapp) fail('JSON-LD', 'no WebApplication node in @graph');
            else if (!Array.isArray(webapp.featureList) || webapp.featureList.length < 15) {
                fail('JSON-LD', `featureList has ${(webapp.featureList || []).length} entries; expected ≥ 15`);
            } else {
                pass('JSON-LD', `WebApplication with ${webapp.featureList.length} features + FAQ`);
            }
        } catch (e) {
            fail('JSON-LD', 'block does not parse as JSON: ' + e.message);
        }
    }
}

// 9. Phase 7: every tool in TOOL_ORDER has the required SEO prose keys in STRINGS.en.
{
    // Extract TOOL_ORDER from the HTML (same Function-wrapping trick as STRINGS).
    const toolStart = html.indexOf('const TOOL_ORDER');
    let order = [];
    if (toolStart >= 0) {
        const after = html.slice(toolStart);
        const lb = after.indexOf('[');
        const rb = after.indexOf('];', lb);
        if (lb >= 0 && rb > lb) {
            try { order = new Function('return ' + after.slice(lb, rb + 1))(); } catch (e) { /* leave empty */ }
        }
    }
    if (!order.length) {
        warn('SEO prose keys', 'TOOL_ORDER not extracted — skipping per-tool prose check');
    } else {
        const required = ['title', 'metaDescription', 'about.what', 'about.how', 'about.why'];
        const missing = [];
        for (const tool of order) {
            for (const suffix of required) {
                const k = `tool.${tool}.${suffix}`;
                if (!enKeys.has(k)) missing.push(k);
            }
        }
        if (missing.length === 0) pass('SEO prose keys', `${order.length} tools × ${required.length} keys present in STRINGS.en`);
        else fail('SEO prose keys', `${missing.length} missing (e.g. ${missing.slice(0, 3).join(', ')})`);
    }
}

console.log('');
if (failed > 0) {
    console.log(`AUDIT FAILED — ${failed} error(s)${warned ? ', ' + warned + ' warning(s)' : ''}.`);
    process.exit(1);
}
console.log(`AUDIT OK${warned ? ` (${warned} warning(s))` : ''}.`);
