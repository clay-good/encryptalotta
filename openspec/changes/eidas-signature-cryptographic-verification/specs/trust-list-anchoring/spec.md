# Spec Delta — trust-list-anchoring

## Purpose

Match the issuing CA of a verified signer or TSA against the service entries of an ETSI TS 119 612 trust list (LOTL or national TSL) that the user pastes, and report the service's type and status at signing time — the only basis on which the inspector ever mentions qualified status.

## ADDED Requirements

### Requirement: Trust-list input
The inspector SHALL accept a pasted ETSI TS 119 612 trust list in a dedicated textarea, SHALL parse it with the same function as the eIDAS Trust List Viewer (`lotl` tool), and SHALL report the list's scheme territory, sequence number, issue date, and next update before any matching.

#### Scenario: National TSL parsed
- **WHEN** a TS 119 612 TSL XML is pasted
- **THEN** the header rows show `SchemeTerritory`, `TSLSequenceNumber`, `ListIssueDateTime`, and `NextUpdate`, formatted via `Intl.DateTimeFormat`

#### Scenario: Expired list is flagged, not rejected
- **WHEN** `NextUpdate` is earlier than the current date
- **THEN** a warning row reads "list is past its NextUpdate — statuses may have changed" and matching still runs

### Requirement: Service matching order
The inspector SHALL compare the signer's (or TSA's) issuing CA certificate against each service's `ServiceDigitalIdentity` in the order certificate digest (SHA-256 of the DER), `X509SKI`, then `X509SubjectName` (TS 119 612 §5.5.3), and SHALL label the match quality as "exact", "by key identifier", or "by name only (weak)".

#### Scenario: Exact digest match
- **WHEN** the TSL embeds the test CA's certificate
- **THEN** the row reads "matches <TSP name> / <service name> — exact (certificate digest)"

#### Scenario: Name-only match
- **WHEN** only the subject name matches
- **THEN** the row reads "by name only (weak) — the list does not carry this CA's key or certificate" and the summary does not use the word "chains"

#### Scenario: No match
- **WHEN** no service matches
- **THEN** the row reads "not found in the supplied list" and nothing is said about qualification

### Requirement: Service type and status at signing time
For a matched service the inspector SHALL show the `ServiceTypeIdentifier` as a short name (CA/QC, CA/PKC, TSA/QTST, TSA, …) with the raw URI, and SHALL determine the `ServiceStatus` in force at the signing time (verified timestamp genTime, else claimed signing time) by walking `ServiceHistory` and `StatusStartingTime` (TS 119 612 §5.5.4 – §5.5.5), reporting granted, withdrawn, or the raw status URI.

#### Scenario: Granted at signing time
- **WHEN** the service status is granted from a date before the signing time
- **THEN** the row reads "CA/QC — granted since <date> (status at signing time)"

#### Scenario: Withdrawn before signing time
- **WHEN** the history shows granted then withdrawn, and the signing time is after the withdrawal
- **THEN** the row reads "withdrawn since <date> — status was not granted at the signing time" and the summary omits the qualified wording

#### Scenario: Claimed time only
- **WHEN** no verified timestamp exists and only a claimed signing-time is available
- **THEN** the status row adds "(evaluated at the claimed signing time, which is not proven)"

### Requirement: Qualification wording is relative to the list
The inspector SHALL only ever describe qualification as relative to the pasted list ("CA/QC service in the list you supplied") and SHALL NOT assert that the signature is a qualified electronic signature or legally valid.

#### Scenario: Clean anchored result
- **WHEN** signature math verifies and the CA matches a granted CA/QC service exactly
- **THEN** the summary reads "Signature math verifies and chains to <TSP> / <service> (CA/QC, granted at signing time) in the list you supplied. This does not establish legal validity — revocation and policy were not checked."

### Requirement: Offline operation
The inspector SHALL never fetch the LOTL, a national TSL, or any pointed-to list; `PointersToOtherTSL` entries SHALL be shown as URLs for the user to retrieve themselves.

#### Scenario: Input never leaves the page
- **WHEN** a list is pasted and matching runs while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: LOTL pasted instead of a TSL
- **WHEN** the pasted list is the EU LOTL (pointers only, no services)
- **THEN** the inspector lists the pointer URLs and says "paste the national TSL for <territory> to match services; nothing is downloaded"
