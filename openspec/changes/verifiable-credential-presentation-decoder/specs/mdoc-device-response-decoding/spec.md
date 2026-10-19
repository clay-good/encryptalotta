# Spec Delta — mdoc-device-response-decoding

## Purpose

Decode an ISO/IEC 18013-5 `DeviceResponse` — the structure an mdoc wallet returns to a reader — including the device-signed half, verify the issuer's MSO signature against the embedded certificate, verify device authentication when the SessionTranscript is supplied, and recompute value digests, entirely in the browser.

## ADDED Requirements

### Requirement: DeviceResponse structure
The tool SHALL decode a `DeviceResponse` (ISO/IEC 18013-5 §8.3.2.1.2.2) from hex or base64url CBOR: `version`, `documents[]` each with `docType`, `issuerSigned` (handed to the existing MSO decoder), `deviceSigned` (`nameSpaces` tag-24 bytes, `deviceAuth`), and `errors`; plus `documentErrors` and `status` (0 OK, 10 general error, 11 CBOR decoding error, 12 CBOR validation error).

#### Scenario: Single mDL document
- **WHEN** a DeviceResponse with one document of `docType` `org.iso.18013.5.1.mDL` is pasted
- **THEN** the card shows version `1.0`, status `0 (OK)`, the docType, the issuer-signed namespaces as today, and a new "device signed" section listing the device namespaces and the `deviceAuth` kind

#### Scenario: Error status
- **WHEN** `status` is 11
- **THEN** the status row reads `11 — CBOR decoding error` and any present documents still render

### Requirement: Issuer signature verification
The tool SHALL build the COSE_Sign1 `Sig_structure` `["Signature1", protected, h'', payload]` (RFC 9052 §4.4) over the original `protected` bytes and the tag-24 `MobileSecurityObjectBytes`, SHALL take the public key from the `x5chain` header (label 33, RFC 9360) leaf certificate's SubjectPublicKeyInfo via the page's ASN.1 reader, and SHALL verify ES256 / ES384 / ES512 via Web Crypto (18013-5 §9.1.2.4), rendering the chain through the TLS Certificate Parser.

#### Scenario: Self-consistent MSO
- **WHEN** the fixture's `issuerAuth` is verified
- **THEN** the gate is ✓ "MSO signature verifies against x5chain[0] (subject …) — not chained to any IACA root"

#### Scenario: Tampered MSO
- **WHEN** one byte of the MSO payload is changed
- **THEN** the gate is ✗ and the value-digest column still evaluates against the (tampered) digests

### Requirement: Value digest recomputation
The tool SHALL hash each `IssuerSignedItemBytes` exactly as received (the tag-24 byte string, never re-encoded) with the MSO `digestAlgorithm` (SHA-256 / 384 / 512) and compare it to `valueDigests[nameSpace][digestID]` (18013-5 §9.1.2.5), showing a ✓ / ✗ per data element.

#### Scenario: Tampered element
- **WHEN** the `given_name` element's value is altered inside its tag-24 bytes
- **THEN** that element's digest column is ✗ and every other element remains ✓

### Requirement: Device authentication
The tool SHALL accept a pasted `SessionTranscript` (CBOR, hex or base64url), build `DeviceAuthenticationBytes` as tag 24 of `["DeviceAuthentication", SessionTranscript, docType, DeviceNameSpacesBytes]` (18013-5 §9.1.3.4), and verify `deviceSignature` (COSE_Sign1, detached payload) with `deviceKeyInfo.deviceKey` from the MSO via Web Crypto; `deviceMac` (COSE_Mac0) SHALL be rendered structurally with the note that the MAC key requires the reader's ephemeral private key.

#### Scenario: Device signature verifies
- **WHEN** the fixture's SessionTranscript is pasted
- **THEN** the gate is ✓ "device signature verifies with the device key in the MSO — the holder's device signed this response"

#### Scenario: No transcript
- **WHEN** no SessionTranscript is pasted
- **THEN** the row reads "device authentication not checked — paste the SessionTranscript the reader used" and the MSO result is unaffected

#### Scenario: deviceMac
- **WHEN** `deviceAuth` is `deviceMac`
- **THEN** the row shows the COSE_Mac0 algorithm and tag length and states it is not verified in-page

### Requirement: Offline operation and verdict language
The tool SHALL decode and verify without any network request and SHALL phrase a fully ✓ card as "MSO and device signatures verify against the certificate and key embedded in the response — this does not establish that the issuer is a recognised authority".

#### Scenario: Input never leaves the page
- **WHEN** a DeviceResponse is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate is ✓
- **THEN** the summary is the sentence above and contains neither "genuine", "valid licence", nor "trusted"
