# Spec Delta — einvoice-human-readable-view

## Purpose

Render a decoded EN 16931 invoice (UBL 2.1 or UN/CEFACT CII) as a paper-style page a bookkeeper can read and print, from the inspector's existing decoded model, entirely in the browser.

## ADDED Requirements

### Requirement: Paper layout from the decoded model
The inspector SHALL offer a "Paper" results tab that renders the decoded invoice model shared by the UBL and CII walkers as a printed-invoice layout: seller block (BG-4) and buyer block (BG-7) with addresses and identifiers, document header (BT-1 number, BT-2 issue date, BT-9 due date, BT-3 type decoded from UNCL 1001), references (BT-10 buyer reference, BT-13 purchase order, BT-12 contract), and the invoice note (BT-22), with EN 16931-1:2017 business-term ids shown as hover labels.

#### Scenario: PEPPOL BIS sample renders
- **WHEN** the user loads a PEPPOL BIS Billing 3.0 example UBL invoice and opens the Paper tab
- **THEN** the page shows seller and buyer blocks, the invoice number, issue and due dates, the type "Commercial invoice (380)", and the buyer reference, in the same values the Inspector tab shows

#### Scenario: CII renders through the same layout
- **WHEN** a Factur-X EN 16931 CII document is decoded
- **THEN** the Paper tab shows the same block structure populated from `ram:SellerTradeParty` / `ram:BuyerTradeParty` / `ram:ExchangedDocument`, with no CII element names visible

### Requirement: Line table and unit decoding
The paper view SHALL render one row per invoice line (BG-25) with line id, item name, quantity, unit (UN/ECE Recommendation 20 code decoded to its name in the active locale, raw code in parentheses), net price, line allowances / charges, VAT category and rate, and line net amount (BT-131).

#### Scenario: Common unit codes decode
- **WHEN** lines carry unit codes `C62`, `HUR`, and `KGM`
- **THEN** the unit column reads "piece (C62)", "hour (HUR)", "kilogram (KGM)" in English and the localised names in other locales

#### Scenario: Unknown unit code
- **WHEN** a line carries unit code `XYZ`
- **THEN** the column shows `XYZ` unchanged and a footnote says "unit code not in the inline UN/ECE Rec 20 table"

### Requirement: Totals, VAT breakdown, and currency formatting
The paper view SHALL render document-level allowances and charges (BG-20 / BG-21), the VAT breakdown table (BG-23: category, rate, taxable amount, tax amount, exemption reason), and the totals block (BT-106 to BT-115), with every amount formatted by `Intl.NumberFormat` in the invoice currency BT-5 and, when BT-6 is present, a second column in the VAT accounting currency.

#### Scenario: Amounts in the invoice currency
- **WHEN** the invoice currency is `EUR` and the UI locale is `de`
- **THEN** the payable amount reads `1.234,56 €` and the English locale shows `€1,234.56`; the figures are the walker's values, never recomputed by the renderer

#### Scenario: VAT breakdown rows
- **WHEN** the invoice has breakdown entries for `S` 19% and `S` 7%
- **THEN** the VAT table shows two rows with taxable and tax amounts and a total row equal to BT-110

### Requirement: Payment means and attachments
The paper view SHALL render payment means (BG-16) grouped by IBAN with BIC, payment means code decoded from UNCL 4461, due date, payment terms (BT-20), and remittance information (BT-83), and SHALL list additional supporting documents (BG-24) with filename, description, and MIME type.

#### Scenario: Grouped payment means
- **WHEN** two `PaymentMeans` blocks carry the same IBAN
- **THEN** the paper view shows one payment block with the IBAN grouped in fours and the MOD-97 result, not two

#### Scenario: Attachments listed
- **WHEN** the invoice embeds a PDF via `AdditionalDocumentReference/Attachment/EmbeddedDocumentBinaryObject`
- **THEN** the attachments section lists its filename and MIME type

### Requirement: Print stylesheet
The paper view SHALL include an `@media print` stylesheet that hides `#nav`, the tool header, the gate list, and all buttons, sets page margins through `@page` so the result fits A4 and Letter, and prints black on white; printing SHALL use the browser's print dialog only.

#### Scenario: Print emulation hides chrome
- **WHEN** the page is rendered with print media emulation while the Paper tab is active
- **THEN** `#nav`, the tool header, `#ubl-gates`, and every `button` are not displayed and the paper content starts at the top of the page

### Requirement: Offline operation and verdict language
The paper view SHALL be produced without any network request and SHALL carry a footer stating that the rendering reflects the XML content as decoded and does not establish that the seller or the amounts are genuine.

#### Scenario: Input never leaves the page
- **WHEN** an invoice is rendered to the Paper tab while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Footer wording
- **WHEN** the Paper tab is rendered for an invoice whose gates are all ✓
- **THEN** the footer reads "Rendered from the invoice XML (EN 16931) — conformance checks passed; this does not establish who issued the invoice or that the amounts are owed"
