# Spec Delta — conformance-report-export

## Purpose

Export the ✓ / ✗ gate list of any inspector run — UBL, CII, SEPA ISO 20022, and the payment-QR tool — as JSON, CSV, or Markdown through a Blob download, so a conformance result can be attached to a ticket or returned to a supplier without leaving the browser.

## ADDED Requirements

### Requirement: Stable gate identifiers
Every gate row produced by the UBL, CII, SEPA, and payment-QR gate functions SHALL carry a stable string id (the STRINGS key stem, e.g. `ubl.brCo10`, `sepa.ibanMod97`) and, where the rule has a published identifier, that identifier (e.g. `BR-CO-10`, `BR-DE-15`), in addition to the existing `{ok, label, detail, clause}` fields.

#### Scenario: Ids are present on every row
- **WHEN** any inspector run completes
- **THEN** every row in its gate array has a non-empty `id` and the on-screen list is unchanged from before this change

### Requirement: JSON export
The tool SHALL export a run as a JSON document with a header object (`tool`, `standard`, `documentId`, `date` in ISO 8601, `siteVersion`) and a `gates` array of `{id, rule, clause, ok, label, detail}` objects, in on-screen order.

#### Scenario: JSON round-trips the screen
- **WHEN** the user clicks `#btn-ubl-export-json` after inspecting an invoice
- **THEN** the downloaded file parses as JSON, `gates.length` equals the number of rows in `#ubl-gates`, and each `ok` matches the row's ✓ / ✗ state

#### Scenario: SEPA and payment-QR runs export the same shape
- **WHEN** the user exports from the SEPA inspector or the payment-QR tool
- **THEN** the JSON has the same header keys and row keys, with `tool` set to `sepa` or `payqr`

### Requirement: CSV and Markdown export
The tool SHALL export the same rows as CSV (RFC 4180: comma separator, CRLF line ends, double-quote escaping, a header row, a UTF-8 BOM) with columns `id,rule,clause,ok,label,detail`, and as Markdown with a heading naming the tool, standard, document id and date, followed by a table `| ✓/✗ | rule | label | detail | clause |`.

#### Scenario: CSV quoting
- **WHEN** a gate detail contains a comma and a double quote
- **THEN** the CSV field is wrapped in double quotes with the inner quote doubled, and the file has exactly one data row per gate

#### Scenario: Markdown table
- **WHEN** the user clicks `#btn-sepa-export-md`
- **THEN** the file starts with `# SEPA ISO 20022 conformance report — <documentId> — <date>` and contains one table row per gate

### Requirement: Filename and download mechanics
The download SHALL be produced with `Blob` and `URL.createObjectURL`, named `<tool>-<documentId>-<YYYY-MM-DD>.<json|csv|md>` with the document id sanitised to `[A-Za-z0-9._-]` and truncated to 60 characters (`undated` / `nodoc` fallbacks), and the object URL SHALL be revoked after the click.

#### Scenario: Filename from the document id
- **WHEN** an invoice with BT-1 `INV/2026-0042` is exported as CSV on 2026-10-19
- **THEN** the suggested filename is `ubl-INV_2026-0042-2026-10-19.csv`

#### Scenario: Input never leaves the page
- **WHEN** an export is triggered while the browser's network log is observed
- **THEN** no request of any kind is issued; the file is assembled in memory (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language in exports
The exported header SHALL carry a `summary` string identical to the on-screen summary line, and that line SHALL describe conformance to the named standard, never the document as safe, trusted, or genuine.

#### Scenario: Summary text travels with the report
- **WHEN** every gate is ✓ and the user exports
- **THEN** `summary` reads the tool's clean-result sentence (e.g. "Conforms to EN 16931 / PEPPOL BIS 3.0 — this does not establish who issued the document") and contains neither "safe" nor "trusted"
