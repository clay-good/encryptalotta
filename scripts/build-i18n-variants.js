#!/usr/bin/env node
// Generate pre-rendered static language variants under /fr/, /zh/, /de/, /hi/.
//
// What this does:
//  - Reads the canonical English `index.html` from the repo root.
//  - Extracts the inline `STRINGS` table (no eval — uses the same Function-wrapping
//    trick the audit scripts use).
//  - For each non-en locale, emits `<lang>/index.html` with:
//      * <html lang="..."> set server-side so crawlers and first-paint render correctly
//      * <title> and <meta name="description"> baked in from STRINGS
//      * og:title / og:description / twitter:title / twitter:description localized
//      * <link rel="canonical"> + og:url + twitter:url pointing at the variant URL
//      * Relative `./*.js` script paths rewritten to `../*.js` so vendored libs still
//        resolve when the page is served from a subdirectory
//  - Pre-rendering makes the localized strings visible to crawlers without JS, so
//    Googlebot indexes each /<lang>/ as the correct hreflang target. The runtime
//    i18n engine still re-applies on language switch (no behavior change for users
//    who explicitly pick a language via the dropdown).
//
// Why no build step otherwise: this script is run manually before `git push`. It
// produces only static HTML — no dependencies installed, nothing minified, nothing
// downloaded. Re-run any time STRINGS changes.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');

const VARIANTS = [
    { lang: 'fr',    dir: 'fr', html: 'fr' },
    { lang: 'zh-CN', dir: 'zh', html: 'zh-CN' },
    { lang: 'de',    dir: 'de', html: 'de' },
    { lang: 'hi',    dir: 'hi', html: 'hi' }
];

const SITE = 'https://encryptalotta.com';

function extractStrings(source) {
    const start = source.indexOf('const STRINGS =');
    if (start < 0) throw new Error('STRINGS literal not found in source');
    const after = source.slice(start);
    const objStart = after.indexOf('{');
    let depth = 0, end = -1, inString = null, escape = false;
    for (let i = objStart; i < after.length; i++) {
        const c = after[i];
        if (inString) {
            if (escape) { escape = false; continue; }
            if (c === '\\') { escape = true; continue; }
            if (c === inString) inString = null;
            continue;
        }
        if (c === '"' || c === "'") { inString = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error('Could not find end of STRINGS literal');
    const literal = after.slice(objStart, end);
    return new Function('return ' + literal)();
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function escapeAttr(s) { return escapeHtml(s); }

function buildVariant(srcHtml, strings, variant) {
    const t = (key) => strings[variant.lang][key] || strings.en[key] || key;
    const variantUrl = `${SITE}/${variant.dir}/`;
    let out = srcHtml;

    // <html lang="en">  →  <html lang="<variant>">
    out = out.replace(/<html lang="[^"]*">/, `<html lang="${escapeAttr(variant.html)}">`);

    // <title>...</title> — kept as a constant brand mark across every locale so the
    // browser tab is short and recognizable. Rich locale-specific titles are still
    // emitted into og:title / twitter:title below for social-link previews.
    out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>encryptalotta</title>`);

    // <meta name="description">
    out = out.replace(
        /<meta name="description" content="[^"]*">/,
        `<meta name="description" content="${escapeAttr(t('meta.description'))}">`
    );

    // OG + Twitter (use meta.title / meta.description; matches the runtime applyI18n behavior)
    out = out.replace(
        /<meta property="og:title" content="[^"]*">/,
        `<meta property="og:title" content="${escapeAttr(t('meta.title'))}">`
    );
    out = out.replace(
        /<meta property="og:description" content="[^"]*">/,
        `<meta property="og:description" content="${escapeAttr(t('meta.description'))}">`
    );
    out = out.replace(
        /<meta property="twitter:title" content="[^"]*">/,
        `<meta property="twitter:title" content="${escapeAttr(t('meta.title'))}">`
    );
    out = out.replace(
        /<meta property="twitter:description" content="[^"]*">/,
        `<meta property="twitter:description" content="${escapeAttr(t('meta.description'))}">`
    );

    // Canonical + og:url + twitter:url → variant URL
    out = out.replace(
        /<link rel="canonical" href="[^"]*">/,
        `<link rel="canonical" href="${variantUrl}">`
    );
    out = out.replace(
        /<meta property="og:url" content="[^"]*">/,
        `<meta property="og:url" content="${variantUrl}">`
    );
    out = out.replace(
        /<meta property="twitter:url" content="[^"]*">/,
        `<meta property="twitter:url" content="${variantUrl}">`
    );

    // Vendored script paths: ./*.js → ../*.js (one level up from /<lang>/).
    // qrcode-generator dropped the minified bundle in v2, so it ships as qrcode.js
    // (no .min suffix). The other three vendored libraries still publish .min.js.
    out = out.replace(/src="\.\/(openpgp|secrets|js-yaml)\.min\.js"/g, 'src="../$1.min.js"');
    out = out.replace(/src="\.\/qrcode\.js"/g, 'src="../qrcode.js"');

    // Header logo: relative path needs one ../
    out = out.replace(/src="encryptalotta\.png"/g, 'src="../encryptalotta.png"');

    return out;
}

function main() {
    const srcHtml = fs.readFileSync(SRC, 'utf8');
    const strings = extractStrings(srcHtml);

    // Sanity: every variant locale has the same key set as en, except for
    // Phase 7 per-tool SEO prose (tool.<id>.title / metaDescription / about.{what,how,why})
    // which is intentionally English-only and falls back via t() at runtime.
    const SEO_EN_ONLY_RE = /^tool\.[a-z0-9-]+\.(title|metaDescription|about\.(what|how|why))$/;
    const enKeys = new Set(Object.keys(strings.en));
    for (const v of VARIANTS) {
        if (!strings[v.lang]) throw new Error(`STRINGS.${v.lang} missing`);
        const vk = new Set(Object.keys(strings[v.lang]));
        const missing = [...enKeys].filter(k => !vk.has(k) && !SEO_EN_ONLY_RE.test(k));
        if (missing.length) throw new Error(`STRINGS.${v.lang} missing keys: ${missing.slice(0,5).join(', ')}...`);
    }

    for (const v of VARIANTS) {
        const out = buildVariant(srcHtml, strings, v);
        const outDir = path.join(ROOT, v.dir);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, 'index.html');
        fs.writeFileSync(outPath, out, 'utf8');
        console.log(`wrote ${path.relative(ROOT, outPath)} (${out.length} bytes, lang=${v.html})`);
    }
}

main();
