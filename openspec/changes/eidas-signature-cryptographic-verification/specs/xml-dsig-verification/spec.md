# Spec Delta — xml-dsig-verification

## Purpose

Verify XML-DSig and XAdES-B-B / B-T signatures (W3C XML Signature Syntax and Processing 1.1; ETSI EN 319 132-1) in the browser: hand-rolled canonicalization, reference digest recomputation, and SignedInfo signature verification. This is slice 2 of the eIDAS verification change.

## ADDED Requirements

### Requirement: Canonicalization
The tool SHALL implement Canonical XML 1.0 (with and without comments), Canonical XML 1.1, and Exclusive XML Canonicalization 1.0 (with `InclusiveNamespaces PrefixList`) over the `DOMParser` DOM, and SHALL reject any other `CanonicalizationMethod` or `Transform` algorithm as unsupported.

#### Scenario: C14N 1.0 specification example
- **WHEN** the W3C Canonical XML 1.0 §3.3 "Start and End Tags" example document is canonicalized
- **THEN** the output bytes equal the specification's canonical form (attribute ordering, namespace declarations, whitespace preserved)

#### Scenario: Exclusive C14N drops unused namespaces
- **WHEN** a `ds:SignedInfo` carrying an unused parent namespace declaration is canonicalized with `http://www.w3.org/2001/10/xml-exc-c14n#`
- **THEN** the unused declaration is absent from the output and a declaration listed in `PrefixList` is kept

#### Scenario: Unsupported transform
- **WHEN** a Reference uses an XPath or XSLT transform
- **THEN** the reference row reads "unsupported transform <URI> — digest not recomputed" and the SignedInfo verification still runs

### Requirement: Reference digest recomputation
For each `ds:Reference` the tool SHALL resolve same-document URIs (empty URI, `#id`, and XAdES `#xpointer(id(...))` is out of scope), SHALL apply the `enveloped-signature` transform and the declared canonicalization, SHALL hash with the `DigestMethod` via Web Crypto, and SHALL compare with `DigestValue`.

#### Scenario: Enveloped signature reference matches
- **WHEN** a XAdES-B-B document whose Reference URI is empty with an enveloped-signature transform is pasted
- **THEN** the reference row is ✓ "digest matches SHA-256 of the canonicalized document minus ds:Signature"

#### Scenario: SignedProperties reference
- **WHEN** the Reference with `Type="http://uri.etsi.org/01903#SignedProperties"` points at `xades:SignedProperties` by Id
- **THEN** its row is ✓ and labelled "XAdES SignedProperties (EN 319 132-1 §6.3)"

#### Scenario: Altered document
- **WHEN** one character of the signed content is changed
- **THEN** the corresponding reference row is ✗ "digest mismatch" and the SignedInfo signature row is unaffected

### Requirement: SignedInfo signature verification
The tool SHALL canonicalize `ds:SignedInfo` with its `CanonicalizationMethod` and verify `ds:SignatureValue` with Web Crypto per the `SignatureMethod` URI: RSA-SHA256 / 384 / 512 (RFC 6931), RSA-PSS (RFC 6931 §2.3.10), ECDSA-SHA256 / 384 / 512 with the raw r ‖ s encoding (RFC 4050 / RFC 6931), and Ed25519 (RFC 9231), using the certificate in `ds:KeyInfo/X509Data` or a pasted key.

#### Scenario: RSA-SHA256 verifies
- **WHEN** a XAdES-B-B fixture signed with RSA-2048 is pasted
- **THEN** the signature row is ✓ "rsa-sha256 verifies over canonicalized SignedInfo"

#### Scenario: ECDSA raw encoding
- **WHEN** the SignatureMethod is `ecdsa-sha256`
- **THEN** the 64-byte SignatureValue is used as r ‖ s directly (no DER conversion) and the row names RFC 6931

#### Scenario: No certificate in KeyInfo
- **WHEN** `ds:KeyInfo` carries only a key name
- **THEN** the row reads "no key material in KeyInfo — paste the signer certificate to verify"

### Requirement: XAdES level and time
The tool SHALL keep the existing level detection (B-B / B-T / B-LT / B-LTA), SHALL check `xades:SigningTime` against the signer certificate's validity, SHALL verify `xades:SignatureTimeStamp` tokens with the RFC 3161 engine over the canonicalized `ds:SignatureValue`, and SHALL mark B-LT / B-LTA elements as decoded but not validated.

#### Scenario: B-T timestamp verified
- **WHEN** a XAdES-B-T fixture is pasted
- **THEN** the timestamp rows show the TSTInfo, ✓ TSA signature, and ✓ "imprint matches canonicalized SignatureValue (EN 319 132-1 §6.2.6)"

#### Scenario: B-LTA scope note
- **WHEN** `xades:ArchiveTimeStamp` elements are present
- **THEN** a row reads "archive time-stamps decoded, not validated in this slice"

### Requirement: Offline operation
Canonicalization, hashing, and verification SHALL run in the page; external entity resolution SHALL be disabled (`DOMParser` default) and no referenced URL is dereferenced.

#### Scenario: Input never leaves the page
- **WHEN** a signed XML with an external Reference URI is pasted while the browser's network log is observed
- **THEN** the reference row reads "external URI — not dereferenced" and no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A fully verified XAdES signature SHALL be summarised as "signature math verifies" with the chain statement from the trust-list anchoring capability and SHALL NOT be called valid, qualified, or legally binding on its own.

#### Scenario: Clean result wording
- **WHEN** every reference and the SignedInfo signature verify and no trust list is supplied
- **THEN** the summary reads "XAdES-B-B signature math verifies over the canonicalized content. This does not establish who the signer is or that the signature is legally valid."
