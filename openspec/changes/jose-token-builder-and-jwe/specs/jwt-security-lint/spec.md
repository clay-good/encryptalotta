# Spec Delta — jwt-security-lint

## Purpose

Run the RFC 8725 (JSON Web Token Best Current Practices) checks on any token decoded or built in the JWT / credential Inspector and present them as ✓ / ✗ gate rows that cite the clause, entirely in the browser.

## ADDED Requirements

### Requirement: Algorithm gates
The tool SHALL display independent ✓ / ✗ rows for: `alg` is not `none` (RFC 8725 §3.1, §2.1); `alg` is one of the supported JWS or JWE algorithms (§3.2); when a verification key is supplied, its type matches `alg` (RSA for RS/PS, EC with the right curve for ES, OKP for EdDSA, `oct` for HS — §3.1 algorithm / key binding); when an HMAC secret is supplied, its byte length is at least the hash output length (RFC 7518 §3.2; RFC 8725 §3.5).

#### Scenario: alg none
- **WHEN** the header is `{"alg":"none"}`
- **THEN** the algorithm gate is ✗ citing RFC 8725 §3.1 and the Inspector's verify result is forced to "not verified"

#### Scenario: Short HMAC secret
- **WHEN** `alg` is HS256 and the user types a 12-byte secret
- **THEN** the secret gate is ✗ with "12 bytes supplied, RFC 7518 §3.2 requires at least 32 for HS256"

#### Scenario: Key confusion
- **WHEN** `alg` is HS256 and the key field holds an RSA public JWK
- **THEN** the binding gate is ✗ explaining the RS→HS confusion attack (RFC 8725 §3.1)

### Requirement: Header gates
The tool SHALL display independent ✓ / ✗ rows for: no `jku` or `x5u` header (RFC 7515 §4.1.2, §4.1.5 — "URL present — a verifier that follows it is SSRF-exposed; this page never fetches it"); `kid` does not look like a URL or path; no embedded `jwk` in a signed token (RFC 7515 §4.1.3 — a verifier must not trust it); every `crit` entry is understood (RFC 7515 §4.1.11); `typ` present (RFC 8725 §3.11 explicit typing).

#### Scenario: jku present
- **WHEN** the header carries `jku: https://example.com/keys`
- **THEN** the gate is ✗, the URL is shown as text only, and no request is made

#### Scenario: Unknown crit
- **WHEN** `crit: ["b64"]` is present and `b64` is not implemented
- **THEN** the gate is ✗ stating the token must be rejected by a conforming verifier (RFC 7515 §4.1.11)

### Requirement: Claims gates
The tool SHALL display independent ✓ / ✗ rows for: `exp` present (RFC 7519 §4.1.4); `iat` present (§4.1.6); `aud` present (RFC 8725 §3.9); `exp` not more than one year after `iat` or now (⚠, long-lived token); `nbf` not after `exp`; `iss` and `sub` present (⚠ when absent, RFC 8725 §3.8).

#### Scenario: Missing exp
- **WHEN** the claims have no `exp`
- **THEN** the gate is ✗ citing RFC 7519 §4.1.4 and the existing expiry indicator reads "no expiry"

#### Scenario: Long-lived token
- **WHEN** `exp` is 400 days after `iat`
- **THEN** the lifetime gate is ⚠ with the duration rendered via `Intl.RelativeTimeFormat`

### Requirement: Lint placement and context
The tool SHALL run the lint after every decode on the Inspect tab and after every signing on the Build tab, SHALL head the list with the verification status ("signature verified with the supplied key" / "not verified"), and SHALL evaluate key-dependent gates only when a key or secret is present.

#### Scenario: Unverified token
- **WHEN** a token is decoded with no key supplied
- **THEN** the lint header reads "not verified — lint reflects the token's claims and header only" and the key-binding and secret-size rows read "no key supplied"

### Requirement: Offline operation and verdict language
The tool SHALL lint without any network request and SHALL phrase an all-✓ result as "conforms to RFC 8725 checks listed here — this does not establish that the issuer is who the `iss` claim says".

#### Scenario: Input never leaves the page
- **WHEN** a token with `jku` and `x5u` headers is linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary line is the sentence above and contains neither "safe" nor "trusted"
