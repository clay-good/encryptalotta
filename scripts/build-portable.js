#!/usr/bin/env node
// Build a single-file portable version of encryptalotta as `encryptalotta-portable.html`.
//
// Why this exists (SPEC-INTERNATIONAL.md §4.6):
//   - Journalists in transit, activists on hostile networks, anyone who wants the toolbox
//     on a USB stick or sent over an air-gap.
//   - The shipped site is already static, but loads four vendored .js files via relative
//     <script src> tags. A single HTML file with everything inlined works from `file://`,
//     from a USB drive, from a chat attachment, from a printed-and-scanned QR code chain
//     (in extremis), from anywhere.
//
// What this does:
//   1. Reads the canonical English `index.html` from the repo root.
//   2. Inlines each vendored script (openpgp.min.js, qrcode.js, secrets.min.js,
//      js-yaml.min.js) into a <script>…</script> block at the same position. Any
//      literal `</script>` inside the inlined content is escaped to `<\/script>`
//      so it can't terminate the wrapping tag.
//   3. Inlines the favicons (apple-touch-icon, favicon-16, favicon-32) as base64
//      data: URIs. The .ico variant is left as a relative reference (browsers
//      fall back to one of the PNGs).
//   4. Strips social-card metadata that references absolute https://encryptalotta.com
//      URLs (og:image, twitter:image, twitter:url, canonical) — useful for crawlers,
//      meaningless for a file:// portable build, and a small privacy improvement.
//   5. Strips the PWA manifest link — there's no service worker in a single-file build.
//   6. Prepends a banner comment noting this is the portable build with a timestamp
//      and the SHA-256 of the canonical source.
//
// Output: `encryptalotta-portable.html` at the repo root. Self-contained, opens from
// `file://`, no network calls, identical functionality to the live site.
//
// CSP:
//   The site already uses 'unsafe-inline' for script-src and style-src (the inline
//   script block at the bottom of index.html requires it). Inlining the vendored
//   deps keeps this exactly the same — no relaxation needed.
//
// What this does NOT do:
//   - It does not minify. The output is roughly the size of the four vendored deps
//     plus index.html, ~570KB combined, ~140KB gzipped over HTTP (similar to live).
//   - It does not inline the large brand image (`encryptalotta.png`, ~440KB) since
//     that's only used for OpenGraph/Twitter cards which are stripped anyway.
//   - It does not produce a signed release — see scripts/build-release-manifest.js.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'encryptalotta-portable.html');

const VENDORED_SCRIPTS = [
    'openpgp.min.js',
    'qrcode.js',
    'secrets.min.js',
    'js-yaml.min.js'
];

const FAVICONS = [
    { tag: 'apple-touch-icon', file: 'apple-touch-icon.png', mime: 'image/png' },
    { tag: 'favicon-32x32',    file: 'favicon-32x32.png',    mime: 'image/png' },
    { tag: 'favicon-16x16',    file: 'favicon-16x16.png',    mime: 'image/png' }
];

function escapeForScriptTag(s) {
    // Any literal `</script>` inside an inline <script> block would end it early.
    // Standard JS source escape: split the closing tag with a backslash.
    return s.replace(/<\/script/gi, '<\\/script');
}

function fileBase64(p) {
    return fs.readFileSync(p).toString('base64');
}

function dataUri(mime, b64) {
    return `data:${mime};base64,${b64}`;
}

function build() {
    let html = fs.readFileSync(SRC, 'utf8');

    // -------- 1) Inline vendored scripts --------
    for (const name of VENDORED_SCRIPTS) {
        const filePath = path.join(ROOT, name);
        if (!fs.existsSync(filePath)) throw new Error(`vendored script missing: ${name}`);
        const body = fs.readFileSync(filePath, 'utf8');
        const inlined = `<script>\n/* inlined: ${name} */\n${escapeForScriptTag(body)}\n</script>`;
        // Match `<script src="./X.js"></script>` (with or without leading ./).
        const re = new RegExp(`<script\\s+src=\\"\\.?/?${name.replace(/\./g, '\\.')}\\"\\s*></script>`);
        if (!re.test(html)) throw new Error(`could not find <script src="./${name}"> tag in index.html`);
        // Function replacement to avoid `$` patterns in minified JS being interpreted
        // as String.replace substitution sequences (which silently corrupts output).
        html = html.replace(re, () => inlined);
    }

    // -------- 2) Inline favicons --------
    for (const ico of FAVICONS) {
        const filePath = path.join(ROOT, ico.file);
        if (!fs.existsSync(filePath)) continue;
        const uri = dataUri(ico.mime, fileBase64(filePath));
        // Replace any href="...<file>" with the data URI.
        const re = new RegExp(`href=\\"(?:\\.?/)?${ico.file.replace(/\./g, '\\.')}\\"`);
        html = html.replace(re, `href="${uri}"`);
    }

    // -------- 3) Strip social-card / canonical / manifest metadata --------
    //
    // These reference absolute URLs on encryptalotta.com and are meaningless in a
    // portable build. Removing them slightly reduces fingerprinting too (the portable
    // file no longer "knows" where it came from).
    const STRIP_RE = [
        /<meta\s+property=\"og:[^\"]+\"\s+content=\"[^\"]*\"\s*\/?>\s*\n?/gi,
        /<meta\s+name=\"twitter:[^\"]+\"\s+content=\"[^\"]*\"\s*\/?>\s*\n?/gi,
        /<meta\s+name=\"twitter:card\"\s+content=\"[^\"]*\"\s*\/?>\s*\n?/gi,
        /<link\s+rel=\"canonical\"\s+href=\"[^\"]*\"\s*\/?>\s*\n?/gi,
        /<link\s+rel=\"alternate\"[^>]*>\s*\n?/gi,
        /<link\s+rel=\"manifest\"[^>]*>\s*\n?/gi
    ];
    for (const re of STRIP_RE) html = html.replace(re, '');

    // -------- 4) Prepend portable-build banner --------
    // Banner timestamp is derived from input mtimes (not Date.now()) so successive
    // builds with unchanged inputs produce byte-identical output. Important for
    // reproducible-build claims (§4.2) and for git diff hygiene.
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex');
    const inputs = [SRC, ...VENDORED_SCRIPTS.map(s => path.join(ROOT, s))];
    const newestMtime = Math.max(...inputs.map(p => fs.statSync(p).mtimeMs));
    const banner = `<!--
  encryptalotta — single-file portable build
  Source mtime: ${new Date(newestMtime).toISOString()}
  Source: index.html (SHA-256: ${sourceHash})
  All vendored JavaScript inlined; favicons inlined as data: URIs.
  Identical functionality to the live site at https://encryptalotta.com.
  Runs from file://, USB stick, chat attachment, anywhere. No network calls.
-->
`;
    html = html.replace(/^<!DOCTYPE html>/i, '<!DOCTYPE html>\n' + banner);

    fs.writeFileSync(OUT, html, 'utf8');
    const outSize = fs.statSync(OUT).size;
    console.log(`wrote ${path.relative(ROOT, OUT)} — ${(outSize / 1024).toFixed(1)} KB`);
    console.log(`source SHA-256: ${sourceHash}`);
}

build();
