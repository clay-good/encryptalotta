# Design — SAML / Federation Token Decoder

## Context

Three token families, three encodings:

| Family | Wire form | Governing text |
|---|---|---|
| SAML 2.0 HTTP-Redirect | URL query `SAMLRequest` / `SAMLResponse` = URL-encode(Base64(DEFLATE(XML))), optional `RelayState`, `SigAlg`, `Signature` | saml-bindings-2.0-os §3.4 |
| SAML 2.0 HTTP-POST | form field `SAMLResponse` = Base64(XML) | saml-bindings-2.0-os §3.5 |
| OIDC ID token | compact JWS; claims `nonce`, `at_hash`, `c_hash`, `azp`, `auth_time` | OpenID Connect Core 1.0 §2, §3.1.3.7 |
| PASETO | `version.purpose.payload[.footer]`, base64url without padding; `public` = message ‖ 64-byte Ed25519 signature | paseto-spec (v2, v4) |

The SAML XML is namespaced (`samlp:` protocol, `saml:` assertion, `ds:` XML-DSig); the UBL / SEPA inspectors already walk XML by local name through `DOMParser`, so namespace prefixes chosen by the IdP do not matter. Inflate is native: `new DecompressionStream('deflate-raw')` is what the Factur-X path uses on PDF streams.

Signature placement is the single most important thing to show. A `ds:Signature` child of `samlp:Response` signs the response envelope; a `ds:Signature` child of `saml:Assertion` signs the assertion. The Web Browser SSO profile (saml-profiles-2.0-os §4.1.4.5) requires the assertion to be signed when carried over POST; a response-only signature lets an attacker swap the assertion inside (XML Signature Wrapping, Somorovsky et al. 2012). The 2018 Duo disclosure (CVE-2017-11427 and siblings) showed that a comment inside `<NameID>user<!---->@example.com</NameID>` changes the text node a naive parser reads after canonicalization has been checked.

## Goals / Non-Goals

**Goals:**
- Paste anything — URL, form body, bare value, raw XML — and get the decode.
- Every field labelled with its element name and the saml-core clause.
- Signature *placement* and *reference target* are reported precisely, even though signature *verification* is not done here.
- OIDC hash checks with the correct hash for the token's `alg` (SHA-256 for *256, SHA-384 for *384, SHA-512 for *512; left-most half, base64url).
- PASETO `public` signature actually verified.

**Non-Goals:**
- No XML-DSig verification (C14N + reference digests + SignedInfo signature) — that is `xml-dsig-verification` in `eidas-signature-cryptographic-verification`; this tool calls it when present and otherwise says "signature present, not verified here".
- No HTTP-Redirect query-string signature verification in slice 1 (same follow-up).
- No `EncryptedAssertion` decryption; no metadata or JWKS fetching; no PASETO `local` decryption.

## Decisions

1. **One tool with three panels (SAML / OIDC / PASETO)** rather than three tools or folding into the JWT Inspector. Rationale: these are the "federation" tokens an SSO engineer meets together; the JWT Inspector is already the EUDI credential decoder and should not also become the SAML decoder. OIDC checks live here, not in the Inspector, because they need the access token and code as additional inputs; the Inspector verifies the signature via a function call.
2. **Binding detection by shape.** Starts with `http` → `URL` API, read `SAMLRequest` / `SAMLResponse` / `RelayState` / `SigAlg` / `Signature`; contains `SAMLResponse=` → form body, URL-decode; starts with `<` → raw XML; otherwise Base64. After Base64, if the bytes do not start with `<` (0x3C) or a UTF-8 BOM, try `deflate-raw` inflate. Rejected: a binding dropdown — the shapes are unambiguous and the Redirect-vs-POST difference is exactly what confuses people.
3. **Inflate via `DecompressionStream('deflate-raw')`.** Pure JS alternative rejected: the native stream is already used by the Factur-X path and keeps the page under budget. Failure (older Safari) is reported as "this browser lacks DecompressionStream — paste the POST form instead".
4. **XML walk by local name** over `DOMParser` with `application/xml`; namespace URIs are checked only for the signature-placement and `xsi:type` gates, where the namespace *is* the finding. Parser errors (`<parsererror>`) are shown, never thrown. Reuses `xmlField()` / the UBL walker's child-by-local-name helper.
5. **Signature placement is computed, not assumed.** For every `ds:Signature`, read its parent element and every `ds:Reference/@URI`; resolve `#id` against `ID` attributes; report "signs Response (ID …)", "signs Assertion (ID …)", or "Reference URI does not resolve to Response or Assertion" (the wrapping tell-tale). `ds:X509Certificate` contents render through the `tls-cert` X.509 renderer so the IdP certificate's subject and validity are visible.
6. **Conditions use `Intl`.** `NotBefore` / `NotOnOrAfter` parsed as ISO 8601; the gate compares to `Date.now()` with a user-adjustable clock-skew input (default 0, the profile is silent; common SP default 3 minutes) and renders "expired 4 minutes ago" via `Intl.RelativeTimeFormat`.
7. **Lint rows reuse the SEPA / UBL `{ok, label, detail, clause}` framework.** Each row cites saml-profiles-2.0-os §4.1.4.x, saml-core-2.0-os §2.5.1.x, or the CVE / paper for the attack class. The window gate threshold (10 minutes) is a heuristic, labelled as such.
8. **OIDC hash checks via `crypto.subtle.digest`.** Hash algorithm from the ID token's `alg` suffix (RFC 7518 §3.1 naming); `at_hash` = base64url(left half of H(access_token)) (OIDC Core §3.2.2.9), `c_hash` likewise over `code` (§3.3.2.10). Signature verification delegates to `jwkVerify()` with a pasted JWKS; no discovery fetch. Pure JS: none.
9. **PASETO PAE hand-rolled (12 lines), Ed25519 via Web Crypto.** PAE = LE64(pieces) ‖ for each piece LE64(len) ‖ bytes; v2.public signs PAE(h, m, f), v4.public signs PAE(h, m, f, i) with the implicit assertion `i` (empty unless the user supplies it). `h` is the literal header `v4.public.`. `local` tokens are split into nonce / ciphertext / tag by the version's fixed sizes and shown as hex only. Rejected: hand-rolling XChaCha20 (HChaCha20 + the page's ChaCha20) and BLAKE2b-keyed for v4.local — feasible later, not needed to inspect a token.
10. **Base64 variants.** SAML is standard Base64 with possible whitespace / line breaks (strip them); PASETO is base64url without padding; OIDC is base64url. One normalising helper handles all three, reusing the encoder tool's tables.

## Risks / Trade-offs

- **"Decoded but not verified" being misread.** Every SAML result carries a top line "XML-DSig signature present on <element> — not verified by this tool" until the eIDAS change lands; the lint never shows a ✓ for "signature valid".
- **Huge attribute statements.** Some IdPs emit hundreds of group attributes; the table is rendered with `createElement` in a `DocumentFragment` and capped at 500 rows with a "show all" toggle.
- **Clock skew.** A ✗ "expired" on a token captured minutes ago is expected; the skew input and the relative-time wording make that obvious.
- **PASETO `local` is opaque.** Users may expect decryption; the panel states which algorithms are involved and why they are not run in-page.
- **OIDC hash truncation.** `at_hash` uses the *left-most half* of the hash — an easy off-by-one; the test fixture is generated from a known access token and checked against a reference implementation at implementation time.
