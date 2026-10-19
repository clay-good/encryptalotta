# Proposal — Business Identifier Checksums (LEI / ISIN / CUSIP / SEDOL / ISBN / ISSN / GLN)

## Why

The site validates the identifiers that move money (IBAN, BIC), tax (VAT), and goods (GS1 / EAN / GTIN). It does not validate the identifiers that name the *parties* and *instruments* those flows refer to: the **LEI** that every EU derivative report and MiFID transaction report must carry, the **ISIN / CUSIP / SEDOL** on every securities trade confirmation, the **ISBN / ISSN** on every publication record, and the **GLN** on every GS1 location in an e-invoice party block (PEPPOL EAS `0088`). All of them have published check digits computed by five well-known algorithms (ISO 7064 MOD 97-10, Luhn, weighted mod 10 / mod 11, EAN mod 10), and people check them today on web forms that log the query. A typo in a LEI or ISIN is caught by arithmetic in a millisecond; a wrong-but-valid identifier is caught only by the registry, which is why this tool never pretends to be one.

Every identifier in this tool names a company, a security, a publication, or a location. None names a person. §7.1 rejects personal identifiers (SSN, NINO, PESEL, Steuer-ID, NIR, BSN, DNI, Codice Fiscale) by design; this tool must not become the place they are added.

## What Changes

- **New tool `bizid` — "Business Identifier Checksums (LEI / ISIN / CUSIP / SEDOL / ISBN / ISSN / GLN)"** in Utilities, next to IBAN, BIC, VAT, and GS1. Tool count **57 → 58**.
- **Auto-detect** by shape (20 alphanumerics → LEI; 12 starting with two letters → ISIN; 9 → CUSIP; 7 → SEDOL; `97x` 13 digits → ISBN-13 / ISSN EAN; 10 with optional `X` → ISBN-10; `nnnn-nnnX` → ISSN; `979-0…` → ISMN; 13 digits → GLN) with a manual type selector, and a **bulk mode** (one identifier per line) that returns a table.
- **Derivations**: ISIN ↔ CUSIP / SEDOL (`US` + CUSIP + check; `GB00` + SEDOL + check), ISBN-10 ↔ ISBN-13, ISSN → EAN-13 (`977` prefix), ISBN hyphenation hint when the registration group is unambiguous.
- **Generic check-digit calculators** — Luhn, ISO 7064 MOD 11-2, MOD 37-2, MOD 97-10, MOD 11,10, Verhoeff, Damm — compute and verify for arbitrary input, with the ISO 7064 published examples as test vectors.
- **GS1 tool extension in the same change**: GLN, GRAI, GSRN, and GSIN join EAN / GTIN / SSCC in the existing GS1 mod-10 family; **EORI** format check (2-letter country + up to 15 alphanumerics) with the explicit statement that EORI has no check digit and no customs lookup is made.
- Related-tool links: IBAN ↔ BIC ↔ VAT ↔ GS1 ↔ bizid ↔ UBL inspector (party identifiers).

Out of scope (and the §7 non-goal it respects): **no personal identifiers of any kind** (§7.1) — the input parser rejects anything that matches a national-ID shape with a pointer to the spec; no GLEIF, ANNA, or ISBN-agency lookups (§7.5 / §0.1 — the tool says "check digits verify; registration status is not checked here"); no price or market data; no CFI / FISN decoding (different standard family, possible follow-up); no VAT or IBAN duplication (links to the existing tools).

## Capabilities

### New Capabilities
- `lei-validation`: ISO 17442 Legal Entity Identifier structure and ISO 7064 MOD 97-10 check digits, single and bulk.
- `securities-identifier-validation`: ISIN (ISO 6166), CUSIP (ANSI X9.6), SEDOL check digits, ISO 3166 prefix check, and ISIN ↔ CUSIP / SEDOL derivation.
- `publication-identifier-validation`: ISBN-10 / ISBN-13 / ISMN (ISO 2108 / ISO 10957) and ISSN (ISO 3297) check digits, ISBN-10 ↔ 13 conversion, ISSN → EAN-13, hyphenation hints.
- `gs1-location-and-logistics-identifiers`: GLN, GRAI, GSRN, GSIN mod-10 checks in the GS1 tool, plus EORI format check with a no-checksum statement.
- `generic-check-digit-calculators`: Luhn, ISO/IEC 7064 MOD 11-2 / 37-2 / 97-10 / 11,10, Verhoeff, Damm — compute and verify.

### Modified Capabilities
- none (the GS1 tool gains new identifier types written here as a new capability; no OpenSpec baseline exists for the GS1 tool yet).

## Impact

- `index.html`: one new view, ~400 lines of inline JS (shape detector, seven check-digit engines of which MOD 97-10 and EAN mod 10 are shared with IBAN / GS1, derivation helpers, ISBN group table for the common registration groups, bulk table renderer), ~45 STRINGS keys × 5 locales + 5 en SEO keys; ~30 lines in the GS1 section for the four new GS1 keys and EORI.
- Reuses: `ibanValidate()`'s MOD 97-10 digit-by-digit arithmetic, the GS1 mod-10 weighted check, `ISO_3166_1_ALPHA2`, `Intl.ListFormat` for bulk summaries, the result-row and gate-list components.
- No new vendored file, no CSP change, page weight +~9 KB gzipped.
- Governing documents: ISO 17442-1:2020 (LEI); ISO 6166:2021 (ISIN); ANSI X9.6 (CUSIP); London Stock Exchange SEDOL Masterfile technical specification; ISO 2108:2017 (ISBN); ISO 10957:2009 (ISMN); ISO 3297:2020 (ISSN); GS1 General Specifications §7.9 (check digit); EU Regulation 952/2013 and Implementing Regulation 2015/2447 Annex 12-01 (EORI format); ISO/IEC 7064:2003.
- Tests: new `tests/specs/NN-bizid.spec.js` (number assigned at implementation; 29+). Confirm/flag pairs per identifier using the vectors in the specs; derivation round trips; bulk mode with mixed valid / invalid lines; a national-ID-shaped input rejected with the §7.1 message; network-silence assertion.
