# Spec Delta — web-key-directory-and-autocrypt

## Purpose

Compute OpenPGP Web Key Directory URLs for an email address (draft-koch-openpgp-webkey-service) without fetching them, and decode or generate Autocrypt Level 1 headers that carry a public key, inside Key Info, entirely in the browser.

## ADDED Requirements

### Requirement: WKD address hash
The tool SHALL compute, for an email address, `hash = z-base-32(SHA-1(lowercase(local-part)))` with SHA-1 from Web Crypto and the z-base-32 alphabet `ybndrfg8ejkmcpqxot1uwisza345h769` (RFC 6189 §5.1.6), per draft-koch-openpgp-webkey-service §3.1.

#### Scenario: Draft example hash
- **WHEN** `Joe.Doe@Example.ORG` is entered
- **THEN** the hash reads `iy9q119eutrkn8s1mk4r39qejnbu3n5q` (32 z-base-32 characters)

#### Scenario: Not an address
- **WHEN** the input has no `@` or has an empty local part
- **THEN** no hash is computed and the message asks for a `local-part@domain` address

### Requirement: WKD URL forms
The tool SHALL show the advanced URL `https://openpgpkey.<domain>/.well-known/openpgpkey/<domain>/hu/<hash>?l=<local-part>` and the direct URL `https://<domain>/.well-known/openpgpkey/hu/<hash>?l=<local-part>` (draft §3.1), plus both `policy` file URLs, with the domain lowercased and `l=` carrying the local part as typed, percent-encoded.

#### Scenario: Draft example URLs
- **WHEN** `Joe.Doe@Example.ORG` is entered
- **THEN** the advanced URL is `https://openpgpkey.example.org/.well-known/openpgpkey/example.org/hu/iy9q119eutrkn8s1mk4r39qejnbu3n5q?l=Joe.Doe` and the direct URL is `https://example.org/.well-known/openpgpkey/hu/iy9q119eutrkn8s1mk4r39qejnbu3n5q?l=Joe.Doe`

#### Scenario: Local part with a plus sign
- **WHEN** `alice+lists@example.org` is entered
- **THEN** the hash is computed over `alice+lists` and the `l=` parameter reads `alice%2Blists`

### Requirement: WKD URLs are text only
The tool SHALL render the URLs as copyable text, not hyperlinks, SHALL state that WKD lookup happens in the user's mail client, and SHALL offer a paste field for a fetched binary key that hands it to Key Info.

#### Scenario: Pasted WKD response
- **WHEN** the user pastes the binary key a WKD server returned (Base64 or file)
- **THEN** Key Info renders it and a gate checks that one user ID matches the address entered

### Requirement: Autocrypt header decoding
The tool SHALL parse an `Autocrypt:` header (Autocrypt Level 1 §2.1): `addr=`, optional `prefer-encrypt=` (`mutual` | `nopreference`), `keydata=` (Base64 of a binary transferable public key with folding whitespace removed), ignoring unknown attributes that start with `_` and rejecting unknown critical attributes; SHALL hand the key bytes to Key Info; and SHALL gate `addr` against the key's user IDs.

#### Scenario: Header decodes
- **WHEN** an `Autocrypt: addr=alice@example.com; prefer-encrypt=mutual; keydata=mQEN…` header is pasted
- **THEN** Key Info renders the key, the attribute rows read addr `alice@example.com` and prefer-encrypt `mutual`, and the user-ID gate is ✓

#### Scenario: Address mismatch
- **WHEN** `addr` does not appear in any user ID
- **THEN** the gate is ✗ "key has no user ID for addr — a client must not use this header"

### Requirement: Autocrypt header generation
The tool SHALL build an `Autocrypt:` header from a public key and a chosen address: a minimal key consisting of the primary key, the user ID matching the address, its self-signature, one current encryption subkey and its binding signature (Autocrypt Level 1 §2.1.1 "minimal key"), Base64-encoded and folded at 76 columns with a leading space on continuation lines.

#### Scenario: Round trip
- **WHEN** a header is generated from the page's Curve25519 key and pasted back into the decoder
- **THEN** Key Info shows the same fingerprint, exactly one user ID, and exactly one subkey, and the decoded `addr` matches

#### Scenario: No matching user ID
- **WHEN** the chosen address matches no user ID on the key
- **THEN** generation is refused and the Maintain tab's "add user ID" is offered

### Requirement: Offline operation and verdict language
The tool SHALL compute and decode without any network request and SHALL describe results only as "URL computed per the WKD draft" or "key decoded from the header", never as the key being verified or trusted.

#### Scenario: Input never leaves the page
- **WHEN** WKD URLs are computed and an Autocrypt header is decoded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Result wording
- **WHEN** an Autocrypt header decodes with a matching address
- **THEN** the status reads "key decoded from the header; addr matches a user ID — this does not establish that the sender controls the key" and contains neither "verified" nor "trusted"
