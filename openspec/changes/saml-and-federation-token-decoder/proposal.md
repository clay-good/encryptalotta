# Proposal — SAML / Federation Token Decoder

## Why

Enterprise single sign-on still runs on **SAML 2.0** (OASIS, 2005): every Okta, Entra ID, Shibboleth, and Keycloak integration ends with an engineer pasting a `SAMLResponse` into a hosted "SAML decoder" to see why the service provider rejected it. That response contains the user's NameID, email, group memberships, and the IdP's certificate — and the decoder site sees all of it. The same engineer, debugging OpenID Connect, has no offline way to check that an ID token's `at_hash` / `c_hash` / `nonce` match the access token and code they received, and the newer **PASETO** tokens (used where JOSE's algorithm agility is unwanted) have no decoder at all on the site.

The site already has every primitive: `DecompressionStream('deflate-raw')` (the native inflate used for Factur-X attachments), the XML pretty-printer and the namespace-blind `DOMParser` walk from the UBL / SEPA inspectors, the X.509 renderer, the JWT verifier (`jwkVerify()`), Ed25519 via Web Crypto, and `Intl.RelativeTimeFormat` for "expired 4 minutes ago".

## What Changes

- **New tool `saml` — "SAML / Federation Token Decoder"** in Sign / Verify, next to the JWT / credential Inspector. Tool count **57 → 58**.
- **SAML decode**: paste a `SAMLRequest` / `SAMLResponse` value, a full HTTP-Redirect URL, or an HTTP-POST form body → Base64 (→ DEFLATE-inflate for Redirect) → XML; render Issuer, ID, IssueInstant, Destination, InResponseTo, Status, and the Assertion (Subject NameID + format, Conditions with "expired by…", AudienceRestriction, AuthnStatement, AttributeStatement table); report where `ds:Signature` sits (response, assertion, both, neither); detect `EncryptedAssertion`.
- **SAML security lint**: ✓ / ✗ gates for the well-known SAML failure classes (unsigned assertion, signature not over the assertion, missing or expired Conditions, missing AudienceRestriction, oversized validity window, XML comment inside NameID — CVE-2017-11427 class, multiple assertions, `xsi:type` confusion, non-https Destination).
- **OIDC ID-token checks**: paste an ID token with optional access token / code / expected nonce → `at_hash`, `c_hash`, `nonce`, `azp` / `aud`, `auth_time` / `max_age` per OpenID Connect Core 1.0, signature via the existing JWT verifier.
- **PASETO**: v2 / v4 `local` tokens decoded structurally; v2 / v4 `public` tokens verified with Ed25519 over PAE.
- Related-tool links: saml ↔ JWT Inspector ↔ TLS Certificate Parser ↔ XML formatter ↔ Unix Timestamp.

Out of scope (and the §7 non-goal it respects): no XML-DSig signature verification here — that is the `xml-dsig-verification` capability of the `eidas-signature-cryptographic-verification` change, which this tool will call once it lands; no IdP metadata fetch, no JWKS fetch, no `.well-known/openid-configuration` fetch (§7.5 — the user pastes keys); no `EncryptedAssertion` decryption in slice 1 (needs the SP private key and XML-Enc; detected and explained only); no SAML 1.1 / WS-Federation / WS-Trust; no PASETO `local` decryption (v4.local uses XChaCha20 + BLAKE2b keyed MAC, v2.local XChaCha20-Poly1305 — neither in Web Crypto; the page's ChaCha20-Poly1305 engine is the IETF 96-bit-nonce variant, so this is deferred, not hand-rolled now — §7.6 spirit: no new crypto without a vector-tested need).

## Capabilities

### New Capabilities
- `saml-message-decoding`: decode SAML 2.0 AuthnRequest / Response / LogoutRequest from Redirect or POST bindings into labelled fields, assertion detail, attribute table, and signature placement — per OASIS saml-core-2.0-os and saml-bindings-2.0-os.
- `saml-security-lint`: ✓ / ✗ gates for the SAML Web Browser SSO profile's signing, validity, audience, and XML-structure failure classes — per saml-profiles-2.0-os §4.1.4 and saml-sec-consider-2.0-os.
- `oidc-id-token-checks`: `at_hash`, `c_hash`, `nonce`, `azp` / `aud`, `auth_time` / `max_age` checks on an OpenID Connect ID token with the alg-derived hash — per OIDC Core 1.0 §3.1.3.7, §3.2.2.9, §3.3.2.10.
- `paseto-decoding`: structural decode of PASETO v2 / v4 tokens and Ed25519 verification of `public` tokens over Pre-Authentication Encoding — per the PASETO specification and its published test vectors.

### Modified Capabilities
- none (the XML formatter, JWT verifier, and TLS Certificate Parser are called as functions; their own behaviour is unchanged).

## Impact

- `index.html`: one new view, ~650 lines of inline JS (binding detection, inflate, SAML walker, gate functions, OIDC hash checks, PASETO PAE), ~55 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `DecompressionStream` inflate path (ubl Factur-X), `xmlPrettyPrint()`, the namespace-blind `DOMParser` walk and `xmlField()` helper (ubl / sepa), the X.509 renderer from `tls-cert` for `ds:X509Certificate`, `jwkVerify()` and the JWT decoder, `crypto.subtle.digest` / `verify` (Ed25519), `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`, the SEPA / UBL gate renderer.
- No new vendored file, no CSP change, page weight +~16 KB gzipped.
- Tests: new `tests/specs/31-saml.spec.js` (number assigned at implementation) — a Redirect-binding AuthnRequest (deflated) and a POST-binding Response fixture with one signed assertion, each lint ✗ case (comment-in-NameID, two assertions, 24-hour window, http Destination), an OIDC fixture with matching and mismatching `at_hash`, the PASETO v4 public test vector `4-S-1` (verifies) and a mutated copy (fails), and the network-silence assertion the suite already uses.
