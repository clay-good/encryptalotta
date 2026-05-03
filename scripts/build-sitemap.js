#!/usr/bin/env node
// Generate sitemap.xml at the repo root.
//
// Lists the 5 locale roots: /, /fr/, /zh/, /de/, /hi/. Tool deep links
// (#/keys/qr, #/utilities/exif, …) are deliberately NOT listed because Google
// does not index URL fragments as separate pages. The deep links exist for
// sharing and bookmarking, not for SEO.
//
// Each <url> entry carries:
//   - <loc>          absolute URL
//   - <lastmod>      today's UTC date (ISO 8601, day precision)
//   - <changefreq>   monthly
//   - <priority>     1.0 for /, 0.8 for variants
//   - <xhtml:link rel="alternate" hreflang="…">  for every supported locale
//
// Run before each release alongside scripts/build-i18n-variants.js.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://encryptalotta.com';

const VARIANTS = [
    { hreflang: 'en',    pathSeg: '',        priority: '1.0' },
    { hreflang: 'fr',    pathSeg: 'fr/',     priority: '0.8' },
    { hreflang: 'zh-CN', pathSeg: 'zh/',     priority: '0.8' },
    { hreflang: 'de',    pathSeg: 'de/',     priority: '0.8' },
    { hreflang: 'hi',    pathSeg: 'hi/',     priority: '0.8' }
];

function urlFor(seg) { return `${SITE}/${seg}`; }
function today() { return new Date().toISOString().slice(0, 10); }

function buildXml() {
    const lastmod = today();
    const lines = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    lines.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">');
    for (const v of VARIANTS) {
        lines.push('  <url>');
        lines.push(`    <loc>${urlFor(v.pathSeg)}</loc>`);
        lines.push(`    <lastmod>${lastmod}</lastmod>`);
        lines.push('    <changefreq>monthly</changefreq>');
        lines.push(`    <priority>${v.priority}</priority>`);
        for (const alt of VARIANTS) {
            lines.push(`    <xhtml:link rel="alternate" hreflang="${alt.hreflang}" href="${urlFor(alt.pathSeg)}"/>`);
        }
        lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('')}"/>`);
        lines.push('  </url>');
    }
    lines.push('</urlset>');
    return lines.join('\n') + '\n';
}

function main() {
    const outPath = path.join(ROOT, 'sitemap.xml');
    fs.writeFileSync(outPath, buildXml(), 'utf8');
    console.log(`wrote sitemap.xml — ${VARIANTS.length} locale roots, lastmod ${today()}`);
}

main();
