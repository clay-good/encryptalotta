# Spec Delta — pkce-helper

## Purpose

Generate RFC 7636 (Proof Key for Code Exchange) `code_verifier` / `code_challenge` pairs and OAuth 2.0 `state` / OpenID Connect `nonce` values from `crypto.getRandomValues`, inside the JWT / credential Inspector, entirely in the browser.

## ADDED Requirements

### Requirement: Code verifier generation
The tool SHALL generate a `code_verifier` of 43–128 characters from the unreserved set `[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"` by base64url-encoding 32–96 random bytes without padding (RFC 7636 §4.1), with the byte count chosen by a slider defaulting to 32.

#### Scenario: Default length
- **WHEN** the user clicks Generate with the default setting
- **THEN** the verifier has exactly 43 characters, all from the unreserved set

#### Scenario: Maximum length
- **WHEN** the slider is at 96 bytes
- **THEN** the verifier has exactly 128 characters

### Requirement: S256 code challenge
The tool SHALL compute `code_challenge = BASE64URL(SHA-256(ASCII(code_verifier)))` (RFC 7636 §4.2) via Web Crypto, SHALL label the method `S256`, SHALL accept a user-pasted verifier for recomputation, and SHALL offer `plain` only as a disabled option with the note that §7.2 discourages it.

#### Scenario: RFC 7636 Appendix B vector
- **WHEN** the verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` is pasted
- **THEN** the challenge reads `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`

#### Scenario: Invalid pasted verifier
- **WHEN** a pasted verifier contains `+` or is 40 characters long
- **THEN** no challenge is computed and the message cites the §4.1 character set and length rule

### Requirement: State and nonce
The tool SHALL generate `state` (RFC 6749 §10.12) and `nonce` (OpenID Connect Core 1.0 §3.1.2.1) values as base64url of 32 random bytes, and SHALL show the authorization-request parameter snippet `code_challenge=…&code_challenge_method=S256&state=…&nonce=…` as copyable text without building or opening any URL.

#### Scenario: Snippet is text only
- **WHEN** values are generated
- **THEN** the snippet is rendered with `textContent`, is not a hyperlink, and no navigation or request occurs

### Requirement: Offline operation and verdict language
The tool SHALL generate without any network request and SHALL describe the output only as "random values from `crypto.getRandomValues`", never as making a flow "secure".

#### Scenario: Input never leaves the page
- **WHEN** values are generated while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** generation succeeds
- **THEN** the note reads "PKCE binds the token request to this verifier; it does not authenticate the client or the user" and contains neither "secure" nor "safe"
