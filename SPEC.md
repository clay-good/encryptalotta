# encryptalotta.com — v3 Roadmap

Single source of truth for the next release wave. This document covers:

1. The non-negotiable constraints every change must respect.
2. **17 new tools** to add (broken into shippable batches).
3. SEO upgrades (`robots.txt`, `sitemap.xml`, JSON-LD, per-tool titles, prose blocks).
4. Dependency-pinning maintenance plan (manual cadence + optional GitHub Action).
5. Release ritual.

---

## Status of the v2 work (already shipped)

Reference, not action items. All of the following are complete and gated by `scripts/audit-release.js`:

- Two-level grouped nav → home grid + breadcrumb redesign.
- 5-locale i18n engine (en, fr, zh-CN, de, hi) with 334 keys at parity.
- Pre-rendered `/fr/`, `/zh/`, `/de/`, `/hi/` static variants for SEO.
- 15 tools live: Generate, Key Info, Revoke, QR Share, Encrypt, Decrypt, Text Crypto, Password Encrypt, Stego, Sign, Verify, Passwords, Armor, Shamir, EXIF.
- Three vendored libs with SHA-384 manifest in the `README.md` "Manifest" section.
- Strict CSP with `connect-src 'none'`, COOP/COEP/CORP, comprehensive Permissions-Policy, deny-by-default everything except `clipboard-write=(self)`.
- Pre-commit hook running the audit; release-gate audit script with 9 checks.
- Locale CSV round-trip for native reviewers (`scripts/export-strings-csv.js` / `import-strings-csv.js`).
- Multi-size `favicon.ico` + manifest.

---

## Guiding constraints (must not violate)

These are the rules every PR must follow. Treat them as load-bearing for the brand — break one and we lose the moat.

| Rule | Enforced by |
|---|---|
| **No outbound network calls.** `connect-src 'none'` stays. No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, no `<img>` to a third party, no font-CDN. | `scripts/audit-release.js` |
| **No analytics, no telemetry, no fingerprinting.** Cloudflare Pages already gives server-side unique-visitor counts; that is sufficient. Even "privacy-respecting" client-side analytics (Plausible, Umami, etc.) are forbidden. | Manual + audit |
| **No CDN.** Every script and asset is vendored locally with a SHA-384 hash in two places (HTML inline comment and the `README.md` manifest), cross-checked against the on-disk bytes. | `scripts/audit-release.js` |
| **No build step at deploy time.** Cloudflare Pages serves the repo as-is, no build command. The `scripts/` folder is run manually before commit, never on the server. | Manual |
| **No `innerHTML =` assignments.** All DOM construction via `createElement` / `textContent` / `setAttribute`. | `scripts/audit-release.js` |
| **No new outbound capability without spec amendment.** Adding a feature that needs network access (HIBP, DNS lookup, GeoIP, AI inference) requires explicit spec change first. Default answer: skip. | Manual review |
| **Page weight ≤ 2 MB gzipped.** Currently 0.24 MB. New libs must justify their delta against this budget. | `scripts/audit-release.js` |
| **Memory hygiene for secrets.** Anything that handles private keys, passphrases, or seed material must zero buffers / clear DOM fields after use. | Code review |
| **Accessibility parity.** Every new tool matches existing ARIA patterns (`role="tab"`, `aria-selected`, focus rings, keyboard nav). | Manual + Lighthouse |
| **i18n parity.** Every new visible string carries a `data-i18n` key resolvable in `STRINGS.en`. Translations to fr/zh-CN/de/hi can be machine-quality for v1 — the CSV round-trip handles native review later. | `scripts/audit-release.js` |
| **No user accounts, no sync, no history.** localStorage `lastTool` is the only persistent state. No cookies. No sessionStorage of secrets. | Manual review |
| **No service workers.** Site already works offline once loaded; a SW would add a cache-invalidation surface that has historically caused issues with security-critical apps. | Manual |

---

## Phase 6 — New utility tools

Goal: round out the suite from "PGP-shaped" to "anything-an-engineer-touches-during-a-day-shaped" while keeping the privacy moat intact.

Every new tool follows this template (matching the existing pattern):

1. New entry in `TOOL_TO_GROUP` and in `TOOL_ORDER`.
2. New tool card in the home grid (correct group section, with `nav.tool.<id>` + `tool.<id>.desc` i18n keys).
3. New view panel `<section id="<id>-view" class="view" role="tabpanel">`.
4. All UI strings tagged with `data-i18n` / `data-i18n-attr`.
5. Memory wipe after operations that touch secrets.
6. Update home grid totals in `README.md`.
7. Add row to `sitemap.xml` and entry to JSON-LD `featureList`.
8. Add an `<details>` "About this tool" prose block (see SEO section).

### Group taxonomy after Phase 6

The existing four groups expand. We do **not** add a fifth top-level group — keep cognitive load low. Each new tool slots into one of: Encoders, Crypto/Hashing, Auth, Format, or Time/IDs (which all collapse under existing groups).

Final layout:

| Group | Tools (existing → after Phase 6) |
|---|---|
| **Keys** | Generate · Key Info · Revoke · QR Share · **SSH Key Parser** (new) · **TLS Cert Parser** (new) · **PEM ↔ DER** (new) |
| **Encrypt / Decrypt** | Files · Text Messages · Password Encrypt · Steganography |
| **Sign / Verify** | Sign · Verify · **HMAC** (new) · **JWT Inspector** (new) |
| **Utilities** | Passwords · Armor · Shamir Split · EXIF Eraser · **Hash & Checksum** (new) · **TOTP / 2FA** (new) · **UUID / ULID** (new) · **Base64/32/58/Hex** (new) · **Unix Timestamp** (new) · **URL Parser** (new) · **Diff** (new) · **JSON/YAML/TOML/XML Formatter** (new) · **CSV ↔ JSON ↔ TSV** (new) · **Cron Decoder** (new) · **Regex Tester** (new) · **Color Converter** (new) |

Total: **15 + 17 = 32 tools**. Utilities is now densely populated; that's fine — the home grid auto-fills, and the user just scans to the section they want.

### Library budget

| Tool | Lib needed? | Estimated KB (min+gz) | Notes |
|---|---|---|---|
| Hash & Checksum | None | 0 | SHA-1/256/384/512 via Web Crypto only (skip SHA3/BLAKE2 for v1). |
| HMAC | None | 0 | Web Crypto SubtleCrypto. |
| Base64/32/58/Hex | None | 0 | Vanilla JS; Base58 alphabet hand-rolled (~30 lines). |
| JWT Inspector | None | 0 | Web Crypto verify for RS256/ES256/HS256. |
| TOTP / 2FA | None | 0 | RFC 6238 via Web Crypto HMAC-SHA1 (~80 lines). |
| UUID / ULID | None | 0 | `crypto.getRandomValues`; UUIDv7 spec is ~40 lines. |
| Unix Timestamp | None | 0 | `Date` + `Intl.DateTimeFormat`. |
| URL Parser | None | 0 | `URL` built-in. |
| Diff | None | 0 | Vanilla LCS, ~150 lines. |
| Cron Decoder | None | 0 | Hand-rolled parser, ~200 lines. |
| Regex Tester | None | 0 | `RegExp`. |
| Color Converter | None | 0 | Hand-rolled HEX/RGB/HSL/OKLCH. |
| CSV ↔ JSON ↔ TSV | None | 0 | RFC 4180 parser, ~80 lines. |
| **JSON/YAML/TOML/XML formatter** | YAML + TOML | ~12 KB gz | js-yaml-tiny (~8 KB) + smol-toml (~4 KB). XML: vanilla `DOMParser`. |
| **TLS Cert Parser** | ASN.1/DER lib | ~10 KB gz | `pkijs` is too heavy; use a hand-rolled DER decoder (~300 lines) for the common cases (subject, issuer, SAN, validity, fingerprint). |
| **SSH Key Parser** | None | 0 | OpenSSH RFC 4253 + OpenSSH private key format (~150 lines). |
| **PEM ↔ DER** | None | 0 | Base64 + header parser (~50 lines). |

Total new vendored bytes: **≤ 12 KB gzipped**. Budget remains comfortable (current 0.24 MB → ~0.26 MB).

### Shipping order

Group tools into 4 batches so each PR is reviewable.

#### Batch A — Encoders & IDs (no libs, 0 KB delta) — ✅ IMPLEMENTED

1. **Hash & Checksum** (`#/utilities/hash`) — Text or file input → SHA-1/256/384/512 hashes computed via Web Crypto. Compare-two-hashes block with constant-time match indicator.
2. **HMAC** (`#/signing/hmac`) — Compute HMAC-SHA-1/256/384/512 with a text or hex-encoded key. Verify a known HMAC against input via constant-time string compare. Key buffer is `.fill(0)`-zeroed after use.
3. **Base64 / Base32 / Base58 / Hex** (`#/utilities/encode`) — Cross-convert text ↔ hex ↔ Base64 ↔ Base64-URL ↔ Base32 ↔ Base58 (Bitcoin alphabet). All codecs hand-rolled in vanilla JS (~140 lines of helpers). Swap-format button.
4. **UUID / ULID** (`#/utilities/uuid`) — Generate UUID v4 (random), UUID v7 (RFC 9562 time-ordered), and ULID (Crockford base32, 26 chars). Bulk generate 1–1000 in one click. All randomness via `crypto.getRandomValues`.
5. **Unix Timestamp** (`#/utilities/timestamp`) — Auto-detect Unix seconds (≤10 digits), Unix milliseconds (13 digits), or ISO 8601. Render: epoch sec, epoch ms, ISO 8601 UTC, UTC string, local time, relative ("5 minutes ago" / "in 3 hours"). "Use current time" button.
6. **URL Parser** (`#/utilities/url`) — Parse via the built-in `URL` API; render protocol/auth/host/port/path/search/hash/origin in a labeled table. Query parameters table. Percent-encode and percent-decode utility buttons.

Verified:
- All 6 tools live, reachable from home grid (Utilities section), keyboard nav still works.
- STRINGS parity: 447 keys × 5 locales (was 336; +111 keys, all translated to fr/zh/de/hi at machine-quality per existing policy).
- 0 KB vendored delta — purely Web Crypto + vanilla JS.
- Page weight 0.25 MB gzipped (was 0.24 MB).
- 0 `innerHTML =` assignments unchanged.
- All 9 audit gates pass.
- Locale variants regenerated.

#### Batch B — Auth & Tokens (no libs) — ✅ IMPLEMENTED

7. **JWT Inspector** (`#/signing/jwt`) — Decodes the three Base64-URL parts; pretty-prints header + payload + signature (hex). Surfaces `exp` claim with green "valid until {iso}" / red "expired at {iso}" indicator. Verify section accepts HS256/384/512 (shared secret), RS256/384/512 (PEM SPKI public key), or ES256/384/512 (PEM SPKI ECDSA key). Web Crypto only; no JWT lib vendored. PEM parsed via existing Base64 decoder.
8. **TOTP / 2FA** (`#/utilities/totp`) — Accepts an `otpauth://totp/...` URI (parses params automatically) or a bare base32 secret. Live-updates the current N-digit code each second with a countdown progress bar. SHA-1 / SHA-256 / SHA-512, configurable digits (6–10) and period (15–120). Stops on demand and `.fill(0)`-zeroes the secret buffer.

Verified:
- STRINGS parity: 489 keys × 5 locales (was 447; +42 keys for JWT + TOTP).
- 0 KB vendored delta — Web Crypto + vanilla JS only.
- Page weight 0.26 MB gzipped (still well under 2 MB).
- 0 `innerHTML =` assignments unchanged.
- TOTP secret bytes zeroized in `Stop` handler.
- All 9 audit gates pass.
- Cross-link from QR Share (paste an `otpauth://` URI to QR Share to provision a new device) is left as informal docs — no code dependency between tools.

#### Batch C — Format & Validate (small libs) — ✅ IMPLEMENTED (TOML scope-cut)

9. **Diff** (`#/utilities/diff`) — ✅ Inline diff of two text blobs via line-level LCS DP (capped at 5000 lines per side). Toggles: ignore-whitespace, ignore-case. Swap A↔B button. Summary line reports added/removed/unchanged counts.
10. **JSON / YAML / XML Formatter** (`#/utilities/format`) — ✅ Shipped. Pretty-print, minify, and cross-convert between JSON ↔ YAML; pretty-print or minify XML standalone. JSON via native `JSON.parse`/`stringify`; YAML via vendored `js-yaml@4.1.0` (39 KB min, 12.7 KB gz, MIT, SHA-384 in manifest); XML via `DOMParser` + manual indent walk. Auto-detect input format from the first non-blank character / line. **TOML support deliberately omitted**: in 2025, no small browser-ready TOML parser exists without a build step (`smol-toml` is ESM-only and would need bundling — forbidden by spec; `@ltd/j-toml` is 100+ KB and exceeds the budget). The tool surfaces a visible alert explaining the omission. Reconsider in v4 if a suitable lib emerges.
11. **CSV ↔ JSON ↔ TSV** (`#/utilities/csv`) — ✅ RFC 4180-ish parser handling quoted fields, escaped `""`, CRLF/LF. Auto-detect delimiter via header sniffing. Convert any direction (CSV/TSV/JSON). "First row is header" toggle. "Use output as input" round-trip button.
12. **Regex Tester** (`#/utilities/regex`) — ✅ Live match highlighting via `<mark>` spans built with `createElement` + `textContent` (no `innerHTML`). Numbered + named capture groups (up to 50 matches rendered inline). Flags `gimsuy` validated. Optional replacement mode with `$1`/`$&`/named-group support. Zero-width-match safeguard.

Verified (full Batch C now shipped, with TOML scope-cut):
- 4 of 4 tools live (Diff, CSV/JSON/TSV, Regex Tester, JSON/YAML/XML Formatter).
- New vendored lib: `js-yaml@4.1.0` (39 KB min, 12.7 KB gz, MIT). SHA-384 cross-checked across HTML inline comment + README manifest + on-disk bytes by `audit-release.js`.
- Page weight 0.31 MB gzipped (well under 2 MB).
- 0 `innerHTML =` assignments unchanged.
- STRINGS at 811 en keys × 5 locales.
- All 14 audit gates pass.
- JSON-LD `featureList` extended to 30 entries; SEO prose keys gate verifies 32 tools × 5 keys.

#### Batch D — Crypto Inspectors & DevOps (mixed libs) — ✅ IMPLEMENTED

13. **TLS Certificate Parser** (`#/keys/tls-cert`) — ✅ Hand-rolled ASN.1/DER decoder (~120 lines) parses the X.509 subset we surface: version, serial, subject, issuer, validity, public-key OID, signature algorithm, SubjectAltName extension (DNS / IP / email / URI), SHA-1 + SHA-256 fingerprints over full DER. No `pkijs`.
14. **SSH Key Parser** (`#/keys/ssh-key`) — ✅ Parses the OpenSSH RFC 4253 wire format (`ssh-rsa`, `ssh-ed25519`, `ecdsa-sha2-nistp{256,384,521}`). Shows type, bit size (RSA modulus tightened by leading-zero count), `SHA256:<base64>` OpenSSH-style fingerprint, comment. MD5 fingerprint deferred (Web Crypto has no MD5; would need a hand-rolled implementation).
15. **PEM ↔ DER** (`#/keys/pem-der`) — ✅ Round-trips between PEM (any block label, e.g. `CERTIFICATE` / `PRIVATE KEY` / `RSA PUBLIC KEY`) and DER (output as hex; input accepted as hex or Base64).
16. **Cron Decoder** (`#/utilities/cron`) — ✅ Parses 5-field cron (`*`, `*/n`, `a-b`, `a,b,c`; named months/dows). Renders prose description and the next 5 fire times in the user's local timezone (5-year safety bound on the search loop). POSIX OR-semantics for combined dom + dow restrictions.
17. **Color Converter** (`#/utilities/color`) — ✅ HEX ↔ RGB ↔ HSL ↔ OKLCH (Björn Ottosson reference matrices). Inline `<input type="color">` picker bound to the input field. WCAG contrast checker reports AA/AAA pass/fail for normal and large text against a live sample.

Verified:
- STRINGS parity: 622 keys × 5 locales (was 540; +82 keys for the 5 Batch D tools).
- 0 KB vendored delta — hand-rolled ASN.1 stayed small enough that no DER helper was needed.
- Page weight 0.29 MB gzipped (still well under 2 MB).
- 0 `innerHTML =` assignments unchanged.
- All 13 audit gates pass.
- JSON-LD `featureList` extended to 29 entries.

### Total Phase-6 estimate

- **17 new tools**, shipped as **4 batches**.
- ~3000 lines of JS added (50% growth of `index.html` script section).
- ~170 new i18n keys × 5 = 850 entries.
- New vendored libs: at most 2 (YAML, TOML) plus optional DER helper. ≤ 12 KB gzipped delta.
- Final page weight target: ≤ 0.30 MB gzipped (well under 2 MB budget).

### Deliberately out-of-scope (do NOT build)

These were considered and rejected. Each one would either break the moat, blow the page-weight budget, or attract the wrong audience.

| Idea | Why rejected |
|---|---|
| **Have I Been Pwned (k-anonymity)** | Requires `fetch` to api.pwnedpasswords.com — breaks `connect-src 'none'`. |
| **DNS lookup / WHOIS** | Same — needs network call. |
| **GeoIP** | Same. |
| **AI / LLM features** | Network call OR 400 MB WebGPU model. Both kill the brand. |
| **PDF tools** (parse, merge, split) | PDF.js is ~2 MB. Blows the budget for a non-privacy-sensitive use case. |
| **OCR** | Tesseract.js is 10+ MB. |
| **Image editing beyond EXIF** (crop, resize, filters) | Commodity. Doesn't fit the privacy moat. |
| **Markdown preview** | Decent fit, but a sanitizing renderer is ~30 KB and the audience is narrow. Reconsider in v4. |
| **JSON Schema validator** | Lib (~50 KB AJV-style) is heavy. Reconsider in v4. |
| **Password strength meter (zxcvbn)** | ~150 KB lib for one tool. Reconsider in v4. |
| **PII scrubber** | Regex PII is leaky; weakens trust. Hard skip. |
| **Audio steganography** | Niche. Wait for demand. |
| **CIDR / subnet calculator** | Genuinely useful but lower priority than what's in scope above. Reconsider in v4 if requested. |

---

## Phase 7 — SEO buildout — 🟢 PARTIALLY IMPLEMENTED

Goal: every tool URL is independently indexable, every locale variant is independently discoverable, and Google can understand the site as a structured `WebApplication` with a feature list.

Run after Phase 6 so the new tools are part of the indexable surface from day one.

### Phase 7 — Status snapshot

- ✅ **JSON-LD `WebApplication` + `FAQPage`** — shipped early, in `index.html` head and copied verbatim by the variant builder. `featureList` has 21 entries; FAQ covers the 5 highest-value questions (free, no uploads, audit, offline, languages). Audit gates the JSON-LD presence and `featureList` length.
- ✅ **`robots.txt`** — created at repo root, `Allow: /` + `Sitemap:` directive pointing at production URL.
- ✅ **`sitemap.xml`** — generated by `scripts/build-sitemap.js`. Lists the 5 locale roots with `<lastmod>`, `<changefreq>`, `<priority>`, and full `xhtml:link rel="alternate" hreflang="…"` cross-references for every locale plus `x-default`. Tool deep links intentionally omitted (Google does not index URL fragments).
- ✅ **Per-tool `<title>` swap** — `setActiveTool()` now sets `document.title = "Tool name · encryptalotta"` when a tool is active and `"encryptalotta"` on home. `applyI18n()` re-derives the title from the active view so language switches re-translate it. Adds 21× the title-text-surface that Google indexes per page.
- ✅ **Audit gates** — `scripts/audit-release.js` extended with three new checks: `robots.txt` exists with Sitemap directive, `sitemap.xml` lists all 5 locale roots, JSON-LD parses and has `WebApplication.featureList` ≥ 15 entries.
- ✅ **Favicon link priority** — moved `<link rel="icon">` declarations to the very top of `<head>` (right after `<meta charset>` / `<meta viewport>`) so browsers see them before the long meta + JSON-LD block. Both `rel="icon"` and `rel="shortcut icon"` are declared for legacy clients.
- ✅ **Per-tool prose `<details>` blocks** — shipped. 31 tools × 3 short paragraphs ("What is this?" / "How does it work?" / "Why use this instead of an online tool?"), injected at boot via `injectAboutBlocks()` (loops `TOOL_ORDER`, builds the `<details>` via `createElement` / `textContent` — no `innerHTML`). English-only prose; `t()` falls back to en for non-en locales per spec 7.5. Audit + variant builder updated to allow `tool.<id>.{title,metaDescription,about.{what,how,why}}` to be en-only via a regex carve-out.
- ✅ **Per-tool `<meta name="description">` swap** — shipped. `setActiveTool()` and `applyI18n()` both update `<meta name="description">` from `tool.<id>.metaDescription` (with fallback to the global `meta.description`).
- ✅ **Per-tool `<title>` upgrade** — `setActiveTool()` now prefers `tool.<id>.title` (long-form, SEO-tuned) over the shorter `nav.tool.<id>` label.
- ✅ **New audit gate** — `audit-release.js` check #9: every tool in `TOOL_ORDER` has `tool.<id>.{title,metaDescription,about.{what,how,why}}` in `STRINGS.en`. 31 × 5 = 155 keys verified.
- ✅ **"Related tools" strip** — shipped. `RELATED_TOOLS` map in `index.html` curates 2-3 links per tool to others in the same workflow (e.g. `sign → verify, hmac, jwt`; `tls-cert → ssh-key, pem-der, hash`). `injectRelatedTools()` runs at boot, appending a `<nav class="related-tools">` to every view. Each link is a real `#/<group>/<tool>` href (so it's crawlable + bookmarkable) but with a `navigateTo()` click handler so SPA routing stays intact. New chrome key `related.heading` translated in all 5 locales.

### 7.1 — `robots.txt`

Create `/robots.txt` at repo root:

```
User-agent: *
Allow: /
Sitemap: https://encryptalotta.com/sitemap.xml
```

Five lines. No tracking-bot blocks (we're 100% public). Sitemap pointer is the load-bearing part.

### 7.2 — `sitemap.xml` (generated)

Create `scripts/build-sitemap.js`:
- Reads `TOOL_ORDER` and `TOOL_TO_GROUP` from `index.html` (extracted via the same `Function`-wrapping trick used by the locale builder).
- Emits `<url>` entries for:
  - 5 root pages: `/`, `/fr/`, `/zh/`, `/de/`, `/hi/`
  - 32 tool deep links per locale: `/#/<group>/<tool>` × 5 locales = 160 deep-link entries
  - **Caveat:** Google does not index URL fragments (`#/`) as separate pages. So the sitemap should list the 5 root pages only. The deep links exist for sharing/bookmarking, not for SEO. Document this in a comment in the build script. Total: **5 entries.**
- Each entry includes `<lastmod>` (current commit date) and `<changefreq>monthly</changefreq>`, `<priority>` (1.0 for `/`, 0.8 for variants).
- Cross-references each variant with `<xhtml:link rel="alternate" hreflang="…" href="…">` for hreflang in the sitemap (preferred over `<link>`-only declarations).

`audit-release.js` adds a check: `sitemap.xml` references each existing variant directory, and the file ends with the proper XML close tags.

### 7.3 — JSON-LD `WebApplication` block

Add an inline `<script type="application/ld+json">` block in the `<head>` of `index.html` (and copied verbatim to each variant by the build script). Schema:

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Encrypt A Lot",
  "url": "https://encryptalotta.com/",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "Any",
  "browserRequirements": "Requires JavaScript. Requires HTML5.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "featureList": [
    "PGP key generation (ECC Curve25519, RSA 3072/4096)",
    "File and text encryption / decryption",
    "Digital signatures (sign and verify)",
    "Password-only encryption",
    "QR code sharing of public keys",
    "Steganography (hide payload in PNG)",
    "Shamir's Secret Sharing",
    "EXIF metadata stripping",
    "Hash and checksum (SHA-1/256/384/512)",
    "HMAC sign and verify",
    "Base64/32/58/Hex encoding",
    "JWT inspector",
    "TOTP 2FA generator",
    "UUID/ULID generator",
    "JSON/YAML/TOML/XML formatter",
    "CSV/JSON/TSV converter",
    "URL parser",
    "Unix timestamp converter",
    "Cron expression decoder",
    "Regex tester",
    "Color converter",
    "TLS certificate parser",
    "SSH key parser",
    "PEM/DER converter",
    "Diff",
    "Strong password generator",
    "Revocation certificates",
    "ASCII armor converter"
  ],
  "isAccessibleForFree": true,
  "creator": { "@type": "Organization", "name": "Encrypt A Lot" }
}
```

Plus a smaller `FAQPage` JSON-LD block answering 3-5 questions: "Is Encrypt A Lot really free?", "Do you store my keys?", "How do I verify the code is what I think it is?", etc. Each answer cross-links to a section of `README.md`.

### 7.4 — Per-tool `<title>` + `<meta name="description">`

In `navigateTo(tool)`:
- When entering a tool, set `document.title = t('tool.' + tool + '.title') + ' · Encrypt A Lot'`.
- Update the description meta tag to `t('tool.' + tool + '.metaDescription')` (a longer, SEO-targeted variant of the existing card description).
- When returning to home, restore the default title and description.

This requires two new i18n keys per tool: `tool.<id>.title` (often a copy of `nav.tool.<id>`, but allows differentiation — e.g. nav says "QR Share", title says "QR Code Sharing for PGP Keys") and `tool.<id>.metaDescription` (~140 chars, keyword-rich).

### 7.5 — Per-tool prose blocks

Under each tool's `<h2>` heading, add a collapsed `<details>` block:

```html
<details class="tool-about" data-i18n-attr="aria-label:about.aria">
    <summary data-i18n="about.summary">About this tool</summary>
    <div class="tool-about-body">
        <h3 data-i18n="tool.<id>.about.whatHeading">What is this?</h3>
        <p data-i18n="tool.<id>.about.what">…</p>
        <h3 data-i18n="tool.<id>.about.howHeading">How does this work?</h3>
        <p data-i18n="tool.<id>.about.how">…</p>
        <h3 data-i18n="tool.<id>.about.whyHeading">Why use this instead of an online tool?</h3>
        <p data-i18n="tool.<id>.about.why">…</p>
    </div>
</details>
```

Three short paragraphs each, written for both human readers and search engines.

For Phase-7 v1: write these in **English only** (high quality, hand-written). The fr/zh/de/hi versions can be machine-quality placeholders that fall back to English via `t()`. This is consistent with the existing translation policy (en is source of truth).

Total: 32 tools × 3 paragraphs = ~96 paragraphs of new prose. Time-bounded but real work.

### 7.6 — Internal cross-linking

At the bottom of each tool view, add a "Related tools" strip with 2-3 manually-curated links to tools in the same workflow:

| Tool | Related |
|---|---|
| Generate Keys | Key Info, Revoke, QR Share |
| Sign | Verify, HMAC, JWT Inspector |
| QR Share | Generate Keys, TOTP |
| TOTP | QR Share, HMAC |
| Hash | HMAC, Base64 |
| ... | ... |

Maintained as a `RELATED_TOOLS` map in JS, rendered into a `<nav class="related-tools">` block at the bottom of each view. Each link uses `navigateTo()` so it stays SPA-style.

### 7.7 — Per-tool `og:image`

Optional. If we ever want richer link previews on Slack/Twitter for specific tool URLs, generate per-tool 1200×630 PNGs (one-time, manually) and reference via:

```html
<meta property="og:image" content="https://encryptalotta.com/og/tool-<id>.png">
```

Skip for v1 of Phase 7. Add only if a tool gets viral enough to warrant the asset work.

### 7.8 — Audit additions

Extend `scripts/audit-release.js` with these new checks:

- `robots.txt` exists and references the production sitemap URL.
- `sitemap.xml` exists, parses as XML, and lists all 5 locale roots with proper `hreflang` cross-references.
- Inline JSON-LD block in `index.html` parses as valid JSON and has `@type: WebApplication`.
- `featureList` length matches `TOOL_ORDER.length` (so adding a tool that forgets to update JSON-LD fails the gate).
- Every tool in `TOOL_ORDER` has `tool.<id>.title`, `tool.<id>.metaDescription`, and `tool.<id>.about.{what,how,why}` keys in `STRINGS.en`.

This makes SEO drift a build-time error rather than a discovered-six-months-later problem.

---

## Phase 8 — Dependency-pinning maintenance

Vendored libs are pinned by SHA-384, which means we don't auto-pull upstream fixes. Phase 8 documents the maintenance discipline.

### 8.1 — Manual cadence (current default)

Documented in `README.md` under "Dependency update cadence":

- **Quarterly review (every 3 months).** Check for new releases of OpenPGP.js, qrcode-generator, secrets.js-grempe, plus any libs added in Phase 6. For each, read the changelog. If only feature work — defer. If any security fix — vendor immediately.
- **Immediate response on advisory.** If a CVE or security advisory is published, treat the bump as a P0: vendor the patch within 48 hours, push a release, note the CVE in the commit message, and re-run `audit-release.js` (which re-hashes the bytes).
- **Pre-commit gate.** `scripts/git-hooks/pre-commit` already runs `audit-release.js`, which cross-checks SHA-384 against on-disk bytes — so updating a vendored file without updating its hash in the HTML comment and the `README.md` manifest is caught at commit time, not at deploy.

### 8.2 — Optional GitHub Action (lightweight automation) — ✅ IMPLEMENTED

Shipped as `.github/workflows/dep-check.yml` + `scripts/check-dependency-updates.js`. The script reads the [Manifest](README.md#manifest) row-by-row, queries each upstream's `/repos/<owner>/<repo>/releases/latest` (falling back to `/tags?per_page=1` for repos that publish via tags only), normalizes versions (strips leading `v`), and exits 1 if any pinned version differs from upstream. The workflow runs on the 1st of each quarter at 12:00 UTC, captures the script output, and uses `actions/github-script@v7` to open an issue (label `dependencies`) when the script signals stale. The issue body inlines the report and points at the manual update procedure in §8.3.

Verified locally:
- Script parses 3 manifest rows correctly.
- Exit code 0 when all pinned, 1 when any stale.
- Honors `GITHUB_TOKEN` for higher API rate limits when present.
- Server-side only — `connect-src 'none'` invariant unchanged in shipped site.

Add `.github/workflows/dep-check.yml` running on a cron (`0 12 1 */3 *` — noon UTC, 1st of each quarter):

```yaml
name: Quarterly dependency check
on:
  schedule:
    - cron: '0 12 1 */3 *'
  workflow_dispatch: {}

permissions:
  contents: read
  issues: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Check for vendored library updates
        run: node scripts/check-dependency-updates.js
      - name: Open issue if updates found
        if: failure()
        uses: dacbd/create-issue-action@v1
        with:
          title: "Quarterly dep review: vendored libraries have updates"
          body: "See workflow run for details. Manually vendor and re-hash."
```

`scripts/check-dependency-updates.js` reads the `README.md` manifest, hits each upstream's GitHub releases API (via `https.get` from Node — server-side only, never in the browser, so this does not violate `connect-src`), compares the published version against the pinned version, and exits non-zero with a summary if any are stale.

**Why this is safe:** the script runs in GitHub Actions, not in the user's browser. The site itself never makes a network call. The Action just opens an issue when it's time for a manual review.

**Recommendation:** ship this in Phase 8 once Phase 6+7 land. Until then, keep maintenance manual — quarterly reminder on a personal calendar is cheaper than the workflow review.

### 8.3 — Update procedure (versioned in `README.md`)

When updating any vendored library:

1. Download the new minified file from the official upstream (link in the `README.md` manifest).
2. Save with the same filename.
3. Compute hash: `openssl dgst -sha384 -binary FILE | openssl base64 -A`.
4. Update the hash in **two** places: the HTML inline comment beside the `<script>` tag, and the row in the `README.md` manifest (which doubles as the verification block).
5. Update the version number in both places.
6. Run `node scripts/build-i18n-variants.js` (so locale variants get the same vendored hash).
7. Run `node scripts/audit-release.js` — must pass.
8. Test the affected tool(s) manually in a browser.
9. Commit all touched files together so the manifest never drifts from reality.

---

## Phase 9 — Release ritual (post-Phase-6/7/8)

For each batch (A, B, C, D in Phase 6, plus the SEO PR in Phase 7), the merge ritual is:

1. **Local pre-flight:**
   ```bash
   node scripts/build-i18n-variants.js
   node scripts/build-sitemap.js          # added in Phase 7
   node scripts/audit-release.js
   ```
   All three must exit 0.

2. **Manual smoke test (pre-merge):**
   - Round-trip each new tool's primary use case in the browser (e.g. Hash → known input produces known SHA-256).
   - Open the home grid, verify each new tool card is present and the description is correct.
   - Click into one new tool, click breadcrumb back, verify state.
   - Switch language to fr and verify translated chrome.
   - Mobile (Chrome DevTools 375px): home grid is 1-column, no horizontal scroll, all new tools tappable.

3. **Lighthouse:** run on `/`, `/fr/`, `/zh/`, `/de/`, `/hi/` — a11y must remain 100, SEO must remain 100 (Phase 7 should *raise* SEO score).

4. **Merge to main**, Cloudflare Pages auto-deploys.

5. **Post-deploy verify:**
   - `https://encryptalotta.com/favicon.ico` → 200.
   - `https://encryptalotta.com/sitemap.xml` → 200, valid XML.
   - `https://encryptalotta.com/robots.txt` → 200.
   - `https://encryptalotta.com/fr/` → French locale renders.
   - View source: JSON-LD block present, hreflang tags present.
   - Submit `sitemap.xml` to Google Search Console (one-time after Phase 7 PR merges).

6. **Track:** note unique-visitor count from Cloudflare Pages dashboard at week 0, week 4, week 12 post-Phase-7. Phase-7 SEO uplift should show up at week 4-8.

---

## Phase 10 — Long-tail polish (optional, post-launch)

Backlog of nice-to-haves that aren't shipping in Phase 6/7. Pull from this list when there's bandwidth.

- **Markdown preview tool** (~30 KB sanitizing renderer).
- **JSON Schema validator** (~50 KB AJV-style).
- **Password strength meter** (zxcvbn, ~150 KB).
- ~~**CIDR / subnet calculator**~~ — ✅ shipped. IPv4 only; pure 32-bit unsigned arithmetic in vanilla JS. Decodes network, broadcast, netmask (with binary view), wildcard, first/last usable host, total + usable address counts, legacy address class, RFC 1918 / loopback / link-local indicators. /31 (RFC 3021 point-to-point) and /32 (single host) handled correctly. ~110 lines including handler.
- **Per-tool `og:image` PNGs** for nicer link previews on social.
- **Native-speaker review** of fr/zh-CN/de/hi via the existing CSV round-trip.
- **Locale-specific JSON-LD** in each variant (`inLanguage` field).
- **Accessibility deep-pass** — Lighthouse 100 is a floor; do a screen-reader walkthrough with VoiceOver.
- **Light theme** — opt-in only; the dark default is intentional and on-brand.

---

## Out of scope (will not ship)

Same list as the v2 spec, plus:

- Anything requiring a network call, even with k-anonymity guards.
- Server-side anything.
- User accounts, sync, history.
- Cookie banners or consent UI (we don't set cookies).
- Service workers.
- WebAssembly heavy-lifting (e.g. wasm-built TLS parser) — keeps the audit surface readable.
- Marketing claims of "100% secure" or "no attack surface" — see `README.md` § "What this project does NOT claim".

---

## Suggested execution order

1. **Phase 6 Batch A** (Encoders & IDs) — ✅ shipped. Validated the "add 6 tools at once" workflow.
2. **Phase 6 Batch B** (Auth & Tokens) — ✅ shipped. JWT + TOTP. Highest-value-per-line in the spec.
3. **Phase 7** (SEO buildout) — ✅ shipped. `robots.txt`, `sitemap.xml` + builder, JSON-LD `WebApplication` + `FAQPage`, per-tool `<title>` + `<meta name="description">` swap, favicon link priority, per-tool `<details>` "About" prose blocks for all 31 tools (English-only with t()-fallback), per-tool "Related tools" cross-link strip, 4 new audit gates total.
4. **Phase 6 Batch C** (Format & Validate) — ✅ shipped (with TOML scope-cut). Diff, CSV↔JSON↔TSV, Regex Tester, and JSON/YAML/XML Formatter are live. js-yaml@4.1.0 vendored with SHA-384. TOML deliberately omitted — no small browser-ready parser exists without a build step.
5. **Phase 6 Batch D** (Crypto Inspectors & DevOps) — ✅ shipped. 5 tools (TLS Cert, SSH Key, PEM↔DER, Cron, Color) with hand-rolled ASN.1 / OpenSSH wire / OKLCH math. 0 KB vendored delta.
6. **Phase 8** (Dep-update GitHub Action) — ✅ shipped. Quarterly cron + `scripts/check-dependency-updates.js` opens an issue when any vendored library is behind upstream.
7. **Phase 10** items pulled in opportunistically.

Total work: 5 substantive PRs + 1 small one. Each is small enough to review in a single sitting.

---

## Acceptance criteria (rolled up)

For Phase 6+7 to be considered "done":

- [ ] All 17 new tools live, reachable from home grid, with deep-link routes.
- [ ] STRINGS parity at ~510 keys × 5 locales (machine-quality acceptable for non-en).
- [ ] `robots.txt` and `sitemap.xml` published; sitemap registered in Google Search Console.
- [ ] JSON-LD `WebApplication` block present, `featureList` length matches `TOOL_ORDER`.
- [ ] Per-tool `<title>` and `<meta name="description">` switches on navigation.
- [ ] Per-tool `<details>` "About" prose block on every tool (en, machine fr/zh/de/hi).
- [ ] "Related tools" strip rendered at bottom of each tool view.
- [ ] `audit-release.js` extended with 3 new SEO checks; all pass.
- [ ] Page weight ≤ 0.30 MB gzipped; SHA-384 manifest current.
- [ ] No new outbound network call sites introduced.
- [ ] No `innerHTML =` assignments introduced.
- [ ] Lighthouse a11y 100 on all 5 locales.
- [ ] Manual smoke test passes on desktop + mobile.
- [ ] `README.md` updated: tool list, SEO section, dep-update cadence.

For Phase 8 to be considered "done" (optional):

- [ ] `.github/workflows/dep-check.yml` runs quarterly and opens an issue on any stale dep.
- [ ] `scripts/check-dependency-updates.js` written and tested locally.
- [ ] Manual cadence still documented as the source of truth — the Action is a reminder, not an auto-merger.
