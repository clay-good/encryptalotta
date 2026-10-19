# Design — Business Identifier Checksums

## Context

Every identifier in this change is a short alphanumeric string with a published check-digit rule. Five algorithms cover all of them: ISO 7064 MOD 97-10 (LEI, also used for IBAN and ISO 11649 on the site already), Luhn over letter-expanded digits (ISIN), a position-weighted mod 10 with letter expansion (CUSIP, SEDOL), mod 11 with weights (ISBN-10, ISSN), and the GS1 / EAN alternating 1-3 mod 10 (ISBN-13, ISMN, GLN, GRAI, GSRN, GSIN). The IBAN tool already carries a BigInt-free MOD 97-10 (digit-by-digit remainder), and the GS1 tool already carries the alternating-weight mod 10. The page has `ISO_3166_1_ALPHA2` for the ISIN prefix check. No cryptography is involved.

The one design constraint that is not arithmetic is §7.1: the tool must be unable to validate a personal identifier even by accident.

## Goals / Non-Goals

**Goals:**
- Paste anything from a trade confirmation, invoice party block, or library record and get the type, the check-digit verdict, and the expected check digit on failure.
- Derive the sibling identifier where the standard defines it (ISIN from CUSIP / SEDOL, ISBN-13 from ISBN-10, EAN-13 from ISSN).
- A generic calculator for the seven algorithms so a developer can build fixtures or verify an identifier type the tool does not name.
- Bulk mode for a column of identifiers copied from a spreadsheet.

**Non-Goals:**
- No registry status (GLEIF LEI status, ANNA ISIN existence, ISBN agency assignment, GS1 company prefix ownership).
- No personal identifiers, no "add your own pattern" escape hatch that could be used for one.
- No CFI (ISO 10962) or FISN (ISO 18774) decoding in this slice.
- No full ISBN range table (the agency's RangeMessage.xml is ~1 MB); hyphenation hints only for the registration groups whose publisher ranges are stable and short.

## Decisions

1. **One tool with shape auto-detection and a type selector**, not one tool per identifier. Rationale: the identifiers are small and the user often does not know which they hold (`US0378331005` vs `037833100`). Ambiguous shapes (13 digits: GLN or ISBN-13 without the `978` / `979` prefix) default to the most likely type and show the alternative as a second row. Rejected alternative: separate LEI and ISIN tools — two more cards for three lines of arithmetic each.
2. **MOD 97-10 is the IBAN tool's function**, promoted to `mod97_10(s)` returning the remainder and `mod97_10Check(body)` returning the two digits. Letters map A=10 … Z=35 before the digit-by-digit loop, so no BigInt. Used by LEI and the generic calculator; the IBAN and ISO 11649 call sites switch to it without behaviour change.
3. **Luhn over expanded digits for ISIN**: letters expand to two digits *before* the right-to-left doubling (ISO 6166 Annex), which is where most hobby implementations go wrong; the test vector `US0378331005` and the derived `GB00B0YBKJ77` pin this.
4. **CUSIP and SEDOL get their own small functions** rather than a shared weighted engine: CUSIP doubles every second value and sums digit pairs (ANSI X9.6, letters A=10 …, `*`=36, `@`=37, `#`=38); SEDOL uses fixed weights 1,3,1,7,3,9 with letters A=10 … and no vowels permitted. Sharing would obscure two four-line functions.
5. **ISBN-13 / ISMN / GLN / GRAI / GSRN / GSIN reuse the GS1 mod-10** already in the GS1 tool (`gs1CheckDigit(digits)`), parameterised by length (13, 14, 18 for GSRN, 17 for GSIN; GRAI = 14-digit GTIN-like part plus optional serial). The new GS1 keys are added to the GS1 tool's type list, with the bizid tool linking to them for GLN.
6. **ISBN-10 → 13 is `978` + first nine + new EAN check; 13 → 10 only when the prefix is `978`** (a `979` ISBN-13 has no ISBN-10 form; ISO 2108 §5). Hyphenation hint uses an inline table of ~20 registration groups (0, 1, 2, 3, 4, 5, 7, 80–94, 600–649, …) with their publisher-range boundaries; when the group or publisher range is not in the table the tool says "hyphenation not determined" rather than guessing.
7. **ISSN → EAN-13** is `977` + the seven ISSN digits without the check + a two-digit sequence variant (`00` by default, user-editable for issue variants) + EAN check (ISO 3297 Annex). Shown as the barcode number libraries print.
8. **EORI is format-only and says so loudly.** The row reads "format matches (2-letter country + up to 15 alphanumerics); EORI numbers have no check digit; customs registration is not checked here". The country letters are checked against `ISO_3166_1_ALPHA2` with `XI` allowed. Rejected alternative: per-country EORI heuristics (DE = `DE` + 15 digits, NL = `NL` + RSIN …) — they encode national business-register formats that change and add nothing to the "is it well formed" answer.
9. **Generic calculators are pure functions `{compute(body), verify(full)}`** for Luhn, MOD 11-2, MOD 37-2, MOD 97-10, MOD 11,10, Verhoeff, Damm, each pinned to a published vector (ISO/IEC 7064:2003 Annex examples `079` → `X`, `G123489654321` → `Y`, `794` → `44`, `079` → `2`; Luhn `7992739871` → `3`; Verhoeff `236` → `3`; Damm `572` → `4`). The identifier validators above call these where the algorithm matches, so the fixtures and the validators cannot drift.
10. **§7.1 enforcement is a negative shape list, not a positive allowlist.** Before detection, the input is matched against the shapes of the rejected national IDs (e.g. 9 digits with optional dashes `nnn-nn-nnnn`, UK NINO `AA nn nn nn A`, PESEL 11 digits, Steuer-ID 11 digits, NIR 13 + 2 digits, BSN 9 digits, DNI 8 digits + letter, Codice Fiscale 16 alphanumerics with its letter / digit pattern); a match is refused with the §7.1 message even if a commercial type could also fit. The generic calculators accept arbitrary digit strings but carry the same note and never label the result as any national ID. Rejected alternative: silently validating by arithmetic — the whole point of §7.1 is that the site does not become a national-ID checker.
11. **Pure JS throughout; no Web Crypto.** Nothing to decide on the crypto axis.

## Risks / Trade-offs

- **Shape ambiguity.** 13 digits can be a GLN, an ISBN-13, a GTIN-13, or an ISSN EAN; 9 characters can be a CUSIP or a BSN-shaped number. Mitigation: the negative list runs first, then the prefix (`978` / `979` / `977`) disambiguates, then the selector lets the user override; every ambiguous result shows the alternatives it considered.
- **ISBN hyphenation drift.** Publisher ranges change yearly. Mitigation: hints only for stable groups, "not determined" otherwise, and the table carries its snapshot date.
- **Over-reading a ✓.** A valid LEI check digit is not a live LEI; a valid ISIN is not a listed security. Every result row says so and names the registry the user would consult.
- **SEDOL vowels and CUSIP special characters.** Both standards reserve characters (SEDOL excludes vowels; CUSIP uses `*` `@` `#` for PPN issues). The validators follow the standards; the detector tolerates lowercase and spaces only.
- **GS1 tool growth.** Four new keys in the GS1 type list could crowd the picker. Mitigation: grouped under "Location & logistics" in the existing selector; no new view.
