# Spec Delta — jwe-encryption

## Purpose

Encrypt and decrypt compact JSON Web Encryption (JWE, RFC 7516) tokens with the RFC 7518 key-management and content-encryption algorithms that Web Crypto supports, inside the JWT / credential Inspector, entirely in the browser.

## ADDED Requirements

### Requirement: Compact JWE encryption
The tool SHALL produce the five-part compact serialization `BASE64URL(protected header).BASE64URL(encrypted key).BASE64URL(IV).BASE64URL(ciphertext).BASE64URL(tag)` (RFC 7516 §7.1) with the Additional Authenticated Data equal to `ASCII(BASE64URL(protected header))` (§5.1 step 14), a fresh random CEK and IV per token, and an optional `cty` header.

#### Scenario: Encrypt then decrypt
- **WHEN** a plaintext is encrypted with RSA-OAEP-256 / A256GCM using a generated RSA public JWK and decrypted with the private JWK
- **THEN** the decrypted payload equals the plaintext and the protected header shows `alg`, `enc`, and `kid`

#### Scenario: Fresh IV per token
- **WHEN** the same plaintext is encrypted twice with the same key
- **THEN** the IV and ciphertext parts differ

### Requirement: Key management algorithms
The tool SHALL support `alg` RSA-OAEP-256 (RFC 7518 §4.3), A256KW (§4.4, AES Key Wrap), dir (§4.5), ECDH-ES and ECDH-ES+A256KW (§4.6, ephemeral P-256 / P-384 / P-521 key in `epk`, Concat KDF per §4.6.2 with SHA-256), all via Web Crypto, and SHALL reject RSA1_5 and PBES2 with the reason.

#### Scenario: Concat KDF vector
- **WHEN** the ECDH-ES example of RFC 7518 Appendix C (A128GCM, `apu` "Alice", `apv` "Bob") is run with the published shared secret Z
- **THEN** the derived key is `VqqN6vgjbSBcIijNcacQGg`

#### Scenario: RSA1_5 refused
- **WHEN** a pasted JWE header has `alg: RSA1_5`
- **THEN** decryption is refused with "RSA1_5 is not supported — padding-oracle class, see RFC 8725 §3.2"

### Requirement: Content encryption algorithms
The tool SHALL support `enc` A128GCM and A256GCM (RFC 7518 §5.3, 96-bit IV, 128-bit tag) via AES-GCM, and A128CBC-HS256 and A256CBC-HS512 (§5.2) as the composite of AES-CBC with the second half of the CEK and HMAC over `AAD ‖ IV ‖ ciphertext ‖ AL` with the first half, the tag truncated to half the HMAC length, compared in constant time.

#### Scenario: RFC 7518 Appendix B vector
- **WHEN** the A128CBC-HS256 inputs of RFC 7518 Appendix B.1 (K, P, IV, A) are supplied
- **THEN** the ciphertext E and authentication tag T match the published values

#### Scenario: RFC 7516 Appendix A.3 decrypts
- **WHEN** the compact JWE of RFC 7516 Appendix A.3 and its A128KW `oct` key are pasted (A128KW accepted for decryption of this vector only, reported as legacy)
- **THEN** the payload decrypts to "Live long and prosper."

### Requirement: Decryption and nested-token detection
The tool SHALL parse a pasted compact JWE, render the protected header before any key is supplied, decrypt with a private JWK / PKCS#8 PEM / `oct` secret chosen by `alg`, render the plaintext as UTF-8 and JSON when it parses, and SHALL detect a nested JWT by `cty: JWT` (RFC 7519 §5.2) or by the three-part compact JWS shape and offer to decode it in the Inspect tab.

#### Scenario: Nested JWT
- **WHEN** the decrypted plaintext is a compact JWS and the header has `cty: JWT`
- **THEN** a "decode the inner token" button loads it into the Inspect tab

#### Scenario: Wrong key
- **WHEN** the supplied key does not match
- **THEN** the result reads "decryption failed — the key does not match or the token was altered" without distinguishing the two causes

### Requirement: Offline operation and verdict language
The tool SHALL encrypt and decrypt without any network request and SHALL describe a decrypted token as "authentication tag verifies for the key you supplied", never as "safe" or "from a trusted sender".

#### Scenario: Input never leaves the page
- **WHEN** a JWE is decrypted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** decryption succeeds
- **THEN** the status line reads "Decrypted — the authentication tag verifies for the key you supplied; this does not establish who encrypted it"
