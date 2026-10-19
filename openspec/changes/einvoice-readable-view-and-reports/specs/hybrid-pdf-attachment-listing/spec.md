# Spec Delta — hybrid-pdf-attachment-listing

## Purpose

List every embedded file and the XMP conformance claims of a Factur-X / ZUGFeRD / Order-X hybrid PDF in the UBL / CII inspector, cross-check the PDF's claims against the XML profile, and offer each attachment for download, entirely in the browser.

## ADDED Requirements

### Requirement: Embedded-file listing
When a PDF is loaded, the inspector SHALL walk the catalog `/Names /EmbeddedFiles` name tree (`/Names` arrays, `/Kids` recursion) and the catalog `/AF` array, falling back to scanning for `/Type /Filespec` objects, and SHALL list each embedded file with name (`/UF` preferred over `/F`), size (`/EF /F` stream `/Params /Size`, else decoded length), MIME type (`/Subtype`), `/AFRelationship`, and stream filter (ISO 32000-2 §7.11.4, §14.13; ISO 19005-3 Annex E).

#### Scenario: Factur-X PDF with two attachments
- **WHEN** a Factur-X PDF embeds `factur-x.xml` (`/AFRelationship /Data`) and `delivery-note.pdf` (`/AFRelationship /Supplement`)
- **THEN** `#ubl-attachments` lists both with name, size, MIME type, and relationship, and the invoice XML is still decoded as before this change

#### Scenario: PDF without a name tree
- **WHEN** the PDF has `/Filespec` objects but no `/EmbeddedFiles` name tree
- **THEN** the fallback scan lists them and a note says the name tree is missing (ISO 19005-3 requires it)

### Requirement: XMP conformance claims
The inspector SHALL parse the catalog `/Metadata` XMP packet with `DOMParser` and SHALL render `pdfaid:part` / `pdfaid:conformance` (PDF/A identification schema), and the Factur-X extension schema properties `fx:DocumentType`, `fx:DocumentFileName`, `fx:Version`, `fx:ConformanceLevel` (Factur-X / ZUGFeRD 2.x specification, XMP extension schema), degrading to "XMP packet not parseable" with the raw text offered when the packet is not well-formed XML.

#### Scenario: Claims rendered
- **WHEN** the XMP carries `pdfaid:part` 3, `pdfaid:conformance` B, `fx:DocumentType` INVOICE, `fx:ConformanceLevel` EN 16931
- **THEN** the PDF panel reads "PDF/A-3B; Factur-X INVOICE, conformance level EN 16931, file factur-x.xml"

#### Scenario: Malformed XMP
- **WHEN** the XMP stream is not well-formed XML
- **THEN** the panel shows the degradation message, the raw packet is viewable, and no cross-check gate is marked ✗

### Requirement: Conformance-level cross-check
The inspector SHALL display a ✓ / ✗ row requiring `fx:ConformanceLevel` to equal the profile detected from the CII `GuidelineSpecifiedDocumentContextParameter/ID` URN (MINIMUM, BASIC WL, BASIC, EN 16931, EXTENDED, XRECHNUNG), per the Factur-X 1.0.x specification, "XMP metadata".

#### Scenario: Level mismatch
- **WHEN** the XMP says `EN 16931` and the XML URN is `urn:factur-x.eu:1p0:basic`
- **THEN** the conformance-level gate is ✗ naming both values

### Requirement: PDF container gates
The inspector SHALL display independent ✓ / ✗ rows for: `pdfaid:part` is 3 (or 4 for the PDF/A-4f variant); `fx:DocumentType` is INVOICE (ORDER for Order-X); `fx:DocumentFileName` names an embedded file that exists; the invoice XML's `/AFRelationship` is `Data`, `Source`, or `Alternative` (Factur-X 1.0.x specification, "Embedding the XML"; ISO 19005-3).

#### Scenario: Filename claim without a matching file
- **WHEN** `fx:DocumentFileName` is `factur-x.xml` but the only embedded file is `zugferd-invoice.xml`
- **THEN** the filename gate is ✗ listing the embedded names

#### Scenario: Wrong PDF/A part
- **WHEN** `pdfaid:part` is 1
- **THEN** the PDF/A gate is ✗ stating that Factur-X requires PDF/A-3 (ISO 19005-3)

### Requirement: Attachment download
The inspector SHALL offer a download button per attachment that inflates a `/FlateDecode` stream with `DecompressionStream` and otherwise hands over the raw bytes with a "filter not supported" note, using a Blob URL and the attachment's own filename; for an encrypted PDF (`/Encrypt` in the trailer) the names are listed where readable and download is refused with the reason.

#### Scenario: Download the embedded XML
- **WHEN** the user clicks `#btn-ubl-attachment-download-1` for `factur-x.xml`
- **THEN** the downloaded bytes equal the inflated stream that the inspector decoded

#### Scenario: Encrypted PDF
- **WHEN** the trailer carries `/Encrypt`
- **THEN** the attachment panel explains that streams are encrypted and offers no download

### Requirement: Offline operation and verdict language
Listing, XMP parsing, cross-checks, and downloads SHALL run without any network request, and an all-✓ PDF result SHALL be phrased as consistency between the PDF's claims and its XML, never as the PDF being safe or authentic.

#### Scenario: Input never leaves the page
- **WHEN** a hybrid PDF is loaded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

#### Scenario: Clean result wording
- **WHEN** every cross-check gate is ✓
- **THEN** the PDF panel summary reads "PDF/A and Factur-X claims are consistent with the embedded XML — this does not establish that the PDF is authentic or free of harmful content; for a signed PDF use the TLS certificate tool's PAdES view"
