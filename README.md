# encryptalotta

**Complete PGP Encryption Suite**

A comprehensive client-side PGP encryption tool featuring key generation, file encryption/decryption, digital signatures, and a full suite of cryptographic utilities. No server uploads, 100% private and open source.

**Inspired by [Kevin Qiu](https://www.linkedin.com/in/kevinmqiu)**


---

## Features

### Core Encryption
- **Generate PGP Keys** - Create ECC (Curve25519) or RSA key pairs with customizable settings
- **Encrypt Files** - Encrypt files with PGP public keys
- **Decrypt Files** - Decrypt files with your private key
- **Text Message Encryption** - Encrypt and decrypt text messages for secure communication

### Digital Signatures
- **Sign Messages** - Create digital signatures to prove authorship
- **Cleartext Signatures** - Sign messages while keeping content human-readable
- **Sign Files** - Create detached signatures for file authentication
- **Verify Signatures** - Verify signed messages, cleartext signatures, and detached signatures

### Encryption Tools
- **Password-Only Encryption** - Encrypt files with just a password (symmetric encryption)
- **Key Information Viewer** - Inspect any PGP key's fingerprint, algorithm, expiration, and user IDs
- **Password Generator** - Generate cryptographically secure passwords with customizable options
- **Revocation Certificates** - Generate certificates to invalidate compromised keys
- **Armor Converter** - Convert between ASCII-armored and binary PGP formats

### Sharing & Splitting
- **QR Share** - Encode a public key or encrypted message into a QR code for hand-to-hand sharing. Auto-chunks long inputs into multi-QR sequences with the `EAL-QR/v1/{n}/{total}/` prefix.
- **Steganography (Image Hiding)** - Hide an encrypted message inside a PNG using LSB encoding. Optional password XORs the payload so a wrong password fails magic-byte validation rather than producing garbage.
- **Shamir Secret Sharing** - Split a secret into N shares where K are required to reconstruct. Useful for backing up passphrases, private keys, or seed phrases.
- **EXIF Eraser** - Strip GPS, camera serial number, timestamps and all other metadata from JPEG, PNG, or WebP images via canvas re-encode.

### Languages

The interface is fully translated into:

| Language | Code | Status |
|---|---|---|
| English | `en` | Source of truth |
| French | `fr` | Drafted carefully (recommend native review) |
| Simplified Chinese | `zh-CN` | Machine-quality (requires native review) |
| German | `de` | Machine-quality (requires native review) |
| Hindi | `hi` | Machine-quality (requires native review) |

Language is auto-detected from `navigator.language` on first visit, persisted in `localStorage`, and switchable from the picker in the top bar. All translations are vendored statically — no fetch, CSP unchanged.

**Pre-rendered SEO variants.** `/fr/`, `/zh/`, `/de/`, `/hi/` are generated as static HTML by `scripts/build-i18n-variants.js`. Each variant has a localized `<title>`, `<meta name="description">`, OpenGraph tags, and `<link rel="canonical">`. The source `index.html` declares `<link rel="alternate" hreflang>` for all five locales plus `x-default`.

**Native-review tooling.** `scripts/export-strings-csv.js` produces `i18n/strings.csv` (key, en, fr, zh-CN, de, hi, plus per-locale status columns) for native reviewers. `scripts/import-strings-csv.js` round-trips edits back into the inline `STRINGS` literal in `index.html`. The `en` column is treated as source of truth and is not overwritten.

### Security & Privacy
- **100% Client-Side** - All operations happen in your browser
- **No Server Uploads** - Your files and keys never leave your device
- **Open Source** - Audit the code yourself
- **Works Offline** - Download and use without internet connection

---

## Security Architecture

Encryptalotta was designed from the ground up with security as the primary concern. This application implements defense-in-depth with multiple layers of protection.

### Zero Network Communication

**Your data never leaves your device.** This isn't just a promise - it's cryptographically enforced:

- **Content Security Policy (CSP)** with `connect-src 'none'` - The browser physically cannot make outbound network requests
- **No external API calls** - All cryptographic operations happen locally
- **No analytics or tracking** - Zero telemetry of any kind
- **Works completely offline** - Download and use without any internet connection

### Modern Cryptography

Built on [OpenPGP.js](https://openpgpjs.org/) v5.11.1, a well-audited cryptographic library:

| Algorithm | Type | Security Level |
|-----------|------|----------------|
| **ECC Curve25519** (Default) | Elliptic Curve | High - Modern standard |
| RSA 3072-bit | Traditional | High |
| RSA 4096-bit | Traditional | Very High |

**Why ECC Curve25519 is the default:**
- Designed by Daniel J. Bernstein, a renowned cryptographer
- Resistant to timing attacks by design
- Smaller keys with equivalent security to RSA 3072
- Faster key generation and encryption/decryption operations

### Supply Chain Protection

**No CDN dependencies. No npm packages. No build process.**

All third-party JavaScript is vendored directly in the repository with SHA-384 integrity hashes recorded in HTML comments next to each `<script>` tag. The manifest below lets you verify that what you download from this repo matches what the maintainer published, and that what runs in your browser matches the official upstream library release.

#### Manifest

| File | Library | Version | License | Source | SHA-384 (base64) |
|---|---|---|---|---|---|
| `openpgp.min.js` | OpenPGP.js | 5.11.1 | LGPL-3.0 | <https://github.com/openpgpjs/openpgpjs> | `Mlq9yV9fsqU41CJA7E1LEbuJQx9REDo5S+jqu1+nyQebPFEY2jBD2PHKvhWPYNyT` |
| `qrcode.min.js` | qrcode-generator | 1.4.4 | MIT | <https://github.com/kazuhikoarase/qrcode-generator> | `lQXOAyZwHXE55JFyrOMB7nY2Wv+m5ZWNtJcHrd1rceRQXAYNLak8ukN5TjBTcIwz` |
| `secrets.min.js` | secrets.js-grempe | 2.0.0 | MIT | <https://github.com/grempe/secrets.js> | `xfBMbh8fdSIrQ9XbZARwZ5z/Eh9zC7gsgG5vSE331lZSjgXQob1KxM4m7vEdH0e0` |
| `js-yaml.min.js` | js-yaml | 4.1.0 | MIT | <https://github.com/nodeca/js-yaml> | `+pxiN6T7yvpryuJmE1gM9PX7yQit15auDb+ZwwvJOd/4be2Cie5/IuVXgQb/S9du` |

Each hash is also recorded inline as an HTML comment beside the corresponding `<script>` tag in [index.html](index.html), so a reader auditing the page source sees the same integrity claim.

#### Verifying against upstream

Download the published distribution from the upstream source listed in the table above, hash it the same way (see [Verifying Integrity](#verifying-integrity) below), and compare. Hashes match → byte-for-byte identical to the official release.

A non-match means either:
1. You downloaded a different version (check version numbers).
2. The repo's vendored copy was modified (audit the diff).
3. The upstream release was modified (rare, but possible — cross-check against another mirror).

#### Why SHA-384, not SRI?

The W3C Subresource Integrity (SRI) attribute requires the script to be served cross-origin or with specific CORS settings. Since these files are served same-origin from the static site, SRI provides no extra benefit. The SHA-384 hashes here serve the same auditing purpose — they let any reader confirm the bytes haven't changed.

If you fork this repo onto a different domain and want to add SRI, replace each `<script src="...">` with the integrity-pinned form:

```html
<script src="./openpgp.min.js"
        integrity="sha384-Mlq9yV9fsqU41CJA7E1LEbuJQx9REDo5S+jqu1+nyQebPFEY2jBD2PHKvhWPYNyT"
        crossorigin="anonymous"></script>
```

#### Other supply-chain protections

- **Single-file application** - No complex dependency chains that could be compromised
- **No build tools** - What you see in the repository is exactly what runs in your browser
- **Translations vendored statically** - Inline `STRINGS` object, no JSON fetch, CSP `connect-src 'none'` unchanged

This eliminates entire categories of supply chain attacks that have affected other security tools.

### Memory Security

Sensitive data is cleared from memory after use:

- **Automatic passphrase clearing** - Passphrase fields are wiped after decryption operations
- **Page unload protection** - Private keys and sensitive fields are cleared when you close or navigate away from the page
- **JavaScript variable clearing** - Sensitive string variables are overwritten when no longer needed

### Strict Content Security Policy

The application enforces a strict CSP that prevents common web attacks:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'none';
form-action 'self';
base-uri 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

**What this means:**
- `connect-src 'none'` — **No network requests allowed** (data exfiltration impossible). Audited via `scripts/audit-release.js`: zero `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or `sendBeacon` call sites in the codebase.
- `frame-ancestors 'none'` — Cannot be embedded in iframes (prevents clickjacking).
- `form-action 'self'` — Forms cannot submit to external servers.
- `base-uri 'self'` — Prevents base tag injection attacks.
- `img-src 'self' data: blob:` — `blob:` is required so the Steganography and EXIF Eraser tools can render user-selected images via `URL.createObjectURL(file)`. Blob URLs cannot be created from network responses without first making a network request, which `connect-src 'none'` forbids; every blob URL in this app traceably originates from a local file or a canvas `toBlob()` call, and is revoked after use.

### HTTP Security Headers

When deployed to Cloudflare Pages (or any server respecting the `_headers` file):

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Force HTTPS for 1 year |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Block iframe embedding |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection |
| `Referrer-Policy` | `no-referrer` | Don't leak URLs |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolate browsing context |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Prevent cross-origin leaks |
| `Cross-Origin-Resource-Policy` | `same-origin` | Block cross-origin reads |
| `Cache-Control` | `no-store, no-cache, must-revalidate` | Prevent caching sensitive pages |

### Permissions Policy

Browser features that could be abused are explicitly disabled. The current policy denies every capability except `clipboard-write=(self)` (so per-tool **Copy** buttons work) — `clipboard-read` is denied so no script can silently steal what's on your clipboard.

Denied: accelerometer, autoplay, camera, clipboard-read, cross-origin-isolated, display-capture, encrypted-media, fullscreen, geolocation, gyroscope, keyboard-map, magnetometer, microphone, midi, payment, picture-in-picture, publickey-credentials-get, screen-wake-lock, sync-xhr, usb, web-share, xr-spatial-tracking.

Allowed: `clipboard-write=(self)` only.

### Strong Passphrase Requirements

Private keys are protected with enforced passphrase requirements:

- Minimum 12 characters
- Must include uppercase letter
- Must include lowercase letter
- Must include number
- Must include special character
- Passphrase confirmation required
- Warning system for weak passphrases (can be overridden if needed)

### Input Security

- Password fields use `type="password"` to hide input
- `autocomplete="off"` prevents browser password saving for sensitive fields
- No sensitive data stored in localStorage, sessionStorage, or cookies

### What this project does NOT claim

We are upfront about the limits of what a static web page can promise. **We do not claim "100% secure" or "no attack surface."** That's marketing, not engineering. A static page that handles cryptographic secrets has a real attack surface, and you should understand it before trusting it with anything that matters.

- **Your browser and OS are part of the trust boundary.** Same-origin JavaScript injected by a malicious browser extension can read secrets from the DOM and from memory. Web Crypto does not protect you from a compromised browser environment. Use a clean browser profile, or no extensions at all, for high-value operations.
- **The TLS path is part of the trust boundary.** When you load this page from `encryptalotta.com`, you are trusting Cloudflare's TLS and our DNS. If you want to eliminate that trust assumption, clone the repo, verify the SHA-384 hashes against the [Manifest](#manifest), and open `index.html` from disk — it works fully offline.
- **CSS-injected styling tricks are a thing.** A compromised stylesheet (we use inline styles only, but stylesheet injection at the proxy/extension layer is still possible) could in principle reveal user input via timing or `:has()` selectors. The strict CSP makes this hard, not impossible.
- **OpenPGP.js has had CVEs in the past.** Pinning the library to a specific version means we don't auto-pull upstream fixes. We commit to a manual update cadence (see below); please check that you're running the latest tagged release.
- **Cryptographic correctness depends on libraries written by other people.** OpenPGP.js, qrcode-generator, and secrets.js-grempe are all third-party dependencies. We trust them based on their audit history, code reviewability, and active maintenance — but that is a trust boundary, not an absence of one.
- **Steganography hides existence, not content.** Don't market it (or rely on it) as protection against state-level adversaries. Sophisticated steganalysis (chi-squared LSB tests, RS-analysis) detects LSB modification with high confidence. Encrypt the payload first; the stego layer is for casual concealment only.

If your threat model includes any of: a determined nation-state, a targeted attacker who controls your network or your endpoint, a browser-extension-level adversary, or "this must never leak under any circumstances" — use a desktop tool on an air-gapped machine. This project is for everyday client-side cryptography, not for protecting state secrets.

### Dependency update cadence

Vendored libraries are pinned by SHA-384 hash, so we don't auto-pull upstream fixes. To compensate:

- **Quarterly review** — at least once a quarter, check for new releases of OpenPGP.js, qrcode-generator, and secrets.js-grempe. Compare the diff against the pinned version, vendor the new minified file, update the SHA-384 hash in two places (HTML comment beside the `<script>` tag, and the [Manifest](#manifest) table above), and re-run `node scripts/audit-release.js`.
- **Immediate response on advisory** — if a CVE or security advisory is published for any vendored library, treat the bump as a P0: vendor the patch within 48 hours, push a release, and note the CVE in the commit message.
- **Pre-commit hash check** — `scripts/git-hooks/pre-commit` (a versioned hook in this repo) re-hashes every vendored library on every commit and refuses to land changes if the on-disk bytes don't match the recorded hashes. Install on a fresh clone with: `ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit`. The hook simply runs `scripts/audit-release.js`, which gates all 9 mechanically-checkable security invariants.
- **Automated quarterly reminder** — `.github/workflows/dep-check.yml` runs `scripts/check-dependency-updates.js` on the 1st of each quarter (Jan / Apr / Jul / Oct). The script reads the [Manifest](#manifest), queries each upstream's GitHub Releases API, and exits non-zero if any pinned version is behind upstream. The workflow then opens a tracking issue. The shipped site never makes a network call — this runs in GitHub Actions only. The reminder is informational; the actual vendoring + re-hashing remains manual (steps below).

---

## Navigation & UX

The interface is a **home grid + command palette**, designed to stay minimal on desktop and mobile alike:

- **Home (`#/`)** — a single screen showing every tool as a card grouped by category. The full list of tools is rendered in the DOM on first paint, so search engines see all of them.
- **Command palette (`⌘K` / `Ctrl+K`, or `/`)** — opens a centered modal with a fuzzy-search input. Type a few letters, use ↑/↓ to move, Enter to open, Esc to close. Mobile: tap the search box in the top bar.
- **Top bar** — logo (returns home), search box, language picker. That's it. No nested tabs, no hamburger.
- **Breadcrumb** — when inside a tool, a thin "← All tools" button + a "Group / Current tool" trail at the top of the page. One click back to home.
- **Deep links** — every tool still has its own URL (e.g. `#/keys/qr`, `#/utilities/exif`), so you can bookmark or share a specific tool.
- **Keyboard-first** — `⌘K`/`Ctrl+K` to search, arrow keys to navigate, Enter to open, Esc to close. No need for a mouse.
- **Last-used persistence** — `localStorage.lastTool` remembers which tool you were last on, so reopening the page returns you there (or to home on first visit).

## All Features at Your Fingertips

Tools are organized into four groups. Every tool has a deep-link route (e.g. `/#/keys/qr`, `/#/utilities/exif`).

### Keys
| Tool | Route | What it does |
|---|---|---|
| **Generate Keys** | `#/keys/generate` | Create new PGP key pairs (ECC Curve25519 or RSA) |
| **Key Info** | `#/keys/key-info` | Inspect any PGP key's details and fingerprint |
| **Revoke Key** | `#/keys/revoke` | Create revocation certificates for compromised keys |
| **QR Share** | `#/keys/qr` | Encode a public key or encrypted message into a QR (multi-QR for long inputs) |

### Encrypt / Decrypt
| Tool | Route | What it does |
|---|---|---|
| **Encrypt Files** | `#/crypt/encrypt` | Encrypt files using someone's public key |
| **Decrypt Files** | `#/crypt/decrypt` | Decrypt files using your private key |
| **Text Messages** | `#/crypt/text-crypto` | Encrypt/decrypt text for emails, chat, or notes |
| **Password Encrypt** | `#/crypt/password-encrypt` | Encrypt files with just a password (no keys needed) |
| **Steganography** | `#/crypt/stego` | Hide an encrypted message inside a PNG (LSB encoding) |

### Sign / Verify
| Tool | Route | What it does |
|---|---|---|
| **Sign** | `#/signing/sign` | Digitally sign messages or files to prove authorship |
| **Verify** | `#/signing/verify` | Verify signatures to confirm authenticity |

### Utilities
| Tool | Route | What it does |
|---|---|---|
| **Passwords** | `#/utilities/passwords` | Generate cryptographically secure passwords |
| **Armor** | `#/utilities/armor` | Convert between ASCII-armored and binary formats |
| **Shamir Split** | `#/utilities/shamir` | Split a secret into N shares; need K to reconstruct |
| **EXIF Eraser** | `#/utilities/exif` | Strip GPS / metadata from JPEG, PNG, WebP images |

---

## Per-Tool Security Notes

### QR Share
- Pure client-side QR rendering via vendored [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator). The canvas is drawn locally; the only blob URL produced is for the download anchor (not visible to `img-src`), so CSP is unchanged.
- For inputs over 1,200 bytes, the input is chunked into multi-QR sequences with the prefix `EAL-QR/v1/{n}/{total}/`. Capacity is enforced as 1,200 bytes × 16 chunks = 19,200 bytes maximum.
- Chunking uses UTF-8 byte length (`TextEncoder`) and split-codepoint-safe decoding (`TextDecoder({stream: true})`).

### Steganography
- **Threat model: casual concealment, not nation-state adversaries.** Sophisticated steganalysis (chi-squared LSB tests, RS-analysis) can detect LSB modification with high confidence. This tool is for situations where the *existence* of the data should not be obvious to a casual observer.
- **Always encrypt the payload first.** Use the Text Messages tab to produce a PGP block, then hide that block here. Steganography hides existence, not content.
- Format: 4-byte magic `EAL1` + 4-byte big-endian length + payload bytes encoded into LSBs of R/G/B channels (alpha untouched, transparency preserved).
- Optional password XORs the payload with a `SHA-256(password || counter_be32)` keystream. A wrong password produces a magic-byte mismatch in 99.9%+ of cases, surfacing a "no payload found" error rather than garbage output.
- **PNG only.** JPEG output is impossible — re-encoding would destroy the LSB data. Input format is enforced via `accept="image/png"`.

### Shamir Secret Sharing
- Built on the well-audited [secrets.js-grempe](https://github.com/grempe/secrets.js) library, initialized with a 256-bit security parameter.
- Share format: `EAL-SSS/v1/{K}-of-{N}/{rawShare}` so the threshold metadata is visible at-a-glance. The combine handler accepts shares with or without this prefix.
- **Each share leaks the length of the secret.** If length is sensitive, pad your secret to a fixed size before splitting.
- Shares are independent of each other — no single share (or any K−1 shares) reveals any information about the secret. Distribute them through separate channels.

### EXIF Eraser
- Pure canvas re-encode, no external library. Stripping is achieved by drawing the image to a `<canvas>` and calling `toBlob()` — the browser's image encoder produces a metadata-free output.
- Pre-strip detection (informational only) parses JPEG APP1 segments for IFD0 + GPS-IFD tag counts, and PNG `tEXt`/`iTXt`/`zTXt`/`eXIf` chunks. The strip happens regardless of the detection result.
- **Re-encoding recompresses the image.** For a JPEG with sensitive metadata that you want removed *without* recompression, use a desktop tool. Default quality is 92, adjustable 50–100.

---

## Technology

- Pure HTML, CSS, and JavaScript
- [OpenPGP.js](https://openpgpjs.org/) v5.11.1 for encryption (vendored locally)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) v1.4.4 for QR rendering (vendored locally)
- [secrets.js-grempe](https://github.com/grempe/secrets.js) v2.0.0 for Shamir Secret Sharing (vendored locally)
- Web Crypto API (`SubtleCrypto.digest`) for the steganography keystream
- No frameworks, no build process
- Single file deployment (plus three vendored libraries)

---

## Key Generation Options

| Option | Values | Notes |
|--------|--------|-------|
| **Algorithm** | ECC (Curve25519), RSA 3072, RSA 4096 | ECC recommended |
| **Expiration** | Never, 1, 2, or 5 years | Choose based on use case |
| **Passphrase** | User-defined | Strong requirements enforced |

---

## File Size Recommendations

| Size | Performance | Recommendation |
|------|-------------|----------------|
| Under 100MB | Optimal | Recommended |
| 100MB - 500MB | May be slow | Use with patience |
| Over 500MB | Risk of browser crashes | Split files first |
| Over 1GB | Not recommended | Use desktop PGP tools |

---

## Comparison with Other Tools

| Feature | Encryptalotta | Web-based PGP Tools | Desktop PGP |
|---------|---------------|---------------------|-------------|
| No server uploads | Yes | Often No | Yes |
| No CDN dependencies | Yes | Usually No | Yes |
| Works offline | Yes | Usually No | Yes |
| No installation | Yes | Yes | No |
| Open source | Yes | Varies | Usually Yes |
| Modern ECC default | Yes | Varies | Varies |
| Enforced CSP | Yes | Rarely | N/A |
| Digital signatures | Yes | Sometimes | Yes |
| Password encryption | Yes | Rarely | Yes |
| Key info viewer | Yes | Rarely | Yes |
| Password generator | Yes | Rarely | Sometimes |

---

## Development

This is a single-file application. Simply open `index.html` in a web browser or deploy to any static hosting service.

### Local Development

```bash
git clone https://github.com/clay-good/encryptalotta.git
cd encryptalotta
# Open index.html in your browser - that's it!
```

### Pre-release ritual (before merging to main)

```bash
# Regenerate /fr/, /zh/, /de/, /hi/ from the source STRINGS table.
node scripts/build-i18n-variants.js

# Run all 9 mechanical security/quality gates. Exits non-zero on first failure.
node scripts/audit-release.js
```

The audit checks: zero `innerHTML =` assignments, STRINGS parity across all 5 locales, every `data-i18n` key resolves, vendored SHA-384 hashes match across HTML comments + the README manifest + on-disk bytes, CSP `connect-src 'none'` on both meta and `_headers`, no outbound network call sites, page weight under 2 MB gzipped, and locale variants in sync with source.

### Pre-commit hook (recommended)

Install the versioned hook on a fresh clone so `audit-release.js` runs on every commit:

```bash
ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

### Verifying Integrity

To verify that the vendored libraries haven't been tampered with, run:

```bash
openssl dgst -sha384 -binary openpgp.min.js  | openssl base64 -A
# Mlq9yV9fsqU41CJA7E1LEbuJQx9REDo5S+jqu1+nyQebPFEY2jBD2PHKvhWPYNyT

openssl dgst -sha384 -binary qrcode.min.js   | openssl base64 -A
# lQXOAyZwHXE55JFyrOMB7nY2Wv+m5ZWNtJcHrd1rceRQXAYNLak8ukN5TjBTcIwz

openssl dgst -sha384 -binary secrets.min.js  | openssl base64 -A
# xfBMbh8fdSIrQ9XbZARwZ5z/Eh9zC7gsgG5vSE331lZSjgXQob1KxM4m7vEdH0e0
```

Or all at once:

```bash
for f in openpgp.min.js qrcode.min.js secrets.min.js; do
    printf '%-22s %s\n' "$f" "$(openssl dgst -sha384 -binary "$f" | openssl base64 -A)"
done
```

Compare each output against the [Manifest](#manifest) above.

---

## Deployment

### Any Static Host

1. Clone the repository
2. Deploy the entire directory to your static hosting provider
3. Ensure all files are served with proper MIME types

### Cloudflare Pages (Recommended)

This site is optimized for Cloudflare Pages deployment with automatic security headers:

1. Fork or clone this repository
2. Connect to Cloudflare Pages
3. Deploy - no build command needed (static HTML)
4. Security headers from `_headers` file are automatically applied

---

## Files

| File / dir | Purpose |
|------|---------|
| `index.html` | Main application (single-file, self-contained, includes all UI + i18n strings + tool logic) |
| `openpgp.min.js` | Vendored OpenPGP.js (key generation, encryption, decryption, signatures) |
| `qrcode.min.js` | Vendored qrcode-generator (QR Share tool) |
| `secrets.min.js` | Vendored secrets.js-grempe (Shamir Secret Sharing tool) |
| `SPEC.md` | Roadmap for the next release wave (new tools, SEO, dep-pinning) |
| `_headers` | HTTP security headers for Cloudflare Pages |
| `favicon.ico`, `favicon-*.png` | Browser tab icons |
| `apple-touch-icon.png` | iOS home screen icon |
| `encryptalotta.png` | Logo / OpenGraph image |
| `site.webmanifest` | Web app manifest |
| `robots.txt`, `sitemap.xml` | Search engine directives |
| `fr/`, `zh/`, `de/`, `hi/` | Pre-rendered SEO variants (built by `scripts/build-i18n-variants.js`) |
| `i18n/strings.csv` | Reviewer-facing CSV exported from `STRINGS` (built by `scripts/export-strings-csv.js`) |
| `scripts/build-i18n-variants.js` | Emits localized static HTML for each non-en locale |
| `scripts/export-strings-csv.js` / `import-strings-csv.js` | CSV round-trip for native-speaker review |
| `scripts/audit-release.js` | Release-gate audit: 9 mechanical security/quality checks |
| `scripts/git-hooks/pre-commit` | Versioned pre-commit hook running `audit-release.js` |

---

## Important Security Notes

**Key Backup:** If you lose your private key, you cannot decrypt your files. Ever. There is no recovery mechanism.

**Key Security:** Never share your private key with anyone. Your public key is safe to share.

**Browser Security:** This tool is only as secure as your browser environment. Use an updated browser on a trusted device.

**Passphrase Strength:** Use a strong, unique passphrase. The built-in password generator can help create secure passphrases.

**Revocation Certificates:** Generate and securely store a revocation certificate immediately after creating a new key pair. This allows you to invalidate the key if it's ever compromised.

**Password Encryption:** When using password-only encryption, choose a strong password. There is no recovery mechanism if you forget the password.

**Signature Verification:** Always verify the public key fingerprint through a trusted channel before trusting signatures from that key.

**Offline Use:** For maximum security, download the repository and use it offline on an air-gapped machine.

---

## Security Audit

This application is open source specifically so security researchers can audit it. Key areas to review:

- `index.html` - All application logic (CSP meta tags, JavaScript cryptographic calls, memory clearing, i18n, all 15 tools)
- `_headers` - HTTP security headers
- `openpgp.min.js` - Compare against official OpenPGP.js v5.11.1 release
- `qrcode.min.js` - Compare against official qrcode-generator v1.4.4 release
- `secrets.min.js` - Compare against official secrets.js-grempe v2.0.0 release
- [Manifest](#manifest) section above — SHA-384 manifest for all vendored libraries

A grep-friendly audit invariant: the codebase has **zero `innerHTML =` assignments**. All DOM construction goes through `createElement` / `textContent` / `setAttribute`, eliminating the most common XSS vector even when content is fully controlled by the developer.

Found a vulnerability? Please report it via [GitHub Issues](https://github.com/clay-good/encryptalotta/issues) or contact the maintainer directly.

