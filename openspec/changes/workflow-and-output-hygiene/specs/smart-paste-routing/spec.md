# Spec Delta — smart-paste-routing

## Purpose

Classify content pasted or dropped on the home page or into the command palette and offer the matching tools, pre-filled, so a user never has to know a tool's name to reach it.

## ADDED Requirements

### Requirement: Content classification
The system SHALL classify pasted text against a fixed table of content types and SHALL list every matching tool ordered by confidence, without decoding, parsing with a cryptographic library, or navigating until the user chooses.

#### Scenario: Type table coverage
- **WHEN** the detector vector file is run
- **THEN** each of these types is recognized from its positive sample: PEM blocks (`-----BEGIN <label>-----`), ASCII-armored OpenPGP, JWT / SD-JWT (dot-separated Base64url segments, `~` disclosures), IBAN (MOD-97 passes), BIC, EU VAT, UUID, ULID, epoch seconds / milliseconds, ISO 8601 date-time, hex, Base64 / Base64url, Base32, CIDR / IPv4 / IPv6, URL, `otpauth://` and `otpauth-migration://`, `age1…` recipients and `AGE-SECRET-KEY-1…`, OpenSSH public keys, EPC QR payloads (`BCD` first line), Swiss QR payloads (`SPC`), SAML (Base64 of XML), and XML / JSON documents by root element or top-level keys (UBL, CII, pain.*, camt.*, TSL, SBOM, DID document, VC)

#### Scenario: PEM certificate pasted on the home page
- **WHEN** the user pastes a `-----BEGIN CERTIFICATE-----` block into the home search box
- **THEN** the suggestion list shows TLS Certificate Parser first, then ASN.1 / DER Decoder and PEM ↔ DER, and nothing has been parsed yet

#### Scenario: Ambiguous 64-hex string
- **WHEN** the user pastes 64 hexadecimal characters
- **THEN** the list offers Hash & Checksum (compare), Ed25519 (public key), Encode (hex → …), and CBOR decode, each labelled with why it matched, in confidence order, and no tool opens automatically

#### Scenario: Private material is not echoed
- **WHEN** the pasted content matches a secret type (`AGE-SECRET-KEY-1…`, `-----BEGIN … PRIVATE KEY-----`, an armored PGP private key, an `otpauth-migration://` payload)
- **THEN** the suggestion list shows the type name and the tools but renders the content masked, and the home search box is cleared when a suggestion is chosen or dismissed

### Requirement: Pre-fill on selection
The system SHALL, when the user selects a suggested tool, navigate to it and place the pasted content into that tool's primary input through the cross-tool handoff mechanism, without using the URL or any storage.

#### Scenario: IBAN suggestion pre-fills the validator
- **WHEN** the user pastes `DE89 3704 0044 0532 0130 00` and chooses the IBAN tool
- **THEN** the IBAN view opens with the value in `#iban-input`, the URL hash is exactly `#iban` with no query or fragment payload, and `localStorage` holds no new key

#### Scenario: Dismissal leaves no trace
- **WHEN** the user presses `Esc` on the suggestion list
- **THEN** the list closes, the search box keeps focus, and the handoff buffer is empty

### Requirement: Drop-to-detect for files
The system SHALL accept a dropped file on the home page, identify it with the existing magic-byte identifier, and offer the tools that accept that file type (PDF → PAdES / Factur-X / PDF metadata; PNG / JPEG / WebP → EXIF Eraser, QR Decoder, Steganography; DOCX / XLSX / PPTX → Document Metadata Cleaner; `.p12` / `.pfx`, `.sig`, `.minisig`, `.torrent` as proposed elsewhere) without reading more than the leading bytes until a tool is chosen.

#### Scenario: Dropped PNG
- **WHEN** a PNG is dropped on the home page
- **THEN** EXIF Eraser, QR Decoder, and Steganography are offered, the file is held in memory only, and no network request is made

### Requirement: Offline and private
Classification SHALL run entirely in the page and SHALL NOT transmit, store, or log the pasted content.

#### Scenario: Input never leaves the page
- **WHEN** any content is pasted into the home search box while the network log is observed
- **THEN** no request is issued (CSP `connect-src 'none'`) and no `localStorage` / `sessionStorage` / IndexedDB write occurs
