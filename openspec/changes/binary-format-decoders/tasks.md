# Tasks — Binary Decoder

## 1. Shared input and hexdump engine

- [ ] 1.1 Promote the CBOR decoder's byte cursor to `ByteCursor` (`u8 / u16 / u32 / u64 (BigInt) / bytes / remaining`, bounds errors as `{offset, expected, found}`); repoint the CBOR call site; confirm the existing CBOR Playwright cases pass unchanged.
- [ ] 1.2 `bindecParseInput(text | File) → Uint8Array` with hex / Base64 / Base64url / `data:` URI detection and a manual override.
- [ ] 1.3 `hexdumpRender(bytes, {perRow})`, `entropyWindows(bytes, 256)`, `byteHistogram(bytes)`, `stringsScan(bytes, {min: 4, utf16: true})`, magic hint via `filetypeIdentify()`; virtualized rows above 64 KiB.

## 2. Structured decoders

- [ ] 2.1 `protobufDecode(bytes, depth) → fields[]` per the Protocol Buffers Encoding documentation: tag varint → field number / wire type; VARINT (unsigned / zigzag / bool), I64 (fixed64 / sfixed64 / double), I32 (fixed32 / sfixed32 / float), LEN heuristics (nested → UTF-8 → packed varints → bytes), SGROUP / EGROUP reported deprecated; reserved range 19000–19999 flagged.
- [ ] 2.2 `msgpackDecode(bytes) → value` and `msgpackEncode(value) → Uint8Array` covering every row of the spec's format table; timestamp ext −1 (32 / 64 / 96-bit) → ISO 8601; `$bin` / `$ext` JSON conventions; BigInt beyond 2^53 as string.
- [ ] 2.3 `bencodeDecode(bytes) → {value, ranges}` per BEP 3 with byte-range tracking; `torrentSummary(value, bytes)` computing v1 SHA-1 / v2 SHA-256 info-hashes over the original slice via Web Crypto `digest`; magnet string per BEP 9 (text only).
- [ ] 2.4 Verify: protobuf `08 96 01` → field 1 varint 150 and `12 07 74 65 73 74 69 6e 67` → field 2 string `testing`; MessagePack spec examples (`{"compact":true,"schema":0}` ↔ 18 bytes `82 a7 63 6f 6d 70 61 63 74 c3 a6 73 63 68 65 6d 61 00`); bencode `d3:bar4:spam3:fooi42ee`; fixture torrent info-hash matches a value precomputed with `openssl sha1` over the sliced `info` dict.

## 3. Authenticator export (TOTP tool)

- [ ] 3.1 `otpMigrationDecode(uri) → {version, batchSize, batchIndex, batchId, accounts[]}` = URL-decode `data=`, Base64-decode, `protobufDecode`, map through the reconstructed `MigrationPayload` / `OtpParameters` field table; unknown fields kept raw.
- [ ] 3.2 `otpauthUriFromAccount(acct)` with Base32 (RFC 4648 §6) via the Base64 / 32 / 58 encoder's `base32Encode`; HOTP `counter`; algorithm / digits mapping.
- [ ] 3.3 Synthetic fixture: build a payload from the field table with a known 20-byte secret, encode it, and assert the decoded `otpauth://` URI and the TOTP code it produces (RFC 6238 Appendix B vector time steps).

## 4. Views

- [ ] 4.1 `#bindec-view`: `#bindec-input` textarea, `#bindec-file` input, `#bindec-format` select (auto / hexdump / protobuf / msgpack / bencode), `#bindec-per-row` select, `#btn-bindec-decode`, `#btn-bindec-encode-msgpack`, `#bindec-results` (dump grid, entropy strip, histogram, strings list, decoded tree), `#bindec-gates` (parse-position errors, reserved fields, unsorted dict keys), `#bindec-torrent` summary block, `#btn-bindec-copy-magnet`.
- [ ] 4.2 TOTP sub-panel in `#totp-view`: `#totp-migration-input`, `#totp-migration-file` (QR image → `qrDecodeImage`), `#btn-totp-migration-decode`, `#totp-migration-results` (per-account rows, masked secret + `#btn-totp-migration-reveal`, `#btn-totp-migration-load-N`, `#btn-totp-migration-qr-N`), red live-secrets banner; clear all nodes and inputs on view change.
- [ ] 4.3 All rendering via `createElement` / `textContent`; magnet and `otpauth://` strings rendered as text, never `<a href>`.

## 5. Tests

- [ ] 5.1 `tests/specs/NN-bindec.spec.js` (number assigned at implementation; 29+): hexdump of a 40-byte vector (row layout, ASCII column), entropy high / low windows, strings hits, protobuf documentation vectors + nested message + group deprecation, MessagePack round trips incl. timestamp ext, bencode example + fixture torrent info-hash + magnet text, v2 torrent SHA-256, truncated input error offset, migration payload decode → TOTP code, masked-by-default assertion, clear-on-unload assertion, network-silence assertion, XSS payload in a `name` field rendered inert.
- [ ] 5.2 Register `bindec` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS (1 MiB random input), 11-xss rosters; extend the existing TOTP rows.

## 6. Wiring and gates

- [ ] 6.1 ~60 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n accounts" and "n pieces".
- [ ] 6.2 TOOL_ORDER (after `format`), TOOL_TO_GROUP utilities, TOOL_SYNONYMS (`hexdump xxd protobuf protocol buffers wire msgpack messagepack bencode torrent info-hash magnet entropy strings google authenticator export migration otpauth-migration`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (Protocol Buffers Encoding, MessagePack spec, BEP 3 / 9 / 52, RFC 4648 §6), Per-Tool Security Notes paragraph (live 2FA secrets; reconstructed schema); SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
