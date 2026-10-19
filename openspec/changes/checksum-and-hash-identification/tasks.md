# Tasks — Checksums, non-cryptographic hashes, and hash identification

## 1. CRC engine

- [ ] 1.1 `crcCompute(bytes, {width, poly, init, refin, refout, xorout})` with the table-driven reflected path (`Uint32Array` ≤ 32 bits, `BigUint64Array` for 64) and the bitwise MSB-first fallback; `crcTable(params)` memoized per preset.
- [ ] 1.2 `CRC_PRESETS` — the ten RevEng catalogue rows with `check` values (CRC-8 F4, CRC-16/CCITT-FALSE 29B1, CRC-16/MODBUS 4B37, CRC-16/XMODEM 31C3, CRC-16/ARC BB3D, CRC-32 CBF43926, CRC-32C E3069283, CRC-32/BZIP2 FC891918, CRC-64/ECMA-182 6C40DF5F0B497347, CRC-64/XZ 995DC9BBDF1939FA); reflected-form polynomial shown beside the normal form.
- [ ] 1.3 Custom-parameter form validation (width 1–64, hex fields of the right length, booleans) and a live "check value for `123456789`" preview.

## 2. Non-cryptographic hashes

- [ ] 2.1 `adler32`, `fletcher16`, `fletcher32`, `fnv1_32`, `fnv1a_32`, `fnv1_64`, `fnv1a_64` (BigInt), `xxhash32(bytes, seed)`, `xxhash64(bytes, seed)` (BigInt), `murmur3_x86_32(bytes, seed)`, `siphash24(bytes, key16)` (BigInt) — all hand-rolled pure JS.
- [ ] 2.2 Node-side vector check: Adler-32 `123456789` → 091E01DE and `Wikipedia` → 11E60398; Fletcher-16 `abcde` → C8F0, Fletcher-32 `abcde` → F04FC729; FNV-1a 32 `a` → E40C292C, FNV-1a 64 `a` → AF63DC4C8601EC8C; xxHash32 empty → 02CC5D05, xxHash64 empty → EF46DB3751D8E999; Murmur3 `hello` seed 0 → 248BFA47; SipHash-2-4 paper vector → A129CA6149BE45E5.

## 3. Identifier and manifest engines

- [ ] 3.1 `HASH_ID_RULES` (~60 ordered rules): PHC family, bcrypt, Unix crypt `$1$ $5$ $6$ $7$ $y$`, LDAP `{SSHA} {SHA} {CRYPT} {MD5} {SMD5}`, Django, Drupal `$S$`, OpenSSH `SHA256:`, SRI `sha256-/384-/512-`, Git object ids, Base58Check (via the encoder), hex / Base64 digests by byte length.
- [ ] 3.2 `hashIdentify(str) → {structured?, candidates[], params?, verdict?}`; PHC / crypt / bcrypt parameter decode; OWASP comparison against the Argon2 tool's preset constants and the PBKDF2 tool's NIST / OWASP preset.
- [ ] 3.3 `manifestParse(text, fileName) → lines[{digest, name, algoHint, binary}]` for GNU, BSD, bare and single-space shapes, with coreutils `\` escape handling.
- [ ] 3.4 `manifestVerify(lines, files, algo)` → OK / FAILED / missing / extra using `crypto.subtle.digest`, BLAKE2b, Keccak, and the existing constant-time comparison; MD5 lines reported as not computable.

## 4. View

- [ ] 4.1 Four `<details>` panels in `#hash-view`: `#hash-crc-details` (`#hash-crc-preset` select, custom fields `#hash-crc-width` `#hash-crc-poly` `#hash-crc-init` `#hash-crc-refin` `#hash-crc-refout` `#hash-crc-xorout`, `#btn-hash-crc`, `#hash-crc-results`); `#hash-fast-details` (`#hash-fast-seed`, `#hash-fast-sipkey`, `#btn-hash-fast`, `#hash-fast-results`, persistent not-for-security banner); `#hash-identify-details` (`#hash-identify-input`, `#btn-hash-identify`, `#hash-identify-results`); `#hash-manifest-details` (`#hash-manifest-text`, `#hash-manifest-file`, `#hash-manifest-files`, `#hash-manifest-algo`, `#btn-hash-manifest`, `#hash-manifest-results`, `#hash-manifest-gates`).
- [ ] 4.2 Reuse the view's existing text / file input for CRC and fast-hash input; progress indicator and 512 MiB ⚠; `createElement` / `textContent` only.
- [ ] 4.3 Wording per the verdict-language requirements; link rows to Argon2, PBKDF2 / scrypt, PGP Verify, Passphrase Strength Estimator, File Type Identifier.

## 5. Tests

- [ ] 5.1 `tests/specs/NN-checksums.spec.js` (number assigned at implementation; 29+): all ten preset `check` values, a custom-parameter CRC equal to a preset, the eight fast-hash vectors, seed / key variation, twenty identification samples (incl. `$argon2id$v=19$m=65536,t=3,p=4$…` → above OWASP, `$2b$04$…` → cost 4 below 10 ⚠, bare 64-hex → four candidates), GNU / BSD / bare manifests with one tampered and one missing file, MD5 line not computable, banner presence, network-silence assertion, XSS payload in a manifest file name rendered inert.
- [ ] 5.2 Extend the existing `hash` rows in 00-introspect, 05-a11y, 08-stress (new panels open), 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~55 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys in the `hash.*` namespace; CLDR plural group for "n files OK / failed / missing".
- [ ] 6.2 TOOL_SYNONYMS for `hash` extended (`crc crc32 crc32c crc16 modbus xmodem adler32 fletcher fnv xxhash murmur siphash checksum identify hash type bcrypt argon2 phc sha256sum manifest verify`), RELATED_TOOLS both directions, JSON-LD featureList entry text updated; audit gate 20 tool count unchanged at 57 (no new top-level tool).
- [ ] 6.3 README: Hash & Checksum feature paragraph, standards cheat sheet rows (CRC RevEng catalogue, RFC 1950 Adler-32, SipHash paper, PHC string format), Per-Tool Security Notes paragraph (integrity-only banner, no MD5 computation, no cracking); SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
