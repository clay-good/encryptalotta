#!/usr/bin/env node
// Generate a reproducible release manifest (`RELEASES.md`) listing the SHA-256 of
// every file that ships to the user.
//
// Why this exists (SPEC-INTERNATIONAL.md §4.2):
//   - Any reader can `git clone` at a release tag, run this script, and confirm
//     the bytes on disk match the published manifest. No build pipeline to trust;
//     the manifest is the source of truth.
//   - Lets us point procurement / audit teams at one file for "this is what
//     shipped". Pairs well with `sbom.json` (§4.3) and the portable build
//     (§4.6) — each addresses a different audit need.
//
// What this manifests:
//   - The canonical English `index.html`
//   - The four pre-rendered locale variants under /fr/, /zh/, /de/, /hi/
//   - The four vendored .js libraries
//   - The icon set (apple-touch-icon, favicons, brand image)
//   - The static auxiliaries (sitemap.xml, robots.txt, _headers, site.webmanifest)
//   - The portable single-file build (if present)
//   - The CycloneDX SBOM (if present)
//
// What it does NOT manifest:
//   - The repository's docs (README.md, SPEC-INTERNATIONAL.md, LICENSE) — these
//     are not "what ships to the user," they're project context.
//   - The /tests directory (dev-only).
//   - The /scripts directory (build-time only).
//   - The /i18n/strings.csv export (reviewer artifact, not shipped to users).
//
// Output: `RELEASES.md` at the repo root. One section per generation, dated.
// Re-running the script appends to the file rather than overwriting it, so the
// historical record of past releases is preserved.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'RELEASES.md');

// Globs would be nice but `glob` is not a runtime dep here. Explicit list keeps
// the manifest deterministic and forces a maintainer to consciously add new
// shipped files.
const SHIPPED = [
    'index.html',
    'fr/index.html',
    'zh/index.html',
    'de/index.html',
    'hi/index.html',
    'openpgp.min.js',
    'qrcode.js',
    'secrets.min.js',
    'js-yaml.min.js',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    'encryptalotta.png',
    'site.webmanifest',
    'sitemap.xml',
    'robots.txt',
    '_headers'
];

const OPTIONAL = [
    'encryptalotta-portable.html',
    'sbom.json'
];

function gitCommit() {
    try {
        return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        return '(not in a git checkout)';
    }
}

function gitTag() {
    try {
        return execSync('git describe --tags --exact-match HEAD 2>/dev/null', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {
        return '(no tag)';
    }
}

function isClean() {
    try {
        const out = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim();
        return out.length === 0;
    } catch {
        return null;
    }
}

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function build() {
    const commit = gitCommit();
    const tag    = gitTag();
    const clean  = isClean();
    const date   = new Date().toISOString();

    const rows = [];
    let totalBytes = 0;
    for (const rel of SHIPPED) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) {
            rows.push({ rel, size: '-', sha: 'MISSING' });
            continue;
        }
        const size = fs.statSync(abs).size;
        totalBytes += size;
        rows.push({ rel, size: size.toString(), sha: sha256(abs) });
    }
    const optionalRows = [];
    for (const rel of OPTIONAL) {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) continue;
        const size = fs.statSync(abs).size;
        optionalRows.push({ rel, size: size.toString(), sha: sha256(abs) });
    }

    // Manifest fingerprint: SHA-256 of the concatenation of all per-file SHAs and
    // paths, in declared order. A maintainer at any tag can rerun this script and
    // verify the fingerprint matches what was published — no signature needed for
    // that level of integrity check (signature optional, see §4.2 future-work).
    const manifestFp = crypto.createHash('sha256')
        .update(rows.concat(optionalRows).map(r => `${r.sha}  ${r.rel}\n`).join(''))
        .digest('hex');

    const lines = [];
    lines.push(`## Release snapshot — ${date}`);
    lines.push('');
    lines.push(`- **Git commit:** \`${commit}\``);
    lines.push(`- **Git tag:** ${tag === '(no tag)' ? '_none_' : '`' + tag + '`'}`);
    lines.push(`- **Working tree:** ${clean === true ? 'clean' : clean === false ? '**dirty (uncommitted changes present at generation)**' : 'unknown'}`);
    lines.push(`- **Manifest fingerprint (SHA-256):** \`${manifestFp}\``);
    lines.push(`- **Total shipped bytes:** ${totalBytes.toLocaleString()} B (${(totalBytes / 1024).toFixed(1)} KiB)`);
    lines.push('');
    lines.push('### Shipped files');
    lines.push('');
    lines.push('| File | Size (B) | SHA-256 |');
    lines.push('|---|---:|---|');
    for (const r of rows) lines.push(`| \`${r.rel}\` | ${r.size} | \`${r.sha}\` |`);
    if (optionalRows.length) {
        lines.push('');
        lines.push('### Optional build artifacts');
        lines.push('');
        lines.push('| File | Size (B) | SHA-256 |');
        lines.push('|---|---:|---|');
        for (const r of optionalRows) lines.push(`| \`${r.rel}\` | ${r.size} | \`${r.sha}\` |`);
    }
    lines.push('');
    lines.push('### Verification');
    lines.push('');
    lines.push('To verify this release matches what you have on disk:');
    lines.push('');
    lines.push('```sh');
    lines.push('# At the same git commit:');
    lines.push('git checkout ' + (tag !== '(no tag)' ? tag : commit));
    lines.push('node scripts/build-release-manifest.js');
    lines.push('# Compare the new "Manifest fingerprint" line to the one above.');
    lines.push('```');
    lines.push('');
    lines.push('Or hash any single file directly:');
    lines.push('');
    lines.push('```sh');
    lines.push('openssl dgst -sha256 index.html');
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');

    const section = lines.join('\n');

    // Append-only: preserve historical entries.
    let prior = '';
    if (fs.existsSync(OUT)) prior = fs.readFileSync(OUT, 'utf8');
    if (!prior.startsWith('# encryptalotta release manifest')) {
        prior = '# encryptalotta release manifest\n\nGenerated by `scripts/build-release-manifest.js`. Append-only history of release snapshots — each section corresponds to one run.\n\n' + prior;
    }
    fs.writeFileSync(OUT, prior + section, 'utf8');
    console.log(`wrote ${path.relative(ROOT, OUT)} — fingerprint ${manifestFp.slice(0, 16)}…`);
}

build();
