# Spec Delta — sbom-viewing-and-hash-check

## Purpose

Render a CycloneDX (1.4–1.6, JSON or XML) or SPDX (2.3 JSON; 3.0 JSON-LD structurally) software bill of materials as a component table with metadata, dependency counts and vulnerability entries, and cross-check the hashes it declares against files the user drops — entirely in the browser.

## ADDED Requirements

### Requirement: Format detection and version gate
The tool SHALL detect CycloneDX JSON (`bomFormat`, `specVersion`), CycloneDX XML (`<bom xmlns="http://cyclonedx.org/schema/bom/…">`), SPDX 2.x JSON (`spdxVersion`) and SPDX 3.0 JSON-LD (`@context` under `spdx.org/rdf/3.0`), and SHALL show a version gate: CycloneDX 1.4–1.6 ✓ (ECMA-424), 1.3 and below ⚠ superseded; SPDX 2.3 ✓, 2.2 ⚠, 3.0 ⚠ "structural read, not JSON-LD expanded"; anything else ✗.

#### Scenario: Site's own SBOM
- **WHEN** the repo's `sbom.json` is loaded
- **THEN** the gate reads CycloneDX 1.5 ✓ and the metadata block names `build-sbom.js` as the tool

#### Scenario: Old CycloneDX
- **WHEN** a `specVersion: "1.3"` document is loaded
- **THEN** the gate is ⚠ "superseded by 1.4–1.6" and the components still render

### Requirement: Component table and graph counts
The tool SHALL render one row per component / package with name, version, type, PURL (shown as text), licenses (CycloneDX `licenses[]`, SPDX `licenseConcluded` / `licenseDeclared`), supplier, and declared hashes; SHALL show dependency-graph counts from CycloneDX `dependencies[]` or SPDX `relationships[]` `DEPENDS_ON`; and SHALL render CycloneDX `vulnerabilities[]` (VEX) with id, source, affects and analysis state.

#### Scenario: Four vendored components
- **WHEN** the site's `sbom.json` is loaded
- **THEN** the table lists `openpgpjs`, `qrcode-generator`, `secrets.js-grempe` and `js-yaml` with their versions and SHA-256 / 384 / 512 hashes, and the `encryptalotta:vendored-path` properties are shown

#### Scenario: VEX entries
- **WHEN** a CycloneDX document carries a `vulnerabilities[]` array
- **THEN** each entry renders with its id, source name, affected refs and `analysis.state`, with no lookup performed

### Requirement: Hash cross-check against dropped files
When the user drops files, the tool SHALL match each to a component by file name, then by any declared hash value, compute SHA-256 / 384 / 512 with Web Crypto (and BLAKE2b-512 / SHA3-256 with the inline engines when declared), compare in constant time, and report ✓ match / ✗ mismatch / "no file dropped" per component; declared MD5 or SHA-1 SHALL read ⚠ "declared but not computed on this site"; a document with no hashes at all SHALL raise ⚠ "SBOM has no hashes".

#### Scenario: Worked all-✓ example
- **WHEN** `sbom.json` is loaded and `openpgp.min.js`, `qrcode.js`, `secrets.min.js`, `js-yaml.min.js` are dropped
- **THEN** all twelve hash rows (three algorithms × four files) are ✓

#### Scenario: Tampered vendored file
- **WHEN** a copy of `qrcode.js` with one changed byte is dropped
- **THEN** its three hash rows are ✗ showing declared and computed values

#### Scenario: No hashes
- **WHEN** an SPDX document whose packages carry no `checksums[]` is loaded
- **THEN** the ⚠ "SBOM has no hashes" row appears and the drop zone is disabled with that explanation

### Requirement: Offline operation and verdict language
The tool SHALL perform no registry, OSV, NVD or PURL resolution, and SHALL phrase an all-✓ cross-check as "hashes match the SBOM you supplied — this does not establish completeness or absence of vulnerabilities".

#### Scenario: Input never leaves the page
- **WHEN** an SBOM is loaded and files are checked while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every hash row is ✓
- **THEN** the summary carries that wording and does not use the words "safe", "secure" or "trusted"
