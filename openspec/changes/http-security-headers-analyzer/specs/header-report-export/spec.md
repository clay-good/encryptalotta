# Spec Delta — header-report-export

## Purpose

Export the analyzer's ✓ / ⚠ / ✗ gate list as JSON or Markdown through the report exporter shared with the invoice inspector (`einvoice-readable-view-and-reports`), so findings can be attached to a ticket without the pasted headers leaving the browser.

## ADDED Requirements

### Requirement: Shared exporter
The tool SHALL pass its gate rows (`{ok, label, detail, clause}` plus `header` and `policyIndex`) to the shared `reportExport()` function introduced by the `einvoice-readable-view-and-reports` change and SHALL offer JSON and Markdown downloads produced by that function, not by a second serializer.

#### Scenario: JSON export shape
- **WHEN** the user exports JSON after analyzing a block
- **THEN** the file contains the exporter's envelope (tool id `headers`, timestamp, row array) with each row carrying `ok`, `label`, `detail`, `clause`, `header`, and `policyIndex` where applicable

#### Scenario: Markdown export
- **WHEN** the user exports Markdown
- **THEN** the file contains one table per header group with ✓ / ⚠ / ✗ in the first column and the clause in the last

### Requirement: No secrets in the export
The export SHALL contain cookie names and attribute gates but never cookie values, and SHALL not include the raw pasted block.

#### Scenario: Cookie value excluded
- **WHEN** the analyzed block contains `Set-Cookie: sid=secretvalue; Secure`
- **THEN** neither export file contains the string `secretvalue`

### Requirement: Offline operation
Export SHALL be a `Blob` download produced in the page.

#### Scenario: Input never leaves the page
- **WHEN** an export is produced while the network log is observed
- **THEN** no request of any kind is issued (`connect-src 'none'`); the only navigation is the `blob:` download URL, revoked after use
