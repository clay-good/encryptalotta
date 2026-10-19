# Spec Delta — crl-and-ocsp-decoding

## Purpose

Decode a pasted or loaded Certificate Revocation List (RFC 5280 §5) or OCSP response (RFC 6960), answer whether a given certificate's serial appears in it, and verify its signature against a pasted issuer or embedded responder certificate — without fetching anything.

## ADDED Requirements

### Requirement: CRL decoding
The tool SHALL decode a CRL (PEM or DER) per RFC 5280 §5.1 and display version, signature algorithm, issuer, thisUpdate, nextUpdate, CRL number, delta CRL indicator, authority key identifier, issuing distribution point, and the revoked entries (serial, revocationDate, reasonCode name per §5.3.1, invalidityDate), rendering the first 500 entries and the total count.

#### Scenario: OpenSSL CRL decodes
- **WHEN** the fixture CRL with one revoked leaf is pasted
- **THEN** the header rows show the test CA issuer, both update times via `Intl.DateTimeFormat`, CRL number 1, and one revoked entry with reason `keyCompromise (1)`

#### Scenario: Delta CRL
- **WHEN** the CRL carries the deltaCRLIndicator extension
- **THEN** a row reads "delta CRL — base CRL number <n>; apply on top of the base list"

#### Scenario: Stale CRL
- **WHEN** nextUpdate is earlier than the current time
- **THEN** a ⚠ row reads "past nextUpdate — a newer list may exist" and decoding continues

### Requirement: Serial lookup
When a certificate is present in the parser, the tool SHALL compare its serial (as unsigned big-endian bytes) with the CRL's revoked entries, or with each OCSP SingleResponse certID, and SHALL report found or not found with the entry details.

#### Scenario: Serial listed
- **WHEN** the parsed leaf's serial appears in the pasted CRL
- **THEN** the lookup row reads "serial <hex> is listed — revoked on <date>, reason keyCompromise" and the issuer-match row states whether the CRL issuer equals the certificate issuer

#### Scenario: Serial not listed
- **WHEN** the serial is absent
- **THEN** the row reads "serial not in this CRL (as of thisUpdate <date>)" and never "not revoked" without the date qualifier

### Requirement: OCSP response decoding
The tool SHALL decode an OCSPResponse (DER, Base64, or `.ors` file) per RFC 6960 §4.2.1: responseStatus, and for a BasicOCSPResponse the responderID (byName or byKey), producedAt, each SingleResponse (certID hash algorithm, issuerNameHash, issuerKeyHash, serial, certStatus good / revoked with revocationTime and reason / unknown, thisUpdate, nextUpdate), the nonce extension (§4.4.1), and embedded responder certificates.

#### Scenario: Good response with nonce
- **WHEN** an `openssl ocsp` response for a good serial with a nonce is pasted
- **THEN** the rows show responseStatus successful, responderID, producedAt, certStatus good, thisUpdate / nextUpdate, and the nonce hex

#### Scenario: Revoked response
- **WHEN** the response covers a revoked serial
- **THEN** certStatus reads "revoked at <time>, reason <name>"

#### Scenario: No nonce
- **WHEN** the nonce extension is absent
- **THEN** a row reads "no nonce — replay freshness relies on nextUpdate" without failing

#### Scenario: Error status
- **WHEN** responseStatus is tryLater (3) or unauthorized (6)
- **THEN** the status name is shown and the tool states that no BasicOCSPResponse is present

### Requirement: Signature verification
The tool SHALL verify the CRL signature over the sliced `tbsCertList` against a pasted issuer certificate, and the OCSP signature over the sliced `tbsResponseData` against the embedded responder certificate (checking the id-kp-OCSPSigning EKU, RFC 6960 §4.2.2.2) or a pasted certificate, via Web Crypto RSA / RSA-PSS / ECDSA / Ed25519, and SHALL check that the responder key hash matches a byKey responderID.

#### Scenario: CRL signature verifies
- **WHEN** the test CA certificate is pasted as issuer
- **THEN** the signature row is ✓ "CRL signature verifies with the pasted issuer key"

#### Scenario: Responder certificate
- **WHEN** the OCSP response embeds a delegated responder certificate with the OCSPSigning EKU
- **THEN** the signature row is ✓ and the EKU row is ✓; a responder certificate without the EKU yields ⚠ "signature verifies but the responder lacks id-kp-OCSPSigning"

#### Scenario: No key available
- **WHEN** neither an embedded certificate nor a pasted one is present
- **THEN** the row reads "not verified — paste the issuer / responder certificate"

### Requirement: Offline operation
The tool SHALL never contact a CRL distribution point or OCSP responder; URLs found in the certificate or response SHALL be displayed as text.

#### Scenario: Input never leaves the page
- **WHEN** a CRL and an OCSP response are decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A not-found serial or a good OCSP status SHALL be reported as the data's statement at its date and SHALL NOT be phrased as "the certificate is valid" or "safe".

#### Scenario: Clean result wording
- **WHEN** the OCSP status is good and its signature verifies
- **THEN** the summary reads "Responder <name> stated good at <producedAt>; signature math verifies with the embedded responder certificate. This does not establish that the responder is authorised by an issuer you trust — validate its chain."
