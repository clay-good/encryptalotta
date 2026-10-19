# Design — Key Format Converter / PKCS#12 Inspector

## Context

Every format here is a wrapper around the same few integers or byte strings, so the engine is mostly ASN.1 and SSH-string plumbing. The page already has a DER reader (`asn1Parse()` and the X.509 / CSR walkers), a small DER writer (PEM ↔ DER, JWK → SPKI), an SSH wire reader (`sshReadString()`), and the fixed OKP SPKI prefix trick from the JWK tool. Web Crypto supplies PBKDF2, AES-CBC / AES-GCM, HMAC, and — importantly — `importKey('pkcs8')` + `exportKey('jwk')` for RSA and EC, which yields every private JWK member (`d, p, q, dp, dq, qi`) without hand-rolled big-integer work. For Ed25519 the JWK export of a private key includes `x`, which is how the public key is recovered when a PKCS#8 file omits the optional `[1] publicKey`.

PKCS#12 (RFC 7292) layers: PFX → MacData (optional) + AuthenticatedSafe (ContentInfo `data` or `encryptedData`) → SafeContents → SafeBag (keyBag, pkcs8ShroudedKeyBag, certBag, …) with bagAttributes (friendlyName BMPString, localKeyId OCTET STRING). OpenSSL 3 defaults: PBES2 / PBKDF2 2048 iterations / AES-256-CBC for both shrouded keys and the encryptedData safe; MAC HMAC-SHA-256 with the key derived by the PKCS#12 KDF (Appendix B, ID = 3), 2048 iterations. `openssl pkcs12 -legacy` still produces `pbeWithSHAAnd3-KeyTripleDES-CBC` (keys) and `pbeWithSHAAnd40BitRC2-CBC` (certs), with the Appendix B KDF (ID 1 key, ID 2 IV); 3DES and RC2 are not in Web Crypto.

## Goals / Non-Goals

**Goals:**
- Any of the five private-key encodings in, any of them out, for RSA / EC P-256 / 384 / 521 / Ed25519 / X25519, byte-compatible with OpenSSL 3 and OpenSSH 9.
- Encrypted PKCS#8 in (PBES2 / PBKDF2 / AES-CBC) and out, defaulting to the OpenSSL 3 parameters so the output opens anywhere.
- A PFX is fully listed — bag types, attributes, algorithms, iteration counts, MAC — before any password is typed; the password unlocks the rest.
- Private material is treated like the page's other secrets: masked, cleared on unload, never in the URL.

**Non-Goals:**
- Encrypted `openssh-key-v1` decryption (bcrypt_pbkdf → Blowfish). Reported, deferred; the SSH change inspects the header.
- RC2 (never: 40-bit, no legitimate current use) and 3DES in slice 1 (slice 2 decision below).
- PFX writing, key generation, key strength assessment, PKCS#11 / HSM anything.
- PBES1 (RFC 8018 §6.1, MD5 / SHA-1 with DES / RC2) outside the PKCS#12 legacy case: decoded, labelled, not decrypted.
- DSA keys: reported as "DSA — not converted" (OpenSSH dropped DSA in 9.8; no Web Crypto support).

## Decisions

1. **Normalise to one in-memory key record, then re-encode.** `{kind: 'RSA' | 'EC' | 'OKP', curve?, n, e, d, p, q, dp, dq, qi | x, y, d | pub, priv, comment?}` with all values as `Uint8Array`. Every reader produces this, every writer consumes it. Rejected: pairwise converters (20 code paths).
2. **Web Crypto for RSA / EC JWK bridging and all PBES2 cryptography; pure JS for ASN.1, SSH framing, OKP, and PKCS12KDF.** RSA / EC: `importKey('pkcs8', …, {extractable: true})` → `exportKey('jwk')` → record; reverse via `importKey('jwk')` → `exportKey('pkcs8')`. `extractable: true` is required and the key handle is dropped immediately. OKP: PKCS#8 is the 16-byte prefix + `OCTET STRING(OCTET STRING seed)`; SPKI is the existing 12-byte prefix; JWK is base64url of the raw bytes; public derivation for Ed25519 uses `exportKey('jwk')` of a Web Crypto Ed25519 import when the browser supports it, otherwise the `[1] publicKey` from the file or an error that names the missing browser support (same banner as the Ed25519 tool). X25519 public derivation goes the same way when Web Crypto X25519 is present; otherwise the file must carry it. Rejected: hand-rolled curve25519 scalar multiplication (the X25519 and Ed25519 tools deliberately use Web Crypto).
3. **OpenSSH writer follows `sshkey.c` exactly.** Magic `openssh-key-v1\0`, cipher `none`, kdf `none`, empty kdfoptions, nkeys 1, public blob, private block = checkint ×2 (random, equal), key type, per-type fields (RSA: n, e, d, iqmp, p, q; ECDSA: curve, Q, d; Ed25519: pk, sk = seed ‖ pk), comment, padding 1..n to the 8-byte block; armored as `BEGIN OPENSSH PRIVATE KEY` with 70-column Base64. The reader enforces checkint equality and padding bytes.
4. **PBES2 reader and writer per RFC 8018 §6.2 and Appendix A / B OIDs.** Reader: PBKDF2 params (salt, iterations, keyLength, PRF default HMAC-SHA-1, HMAC-SHA-256 / 384 / 512 recognised), scheme AES-128 / 192 / 256-CBC (RFC 8018 §B.2.5 OIDs). AES-GCM input is accepted with RFC 5084 GCMParameters and labelled "non-standard for PKCS#8". Writer: defaults to PBKDF2-HMAC-SHA-256, 2048 iterations (OpenSSL 3 default; user-adjustable up to 1,000,000), AES-256-CBC, 16-byte random salt and IV. Rejected: offering AES-GCM output (OpenSSL will not read it).
5. **PKCS12KDF hand-rolled over Web Crypto digests.** Appendix B: diversifier D (64 bytes of ID), salt S and password P expanded to multiples of v = 64 bytes (SHA-1 / SHA-256), password as big-endian UTF-16 with a trailing NUL, `I = S ‖ P`, c iterations of hashing with the B-vector addition; SHA-1 and SHA-256 via `crypto.subtle.digest` (async loop; 2048 iterations complete in a few ms). MAC is HMAC over the AuthenticatedSafe content bytes with the derived key; constant-time comparison. Rejected: treating the MAC as PBKDF2 (it is not, which is why generic tools get it wrong).
6. **Legacy PBE: decode, label, defer 3DES to slice 2, never RC2.** `pbeWithSHAAnd3-KeyTripleDES-CBC` (1.2.840.113549.1.12.1.3): parameters shown, bag marked "legacy PBE — not decrypted in this slice"; a hand-rolled 3DES (~150 lines: DES tables, EDE, CBC) is scheduled as slice 2 because many enterprise PFX exports still use it. RC2-40 (1.2.840.113549.1.12.1.6) is never implemented; the row says so and points at `openssl pkcs12 -legacy` for migration. Rationale: 3DES has one legitimate reader use case (old exports); RC2-40 has none.
7. **Passphrase and private fields are secret fields.** `#keyconv-input`, `#keyconv-output`, `#keyconv-passphrase`, `#keyconv-p12-password` are registered with `clearSensitiveFields()` (cleared on `beforeunload`), output is masked with a reveal toggle, copy and download are explicit buttons, nothing goes to the URL or `localStorage`, and record `Uint8Array`s are zero-filled after each conversion. The passphrase field follows the site's auto-clear rules like the PGP and age passphrase fields.
8. **Hand-off by function, not by clipboard.** A certBag's certificate opens in the TLS Certificate Parser via `tlsCertParseDer()`; a decrypted key populates the converter record. Rejected: forcing the user to copy PEM between views.

## Risks / Trade-offs

- **Private keys in a browser tab.** The whole point is to keep them off servers, but the THREAT-MODEL.md endpoint caveat applies more here than anywhere. The panel repeats it and recommends the portable build for production keys.
- **Web Crypto `extractable` keys.** Required for export; the handle lives for one `await`. No worse than the PEM string already in memory.
- **Browser OKP support.** Ed25519 / X25519 in Web Crypto is not universal; conversions that need a public key from a seed fail cleanly with the existing support banner. Files that carry the public key convert everywhere.
- **PKCS#12 wildness.** Real PFX files vary: missing MAC, multiple AuthenticatedSafe parts, nested SafeContents, BMPString friendlyNames with odd encodings, Java KeyStore-flavoured attributes. The walker reports per bag and continues; unknown bag OIDs are listed with the ASN.1 tool as the fallback view.
- **PBKDF2 UI misuse.** A user could encrypt with 1 iteration. The writer floors at 1,000 and warns below 100,000, citing OWASP; the OpenSSL default (2,048) is labelled as "interoperability default, low".
- **Scope creep toward a PFX builder.** Explicitly not offered; the design records it to stop the request at review.
