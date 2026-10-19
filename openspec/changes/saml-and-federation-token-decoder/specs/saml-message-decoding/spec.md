# Spec Delta — saml-message-decoding

## Purpose

Decode SAML 2.0 protocol messages (OASIS saml-core-2.0-os) carried by the HTTP-Redirect or HTTP-POST binding (saml-bindings-2.0-os §3.4, §3.5) into labelled fields, assertion detail, an attribute table, and a precise report of where any XML-DSig signature sits, entirely in the browser.

## ADDED Requirements

### Requirement: Binding detection and unwrapping
The tool SHALL accept a full Redirect URL, a POST form body, a bare `SAMLRequest` / `SAMLResponse` value, or raw XML; SHALL URL-decode and Base64-decode as the shape requires; SHALL inflate with `DecompressionStream('deflate-raw')` when the decoded bytes are not XML (saml-bindings-2.0-os §3.4.4.1 DEFLATE encoding); and SHALL report `RelayState`, `SigAlg`, and `Signature` query parameters when present.

#### Scenario: Redirect-binding AuthnRequest
- **WHEN** the user pastes `https://idp.example.org/sso?SAMLRequest=<urlencoded base64 deflate>&RelayState=abc`
- **THEN** the binding row reads "HTTP-Redirect (DEFLATE + Base64 + URL-encoded)", the XML is shown pretty-printed, and `RelayState` is listed as text

#### Scenario: POST-binding Response
- **WHEN** the user pastes a form body containing `SAMLResponse=PHNhbWxwOlJl…`
- **THEN** the binding row reads "HTTP-POST (Base64)" and the decoded XML begins with the `Response` element

#### Scenario: Browser without DecompressionStream
- **WHEN** inflate is required and `DecompressionStream` is undefined
- **THEN** the message names the missing API and suggests pasting the POST-binding form instead of failing silently

### Requirement: Message header rendering
The tool SHALL identify the message type (AuthnRequest, Response, LogoutRequest, LogoutResponse, ArtifactResolve) by local name and SHALL render `ID`, `Version`, `IssueInstant` (with `Intl.DateTimeFormat`), `Destination`, `InResponseTo`, `Issuer`, and for responses the nested `StatusCode` values and `StatusMessage` (saml-core-2.0-os §3.2.2, §3.4.1).

#### Scenario: Status with nested code
- **WHEN** a Response carries `StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Responder"` with a nested `urn:…:status:AuthnFailed`
- **THEN** both codes are shown in order with their short names ("Responder → AuthnFailed")

### Requirement: Assertion subject and conditions
The tool SHALL render each `Assertion` (saml-core-2.0-os §2.3.3): `ID`, `IssueInstant`, `Issuer`; `Subject/NameID` text and `Format` (§2.2.3, short form such as `emailAddress` / `persistent` / `transient`); `SubjectConfirmation` method and `SubjectConfirmationData` (`Recipient`, `NotOnOrAfter`, `InResponseTo`); `Conditions` `NotBefore` / `NotOnOrAfter` with a relative-time phrase; `AudienceRestriction/Audience`.

#### Scenario: Expired conditions
- **WHEN** `NotOnOrAfter` is four minutes before the browser's clock
- **THEN** the row reads the ISO instant followed by "expired 4 minutes ago" from `Intl.RelativeTimeFormat`

#### Scenario: NameID format named
- **WHEN** `NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"`
- **THEN** the format row shows the short name `emailAddress` beside the full URN

### Requirement: Assertion statements
The tool SHALL render `AuthnStatement` (`AuthnInstant`, `SessionIndex`, `SessionNotOnOrAfter`, `AuthnContextClassRef` — saml-core-2.0-os §2.7.2) and `AttributeStatement` (§2.7.3) as a table of `Name`, `NameFormat`, `FriendlyName`, and values, with multi-valued attributes listed in order.

#### Scenario: Multi-valued attribute
- **WHEN** an `Attribute Name="groups"` carries three `AttributeValue` children
- **THEN** the table row lists the three values and the attribute count line reads "n attributes" via the CLDR plural rules

#### Scenario: Encrypted assertion
- **WHEN** the Response contains `EncryptedAssertion` instead of `Assertion`
- **THEN** the assertion card reads "EncryptedAssertion — XML-Enc, requires the service provider's private key; not decrypted here" and shows the `EncryptionMethod` algorithm

### Requirement: Signature placement
The tool SHALL list every `ds:Signature` with its parent element, `SignatureMethod`, `CanonicalizationMethod`, each `Reference/@URI` and the element it resolves to by `ID`, and the `X509Certificate` rendered through the TLS Certificate Parser; SHALL summarise placement as "response signed", "assertion signed", "both", or "neither"; and SHALL state that the signature is not verified by this tool (XML-DSig Core §4.4; saml-core-2.0-os §5).

#### Scenario: Assertion-only signature
- **WHEN** the only `ds:Signature` is a child of `Assertion` and its `Reference URI="#_a1"` matches that assertion's `ID`
- **THEN** the placement reads "assertion signed (Reference → Assertion _a1); response not signed" and the status line reads "signature present — not verified by this tool"

#### Scenario: Reference does not resolve
- **WHEN** a `Reference/@URI` points to an `ID` that is neither the Response nor an Assertion
- **THEN** the placement row is ⚠ "Reference target is not the Response or an Assertion" and names XML Signature Wrapping as the pattern to check

### Requirement: Offline operation and verdict language
The tool SHALL decode without any network request, SHALL render all values with `textContent`, and SHALL describe a decoded message only as "decoded per saml-core-2.0-os — signature not verified by this tool", never as valid, authentic, or trusted.

#### Scenario: Input never leaves the page
- **WHEN** a Response whose `Destination` is an https URL is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`) and the Destination is text, not a link

#### Scenario: Result wording
- **WHEN** a Response decodes without parser errors
- **THEN** the status line contains "not verified" and contains neither "valid" nor "authentic"
