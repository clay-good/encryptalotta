# Spec Delta — dkim-signature-verification

## Purpose

Verify DKIM-Signature headers of a pasted raw message against a pasted DNS TXT key record — canonicalization, body hash, header hash, RSA-SHA256 or Ed25519-SHA256 — entirely in the browser (RFC 6376, RFC 8463).

## ADDED Requirements

### Requirement: Inputs and key association
The Email Header Analyzer SHALL accept the full raw message (headers and body, pasted or as an `.eml` file) and one or more DNS TXT records, SHALL parse each `v=DKIM1` record (`k`, `p`, `h`, `t`, `s`, `n`; RFC 6376 §3.6.1), and SHALL associate a key with a signature by the owner name `<s>._domainkey.<d>` when the pasted line carries it, or by uniqueness, otherwise asking the user to prefix the record with its selector.

#### Scenario: Key matched from dig output
- **WHEN** the message has `DKIM-Signature: … d=example.com; s=sel1 …` and the records box contains `sel1._domainkey.example.com. 3600 IN TXT "v=DKIM1; k=rsa; p=MIIB…"`
- **THEN** the signature row shows "key: sel1._domainkey.example.com (RSA 2048)" and verification proceeds

#### Scenario: Unparseable key
- **WHEN** the `p=` value is not valid base64 or not a parseable SPKI
- **THEN** the row state is "key unparseable" with the reason, and no body-hash or signature state is claimed

### Requirement: Canonicalization
The tool SHALL canonicalize the body and headers per the signature's `c=` tag (RFC 6376 §3.4: `simple` / `relaxed` for header and body, default `simple/simple`), SHALL normalise bare LF to CRLF before canonicalizing, SHALL honour `l=` by truncating the canonical body and flagging it ⚠ (§8.2), and SHALL select signed headers per §5.4.2 (last unused instance from the bottom for each name in `h=`, absent names contribute nothing and are labelled oversigned).

#### Scenario: Relaxed header folding
- **WHEN** a signed `Subject:` header is folded over two lines with a tab and `c=relaxed/relaxed`
- **THEN** the canonical form is `subject:` followed by the unfolded single-spaced value and the computed header hash matches the signature

#### Scenario: Oversigned header
- **WHEN** `h=` lists `reply-to` twice and the message has one `Reply-To`
- **THEN** the header list shows the second instance as "absent (oversigned — prevents later addition)" and verification still succeeds

### Requirement: Body hash
The tool SHALL recompute `bh=` with SHA-256 over the canonical body (Web Crypto) and compare it before any signature arithmetic (RFC 6376 §3.7), reporting body-hash-mismatch without claiming a signature result when it differs.

#### Scenario: Body changed
- **WHEN** one byte of the body differs from the signed message
- **THEN** the row is "body hash mismatch — the body changed in transit or the canonicalization differs", the signature step is not reported as failed, and the hint names `simple` vs `relaxed`

### Requirement: Signature verification
The tool SHALL verify `b=` over the canonical signed headers plus the DKIM-Signature header with `b=` emptied, using Web Crypto `RSASSA-PKCS1-v1_5` / SHA-256 for `a=rsa-sha256` and `Ed25519` for `a=ed25519-sha256` (RFC 8463), reporting one of pass / signature-fail / key-unparseable / unavailable per signature. `a=rsa-sha1` SHALL be reported as historic and not computed (RFC 8301 §3.1).

#### Scenario: RFC 6376 Appendix A example passes
- **WHEN** the user pastes the RFC 6376 Appendix A.2 message and the Appendix A.1 public key
- **THEN** the signature row is "pass — body hash matches, RSA-SHA256 verifies"

#### Scenario: RFC 8463 Appendix A example passes
- **WHEN** the user pastes the RFC 8463 Appendix A message and its `k=ed25519` key
- **THEN** the Ed25519 signature row is "pass" in a browser whose Web Crypto supports Ed25519, and "verification unavailable in this browser" otherwise — never "fail"

#### Scenario: Header changed
- **WHEN** the `Subject` value differs from the signed message
- **THEN** the row is "body hash matches; signature does not verify — a signed header changed" and lists the signed header names

### Requirement: Key and timestamp gates
The tool SHALL display independent rows for: RSA modulus length (< 1024 bits ✗ per RFC 8301 §3.2, 1024 ⚠, ≥ 2048 ✓; read with the hand-rolled ASN.1 reader), `t=` signing time and `x=` expiry as dates with relative time (expired ✗ per RFC 6376 §6.1.1; `t=` in the future ⚠), key `t=y` testing flag (⚠ "receivers treat this as unsigned"), key `t=s` strict `i=` subdomain rule, and `h=` in the key restricting hash algorithms.

#### Scenario: Short key
- **WHEN** the key's modulus is 1024 bits
- **THEN** the key-length row is ⚠ citing RFC 8301

#### Scenario: Expired signature
- **WHEN** `x=` is earlier than the current time
- **THEN** the expiry row is ✗ with the date and "expired n days ago"

### Requirement: Offline operation and verdict language
Verification SHALL use only the pasted message and records — no DNS, no fetch — and a pass SHALL be phrased as the signing domain having signed these bytes, with the mailhdr sentence that this "shows who sent it, not that the content is safe".

#### Scenario: Input never leaves the page
- **WHEN** a message and key are verified while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Pass wording
- **WHEN** a signature passes and `d=` aligns with the From domain
- **THEN** the summary reads "DKIM verifies for example.com (RSA-SHA256, 2048-bit, relaxed/relaxed) — the signing domain signed these headers and body. That shows who sent it, not that the content is safe."
