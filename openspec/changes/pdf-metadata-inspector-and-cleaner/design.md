# Design — PDF Metadata Inspector & Cleaner

## Context

A PDF is a sequence of numbered objects followed by one or more cross-reference sections, each ending in `trailer` … `startxref` … `%%EOF`. Every incremental save appends new objects, a new xref section, and a new trailer whose `/Prev` points at the previous one; the old objects stay in the file. Metadata lives in five places: the trailer's `/Info` dictionary, the catalog's `/Metadata` XMP stream, the trailer's `/ID` array, the catalog's `/PieceInfo`, and each annotation's `/T` (author) and `/M` / `/CreationDate`. Since PDF 1.5, objects may be packed into compressed object streams (`/Type /ObjStm`) and the xref may itself be a compressed stream.

The site has two byte-level PDF scanners already: the PAdES path (finds `/Type /Sig` dictionaries and their `/Contents` hex string) and the Factur-X path (finds the `/EmbeddedFiles` name tree and inflates the `/EF /F` stream). Both are regex scans over a Latin-1 view of the bytes; neither resolves indirect references or object streams. The cleaner needs a real object reader, and both existing scanners benefit from it.

Cryptography: `crypto.getRandomValues` for the new `/ID`; Web Crypto SHA-256 only to display a digest of the cleaned file. No encryption or decryption is attempted.

## Goals / Non-Goals

**Goals:**
- Show everything a PDF reveals about its origin, including the fact that earlier revisions are still inside.
- Write a cleaned file that any viewer opens, with page content streams, fonts, and images copied byte-identical, and that contains exactly one revision.
- Explain, not remove, active content in this slice; be explicit that the toggle is slice 2.
- Stay inside the house norms: no library, no WASM, `textContent` only, verdict language from docmeta.

**Non-Goals:**
- No rendering, no text extraction, no page-content redaction.
- No decryption (standard security handler or otherwise); encrypted files are inspected as far as the unencrypted structure allows and the cleaner refuses.
- No re-compression or optimisation; the cleaned file may be slightly larger than a linearized original.
- No PDF/A re-validation after cleaning; the tool reports the original's claim and notes that removing XMP breaks a PDF/A claim.

## Decisions

1. **Hand-rolled object reader, shared with the PAdES and Factur-X paths.** A tokenizer for ISO 32000-2 §7.2 lexical rules (whitespace, delimiters, comments) and §7.3 objects (booleans, numbers, strings with escapes and hex, names with `#xx`, arrays, dictionaries, streams, `R` references, `null`), an xref reader for tables (§7.5.4) and streams (§7.5.8, `/W` widths, `/Index` ranges), and an object-stream expander (§7.5.7). Resolution is lazy: `resolve(ref)` reads from the xref map and caches. The PAdES and Factur-X scanners switch to `catalog → AcroForm/Fields` and `catalog → Names → EmbeddedFiles` walks but keep their regex fallbacks for damaged files. Rejected alternative: vendoring pdf-lib or pdf.js — 300 KB+ gzipped against a 2 MB total budget and §7.7.
2. **Reconstruction when the xref is wrong.** Real files have off-by-N `startxref`. If the xref does not land on `N G obj`, the reader scans the whole file for `obj` tokens and rebuilds the map, reporting "xref rebuilt" as a ⚠ row (same approach every viewer takes).
3. **Streams are inflated only when needed**: object streams, the xref stream, the XMP stream, and `/EmbeddedFiles` streams. Page content streams are never inflated — the cleaner copies their raw bytes and their dictionaries unchanged. `DecompressionStream('deflate')` handles `/FlateDecode`; `/DecodeParms` with a `/Predictor` ≥ 10 (PNG predictors, common in xref streams) is undone in pure JS. Other filters on structural streams are reported as unsupported; the inspection continues from the regex fallback.
4. **Revision count = number of `%%EOF` markers**, cross-checked with the `/Prev` chain length; the inspection row says "n revisions — earlier revisions are still in the file and recoverable with any PDF tool; cleaning collapses them". `/XRefStm` hybrid files count as one revision per trailer.
5. **Verdict ladder copied from docmeta**: *leaky* when `/Info` has any key other than `/Title`, or XMP has `dc:creator` / `xmp:CreatorTool` / `pdf:Producer` / `xmpMM:History`, or `/PieceInfo` exists, or any annotation `/T` is non-empty, or more than one revision exists; *review* when only `/Title`, `/Lang`, dates, an `/ID`, or embedded files are present; *clean* otherwise. Same three strings, same colours, same "this file reveals information about its authors and history" sentence.
6. **The cleaner rewrites, it does not patch.** Output = `%PDF-x.y` header (original version) ‖ every *live* object (the latest generation reachable from the final trailer, via the xref map) serialised in object-number order ‖ a classic xref table ‖ a new trailer (`/Size`, `/Root`, new `/ID`, `/Info` → a new dictionary with only `/Title`) ‖ `startxref` ‖ `%%EOF`. Object streams are expanded so every object is a top-level object (simpler xref, viewer-neutral). Streams are written with their original raw bytes and `/Length` set to the actual byte count. `/Linearized` dictionaries and hint streams are dropped (they describe the old layout). Rejected alternative: appending a sanitising incremental update — leaves every old object in place, which is the leak being fixed.
7. **XMP handling is a two-way switch**: *remove* deletes `/Metadata` from the catalog; *minimal* replaces the stream with a packet carrying only `dc:title` (if a title is kept) and `pdfaid:*` when the original claimed PDF/A — with the note that the claim is no longer verified. Default is *remove* unless a PDF/A claim was found, then *minimal*.
8. **Annotation `/T` is set to an empty string, not deleted**, and `/Popup` titles follow; `/Contents` of comments is left alone (that is user content). `/M` and `/CreationDate` on annotations are removed. `/NM` (annotation name) is kept because viewers use it for reply threading.
9. **Encrypted files are refused by the cleaner** when the trailer has `/Encrypt`: rewriting would need the key to re-encrypt strings and streams. The inspector still reports what is readable (header, revision count, `/ID`, filter names, `/Encrypt /V /R` and whether a user password is required).
10. **Active content is a walk, not a scan**: catalog `/OpenAction`, `/AA`, `/Names /JavaScript`; per page `/AA` and each annotation's `/A` / `/AA`; AcroForm field `/AA`; actions typed by `/S` (`/JavaScript`, `/Launch`, `/URI`, `/SubmitForm`, `/GoToR`, `/ImportData`, `/Sound`, `/Movie`, `/RichMedia`), plus `/EmbeddedFiles` and `/FileAttachment` annotations and any stream with `/F` (external file). Each is a row with the ISO 32000-2 §12.6.4 sub-clause and a one-line "what this can do". Slice 2 (removal) is a disabled toggle with a tooltip.
11. **Dates** `D:YYYYMMDDHHmmSSOHH'mm'` decode to ISO 8601 with offset per §7.9.4; malformed dates are shown raw with a ⚠.
12. **Pure JS for parsing and writing; Web Crypto only for `getRandomValues` (new `/ID`, 2 × 16 bytes) and optional SHA-256 of the output.** No other primitive involved.

## Risks / Trade-offs

- **Malformed PDFs.** The format tolerates garbage; viewers rebuild. Mitigation: decision 2's rebuild, every parse error degrades to a ⚠ row, and the cleaner refuses to write when any live object failed to parse (no half-clean output).
- **Signed PDFs.** Rewriting invalidates every PAdES signature by construction. Mitigation: the inspector lists signatures (reusing the PAdES path) and the cleaner shows a confirmation note "cleaning will break n signature(s)"; signatures are a legitimate reason to keep the file as is.
- **PDF/A claims.** Removing XMP makes a PDF/A file non-conformant. Mitigation: decision 7's *minimal* mode and an explicit note; the tool never re-asserts PDF/A conformance it cannot verify.
- **Object-stream expansion grows files** by a few percent. Accepted: simplicity and viewer neutrality over size.
- **Browser memory for large PDFs.** Everything is in one `Uint8Array` plus parsed objects; files above ~200 MB may fail. Mitigation: a size check with a clear message; typical documents are under 20 MB.
- **False confidence.** A *clean* verdict means these metadata carriers are empty; page content, images, and fonts can still identify an author (names in the text, a scanner's halftone pattern, embedded font subsets). The verdict text says so and never uses "anonymous" or "safe".
