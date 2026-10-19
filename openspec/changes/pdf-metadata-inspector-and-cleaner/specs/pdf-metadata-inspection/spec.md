# Spec Delta — pdf-metadata-inspection

## Purpose

Parse a PDF byte-wise in the browser and report every carrier of origin metadata — Info dictionary, XMP, ID, PieceInfo, annotations, incremental revisions, encryption — with a leaky / review / clean verdict in the Document Metadata Cleaner's language (ISO 32000-2:2020).

## ADDED Requirements

### Requirement: File structure
The tool SHALL read the `%PDF-x.y` header version, follow `startxref` through every cross-reference section (classic tables, ISO 32000-2 §7.5.4; xref streams with `/W` and `/Index`, §7.5.8; `/Prev` and `/XRefStm` chains), expand object streams (§7.5.7) with `DecompressionStream`, and SHALL rebuild the object map by scanning for `obj` tokens when an xref offset does not land on an object, reporting the rebuild as a ⚠ row.

#### Scenario: Xref-stream file parses
- **WHEN** the user loads a PDF 1.5+ file whose xref is a compressed stream and whose catalog lives in an object stream
- **THEN** the header card shows the version, "xref stream", the object count, and no rebuild warning

#### Scenario: Broken startxref
- **WHEN** `startxref` points 3 bytes past the real xref
- **THEN** the object map is rebuilt by scanning and a ⚠ row reads "cross-reference table rebuilt — offsets in this file are wrong"

### Requirement: Incremental revisions
The tool SHALL count revisions as the number of `%%EOF` markers cross-checked with the `/Prev` chain (§7.5.6), SHALL show the count, and when it is greater than one SHALL warn that earlier revisions remain in the file and are recoverable with any PDF tool.

#### Scenario: Three saves
- **WHEN** a file has three `%%EOF` markers and a two-link `/Prev` chain
- **THEN** the revision row reads "3 revisions — the two earlier versions of this document are still inside the file" and the verdict is at least leaky

### Requirement: Info dictionary and dates
The tool SHALL list every key of the trailer `/Info` dictionary (§14.3.3: Title, Author, Subject, Keywords, Creator, Producer, CreationDate, ModDate, Trapped, and custom keys) with string values decoded from PDFDocEncoding or UTF-16BE BOM, and SHALL decode `D:YYYYMMDDHHmmSSOHH'mm'` dates (§7.9.4) to ISO 8601 with offset, showing malformed dates raw with a ⚠.

#### Scenario: Author and producer listed
- **WHEN** `/Info` carries `/Author (Jane Doe)` `/Producer (LibreOffice 24.8)` `/CreationDate (D:20260301120000+01'00')`
- **THEN** the Info table shows Author "Jane Doe", Producer "LibreOffice 24.8", CreationDate `2026-03-01T12:00:00+01:00`

#### Scenario: UTF-16 string
- **WHEN** `/Title` is `<FEFF00480069>`
- **THEN** the Title row reads "Hi"

### Requirement: XMP packet
The tool SHALL locate the catalog `/Metadata` stream (§14.3.2), inflate it if filtered, parse it with `DOMParser`, and list the `dc:`, `xmp:`, `pdf:`, and `pdfaid:` properties that identify origin (`dc:creator`, `dc:title`, `dc:description`, `xmp:CreatorTool`, `xmp:CreateDate`, `xmp:ModifyDate`, `xmp:MetadataDate`, `pdf:Producer`, `pdf:Keywords`, `pdfaid:part` / `conformance`; ISO 16684-1, ISO 19005), degrading to "XMP not parseable" with the raw packet when malformed.

#### Scenario: Creator tool listed
- **WHEN** the XMP carries `xmp:CreatorTool` "Adobe InDesign 20.0" and `pdf:Producer` "Adobe PDF Library"
- **THEN** both appear in the XMP table and the verdict is leaky

#### Scenario: Malformed XMP
- **WHEN** the `/Metadata` stream is not well-formed XML
- **THEN** the XMP row reads "XMP not parseable" with the raw packet viewable and the Info-based verdict still applies

### Requirement: XMP media-management history
The tool SHALL list `xmpMM:DocumentID`, `xmpMM:InstanceID`, `xmpMM:OriginalDocumentID`, and each `xmpMM:History` `stEvt` entry (action, software agent, when, changed) from the XMP Media Management schema (ISO 16684-1 §8.6).

#### Scenario: History events
- **WHEN** the XMP carries two `xmpMM:History` `stEvt` entries from InDesign
- **THEN** the XMP table lists both with action, agent, and ISO timestamp, and the verdict is leaky

#### Scenario: Info / XMP disagreement
- **WHEN** `/Info /Author` and `dc:creator` differ
- **THEN** a ⚠ row names both values ("Info and XMP disagree — both are read by viewers")

### Requirement: Identifiers, PieceInfo, language, annotations, embedded files
The tool SHALL show the trailer `/ID` pair as hex (§14.4), list `/PieceInfo` keys with their `/LastModified` (§14.7.2), show `/Lang` (§14.9.2), list every annotation with `/Subtype`, author `/T`, `/M`, `/CreationDate` (§12.5.2), and list embedded files by name and size (§7.11.4).

#### Scenario: Annotation author
- **WHEN** a page has a `/Text` annotation with `/T (J. Doe)`
- **THEN** the annotation table shows the subtype, author "J. Doe", and dates, and the verdict is leaky

#### Scenario: PieceInfo present
- **WHEN** the catalog has `/PieceInfo << /Illustrator << /LastModified (D:…) /Private … >> >>`
- **THEN** the PieceInfo row lists "Illustrator" with its date and explains that this is application-private data

### Requirement: Encryption and active-content flags
The tool SHALL detect `/Encrypt` in the trailer and report the filter, `/V`, `/R`, and whether a user password is required, SHALL flag the presence of `/OpenAction`, `/AA`, and `/Names /JavaScript` (details in the active-content report), and SHALL state that encrypted files cannot be cleaned by this tool.

#### Scenario: Encrypted file
- **WHEN** the trailer has `/Encrypt` with `/Filter /Standard /V 5 /R 6`
- **THEN** the encryption row reads "AES-256 (Standard security handler, R6)" and the clean button is disabled with the reason

### Requirement: Verdict
The tool SHALL classify the file as leaky (any `/Info` key other than `/Title`, XMP creator / tool / producer / history, `/PieceInfo`, any non-empty annotation `/T`, or more than one revision), review (only `/Title`, `/Lang`, dates, `/ID`, or embedded files), or clean, using the Document Metadata Cleaner's three verdict strings.

#### Scenario: Leaky verdict text
- **WHEN** `/Info /Author` is present
- **THEN** the banner reads "This file reveals information about its authors and history." and lists Author as the reason

#### Scenario: Clean verdict is not phrased as safe
- **WHEN** no metadata carrier is populated and there is one revision
- **THEN** the banner reads "No author or history metadata found in the Info dictionary, XMP, PieceInfo, or annotations — page content, images, and fonts can still identify a source; this does not establish that the file is anonymous or safe to open"

### Requirement: Offline operation
All parsing SHALL happen in the page from the file's bytes; no network request SHALL be made.

#### Scenario: Input never leaves the page
- **WHEN** a PDF is inspected while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)
