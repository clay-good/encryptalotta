# Proposal — WebAuthn / Passkey Inspector

## Why

Passkeys are now the default sign-in on Apple, Google, and Microsoft platforms, and **WebAuthn Level 3** became a W3C Recommendation on 25 August 2026 (Backup Eligible / Backup State flags, Conditional Create, Signals API). Every developer wiring a relying party ends up staring at two opaque blobs — `clientDataJSON` and `attestationObject` — and today pastes them into a hosted "WebAuthn debugger" that sees the origin, the challenge, the credential ID, the public key, and the AAGUID of the authenticator the user owns. Those blobs are not secrets, but together they identify a person's device and the site they registered on.

The site already has every primitive the decode needs: the hand-rolled CBOR decoder (format tool, mdoc), the JWK ↔ PEM engine, the X.509 / ASN.1 reader for attestation certificates, SHA-256 and ECDSA / RSA / Ed25519 via Web Crypto, and the DER → raw `r‖s` conversion from the CSR tool. Nothing joins them for WebAuthn.

## What Changes

- **New tool `webauthn` — "WebAuthn / Passkey Inspector"** in Sign / Verify, next to the JWT / credential Inspector. Tool count **57 → 58**.
- **Registration decode**: paste `clientDataJSON` + `attestationObject` (base64url, or the whole JSON that `PublicKeyCredential.toJSON()` emits) → CollectedClientData fields, attestation format and statement, parsed `authenticatorData` (rpIdHash, flags with Level 3 names, signCount, AAGUID as UUID, credential ID, COSE public key rendered as JWK and PEM, extensions), `rpIdHash` check against a user-entered RP ID, and attestation-signature verification for `packed` with `x5c`.
- **Assertion verification**: paste `authenticatorData` + `clientDataJSON` + `signature` + the credential public key (COSE / JWK / PEM) → ES256 / RS256 / EdDSA verification via Web Crypto, signCount comparison, challenge and origin checks against user-entered expectations.
- **AAGUID lookup**: a short hand-maintained table of well-known authenticators; the all-zero AAGUID explained.
- Gate list in the ✓ / ✗ house style; verdict wording "signature verifies for the key you supplied — this does not prove which authenticator or user produced it".
- Related-tool links: webauthn ↔ JWT Inspector ↔ JWK ↔ PEM ↔ TLS Certificate Parser ↔ CBOR formatter.

Out of scope (and the §7 non-goal it respects): no FIDO Metadata Service download, no attestation-root trust store, no AAGUID list fetched at runtime (§7.5 — the user pastes a root certificate if they want chain-building; the FIDO MDS is a trust list and is never fetched); no `navigator.credentials` calls from the page itself (the page registers nothing and stores nothing — §7.9); no `android-safetynet` JWS verification against Google roots (deprecated by Google, root would have to be fetched).

## Capabilities

### New Capabilities
- `webauthn-registration-decoding`: decode a `navigator.credentials.create()` response (CollectedClientData, attestation object, authenticator data, COSE key, extensions), check `rpIdHash`, verify `packed` attestation signatures, and decode `none` / `tpm` / `android-key` / `apple` statements structurally — per WebAuthn Level 3 §5.8.1, §6.1, §6.5, §8.
- `webauthn-assertion-verification`: verify a `navigator.credentials.get()` assertion signature (ES256 / ES384 / ES512 / RS256 / EdDSA) against a supplied public key, and check signCount, challenge, and origin — per WebAuthn Level 3 §7.2 and COSE RFC 9053.
- `aaguid-lookup`: map an AAGUID to a well-known authenticator name from an inline hand-maintained table, explain the all-zero AAGUID, and state the table's provenance and limits.

### Modified Capabilities
- none (the CBOR formatter, JWK ↔ PEM, and TLS Certificate Parser are called as functions; their own behaviour is unchanged).

## Impact

- `index.html`: one new view, ~550 lines of inline JS (base64url + `toJSON()` ingestion, authenticatorData byte parser, COSE → JWK mapping, attestation-statement decoders, gate functions, AAGUID table of ~20 entries), ~45 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: `cborDecode()` (attestation object, COSE key, extensions), `jwkToPem()` (public-key PEM export), `asn1Parse()` + the X.509 renderer from `tls-cert` (attestation certificates, the FIDO `id-fido-gen-ce-aaguid` extension 1.3.6.1.4.1.45724.1.1.4), the CSR tool's DER ECDSA → raw `r‖s` conversion, `crypto.subtle.digest` / `verify`, the SEPA / UBL gate-row renderer.
- No new vendored file, no CSP change, page weight +~14 KB gzipped.
- Tests: new `tests/specs/29-webauthn.spec.js` (number assigned at implementation) — a registration fixture produced by a software authenticator with `rpId` `localhost` (all four flag combinations), the WebAuthn Level 3 §6.1 flag bit positions, a `packed` self-attestation (no `x5c`) and a `packed` + `x5c` fixture, an assertion fixture with a matching JWK and a mutated signature, signCount regression, challenge mismatch, and the network-silence assertion the suite already uses.
