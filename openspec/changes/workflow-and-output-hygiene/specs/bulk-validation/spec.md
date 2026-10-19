# Spec Delta — bulk-validation

## Purpose

Validate many identifiers in one pass — one value per line or a CSV column — with a per-row verdict table and CSV / JSON export, for the IBAN, BIC, EU VAT, GS1, and (when shipped) LEI / ISIN / CUSIP / SEDOL / ISBN validators.

## ADDED Requirements

### Requirement: Bulk input
Each identifier validator SHALL offer a bulk mode that accepts newline-separated values, SHALL detect a CSV / TSV delimiter with the existing RFC 4180 parser and let the user choose a column when more than one is present, SHALL trim whitespace and ignore blank lines, and SHALL cap processing at 10,000 rows with a clear message beyond that.

#### Scenario: Mixed IBAN list
- **WHEN** the user pastes three lines — `DE89370400440532013000`, `GB82WEST12345698765432`, `DE89370400440532013001` — in IBAN bulk mode
- **THEN** the table shows three rows with verdicts valid, valid, invalid (MOD-97) and a summary "2 valid · 1 invalid"

#### Scenario: CSV column selection
- **WHEN** the pasted text has a header row `id,iban,amount` and twenty data rows
- **THEN** the user is asked which column to validate, `iban` is pre-selected by header name, and the other columns are carried through unchanged into the export

### Requirement: Verdict table
The system SHALL render one row per input with the same result fields the single-value mode produces (verdict, reason, decomposed parts such as bank / branch / country), using the shared key/value renderer, and SHALL show at most 2,000 rows inline with a note to export the rest.

#### Scenario: Reuse of the single-value result
- **WHEN** a row is valid
- **THEN** its decomposed fields (for IBAN: country, check digits, bank code, account) equal those the single-value mode shows for the same input

### Requirement: Export
The system SHALL export the verdict table as CSV (RFC 4180, UTF-8, header row) and as JSON (array of objects) via a local download, including any carried-through source columns, and SHALL perform no network request.

#### Scenario: CSV export round trip
- **WHEN** the user exports a 3-row IBAN result as CSV and pastes that CSV back into bulk mode
- **THEN** the `iban` column is detected and re-validation produces identical verdicts

#### Scenario: Input never leaves the page
- **WHEN** a 10,000-row list is validated and exported
- **THEN** the network log shows no request and the export is a `blob:` URL download
