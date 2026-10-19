# Spec Delta — paseto-decoding

## Purpose

Decode PASETO (Platform-Agnostic Security Tokens) v2 and v4 tokens structurally and verify `public` tokens with Ed25519 over Pre-Authentication Encoding, per the PASETO specification (paseto-standard/paseto-spec) and its published test vectors, entirely in the browser.

## ADDED Requirements

### Requirement: Token parsing
The tool SHALL split a token on `.` into `version`, `purpose`, `payload`, and optional `footer`; SHALL accept versions `v2` and `v4` and purposes `local` and `public`; SHALL base64url-decode payload and footer without padding (PASETO spec, "Base64 Encoding"); SHALL render the footer as UTF-8 and as JSON when it parses; and SHALL reject `v1` / `v3` with "not supported — RSA-PSS / P-384 variants, out of scope".

#### Scenario: Footer with key id
- **WHEN** a token `v4.public.<payload>.eyJraWQiOiJ6VnhC…` is pasted
- **THEN** the footer row shows the decoded JSON with its `kid` and the header row reads `v4.public.`

#### Scenario: Wrong segment count
- **WHEN** the input has two segments
- **THEN** parsing is refused with "a PASETO token has 3 or 4 dot-separated segments"

### Requirement: Public token verification
The tool SHALL verify a `public` token by splitting the payload into message `m` (all but the last 64 bytes) and signature `s` (last 64 bytes), computing PAE(h, m, f) for v2 or PAE(h, m, f, i) for v4 — where PAE = LE64(count) ‖ for each piece LE64(length) ‖ bytes, `h` is the literal header such as `v4.public.`, `f` the raw footer, `i` the implicit assertion — and verifying `s` with Web Crypto Ed25519 against a 32-byte public key supplied as hex, base64, or PEM.

#### Scenario: Official vector 4-S-1 verifies
- **WHEN** the token and public key of PASETO test vector `4-S-1` are pasted with an empty implicit assertion
- **THEN** the signature gate is ✓ and the message decodes to the vector's JSON claims

#### Scenario: Mutated token fails
- **WHEN** one character of the payload is changed
- **THEN** the signature gate is ✗ reading "signature does not verify for the supplied key" and the claims are still shown as unverified

#### Scenario: Implicit assertion matters
- **WHEN** a v4 token signed with a non-empty implicit assertion is verified with the field left empty
- **THEN** the gate is ✗ and the detail explains that `i` is part of PAE for v4 but is not transmitted in the token

### Requirement: Local token structure
The tool SHALL split a `local` payload by the version's fixed layout — v2: 24-byte nonce ‖ ciphertext ‖ 16-byte Poly1305 tag (XChaCha20-Poly1305); v4: 32-byte nonce ‖ ciphertext ‖ 32-byte BLAKE2b tag (XChaCha20 + BLAKE2b-MAC) — render each part as hex with its length, and state that decryption is not performed because neither cipher is available in Web Crypto.

#### Scenario: v4.local layout
- **WHEN** a `v4.local.` token is pasted
- **THEN** the result shows nonce (32 bytes), ciphertext length, tag (32 bytes), and the note "not decrypted — XChaCha20 and BLAKE2b-MAC are not in Web Crypto"

### Requirement: Claims rendering
The tool SHALL render a `public` token's message as JSON when it parses and SHALL show the registered claims `exp`, `nbf`, `iat` (RFC 3339 strings per the PASETO "Registered Claims" section) with `Intl.DateTimeFormat` and a relative-time phrase, and `iss`, `sub`, `aud`, `jti`, `kid` when present.

#### Scenario: Expired token
- **WHEN** `exp` is an RFC 3339 instant in the past
- **THEN** the row reads the instant followed by "expired … ago" and the claim row is marked ⚠ independent of the signature result

### Requirement: Offline operation and verdict language
The tool SHALL decode and verify without any network request and SHALL phrase a verified result as "Ed25519 signature verifies for the key you supplied — this does not establish who holds that key".

#### Scenario: Input never leaves the page
- **WHEN** a token is verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** the signature gate is ✓
- **THEN** the summary line is the sentence above and contains neither "safe" nor "trusted"
