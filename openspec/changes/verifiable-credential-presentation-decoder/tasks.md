# Tasks — Verifiable-credential presentation decoder

## 1. Shared engines

- [ ] 1.1 Extend `cborDecode()` results with `{start, end}` byte offsets per item (no change to the format tool's rendered output); add `cborEncodeMinimal()` for arrays, byte strings, text strings, and small unsigned integers (Sig_structure only).
- [ ] 1.2 `coseSign1Verify({protected, payload, signature, key})` building `["Signature1", protected, h'', payload]` (RFC 9052 §4.4); ES256 / 384 / 512 and EdDSA via Web Crypto; key from SPKI bytes or COSE_Key via the existing COSE → JWK mapping.
- [ ] 1.3 `varintDecode()`, `multibaseDecode()`, `multicodecName()`, `multihashDecode()`, `cidDecode()`, `cidV1ForBytes({codec, hash})`; Node-side check against the `Qm…` / `bafy…` pair.
- [ ] 1.4 `jcsCanonicalize(value)` per RFC 8785 with the §3.2.3 example as a test; `ecPointDecompress(crv, x, sign)` with BigInt.

## 2. Presentation routing and SD-JWT VC

- [ ] 2.1 `vpIngest(text)` → `{kind, vpToken, dcql, submission, encrypted}` for `vp_token` objects, full authorization responses, DC API `data`, bare presentations; JWE detection with handoff to `jwe-encryption` when present.
- [ ] 2.2 `vpRoute(presentation, formatHint)` → one of `dc+sd-jwt` / `mso_mdoc` / `jwt_vc_json` / `ldp_vc` with the guess-vs-hint disagreement reported.
- [ ] 2.3 SD-JWT VC rows on top of `sdJwtRender()`: `typ` gate, `vct` + `vct#integrity`, issuer-metadata URL derivation (draft-16 §5), `status.status_list` pointer; `jwt_vc_json` `vp` → `verifiableCredential[]` unwrap.
- [ ] 2.4 `statusListDecode(token)` for `statuslist+jwt` / `statuslist+cwt`: `bits`, `lst` ZLIB inflate via `DecompressionStream('deflate')`, `statusAt(idx)`, `sub` ↔ `uri` check, `exp` / `ttl` rows, signature via `jwkVerify()`.

## 3. mdoc DeviceResponse

- [ ] 3.1 `mdocDeviceResponseDecode(bytes)` → `{version, documents, documentErrors, status}` wrapping the existing issuer-signed walker; `deviceSigned.nameSpaces` tag-24 unwrap; `deviceAuth` kind.
- [ ] 3.2 MSO verification: `x5chain` (label 33) leaf → SPKI → `coseSign1Verify`; certificate chain rendered through `tls-cert`; `validityInfo` gates (`signed`, `validFrom`, `validUntil`, `expectedUpdate`).
- [ ] 3.3 Device authentication: build `DeviceAuthenticationBytes` from the pasted SessionTranscript CBOR, `docType`, and the received `DeviceNameSpacesBytes`; verify with `deviceKeyInfo.deviceKey`; `deviceMac` reported as structure only.
- [ ] 3.4 Value digests: hash each `IssuerSignedItemBytes` slice with the MSO `digestAlgorithm`, compare to `valueDigests`, per-element ✓ / ✗ column.

## 4. DIDs and Data Integrity

- [ ] 4.1 `didKeyDecode()`, `didJwkDecode()`, `didWebUrl()`; JWK + PEM output; the did:key spec Ed25519 example as a test.
- [ ] 4.2 `dataIntegrityVerify(document, {key})`: suite dispatch (`eddsa-jcs-2022`, `ecdsa-jcs-2019`; `-rdfc-` / `bbs-` → unsupported row), proof options hashing, `proofValue` multibase decode, Web Crypto verify; `created` / `expires` / `proofPurpose` / `challenge` / `domain` rows.

## 5. View

- [ ] 5.1 In `#jwt-view`: a Presentation input (`#jwt-vp-input`, `#jwt-vp-dcql`, `#btn-jwt-vp-decode`) rendering one credential card per presentation into `#jwt-vp-results` with per-card gate lists `#jwt-vp-gates-<n>`; SD-JWT VC rows and the status-list paste field `#jwt-status-token` + `#btn-jwt-status-check`; DeviceResponse card with `#jwt-mdoc-transcript` + `#btn-jwt-mdoc-device-verify`; DID / multiformats sub-panel `#jwt-did-input`, `#jwt-cid-file`, `#btn-jwt-did-decode`, `#btn-jwt-cid-compute`; Data Integrity key field `#jwt-di-key` + `#btn-jwt-di-verify`.
- [ ] 5.2 Every derived URL (issuer metadata, status list, did:web, IPFS path) rendered as text with a "paste what the verifier would fetch" field; `Intl.DateTimeFormat` for every instant; verdict wording per the specs.
- [ ] 5.3 Related links: JWT Inspector (existing), CBOR formatter, TLS Certificate Parser, JWK ↔ PEM, Hash & Checksum, Base58 encoder.

## 6. Tests

- [ ] 6.1 `tests/specs/32-vc-presentation.spec.js` (number assigned at implementation): two-credential `vp_token` routing, DC API shape, legacy `presentation_submission`, SD-JWT VC `typ` gate (`dc+sd-jwt` ✓, `vc+sd-jwt` ⚠), `vct#integrity` display, issuer-metadata URL derivation, status list `bits` 1 and 2 at indices 0, 7, 8, 13 with VALID / INVALID / SUSPENDED, `sub` ≠ `uri` ✗, DeviceResponse decode, MSO ✓ against `x5chain[0]` and mutated ✗, device signature ✓ with transcript, value digest ✗ on a tampered element, did:key example → JWK, did:jwk, did:web URLs (bare host / path / port), multibase and multihash rows, `Qm…` ↔ `bafy…` equivalence, CIDv1 for a small file, RFC 8785 example, `eddsa-jcs-2022` vector ✓ and tampered ✗, `eddsa-rdfc-2022` unsupported row, verdict wording, network-silence assertion, XSS payload in a claim and a DID rendered inert.
- [ ] 6.2 Extend the `jwt` entries in 00-introspect, 05-a11y, 08-stress, 11-xss for the new controls.

## 7. Wiring and gates

- [ ] 7.1 ~70 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts) + 5 en SEO prose keys updated for the Inspector.
- [ ] 7.2 TOOL_SYNONYMS for `jwt` (`openid4vp vp_token eudi wallet sd-jwt vc mdoc deviceresponse did:key did:web cid ipfs multihash status list data integrity`), RELATED_TOOLS (jwt ↔ format ↔ tls-cert ↔ jwk ↔ hash ↔ encode), JSON-LD featureList description; audit gate 20 tool count unchanged (57).
- [ ] 7.3 README: Inspector paragraph, standards cheat sheet rows (OpenID4VP 1.0; RFC 9901; draft-ietf-oauth-sd-jwt-vc-16; draft-ietf-oauth-status-list-20; ISO/IEC 18013-5; did:key / did:jwk / did:web; multiformats; RFC 8785; W3C Data Integrity 1.0), Per-Tool Security Notes (nothing fetched, no IACA trust); SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
