# Proposal — JOSE token builder, JWK generation, JWE, and RFC 8725 lint

## Why

The shipped **JWT / credential Inspector** decodes and verifies; it cannot *make* anything. A developer who needs a signed test token, a fresh JWKS for a staging identity provider, or a JWE to exercise a decrypt path goes to jwt.io, mkjwk.org, or a random "JWE playground" — and pastes a private key into someone else's page. The same developer gets no warning when the token they are inspecting says `alg: none`, carries a 12-byte HMAC secret, or embeds a `jku` URL that points the verifier at an attacker's key set. **RFC 8725** (JWT Best Current Practices) lists these failure modes; nothing on the site checks them.

Everything required is already in the page or in Web Crypto: `jwkVerify()` imports every JOSE key type, `jwkToPem()` / `pemToJwk()` convert both ways, HMAC and SHA-2 are native, `AES-GCM`, `AES-CBC`, `AES-KW`, `RSA-OAEP`, `ECDH`, and `HKDF` are all Web Crypto. Only the RFC 7518 Concat KDF (for `ECDH-ES`) and the A128CBC-HS256 composite are glue code.

## What Changes

- **A "Build / Encrypt" tab in the JWT / credential Inspector** (`jwt`) beside the existing Inspect tab. **No new top-level tool**; this extends the shipped JWT / credential Inspector, for which no OpenSpec baseline exists yet.
- **Sign**: compose header + claims, sign with HS256/384/512, RS256/384/512, PS256/384/512, ES256/384/512, EdDSA (JWS RFC 7515, JWA RFC 7518, RFC 8037); `iat` / `exp` / `nbf` helpers; output compact JWS plus a one-click "verify it in the Inspector" handoff.
- **Generate keys**: RSA-2048/3072/4096, EC P-256/384/521, OKP Ed25519 / X25519, `oct` — as JWK, JWKS, public / private split, RFC 7638 thumbprint as `kid`, PEM export (RFC 7517).
- **Encrypt / decrypt**: compact JWE (RFC 7516) with `alg` RSA-OAEP-256, ECDH-ES, ECDH-ES+A256KW, A256KW, dir and `enc` A128GCM, A256GCM, A128CBC-HS256, A256CBC-HS512; decrypt with the matching private key or secret; nested-JWT detection (`cty: JWT`).
- **Security lint** on every inspected or built token: RFC 8725 gates in the ✓ / ✗ house style.
- **PKCE helper** (RFC 7636): `code_verifier`, S256 `code_challenge`, `state` and `nonce` generation.
- Private-key and secret fields are masked and cleared on `pagehide`, as the Decrypt tool already does for passphrases.

Out of scope (and the §7 non-goal it respects): no `RSA1_5` (RFC 7518 §4.2 — padding-oracle class, deprecated by RFC 8725 §3.2 guidance), no `A128KW` / `A192KW` beyond what Web Crypto offers by accident, no JSON serialization (RFC 7515 §7.2 / RFC 7516 §7.2 — compact only), no OAuth token endpoint calls, no `jku` / `x5u` fetching (§7.5 — URLs are flagged, never followed), no key storage between sessions (§7.9).

## Capabilities

### New Capabilities
- `jwt-signing`: compose and sign a compact JWS with the twelve RFC 7518 / RFC 8037 signature algorithms via Web Crypto, with claim helpers and a verify handoff.
- `jwk-generation`: generate RSA / EC / OKP / oct keys as JWK and JWKS with RFC 7638 thumbprints, public / private split, and PEM export through the existing engine.
- `jwe-encryption`: encrypt and decrypt compact JWE (RFC 7516) with the listed `alg` / `enc` pairs, rendering the protected header, decrypted payload, and nested-JWT detection.
- `jwt-security-lint`: RFC 8725 gates on any token present in the Inspector, in the `{ok, label, detail, clause}` row style.
- `pkce-helper`: RFC 7636 `code_verifier` / S256 `code_challenge` and OAuth `state` / OIDC `nonce` generation from `crypto.getRandomValues`.

### Modified Capabilities
- none (the Inspect tab's decode and verify behaviour is unchanged; the lint rows are appended below the existing verify result).

## Impact

- `index.html`: a tab strip inside `#jwt-view`, ~700 lines of inline JS (signer, key generator, JWE engine with Concat KDF and CBC-HMAC composite, lint gates, PKCE), ~60 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `jwkVerify()` key import, `jwkToPem()` / `pemToJwk()`, the base64url helpers, `jwtRender()` for the handoff, the SEPA / UBL gate renderer, the Decrypt tool's `pagehide` field-clearing pattern, the Ed25519 tool's unsupported-browser banner.
- No new vendored file, no CSP change, page weight +~18 KB gzipped.
- Tests: new `tests/specs/30-jose-build.spec.js` (number assigned at implementation) — RFC 7515 Appendix A.1 (HS256) and A.3 (ES256, structural) vectors, RFC 7638 §3.1 thumbprint `NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs`, RFC 7516 Appendix A.1 (RSA-OAEP + A256GCM decrypt) and A.3 (A128KW + A128CBC-HS256), RFC 7518 Appendix B (CBC-HMAC) and Appendix C (Concat KDF), RFC 7636 Appendix B PKCE vector, sign → verify round trips for all twelve algorithms, lint ✗ cases, field-clearing on `pagehide`, network-silence assertion.
