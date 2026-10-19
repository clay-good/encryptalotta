# Spec Delta — structured-address-readiness-gates

## Purpose

Add dated gates to the SEPA inspector's pain.001 / pain.008 checks for the EPC mandate that party postal addresses be structured from 15 November 2026 (EPC 2025 SCT / SDD rulebooks v1.1, EPC153-22 v2.1), so a file that banks will reject after the cutover is flagged before it is sent.

## ADDED Requirements

### Requirement: Address classification
The inspector SHALL inspect every `PstlAdr` under `Dbtr`, `Cdtr`, `UltmtDbtr`, `UltmtCdtr`, and `InitgPty` in pain.001 and pain.008 and classify it as structured (no `AdrLine`, at least one ISO 20022 structured child such as `StrtNm`, `PstCd`, `TwnNm`, `Ctry`), unstructured (`AdrLine` only), or hybrid (`AdrLine` together with structured children other than `TwnNm` and `Ctry`), per the EPC Customer-to-Bank Implementation Guidelines 2025 v1.1 postal-address usage rules.

#### Scenario: Classification is shown per party
- **WHEN** a pain.001 has a `Dbtr` with `StrtNm` / `PstCd` / `TwnNm` / `Ctry` and a `Cdtr` with two `AdrLine`
- **THEN** the address panel lists "Dbtr: structured" and "Cdtr: unstructured (AdrLine only)"

#### Scenario: Hybrid address
- **WHEN** a `PstlAdr` carries `AdrLine` plus `StrtNm`
- **THEN** it is classified hybrid and the panel names the offending structured element

### Requirement: Dated unstructured-address gate
The inspector SHALL display a gate row for each unstructured or hybrid `PstlAdr` that is ⚠ when the browser date is before 15 November 2026 ("accepted until 14 November 2026; rejected from 15 November 2026 settlement date") and ✗ on or after that date, citing EPC 2025 rulebooks v1.1 and EPC153-22 v2.1; the date SHALL be overridable for tests through the same clock-injection hook the Swiss QR-bill combined-address gate uses.

#### Scenario: Before the cutover
- **WHEN** a pain.001 `Cdtr/PstlAdr` carries only `AdrLine` and the injected clock reads 2026-10-19
- **THEN** the gate row is ⚠ with the cutover date and the EPC citation, and the file's overall verdict is not ✗ because of it

#### Scenario: From the cutover
- **WHEN** the same file is inspected with the injected clock at 2026-11-15
- **THEN** the gate row is ✗ and the summary counts it among failed gates

#### Scenario: Structured address passes
- **WHEN** every `PstlAdr` in the file is structured
- **THEN** a single ✓ row reads "all n party addresses are structured (EPC 2025 rulebooks v1.1)"

### Requirement: Mandatory structured elements
The inspector SHALL display a ✓ / ✗ row requiring `TwnNm` and `Ctry` in every `PstlAdr` that has at least one structured child, and SHALL keep the existing `Ctry` ISO 3166-1 alpha-2 and length-cap gates (`TwnNm` 35, `PstCd` 16, `AdrLine` 70) unchanged.

#### Scenario: Structured address without a town
- **WHEN** a `PstlAdr` carries `StrtNm`, `PstCd`, and `Ctry` but no `TwnNm`
- **THEN** the mandatory-elements gate is ✗ naming `TwnNm` and the EPC IG rule that town name and country are mandatory in a structured address

#### Scenario: Existing gates still fire
- **WHEN** a structured `PstlAdr` has `Ctry` `UK`
- **THEN** the pre-existing ISO 3166-1 gate is ✗ ("GB, not UK") exactly as before this change

### Requirement: Context note and scope
The address panel SHALL carry a footnote stating that Verification of Payee (mandatory for euro-area PSPs since 9 October 2025, non-euro from 9 January 2027) is an inter-PSP API with no element in the file, and SHALL NOT present any VoP gate.

#### Scenario: VoP is context only
- **WHEN** the address panel is rendered for any pain.001
- **THEN** the footnote mentions VoP as context and the gate list contains no row about payee-name verification

### Requirement: Offline operation and verdict language
The gates SHALL run without any network request, and an all-✓ address result SHALL be phrased as conformance to the EPC rules checked, never as the counterparties being verified.

#### Scenario: Input never leaves the page
- **WHEN** a pain.001 is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every address gate is ✓
- **THEN** the panel reads "Addresses conform to the EPC 2025 structured-address rules — this does not establish that the parties or their addresses are genuine"
