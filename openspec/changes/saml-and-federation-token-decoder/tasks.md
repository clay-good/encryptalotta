# Tasks — SAML / Federation Token Decoder

## 1. SAML ingestion and decoding engine

- [ ] 1.1 `samlIngest(text) → {binding, kind, xml, relayState, sigAlg, signature}`: URL → query params; form body → URL-decode; raw XML; bare Base64; `deflate-raw` inflate via `DecompressionStream` when the decoded bytes are not XML; browser-capability message when the stream API is missing.
- [ ] 1.2 `samlParse(xml)` over `DOMParser` with local-name lookups (reuse `xmlField()`): message type (AuthnRequest / Response / LogoutRequest / LogoutResponse / ArtifactResolve), Issuer, ID, Version, IssueInstant, Destination, InResponseTo, Status (StatusCode nesting + StatusMessage), Assertion[] (ID, IssueInstant, Issuer, Subject NameID + Format + SubjectConfirmation, Conditions, AudienceRestriction, AuthnStatement, AttributeStatement), EncryptedAssertion presence.
- [ ] 1.3 `samlSignatures(doc)` → for each `ds:Signature`: parent element, `SignatureMethod`, `CanonicalizationMethod`, every `Reference/@URI` and its resolved target by `ID`, `KeyInfo/X509Certificate` bytes handed to the `tls-cert` renderer.
- [ ] 1.4 Node-side check: Redirect fixture inflates to the AuthnRequest; POST fixture parses with one Assertion and signature placement "Assertion".

## 2. SAML lint, OIDC checks, PASETO

- [ ] 2.1 `samlLint(parsed, {now, skewSeconds})` gate rows: assertion signed; signature references the Assertion ID; Conditions present; NotBefore ≤ now + skew; NotOnOrAfter > now − skew; AudienceRestriction present; validity window ≤ 10 min (⚠ heuristic); no comment or processing instruction inside NameID / Attribute values; exactly one Assertion; no `xsi:type` on Assertion / Subject / Conditions; Destination is https; InResponseTo present on a Response (⚠ when absent: unsolicited / IdP-initiated); `EncryptedAssertion` noted.
- [ ] 2.2 `oidcIdTokenChecks({idToken, accessToken, code, expectedNonce, clientId, maxAge, now})`: alg-derived hash, `at_hash`, `c_hash`, `nonce`, `aud` contains client, `azp` rule, `auth_time` + `max_age`, `iat` / `exp`; signature via `jwkVerify()` with a pasted JWKS.
- [ ] 2.3 `pasetoParse(token)` → `{version, purpose, payload, footer, implicit}`; `pasetoPae(pieces)`; `pasetoVerifyPublic(token, publicKey, implicit)` via Web Crypto Ed25519; `local` split by version sizes; check against test vector `4-S-1`.

## 3. View

- [ ] 3.1 `#saml-view` with three panels. SAML: `#saml-input`, `#saml-skew`, `#btn-saml-decode`, `#saml-results` (message header table, assertion card(s), attribute table, signature placement card, raw pretty XML via `xmlPrettyPrint()`), `#saml-gates`. OIDC: `#saml-oidc-idtoken`, `#saml-oidc-access`, `#saml-oidc-code`, `#saml-oidc-nonce`, `#saml-oidc-client`, `#saml-oidc-maxage`, `#saml-oidc-jwks`, `#btn-saml-oidc-check`, `#saml-oidc-gates`. PASETO: `#saml-paseto-input`, `#saml-paseto-key`, `#saml-paseto-implicit`, `#btn-saml-paseto-verify`, `#saml-paseto-results`.
- [ ] 3.2 Conditions rows rendered with `Intl.DateTimeFormat` + `Intl.RelativeTimeFormat` ("expires in 3 minutes" / "expired 4 minutes ago").
- [ ] 3.3 Top status line on every SAML decode stating signature placement and "not verified by this tool"; hook point for `xml-dsig-verification` when that capability ships.
- [ ] 3.4 Related links: JWT Inspector, TLS Certificate Parser, XML formatter, Unix Timestamp, Link Safety Inspector (for the Destination URL).

## 4. Tests

- [ ] 4.1 `tests/specs/31-saml.spec.js` (number assigned at implementation): Redirect URL fixture, POST body fixture, raw XML fixture, each gate ✗ case, signature placement response-only vs assertion, EncryptedAssertion notice, attribute table rendering, OIDC `at_hash` ✓ / ✗, `c_hash`, nonce mismatch, `azp` rule, PASETO `4-S-1` ✓ and mutated ✗, v4.local structural split, verdict wording, network-silence assertion, XSS payload in an Attribute value and in RelayState rendered inert.
- [ ] 4.2 Register `saml` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 5. Wiring and gates

- [ ] 5.1 ~55 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys; CLDR plural group for "n attributes".
- [ ] 5.2 TOOL_ORDER (after `jwt`), TOOL_TO_GROUP sign-verify, TOOL_SYNONYMS (`saml sso assertion idp sp okta entra adfs shibboleth oidc id_token at_hash nonce paseto federation`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 5.3 README: Features list, standards cheat sheet rows (OASIS SAML 2.0 core / bindings / profiles; OIDC Core 1.0; PASETO v2 / v4), Per-Tool Security Notes paragraph (decoded, not verified; no metadata fetch); SPEC-INTERNATIONAL.md status note.
- [ ] 5.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
