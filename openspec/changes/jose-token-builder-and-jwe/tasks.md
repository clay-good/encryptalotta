# Tasks — JOSE token builder, JWK generation, JWE, and RFC 8725 lint

## 1. Signing and key engine

- [ ] 1.1 `joseImportPrivate(text, alg)` accepting PEM PKCS#8, JWK, JWKS (by `kid`), or a raw secret, returning a Web Crypto key plus the detected key type; share key-type detection with `jwkVerify()`.
- [ ] 1.2 `joseSign({header, claims, key, alg})` for HS / RS / PS / ES / EdDSA → compact JWS; `saltLength` per RFC 7518 §3.5 for PS*.
- [ ] 1.3 `joseGenerateKey({kty, size | crv, use})` → `{publicJwk, privateJwk, jwks, pem}` with `kid` = RFC 7638 thumbprint; `oct` via `getRandomValues`.
- [ ] 1.4 `jwkThumbprint(jwk)` with the per-type canonical member order; Node-side check against RFC 7638 §3.1.
- [ ] 1.5 Node-side check: RFC 7515 Appendix A.1 HS256 vector reproduces the published signature; A.3 ES256 vector verifies via `jwkVerify()` after signing.

## 2. JWE engine

- [ ] 2.1 `joseConcatKdf(Z, algId, apu, apv, keyBits)` (RFC 7518 §4.6.2) over `crypto.subtle.digest`; check against Appendix C.
- [ ] 2.2 `joseCbcHmacEncrypt / Decrypt` (RFC 7518 §5.2) over AES-CBC + HMAC; check against Appendix B; constant-time tag compare reusing the HMAC tool's routine.
- [ ] 2.3 `joseEncrypt({alg, enc, key, plaintext, header})` and `joseDecrypt({compact, key})` for RSA-OAEP-256, ECDH-ES, ECDH-ES+A256KW, A256KW, dir × A128GCM, A256GCM, A128CBC-HS256, A256CBC-HS512; AAD = ASCII(base64url(protected header)).
- [ ] 2.4 Decrypt round trips against RFC 7516 Appendix A.1 and A.3; nested-JWT detection by `cty` or shape.

## 3. Lint and PKCE

- [ ] 3.1 `jwtLint(decoded, {secret, key, now})` → gate rows: `alg: none`, HS secret below hash length, missing `exp` / `iat` / `aud`, `exp` more than one year ahead, `kid` / `jku` / `x5u` URL present, unsupported `crit`, `alg` / key-type mismatch, embedded `jwk` in a signed token, missing `typ`.
- [ ] 3.2 `pkceGenerate(bytes)` → `{verifier, challenge, method:'S256'}`; `oauthRandom(32)` for `state` / `nonce`; check against RFC 7636 Appendix B.

## 4. View

- [ ] 4.1 Tab strip in `#jwt-view`: Inspect (existing), Build (`#jwt-build-header`, `#jwt-build-claims`, `#jwt-build-alg`, `#jwt-build-key` masked, `#btn-jwt-sign`, `#btn-jwt-iat`, `#btn-jwt-exp`, `#btn-jwt-handoff`), Keys (`#jwt-gen-kty`, `#jwt-gen-size`, `#btn-jwt-generate`, `#jwt-gen-public`, `#jwt-gen-private`, `#btn-jwt-gen-pem`), Encrypt (`#jwt-jwe-alg`, `#jwt-jwe-enc`, `#jwt-jwe-key`, `#jwt-jwe-plaintext`, `#btn-jwt-encrypt`, `#btn-jwt-decrypt`, `#jwt-jwe-output`), PKCE (`#btn-jwt-pkce`, `#jwt-pkce-verifier`, `#jwt-pkce-challenge`, `#jwt-pkce-state`, `#jwt-pkce-nonce`).
- [ ] 4.2 Lint rows `#jwt-gates` rendered under the existing `#jwt-verify-result` on Inspect and under the signed token on Build, with a header line stating the verification status.
- [ ] 4.3 Masked fields with reveal toggle; clear on `pagehide`, tab switch, and `#btn-jwt-clear-keys`; generated private key shown once.
- [ ] 4.4 Ed25519 banner reuse for EdDSA / OKP when `crypto.subtle` lacks it; related links to JWK ↔ PEM, HMAC, Ed25519, X25519.

## 5. Tests

- [ ] 5.1 `tests/specs/30-jose-build.spec.js` (number assigned at implementation): all twelve sign → verify round trips, RFC 7515 A.1 vector, RFC 7638 thumbprint, key generation for every `kty` with JWKS shape, PEM export round trip through `pemToJwk()`, JWE encrypt → decrypt for every `alg` × `enc`, RFC 7516 A.1 / A.3 decrypts, RFC 7518 B / C vectors, nested JWT handoff, each lint ✗ case and the all-✓ wording, PKCE vector, `pagehide` clears private fields, network-silence assertion, XSS payload in a claim rendered inert.
- [ ] 5.2 Extend the existing `jwt` entries in 00-introspect, 05-a11y, 08-stress, 11-xss for the new tab controls.

## 6. Wiring and gates

- [ ] 6.1 ~60 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys updated for the Inspector.
- [ ] 6.2 TOOL_SYNONYMS for `jwt` (`jwe jws jwk jwks sign token builder encrypt pkce code_verifier thumbprint rfc8725`), RELATED_TOOLS (jwt ↔ jwk ↔ hmac ↔ ed25519 ↔ x25519), JSON-LD featureList description; audit gate 20 tool count unchanged (57).
- [ ] 6.3 README: Inspector paragraph, standards cheat sheet rows (RFC 7515 / 7516 / 7517 / 7518 / 7638 / 8037 / 8725 / 7636), Per-Tool Security Notes (private-key handling); SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
