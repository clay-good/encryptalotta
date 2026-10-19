# Spec Delta — oidc-id-token-checks

## Purpose

Check an OpenID Connect ID token's binding claims — `at_hash`, `c_hash`, `nonce`, `aud` / `azp`, `auth_time` / `max_age` — against the access token, authorization code, and expectations the user supplies, per OpenID Connect Core 1.0 §3.1.3.7, §3.2.2.9, §3.3.2.10, entirely in the browser.

## ADDED Requirements

### Requirement: Token decoding and signature delegation
The tool SHALL decode the ID token with the page's JWT decoder, SHALL verify its signature through `jwkVerify()` when a JWKS or key is pasted (OIDC Core §3.1.3.7 step 6), and SHALL never fetch `.well-known/openid-configuration` or `jwks_uri`, showing those URLs derived from `iss` as text only.

#### Scenario: Discovery URL shown, not fetched
- **WHEN** the ID token's `iss` is `https://accounts.example.com`
- **THEN** the row reads "the verifier would fetch https://accounts.example.com/.well-known/openid-configuration — paste the JWKS here instead" and no request occurs

### Requirement: Hash binding checks
The tool SHALL derive the hash function from the ID token's `alg` (SHA-256 for `*256`, SHA-384 for `*384`, SHA-512 for `*512`; RFC 7518 §3.1 naming), compute `base64url(left-most half of H(ASCII(access_token)))` and compare it to `at_hash` (OIDC Core §3.2.2.9), and likewise `H(code)` to `c_hash` (§3.3.2.10), via `crypto.subtle.digest`.

#### Scenario: Matching at_hash
- **WHEN** an RS256 ID token and the access token it was issued with are pasted
- **THEN** the `at_hash` gate is ✓ showing the 16-byte left half as base64url

#### Scenario: Mismatching c_hash
- **WHEN** the pasted code differs from the one the token was bound to
- **THEN** the `c_hash` gate is ✗ with both values and the clause §3.3.2.10

#### Scenario: Hash claim absent
- **WHEN** the ID token has no `at_hash` and an access token is pasted
- **THEN** the row reads "at_hash absent — optional in the code flow (§3.1.3.6), required when the access token is returned from the authorization endpoint (§3.2.2.10)"

### Requirement: Nonce, audience, and time checks
The tool SHALL display independent ✓ / ✗ rows for: `nonce` equals the expected nonce when supplied (§3.1.3.7 step 11); `aud` contains the supplied client ID (step 3); when `aud` has several values, `azp` is present (step 4) and equals the client ID (step 5); `exp` in the future and `iat` not unreasonably old (steps 9–10); when `max_age` is supplied, `auth_time` present and `auth_time + max_age` in the future (step 13).

#### Scenario: Nonce mismatch
- **WHEN** the expected nonce differs from the `nonce` claim
- **THEN** the gate is ✗ citing §3.1.3.7 step 11 and naming replay as the risk

#### Scenario: Multiple audiences without azp
- **WHEN** `aud` is an array of two values and `azp` is absent
- **THEN** the gate is ✗ citing step 4

#### Scenario: max_age exceeded
- **WHEN** `max_age` 300 is entered and `auth_time` is 20 minutes ago
- **THEN** the gate is ✗ with "authenticated 20 minutes ago, max_age 5 minutes" rendered via `Intl.RelativeTimeFormat`

### Requirement: Offline operation and verdict language
The tool SHALL check without any network request and SHALL phrase an all-✓ result as "binding claims match the tokens you supplied; signature <verified with the pasted key | not verified> — this does not establish that `iss` is the provider you expect".

#### Scenario: Input never leaves the page
- **WHEN** an ID token with `iss` and `jku` URLs is checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓ and no key was pasted
- **THEN** the summary reads "binding claims match the tokens you supplied; signature not verified" and contains neither "safe" nor "authenticated user"
