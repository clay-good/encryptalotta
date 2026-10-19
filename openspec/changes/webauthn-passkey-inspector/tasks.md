# Tasks — WebAuthn / Passkey Inspector

## 1. Byte-level engine

- [ ] 1.1 `webauthnIngest(text) → {kind, clientDataJSON, attestationObject | authenticatorData, signature, userHandle, rawId}` accepting `PublicKeyCredential.toJSON()` output, a `{response: …}` fragment, or bare base64url / base64 / hex fields; `kind` is `registration` or `assertion`.
- [ ] 1.2 `webauthnParseClientData(bytes)` → `{type, challenge, origin, crossOrigin, topOrigin, extra}` with UTF-8 decode and JSON parse errors reported, never thrown.
- [ ] 1.3 Extend `cborDecode()` with an optional `{consumed}` result (no behaviour change for the format tool); confirm the existing CBOR Playwright cases pass unchanged.
- [ ] 1.4 `webauthnParseAuthData(bytes)` → `{rpIdHash, flags:{UP,UV,BE,BS,AT,ED,reserved}, signCount, aaguid, credentialId, coseKey, extensions, trailing}` per Level 3 §6.1.
- [ ] 1.5 `coseKeyToJwk(map)` for EC2 / RSA / OKP with RFC 9053 label and `alg` mapping; PEM via `jwkToPem()`.
- [ ] 1.6 Node-side check: the flag byte `0x45` decodes to UP + UV + AT; `0x1D` to UP + UV + BE + BS; a 16-byte AAGUID renders as RFC 9562 hyphenated lowercase UUID.

## 2. Attestation and assertion verification

- [ ] 2.1 `webauthnVerifyAttestation({fmt, attStmt, authData, clientDataHash})`: `none`; `packed` with `x5c` (leaf SPKI via `asn1Parse()`, AAGUID extension 1.3.6.1.4.1.45724.1.1.4 cross-check) and self-attestation; `tpm` structure + `extraData` equality; `android-key` / `apple` structure + nonce equality; `fido-u2f` and `android-safetynet` reported as not verified with the reason.
- [ ] 2.2 `webauthnVerifyAssertion({authData, clientDataJSON, signature, key})` with COSE / JWK / PEM key ingestion, DER → raw `r‖s` via the CSR tool's routine, Web Crypto `verify` for ECDSA / RSASSA-PKCS1-v1_5 / Ed25519.
- [ ] 2.3 Gate functions (`{ok, label, detail, clause}`): `type` value, challenge match, origin match, `rpIdHash` match, UP set, UV set when expected, BE / BS consistency (BS without BE is ✗), signCount > previous, signCount 0 ⚠, AT set on registration, ED set ⇔ extensions present, trailing bytes ⚠.

## 3. AAGUID table

- [ ] 3.1 Inline `WEBAUTHN_AAGUIDS` array of ~20 `{aaguid, name, kind}` rows (platform / roaming / software) with a source comment per row; all-zero AAGUID handled before lookup.
- [ ] 3.2 Lookup is case-insensitive and accepts hyphenated or bare 32-hex input.

## 4. View

- [ ] 4.1 `#webauthn-view` with two panels: Registration (`#webauthn-reg-input` textarea for `toJSON()` / fields, `#webauthn-reg-clientdata`, `#webauthn-reg-attobj`, `#webauthn-rpid`, `#webauthn-expect-challenge`, `#webauthn-expect-origin`, `#btn-webauthn-decode`) and Assertion (`#webauthn-asn-authdata`, `#webauthn-asn-clientdata`, `#webauthn-asn-signature`, `#webauthn-asn-key`, `#webauthn-prev-count`, `#btn-webauthn-verify`).
- [ ] 4.2 Results `#webauthn-results` (CollectedClientData table, authenticatorData table with flag bits, COSE key as labelled rows + JWK + PEM with copy buttons, attestation statement, extensions tree reusing the CBOR tree renderer, `x5c` certificates via the `tls-cert` renderer) and `#webauthn-gates`.
- [ ] 4.3 AAGUID panel `#webauthn-aaguid-input` + `#btn-webauthn-aaguid-lookup`; auto-filled from a decoded registration.
- [ ] 4.4 Summary line wording per the verdict requirements; handoff links to JWT Inspector (JWK), JWK ↔ PEM, TLS Certificate Parser, CBOR formatter.

## 5. Tests

- [ ] 5.1 `tests/specs/29-webauthn.spec.js` (number assigned at implementation): `toJSON()` ingestion, bare-field ingestion, flag bit table, AAGUID rendering, `rpIdHash` match / mismatch for `localhost`, `none` attestation, `packed` self-attestation ✓ and mutated-signature ✗, `packed` + `x5c` fixture, assertion ✓ with JWK / PEM / COSE key, signCount regression ✗, challenge mismatch ✗, all-zero AAGUID explanation, verdict wording, network-silence assertion, XSS payload in `origin` rendered inert.
- [ ] 5.2 Register `webauthn` in 00-introspect, 05-a11y (light + dark), 08-stress KNOWN_VIEWS, 11-xss rosters.

## 6. Wiring and gates

- [ ] 6.1 ~45 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys.
- [ ] 6.2 TOOL_ORDER (after `jwt`), TOOL_TO_GROUP sign-verify, TOOL_SYNONYMS (`passkey fido fido2 webauthn attestation assertion authenticator aaguid cose credential ctap`), RELATED_TOOLS both directions, JSON-LD featureList entry; audit gate 20 tool count 57 → 58.
- [ ] 6.3 README: Features list, standards cheat sheet rows (WebAuthn Level 3; COSE RFC 9052 / 9053; RFC 8812), Per-Tool Security Notes paragraph (no MDS, no trust verdict); SPEC-INTERNATIONAL.md status note.
- [ ] 6.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
