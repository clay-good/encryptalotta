# Spec Delta — pdf-metadata-removal

## Purpose

Write a cleaned copy of a PDF in the browser: metadata carriers removed or regenerated, all incremental revisions collapsed into one, page content byte-identical, downloaded via a Blob URL (ISO 32000-2:2020 §7.5).

## ADDED Requirements

### Requirement: Single-revision rewrite
The cleaner SHALL write a new file consisting of the original header version, every live object (the generation reachable from the final cross-reference section) serialised in object-number order with object streams expanded, a classic cross-reference table (§7.5.4), one trailer, `startxref`, and exactly one `%%EOF`, so that no earlier revision survives.

#### Scenario: Revisions collapsed
- **WHEN** a three-revision file is cleaned
- **THEN** the output contains exactly one `%%EOF`, no `/Prev`, and its object count equals the number of live objects in the input

#### Scenario: Viewer-neutral structure
- **WHEN** the input used an xref stream and object streams
- **THEN** the output uses a classic xref table with every object top-level, and `pypdf` opens it without repair

### Requirement: Content preserved byte-identical
The cleaner SHALL copy every page content stream, font, image, and other non-metadata stream with its raw bytes unchanged and its stream dictionary unchanged except for `/Length`, which SHALL equal the actual byte count.

#### Scenario: Content streams unchanged
- **WHEN** the cleaned file is re-opened independently with `pypdf`
- **THEN** each page's content stream bytes and each image XObject's bytes equal the input's

### Requirement: Info dictionary reduced to Title
The cleaner SHALL replace the trailer `/Info` with a dictionary containing only `/Title` when the input had one (§14.3.3), SHALL report the kept title, and SHALL omit `/Info` entirely when there was no title.

#### Scenario: Title kept, rest removed
- **WHEN** the input `/Info` has Title, Author, Producer, CreationDate, ModDate
- **THEN** the output `/Info` has only `/Title`, and the summary reads "kept Title: <value>; removed Author, Producer, CreationDate, ModDate"

### Requirement: XMP, ID, PieceInfo, linearization
The cleaner SHALL remove the catalog `/Metadata` stream, or in *minimal* mode replace it with a packet carrying only `dc:title` and, when the input claimed PDF/A, `pdfaid:part` / `pdfaid:conformance` with a note that the claim is no longer verified; SHALL regenerate the trailer `/ID` as two 16-byte values from `crypto.getRandomValues` (§14.4); SHALL remove `/PieceInfo` (§14.7.2); and SHALL drop the `/Linearized` dictionary and hint streams (Annex F).

#### Scenario: Default remove mode
- **WHEN** the input has no PDF/A claim and the user leaves `#pdfmeta-xmp-mode` at its default
- **THEN** the output catalog has no `/Metadata` and `/PieceInfo`, and the `/ID` pair differs from the input's

#### Scenario: PDF/A input defaults to minimal
- **WHEN** the input XMP carries `pdfaid:part 3`
- **THEN** the mode defaults to minimal, the output XMP has only `dc:title` and `pdfaid:*`, and the summary notes "PDF/A claim kept but no longer verified by this tool"

### Requirement: Annotation authors
The cleaner SHALL set every annotation `/T` (and the `/T` of its `/Popup`) to an empty string, SHALL remove annotation `/M` and `/CreationDate`, and SHALL keep `/Contents` and `/NM` (§12.5.2).

#### Scenario: Comments stay, authors go
- **WHEN** a page has a `/Text` annotation with `/T (J. Doe)` and `/Contents (Please fix)`
- **THEN** the output annotation has `/T ()`, no `/M`, and `/Contents (Please fix)`

### Requirement: Refusals and warnings
The cleaner SHALL refuse an encrypted input (`/Encrypt` in the trailer) with the message that rewriting would require the document key, SHALL refuse when any live object failed to parse (no partial output), and SHALL show "cleaning will invalidate n signature(s)" when the PAdES path finds signature dictionaries.

#### Scenario: Encrypted refusal
- **WHEN** the user clicks `#btn-pdfmeta-clean` on an encrypted file
- **THEN** no file is produced and the message names `/Encrypt` and suggests removing the password in the originating application first

#### Scenario: Signed input
- **WHEN** the input has one `/Type /Sig` dictionary with `/Contents`
- **THEN** the clean button shows the signature warning before producing output

### Requirement: Download and offline operation
The output SHALL be offered as `<original>-clean.pdf` through `Blob` and `URL.createObjectURL`, optionally with its SHA-256 (Web Crypto) in the summary, and nothing SHALL be sent over the network.

#### Scenario: Input never leaves the page
- **WHEN** a file is cleaned and downloaded while the browser's network log is observed
- **THEN** no request of any kind is issued (the document CSP is `connect-src 'none'`)

### Requirement: Verdict language after cleaning
The post-clean summary SHALL state which carriers were removed and SHALL NOT describe the output as anonymous, safe, or untraceable.

#### Scenario: Post-clean wording
- **WHEN** cleaning succeeds
- **THEN** the summary reads "Removed: Info (except Title), XMP, PieceInfo, 2 annotation authors, 2 earlier revisions; new ID generated — page text, images, and fonts are unchanged and can still identify a source"
