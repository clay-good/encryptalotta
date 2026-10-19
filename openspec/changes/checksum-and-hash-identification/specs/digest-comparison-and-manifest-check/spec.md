# Spec Delta — digest-comparison-and-manifest-check

## Purpose

Verify downloaded files against a checksum manifest (`sha256sum`, `b2sum`, `shasum -a 512`, BSD-style, `.sha256` / `.md5` sidecars) entirely in the browser — the offline equivalent of `sha256sum -c` — reporting OK, FAILED and missing per line with constant-time comparison.

## ADDED Requirements

### Requirement: Manifest line shapes
The tool SHALL parse GNU coreutils lines (`<hex>  <name>`, two spaces, optional `*` binary marker, `\`-prefixed lines with `\n` / `\\` escapes per the coreutils manual), BSD lines (`SHA256 (<name>) = <hex>`, `BLAKE2b (<name>) = <hex>`), single-space `<hex> <name>` lines, and a bare-digest sidecar whose file name supplies the target name.

#### Scenario: GNU manifest with three lines
- **WHEN** a pasted `SHA256SUMS` contains three `<hex>  <name>` lines
- **THEN** three rows appear with status "awaiting file"

#### Scenario: Unparseable line
- **WHEN** a line matches none of the shapes
- **THEN** it is listed as "could not parse" with its line number and the rest of the manifest still verifies

### Requirement: Algorithm inference
The tool SHALL infer the algorithm from the BSD tag when present, otherwise from the digest length (40 hex SHA-1, 64 SHA-256, 96 SHA-384, 128 SHA-512, 32 MD5), and SHALL offer a selector override for the 64-hex (SHA-256 / SHA3-256 / BLAKE2s-256) and 128-hex (SHA-512 / SHA3-512 / BLAKE2b-512) ambiguities.

#### Scenario: BSD b2sum line
- **WHEN** a line reads `BLAKE2b (archive.tar) = <128 hex>`
- **THEN** the row's algorithm is BLAKE2b-512 (RFC 7693) with no selector needed

#### Scenario: Ambiguous 64-hex
- **WHEN** a GNU-style line carries a 64-hex digest
- **THEN** SHA-256 is preselected and the selector offers SHA3-256 and BLAKE2s-256

### Requirement: Verification
When the user drops files, the tool SHALL match them to manifest rows by base name, hash each with Web Crypto `digest` (SHA-1 / 256 / 384 / 512) or the page's BLAKE2b / Keccak engines, compare in constant time, and report OK, FAILED, missing (row without a file) and extra (file without a row), with totals; MD5 rows SHALL read "cannot verify: MD5 is not computed on this site".

#### Scenario: One tampered file
- **WHEN** three files are dropped for a three-line SHA-256 manifest and one file differs by one byte
- **THEN** two rows read OK, one reads FAILED with both digests shown, and the totals read "2 OK, 1 FAILED, 0 missing" as `sha256sum -c` would

#### Scenario: Missing and extra
- **WHEN** only two of three files are dropped plus an unrelated file
- **THEN** one row reads missing and the unrelated file is listed as extra

#### Scenario: MD5 manifest
- **WHEN** the manifest is an `.md5` sidecar
- **THEN** the row reads "cannot verify: MD5 is not computed on this site" and suggests asking the publisher for SHA-256

### Requirement: Digest comparison
The existing two-field comparison SHALL accept digests in hex, Base64 or Base64url and SHALL normalise case and encoding before the constant-time comparison, reporting the byte length compared.

#### Scenario: Hex versus Base64 of the same digest
- **WHEN** field A holds a 64-hex SHA-256 and field B its Base64 form
- **THEN** the comparison reads "match (32 bytes)"

### Requirement: Verdict language
An all-OK manifest SHALL be phrased as "every file matches the manifest you supplied — this does not establish that the manifest itself is authentic; verify its signature" with a link to PGP Verify, and SHALL NOT describe files as safe or trusted.

#### Scenario: Clean result wording
- **WHEN** every row reads OK
- **THEN** the summary carries that wording and the PGP Verify link

### Requirement: Offline operation
Hashing and comparison SHALL run in the page.

#### Scenario: Input never leaves the page
- **WHEN** files are verified while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`)
