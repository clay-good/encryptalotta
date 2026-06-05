# encryptalotta

![encryptalotta — 45 client-side privacy and developer tools, zero server uploads](encryptalotta.png)

**Free, client-side privacy and developer toolbox — 45 tools, zero server uploads.**

A comprehensive single-page web app with **45 cryptographic, encoding, parsing, and developer utilities** that run entirely in your browser. PGP key generation, key inspection, revocation certificates, QR public-key sharing, TLS / X.509 certificate parsing, OpenSSH public key parsing, PEM ↔ DER conversion, BIP39 mnemonic generation and validation, file and text encryption / decryption, password-only (symmetric) file encryption, image steganography, digital signing and verification, HMAC, JWT inspection and verification, PBKDF2 key derivation, TOTP / 2FA, password generation, ASCII armor conversion, Shamir's Secret Sharing, EXIF metadata stripping, hashing and checksums (SHA-1 / 256 / 384 / 512), Base64 / Base32 / Base58 / hex encoding, number base conversion (binary / octal / decimal / hex / any base 2–36), UUID v4 / v7 and ULID generation, Unix timestamp conversion, URL parsing, line-level diff, CSV ↔ JSON ↔ TSV conversion, regex testing, cron decoding, color conversion with WCAG contrast checking, JSON / YAML / XML formatting, and CIDR / IPv4 subnet calculation. Searchable command palette (`⌘K` / `Ctrl+K`), full keyboard navigation, five UI languages. No server uploads, no analytics, no CDN, no tracking.

**Inspired by [Kevin Qiu](https://www.linkedin.com/in/kevinmqiu)**


---

## Features (45 tools)

### Keys (8 tools)
- **Generate PGP Keys** — Create ECC (Curve25519) or RSA 3072 / 4096 key pairs with customizable expiry. Optional **regulator presets** (BSI TR-02102-1, ANSSI RGS B1, NIST SP 800-57, CNSA 2.0, Privacy Guides) auto-fill the algorithm + key size from each regulator's published recommendation and link out to the source document.
- **Key Info** — Inspect any PGP public key: fingerprint, user IDs, algorithm, key size, creation and expiration dates.
- **Revocation Certificate** — Generate a pre-signed certificate to retire a compromised key.
- **QR Share** — Encode a PGP public key or encrypted message as one or more scannable QR codes (multi-QR `EAL-QR/v1/{n}/{total}/` for long inputs).
- **TLS Certificate Parser** — Hand-rolled ASN.1 / DER decoder for X.509 certificates: subject, issuer, SAN, validity, public key algorithm, SHA-1 + SHA-256 fingerprints.
- **SSH Key Parser** — OpenSSH RFC 4253 wire-format parser: key type (rsa / ed25519 / ecdsa-sha2-nistp{256,384,521}), bit size, `SHA256:<base64>` fingerprint, comment.
- **PEM ↔ DER** — Round-trip between PEM (Base64 with header/footer) and DER (raw binary as hex).
- **BIP39 Mnemonic** — Generate cryptographically random 12 / 15 / 18 / 21 / 24-word seed phrases (BIP-0039) or validate the checksum of any existing mnemonic. Computes the BIP39 PBKDF2-HMAC-SHA512 seed locally with optional passphrase.

### Encrypt / Decrypt (5 tools)
- **Encrypt Files** — Encrypt files with one or more PGP public keys.
- **Decrypt Files** — Decrypt PGP-encrypted files with your private key and passphrase.
- **Text Messages** — Encrypt or decrypt PGP text blocks for email, chat, or notes.
- **Password Encrypt** — Encrypt a file with a passphrase only (symmetric, no PGP key required).
- **Steganography** — Hide an encrypted payload inside a PNG using LSB encoding. Optional password XORs the payload (wrong password fails magic-byte validation, no garbage output).

### Sign / Verify (4 tools)
- **Sign** — Produce detached, attached, or cleartext PGP signatures for files or text using your private key.
- **Verify** — Verify any PGP signature against a public key.
- **HMAC** — Sign and verify with HMAC-SHA-1 / 256 / 384 / 512. Constant-time comparison on verify; key buffer zeroized after use.
- **JWT Inspector** — Decode the three Base64-URL parts; verify HS256/384/512 (shared secret), RS256/384/512 (PEM SPKI public key), or ES256/384/512 (PEM SPKI ECDSA key). Expiry indicator from the `exp` claim.

### Utilities (28 tools)
- **Strong Password Generator** — Cryptographically random passwords with customizable charset and length.
- **ASCII Armor Converter** — Round-trip between PGP binary and ASCII-armored encodings.
- **Shamir Secret Sharing** — Split a secret into N shares where any K reconstruct it; share format `EAL-SSS/v1/{K}-of-{N}/{rawShare}`.
- **EXIF Eraser** — Strip GPS, camera serial numbers, timestamps from JPEG / PNG / WebP via canvas re-encode.
- **Hash & Checksum** — SHA-1 / 256 / 384 / 512 (Web Crypto) and BLAKE2b-512 (RFC 7693, hand-rolled) over text or files, with constant-time hash comparison.
- **Base64 / 32 / 58 / Hex Encoder** — Cross-convert text ↔ hex ↔ Base64 (standard + URL-safe) ↔ Base32 ↔ Base58 (Bitcoin alphabet).
- **UUID / ULID Generator** — UUID v4 (random), UUID v7 (RFC 9562 time-ordered), ULID. Bulk generate up to 1000 per click.
- **Unix Timestamp Converter** — Auto-detect epoch seconds / milliseconds / ISO 8601; render in UTC, local, and relative ("5 minutes ago").
- **URL Parser** — Parse via the built-in `URL` API; surface protocol/host/port/path/search/hash/origin and a query-parameter table. Percent-encode and decode utilities.
- **TOTP / 2FA** — RFC 6238 generator; accepts `otpauth://totp/...` URIs or bare Base32 secrets. SHA-1/256/512, configurable digits (6–10) and period (15–120). Secret zeroed on Stop.
- **Diff** — Line-level LCS comparison with optional ignore-whitespace and ignore-case toggles.
- **CSV ↔ JSON ↔ TSV** — RFC 4180-style parser (quoted fields, escaped `""`, CRLF/LF). Auto-detect delimiter, "first row is header" toggle.
- **Regex Tester** — Live match highlighting, numbered + named capture groups, replacement preview. Built with `createElement` / `textContent` (no `innerHTML`).
- **Cron Decoder** — Parse 5-field cron (`*`, `*/n`, ranges, lists, named months/dows); show description and next 5 fire times in local timezone.
- **Color Converter** — HEX ↔ RGB ↔ HSL ↔ OKLCH (hand-rolled Oklab matrices). WCAG AA / AAA contrast checker with live preview swatch.
- **JSON / YAML / XML Formatter** — Pretty-print, minify, and cross-convert JSON ↔ YAML; pretty-print or minify XML standalone. Auto-detect input format. (TOML omitted — no small browser-ready parser exists without a build step.)
- **CIDR / Subnet Calculator** — IPv4 only; pure 32-bit unsigned arithmetic. Network, broadcast, netmask (with binary view), wildcard, first/last usable host, total + usable counts, address class, RFC 1918 / loopback / link-local tags. Handles `/0`, `/31` (RFC 3021), and `/32` correctly.
- **PBKDF2 Key Derivation** — RFC 8018 password-based key derivation via Web Crypto. Configurable iterations (1–10,000,000), salt (text or hex), key length (1–512 bytes), and PRF (SHA-1 / 256 / 384 / 512). Reports wall-clock derivation time so you can size iteration counts to a target cost.
- **Number Base Converter** — Convert integers between binary, octal, decimal, hexadecimal, and any base 2–36 simultaneously. Auto-detects `0x` / `0b` / `0o` prefixes; uses BigInt internally so values aren't capped at 53-bit JS Number precision; preserves negatives sign-and-magnitude.
- **IBAN Validator / Generator** — ISO 13616 MOD-97 checksum and per-country structure for ~80 IBAN jurisdictions. Splits out bank / branch / account where the registry defines them. Generator side produces a syntactically valid test IBAN (`crypto.getRandomValues` BBAN, computed check digits) for fixtures and integration tests — clearly labeled "test data only."
- **BIC / SWIFT Code Checker** — ISO 9362 format check for 8- and 11-character BICs. Decodes bank / country / location / branch, cross-checks the country segment against the IBAN country table, flags test BICs (trailing `0`), passive participants (trailing `1`), and primary branches (`XXX`).
- **GS1 / EAN / GTIN Barcode** — Mod-10 weighted checksum for EAN-8, UPC-A, EAN-13 / GTIN-13, ITF-14 / GTIN-14, and SSCC. Looks up the issuing region from an inline GS1 prefix registry (~130 ranges covering every assigned prefix).
- **EU VAT Number Validator** — Format check for all 27 EU member states + GB, NO, CH, XI (Northern Ireland). Computes the published checksum where one exists (ISO 7064 MOD 11,10 for DE/HR; Luhn for IT/SE; mod-97 for BE; mod-89 for LU; mod-11 weighted for many others). ES support is limited to the CIF (corporate) subset by design; individual NIF/NIE inputs are explicitly rejected with a pointer to the spec. No VIES round-trip — fully offline.
- **Ed25519 Sign / Verify** — Generate Ed25519 keypairs and produce or verify signatures via native Web Crypto (RFC 8032). Keys round-trip as the 32-byte seed; signatures as 64-byte hex. Same primitive used by SSH ed25519 keys, age, Signal, Noise, and sigstore. Detects lack of browser support (needs Safari 17 / Chrome 113 / Firefox 130) and shows an explicit banner rather than failing silently.
- **X25519 Key Agreement** — Generate X25519 keypairs and derive a shared secret (ECDH, RFC 7748) via native Web Crypto, with optional HKDF-SHA-256 / HKDF-SHA-512 post-processing and a user-supplied "info" context. Underlies WireGuard, age, Signal, Noise, X3DH, TLS 1.3.
- **PEPPOL / UBL Invoice Inspector** — Decode OASIS UBL 2.1 `<Invoice>` and `<CreditNote>` documents (PEPPOL BIS Billing 3.0, EN 16931) entirely in the browser. Renders the header (customization / profile / invoice number / dates / currency), supplier and customer, totals (sum of line amounts, tax-exclusive, tax-inclusive, payable), line items (quantity, unit price, line amount), and per-rate VAT breakdown. Beyond rendering it runs **100+ EN 16931 / PEPPOL conformance gates** — mandatory-field presence (BR-*), arithmetic invariants (BR-CO-10 line totals, BR-CO-13/15 tax consistency, BR-CO-14 VAT-breakdown sum, BR-CO-17 per-rate cross-product, BR-CO-16 payable reconciliation), 2-decimal caps (BR-DEC), code-list membership (UNCL 1001 / 4461, ISO 4217, PEPPOL EAS), and IBAN MOD-97 — each catching documents that are XML-valid but rail-rejected by an access point. Namespace-blind `DOMParser` walk — same code handles every minor UBL 2.1 revision. Factur-X / ZUGFeRD hybrid PDF and UN/CEFACT CII variant are a later slice that shares the §2.5 PDF attachment extractor.
- **SEPA ISO 20022 XML Inspector** — Decode `pain.001` (credit-transfer initiation), `pain.008` (direct-debit initiation), and `camt.053` (bank-to-customer statement) entirely in the browser. Surfaces the group header, per-payment-info blocks, and per-transaction detail, then runs **110+ EPC SEPA Rulebook conformance gates**: IBAN MOD-97 + per-country structure, BIC ISO 9362 format and IBAN↔BIC country parity, EPC character-set restrictions across every free-text field, Rulebook length caps (AdrLine 70 / TwnNm 35 / PstCd 16), mandatory-element presence down to the per-transaction `FinInstnId` routing identifier, EUR-only currency, `NbOfTxs` / `CtrlSum` arithmetic invariants, strictly-positive amounts and the €999,999,999.99 per-instruction amount cap, and EndToEndId uniqueness — each catching files that pass XSD validation but get bounced by EBA STEP2 / STET / RT1. Namespace-blind walk; no-ops cleanly on message types a given gate does not apply to.
- **eIDAS Trust List (LOTL / TSL) Viewer** — Parse an EU List of Trusted Lists or a national Trusted Service List (ETSI TS 119 612) and browse per-country trust service providers, their services, and current status (granted / withdrawn / supervision-in-cessation), entirely offline. Paste the XML; no network round-trip to the LOTL endpoint.

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
- **Works Offline** - Download and use without internet connection. A minimal service worker (`sw.js`) precaches the shell on first visit so subsequent loads work offline straight from the cache.

---

## Architecture & data flow

The whole application is one HTML file plus four vendored libraries. There is no server, no API, no build step at deploy time, and — enforced by CSP — no outbound network call. Every byte you type is processed in the page's own JavaScript heap and never crosses the trust boundary.

### Trust boundary

```
            YOUR DEVICE  (the entire trust boundary)
  ┌─────────────────────────────────────────────────────────────┐
  │  Browser tab                                                  │
  │  ┌───────────────────────────────────────────────────────┐   │
  │  │  index.html  (one origin, one document)               │   │
  │  │                                                        │   │
  │  │   user input ─▶ tool logic ─▶ Web Crypto / vendored   │   │
  │  │      ▲              │            libs (local)          │   │
  │  │      │              ▼                                   │   │
  │  │   keyboard      rendered output (createElement /       │   │
  │  │   / paste /     textContent — never innerHTML)         │   │
  │  │   file picker                                          │   │
  │  │                                                        │   │
  │  │   localStorage: theme, language, lastTool ONLY         │   │
  │  │   (never keys, secrets, plaintext, or inputs)          │   │
  │  └───────────────────────────────────────────────────────┘   │
  │        ╳  connect-src 'none'  ╳   form-action 'self'          │
  │        ╳  no fetch / XHR / WebSocket / EventSource / Beacon   │
  └─────────────────────────────────────────────────────────────┘
            ╳  NOTHING crosses this line at runtime  ╳
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
            network  (used once to load the page, then never again)
```

The only time the network is touched is the initial GET that loads the page and its four scripts; after that the service worker serves the shell from cache and `connect-src 'none'` makes a runtime exfiltration call physically impossible. Load it once, pull your network cable, and every tool still works.

### Module map

```
index.html
├─ <meta CSP>            connect-src 'none'; frame-ancestors 'none'; …
├─ inline <style>        CSS logical properties (RTL-ready), no external sheet
├─ STRINGS {}            1,724 keys × 5 locales — i18n table, vendored inline
├─ tool registry         45 tools → {id, group, route, render()}
│    ├─ Keys (8)         OpenPGP.js · hand-rolled ASN.1/DER · SSH wire format
│    ├─ Encrypt (5)      OpenPGP.js · LSB stego (Web Crypto keystream)
│    ├─ Sign (4)         OpenPGP.js · Web Crypto HMAC / JWT verify
│    └─ Utilities (28)   Web Crypto · BigInt · hand-rolled codecs/parsers
│                        + IBAN/BIC/VAT/GS1, SEPA & UBL conformance engines
├─ router               hashchange → render(route); deep-linkable #/group/tool
└─ clearSensitiveFields()  beforeunload → wipe every secret-bearing field
   vendored: openpgp.min.js · qrcode.js · secrets.min.js · js-yaml.min.js
             (each pinned by SHA-384, cross-checked on every commit)
```

### Request lifecycle of a single operation (e.g. "encrypt text")

```
 paste plaintext + public key
        │
        ▼
 render() reads DOM values  ──▶  openpgp.encrypt({message, encryptionKeys})
        │                              │  (runs in this tab's JS heap)
        │                              ▼
        │                       armored ciphertext (string)
        ▼                              │
 textContent = ciphertext  ◀───────────┘
        │
        ▼
 beforeunload ─▶ clearSensitiveFields() zeroizes the plaintext + key inputs
```

No step in that chain has a network egress point — there is nowhere for the plaintext or key to go except back into the same DOM.

## Security Architecture

Encryptalotta was designed from the ground up with security as the primary concern. This application implements defense-in-depth with multiple layers of protection.

### Zero Network Communication

**Your data never leaves your device.** This isn't just a promise - it's cryptographically enforced:

- **Content Security Policy (CSP)** with `connect-src 'none'` - The browser physically cannot make outbound network requests
- **No external API calls** - All cryptographic operations happen locally
- **No analytics or tracking** - Zero telemetry of any kind
- **Works completely offline** - Download and use without any internet connection

### Modern Cryptography

Built on [OpenPGP.js](https://openpgpjs.org/) v6.3.0, a well-audited cryptographic library:

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
| `openpgp.min.js` | OpenPGP.js | 6.3.0 | LGPL-3.0 | <https://github.com/openpgpjs/openpgpjs> | `Z5tStPoeClmuLPd1gAwdTCU53WcAkUjBNw7mEEvrQumVuNqEl52A9Nx5IhFdKE/c` |
| `qrcode.js` | qrcode-generator | 2.0.4 | MIT | <https://github.com/kazuhikoarase/qrcode-generator> | `e9EFD6BGC90bkW9aDV5xbbBfzwN7G8YImHao2lfLVKV/hPB0E0go+H3I64h7oHtA` |
| `secrets.min.js` | secrets.js-grempe | 2.0.0 | MIT | <https://github.com/grempe/secrets.js> | `xfBMbh8fdSIrQ9XbZARwZ5z/Eh9zC7gsgG5vSE331lZSjgXQob1KxM4m7vEdH0e0` |
| `js-yaml.min.js` | js-yaml | 4.1.1 | MIT | <https://github.com/nodeca/js-yaml> | `ZeqCzuWczURac3RacSufGD7oSbzeaX7xxnnOr3PTcYTLx4Av0qBj0kBq7AeCtHLA` |

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
        integrity="sha384-Z5tStPoeClmuLPd1gAwdTCU53WcAkUjBNw7mEEvrQumVuNqEl52A9Nx5IhFdKE/c"
        crossorigin="anonymous"></script>
```

#### Other supply-chain protections

- **Single-file application** - No complex dependency chains that could be compromised
- **No build tools** - What you see in the repository is exactly what runs in your browser
- **Translations vendored statically** - Inline `STRINGS` object, no JSON fetch, CSP `connect-src 'none'` unchanged

This eliminates entire categories of supply chain attacks that have affected other security tools.

### Memory Security

Sensitive data is cleared from memory after use:

- **Automatic passphrase clearing** — Passphrase fields are wiped after decryption operations.
- **Page unload protection** — On `beforeunload`, `clearSensitiveFields()` wipes every passphrase, private-key, shared-secret, BIP39 mnemonic, and PBKDF2 password input across all 45 tools, plus the readonly output panes that render decrypted plaintext, derived keys, BIP39 seeds, Shamir secrets, and steganographic payloads. Public keys, signed messages, and signature-verification statuses are left alone (they aren't secrets and clearing them would erase audit context).
- **JavaScript variable clearing** — Sensitive `Uint8Array` buffers (PBKDF2 password bytes, generated PGP private keys) are zeroized via `.fill(0)` / `secureWipe()` after use. (Note: this is best-effort — JS engines may have already retained internal copies for GC, and `String` values are immutable so we cannot overwrite them in place.)

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

- **Quarterly review** — at least once a quarter, check for new releases of OpenPGP.js, qrcode-generator, secrets.js-grempe, and js-yaml. Compare the diff against the pinned version, vendor the new minified file, update the SHA-384 hash in two places (HTML comment beside the `<script>` tag, and the [Manifest](#manifest) table above), and re-run `node scripts/audit-release.js`.
- **Immediate response on advisory** — if a CVE or security advisory is published for any vendored library, treat the bump as a P0: vendor the patch within 48 hours, push a release, and note the CVE in the commit message.
- **Pre-commit hash check** — `scripts/git-hooks/pre-commit` (a versioned hook in this repo) re-hashes every vendored library on every commit and refuses to land changes if the on-disk bytes don't match the recorded hashes. Install on a fresh clone with: `ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit`. The hook simply runs `scripts/audit-release.js`, which gates all 14 mechanically-checkable invariants (innerHTML hygiene, STRINGS parity, i18n key resolution, vendored SHA-384 cross-check, CSP integrity, no outbound vectors, page weight, locale-variant sync, robots.txt + sitemap.xml + JSON-LD presence, and Phase-7 SEO prose key coverage).
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

All 45 tools are organized into four groups. Every tool has a deep-link route.

### Keys (8)
| Tool | Route | What it does |
|---|---|---|
| **Generate Keys** | `#/keys/generate` | Create new PGP key pairs (ECC Curve25519 or RSA 3072 / 4096) |
| **Key Info** | `#/keys/key-info` | Inspect any PGP key's fingerprint, user ID, algorithm, expiry |
| **Revoke Key** | `#/keys/revoke` | Create a revocation certificate for a compromised key |
| **QR Share** | `#/keys/qr` | Encode a public key or message into a QR (multi-QR for long inputs) |
| **TLS Certificate Parser** | `#/keys/tls-cert` | Decode an X.509 cert: subject, SAN, validity, fingerprint |
| **SSH Key Parser** | `#/keys/ssh-key` | Inspect an OpenSSH public key: type, bits, SHA-256 fingerprint |
| **PEM ↔ DER** | `#/keys/pem-der` | Convert between PEM (Base64) and DER (binary) encodings |
| **BIP39 Mnemonic** | `#/keys/bip39` | Generate or validate BIP-0039 mnemonic seed phrases (12 / 15 / 18 / 21 / 24 words) |

### Encrypt / Decrypt (5)
| Tool | Route | What it does |
|---|---|---|
| **Encrypt Files** | `#/crypt/encrypt` | Encrypt files with one or more PGP public keys |
| **Decrypt Files** | `#/crypt/decrypt` | Decrypt files with your private key + passphrase |
| **Text Messages** | `#/crypt/text-crypto` | Encrypt / decrypt PGP text for email, chat, or notes |
| **Password Encrypt** | `#/crypt/password-encrypt` | Encrypt a file with a passphrase only (no PGP key needed) |
| **Steganography** | `#/crypt/stego` | Hide a payload inside a PNG using LSB encoding |

### Sign / Verify (4)
| Tool | Route | What it does |
|---|---|---|
| **Sign** | `#/signing/sign` | Digitally sign messages or files (detached, attached, cleartext) |
| **Verify** | `#/signing/verify` | Verify a PGP signature against a public key |
| **HMAC** | `#/signing/hmac` | HMAC-SHA-1/256/384/512 sign and verify (constant-time compare) |
| **JWT Inspector** | `#/signing/jwt` | Decode + verify HS / RS / ES JWTs; surface `exp` claim |

### Utilities (28)
| Tool | Route | What it does |
|---|---|---|
| **Passwords** | `#/utilities/passwords` | Generate cryptographically strong random passwords |
| **Armor** | `#/utilities/armor` | Convert between PGP binary and ASCII-armored encodings |
| **Shamir Split** | `#/utilities/shamir` | Split a secret into N shares; any K reconstruct |
| **EXIF Eraser** | `#/utilities/exif` | Strip GPS / metadata from JPEG, PNG, WebP images |
| **Hash & Checksum** | `#/utilities/hash` | SHA-1/256/384/512 with constant-time compare |
| **Encode** | `#/utilities/encode` | Cross-convert Base64 / Base32 / Base58 / Hex / text |
| **UUID / ULID** | `#/utilities/uuid` | Bulk-generate UUID v4, UUID v7, or ULID |
| **Unix Timestamp** | `#/utilities/timestamp` | Convert epoch ↔ ISO 8601 ↔ UTC ↔ local ↔ relative |
| **URL Parser** | `#/utilities/url` | Parse + percent-encode / decode URLs and queries |
| **TOTP / 2FA** | `#/utilities/totp` | RFC 6238 code generator (otpauth:// URI or bare secret) |
| **Diff** | `#/utilities/diff` | Line-level LCS diff with whitespace / case toggles |
| **CSV / JSON / TSV** | `#/utilities/csv` | Convert tabular data with RFC 4180 quoting |
| **Regex Tester** | `#/utilities/regex` | Live match highlight + capture groups + replace |
| **Cron Decoder** | `#/utilities/cron` | Decode cron expression + show next 5 run times |
| **Color Converter** | `#/utilities/color` | HEX / RGB / HSL / OKLCH + WCAG contrast checker |
| **Format / Convert** | `#/utilities/format` | Pretty / minify / convert JSON, YAML, and XML |
| **CIDR / Subnet** | `#/utilities/cidr` | Decode IPv4 CIDR: network, broadcast, host range, tags |
| **PBKDF2** | `#/utilities/pbkdf2` | Derive a key from a password (configurable iterations, salt, PRF) |
| **Number Base** | `#/utilities/base` | Convert integers between binary, octal, decimal, hex, any base 2–36 |
| **IBAN** | `#/utilities/iban` | ISO 13616 MOD-97 validator + test-data generator (per-country structure) |
| **BIC / SWIFT** | `#/utilities/bic` | ISO 9362 format check + bank / country / location / branch decoder |
| **GS1 Barcode** | `#/utilities/gs1` | Mod-10 checksum for EAN-8/-13, UPC-A, GTIN-14, SSCC + GS1 prefix lookup |
| **EU VAT** | `#/utilities/vat` | Format + checksum check for EU / GB / NO / CH / XI VAT numbers (offline) |
| **Ed25519** | `#/utilities/ed25519` | Generate / sign / verify with native Ed25519 (RFC 8032) via Web Crypto |
| **X25519** | `#/utilities/x25519` | ECDH key agreement (RFC 7748) with optional HKDF-SHA-256 / SHA-512 |
| **PEPPOL Invoice** | `#/utilities/ubl` | OASIS UBL 2.1 Invoice / CreditNote (PEPPOL BIS Billing 3.0, EN 16931) inspector + 100+ conformance gates |
| **SEPA XML** | `#/utilities/sepa` | ISO 20022 `pain.001` / `pain.008` / `camt.053` inspector + 110+ EPC Rulebook conformance gates |
| **eIDAS Trust List** | `#/utilities/lotl` | ETSI TS 119 612 LOTL / TSL viewer — per-country trust service providers, services, status |

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

### BIP39 Mnemonic
- **A BIP39 mnemonic is a wallet master key.** Anyone holding the words can derive every private key in every account derived from it, on every chain. Treat the words like cash, not like an email password.
- Entropy is generated locally via `crypto.getRandomValues` (the browser's Web Crypto CSPRNG). The official BIP-0039 English wordlist (2048 words) is vendored inline; no network fetch.
- The seed is computed via `PBKDF2-HMAC-SHA512(mnemonic, "mnemonic" + passphrase, 2048 iterations, 64 bytes)` per the BIP39 spec, using Web Crypto.
- The mnemonic textarea and passphrase field are both included in `clearSensitiveFields()` and wiped on page unload — but a tab snapshot, browser extension, or screen-recording could capture them in the meantime. **For high-value wallets, generate the mnemonic on an air-gapped machine.**
- Validation is offline-only (checksum + seed derivation). It does not check whether the mnemonic controls funds on any chain.

### PBKDF2 Key Derivation
- Web Crypto's `SubtleCrypto.deriveBits` runs the PBKDF2 loop locally; the password buffer is zeroized after the derive call.
- Iteration count and PRF choice directly govern brute-force cost. **OWASP 2023 guidance**: ≥600,000 iterations for PBKDF2-HMAC-SHA-256, ≥1,300,000 for SHA-1. The default 100,000 is conservative for *test vectors*, not for protecting a real password — bump it before shipping a derived key into production storage.
- Optional **regulator presets** (BSI TR-02102-1, ANSSI RGS B1, NIST SP 800-132 / OWASP minimum, Privacy Guides) auto-fill `iterations` + PRF from each authority's published recommendation and link out to the source document. Manually editing iterations or PRF resets the dropdown to "Custom" so the UI never claims a regulator's recommendation when the user has diverged from it.
- Output length is capped at 512 bytes to avoid pathological inputs; that's well above any standard symmetric-key size.
- **PBKDF2 is not the strongest password KDF.** For new designs, prefer Argon2id (memory-hard) where the runtime allows it. PBKDF2 is included here because it is the lowest-common-denominator that ships with Web Crypto and matches RFC 8018, the JWE/PKCS#5 ecosystem, and most existing test vectors.

### Number Base Converter
- Pure JavaScript BigInt — no library — so values aren't capped at 53-bit JS Number precision and there's no `Number.MAX_SAFE_INTEGER` corner case.
- Negatives are stored sign-and-magnitude: `-0xff` → `-255` decimal → `-11111111` binary. Two's-complement views are not produced; if you need them for a fixed-width register, mask explicitly with the appropriate `2^n - 1`.
- Underscores in input are stripped as digit-grouping separators (matches Python / Rust literals). Leading `0x` / `0b` / `0o` are recognized when "Auto" is selected.

---

## Technology

- Pure HTML, CSS, and JavaScript — no frameworks, no build step at deploy time.
- [OpenPGP.js](https://openpgpjs.org/) v6.3.0 — PGP key generation, encryption, decryption, signatures (vendored locally).
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) v2.0.4 — QR rendering for the QR Share tool (vendored locally).
- [secrets.js-grempe](https://github.com/grempe/secrets.js) v2.0.0 — Shamir's Secret Sharing math (vendored locally).
- [js-yaml](https://github.com/nodeca/js-yaml) v4.1.1 — YAML parsing and emitting for the Format / Convert tool (vendored locally).
- **Web Crypto API** (`SubtleCrypto.digest` / `sign` / `verify` / `importKey`) — hashing, HMAC, JWT verification, TOTP, steganography keystream, certificate fingerprints.
- **Hand-rolled, no library**: ASN.1 / DER decoding (TLS Certificate Parser), OpenSSH wire format (SSH Key Parser), Base32 / Base58 codecs, OKLCH colour matrices, cron parser, CIDR arithmetic, line-level LCS diff, RFC 4180 CSV parser, regex highlighting, percent-encoding helpers — kept hand-rolled rather than vendored to keep total page weight under 0.32 MB gzipped.
- **Single-file deployment** (`index.html`) plus four vendored libraries — every script pinned with a SHA-384 hash that is cross-checked against the README manifest and the on-disk bytes by `scripts/audit-release.js` on every commit.

---

## Standards & RFCs implemented (cheat sheet)

Every tool maps to a published standard so its output is checkable against an authoritative source. No proprietary formats.

| Domain | Standard / RFC | Tool(s) |
|---|---|---|
| PGP / OpenPGP | RFC 9580 (formerly 4880) | Generate, Key Info, Revoke, Encrypt, Decrypt, Text, Sign, Verify, Armor |
| Symmetric KDF | RFC 8018 (PBKDF2), BIP-0039 | PBKDF2, BIP39 |
| Signatures (EdDSA) | RFC 8032 (Ed25519) | Ed25519 |
| Key agreement (ECDH) | RFC 7748 (X25519), RFC 5869 (HKDF) | X25519 |
| HMAC | RFC 2104, FIPS 198-1; vectors RFC 4231 | HMAC |
| Hashing | FIPS 180-4 (SHA-1/2), RFC 7693 (BLAKE2b) | Hash & Checksum |
| JWT / JOSE | RFC 7519, 7515, 7518; RFC 8725 (BCP) | JWT Inspector |
| TOTP / HOTP | RFC 6238, RFC 4226 | TOTP / 2FA |
| X.509 / ASN.1 | RFC 5280, X.690 (DER) | TLS Certificate Parser |
| SSH wire format | RFC 4253, RFC 4716 | SSH Key Parser |
| UUID / ULID | RFC 9562 (UUID v4 / v7) | UUID / ULID |
| Base encodings | RFC 4648 (Base64/32), Base58 (Bitcoin) | Encode |
| CSV | RFC 4180 | CSV ↔ JSON ↔ TSV |
| CIDR / subnetting | RFC 4632, RFC 3021 (/31), RFC 1918 | CIDR / Subnet |
| Color | WCAG 2.1 contrast, OKLCH (Oklab) | Color Converter |
| IBAN | ISO 13616, MOD-97-10 (ISO 7064) | IBAN |
| BIC | ISO 9362 | BIC / SWIFT |
| GS1 barcodes | GS1 General Specs (mod-10) | GS1 / EAN / GTIN |
| EU VAT | per-MS algorithms (ISO 7064 MOD 11,10; Luhn; mod-97) | EU VAT |
| SEPA payments | ISO 20022 (pain.001 / pain.008 / camt.053) + EPC SCT/SDD Rulebooks | SEPA XML |
| E-invoicing | OASIS UBL 2.1, EN 16931, PEPPOL BIS Billing 3.0 | PEPPOL / UBL |
| Trust lists | ETSI TS 119 612, eIDAS LOTL / TSL | eIDAS Trust List |
| Shamir | Shamir (1979) over GF(256), 256-bit param | Shamir Split |

## Conformance-gate cheat sheet (SEPA + UBL)

The SEPA and UBL inspectors share one idea: **schema-valid is not rail-valid.** A `pain.001` that passes the ISO 20022 XSD, or a UBL invoice that passes the OASIS schema, can still be bounced by a clearing system (EBA STEP2 / STET / RT1) or a PEPPOL access point for a Rulebook reason the XSD does not encode. Each gate below catches one such reject, emits a single ✓ (clean) or ✗ (offending value cited) row, and no-ops on documents it does not apply to.

```
  paste XML
     │
     ▼
  DOMParser  ──▶  namespace-blind walk (localName only)
     │             one code path for every pain.001.001.03 … .09,
     │             camt.053, pain.008, UBL 2.1.x, PEPPOL BIS 3.0
     ▼
  detect message/document type  ──▶  render header + lines
     │
     ▼
  run every applicable gate (each independent, order-free)
     ├─ structural / checksum   ─ IBAN MOD-97, BIC ISO 9362, IBAN↔BIC country parity
     ├─ character-set & length  ─ EPC charset; AdrLine 70 / TwnNm 35 / PstCd 16 / Nm 70
     ├─ presence (wrapper→leaf) ─ element down to FinInstnId routing identifier / account Id
     ├─ code-list membership    ─ EUR-only, LclInstrm CORE/B2B/COR1, UNCL 4461/5305/5153, ISO 3166/4217
     ├─ arithmetic invariants   ─ NbOfTxs, CtrlSum 2-dec, amount cap €999,999,999.99 │ BR-CO-10/13/14/15/16
     ├─ cardinality / forbidden ─ single Strd per RmtInf; IntrmyAgt / ChrgsAcct / SvcLvl·Prtry forbidden
     └─ uniqueness              ─ EndToEndId
     ▼
  ✓ / ✗ rows  (no network — verdicts computed entirely in-tab)
```

| Family | SEPA (ISO 20022 / EPC, 111 gates) | UBL (EN 16931 / PEPPOL, 112 gates) |
|---|---|---|
| Structural / checksum | IBAN MOD-97 + per-country BBAN structure; BIC ISO 9362; IBAN↔BIC country parity | IBAN MOD-97 on Payee/Payer account |
| Character-set & length | EPC restricted charset on every free-text field; AdrLine 70 / TwnNm 35 / PstCd 16 / party Nm 70 caps | — (UTF-8 per EN 16931) |
| Presence (wrapper → leaf) | `<PmtInf>` → `<Dbtr>`/`<Cdtr>` → `<DbtrAgt>`/`<CdtrAgt>` → `<FinInstnId>` routing-id content; account `<Id>` → IBAN content | BR-* root, line, and party mandatory-field presence down to `PayeeFinancialAccount`/`PaymentMandate`/`EndpointID@schemeID`; document-level `AllowanceCharge` Amount (BR-31/36) + ChargeIndicator |
| Code-list membership | EUR-only `<Ccy>`; `LclInstrm/Cd` CORE/B2B/COR1; `SeqTp`; `CtryOfRes` ISO 3166 | UNCL 1001 type, UNCL 4461 means, UNCL 5305/5153 VAT codes; ISO 4217 currency; PEPPOL EAS schemeID |
| Arithmetic | `NbOfTxs`/`CtrlSum` non-empty + 2-decimal cap; per-tx 2-decimal precision; strictly-positive amounts; amount cap €999,999,999.99 | BR-CO-10 line totals, BR-CO-13/15 tax consistency, BR-CO-14 breakdown sum, BR-CO-17 per-rate cross-product, BR-CO-16 payable; BR-DEC 2-decimal caps |
| Cardinality / forbidden | single `<Strd>` per `<RmtInf>`; `IntrmyAgt` / `ChrgsAcct` / `SvcLvl·Prtry` forbidden | at-least-one `<InvoiceLine>`; conditional gates scoped by payment-means code |
| Uniqueness | `EndToEndId` across the file | — |

Each gate ships as a four-part unit — **spec entry (`SPEC-INTERNATIONAL.md` §2.4 / §2.7) + implementation + i18n strings × 5 locales + a Playwright confirm/flag pair** — so the catalogue grows without regressions. The full per-draft history (drafts 16 → 251) lives in the spec.

## Design decisions

The non-obvious engineering choices, and why they were made:

- **Single HTML file, no build step.** What is in the repository is byte-for-byte what runs in your browser — there is no transpiler, bundler, or minifier between source and shipped artifact to audit. The cost is a large source file; the benefit is that a reviewer can read exactly what executes.
- **Zero network by construction, not by policy.** `connect-src 'none'` plus an `audit-release.js` gate that greps for `fetch` / `XHR` / `WebSocket` / `EventSource` / `sendBeacon` call sites means "no exfiltration" is a property the browser enforces and CI verifies, not a promise in a privacy policy.
- **Hand-rolled parsers over vendoring** for ASN.1/DER, the SSH wire format, Base32/Base58, OKLCH matrices, the cron parser, CIDR arithmetic, the LCS diff, and the RFC 4180 CSV parser. Each is small, auditable, and keeps the page under the 2 MB gzipped budget — vendoring a library for each would multiply the supply-chain surface for a few hundred lines of logic.
- **`textContent` / `createElement` only — never `innerHTML`.** A grep-verifiable invariant (zero `innerHTML =` assignments) removes the most common XSS sink even for fully developer-controlled content.
- **SHA-384 pinning instead of SRI.** Same-origin scripts gain nothing from SRI's CORS requirements, so the integrity claim lives as a hash recorded in three places (HTML comment, README manifest, on-disk bytes) and is cross-checked on every commit — a forger has to defeat all three.
- **Conformance gates as an incremental, test-backed methodology.** The SEPA and UBL inspectors are not one-shot parsers — they are growing libraries of narrow, independent validation gates (223+ and counting — 111 SEPA, 112 UBL as of this writing), each one shipped as a *spec entry + implementation + i18n strings × 5 locales + Playwright confirm/flag pair*. The thesis: a document that passes XSD validation can still be rejected by a clearing system or PEPPOL access point for a Rulebook reason the schema does not encode (a name-only `FinInstnId` with no routable BIC, a VAT breakdown whose subtotals don't sum to the header, an amount over the scheme cap). Each gate catches one such real-world reject, no-ops cleanly on documents it doesn't apply to, and is pinned by a green test before it lands. The full catalogue lives in [SPEC-INTERNATIONAL.md](SPEC-INTERNATIONAL.md) §2.4 (SEPA) and §2.7 (UBL).

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

# Run all mechanical security/quality gates. Exits non-zero on first failure.
node scripts/audit-release.js
```

The audit checks: zero `innerHTML =` assignments, STRINGS parity across all 5 locales, every `data-i18n` key resolves, vendored SHA-384 hashes match across HTML comments + the README manifest + on-disk bytes, CSP `connect-src 'none'` on both meta and `_headers`, no outbound network call sites, page weight under 2 MB gzipped, locale variants (`/fr/`, `/zh/`, `/de/`, `/hi/`) in sync with source, `robots.txt` + `sitemap.xml` + JSON-LD presence, Phase-7 SEO prose key coverage for all 45 tools, and (if present) `sbom.json` hash consistency and `encryptalotta-portable.html` having no `<script src=>` references.

### Build artifacts (for distribution / audit, optional)

```bash
# Generate a self-contained single-file build for USB / file:// / portable use.
node scripts/build-portable.js          # → encryptalotta-portable.html (~1.3 MB)

# Emit a CycloneDX 1.5 SBOM listing all vendored deps with SHA-256/384/512 hashes.
node scripts/build-sbom.js              # → sbom.json

# Append a SHA-256 manifest section for the current working tree (use at tagged releases).
node scripts/build-release-manifest.js  # → RELEASES.md (append-only)
```

All three scripts are deterministic: re-running with unchanged inputs produces byte-identical output, so they're safe to wire into a release pipeline. The audit cross-checks `sbom.json` hashes against the on-disk vendored bytes — if you update a vendored library and forget to regenerate the SBOM, the next commit's audit will fail.

### Pre-commit hook (recommended)

Install the versioned hook on a fresh clone so `audit-release.js` runs on every commit:

```bash
ln -sf ../../scripts/git-hooks/pre-commit .git/hooks/pre-commit
```

### Verifying Integrity

To verify that the vendored libraries haven't been tampered with, run:

```bash
openssl dgst -sha384 -binary openpgp.min.js  | openssl base64 -A
# Z5tStPoeClmuLPd1gAwdTCU53WcAkUjBNw7mEEvrQumVuNqEl52A9Nx5IhFdKE/c

openssl dgst -sha384 -binary qrcode.js   | openssl base64 -A
# e9EFD6BGC90bkW9aDV5xbbBfzwN7G8YImHao2lfLVKV/hPB0E0go+H3I64h7oHtA

openssl dgst -sha384 -binary secrets.min.js  | openssl base64 -A
# xfBMbh8fdSIrQ9XbZARwZ5z/Eh9zC7gsgG5vSE331lZSjgXQob1KxM4m7vEdH0e0

openssl dgst -sha384 -binary js-yaml.min.js  | openssl base64 -A
# ZeqCzuWczURac3RacSufGD7oSbzeaX7xxnnOr3PTcYTLx4Av0qBj0kBq7AeCtHLA
```

Or all at once:

```bash
for f in openpgp.min.js qrcode.js secrets.min.js js-yaml.min.js; do
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
| `qrcode.js` | Vendored qrcode-generator (QR Share tool) |
| `secrets.min.js` | Vendored secrets.js-grempe (Shamir Secret Sharing tool) |
| `js-yaml.min.js` | Vendored js-yaml (Format / Convert tool — YAML parse / emit) |
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
| `scripts/audit-release.js` | Release-gate audit: 14 mechanical security/quality checks |
| `scripts/build-sitemap.js` | Regenerates `sitemap.xml` with today's `<lastmod>` and the 5 locale roots |
| `scripts/check-dependency-updates.js` | Quarterly upstream-version checker (used by GitHub Actions only — never runs on the live site) |
| `scripts/git-hooks/pre-commit` | Versioned pre-commit hook running `audit-release.js` |
| `.github/workflows/dep-check.yml` | Quarterly GitHub Actions workflow that runs `check-dependency-updates.js` |

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

- `index.html` - All application logic (CSP meta tags, JavaScript cryptographic calls, memory clearing, i18n, all 45 tools)
- `_headers` - HTTP security headers
- `openpgp.min.js` - Compare against official OpenPGP.js v6.3.0 release
- `qrcode.js` - Compare against official qrcode-generator v2.0.4 release
- `secrets.min.js` - Compare against official secrets.js-grempe v2.0.0 release
- `js-yaml.min.js` - Compare against official js-yaml v4.1.1 release
- [Manifest](#manifest) section above — SHA-384 manifest for all vendored libraries

A grep-friendly audit invariant: the codebase has **zero `innerHTML =` assignments**. All DOM construction goes through `createElement` / `textContent` / `setAttribute`, eliminating the most common XSS vector even when content is fully controlled by the developer.

Found a vulnerability? Please report it via [GitHub Issues](https://github.com/clay-good/encryptalotta/issues) or contact the maintainer directly.

