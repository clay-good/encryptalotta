# Spec Delta — certificate-chain-path-validation

## Purpose

Order a pasted set of X.509 certificates into a certification path and validate it per RFC 5280 §6 against a trust anchor the user supplies, or against the bundle's own self-signed root clearly labelled as such, entirely in the browser.

## ADDED Requirements

### Requirement: Multi-certificate input
The tool SHALL accept several PEM certificates in one paste, a PKCS#7 / CMS certs-only bundle (`.p7b` / `.p7c`), or several files, SHALL decode each with the existing certificate parser, and SHALL list them with subject, issuer, SKI, and AKI before building a path.

#### Scenario: fullchain.pem
- **WHEN** a `fullchain.pem` with a leaf and two intermediates is pasted
- **THEN** three certificate rows appear, each with subject, issuer, SKI, and AKI, and the path panel is enabled

#### Scenario: Shuffled order
- **WHEN** the same certificates are pasted root-first or in random order
- **THEN** the built path is identical to the ordered case

### Requirement: Path building
The tool SHALL build the path by matching each certificate's AKI key identifier to a candidate's SKI, falling back to issuer / subject DN equality, SHALL stop at a user-pasted anchor or a self-signed certificate, SHALL report forks (cross-signed intermediates) and take the shortest path, and SHALL name the kind of anchor reached (RFC 5280 §6.1 inputs).

#### Scenario: Anchor supplied
- **WHEN** the user pastes a root certificate in the anchor field and the bundle ends at an intermediate issued by it
- **THEN** the last path row reads "anchor supplied by you: <subject>"

#### Scenario: Bundle's own root
- **WHEN** no anchor is pasted and the bundle contains its self-signed root
- **THEN** the last path row reads "self-signed root from the bundle: <subject> — not a trust decision"

#### Scenario: Issuer missing
- **WHEN** no certificate or anchor matches the top certificate's AKI or issuer
- **THEN** the path row reads "issuer <DN> not supplied; paste it or an anchor" and the validation rows run over the partial path

### Requirement: Per-link validation gates
For each link the tool SHALL display ✓ / ✗ rows for: issuer signature verifies over the sliced `tbsCertificate` (RFC 5280 §6.1.3 (a)(1)) via Web Crypto RSA / RSA-PSS / ECDSA / Ed25519; validity contains the validation time (§6.1.3 (a)(2)); issuer certificate has basicConstraints cA=TRUE (§6.1.4 (k)); pathLenConstraint not exceeded (§6.1.4 (l)–(m)); issuer keyUsage includes keyCertSign when present (§6.1.4 (n)); no unrecognised critical extension (§6.1.4 (o)).

#### Scenario: Valid three-tier chain
- **WHEN** the fixture PKI's valid chain is validated at the current time
- **THEN** every link row is ✓ and the ECDSA link names "DER signature converted to raw r ‖ s"

#### Scenario: Expired intermediate
- **WHEN** the intermediate's `notAfter` is before the validation time
- **THEN** its validity row is ✗ naming both dates via `Intl.DateTimeFormat`, and the signature rows are still ✓

#### Scenario: pathLen violation
- **WHEN** a root with pathLenConstraint 0 issues an intermediate that issues a leaf
- **THEN** the pathLen row on the leaf link is ✗ citing RFC 5280 §6.1.4 (l)

#### Scenario: SHA-1 signed link
- **WHEN** an intermediate is signed with `sha1WithRSAEncryption`
- **THEN** the signature is verified via Web Crypto RSASSA-PKCS1-v1_5 / SHA-1 and the row carries the label "legacy SHA-1 — collision-weak; see lint (BR §7.1.3.2)"

#### Scenario: Algorithm not available in Web Crypto
- **WHEN** a link is signed with `md5WithRSAEncryption` or `ecdsa-with-SHA1`
- **THEN** the signature row reads "not verified — algorithm not available in Web Crypto" and is not shown as ✓

### Requirement: Name constraints
The tool SHALL enforce `nameConstraints` permitted and excluded subtrees from CA certificates on the leaf's SAN and subject for dNSName, rFC822Name, iPAddress, and directoryName (RFC 5280 §4.2.1.10, §6.1.4 (g)) and SHALL report other name forms as unchecked.

#### Scenario: Excluded dNSName
- **WHEN** an intermediate excludes `.example.net` and the leaf's SAN contains `www.example.net`
- **THEN** the name-constraints row is ✗ naming the subtree and the SAN entry

#### Scenario: Permitted subtree satisfied
- **WHEN** the intermediate permits `.example.com` and every leaf dNSName is under it
- **THEN** the row is ✓ and lists the matched subtree

### Requirement: Validation time
The tool SHALL default the validation time to now and SHALL let the user set another instant, re-running every validity row against it.

#### Scenario: Historical validation
- **WHEN** the user sets the validation time to a date within an expired leaf's validity
- **THEN** the leaf's validity row is ✓ and the summary states "validated at <date>, not now"

### Requirement: Offline operation
The tool SHALL never fetch AIA issuers, CRLs, or OCSP responses; AIA and CRL distribution point URLs SHALL be shown as plain text.

#### Scenario: Input never leaves the page
- **WHEN** a bundle with AIA URLs is validated while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`) and the URLs are rendered as text

### Requirement: Verdict language
A fully passing path SHALL be summarised as "path validates per RFC 5280 §6 to <anchor kind>" and SHALL NOT use "trusted" or "secure"; when the anchor is the bundle's own root the summary SHALL say that no trust decision was made.

#### Scenario: Clean result wording
- **WHEN** every row is ✓ and no anchor was pasted
- **THEN** the summary reads "Path validates per RFC 5280 §6 to the bundle's own self-signed root. This does not establish that the root is one you trust — paste an anchor to check that. Revocation was not checked."
