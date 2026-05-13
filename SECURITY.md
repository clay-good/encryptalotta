# Security policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in encryptalotta, please report it
privately. **Do not open a public GitHub issue** for anything that could let an attacker
weaken users' cryptographic operations or exfiltrate data from their browser.

- **Email:** hi@claygood.com
- **PGP-encrypted email preferred.** The maintainer's public key is published on
  encryptalotta.com (use the QR Share tool to fetch a fresh copy) and on common
  keyservers under the same address. Fingerprints are pinned in commit messages
  when the key is rotated.

Please include:
- A description of the vulnerability and its impact (what an attacker can do).
- Reproduction steps or a proof-of-concept (a minimal HTML file or a console
  transcript is ideal).
- The browser, OS, and encryptalotta commit / release tag you were testing
  against. The portable build (`encryptalotta-portable.html`) is fine — just
  note its SHA-256.
- Whether you've disclosed the issue elsewhere.

## Response timeline

This is a single-maintainer project. Realistic, not aspirational:

| Severity                                  | Initial reply | Triage    | Public fix target |
|-------------------------------------------|---------------|-----------|-------------------|
| Critical (key leak, RCE, network exfil)   | 48 hours      | 7 days    | 30 days           |
| High (XSS, CSP bypass, crypto correctness)| 7 days        | 30 days   | 90 days           |
| Medium / Low                              | 30 days       | as bandwidth allows | next release |

The maintainer will credit reporters in the release notes unless you ask to remain
anonymous.

## Supported versions

The site is a single rolling release: `main` on GitHub is what's deployed at
encryptalotta.com. There are no long-term-support branches. Tagged releases
(see `RELEASES.md` when present) carry SHA-256s of every shipped file; security
fixes always land on `main` first and are tagged after.

The single-file portable build (`encryptalotta-portable.html`) is regenerated
on every release. If you're running an older portable build, the safest course
is to re-download from a fresh clone of the repo.

## Threat classes in scope

- Cross-site scripting via any input field (tools accept user-supplied text,
  files, regex, JSON, XML, PGP blocks, etc.).
- CSP bypasses or outbound-network leaks. The site enforces
  `connect-src 'none'`; anything that breaks that invariant is high-severity.
- Cryptographic correctness errors: wrong algorithm IDs, non-constant-time
  comparisons where they matter (HMAC verify, hash compare), broken key
  derivation parameters, weak randomness sources, key/passphrase material
  retained in memory or DOM longer than necessary.
- Misuse-inducing UX: a tool that produces output the user is likely to mistake
  for something stronger than it is (e.g., a "signed" indicator that doesn't
  actually verify the signature).
- Supply-chain integrity: drift between the SHA-384 hashes recorded in
  `index.html`, the README manifest, the SBOM, and the on-disk vendored bytes.

## Threat classes explicitly out of scope

These are not bugs in encryptalotta — see [THREAT-MODEL.md](THREAT-MODEL.md)
for a fuller treatment:

- **Compromised endpoint.** A malicious browser extension, keylogger, or
  rootkit on the user's device can read anything the user types. The site
  cannot defend against this.
- **Compromised network during initial page load.** HTTPS + the integrity of
  the host (encryptalotta.com / GitHub Pages / your local clone) protects
  the page bytes. If a state-level adversary substitutes the page at load
  time, no defense inside the page can detect that. Use the portable build
  from a known-good source if this is in your threat model.
- **User error.** Pasting a private key into the wrong tool, picking a weak
  passphrase, ignoring a "for test data only" label, posting an unencrypted
  message in plaintext — these are not bugs.
- **Cryptanalytic advances.** If RSA-3072 or Curve25519 is broken in the
  literature, that's news for the whole field, not an encryptalotta-specific
  vulnerability.

## Build verification

Each tagged release publishes:

- `RELEASES.md` with the SHA-256 of every shipped file (run
  `node scripts/build-release-manifest.js` on a clean clone to verify).
- `sbom.json` (CycloneDX 1.5) listing every vendored library with SHA-256 /
  -384 / -512 hashes (run `node scripts/build-sbom.js` to regenerate).
- `encryptalotta-portable.html` — the entire site as a single file (run
  `node scripts/build-portable.js` to regenerate; the build is deterministic
  modulo input mtimes).

All three are reproducible from a clean clone with no network access.

## Auditing

`node scripts/audit-release.js` runs the mechanically-checkable invariants:
no `innerHTML` assignments, locale string parity, vendored hash agreement,
CSP shape, page weight budget, JSON-LD shape, regulator-preset freshness.
The release ritual is: audit clean, Playwright suite green, then tag.
