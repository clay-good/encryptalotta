# Spec Delta — ssh-certificate-decoding

## Purpose

Decode an OpenSSH certificate (PROTOCOL.certkeys, `*-cert-v01@openssh.com`) into every field with human-readable dates, options, and extensions, and verify the CA signature over the exact signed bytes with Web Crypto, entirely in the browser.

## ADDED Requirements

### Requirement: Field decoding
The tool SHALL detect a certificate by its type string and decode, per PROTOCOL.certkeys: nonce, public-key fields, serial (uint64), type (1 = user, 2 = host), key id, valid principals (packed `string` list), valid-after and valid-before, critical options, extensions, reserved, signature key, and signature, and SHALL render the certificate's own `SHA256:` fingerprint and the CA key's fingerprint.

#### Scenario: ssh-keygen user certificate
- **WHEN** a `ssh-ed25519-cert-v01@openssh.com` line produced by `ssh-keygen -s ca -I alice -n alice,deploy -V +52w` is pasted
- **THEN** the rows show type "user (1)", key id `alice`, principals `alice` and `deploy`, serial, both fingerprints, and the CA key type

#### Scenario: Host certificate
- **WHEN** a certificate made with `-h` is pasted
- **THEN** the type row reads "host (2)" and the principals are listed as hostnames

#### Scenario: Not a certificate
- **WHEN** a plain `ssh-ed25519 AAAA…` key is pasted
- **THEN** the existing public-key output is shown and no certificate rows appear

### Requirement: Validity window
The tool SHALL render valid-after and valid-before through `Intl.DateTimeFormat` with a relative time, SHALL render `0xFFFFFFFFFFFFFFFF` as "forever" and `0` as "beginning of time", and SHALL state whether the certificate is currently valid, not yet valid, or expired against the browser clock, labelled as the browser clock.

#### Scenario: Valid for a year
- **WHEN** the certificate's window is from today to +52 weeks
- **THEN** both dates are shown in the active locale with "in 12 months" style relative text and the status row reads "currently valid (browser clock)"

#### Scenario: Forever sentinel
- **WHEN** valid-before is `0xFFFFFFFFFFFFFFFF`
- **THEN** the row reads "forever" and a ⚠ note says non-expiring certificates are discouraged

### Requirement: Critical options and extensions
The tool SHALL decode critical options (`force-command`, `source-address`, `verify-required`) and extensions (`permit-X11-forwarding`, `permit-agent-forwarding`, `permit-port-forwarding`, `permit-pty`, `permit-user-rc`, `no-touch-required`) by name with their values, SHALL show unknown names raw, and SHALL flag an unknown critical option as one OpenSSH would refuse.

#### Scenario: Forced command and source address
- **WHEN** the certificate carries `force-command=/usr/bin/rrsync /srv` and `source-address=10.0.0.0/8,192.168.1.1`
- **THEN** both are listed under Critical options with their values, and the extensions list shows each `permit-*` present

#### Scenario: Unknown critical option
- **WHEN** a critical option named `example@test` is present
- **THEN** the row reads "unknown critical option `example@test` — OpenSSH refuses certificates with unknown critical options (PROTOCOL.certkeys)"

### Requirement: CA signature verification
The tool SHALL verify the signature over the bytes preceding the `signature` field, sliced from the decoded blob, using Web Crypto: `ssh-ed25519` raw, `ecdsa-sha2-nistp256/384/521` with `r` / `s` mpints converted to fixed width, `rsa-sha2-256` / `rsa-sha2-512` as RSASSA-PKCS1-v1_5, and legacy `ssh-rsa` (SHA-1) with a legacy label.

#### Scenario: Ed25519 CA verifies
- **WHEN** the fixture certificate signed by an Ed25519 CA is pasted
- **THEN** the signature row is ✓ "CA signature verifies (ssh-ed25519) — compare the CA fingerprint to your TrustedUserCAKeys / @cert-authority entry"

#### Scenario: ECDSA CA
- **WHEN** the CA is `ecdsa-sha2-nistp256`
- **THEN** the row is ✓ and notes "mpint r ‖ s converted to raw 64 bytes"

#### Scenario: Legacy SHA-1 RSA CA
- **WHEN** the signature blob algorithm is `ssh-rsa`
- **THEN** the row shows the verification result with the label "legacy ssh-rsa (SHA-1) — refused by OpenSSH ≥ 8.8 by default"

#### Scenario: Tampered principal
- **WHEN** one byte of a principal is changed in the Base64 blob
- **THEN** the signature row is ✗ "CA signature does not verify" and the fields are still displayed

### Requirement: Offline operation
Decoding and verification SHALL run in the page; no CA key, host, or revocation list is fetched.

#### Scenario: Input never leaves the page
- **WHEN** a certificate is decoded and verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language
A verified certificate SHALL be reported as "CA signature verifies" with the CA fingerprint and SHALL NOT be described as trusted or as granting access.

#### Scenario: Clean result wording
- **WHEN** the signature row is ✓ and the certificate is within its window
- **THEN** the summary reads "CA signature verifies (PROTOCOL.certkeys) and the certificate is within its validity window. This does not establish that the CA <fingerprint> is one your servers trust."
