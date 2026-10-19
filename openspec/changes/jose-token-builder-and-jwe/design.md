# Design — JOSE token builder, JWK generation, JWE, and RFC 8725 lint

## Context

The JOSE family is five RFCs that compose: JWS RFC 7515 (signing), JWE RFC 7516 (encryption), JWA RFC 7518 (algorithms), JWK RFC 7517 (keys), JWT RFC 7519 (claims), plus RFC 8037 (OKP / EdDSA), RFC 7638 (thumbprints), RFC 8725 (BCP), RFC 7636 (PKCE). The Inspector already has the decode / verify half: `jwkVerify()` selects a JWK from a JWKS by `kid` and imports OKP / RSA / EC / oct into Web Crypto; `jwkToPem()` / `pemToJwk()` bridge to PEM.

Web Crypto coverage of what this change needs:

| Primitive | Web Crypto | Notes |
|---|---|---|
| HS256/384/512 | HMAC | native |
| RS256/384/512 | RSASSA-PKCS1-v1_5 | native |
| PS256/384/512 | RSA-PSS, `saltLength` = hash length | RFC 7518 §3.5 |
| ES256/384/512 | ECDSA, raw `r‖s` | RFC 7518 §3.4 — Web Crypto emits raw already |
| EdDSA (Ed25519) | `Ed25519` | Safari 17 / Chrome 113 / Firefox 130; banner otherwise |
| RSA-OAEP-256 | RSA-OAEP with SHA-256 | native |
| A128/256GCM | AES-GCM, 96-bit IV, 128-bit tag | native |
| A128CBC-HS256 / A256CBC-HS512 | AES-CBC + HMAC | composite glue (RFC 7518 §5.2) |
| A256KW | AES-KW | native (`wrapKey` / `unwrapKey` or raw) |
| ECDH-ES (+A256KW) | ECDH `deriveBits` + Concat KDF | KDF is ~20 lines over `digest` (RFC 7518 §4.6.2) |
| dir | — | the `oct` key is the CEK |
| Key generation | `generateKey` + `exportKey('jwk')` | all types |
| RFC 7638 thumbprint | `digest` over canonical JSON | member order fixed per key type |

## Goals / Non-Goals

**Goals:**
- Every operation through Web Crypto; nothing cryptographic hand-rolled except the two RFC-mandated compositions (Concat KDF, CBC-HMAC), each checked against its RFC appendix vector.
- Build and Inspect are one tool: a built token lands in the Inspector with one click and the lint runs on it.
- Private material never persists: masked inputs, cleared on `pagehide` and on tab switch, never written to `localStorage`.

**Non-Goals:**
- No `RSA1_5`, no `A128KW` / `A192KW` / `A192GCM` / `A192CBC-HS384` (rarely used; the matrix stays small), no `PBES2-*` (would invite reuse of weak passwords for key wrapping), no JSON serialization, no multi-recipient JWE, no `zip: DEF` (RFC 8725 §3.6 warns against compression before encryption).
- No OAuth / OIDC HTTP flows; the PKCE helper generates values only.
- No key storage, no JWKS hosting.

## Decisions

1. **Tab inside the JWT Inspector, not a new tool.** Rationale: sign ↔ verify and encrypt ↔ decrypt are one mental loop; the Inspector's key field already understands every JOSE key encoding. Rejected: a separate "JWT Builder" tool — it would duplicate key ingestion and the tool count delta buys nothing.
2. **Signing uses Web Crypto for all twelve algorithms.** ES* signatures come out of Web Crypto as raw `r‖s`, which is exactly the JWS form (RFC 7518 §3.4), so no DER conversion is needed on this path. PS* sets `saltLength` to the hash byte length per RFC 7518 §3.5. Pure JS: none.
3. **JWK generation via `generateKey` with `extractable: true`, then `exportKey('jwk')`.** `kid` defaults to the RFC 7638 thumbprint: canonical JSON of the required public members only, in lexical order — EC `{crv, kty, x, y}`, RSA `{e, kty, n}`, OKP `{crv, kty, x}`, oct `{k, kty}` — SHA-256, base64url. Checked against RFC 7638 §3.1 (`NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs`). `oct` keys come from `getRandomValues`, default 32 bytes.
4. **JWE compact only, AAD = ASCII(BASE64URL(protected header))** (RFC 7516 §5.1 step 14). Content encryption per `enc`: GCM native; CBC-HMAC composite per RFC 7518 §5.2 — split the CEK into MAC key (first half) and ENC key (second half), HMAC over `AAD ‖ IV ‖ ciphertext ‖ AL` where AL is the 64-bit big-endian bit length of AAD, tag = first half of the HMAC. Checked against RFC 7518 Appendix B.
5. **Key management per `alg`.** RSA-OAEP-256: `encrypt`/`decrypt` of the CEK. A256KW: AES-KW over the raw CEK. dir: the `oct` key is the CEK and the encrypted-key part is empty. ECDH-ES: ephemeral key via `generateKey`, `epk` in the header, `deriveBits` for Z, Concat KDF (SHA-256, one round suffices for ≤ 256-bit output: `SHA-256(0x00000001 ‖ Z ‖ AlgorithmID ‖ PartyUInfo ‖ PartyVInfo ‖ SuppPubInfo)` with the length-prefixed fields of RFC 7518 §4.6.2); for ECDH-ES the derived key is the CEK, for ECDH-ES+A256KW it wraps a random CEK. Checked against RFC 7518 Appendix C (`VqqN6vgjbSBcIijNcacQGg`). Rejected: HKDF — JOSE specifies Concat KDF, and HKDF would not interoperate.
6. **Decrypt renders header, payload, and nested JWT.** If `cty` is `JWT` (RFC 7519 §5.2) or the plaintext matches the three-part compact JWS shape, a "decode the inner token in the Inspector" link appears.
7. **Lint is a pure function of the decoded token plus optional context** (the secret or key the user supplied, the current time). It runs on the Inspect tab after decode and on the Build tab after signing, with the same rows. Gates cite RFC 8725 sections; the `kid` / `jku` / `x5u` row says "URL present — a verifier that follows it is SSRF-exposed; this page never fetches it".
8. **Secret-size gate uses the byte length of the supplied secret**, RFC 7518 §3.2 ("a key of the same size as the hash output or larger MUST be used"): < 32 bytes for HS256, < 48 for HS384, < 64 for HS512 is ✗. It runs only when the user has typed a secret; the token alone cannot reveal it.
9. **PKCE: `code_verifier` is 32–96 random bytes base64url-encoded** (giving 43–128 unreserved characters, RFC 7636 §4.1); `code_challenge` = base64url(SHA-256(ASCII(verifier))) (§4.2). `state` and `nonce` are 32 random bytes base64url. Checked against RFC 7636 Appendix B.
10. **Field hygiene.** Private-key, secret, and passphrase inputs are `type="password"`-styled textareas with a reveal toggle, cleared on `pagehide`, on tab switch, and by an explicit Clear button; generated private keys are shown once with copy / download and are not re-rendered after navigation.
11. **Gate rows reuse the SEPA / UBL `{ok, label, detail, clause}` framework.**

## Risks / Trade-offs

- **Composite CBC-HMAC correctness.** A padding or truncation slip would produce tokens other libraries reject. Mitigation: RFC 7518 Appendix B vector in tests and a decrypt round trip against the RFC 7516 Appendix A.3 ciphertext.
- **Concat KDF field encoding.** `AlgorithmID` is the `enc` value for ECDH-ES and the `alg` value for ECDH-ES+A256KW, each with a 32-bit length prefix; `SuppPubInfo` is the key length in bits as a 32-bit integer. Mitigation: RFC 7518 Appendix C vector.
- **Timing of lint vs. verification.** A ✓ lint on an unverified token could be misread. Mitigation: the lint header always states whether the signature was verified and against which key.
- **Private key in a browser tab.** Masking and clearing do not defeat a compromised endpoint (THREAT-MODEL.md); the info panel repeats that, and recommends test keys only.
- **Ed25519 availability** for EdDSA signing and OKP generation differs across browsers; the existing banner handles it.
