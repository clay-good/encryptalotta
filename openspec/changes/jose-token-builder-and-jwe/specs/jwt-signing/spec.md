# Spec Delta — jwt-signing

## Purpose

Compose and sign a compact JSON Web Signature (JWS, RFC 7515) carrying JWT claims (RFC 7519) with every RFC 7518 / RFC 8037 signature algorithm, through Web Crypto, inside the JWT / credential Inspector, entirely in the browser.

## ADDED Requirements

### Requirement: Header and claims composition
The tool SHALL provide editable JSON for the protected header and the claims set, SHALL set `alg` from the algorithm selector and `typ: JWT` by default (RFC 7519 §5.1), and SHALL offer one-click helpers that insert `iat` as the current epoch second and `exp` / `nbf` as `iat` plus a chosen duration (RFC 7519 §4.1.4–4.1.6).

#### Scenario: Expiry helper
- **WHEN** the user clicks the `exp` helper with "1 hour" selected
- **THEN** the claims JSON gains `exp` equal to the current epoch second plus 3600, shown alongside its `Intl.DateTimeFormat` rendering

#### Scenario: Invalid JSON
- **WHEN** either JSON field does not parse
- **THEN** signing is refused and the message names the field and the parser error position

### Requirement: Signing algorithms
The tool SHALL sign with HS256/384/512 (HMAC), RS256/384/512 (RSASSA-PKCS1-v1_5), PS256/384/512 (RSA-PSS with salt length equal to the hash length, RFC 7518 §3.5), ES256/384/512 (ECDSA with raw `r‖s`, RFC 7518 §3.4), and EdDSA / Ed25519 (RFC 8037 §3.1), all via Web Crypto, and SHALL emit the compact serialization `BASE64URL(header).BASE64URL(payload).BASE64URL(signature)` (RFC 7515 §7.1).

#### Scenario: RFC 7515 Appendix A.1 vector
- **WHEN** the header `{"typ":"JWT","alg":"HS256"}`, the payload, and the `oct` key from RFC 7515 Appendix A.1 are supplied verbatim
- **THEN** the signature part equals `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`

#### Scenario: Every algorithm round-trips
- **WHEN** a token is signed with each of the twelve algorithms using a generated key
- **THEN** the Inspector's existing verifier accepts each token with the matching public key or secret

#### Scenario: EdDSA without browser support
- **WHEN** `crypto.subtle` rejects `Ed25519`
- **THEN** the EdDSA option is disabled with the Ed25519 tool's capability banner

### Requirement: Key ingestion for signing
The tool SHALL accept the signing key as a shared secret (text or base64url `k`), a PKCS#8 PEM private key (RFC 5958), a private JWK, or a JWKS (selecting by `kid`), SHALL reject a key whose type does not fit the selected algorithm, and SHALL mask the field, clear it on `pagehide` and tab switch, and never persist it.

#### Scenario: Key type mismatch
- **WHEN** an EC P-256 private JWK is supplied with RS256 selected
- **THEN** signing is refused with "RS256 requires an RSA key; this key is EC P-256" (RFC 7518 §3.1)

#### Scenario: Private key cleared
- **WHEN** a `pagehide` event fires or the user switches to the Inspect tab
- **THEN** the key field is empty and the DOM contains no copy of the pasted key

### Requirement: Output and handoff
The tool SHALL display the compact JWS with a copy button, the byte lengths of the three parts, and a "verify it in the Inspector" button that loads the token into the Inspect tab and, for asymmetric algorithms, the corresponding public key into the verification-key field.

#### Scenario: Handoff verifies
- **WHEN** the user signs with a generated ES256 key and clicks the handoff
- **THEN** the Inspect tab shows the decoded token, the public JWK in the key field, and a successful verification

### Requirement: Offline operation and verdict language
The tool SHALL sign without any network request and SHALL describe a signed token only as "signed with <alg> using the key you supplied", never as "secure" or "trusted".

#### Scenario: Input never leaves the page
- **WHEN** a token is signed while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** signing succeeds
- **THEN** the status line reads "Signed with ES256 using the key you supplied — anyone holding the matching public key can verify it; this token is as trustworthy as that key" and contains neither "secure" nor "safe"
