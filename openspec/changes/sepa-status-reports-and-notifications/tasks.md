# Tasks — SEPA status reports, notifications, MT940, and the 2026 address cutover

## 1. pain.002 engine

- [ ] 1.1 Extend the SEPA type switch with `CstmrPmtStsRpt`; walker for `GrpHdr`, `OrgnlGrpInfAndSts`, `OrgnlPmtInfAndSts`, `TxInfAndSts` (namespace-blind, versions .03–.10).
- [ ] 1.2 Inline reason-code table `{code, meaningKey, rType, clause}` for the EPC-listed SEPA codes (AC01 AC04 AC06 AG01 AG02 AM04 AM05 BE01 MD01 MD02 MD06 MD07 MS02 MS03 RC01 RR01–RR04 FF01 SL01 CNOR DNOR …); fallback for unlisted ISO codes and `Prtry`.
- [ ] 1.3 Gates: status-code membership (`ACTC ACCP ACSP ACSC ACWC RJCT PDNG PART`), `RJCT` requires `StsRsnInf`, `PART` requires mixed `TxSts`, `OrgnlNbOfTxs` / `OrgnlCtrlSum` arithmetic, original-reference presence.

## 2. camt.054 / camt.052 adapters

- [ ] 2.1 Add `BkToCstmrDbtCdtNtfctn` and `BkToCstmrAcctRpt` to the switch; header adapters (`Ntfctn` / `Rpt` → the camt.053 header card, `Rpt/Bal` where present).
- [ ] 2.2 Call the camt.053 `Ntry` renderer; batch-vs-single detection from `NtryDtls/Btch/NbOfTxs` and `TxDtls` count.
- [ ] 2.3 Inline bank-transaction-code table (domain / family / sub-family, SEPA-relevant subset); decode `BkTxCd/Domn`, raw + `Prtry` fallback.
- [ ] 2.4 Gates: `CdtDbtInd` membership, `Amt/@Ccy` ISO 4217, `BookgDt` ≤ `ValDt` ordering warning, `Sts` membership (`BOOK PDNG INFO`), IBAN MOD-97 on `Acct/Id/IBAN`, batch `NbOfTxs` = `TxDtls` count.

## 3. MT940 engine

- [ ] 3.1 FIN detection (`{1:` envelope or a line starting `:20:`); envelope strip; `:tag:` record tokenizer with continuation lines and `-` terminator.
- [ ] 3.2 Tag walker for `:20: :21: :25: :28C: :60F/:60M: :61: :62F/:62M: :64: :65: :86:`; `:61:` sub-field parser (value date, entry date, D/C/RD/RC, funds code, comma-decimal amount, type `N`/`F` + 3, customer ref `//` bank ref, supplementary line).
- [ ] 3.3 Structured `:86:` detection (3-digit GVC + `?nn` sub-tags) and labelled rendering; verbatim fallback.
- [ ] 3.4 Multi-message chaining on `:28C:` and `60M` / `62M`; integer-cent balance gate; `:86:` ≤ 6 × 65 gate; `:61:` date validity; currency consistency across `:60:`/`:62:`/`:64:`; `:25:` IBAN MOD-97 when it is an IBAN.

## 4. Structured-address gates

- [ ] 4.1 Walk every `PstlAdr` under `Dbtr`, `Cdtr`, `UltmtDbtr`, `UltmtCdtr`, `InitgPty` on pain.001 / pain.008; classify structured / unstructured / hybrid.
- [ ] 4.2 Dated gate (⚠ before 15 November 2026, ✗ from that date; clock override shared with the Swiss QR-bill gate); `TwnNm` + `Ctry` presence gate when any structured child is present; hybrid gate (AdrLine with structured children beyond `TwnNm` / `Ctry`).
- [ ] 4.3 Address panel footnote: EPC 2025 rulebooks v1.1 / EPC153-22 v2.1 citation and the one-sentence VoP context note.

## 5. View

- [ ] 5.1 Results layout reuse: `#sepa-results` header card per new type, `#sepa-gates` list; new reason-code column in the transaction table; MT940 statement table with D/C colouring via existing classes.
- [ ] 5.2 Amounts via `Intl.NumberFormat` in the file's currency; dates via `Intl.DateTimeFormat`; MT940 `YYMMDD` expanded with a 20xx pivot and shown in ISO.
- [ ] 5.3 Summary-line wording per the verdict-language requirements; file-type badge for the seven formats.

## 6. Tests

- [ ] 6.1 `tests/specs/NN-sepa-reports.spec.js` (number assigned at implementation): pain.002 `ACCP` confirm / `RJCT AC04` flag with reason text; `PART` with mixed statuses; camt.054 batch entry; camt.052 single entry with balances; MT940 balanced confirm / off-by-one-cent flag; MT940 two-message chain confirm / broken-chain flag; `:86:` over six lines; structured address ✓, AdrLine-only ⚠ then ✗ (clock-injected), hybrid ✗; network-silence assertion; XSS payload in `AddtlInf` and `:86:` rendered inert.
- [ ] 6.2 Confirm the existing 27-spec SEPA cases pass unchanged.

## 7. Wiring and gates

- [ ] 7.1 ~90 STRINGS keys × 5 locales (en / fr / de reviewed; zh-CN / hi machine drafts); refresh the 5 en SEO prose keys for `sepa`; CLDR plural for "n transactions rejected".
- [ ] 7.2 TOOL_SYNONYMS add `pain.002 camt.054 camt.052 mt940 swift statement status report reason code`; RELATED_TOOLS unchanged; JSON-LD featureList text updated; audit gate 20 tool count stays 57.
- [ ] 7.3 README: SEPA feature paragraph and standards cheat-sheet rows (pain.002, camt.052/054, MT940, EPC153-22 v2.1); SPEC-INTERNATIONAL.md status note.
- [ ] 7.4 `node scripts/build-i18n-variants.js`, `node scripts/build-portable.js`, `node scripts/audit-release.js`; full Playwright suite green.
