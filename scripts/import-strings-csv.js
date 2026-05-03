#!/usr/bin/env node
// Import edited i18n/strings.csv back into index.html, replacing each non-en
// locale block of the inline STRINGS literal in place. The English block is the
// source of truth and is NOT overwritten — if a reviewer edits the en column,
// this script ignores it and prints a warning.
//
// Safety:
//  - Refuses to run if the CSV is missing keys present in STRINGS.en.
//  - Refuses to run if the CSV has keys not present in STRINGS.en (would be
//    silently dropped on next export otherwise — this is almost always a typo).
//  - Preserves the existing key order inside each locale block (so diffs stay
//    minimal) by overwriting values per existing key, not re-emitting from CSV.
//  - Status columns are read-only metadata — never written to index.html.
//  - After writing, re-runs key-parity check on the resulting STRINGS.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'index.html');
const CSV = path.join(ROOT, 'i18n', 'strings.csv');

const TARGET_LOCALES = ['fr', 'zh-CN', 'de', 'hi'];

function parseCsv(text) {
    // RFC 4180 parser: handles "" escaping inside quoted fields, \r\n or \n line endings.
    const rows = [];
    let row = [], cell = '', inQuotes = false, i = 0;
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            cell += c; i++; continue;
        }
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === ',') { row.push(cell); cell = ''; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
        cell += c; i++;
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function extractStrings(source) {
    const start = source.indexOf('const STRINGS =');
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
    return { obj: new Function('return ' + after.slice(objStart, end))(), absStart: start + objStart, absEnd: start + end };
}

// Replace a single key's value within a specific locale block of the STRINGS literal.
// Uses a regex anchored to "'<key>': '...'" inside the block. Values are JS-escaped.
function jsEscape(s) {
    return String(s)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
}

// Find the [start, end) span of a locale's inner block: the contents between the
// opening `<lang>: {` and its matching `}`. Handles 'zh-CN' (quoted) and bare keys.
function findLocaleBlock(literalText, lang) {
    // Locale keys in STRINGS are always quoted: 'en': { ... }, 'fr': { ... }, 'zh-CN': { ... }.
    const re = new RegExp(`["']${lang}["']\\s*:\\s*\\{`);
    const m = re.exec(literalText);
    if (!m) throw new Error(`Locale block for ${lang} not found`);
    const openIdx = literalText.indexOf('{', m.index + m[0].length - 1);
    let depth = 0, inStr = null, esc = false;
    for (let i = openIdx; i < literalText.length; i++) {
        const c = literalText[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (c === '\\') { esc = true; continue; }
            if (c === inStr) inStr = null;
            continue;
        }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) return { open: openIdx, close: i }; }
    }
    throw new Error(`Unterminated block for ${lang}`);
}

function replaceKeyInBlock(blockText, key, newValue) {
    // Match: 'key': 'value', — value is single-quoted and may contain escaped quotes.
    const keyEsc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`('${keyEsc}'\\s*:\\s*)'((?:[^'\\\\]|\\\\.)*)'`);
    if (!re.test(blockText)) throw new Error(`Key '${key}' not found in block`);
    return blockText.replace(re, `$1'${jsEscape(newValue)}'`);
}

function main() {
    if (!fs.existsSync(CSV)) {
        console.error(`No CSV at ${CSV} — run scripts/export-strings-csv.js first.`);
        process.exit(1);
    }
    const html = fs.readFileSync(SRC, 'utf8');
    const { obj: STRINGS, absStart, absEnd } = extractStrings(html);

    const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
    const header = rows.shift();
    const colIdx = Object.fromEntries(header.map((h, i) => [h, i]));
    for (const c of ['key', 'en', ...TARGET_LOCALES]) {
        if (!(c in colIdx)) throw new Error(`CSV missing required column: ${c}`);
    }

    const csvKeys = new Set(rows.map(r => r[colIdx.key]));
    const enKeys = new Set(Object.keys(STRINGS.en));
    const missingFromCsv = [...enKeys].filter(k => !csvKeys.has(k));
    const extraInCsv = [...csvKeys].filter(k => !enKeys.has(k));
    if (missingFromCsv.length) throw new Error(`CSV missing keys: ${missingFromCsv.slice(0,5).join(', ')}`);
    if (extraInCsv.length) throw new Error(`CSV has unknown keys: ${extraInCsv.slice(0,5).join(', ')}`);

    let literal = html.slice(absStart, absEnd);
    let changed = 0;
    let enDriftWarnings = 0;

    for (const row of rows) {
        const key = row[colIdx.key];
        if (row[colIdx.en] !== STRINGS.en[key]) {
            console.warn(`warn: en column edited for '${key}' — ignored (en is source of truth, edit index.html)`);
            enDriftWarnings++;
        }
        for (const lang of TARGET_LOCALES) {
            const newVal = row[colIdx[lang]];
            const oldVal = STRINGS[lang][key];
            if (newVal === oldVal) continue;
            const block = findLocaleBlock(literal, lang);
            const blockText = literal.slice(block.open, block.close + 1);
            const updatedBlock = replaceKeyInBlock(blockText, key, newVal);
            literal = literal.slice(0, block.open) + updatedBlock + literal.slice(block.close + 1);
            changed++;
        }
    }

    if (changed === 0) {
        console.log(`no changes (${enDriftWarnings} en-drift warnings ignored)`);
        return;
    }

    const updated = html.slice(0, absStart) + literal + html.slice(absEnd);

    // Sanity: re-extract and verify parity before writing.
    const { obj: roundtrip } = extractStrings(updated);
    for (const l of ['en', ...TARGET_LOCALES]) {
        const lk = new Set(Object.keys(roundtrip[l]));
        const missing = [...enKeys].filter(k => !lk.has(k));
        if (missing.length) throw new Error(`Post-write parity check failed for ${l}: ${missing.slice(0,3).join(', ')}`);
    }

    fs.writeFileSync(SRC, updated, 'utf8');
    console.log(`wrote ${changed} value updates to index.html (${enDriftWarnings} en-drift warnings ignored)`);
}

main();
