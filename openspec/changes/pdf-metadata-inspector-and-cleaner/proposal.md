# Proposal — PDF Metadata Inspector & Cleaner

## Why

The site strips what a photo says about you (EXIF Eraser) and what an Office file says about you (Document Metadata Cleaner). It does nothing for the format people actually send: the PDF. A PDF exported from Word, LibreOffice, InDesign, or a scanner carries the author's name and the producing software in the `/Info` dictionary, the same again plus a document history in the XMP packet, an `/ID` pair that links every copy of the file, `/PieceInfo` blobs with Illustrator or InDesign private data, annotation authors on every comment, and — the part nobody expects — **earlier revisions of the whole document**, still byte-for-byte present after each incremental save, so a redaction done in a viewer is often still readable in the file. Online "PDF metadata removers" see the whole document. The site already reads PDFs byte-wise (PAdES `/Contents` extraction, Factur-X attachment extraction) and already inflates Flate streams with `DecompressionStream`; the gap is a tool that turns those primitives on the metadata and writes a clean copy.

## What Changes

- **New tool `pdfmeta` — "PDF Metadata Inspector & Cleaner"** in the Privacy group, next to EXIF Eraser and Document Metadata Cleaner. Tool count **57 → 58**.
- **Inspect**: header version, every trailer and cross-reference section (tables and xref streams, object streams inflated with `DecompressionStream`), `/Info` keys with decoded dates, the XMP packet parsed with `DOMParser`, the `/ID` pair, `/PieceInfo`, embedded files, `/OpenAction`, `/AA`, `/JavaScript`, annotation authors (`/T`), `/Lang`, the number of incremental updates with the warning that earlier revisions remain recoverable, and the encryption flag; three-state verdict **leaky / review / clean** in the Document Metadata Cleaner's words.
- **Clean**: a rewritten copy — `/Info` reduced to `/Title` (kept and reported), XMP replaced by a minimal packet or removed, `/ID` regenerated from `crypto.getRandomValues`, `/PieceInfo` removed, annotation `/T` blanked, all incremental updates collapsed into one revision with a fresh classic xref table, linearization hint dropped; content streams, fonts, and images copied byte-identical; encrypted PDFs refused with a clear message; download via Blob; the file never leaves the page.
- **Active-content report**: OpenAction, JavaScript, Launch, URI, SubmitForm, GoToR actions, embedded files, and external streams listed and explained — reported, not removed, in this slice; a "remove active content" toggle is labelled slice 2.
- Related-tool links: EXIF Eraser ↔ Document Metadata Cleaner ↔ pdfmeta ↔ TLS Certificate Parser (PAdES) ↔ UBL inspector (Factur-X).

Out of scope (and the §7 non-goal it respects): no vendored PDF library and no WASM (§7.6 / §7.7); no PDF rendering, text extraction, or redaction of page content (a metadata tool, not an editor); no decryption of password-protected PDFs (refused, with the reason); no "GDPR-compliant" or "safe to share" labels (§7.2, THREAT-MODEL verdict language); no sanitising of the active content it reports — that is slice 2 and says so; no network of any kind (§0.1).

## Capabilities

### New Capabilities
- `pdf-metadata-inspection`: byte-level parse of a PDF's structure and every metadata carrier with a leaky / review / clean verdict (ISO 32000-2).
- `pdf-metadata-removal`: write a cleaned single-revision copy with metadata carriers removed or regenerated and page content byte-identical.
- `pdf-active-content-report`: list and explain actions, scripts, and external references present in the file without removing them.

### Modified Capabilities
- none (the PAdES and Factur-X PDF scanners keep their behaviour; they share the new object-level reader, which is an implementation change, not a requirement change).

## Impact

- `index.html`: one new view, ~900 lines of inline JS — a tokenizer for PDF objects (ISO 32000-2 §7.2 / §7.3), xref table and xref stream readers (§7.5.4 / §7.5.8), object-stream expansion (§7.5.7) over `DecompressionStream`, a date decoder (§7.9.4), an XMP reader, the annotation / action walkers, the serializer that writes objects back with a new xref table and trailer, and the three-state verdict; ~55 STRINGS keys × 5 locales + 5 en SEO keys.
- Reuses: the PAdES `/Contents` and Factur-X attachment byte scanners (refactored onto the new object reader), `DecompressionStream` inflate, `DOMParser`, `crypto.getRandomValues` (for the new `/ID`), SHA-256 via Web Crypto (optional: hashing the cleaned file for the summary line), the Document Metadata Cleaner's verdict strings and Blob download, the gate framework for the per-carrier rows.
- No new vendored file, no CSP change, page weight +~22 KB gzipped.
- Governing documents: ISO 32000-2:2020 (PDF 2.0) — §7.5 file structure, §7.5.6 incremental updates, §7.5.7 object streams, §7.5.8 xref streams, §7.9.4 dates, §12.6 actions, §12.5 annotations, §14.3 metadata (Info dictionary and XMP), §14.7.2 `/PieceInfo`, §7.11 embedded files; ISO 16684-1 (XMP); ISO 19005 (PDF/A) for the conformance claim read-out.
- Tests: new `tests/specs/NN-pdfmeta.spec.js` (number assigned at implementation; 29+). Fixtures built with Python `pypdf` in `tests/fixtures/pdf/` the way `tests/fixtures/office/` was built for docmeta: a leaky PDF (Info + XMP + two incremental saves + annotation author), a clean one, an encrypted one, one with an xref stream and object streams, one with OpenAction + JavaScript. Confirm/flag pairs; the cleaned output is independently re-opened with `pypdf` to assert that page content streams are byte-identical, `/Info` has only `/Title`, there is exactly one `%%EOF`, and the `/ID` changed; network-silence assertion.
