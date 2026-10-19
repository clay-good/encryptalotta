# Spec Delta — saml-security-lint

## Purpose

Run ✓ / ✗ gates over a decoded SAML 2.0 Response for the signing, validity, audience, and XML-structure failure classes of the Web Browser SSO profile (OASIS saml-profiles-2.0-os §4.1.4; saml-sec-consider-2.0-os), entirely in the browser, without performing signature verification.

## ADDED Requirements

### Requirement: Signing gates
The tool SHALL display independent ✓ / ✗ rows for: at least one `Assertion` carries a `ds:Signature` (saml-profiles-2.0-os §4.1.4.5 — assertions over POST MUST be signed); the assertion signature's `Reference/@URI` resolves to that assertion's `ID`; a response-level signature that is the only signature is ✗ "response signed but assertion not signed".

#### Scenario: Response-only signature
- **WHEN** `ds:Signature` is a child of `Response` and the `Assertion` has none
- **THEN** the assertion-signed gate is ✗ citing §4.1.4.5 and the detail names XML Signature Wrapping as the risk

#### Scenario: Unsigned everything
- **WHEN** no `ds:Signature` exists
- **THEN** both signing gates are ✗ and the summary line reads "unsigned — a service provider must reject this"

### Requirement: Signature verification deferral
Every signing gate SHALL carry the note that signature cryptography (canonicalization, reference digests, `SignedInfo` signature — XML-DSig Core §3.2) is performed by the `xml-dsig-verification` capability of change `eidas-signature-cryptographic-verification`, and this tool SHALL call it when present and otherwise show "present — not verified here".

#### Scenario: Before the verifier ships
- **WHEN** an assertion is signed and the XML-DSig verifier is not yet in the page
- **THEN** the signing gate is ✓ for placement and a separate row reads "signature present — not verified here", never "signature valid"

### Requirement: Validity and audience gates
The tool SHALL display independent ✓ / ✗ rows for: `Conditions` present (saml-core-2.0-os §2.5.1); `NotBefore` not after now + skew and `NotOnOrAfter` after now − skew (§2.5.1.2, §2.5.1.5), with the user's clock-skew allowance; `AudienceRestriction` present (§2.5.1.4); `SubjectConfirmationData/Recipient` present and https (§4.1.4.3); and ⚠ when `NotOnOrAfter − NotBefore` exceeds 10 minutes (heuristic, labelled as such).

#### Scenario: Oversized validity window
- **WHEN** `NotBefore` and `NotOnOrAfter` are 24 hours apart
- **THEN** the window gate is ⚠ reading "24 hours — typical IdPs issue 5-minute windows; this is a heuristic, not a profile rule"

#### Scenario: Missing audience
- **WHEN** `Conditions` has no `AudienceRestriction`
- **THEN** the gate is ✗ citing §2.5.1.4 and explaining that any SP could accept the assertion

### Requirement: XML-content gates
The tool SHALL display independent ✓ / ✗ rows for: no XML comment or processing instruction inside `NameID`, `Attribute`, or `AttributeValue` text (CVE-2017-11427 class — the parsed text differs from the canonicalized text); exactly one `Assertion` (⚠ for several — wrapping / confusion surface); no `xsi:type` attribute on `Assertion`, `Subject`, `Conditions`, or `NameID`.

#### Scenario: Comment inside NameID
- **WHEN** the NameID element is `<NameID>alice<!-- -->@example.com</NameID>`
- **THEN** the gate is ✗ showing both the full text content `alice@example.com` and the first text node `alice`, citing CVE-2017-11427

#### Scenario: Two assertions
- **WHEN** the Response carries two `Assertion` elements
- **THEN** the gate is ⚠ "2 assertions — a service provider must bind its checks to the signed one" and both are rendered

### Requirement: Transport gates
The tool SHALL display independent ✓ / ✗ rows for: `Destination` present and https (saml-core-2.0-os §3.2.2; saml-bindings-2.0-os §3.5.5.2); `InResponseTo` present on a Response (⚠ when absent: unsolicited, IdP-initiated SSO).

#### Scenario: IdP-initiated response
- **WHEN** a Response has no `InResponseTo`
- **THEN** the gate is ⚠ "unsolicited response — the SP cannot tie it to a request it made"

#### Scenario: http Destination
- **WHEN** `Destination` starts with `http://`
- **THEN** the gate is ✗ and the Link Safety Inspector is offered as the related tool for the URL

### Requirement: Offline operation and verdict language
The tool SHALL lint without any network request and SHALL phrase an all-✓ result as "structure conforms to the SAML 2.0 Web Browser SSO profile checks listed here — the signature has not been verified, so this does not establish that the IdP issued it".

#### Scenario: Input never leaves the page
- **WHEN** a Response is linted while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary line is the sentence above and contains neither "safe", "valid", nor "trusted"
