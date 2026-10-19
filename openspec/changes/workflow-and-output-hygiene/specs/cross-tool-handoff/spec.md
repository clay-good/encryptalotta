# Spec Delta — cross-tool-handoff

## Purpose

Let a typed result from one tool become the input of another tool through an in-memory "Send to" action, so artifacts move between tools without the clipboard, the URL, or storage.

## ADDED Requirements

### Requirement: Typed handoff registry
The system SHALL maintain a closed registry of artifact types, each listing the tools that accept it and the input each tool fills; the registry is the only source for `Send to` menus.

#### Scenario: Minimum type set
- **WHEN** the registry is inspected by the release audit
- **THEN** it contains at least: PEM certificate, PEM public key, PEM private key, CSR, JWK / JWKS, JWT, hex digest, hex bytes, Base64 bytes, IBAN, BIC, XML document (UBL / CII / pain / camt / TSL / SAML), JSON document, CBOR hex, OpenPGP public key, OpenPGP private key, OpenPGP message, age recipient, age identity, SSH public key, URL, email headers, and QR payload text, and every accepting tool id exists in TOOL_ORDER

#### Scenario: Registry drives the menu
- **WHEN** a result pane is tagged with artifact type `pem_certificate`
- **THEN** its `Send to` menu lists exactly the registry's accepting tools for that type (TLS Certificate Parser, ASN.1 / DER Decoder, PEM ↔ DER, and the chain / lint capability when present) and no others

#### Scenario: Unregistered type degrades gracefully
- **WHEN** a result pane declares an artifact type that has no accepting tool
- **THEN** no `Send to` control is rendered and no error is thrown

### Requirement: Send-to action
The system SHALL, on selection of a target tool, navigate to that tool and fill its registered input with the artifact value, then run the target tool's primary action only if the user confirms (one extra click), and SHALL clear the handoff buffer once consumed.

#### Scenario: JWT inspector JWK to PEM converter
- **WHEN** the JWT Inspector surfaces the JWKS key that matched `kid` and the user chooses `Send to → JWK ↔ PEM`
- **THEN** the JWK ↔ PEM view opens with the JWK in its input, the convert button is focused, and the handoff buffer is empty

#### Scenario: Certificate parser to ASN.1 viewer
- **WHEN** the TLS Certificate Parser shows a certificate and the user chooses `Send to → ASN.1 / DER Decoder`
- **THEN** the ASN.1 view receives the same PEM text and decodes the identical DER byte length

#### Scenario: Hash result to encoder
- **WHEN** a SHA-256 hex digest is sent to the Encode tool
- **THEN** the Encode input holds the hex with hex selected as the source format

### Requirement: No persistence or URL leakage
The handoff buffer SHALL live only in page memory, SHALL be cleared when consumed, when the user navigates to a tool other than the target, and on `beforeunload`, and SHALL never be written to the URL, `localStorage`, `sessionStorage`, IndexedDB, or the clipboard.

#### Scenario: Reload after handoff
- **WHEN** a handoff has been performed and the page is reloaded
- **THEN** the target tool's input is empty and the storage inspectors show only the locale and theme keys

#### Scenario: Secret handoff is masked on arrival
- **WHEN** the artifact type is a private key or identity
- **THEN** the target input renders masked by default per the sensitive-output-hygiene rules
