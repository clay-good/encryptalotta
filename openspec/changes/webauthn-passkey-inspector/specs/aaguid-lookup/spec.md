# Spec Delta — aaguid-lookup

## Purpose

Map a WebAuthn AAGUID (Authenticator Attestation GUID, WebAuthn Level 3 §6.5.1) to a well-known authenticator name from an inline hand-maintained table, explain the all-zero AAGUID, and state the table's provenance, entirely in the browser.

## ADDED Requirements

### Requirement: AAGUID normalisation
The tool SHALL accept an AAGUID as a hyphenated UUID, 32 hex characters, or 16 raw bytes from a decoded registration, SHALL normalise case and hyphenation, and SHALL reject any other length with a message naming the 128-bit size (Level 3 §6.5.1).

#### Scenario: Bare hex input
- **WHEN** the user pastes `FBFC3007154E4ECC8C0B6E020557D7BD`
- **THEN** the lookup runs against `fbfc3007-154e-4ecc-8c0b-6e020557d7bd` and that canonical form is displayed

#### Scenario: Wrong length
- **WHEN** the input has 30 hex characters
- **THEN** no lookup runs and the message states that an AAGUID is 16 bytes

### Requirement: Well-known table
The tool SHALL ship an inline table of roughly twenty well-known AAGUIDs covering at least iCloud Keychain, Google Password Manager, Windows Hello (hardware, software, and VBS variants), 1Password, Bitwarden, Dashlane, and the YubiKey 5 series, each with the authenticator kind (platform / roaming / software) and a source comment; values SHALL be confirmed against the vendor's published metadata at implementation.

#### Scenario: Known platform authenticator
- **WHEN** the AAGUID matches a table row
- **THEN** the result shows the name, the kind, and the note "self-reported by the authenticator; only a verified attestation ties the credential to this vendor"

#### Scenario: Unknown AAGUID
- **WHEN** the AAGUID is not in the table
- **THEN** the result reads "not in the built-in table" and names the FIDO Metadata Service as where a relying party would look it up — without offering to fetch it

### Requirement: All-zero AAGUID
The tool SHALL recognise `00000000-0000-0000-0000-000000000000` and explain that Level 3 §6.5.1 requires it when the attestation format is `none` or the authenticator does not identify its model, so it carries no information.

#### Scenario: Zero AAGUID with none attestation
- **WHEN** a decoded registration has `fmt: none` and an all-zero AAGUID
- **THEN** the lookup result reads "all-zero AAGUID — no model information, as required for `none` attestation" and the ✓ row for AAGUID / format consistency is shown

#### Scenario: Zero AAGUID with packed attestation
- **WHEN** `fmt` is `packed` with `x5c` and the AAGUID is all zero
- **THEN** a ⚠ row notes that a vendor attestation with a zero AAGUID is unusual and the certificate's `id-fido-gen-ce-aaguid` extension, when present, is shown for comparison

### Requirement: Provenance and licence
The tool SHALL state in its info panel that the table is hand-maintained from vendor documentation, that the community list `passkeydeveloper/passkey-authenticator-aaguids` is not vendored until its licence is confirmed as MIT or CC0, and that no lookup leaves the page.

#### Scenario: Input never leaves the page
- **WHEN** an AAGUID is looked up while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** a lookup succeeds
- **THEN** the result does not describe the authenticator as "verified", "genuine", or "trusted"
