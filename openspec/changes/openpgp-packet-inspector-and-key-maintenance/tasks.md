# Tasks — OpenPGP packet inspector and key maintenance

## 1. Packet engine

- [ ] 1.1 `pgpHeaderWalk(bytes) → [{tag, formatLegacy, lengthEncoding, headerLen, bodyLen, offset, partial}]` per RFC 9580 §4.2 (new and legacy headers, one / two / five-octet and partial-body lengths); dearmor via `openpgp.unarmor` or the existing ASCII Armor tool path.
- [ ] 1.2 `pgpPacketDump(input)` → `readKey` / `readPrivateKey` / `readMessage` / `readSignature` by armor header or by first tag; `toPacketList()` zipped with the walker; graceful fallback to walker-only rows when OpenPGP.js throws.
- [ ] 1.3 Name tables: public-key, hash, symmetric, AEAD, compression algorithms (§9); S2K specifiers (§3.7.1); signature types (§5.2.1); subpacket types with key-flag bit names and features bits (§5.2.3.7); literal-data format letters (§5.9).
- [ ] 1.4 Per-packet renderers: key packets (version, creation time, algorithm, size / curve, fingerprint, key ID; secret-key S2K usage octet, S2K, AEAD / cipher); signature packets (type, version, algorithms, hashed vs unhashed subpackets, left-16 hash bits, embedded signature recursion); PKESK / SKESK; SEIPD v1 / v2 (mode, chunk size); compressed; literal; user ID / attribute; padding (tag 20); marker.
- [ ] 1.5 Node-side check: a v4 Curve25519 key's packets are 6 / 13 / 2 / 14 / 2 with contiguous offsets summing to the binary length; a v6 key reports version 6 and 32-byte fingerprints.

## 2. Deep view and gates

- [ ] 2.1 `pgpDeepView(key)` → primary, `subkeys[]` (flags from the binding signature, expiry, revocation, algorithm), `users[]` (self-certification count and newest date, other-certification count, revocation), preferences and features from the primary user's self-signature.
- [ ] 2.2 Gate rows (`{ok, label, detail, clause}`): SHA-1 / MD5 self-signature, DSA / ElGamal, RSA < 3072, expired component, no encryption-capable subkey, primary carries encrypt flag, version 3, weak preferred cipher first, SEIPD v2 feature (⚠), revoked component.
- [ ] 2.3 Quantum-safe row via `pqc-readiness-indicator` when present, local fallback otherwise.

## 3. Maintenance operations

- [ ] 3.1 `pgpMaintain.setExpiry`, `.changePassphrase`, `.addUserId`, `.revokeUserId`, `.revokeSubkey`, `.addEncryptionSubkey` — each `(privateKey, params) → {newKey, notes[]}` over the OpenPGP.js calls named in the design; re-import the result through `readPrivateKey` as a self-check before returning.
- [ ] 3.2 `keyInfoRowModel(key)` extracted from the existing Key Info renderer; `keyInfoDiff(before, after)` marking changed / added / removed rows.
- [ ] 3.3 Passphrase handling: decrypt once per operation, drop the decrypted object, clear the fields; empty-passphrase export gated by an explicit ⚠ confirmation checkbox.

## 4. WKD and Autocrypt

- [ ] 4.1 `zbase32Encode(bytes)`; `wkdUrls(email) → {advanced, direct, policyAdvanced, policyDirect, hash}`; check against the draft's `Joe.Doe@Example.ORG` example.
- [ ] 4.2 `autocryptParse(header)` → `{addr, preferEncrypt, keyBytes, extra}`; `autocryptBuild(publicKey, addr, preferEncrypt)` producing a minimal key `PacketList` (primary, matching user ID, self-signature, one encryption subkey, binding signature), Base64, folded at 76 columns.

## 5. View

- [ ] 5.1 Tab strip in `#key-info-view`: Summary (existing), Packets (`#key-info-packets`, per-packet rows with `#key-info-packet-<n>` disclosure, hex offsets, `#btn-key-info-dump`, raw-hex toggle), Maintain (`#key-info-private`, `#key-info-passphrase`, operation selector `#key-info-op`, operation fields `#key-info-op-*`, `#btn-key-info-apply`, diff `#key-info-diff`, export `#key-info-export`, `#btn-key-info-download`, `#btn-key-info-export-public`), WKD / Autocrypt (`#key-info-wkd-email`, `#btn-key-info-wkd`, `#key-info-autocrypt-input`, `#btn-key-info-autocrypt-decode`, `#btn-key-info-autocrypt-build`).
- [ ] 5.2 Gate list `#key-info-gates` under the Summary; quantum-safe row placement shared with `pqc-signatures-and-kems`.
- [ ] 5.3 Generate PGP Keys: "Maintain this key" handoff button loading the generated private key into the Maintain tab.
- [ ] 5.4 Dates via `Intl.DateTimeFormat`; "expires in …" via `Intl.RelativeTimeFormat`; URLs rendered as text; related links to Revocation Certificate, ASCII Armor, Decrypt, Verify.

## 6. Tests

- [ ] 6.1 `tests/specs/33-pgp-packets.spec.js` (number assigned at implementation): v4 and v6 key dumps (tags, versions, offsets), legacy-format RSA key with SHA-1 self-signature (walker + weak gate ✗), signed message dump (OPS / literal / signature), SEIPD v2 message mode row, unknown-algorithm fallback rows, deep view subkey flags and expiry, each maintenance operation's diff rows and re-import, passphrase clear on apply and `pagehide`, WKD vector, Autocrypt decode → Key Info and build → decode round trip, verdict wording, network-silence assertion, XSS payload in a user ID and a notation rendered inert.
- [ ] 6.2 Extend the `key-info` and `generate` entries in 00-introspect, 05-a11y, 08-stress, 11-xss for the new controls.

## 7. Wiring and gates

- [ ] 7.1 ~65 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys updated for Key Info.
- [ ] 7.2 TOOL_SYNONYMS for `key-info` (`packets pgpdump list-packets subkey expiry passphrase revoke uid wkd autocrypt rfc9580 argon2 s2k`), RELATED_TOOLS (key-info ↔ generate ↔ revoke ↔ armor ↔ decrypt), JSON-LD featureList description; audit gate 20 tool count unchanged (57).
- [ ] 7.3 README: Key Info and Generate paragraphs, standards cheat sheet rows (RFC 9580; draft-koch-openpgp-webkey-service; Autocrypt Level 1; RFC 6189 z-base-32), Per-Tool Security Notes (private key stays in the tab; no keyserver); SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
