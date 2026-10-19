# Tasks — Key Format Converter / PKCS#12 Inspector

## 1. Key record and format engine

- [ ] 1.1 Key record type and readers: `keyReadPkcs1Rsa`, `keyReadSec1Ec`, `keyReadPkcs8` (RSA / EC / Ed25519 / X25519; `[1] publicKey` optional), `keyReadOpenssh` (`openssh-key-v1`, cipher `none` only; encrypted → structured "encrypted" result), `keyReadJwk` (RSA / EC / OKP private and public), `keyReadSpki`, `keyReadOpensshPublic` (RFC 4253 line, RFC 4716 block) — all on the existing ASN.1 reader and `sshReadString()`.
- [ ] 1.2 Writers for the same seven forms, using the existing DER writer; OpenSSH writer per `sshkey.c` (checkint pair, per-type fields, comment, 8-byte padding, 70-column armor).
- [ ] 1.3 Web Crypto bridging: RSA / EC `importKey('pkcs8' | 'jwk', extractable)` → `exportKey('jwk' | 'pkcs8')`; Ed25519 / X25519 public derivation via `exportKey('jwk')` when supported, else `[1] publicKey` or a support error.
- [ ] 1.4 Auto-detection by PEM label, `openssh-key-v1` magic, JSON `kty`, or `ssh-` / `ecdsa-sha2-` / `ssh-ed25519` line prefix.
- [ ] 1.5 Node-side round-trip check over OpenSSL 3 and `ssh-keygen` fixtures: every type × every pair, byte-equal to the reference where the format is canonical (PKCS#8, PKCS#1, SEC1, SPKI, OpenSSH public), structurally equal for OpenSSH private (random checkint) and JWK (member order).

## 2. PBES2 engine

- [ ] 2.1 `pbes2ReadParams(algId)` — PBKDF2 salt / iterations / keyLength / PRF (HMAC-SHA-1 default, SHA-256 / 384 / 512), scheme AES-128 / 192 / 256-CBC; AES-GCM with RFC 5084 parameters accepted and labelled; PBES1 and unknown OIDs → "not decrypted" with the OID.
- [ ] 2.2 `pbes2Decrypt(encryptedPrivateKeyInfo, passphrase)` and `pbes2Encrypt(pkcs8, passphrase, {iterations, prf})` via Web Crypto PBKDF2 + AES-CBC; defaults PBKDF2-HMAC-SHA-256 / 2048 / AES-256-CBC; floor 1,000 iterations, warn under 100,000.
- [ ] 2.3 Node-side check against `openssl pkcs8 -topk8 -v2 aes-256-cbc` fixtures (default and `-v2prf hmacWithSHA512 -iter 100000`), wrong-passphrase detection via PKCS#7 padding + ASN.1 parse failure.

## 3. PKCS#12 engine

- [ ] 3.1 `pkcs12KdF(hashName, id, password, salt, iterations, length)` per RFC 7292 Appendix B (UTF-16BE password with trailing NUL, 64-byte v, B-vector addition) over Web Crypto SHA-1 / SHA-256.
- [ ] 3.2 `pfxParse(der)` — version 3, AuthenticatedSafe (`data` / `encryptedData`), MacData (digest algorithm, salt, iterations), SafeContents, SafeBags with OIDs: keyBag, pkcs8ShroudedKeyBag, certBag (x509Certificate), crlBag, secretBag, safeContentsBag (nested); bagAttributes friendlyName (BMPString) and localKeyId.
- [ ] 3.3 `pfxUnlock(pfx, password)` — MAC verification (HMAC-SHA-256 / SHA-1 with the KDF key, constant-time), PBES2 safes and shrouded keys via 2.2; legacy `pbeWithSHAAnd3-KeyTripleDES-CBC` / `pbeWithSHAAnd40BitRC2-CBC` → decoded, labelled "legacy PBE — not decrypted in this slice"; key ↔ cert pairing by localKeyId.
- [ ] 3.4 Node-side check against OpenSSL 3 default and `-legacy` PFX fixtures, wrong-password MAC failure, PFX without MacData.
- [ ] 3.5 Slice 2 (separate task group at implementation): hand-rolled 3DES-EDE-CBC (~150 lines) with the Appendix B KDF (ID 1 key, ID 2 IV) for `pbeWithSHAAnd3-KeyTripleDES-CBC` only; RC2 stays unimplemented.

## 4. View

- [ ] 4.1 `#keyconv-view`: converter panel (`#keyconv-input` masked textarea + file, `#keyconv-passphrase`, `#keyconv-target` select, `#keyconv-comment`, encrypt-output toggle with `#keyconv-iterations` / `#keyconv-prf`, `#btn-keyconv-convert`, `#keyconv-output` masked with reveal / copy / download, `#keyconv-results` key rows: type, size / curve, SPKI SHA-256 fingerprint, SSH fingerprint); PKCS#12 panel (`#keyconv-p12-file`, `#keyconv-p12-password`, `#btn-keyconv-p12-inspect`, `#keyconv-p12-results` bag tree, `#btn-keyconv-p12-open-cert`, `#btn-keyconv-p12-use-key`).
- [ ] 4.2 Register all four secret fields with `clearSensitiveFields()`; zero-fill record buffers after each operation; no URL / `localStorage` persistence.
- [ ] 4.3 Hand-offs: certBag → `tlsCertParseDer()` in the TLS Certificate Parser view; decrypted key → converter record; public-only outputs → JWK ↔ PEM tool link.
- [ ] 4.4 Info panel: endpoint caveat, portable-build recommendation, legacy-PBE explanation, OWASP iteration note.

## 5. Tests

- [ ] 5.1 Fixtures under `tests/fixtures/keyconv/` from a documented OpenSSL 3 + `ssh-keygen` script (RSA-2048, P-256 / 384 / 521, Ed25519, X25519 in every format; encrypted PKCS#8 default and high-iteration; default PFX, `-legacy` PFX, PFX without MAC, PFX with two key / cert pairs).
- [ ] 5.2 `tests/specs/32-keyconv.spec.js` (number assigned at implementation): every conversion pair, OpenSSH padding / checkint checks, PBES2 decrypt / encrypt round trip and wrong-passphrase message, PFX bag listing before password, MAC ✓ / ✗, PBES2 bag decryption, legacy bags labelled and not decrypted, cert hand-off, output masked by default, fields cleared on unload, network-silence assertion, XSS payload in a friendlyName rendered inert.
- [ ] 5.3 Register `keyconv` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~50 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n bags".
- [ ] 6.2 TOOL_ORDER (after `jwk`), TOOL_TO_GROUP keys, TOOL_SYNONYMS (`pkcs12 pfx p12 pkcs8 pkcs1 openssh id_rsa id_ed25519 jwk convert private key pbes2 passphrase`), RELATED_TOOLS (keyconv ↔ jwk ↔ pem-der ↔ tls-cert ↔ ssh-key ↔ asn1), JSON-LD featureList entry; audit gate 20 tool count +1.
- [ ] 6.3 README: Features list (Keys +1), standards cheat sheet rows (RFC 7292 + Appendix B, RFC 5958, RFC 8018, RFC 8017, RFC 7517 / 7518 / 8037, OpenSSH PROTOCOL.key), Per-Tool Security Notes paragraph on secret handling; SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
