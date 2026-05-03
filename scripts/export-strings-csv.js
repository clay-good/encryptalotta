#!/usr/bin/env node
// Export the inline STRINGS table from index.html to i18n/strings.csv for native
// reviewers. Round-trip back via scripts/import-strings-csv.js once a reviewer
// returns the file with edits.
//
// CSV columns (RFC 4180 quoting):
//   key, en, fr, zh-CN, de, hi, fr_status, zh_status, de_status, hi_status
//
// Status columns let a reviewer mark each row "ok" / "needs-rework" / "" without
// overwriting the value cell. The importer respects whatever is in the value
// cells regardless of status — status is metadata for humans, not the importer.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'i18n');
const OUT = path.join(OUT_DIR, 'strings.csv');

const LOCALES = ['en', 'fr', 'zh-CN', 'de', 'hi'];
const STATUS_LOCALES = ['fr', 'zh-CN', 'de', 'hi'];

function extractStrings(source) {
    const start = source.indexOf('const STRINGS =');
    if (start < 0) throw new Error('STRINGS literal not found');
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

function csvCell(s) {
    const v = s == null ? '' : String(s);
    if (/[",\r\n]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
}

function main() {
    const html = fs.readFileSync(SRC, 'utf8');
    const S = extractStrings(html);

    const enKeys = new Set(Object.keys(S.en));
    for (const l of LOCALES) {
        if (!S[l]) throw new Error(`Locale ${l} missing`);
        const lk = new Set(Object.keys(S[l]));
        const missing = [...enKeys].filter(k => !lk.has(k));
        if (missing.length) throw new Error(`${l} missing keys: ${missing.slice(0,3).join(', ')}...`);
    }

    const keys = Object.keys(S.en).sort();
    const header = ['key', ...LOCALES, ...STATUS_LOCALES.map(l => `${l}_status`)];
    const lines = [header.map(csvCell).join(',')];

    for (const k of keys) {
        const row = [k, ...LOCALES.map(l => S[l][k]), ...STATUS_LOCALES.map(() => '')];
        lines.push(row.map(csvCell).join(','));
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(OUT, lines.join('\r\n') + '\r\n', 'utf8');
    console.log(`wrote ${path.relative(ROOT, OUT)} — ${keys.length} keys × ${LOCALES.length} locales`);
}

main();
