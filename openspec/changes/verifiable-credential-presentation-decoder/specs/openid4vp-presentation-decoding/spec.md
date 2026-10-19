# Spec Delta — openid4vp-presentation-decoding

## Purpose

Split an OpenID for Verifiable Presentations 1.0 (OpenID4VP 1.0, Final July 2025) response — `vp_token`, full authorization response, or W3C Digital Credentials API response — into its individual credential presentations, route each to the decoder for its format, and render the query and submission context, entirely in the browser.

## ADDED Requirements

### Requirement: Response ingestion
The tool SHALL accept a `vp_token` JSON object keyed by DCQL credential-query id with array values (OpenID4VP 1.0 §8.1), a full authorization-response parameter set (`vp_token`, `state`, optional `presentation_submission`), a Digital Credentials API response carrying the same members (§Appendix A), a bare single presentation string, or form-encoded `vp_token=…`; and SHALL report an encrypted response (`response` JWE, §8.3) as requiring decryption through the JWE capability rather than failing.

#### Scenario: DCQL-keyed vp_token
- **WHEN** the user pastes `{"vp_token":{"pid":["eyJ…~…~"],"mdl":["o2d2ZXJzaW9u…"]}}`
- **THEN** two credential cards appear, labelled with their query ids `pid` and `mdl`

#### Scenario: Encrypted response
- **WHEN** the pasted object has a `response` member that is a five-part JWE
- **THEN** the card reads "encrypted response (JARM / `dc_api.jwt`) — decrypt it with the verifier's private key in the Build / Encrypt tab" and no decode is attempted on the ciphertext

### Requirement: Format routing
The tool SHALL determine each presentation's format from its shape — `~`-separated → `dc+sd-jwt`; base64url CBOR map with `documents` → `mso_mdoc`; compact JWS with a `vp` claim → `jwt_vc_json`; JSON with `@context` and `proof` → `ldp_vc` (OpenID4VP 1.0 Appendix B format identifiers) — SHALL prefer the `format` stated in a pasted DCQL query or legacy `descriptor_map`, and SHALL report a disagreement between shape and hint.

#### Scenario: Shape and hint disagree
- **WHEN** the DCQL query says `"format":"mso_mdoc"` for `pid` but the presentation contains `~`
- **THEN** the card is decoded as SD-JWT and a ⚠ row reads "query declared mso_mdoc; content is SD-JWT"

#### Scenario: jwt_vc_json unwrap
- **WHEN** a presentation is a compact JWS whose payload has `vp.verifiableCredential` with two entries
- **THEN** the outer JWS is decoded, and each inner credential becomes its own sub-card decoded as JWT with its `vc` claim rendered

### Requirement: Query and submission echo
The tool SHALL render a pasted DCQL query (OpenID4VP 1.0 §6: `credentials[]` with `id`, `format`, `meta`, `claims[]`) beside the cards, SHALL match each card to its query entry by id, SHALL list requested claim paths against disclosed claims, and SHALL render a legacy `presentation_submission` (`definition_id`, `descriptor_map[]` with `id`, `format`, `path`, `path_nested`) when present, labelled "Presentation Exchange — pre-1.0 drafts".

#### Scenario: Requested versus disclosed
- **WHEN** the DCQL entry for `pid` requests claims `given_name`, `family_name`, `birthdate` and the SD-JWT discloses only the first two
- **THEN** the card lists the three paths with ✓ ✓ and "not disclosed" for `birthdate`

### Requirement: Per-card summary
Each card SHALL carry the format, the decoder's own gate list, the holder-binding result when the format has one (KB-JWT for SD-JWT with `aud` / `nonce`, `deviceAuth` for mdoc), and a one-line verdict that names what was verified and against which key.

#### Scenario: Mixed verdicts
- **WHEN** the SD-JWT card's KB-JWT verifies and the mdoc card's MSO verifies but no SessionTranscript was pasted
- **THEN** the first card reads "issuer signature and key binding verify for the keys shown" and the second reads "issuer signature verifies against the embedded certificate; device authentication not checked (no SessionTranscript)"

### Requirement: Offline operation and verdict language
The tool SHALL decode without any network request, SHALL show `client_id`, `response_uri`, and any URL in the response as text, and SHALL never describe a presentation as "valid" or "trusted" — only as decoded and, per card, as verified against the named key or certificate.

#### Scenario: Input never leaves the page
- **WHEN** a response containing a `response_uri` is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every card's gates are ✓
- **THEN** the summary reads "n presentations decoded; each verifies against the key or certificate embedded in it — this does not establish that any issuer is trusted" and contains neither "safe" nor "valid"
