# Spec Delta — mt940-statement-decoding

## Purpose

Decode the SWIFT FIN MT940 Customer Statement Message (SWIFT Standards MT, Category 9) in the SEPA inspector: tags, `:61:` sub-fields, multi-message chaining, balance arithmetic, and structured `:86:` sub-tags, entirely in the browser.

## ADDED Requirements

### Requirement: Detection and tokenizing
The inspector SHALL recognise FIN text by a `{1:` block envelope or a first non-blank line starting `:20:`, SHALL strip optional `{1:…}{2:…}{3:…}{4:` and `-}` envelopes, and SHALL split the text into `:tag:` records where a record continues over following lines until the next line starting with `:` or the `-` end-of-text marker (SWIFT FIN General Field Definitions, text block format).

#### Scenario: Enveloped and bare files decode identically
- **WHEN** the same MT940 is pasted once wrapped in `{1:F01…}{2:O940…}{4:` … `-}` and once as bare `:20:` … `-` text
- **THEN** both produce the same tag list and the badge reads "MT940 — Customer Statement Message"

#### Scenario: Multi-line :86: is one record
- **WHEN** an `:86:` field spans four lines before the next `:61:`
- **THEN** it is rendered as one narrative field with four lines, not four unknown tags

### Requirement: Tag decoding
The inspector SHALL render `:20:` transaction reference, `:21:` related reference, `:25:` account (IBAN MOD-97 when it is an IBAN), `:28C:` statement / sequence number, each `:61:` statement line with its `:86:` narrative, and SHALL list any other tag verbatim (MT940 field specifications, SWIFT Standards MT Category 9).

#### Scenario: Account identification
- **WHEN** `:25:` is `DE89370400440532013000`
- **THEN** the account row shows the IBAN grouped in fours with its MOD-97 result

#### Scenario: Unknown tag is listed
- **WHEN** a record carries a tag outside the MT940 set (e.g. `:34F:`)
- **THEN** it is listed under "other tags" verbatim and no ✗ is raised for it

### Requirement: Balance field decoding
The inspector SHALL decode `:60F:` / `:60M:` opening, `:62F:` / `:62M:` closing, `:64:` closing available, and `:65:` forward available balances into D/C mark, `YYMMDD` date, ISO 4217 currency, and comma-decimal amount (MT940 fields 60a, 62a, 64, 65).

#### Scenario: Balance fields
- **WHEN** `:60F:` is `C230131EUR1234,56`
- **THEN** the row reads "Opening balance (final): credit, 2023-01-31, EUR 1,234.56" with the amount formatted by `Intl.NumberFormat` in the active locale

### Requirement: Statement-line sub-fields
The inspector SHALL parse `:61:` as value date `YYMMDD`, optional entry date `MMDD`, debit/credit mark `D`, `C`, `RD`, or `RC`, optional funds code (one letter), amount with comma decimal, transaction type `N` or `F` plus three characters, customer reference (up to 16 characters) optionally followed by `//` and the bank reference (up to 16), and an optional supplementary-details continuation line (MT940 field 61 subfield definitions).

#### Scenario: Full statement line
- **WHEN** `:61:` is `2301310131D1234,56NTRFNONREF//8327000090031789` followed by a continuation line
- **THEN** the row shows value date 2023-01-31, entry date 01-31, debit, EUR 1,234.56, type `NTRF` (transfer), customer reference `NONREF`, bank reference `8327000090031789`, and the supplementary line

#### Scenario: Reversal mark
- **WHEN** the mark is `RC`
- **THEN** the row is labelled "reversal of credit" and the amount is treated as a debit in the balance arithmetic

### Requirement: Balance arithmetic and chaining gates
The inspector SHALL compute, in integer cents, opening balance plus the signed sum of all `:61:` amounts and SHALL display a ✓ / ✗ row comparing it to the closing balance; for multi-message statements it SHALL order messages by `:28C:` sequence number and SHALL display a ✓ / ✗ row requiring each message's `:62M:` to equal the next message's `:60M:` in mark, date, currency, and amount.

#### Scenario: Balanced statement
- **WHEN** `:60F:` is `C230131EUR1000,00`, lines are `D100,00` and `C50,00`, and `:62F:` is `C230131EUR950,00`
- **THEN** the balance gate is ✓ showing "1,000.00 − 100.00 + 50.00 = 950.00"

#### Scenario: Off by one cent
- **WHEN** the same statement has `:62F:` `C230131EUR950,01`
- **THEN** the balance gate is ✗ naming the expected 950.00 and the reported 950.01

#### Scenario: Broken chain
- **WHEN** message `1/2` closes `:62M:C…EUR950,00` and message `2/2` opens `:60M:C…EUR940,00`
- **THEN** the chain gate is ✗ naming both messages and amounts

### Requirement: Narrative and field-format gates
The inspector SHALL display a ✓ / ✗ row that each `:86:` has at most 6 lines of at most 65 characters (MT940 field 86 format `6*65x`), and SHALL display ⚠ rows for `:61:` dates that are not valid calendar dates and for currency codes that differ between `:60:`, `:62:`, and `:64:`.

#### Scenario: Oversized narrative
- **WHEN** an `:86:` spans seven lines
- **THEN** the narrative gate is ✗ citing `6*65x`

#### Scenario: Invalid value date
- **WHEN** a `:61:` value date is `230230`
- **THEN** a ⚠ row names the line and states that 2023-02-30 is not a calendar date

### Requirement: Structured :86: sub-tags
The inspector SHALL render `:86:` as labelled sub-fields when it starts with a three-digit business-transaction code (GVC) followed by `?nn` sub-tags (`?00` posting text, `?10` primanota, `?20`–`?29` purpose, `?30` bank code, `?31` account, `?32`–`?33` name, `?34` text key extension, `?60`–`?63` purpose continuation; Deutsche Kreditwirtschaft structured MT940 layout), and verbatim otherwise.

#### Scenario: German structured narrative
- **WHEN** `:86:` is `166?00SEPA-UEBERWEISUNG?10931?20EREF+…?21SVWZ+Rechnung 4711?30COBADEFFXXX?31DE89…?32Max Muster`
- **THEN** the row shows GVC 166, posting text, purpose lines joined in order, counterparty BIC and IBAN (IBAN MOD-97 result shown), and name as labelled fields

### Requirement: Offline operation and verdict language
The inspector SHALL decode MT940 without any network request and SHALL phrase an all-✓ result as internal consistency, never as the statement being authentic.

#### Scenario: Input never leaves the page
- **WHEN** an MT940 file is loaded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every gate row is ✓
- **THEN** the summary reads "Statement is internally consistent (balances add up, fields conform to MT940) — this does not establish that it came from your bank"
