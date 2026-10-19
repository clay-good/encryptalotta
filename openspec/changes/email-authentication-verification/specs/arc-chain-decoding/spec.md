# Spec Delta — arc-chain-decoding

## Purpose

Decode the Authenticated Received Chain (RFC 8617) of a pasted message — ARC-Seal, ARC-Message-Signature, ARC-Authentication-Results per instance — verify seals and signatures from pasted keys, and explain what the chain does and does not prove, entirely in the browser.

## ADDED Requirements

### Requirement: Instance grouping
The tool SHALL group `ARC-Seal`, `ARC-Message-Signature`, and `ARC-Authentication-Results` headers by their `i=` instance number (RFC 8617 §4.1), SHALL require instances to run 1 … n without gaps or duplicates (§4.2), and SHALL render one block per instance showing the sealing domain `d=`, selector `s=`, timestamp `t=`, and the `ARC-Authentication-Results` content.

#### Scenario: Two-hop chain rendered
- **WHEN** a message carries ARC sets `i=1` (sealed by `forwarder.example`) and `i=2` (sealed by `list.example`)
- **THEN** two blocks appear in order with the sealer, time, and the authentication results each sealer recorded

#### Scenario: Gap in instances
- **WHEN** the message has `i=1` and `i=3` but no `i=2`
- **THEN** the chain is marked ✗ "instance gap — chain invalid (RFC 8617 §4.2)"

### Requirement: Chain validation state
The tool SHALL read `cv=` on the highest-instance ARC-Seal (`none` for `i=1`, `pass`, or `fail`; §4.1.3), SHALL display it, and SHALL mark the chain failed when any seal carries `cv=fail`, when `i=1` does not carry `cv=none`, or when an intermediate seal carries `cv=none`.

#### Scenario: cv states
- **WHEN** `i=1` has `cv=none` and `i=2` has `cv=pass`
- **THEN** the chain state reads "cv=pass at instance 2 — the last sealer validated the earlier chain"

#### Scenario: Failed chain
- **WHEN** the highest seal has `cv=fail`
- **THEN** the chain state is ✗ and the explanation says receivers must not rely on the earlier Authentication-Results

### Requirement: Seal and signature verification from pasted keys
Given pasted `v=DKIM1` keys for the sealers (`<s>._domainkey.<d>`), the tool SHALL verify each ARC-Message-Signature with the DKIM engine (relaxed/relaxed, never covering ARC-Seal; §4.1.2) and each ARC-Seal over the ordered ARC header set of all instances up to and including its own with its `b=` emptied (§5.1.1), reporting pass / fail / key-unparseable / no-key per header.

#### Scenario: Seals verify
- **WHEN** keys for both sealers are pasted and the chain is intact
- **THEN** every AMS and AS row is "pass" and the chain summary is ✓

#### Scenario: Tampered seal
- **WHEN** one byte of the `i=1` ARC-Authentication-Results differs from what was sealed
- **THEN** the `i=1` ARC-Seal row is "fail" and the `i=2` seal (which covers `i=1`'s headers) is also "fail"

#### Scenario: No key pasted
- **WHEN** no key for a sealer is present
- **THEN** its rows read "no key pasted — run `dig TXT <s>._domainkey.<d>`" and the chain is "not verified", not "fail"

### Requirement: Explanation of ARC's meaning
The panel SHALL state that ARC lets a receiver see the authentication results an intermediary observed before it modified the message, that a valid chain proves only that each listed sealer vouches for the prior results, and that whether to trust a sealer is the receiver's policy decision; ARC SHALL NOT be presented as a substitute for DKIM or DMARC passing on the message as received.

#### Scenario: Explanation present
- **WHEN** any ARC set is found
- **THEN** the panel shows the three-sentence explanation and links the sealers to the DKIM panel's `d=` alignment rows

### Requirement: Offline operation and verdict language
ARC decoding and verification SHALL make no network request, and a verified chain SHALL be phrased as the sealers' claims verifying, never as the message being authentic or safe.

#### Scenario: Input never leaves the page
- **WHEN** a message with ARC headers is analysed while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Verified chain wording
- **WHEN** every seal verifies and `cv=pass`
- **THEN** the summary reads "ARC chain verifies — forwarder.example and list.example vouch for the authentication results they saw. Whether to trust those sealers is your call; this shows who handled it, not that the content is safe."
