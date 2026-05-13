#!/usr/bin/env node
// Generate a CycloneDX 1.5 SBOM (Software Bill of Materials) for encryptalotta as `sbom.json`.
//
// Why this exists (SPEC-INTERNATIONAL.md §4.3):
//   The EU Cyber Resilience Act and NIS2 are pushing public-sector procurement toward
//   requiring SBOMs even for free static sites. Having one available is a credibility
//   signal for EU procurement, security audits, and the kind of public-good registry
//   submissions described in spec §4.7.
//
// The output is CycloneDX 1.5 (https://cyclonedx.org/specification/overview/) — a JSON
// dialect supported by every major dependency-scanning tool. We pick CycloneDX over
// SPDX because the JSON form is simpler and the hash-attribute representation
// (`hashes: [{alg, content}]`) matches how we already track integrity (SHA-384).
//
// What this records:
//   - The application itself (encryptalotta) as the root component, MIT-licensed.
//   - One library component per vendored .js dependency, each with:
//       * name, version, license (from the on-disk manifest)
//       * SHA-384 (re-computed from on-disk bytes — does not trust the manifest)
//       * SHA-256 (cross-hash, more widely consumed by SBOM tooling)
//       * vcs externalReference pointing at the upstream repository
//       * file-size and on-disk path as properties
//
// What this does NOT record:
//   - Static images / fonts / icons — those are project-owned assets, not vendored
//     deps. CycloneDX `component.type: file` could carry them but adds noise.
//   - Build-time tooling (Node, Playwright, axe). Those are dev dependencies and
//     do not ship to the user.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'sbom.json');

// Vendored deps — the source of truth here is the README manifest. We re-read
// metadata from one place rather than duplicating it across scripts.
const VENDORED = [
    {
        file: 'openpgp.min.js',
        name: 'openpgpjs',
        purlName: 'openpgp',
        version: '6.3.0',
        license: 'LGPL-3.0-or-later',
        vcs: 'https://github.com/openpgpjs/openpgpjs',
        description: 'OpenPGP.js — JavaScript implementation of the OpenPGP protocol.'
    },
    {
        file: 'qrcode.js',
        name: 'qrcode-generator',
        purlName: 'qrcode-generator',
        version: '2.0.4',
        license: 'MIT',
        vcs: 'https://github.com/kazuhikoarase/qrcode-generator',
        description: 'qrcode-generator — pure-JS QR code rendering.'
    },
    {
        file: 'secrets.min.js',
        name: 'secrets.js-grempe',
        purlName: 'secrets.js-grempe',
        version: '2.0.0',
        license: 'MIT',
        vcs: 'https://github.com/grempe/secrets.js',
        description: 'secrets.js-grempe — Shamir Secret Sharing in JavaScript.'
    },
    {
        file: 'js-yaml.min.js',
        name: 'js-yaml',
        purlName: 'js-yaml',
        version: '4.1.1',
        license: 'MIT',
        vcs: 'https://github.com/nodeca/js-yaml',
        description: 'js-yaml — YAML parse / stringify.'
    }
];

function hashFile(filePath, alg) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash(alg).update(data).digest('hex');
}

function component(dep) {
    const filePath = path.join(ROOT, dep.file);
    if (!fs.existsSync(filePath)) throw new Error(`vendored file missing: ${dep.file}`);
    const stat = fs.statSync(filePath);
    return {
        type: 'library',
        'bom-ref': `pkg:npm/${dep.purlName}@${dep.version}`,
        name: dep.name,
        version: dep.version,
        description: dep.description,
        scope: 'required',
        licenses: [{ license: { id: dep.license } }],
        // PURL keeps the dependency machine-identifiable even though the file is
        // vendored locally and not fetched at runtime. Scanners can still match it.
        purl: `pkg:npm/${dep.purlName}@${dep.version}`,
        hashes: [
            { alg: 'SHA-256', content: hashFile(filePath, 'sha256') },
            { alg: 'SHA-384', content: hashFile(filePath, 'sha384') },
            { alg: 'SHA-512', content: hashFile(filePath, 'sha512') }
        ],
        externalReferences: [
            { type: 'vcs', url: dep.vcs },
            { type: 'website', url: dep.vcs }
        ],
        properties: [
            { name: 'encryptalotta:vendored-path', value: dep.file },
            { name: 'encryptalotta:file-size-bytes', value: String(stat.size) }
        ]
    };
}

function build() {
    // Deterministic-ish serial: not a real UUID v4 (would make every regen "dirty"
    // in git diffs); deterministic SHA-256-derived UUID v5-ish flavor so the SBOM
    // is reproducible from the on-disk dep bytes.
    const fingerprint = crypto.createHash('sha256');
    for (const dep of VENDORED) {
        fingerprint.update(dep.file);
        fingerprint.update(hashFile(path.join(ROOT, dep.file), 'sha256'));
    }
    const hex = fingerprint.digest('hex');
    const serial = `urn:uuid:${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

    const sbom = {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        serialNumber: serial,
        version: 1,
        metadata: {
            // Use a deterministic timestamp (the most-recent file mtime among the
            // vendored deps) so the SBOM hash is reproducible across regenerations
            // that haven't changed any inputs. CycloneDX wants ISO 8601.
            timestamp: new Date(
                Math.max(...VENDORED.map(d => fs.statSync(path.join(ROOT, d.file)).mtimeMs))
            ).toISOString(),
            tools: {
                components: [
                    {
                        type: 'application',
                        name: 'build-sbom.js',
                        version: '1.0.0',
                        description: 'encryptalotta SBOM generator (scripts/build-sbom.js)'
                    }
                ]
            },
            component: {
                type: 'application',
                'bom-ref': 'pkg:generic/encryptalotta',
                name: 'encryptalotta',
                description: 'Free, client-side privacy and developer toolbox — 42 tools, zero server uploads.',
                licenses: [{ license: { id: 'MIT' } }],
                externalReferences: [
                    { type: 'website', url: 'https://encryptalotta.com' },
                    { type: 'vcs',     url: 'https://github.com/clay-good/encryptalotta' }
                ]
            }
        },
        components: VENDORED.map(component)
    };

    fs.writeFileSync(OUT, JSON.stringify(sbom, null, 2) + '\n', 'utf8');
    console.log(`wrote ${path.relative(ROOT, OUT)} — CycloneDX 1.5, ${sbom.components.length} libraries`);
}

build();
