#!/usr/bin/env node
// Quarterly check: are any vendored libraries newer upstream than what we
// have pinned in README.md?
//
// Runs server-side only (locally or in GitHub Actions). Never touches the
// shipped site, so the `connect-src 'none'` invariant is unaffected.
//
// Reads the manifest table in README.md, hits each upstream's GitHub Releases
// API to fetch the latest tag, compares against the pinned version, and exits
// non-zero with a summary if any are stale. The summary becomes the body of
// the auto-opened issue (see .github/workflows/dep-check.yml).
//
// Manifest row format (markdown table):
//   | `<file>` | <name> | <version> | <license> | <https://github.com/<owner>/<repo>> | `<sha384>` |

const fs = require('fs');
const https = require('https');
const path = require('path');

const README = path.join(__dirname, '..', 'README.md');

// Optional manifest-row override: map a vendored file to an npm package name when
// the GitHub repo name does not match the npm name, or when GitHub Releases are
// noisy / multi-language (e.g. kazuhikoarase/qrcode-generator publishes Java +
// JS releases under the same repo, with `js<version>` GitHub tag prefixes).
// npm is queried first for these; GitHub is the fallback.
const NPM_OVERRIDE = {
    'openpgp.min.js': 'openpgp',
    'qrcode.min.js': 'qrcode-generator',
    'secrets.min.js': 'secrets.js-grempe'
};

function parseManifest(md) {
    const out = [];
    const lines = md.split('\n');
    for (const line of lines) {
        if (!line.startsWith('|')) continue;
        const cells = line.split('|').map(c => c.trim());
        if (cells.length < 7) continue;
        const file = cells[1].replace(/`/g, '');
        if (!file.endsWith('.js')) continue;
        const version = cells[3];
        const repoCell = cells[5];
        const repoMatch = repoCell.match(/github\.com\/([^/<>\s]+)\/([^/<>\s)]+)/);
        if (!repoMatch) continue;
        out.push({ file, version, owner: repoMatch[1], repo: repoMatch[2] });
    }
    return out;
}

function httpsGetJson(opts) {
    return new Promise((resolve, reject) => {
        https.get(opts, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 120)}`));
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function npmLatest(pkg) {
    // npm registry returns the latest dist-tag in `dist-tags.latest`. This is the
    // canonical "what users get if they `npm install <pkg>` today" — much more
    // reliable than GitHub Releases for packages that publish multi-language
    // tags (e.g. js<ver>, java<ver>) or that release without a GitHub Release.
    const data = await httpsGetJson({
        host: 'registry.npmjs.org',
        path: `/${encodeURIComponent(pkg)}`,
        headers: { 'User-Agent': 'encryptalotta-dep-check', 'Accept': 'application/json' }
    });
    return (data && data['dist-tags'] && data['dist-tags'].latest) || null;
}

async function ghLatestRelease(owner, repo) {
    const opts = {
        host: 'api.github.com',
        path: `/repos/${owner}/${repo}/releases/latest`,
        headers: { 'User-Agent': 'encryptalotta-dep-check', 'Accept': 'application/vnd.github+json' }
    };
    if (process.env.GITHUB_TOKEN) opts.headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    try {
        const json = await httpsGetJson(opts);
        return json.tag_name || json.name || null;
    } catch (e) {
        if (!/HTTP 404/.test(e.message)) throw e;
        // Fall back to /tags?per_page=1 for repos that don't publish Releases.
        const tagOpts = { ...opts, path: `/repos/${owner}/${repo}/tags?per_page=1` };
        const arr = await httpsGetJson(tagOpts);
        return arr[0] && arr[0].name ? arr[0].name : null;
    }
}

function normalizeVersion(v) {
    // Strip leading `v` (semver convention) and `js`/`java` multi-language tag
    // prefixes used by repos like kazuhikoarase/qrcode-generator. Trim whitespace.
    return String(v || '').replace(/^(v|js|java)/i, '').trim();
}

function compareSemver(a, b) {
    // Returns 'major', 'minor', 'patch', 'newer', 'same', or 'unknown' for the
    // gap from `a` (pinned) to `b` (upstream). Best-effort — non-semver tags
    // fall through to 'unknown'.
    const re = /^(\d+)\.(\d+)\.(\d+)/;
    const ma = re.exec(a); const mb = re.exec(b);
    if (!ma || !mb) return a === b ? 'same' : 'unknown';
    const [_a, A1, A2, A3] = ma.map(Number); const [_b, B1, B2, B3] = mb.map(Number);
    if (A1 === B1 && A2 === B2 && A3 === B3) return 'same';
    if (B1 > A1) return 'major';
    if (B1 === A1 && B2 > A2) return 'minor';
    if (B1 === A1 && B2 === A2 && B3 > A3) return 'patch';
    return 'newer';
}

async function lookupUpstream(entry) {
    // Prefer npm for entries with an explicit override — it returns the canonical
    // dist-tag `latest` regardless of how the upstream tags GitHub releases.
    const npmName = NPM_OVERRIDE[entry.file];
    if (npmName) {
        try {
            const v = await npmLatest(npmName);
            if (v) return { source: 'npm:' + npmName, version: v };
        } catch (e) {
            // Fall through to GitHub on any npm error.
        }
    }
    const tag = await ghLatestRelease(entry.owner, entry.repo);
    return { source: `gh:${entry.owner}/${entry.repo}`, version: tag };
}

async function main() {
    const md = fs.readFileSync(README, 'utf8');
    const entries = parseManifest(md);
    if (!entries.length) {
        console.error('FAIL: no vendored libraries parsed from README.md manifest');
        process.exit(2);
    }
    console.log(`Checking ${entries.length} vendored libraries against upstream (npm-preferred, GitHub fallback)…`);

    const stale = [];
    for (const e of entries) {
        try {
            const lookup = await lookupUpstream(e);
            const pinned = normalizeVersion(e.version);
            const upstream = normalizeVersion(lookup.version);
            if (!upstream) {
                console.log(`?  ${e.file}: pinned=${pinned}, upstream=unknown (no releases / tags)`);
                continue;
            }
            const gap = compareSemver(pinned, upstream);
            if (gap === 'same') {
                console.log(`OK ${e.file}: pinned=${pinned} (current via ${lookup.source})`);
            } else if (gap === 'unknown') {
                console.log(`?  ${e.file}: pinned=${pinned}, upstream=${upstream} (non-semver — ${lookup.source})`);
                stale.push({ ...e, upstream, pinned, gap, source: lookup.source });
            } else {
                const tag = gap === 'major' ? 'MAJOR' : gap.toUpperCase();
                console.log(`!! ${e.file}: pinned=${pinned} → upstream=${upstream}  [${tag}]  (${lookup.source})`);
                stale.push({ ...e, upstream, pinned, gap, source: lookup.source });
            }
        } catch (err) {
            console.log(`?  ${e.file}: lookup failed — ${err.message}`);
        }
    }

    if (stale.length) {
        console.log('');
        console.log('STALE: ' + stale.length + ' vendored libraries have newer upstream versions.');
        console.log('Follow the manual update procedure in README.md (Dependency update cadence).');
        for (const s of stale) {
            const note = s.gap === 'major' ? ' — MAJOR version jump, review changelog and API surface before vendoring'
                       : s.gap === 'unknown' ? ' — non-semver version, manual review required'
                       : '';
            console.log(`  - ${s.file}: ${s.pinned} → ${s.upstream} (${s.source})${note}`);
        }
        process.exit(1);
    }
    console.log('');
    console.log('All vendored libraries are at the current upstream release.');
}

main().catch((e) => { console.error('check-dependency-updates failed:', e); process.exit(2); });
