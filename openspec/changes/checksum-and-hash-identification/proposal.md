# Proposal — Checksums, non-cryptographic hashes, and hash identification

## Why

The Hash & Checksum tool computes SHA-1 / 2 / 3, BLAKE2b and BLAKE3 — but the checksums people actually meet in files, firmware, protocols and logs are different: **CRC-32** at the end of every ZIP entry and PNG chunk, **CRC-16/MODBUS** on every PLC frame, **CRC-32C** in iSCSI / ext4 / Btrfs, **CRC-64/XZ** in `.xz` streams, **Adler-32** in zlib (RFC 1950), **xxHash** and **MurmurHash3** as hash-table and dedup keys, **SipHash-2-4** inside Python, Rust and Redis dictionaries. None of these are on the site, and the online calculators that offer them see the firmware. Two adjacent gaps sit beside it: a reader holding `$argon2id$v=19$m=65536,t=3,p=4$…`, `$2b$12$…`, `{SSHA}…` or a bare 40-hex string has no way to learn *what* it is, and a reader holding `SHA256SUMS` and a downloaded ISO has no offline equivalent of `sha256sum -c`. The tool already has file hashing, constant-time comparison, BLAKE2b / SHA-3 engines, and the Argon2 tool's OWASP preset to judge parameters against.

## What Changes

- **Extends the shipped Hash & Checksum tool** (`hash`); **no new top-level tool**. No OpenSpec baseline exists for it yet, so every capability below is written as new.
- **CRC family**: a parametrized engine in the CRC RevEng catalogue model (width, poly, init, refin, refout, xorout, check) with presets CRC-8, CRC-16/CCITT-FALSE, CRC-16/MODBUS, CRC-16/XMODEM, CRC-16/ARC, CRC-32 (ISO 3309 / zlib), CRC-32C (Castagnoli), CRC-32/BZIP2, CRC-64/ECMA-182, CRC-64/XZ, each verified against its RevEng `check` value for `123456789`; custom parameters; text and file input.
- **Non-cryptographic hashes**: Adler-32, Fletcher-16 / 32, FNV-1 / FNV-1a 32 and 64, xxHash32 / xxHash64 with seed, MurmurHash3 x86_32 with seed, SipHash-2-4 with a 128-bit key — under a permanent "not for security: detects corruption, not tampering" banner.
- **Hash-type identification**: paste any digest or hash string and get ranked candidates by length, alphabet and prefix — raw hex / Base64 digests, PHC strings (`$argon2id$`, `$scrypt$`, `$pbkdf2-sha256$`), bcrypt, Unix crypt, LDAP, framework formats, OpenSSH `SHA256:` fingerprints, SRI `sha256-`, Git object ids, Base58Check — with PHC parameters decoded and judged against the Argon2 tool's OWASP preset.
- **Manifest check**: paste a `sha256sum` / `b2sum` / `shasum -a 512` / BSD-style / `.md5` manifest, drop the files, and get match / mismatch / missing per line — the offline `sha256sum -c`.
- Related-tool links: Hash ↔ Argon2 ↔ PBKDF2 / scrypt ↔ File Type Identifier ↔ Binary Decoder ↔ Base64 / 58.

Out of scope (and the §7 non-goal it respects): no MD5 / MD4 / NTLM *computation* (the identifier names them; computing them would invite their use — the site's stance since draft 1), no password cracking, rainbow-table or "reverse this hash" lookup (§0.1 / §7.5: nothing is looked up anywhere; §7.2: no credential-handling product), no CRC *reverse-engineering* from samples (RevEng's `-s` mode is a research tool, not a toolbox feature), no GPG-signed manifest verification here (the PGP Verify tool does that; the manifest check links to it).

## Capabilities

### New Capabilities
- `crc-family-checksums`: parametrized CRC engine with RevEng presets and custom parameters, verified against the catalogue `check` values.
- `non-cryptographic-hashes`: Adler-32, Fletcher, FNV, xxHash, MurmurHash3, SipHash-2-4 with published test vectors and a not-for-security banner.
- `hash-type-identification`: candidate identification of digests and password-hash strings, with PHC / bcrypt / crypt parameter decoding.
- `digest-comparison-and-manifest-check`: checksum-manifest parsing and per-file match / mismatch / missing verification.

### Modified Capabilities
- none (the existing SHA / BLAKE / SHAKE panels keep their behaviour; the new panels sit beside them in the same view).

## Impact

- `index.html`: four new sub-panels in `#hash-view`, ~650 lines of inline JS (generic CRC engine with table generation, eight hash functions, identifier rule table ~60 patterns, manifest parser), ~55 STRINGS keys × 5 locales + 5 en SEO keys (appended to the existing `hash.*` namespace).
- Reuses: the existing file-reading path and `crypto.subtle.digest` for SHA-1 / 256 / 384 / 512 in the manifest check, the hand-rolled BLAKE2b / SHA-3 for `b2sum` / `sha3sum` manifests, the constant-time comparison, Base58Check decode from the encoder, the Argon2 tool's preset table for the OWASP comparison, `Intl.NumberFormat` for byte counts, STRINGS i18n.
- No new vendored file, no CSP change, page weight +~11 KB gzipped.
- Tests: new `tests/specs/NN-checksums.spec.js` (number assigned at implementation; 29+) — the ten RevEng check values, Adler-32 `091E01DE`, published xxHash / Murmur / SipHash vectors, identification of twenty sample strings, a three-file manifest with one tampered file, and the "no network" assertion the suite already uses.
