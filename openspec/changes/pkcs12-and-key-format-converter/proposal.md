# Proposal — Key Format Converter / PKCS#12 Inspector

## Why

Private keys arrive in five incompatible wrappers — PKCS#1 (`BEGIN RSA PRIVATE KEY`, RFC 8017), SEC1 (`BEGIN EC PRIVATE KEY`), PKCS#8 (`BEGIN PRIVATE KEY`, RFC 5958; encrypted per PBES2, RFC 8018), OpenSSH `openssh-key-v1`, and JWK (RFC 7517 / 7518 / 8037) — and the most common way to move between them is `openssl pkey` on a machine that has OpenSSL, or a web converter that receives the private key. PKCS#12 / PFX files (RFC 7292) are worse: they bundle keys and certificates behind two layers of password-based encryption, and the only way to see what is inside without `openssl pkcs12 -info` is to upload them. The site already converts public keys (JWK ↔ PEM tool, PEM ↔ DER), decodes any DER (ASN.1 tool), parses certificates and CSRs with the hand-rolled ASN.1 reader, and has PBKDF2 and AES via Web Crypto. Private-key conversion and PFX inspection are the missing half, and they are exactly the operations users should never do on someone else's server.

## What Changes

- **New tool `keyconv` — "Key Format Converter / PKCS#12 Inspector"** in Keys, next to JWK ↔ PEM and PEM ↔ DER. Tool count **+1** (57 → 58 in its own right; numbering assigned at implementation order).
- **Private-key conversion**: PKCS#1 ↔ PKCS#8 ↔ OpenSSH (unencrypted `openssh-key-v1`) ↔ JWK for RSA, EC P-256 / 384 / 521, Ed25519, and X25519; SPKI ↔ OpenSSH public line (RFC 4253 / 4716) for the same types. Encrypted PKCS#8 (PBES2 with PBKDF2 and AES-CBC) is decrypted, and PKCS#8 can be encrypted the same way via Web Crypto. Private material is masked by default, cleared on unload, and never written to the URL.
- **PKCS#12 inspection**: parse a PFX per RFC 7292 — MacData (HMAC-SHA-256 / -SHA-1 verified with the hand-rolled PKCS12KDF, Appendix B), AuthenticatedSafe, SafeContents, SafeBags (keyBag, pkcs8ShroudedKeyBag, certBag, with friendlyName and localKeyId attributes); PBES2 + AES bags decrypted via Web Crypto; legacy `pbeWithSHAAnd3-KeyTripleDES-CBC` and `pbeWithSHAAnd40BitRC2-CBC` bags are decoded as "legacy PBE — not decrypted in this slice". Certificates hand off to the TLS Certificate Parser, keys to the converter panel.

Out of scope, and the §7 non-goal each respects: no encrypted `openssh-key-v1` decryption (bcrypt_pbkdf needs Blowfish — reported, not decrypted; the SSH change owns that file format's inspection); no RC2 ever and no 3DES in slice 1 (hand-rolled 3DES is a ~150-line slice-2 decision recorded in the design); no PFX *creation* (an invented bundle is a liability, and OpenSSL does it offline already); no key generation here (the PGP, Ed25519, X25519, and PQC tools generate); no cloud / HSM / PKCS#11 (§7.9); no WASM (§7.6); no `known_hosts` / `authorized_keys` linting (SSH change).

## Capabilities

### New Capabilities
- `private-key-format-conversion`: PKCS#1 / SEC1 ↔ PKCS#8 ↔ OpenSSH ↔ JWK conversion for RSA, EC, Ed25519, X25519; SPKI ↔ OpenSSH public; PBES2 decrypt and encrypt (RFC 8018) via Web Crypto; secret-field handling.
- `pkcs12-inspection`: RFC 7292 PFX parsing, MAC verification with PKCS12KDF, PBES2 bag decryption, legacy-PBE reporting, and hand-off of certificates and keys to the existing tools.

### Modified Capabilities
- none (JWK ↔ PEM, PEM ↔ DER, and the TLS Certificate Parser are unchanged; they gain related-tool links only).

## Impact

- `index.html`: one new view, ~800 lines of inline JS (PKCS#1 / SEC1 / PKCS#8 wrappers and unwrappers, `openssh-key-v1` reader and writer with its checkint and padding rules, JWK bridging through Web Crypto for RSA / EC and by hand for OKP, PBES2 / PBKDF2 AlgorithmIdentifier reader and writer, PKCS#12 walker, PKCS12KDF), ~50 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: hand-rolled ASN.1 / DER reader (`tls-cert`, `asn1`, `csr`) plus the DER writer from the PEM ↔ DER and JWK tools, `sshReadString()` and the SSH wire-format parser, the OKP 12-byte SPKI prefix from the JWK tool, Web Crypto PBKDF2 / AES-CBC / AES-GCM / HMAC / `importKey` / `exportKey('jwk')`, SHA-1 / SHA-256 via Web Crypto, Base64 / hex codecs, `clearSensitiveFields()`, `tlsCertParseDer()` for hand-off, STRINGS i18n table.
- No new vendored file, no CSP change, page weight +~11 KB gzipped.
- Tests: new `tests/specs/32-keyconv.spec.js` (number assigned at implementation) — fixtures generated once with OpenSSL 3 and `ssh-keygen` for every key type in every format, PBES2 encrypted PKCS#8 with the OpenSSL 3 defaults (PBKDF2 2048 iterations, AES-256-CBC), an OpenSSL 3 default PFX (PBES2, MAC HMAC-SHA-256) and a `-legacy` PFX (3DES / RC2-40), wrong-password cases, round trips through every pair, the private-key masking and unload-clear checks, and the network-silence assertion the suite already uses.
